// ===== Existing helpers (kept) =====
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

// ===== NEW: Cache helpers =====
const CACHE_VERSION = 'v1';
const CK = {
  SHEET_VER: `nb:sheetver:${CACHE_VERSION}`,
  CUR:       `nb:report:cur:${CACHE_VERSION}`,
  PREV:      `nb:report:prev:${CACHE_VERSION}`,
};
function cacheGet(key){
  try{ return JSON.parse(localStorage.getItem(key)||'null'); }catch(_){ return null; }
}
function cacheSet(key, val){
  try{ localStorage.setItem(key, JSON.stringify({ _ts:Date.now(), data: val })); }catch(_){}
}
function setDataStatus(mode){ // 'live'|'cached'|null
  const el = $('dataStatus');
  if(!el) return;
  if(!mode){ el.classList.add('d-none'); return; }
  el.textContent = (mode==='cached'?'Cached':'Live');
  el.className = `badge rounded-pill data-status ${mode==='cached'?'text-bg-secondary':'text-bg-success'}`;
  el.classList.remove('d-none');
}

// ===== NEW: Sheet version check from backend =====
async function fetchSheetVersion(){
  // ok({ver:number, iso:string})
  const res = await apiGet({ action:'sheetver' });
  if(res?.ok && res.data?.ver) return Number(res.data.ver);
  // fallback: if not available yet, force refresh with a random ver
  return Date.now();
}

// ===== Overlay + internet helpers (kept, slightly reused) =====
function setQuickLinksDisabled(disabled=true){
  document.querySelectorAll('.quick-links a.btn').forEach(a=>{
    a.classList.toggle('disabled-link', disabled);
    a.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    a.tabIndex = disabled ? -1 : 0;
  });
}
function showOverlay(state){ // 'loading'|'offline'|'hide'
  const overlay = $('netOverlay'), loading=$('netLoading'), offline=$('netOffline');
  if(!overlay) return;
  if(state==='hide'){ overlay.style.display='none'; return; }
  overlay.style.display='flex';
  loading?.classList.toggle('d-none', state!=='loading');
  offline?.classList.toggle('d-none', state!=='offline');
}
function timeout(ms){ return new Promise(res=>setTimeout(res, ms)); }
async function pingOnline(){
  if(typeof navigator!=='undefined' && navigator.onLine===false) return false;
  try{
    const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(), 4000);
    await fetch('https://www.gstatic.com/generate_204',{mode:'no-cors',signal:ctrl.signal,cache:'no-store'}); clearTimeout(t);
    return true;
  }catch(_){}
  return false;
}

// ===== Rendering (kept, refactored into pure render) =====
function renderSummary(curData, prevData){
  const cur = monthParts(0);
  const prev = monthParts(-1);

  $('monthTitle').textContent = cur.label;
  $('prevTitle').textContent  = prev.label;

  // current
  const curTotal   = Number(curData?.total||0);
  const curPerItem = curData?.perItem||{};
  const curRows    = curData?.rows||[];

  $('totalLine').innerHTML = `<span class="text-success fw-semibold">Grand</span> <span class="muted">Total:</span> <span class="fw-bold text-primary">${fmt(curTotal)}</span>`;
  const rent = Number(curPerItem['বাসা ভাড়া']||0);
  const elec = Number(curPerItem['বিদ্যুৎ বিল']||0);
  const wifi = Number(curPerItem['Wifi']||0);
  $('rentValue').textContent = fmt(rent);
  $('electricValue').textContent = fmt(elec);
  $('wifiValue').textContent = fmt(wifi);
  const curMinus = rent+elec+wifi; const curNet = curTotal - curMinus;
  $('grandFormulaCur').textContent = `Total: ${fmt(curTotal)} − ${fmt(curMinus)} = ${fmt(curNet)}`;
  if(curRows.length===0 && $('emptyMsg')) $('emptyMsg').style.display='block';

  // previous
  const pTotal = Number(prevData?.total||0);
  const pPer   = prevData?.perItem||{};
  $('prevTotalLine').innerHTML = `<span class="text-success fw-semibold">Grand</span> <span class="muted">Total:</span> <span class="fw-bold text-primary">${fmt(pTotal)}</span>`;
  const pRent = Number(pPer['বাসা ভাড়া']||0);
  const pElec = Number(pPer['বিদ্যুৎ বিল']||0);
  const pWifi = Number(pPer['Wifi']||0);
  $('prevRent').textContent = fmt(pRent);
  $('prevElectric').textContent = fmt(pElec);
  $('prevWifi').textContent = fmt(pWifi);
  const pMinus = pRent+pElec+pWifi; const pNet = pTotal - pMinus;
  $('grandFormulaPrev').textContent = `Total: ${fmt(pTotal)} − ${fmt(pMinus)} = ${fmt(pNet)}`;

  // details button
  const b=$('btnDetails');
  if(b && !b.__bound){
    b.addEventListener('click', ()=>renderDetails(curData?.perItem||{}));
    b.__bound=true;
  }
}
function renderDetails(perItem){
  const ul = $('summaryList');
  ul.innerHTML = '';
  const items = Object.entries(perItem||{}).sort((a,b)=>b[1]-a[1]);
  if(items.length===0){ ul.innerHTML = `<li class="list-group-item text-center text-muted">No details</li>`; return; }
  items.forEach(([name,amt])=>{
    const li=document.createElement('li');
    li.className='list-group-item d-flex justify-content-between align-items-center';
    li.innerHTML = `<span>${name}</span><span class="fw-semibold">${fmt(amt)}</span>`;
    ul.appendChild(li);
  });
}

