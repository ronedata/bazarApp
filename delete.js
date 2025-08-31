/* ===== Backend actions (unchanged) ===== */
const HISAB_LIST_ACTION   = 'listhisab';
const HISAB_DELETE_ACTION = 'deletehisab';

/* ===== Helpers (unchanged) ===== */
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
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr || '';
  return d.toLocaleDateString('bn-BD', { day:'numeric', month:'long', year:'numeric' });
}
function setMonthBadge(dt){
  const b = $('monthBadge');
  const text = dt.toLocaleDateString('bn-BD', { month:'long', year:'numeric' });
  if(b) b.textContent = `চলতি মাস: ${text}`;
}

/* ===== State (unchanged) ===== */
let __hisabs = [];           // {id, date, item, price, desc}
let __pendingDeleteId = null;

/* ===== Render: updated layout ===== */
function renderList(list){
  const wrap = $('hisabList');
  const loading = $('listLoading');
  const empty = $('listEmpty');

  show(loading, false);
  wrap.innerHTML = '';

  if(Array.isArray(list) && list.length){
    list.forEach(row=>{
      // { id, date, item, price, desc }
      const card = document.createElement('div');
      card.className = 'h-card';

      // Header grid keeps price at right even on mobile
      const head = document.createElement('div');
      head.className = 'h-head';

      // left info
      const info = document.createElement('div');

      // 1) Date (bold)
      const dateEl = document.createElement('div');
      dateEl.className = 'h-date';
      dateEl.textContent = formatBD(row.date);

      // 2) Item (colored)
      const itemEl = document.createElement('div');
      itemEl.className = 'h-item';
      itemEl.textContent = row.item || '—';

      // 3) Description (badge), optional
      const descContainer = document.createElement('div');
      descContainer.className = 'h-desc';
      const hasDesc = row.desc && String(row.desc).trim().length > 0;
      if(hasDesc){
        const badge = document.createElement('span');
        badge.className = 'desc-badge';
        badge.textContent = String(row.desc).trim();
        descContainer.appendChild(badge);
      }

      info.appendChild(dateEl);
      info.appendChild(itemEl);
      if(hasDesc) info.appendChild(descContainer);

      // right price (always on right)
      const priceWrap = document.createElement('div');
      const price = document.createElement('span');
      price.className = 'badge text-bg-success price-badge pill';
      price.textContent = (row.price != null ? row.price : 0) + ' ৳';
      priceWrap.appendChild(price);

      head.appendChild(info);
      head.appendChild(priceWrap);

      // actions: small red delete button
      const actions = document.createElement('div');
      actions.className = 'd-flex justify-content-end mt-2';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-sm btn-danger'; // ছোট + লাল
      delBtn.innerHTML = '<i class="bi bi-trash me-1"></i>Delete';
      delBtn.setAttribute('data-id', row.id);
      delBtn.setAttribute('data-summary', `${formatBD(row.date)} · ${row.item} — ${row.price}৳`);

      actions.appendChild(delBtn);

      // build card
      card.appendChild(head);
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

/* ===== Load current month (unchanged) ===== */
async function loadCurrentMonth(){
  alertShow('alertSuccess', false);
  alertShow('alertError', false);

  const now = new Date();
  setMonthBadge(now);

  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  show($('listLoading'), true);
  show($('hisabList'), false);
  show($('listEmpty'), false);

  try{
    const res = await apiGet({ action: HISAB_LIST_ACTION, year, month });
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

/* ===== Delete flow (unchanged) ===== */
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

/* ===== Boot (unchanged IDs/bindings) ===== */
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
