// ===== Helpers =====
async function apiGet(params){
  const url = WEB_APP_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, { method: 'GET' });
  return r.json();
}
const $ = (id)=>document.getElementById(id);
const fmtMoney = n => Number(n||0).toLocaleString(undefined,{ maximumFractionDigits: 2 });

// Items dropdown (with "All items")
async function loadItems(){
  const wrap = document.querySelector('#repItem').closest('.select-wrap');
  const sel = $('repItem');

  wrap.classList.add('loading');
  sel.disabled = true;
  sel.innerHTML = '<option value="" selected>Loading...</option>';

  try{
    const res = await apiGet({ action:'items' });
    sel.innerHTML = '<option value="__ALL__" selected>All items</option>';
    (res.data || []).forEach(x=>{
      const o = document.createElement('option');
      o.value = x; o.textContent = x;
      sel.appendChild(o);
    });
  }catch{
    sel.innerHTML = '<option value="">Failed to load items</option>';
  }finally{
    wrap.classList.remove('loading');
    sel.disabled = false;
  }
}

// Local date string (avoid UTC shift)
function fmtDateCell(v){
  const d = new Date(v);
  if(!isNaN(d)){
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  return String(v);
}

// ===== State (cache last response for details) =====
let lastRows = [];   // [{date,item,price,description}, ...]
let lastTotal = 0;
let lastPerItem = {};
let lastParams = {};

// ===== Load (Summary only) =====
async function loadReport(){
  const m = $('repMonth').value;             // 'yyyy-MM'
  const itemSel = $('repItem').value;        // '__ALL__' or specific item
  const body = $('repBody');
  const ul = $('perItemList');
  const tableCard = $('tableCard');
  const detailsBtn = $('btnDetails');
  const summary = $('summaryText');
  const bazer = $('bazerLine');

  // reset UI
  body.innerHTML = '';
  ul.innerHTML = '';
  tableCard.hidden = true;         // hide table until details requested
  detailsBtn.hidden = true;        // show after summary
  bazer.hidden = true;
  summary.textContent = 'Loading...';

  if(!m){ alert('Select month'); summary.textContent='Select month.'; return; }

  const params = { action:'report', month:m };
  if(itemSel && itemSel !== '__ALL__') params.item = itemSel;
  lastParams = params;

  let res;
  try{
    res = await apiGet(params);
  }catch{
    summary.textContent = 'Failed to load report (network error).';
    return;
  }
  if(!res || !res.ok){
    summary.textContent = res?.error || 'Failed to load report.';
    return;
  }

  lastRows   = res.data?.rows || [];
  lastTotal  = res.data?.total || 0;
  lastPerItem= res.data?.perItem || {};

  // Summary text
  const itemLabel = (itemSel === '__ALL__' || !itemSel) ? 'All items' : itemSel;
  summary.innerHTML = `<strong>Total:</strong> ${fmtMoney(lastTotal)} <span class="text-muted">(${itemLabel}, ${m})</span>`;

  // If All items => show per-item list + Bazer Expense line
  ul.innerHTML = '';
  if(!params.item){
    // per-item
    Object.entries(lastPerItem).forEach(([k,v])=>{
      const li = document.createElement('li');
      li.textContent = `${k}: ${fmtMoney(v)}`;
      ul.appendChild(li);
    });

    // Bazer Expense = Total − (rent+electric+wifi)
    const rent   = Number(lastPerItem['বাসা ভাড়া']||0);
    const electric = Number(lastPerItem['বিদ্যুৎ বিল']||0);
    const wifi   = Number(lastPerItem['Wifi']||0);
    const minus  = rent + electric + wifi;
    const result = lastTotal - minus;

    bazer.innerHTML = `Bazer Expense: ${fmtMoney(lastTotal)} − (${fmtMoney(minus)}) = ${fmtMoney(result)}`;
    bazer.hidden = false;
  }

  // After summary, show details button
  detailsBtn.hidden = false;
}

// ===== Load Details (render table, DESC by date) =====
function renderDetails(){
  const body = $('repBody');
  const tableCard = $('tableCard');

  body.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Loading...</td></tr>`;

  // sort by date desc (newest first). server sends 'yyyy-MM-dd' or Date
  const rows = [...lastRows].sort((a,b)=>{
    const da = new Date(a.date), db = new Date(b.date);
    return db - da; // desc
  });

  body.innerHTML = '';
  if(rows.length === 0){
    body.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No data</td></tr>`;
  }else{
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtDateCell(r.date)}</td>
        <td>${r.item || ''}</td>
        <td class="text-end">${fmtMoney(r.price)}</td>
        <td>${r.description || ''}</td>
      `;
      body.appendChild(tr);
    });
  }

  tableCard.hidden = false;
}

// ===== Init =====
window.addEventListener('DOMContentLoaded', async ()=>{
  // default current month
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  $('repMonth').value = monthStr;

  await loadItems();
  $('btnLoad').addEventListener('click', loadReport);
  $('btnDetails').addEventListener('click', renderDetails);
});
