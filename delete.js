/* ===== Configurable backend action keys (adjust if needed) =====
   আপনার Apps Script/WEP_APP_URL-এ যেভাবে রয়েছে সেভাবে শুধু এই দুইটা নাম বদলালেই হবে
   উদাহরণ:
   - তালিকা আনার জন্য:  action=listhisab  (month, year)
   - ডিলিট করার জন্য:  action=deletehisab (id)
*/
const HISAB_LIST_ACTION   = 'listhisab';     // চলতি মাসের হিসাব লিস্ট
const HISAB_DELETE_ACTION = 'deletehisab';   // নির্দিষ্ট হিসাব ডিলিট

/* ===== Small helpers (keep same style as other pages) ===== */
const $ = (id)=>document.getElementById(id);

async function apiGet(params){
  const url = WEB_APP_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, { method:'GET' });
  return r.json();
}
async function apiPost(payload){
  const r = await fetch(WEB_APP_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(payload)
  });
  return r.json();
}

function show(el, yes){ el?.classList.toggle('d-none', !yes); }
function alertShow(id, yes){ $(id)?.classList.toggle('d-none', !yes); }
function formatBD(dateStr){
  // yyyy-mm-dd -> d MMM, yyyy
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr || '';
  return d.toLocaleDateString('bn-BD', { day:'numeric', month:'short', year:'numeric' });
}
function setMonthBadge(dt){
  const b = $('monthBadge');
  const text = dt.toLocaleDateString('bn-BD', { month:'long', year:'numeric' });
  if(b) b.textContent = `চলতি মাস: ${text}`;
}

/* ===== State ===== */
let __hisabs = [];           // {id, date, item, price, desc}
let __pendingDeleteId = null;

/* ===== Render ===== */
function renderList(list){
  const wrap = $('hisabList');
  const loading = $('listLoading');
  const empty = $('listEmpty');

  show(loading, false);
  wrap.innerHTML = '';

  if(Array.isArray(list) && list.length){
    list.forEach(row=>{
      // row: { id, date, item, price, desc }
      const card = document.createElement('div');
      card.className = 'h-card';

      const top = document.createElement('div');
      top.className = 'd-flex justify-content-between align-items-start gap-2';
      // title + meta
      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'h-title';
      title.textContent = row.item || '—';
      const meta = document.createElement('div');
      meta.className = 'h-meta';
      meta.textContent = `${formatBD(row.date)} · ${row.desc || 'No description'}`;
      left.appendChild(title);
      left.appendChild(meta);

      // price badge
      const price = document.createElement('span');
      price.className = 'badge text-bg-success price-badge pill';
      price.textContent = (row.price != null ? row.price : 0) + ' ৳';

      top.appendChild(left);
      top.appendChild(price);

      // actions
      const actions = document.createElement('div');
      actions.className = 'd-flex justify-content-end mt-2';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-sm btn-danger';
      delBtn.innerHTML = '<i class="bi bi-trash me-1"></i>Delete';
      delBtn.setAttribute('data-id', row.id);
      delBtn.setAttribute('data-summary', `${row.item} (${formatBD(row.date)}) — ${row.price}৳`);
      actions.appendChild(delBtn);

      card.appendChild(top);
      card.appendChild(actions);
      wrap.appendChild(card);
    });
    show(wrap, true);
    show(empty, false);
  }else{
    show(wrap, false);
    show(empty, true);
  }
}

/* ===== Load current month list ===== */
async function loadCurrentMonth(){
  alertShow('alertSuccess', false);
  alertShow('alertError', false);

  const now = new Date();
  setMonthBadge(now);

  const year  = now.getFullYear();
  const month = now.getMonth() + 1; // 1..12

  show($('listLoading'), true);
  show($('hisabList'), false);
  show($('listEmpty'), false);

  try{
    const res = await apiGet({ action: HISAB_LIST_ACTION, year, month });
    // প্রত্যাশিত payload: { ok:true, data:[{id,date,item,price,desc}, ...] }
    if(res && res.ok){
      __hisabs = Array.isArray(res.data) ? res.data : [];
      renderList(__hisabs);
    }else{
      __hisabs = [];
      renderList(__hisabs);
      alertShow('alertError', true);
    }
  }catch(e){
    __hisabs = [];
    renderList(__hisabs);
    alertShow('alertError', true);
  }
}

/* ===== Delete flow (Bootstrap modal confirm) ===== */
let __confirmModal = null;

function openConfirm(id, summary){
  __pendingDeleteId = id;
  const el = $('confirmSummary');
  if(el) el.textContent = summary || '—';
  __confirmModal?.show();
}

async function performDelete(){
  if(!__pendingDeleteId) return;

  try{
    const res = await apiPost({ action: HISAB_DELETE_ACTION, id: __pendingDeleteId });
    if(res && res.ok){
      alertShow('alertSuccess', true);
      await loadCurrentMonth();
    }else{
      alertShow('alertError', true);
    }
  }catch{
    alertShow('alertError', true);
  }finally{
    __pendingDeleteId = null;
  }
}

/* ===== Boot ===== */
window.addEventListener('DOMContentLoaded', async ()=>{
  // init modal
  const modalEl = document.getElementById('confirmDeleteModal');
  if(modalEl && window.bootstrap && bootstrap.Modal){
    __confirmModal = new bootstrap.Modal(modalEl);
  }
  // confirm button
  document.getElementById('confirmDeleteBtn')?.addEventListener('click', async ()=>{
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    try{ await performDelete(); }
    finally{
      btn.disabled = false;
      __confirmModal?.hide();
    }
  });

  // refresh
  document.getElementById('btnRefresh')?.addEventListener('click', (e)=>{
    e.preventDefault();
    loadCurrentMonth();
  });

  // delegate delete buttons
  document.getElementById('hisabList')?.addEventListener('click', (e)=>{
    const btn = e.target.closest('button.btn-danger');
    if(btn){
      const id = btn.getAttribute('data-id');
      const summary = btn.getAttribute('data-summary');
      openConfirm(id, summary);
    }
  });

  // initial load
  await loadCurrentMonth();
});