// ===== Fetchers (kept) =====
async function fetchReportFor(monthStr){
  const res = await apiGet({ action:'report', month: monthStr });
  if(!res?.ok) throw new Error('report failed');
  return res.data;
}

// ===== Main flow with caching =====
async function initWithCaching(){
  setQuickLinksDisabled(true);
  showOverlay('loading');

  // Try online quickly
  const online = await pingOnline();

  const cur = monthParts(0), prev = monthParts(-1);
  const cachedVer = (cacheGet(CK.SHEET_VER)||{}).data;
  const cachedCur = cacheGet(CK.CUR)?.data;
  const cachedPrev= cacheGet(CK.PREV)?.data;

  // OFFLINE path → show cache if available
  if(!online){
    if(cachedCur && cachedPrev){
      showOverlay('hide'); setQuickLinksDisabled(true); // লিংকগুলো অফলাইনেই নিষ্ক্রিয় থাকুক
      setDataStatus('cached');
      renderSummary(cachedCur, cachedPrev);
      return;
    }else{
      showOverlay('offline'); return;
    }
  }

  // ONLINE → get sheet version first
  let serverVer;
  try{ serverVer = await fetchSheetVersion(); }catch{ serverVer = Date.now(); }

  // If same version & have cache, use cache (no network hit)
  if(cachedVer && cachedVer === serverVer && cachedCur && cachedPrev){
    showOverlay('hide'); setQuickLinksDisabled(false);
    setDataStatus('cached');
    renderSummary(cachedCur, cachedPrev);
    return;
  }

  // Otherwise fetch fresh, then cache & render
  try{
    const [curData, prevData] = await Promise.all([
      fetchReportFor(cur.apiMonth),
      fetchReportFor(prev.apiMonth)
    ]);
    cacheSet(CK.CUR, curData);
    cacheSet(CK.PREV, prevData);
    cacheSet(CK.SHEET_VER, serverVer);
    showOverlay('hide'); setQuickLinksDisabled(false);
    setDataStatus('live');
    renderSummary(curData, prevData);
  }catch(_){
    // fallback: if fetch failed but cache present
    if(cachedCur && cachedPrev){
      showOverlay('hide'); setQuickLinksDisabled(false);
      setDataStatus('cached');
      renderSummary(cachedCur, cachedPrev);
    }else{
      $('errorMsg').style.display='block';
      showOverlay('offline');
    }
  }
}

// Boot
window.addEventListener('DOMContentLoaded', async ()=>{
  $('btnRetryNet')?.addEventListener('click', initWithCaching);
  await initWithCaching();
});
