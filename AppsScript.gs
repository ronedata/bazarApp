// ====== CONFIG ======
const SPREADSHEET_ID = '1WuR6RSU9rfeW5LMx-JV1sVBlQrp9LqSH_hj2fd7LZi8'; // <-- আপনার শিট আইডি দিন
const SHEET_ITEMS = 'Items';                   // A1 header: Item
const SHEET_HISAB = 'Hisab';                   // A1:D1 headers: Date | Item | Price | Description

function getSheet(name){ return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name); }
function ok(data){ return ContentService.createTextOutput(JSON.stringify({ok:true, data}))
                  .setMimeType(ContentService.MimeType.JSON); }
function err(msg){ return ContentService.createTextOutput(JSON.stringify({ok:false, error: msg}))
                  .setMimeType(ContentService.MimeType.JSON); }

// ====== BODY PARSER (JSON + x-www-form-urlencoded; fallback e.parameter) ======
function parseBody(e){
  if(e && e.postData){
    const ct = e.postData.type || '';
    const raw = e.postData.contents || '';
    if(ct.indexOf('application/json') !== -1){
      try { return JSON.parse(raw || '{}'); } catch(_){ return {}; }
    }
    // x-www-form-urlencoded
    const obj = {};
    (raw+'').split('&').forEach(kv=>{
      if(!kv) return;
      const p = kv.split('=');
      const k = decodeURIComponent(p[0] || '');
      const v = decodeURIComponent((p[1] || '').replace(/\+/g,' '));
      obj[k] = v;
    });
    return obj;
  }
  return (e && e.parameter) ? e.parameter : {};
}

// ===== utils for date parsing/formatting (handles Date object, 'M/D/YYYY', 'YYYY/MM/DD', generic) =====
function parseToDate(value){
  if(!value) return null;
  if(Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return value;

  const s = String(value).trim();

  // M/D/YYYY e.g. 8/11/2025
  let mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(mdy){
    const m = +mdy[1]-1, d = +mdy[2], y = +mdy[3];
    const dt = new Date(y, m, d);
    if(!isNaN(dt)) return dt;
  }
  // YYYY/MM/DD e.g. 2025/08/11
  let ymd = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if(ymd){
    const y = +ymd[1], m = +ymd[2]-1, d = +ymd[3];
    const dt = new Date(y, m, d);
    if(!isNaN(dt)) return dt;
  }
  // generic
  const dt = new Date(s);
  if(!isNaN(dt)) return dt;

  console.log('Unparseable date:', s);
  return null;
}
function toYM(dt){ return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM'); }
function toYMD(dt){ return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

// ====== GET ======
function doGet(e){
  try{
    // ---- Safe params extraction ----
    const params = (e && typeof e === 'object' && e.parameter) ? e.parameter
                  : (typeof e === 'object' ? e
                  : (typeof e === 'string' ? { month: e } : {}));

    const action = (params.action || '').toString().toLowerCase();

    // items
    if(action === 'items'){
      const sh = getSheet(SHEET_ITEMS);
      const n = Math.max(sh.getLastRow()-1, 0);
      const values = n ? sh.getRange(2,1,n,1).getValues().flat().filter(String) : [];
      return ok(values);
    }

    // report: /exec?action=report&month=2025-08[&item=ঔষধ]
    if(action === 'report'){
      const month = (params.month || '').toString().trim();      // 'yyyy-MM'
      const filterItem = (params.item || '').toString().trim();  // optional
      if(!month) return err('month (yyyy-MM) required');

      const sh = getSheet(SHEET_HISAB);
      const n = Math.max(sh.getLastRow()-1, 0);
      const rows = n ? sh.getRange(2,1,n,4).getValues() : [];

      const filtered = rows.map(r=>{
          const dt = parseToDate(r[0]); // Date or null
          return {
            date: dt,                               // keep Date for formatting
            item: (r[1] || '').toString(),
            price: Number(r[2]) || 0,
            description: r[3],
            _ym: dt ? toYM(dt) : ''
          };
        })
        .filter(x => x._ym === month && (!filterItem || x.item.trim() === filterItem));

      const total = filtered.reduce((s,x)=> s + (x.price || 0), 0);
      const perItem = {};
      filtered.forEach(x => { perItem[x.item] = (perItem[x.item] || 0) + (x.price || 0); });

      // send date as string 'yyyy-MM-dd' to avoid timezone shift on client
      return ok({
        rows: filtered.map(x => ({
          date: x.date ? toYMD(x.date) : '',   // <-- normalized string
          item: x.item,
          price: x.price,
          description: x.description
        })),
        total,
        perItem
      });
    }

    return err('Unknown action');
  }catch(ex){
    console.log('Catch ex:', ex, 'Local params:', JSON.stringify(e));
    return err(ex.message || 'Unhandled error');
  }
}

// ====== POST ======
function doPost(e){
  try{
    const body = parseBody(e);
    const raw = (body.action || '').trim();
    const action = raw.toLowerCase();

    // add item
    if(action === 'additem' || raw === 'addItem'){
      const item = (body.item || '').trim();
      if(!item) return err('Item required');
      getSheet(SHEET_ITEMS).appendRow([item]);
      return ok({added:item});
    }

    // add hisab
    if(action === 'addhisab' || raw === 'addHisab'){
      const dateIn = body.date;              // "8/11/2025" বা "2025/08/11" বা ISO
      const item = body.item;
      const price = body.price;
      const description = body.description;

      if(!dateIn || !item || price === undefined){
        return err('date, item, price required');
      }

      // শিটে Date অবজেক্ট রাখতে চাইলে:
      const dt = parseToDate(dateIn) || new Date(dateIn);
      getSheet(SHEET_HISAB).appendRow([ dt, item, Number(price)||0, description||'' ]);

      // (যদি স্ট্রিং হিসেবেই রাখতে চান, উপরের লাইন বদলে নিচেরটা ব্যবহার করুন)
      // getSheet(SHEET_HISAB).appendRow([ dateIn, item, Number(price)||0, description||'' ]);

      return ok({saved:true});
    }

    return err('Unknown action');
  }catch(ex){ return err(ex.message); }
}
