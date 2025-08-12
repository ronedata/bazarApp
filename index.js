async function apiGet(params){
  const url = WEB_APP_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, { method: 'GET' });
  return r.json();
}
const $ = (id)=>document.getElementById(id);
const fmt = n => Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});

function monthParts(offset=0){
  const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+offset);
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0');
  return { apiMonth:`${y}-${m}`, label:new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(d) };
}

async function loadSummary(){
  const cur = monthParts(0);
  const prev = monthParts(-1);

  // Initial loading states
  $('monthTitle').textContent = cur.label;
  $('totalLine').innerHTML   =
    `<span class="text-success fw-semibold">Grand</span> <span class="muted">Total:</span> <span class="fw-bold text-primary">Loading...</span>`;
  $('prevTitle').textContent = 'Loading...';
  $('prevTotalLine').innerHTML =
    `<span class="text-success fw-semibold">Grand</span> <span class="muted">Total:</span> <span class="fw-bold text-primary">Loading...</span>`;
  ['rentValue','electricValue','wifiValue','prevRent','prevElectric','prevWifi'].forEach(id=>$(id).textContent='--');
  $('grandFormulaCur').textContent = '';
  $('grandFormulaPrev').textContent = '';
  $('summaryList').innerHTML = '';
  if($('emptyMsg')) $('emptyMsg').style.display='none';
  if($('errorMsg')) $('errorMsg').style.display='none';

  // ----- Current -----
  let curRes;
  try{ curRes = await apiGet({ action:'report', month: cur.apiMonth }); }
  catch{ $('errorMsg').style.display='block'; return; }

  if(!curRes?.ok){ $('errorMsg').style.display='block'; return; }

  const curTotal   = Number(curRes.data?.total||0);
  const curPerItem = curRes.data?.perItem||{};
  const curRows    = curRes.data?.rows||[];

  $('totalLine').innerHTML =
    `<span class="text-success fw-semibold">Grand</span> <span class="muted">Total:</span> <span class="fw-bold text-primary">${fmt(curTotal)}</span>`;

  const rent = Number(curPerItem['বাসা ভাড়া']||0);
  const elec = Number(curPerItem['বিদ্যুৎ বিল']||0);
  const wifi = Number(curPerItem['Wifi']||0);

  $('rentValue').textContent = fmt(rent);
  $('electricValue').textContent = fmt(elec);
  $('wifiValue').textContent = fmt(wifi);

  const curMinus = rent+elec+wifi;
  const curNet   = curTotal - curMinus;
  $('grandFormulaCur').textContent = `Total: ${fmt(curTotal)} − ${fmt(curMinus)} = ${fmt(curNet)}`;

  if(curRows.length===0 && $('emptyMsg')) $('emptyMsg').style.display='block';

  // ----- Previous -----
  $('prevTitle').textContent = prev.label;   // header same size as current
  try{
    const prevRes = await apiGet({ action:'report', month: prev.apiMonth });
    if(prevRes?.ok){
      const pTotal = Number(prevRes.data?.total||0);
      const pPer   = prevRes.data?.perItem||{};

      $('prevTotalLine').innerHTML =
        `<span class="text-success fw-semibold">Grand</span> <span class="muted">Total:</span> <span class="fw-bold text-primary">${fmt(pTotal)}</span>`;

      const pRent = Number(pPer['বাসা ভাড়া']||0);
      const pElec = Number(pPer['বিদ্যুৎ বিল']||0);
      const pWifi = Number(pPer['Wifi']||0);

      $('prevRent').textContent = fmt(pRent);
      $('prevElectric').textContent = fmt(pElec);
      $('prevWifi').textContent = fmt(pWifi);

      const pMinus = pRent+pElec+pWifi;
      const pNet   = pTotal - pMinus;
      $('grandFormulaPrev').textContent = `Total: ${fmt(pTotal)} − ${fmt(pMinus)} = ${fmt(pNet)}`;
    }else{
      $('prevTotalLine').innerHTML =
        `<span class="text-success fw-semibold">Grand</span> <span class="muted">Total:</span> <span class="fw-bold text-primary">0</span>`;
      $('grandFormulaPrev').textContent = `Total: 0 − 0 = 0`;
    }
  }catch{
    $('prevTotalLine').innerHTML =
      `<span class="text-success fw-semibold">Grand</span> <span class="muted">Total:</span> <span class="fw-bold text-primary">0</span>`;
    $('grandFormulaPrev').textContent = `Total: 0 − 0 = 0`;
  }
}

// Details (item-wise)
async function loadDetails(){
  const ul = $('summaryList');
  ul.innerHTML = `<li class="list-group-item text-center text-muted">Loading...</li>`;
  const { apiMonth } = monthParts(0);
  try{
    const res = await apiGet({ action:'report', month: apiMonth });
    if(res?.ok){
      const items = Object.entries(res.data?.perItem||{}).sort((a,b)=>b[1]-a[1]);
      ul.innerHTML = '';
      if(items.length===0){ ul.innerHTML = `<li class="list-group-item text-center text-muted">No details</li>`; return; }
      items.forEach(([name,amt])=>{
        const li=document.createElement('li');
        li.className='list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = `<span>${name}</span><span class="fw-semibold">${fmt(amt)}</span>`;
        ul.appendChild(li);
      });
    }else{
      ul.innerHTML = `<li class="list-group-item text-danger text-center">Failed to load details</li>`;
    }
  }catch{
    ul.innerHTML = `<li class="list-group-item text-danger text-center">Error loading details</li>`;
  }
}

window.addEventListener('DOMContentLoaded', async ()=>{
  await loadSummary();
  const b=document.getElementById('btnDetails');
  if(b) b.addEventListener('click', loadDetails);
});
