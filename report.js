// Helpers
async function apiGet(params){
  const url = WEB_APP_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, { method: 'GET' });
  return r.json();
}
const $ = (id)=>document.getElementById(id);

// ---- Dropdown: Items (with "All items") ----
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

// ---- Date render: avoid UTC shift (no toISOString) ----
function fmtDateCell(v){
  const d = new Date(v);
  if (!isNaN(d)) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`; // yyyy-mm-dd in local timezone
  }
  return String(v); // if server already sent 'yyyy-MM-dd' or raw string like '8/11/2025'
}

function fmtMoney(n){
  return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ---- Load report ----
async function loadReport(){
  const m = $('repMonth').value;             // 'yyyy-MM'
  const itemSel = $('repItem').value;        // '__ALL__' or specific item
  const body = $('repBody');
  const ul = $('perItemList');

  body.innerHTML = '';
  ul.innerHTML = '';
  $('summaryText').textContent = 'Loading...';

  if(!m) { alert('Select month'); $('summaryText').textContent = 'Select month.'; return; }

  const params = { action:'report', month:m };
  if(itemSel && itemSel !== '__ALL__') params.item = itemSel;

  let res;
  try{
    res = await apiGet(params);
  }catch(err){
    $('summaryText').textContent = 'Failed to load report (network error).';
    return;
  }

  if(!res || !res.ok){
    $('summaryText').textContent = res?.error || 'Failed to load report.';
    return;
  }

  const rows = res.data?.rows || [];
  const total = res.data?.total || 0;
  const perItem = res.data?.perItem || {};

  if(rows.length === 0){
    const itemLabel = (itemSel==='__ALL__' || !itemSel) ? 'All items' : itemSel;
    $('summaryText').innerHTML = `<strong>Total:</strong> 0 <span class="text-muted">(${itemLabel}, ${m})</span>`;
    return;
  }

  // Table rows
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

  // Summary
  const itemLabel = (itemSel === '__ALL__' || !itemSel) ? 'All items' : itemSel;
  $('summaryText').innerHTML = `<strong>Total:</strong> ${fmtMoney(total)} &nbsp; <span class="text-muted">(${itemLabel}, ${m})</span>`;

  // Per-item breakdown (only if All items selected)
  if(!params.item && perItem){
    Object.entries(perItem).forEach(([k,v])=>{
      const li = document.createElement('li');
      li.textContent = `${k}: ${fmtMoney(v)}`;
      ul.appendChild(li);
    });
  }
}

// ---- Init ----
window.addEventListener('DOMContentLoaded', async ()=>{
  // default to current month
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  $('repMonth').value = monthStr;

  await loadItems();
  $('btnLoad').addEventListener('click', loadReport);
});
