// ===== Helpers =====
async function apiGet(params){
	console.log(params);
  const url = WEB_APP_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, { method: 'GET' });
  return r.json();
}
const $ = (id)=>document.getElementById(id);
const fmt = n => Number(n||0).toLocaleString(undefined,{ maximumFractionDigits: 0 });

// dropdown Items (All items সহ)
async function loadItems(){
  const wrap = document.querySelector('#repItem').closest('.select-wrap');
  const sel = $('repItem');
  wrap.classList.add('loading'); sel.disabled = true;
  sel.innerHTML = '<option value="" selected>Loading...</option>';
  try{
    const res = await apiGet({ action:'items' });
    sel.innerHTML = '<option value="__ALL__" selected>All items</option>';
    (res.data || []).forEach(x=>{
      const o = document.createElement('option'); o.value = x; o.textContent = x; sel.appendChild(o);
    });
  }catch{
    sel.innerHTML = '<option value="">Failed to load items</option>';
  }finally{
    wrap.classList.remove('loading'); sel.disabled = false;
  }
}

function fmtDateCell(v){
  const d = new Date(v);
  if(!isNaN(d)){
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  return String(v);
}

// ===== State =====
let lastRows = [];
let lastTotal = 0;
let lastPerItem = {};
let lastPerMonth = {};
let lastParams = {};

// ===== Load summary =====
async function loadYearSummary(){
  const y = $('repYear').value.trim();
  const sel = $('repItem').value;
  const sum = $('summaryText');
  const perMonthUL = $('perMonthList');
  const bazer = $('bazerLine');

  $('tableCard').hidden = true;
  $('btnDetails').hidden = true;
  perMonthUL.innerHTML = '';
  bazer.hidden = true;
  sum.textContent = 'Loading...';

  if(!y){ alert('Enter year'); sum.textContent='Enter year.'; return; }

  const params = { action:'reportyear', year: y };
  if(sel && sel !== '__ALL__') params.item = sel;
  lastParams = params;

  let res;
  try{ res = await apiGet(params); }
  catch{ sum.textContent = 'Failed to load (network error).'; return; }

  if(!res || !res.ok){ sum.textContent = res?.error || 'Failed to load.'; return; }

  lastRows = res.data?.rows || [];
  lastTotal = res.data?.total || 0;
  lastPerItem = res.data?.perItem || {};
  lastPerMonth = res.data?.perMonth || {};

  const itemLabel = (!params.item) ? 'All items' : params.item;
  $('sumTitle').textContent = `Summary — ${y}`;
  sum.innerHTML = `<strong>Year Total:</strong> ${fmt(lastTotal)} <span class="text-muted">(${itemLabel})</span>`;

  // All items হলে per-month দেখাবো + Bazer Expense
  if(!params.item){
    // per-month list (Jan..Dec)
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    Object.keys(lastPerMonth).sort().forEach((mm)=>{
      // mm is usually "01", "02" etc.
      const mIdx = parseInt(mm, 10) - 1;
      if(monthNames[mIdx]){
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center bg-transparent px-0 py-1';
        li.innerHTML = `<span>${monthNames[mIdx]}</span> <span class="fw-bold">${fmt(lastPerMonth[mm])}</span>`;
        perMonthUL.appendChild(li);
      }
    });

    // Bazer Expense = Total − (rent + electric + wifi)
    const rent = Number(lastPerItem['বাসা ভাড়া']||0);
    const elec = Number(lastPerItem['বিদ্যুৎ বিল']||0);
    const wifi = Number(lastPerItem['Wifi']||0);
    const minus = rent + elec + wifi;
    const result = lastTotal - minus;
    bazer.innerHTML = `Bazer Expense: ${fmt(lastTotal)} − (${fmt(minus)}) = ${fmt(result)}`;
    bazer.hidden = false;
  }

  $('btnDetails').hidden = false; // now you can show table
}

// ===== Details table (DESC by date) =====
function renderDetails(){
  const body = $('repBody');
  body.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Loading...</td></tr>`;

  const rows = [...lastRows].sort((a,b)=> new Date(b.date) - new Date(a.date));
  body.innerHTML = '';
  if(rows.length === 0){
    body.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No data</td></tr>`;
  }else{
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtDateCell(r.date)}</td>
        <td>${r.item || ''}</td>
        <td class="text-end">${fmt(r.price)}</td>
        <td>${r.description || ''}</td>
      `;
      body.appendChild(tr);
    });
  }
  $('tableCard').hidden = false;
}

// ===== Init =====
window.addEventListener('DOMContentLoaded', async ()=>{
  // default current year
  $('repYear').value = new Date().getFullYear();
  await loadItems();

  $('btnLoad').addEventListener('click', loadYearSummary);
  $('btnDetails').addEventListener('click', renderDetails);
});
