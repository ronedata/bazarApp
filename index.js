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

// ===== NEW: Cache helpers (kept from earlier) =====
const CACHE_VERSION = 'v1-fast';
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
function setDataStatus(mode){ // 'live'|'cached'|'checking'|null
  const el = $('dataStatus');
  if(!el) return;
  if(!mode){ el.classList.add('d-none'); return; }
  const map = { live:'text-bg-success', cached:'text-bg-secondary', checking:'text-bg-warning' };
  el.textContent = (mode==='cached'?'Cached': mode==='live'?'Live':'Checking…');
  el.className = `badge rounded-pill data-status ${map[mode]||'text-bg-secondary'}`;
  el.classList.remove('d-none');
}

// ===== NEW: Faster online check =====
// 1) সঙ্গে সঙ্গে navigator.onLine true হলে True
// 2) দুটো পিং **প্যারালাল** (১.২–১.৫ সেক টাইমআউট): gstatic 204 + আপনার sheetver
//    ১.৫ সেকেন্ডের মধ্যে যেকোনো একটি সফল হলেই online ধরা হবে
function startAbort(ms){
  const ctrl = new AbortController(); const t=setTimeout(()=>ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: ()=>clearTimeout(t) };
}
async function ping204(){
  const {signal, cancel} = startAbort(1200);
  try{ await fetch('https://www.gstatic.com/generate_204', { mode:'no-cors', cache:'no-store', signal }); cancel(); return true; }
  catch{ cancel(); return false; }
}
async function pingSheetver(){
  const { apiMonth } = monthParts(0); // শুধু query freshness এর জন্য t যোগ
  const u = WEB_APP_URL + '?' + new URLSearchParams({ action:'sheetver', t: Date.now(), m: apiMonth });
  const {signal, cancel} = startAbort(1500);
  try{ await fetch(u, { method:'GET', cache:'no-store', signal }); cancel(); return true; }
  catch{ cancel(); return false; }
}
async function quickOnline(){
  if(typeof navigator!=='undefined' && navigator.onLine) return true;
  let online = false;
  // parallel probes
  ping204().then(ok=>{ if(ok) online = true; });
  pingSheetver().then(ok=>{ if(ok) online = true; });
  // wait up to 1500ms max
  await new Promise(res=>setTimeout(res, 1500));
  return online;
}

// ===== Overlay helpers (kept) =====
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

// ===== Rendering (kept) =====
function renderSummary(curData, prevData){
  const cur = monthParts(0);
  const prev = monthParts(-1);

  $('monthTitle').textContent = cur.label;
  $('prevTitle').textContent  = prev.label;

  const curTotal   = Number(curData?.total||0);
  const curPerItem = curData?.perItem||{};
  const curRows    = curData?.rows||[];
  $('totalLine').textContent = fmt(curTotal) + ' ৳';
  const rent = Number(curPerItem['বাসা ভাড়া']||0);
  const elec = Number(curPerItem['বিদ্যুৎ বিল']||0);
  const wifi = Number(curPerItem['Wifi']||0);
  $('rentValue').textContent = fmt(rent);
  $('electricValue').textContent = fmt(elec);
  $('wifiValue').textContent = fmt(wifi);
  const curMinus = rent+elec+wifi; const curNet = curTotal - curMinus;
  $('grandFormulaCur').textContent = `Net Cost: ${fmt(curNet)} ৳`;
  if(curRows.length===0 && $('emptyMsg')) $('emptyMsg').style.display='block';

  const pTotal = Number(prevData?.total||0);
  const pPer   = prevData?.perItem||{};
  $('prevTotalLine').textContent = fmt(pTotal) + ' ৳';
  const pRent = Number(pPer['বাসা ভাড়া']||0);
  const pElec = Number(pPer['বিদ্যুৎ বিল']||0);
  const pWifi = Number(pPer['Wifi']||0);
  $('prevRent').textContent = fmt(pRent);
  $('prevElectric').textContent = fmt(pElec);
  $('prevWifi').textContent = fmt(pWifi);
  const pMinus = pRent+pElec+pWifi; const pNet = pTotal - pMinus;
  $('grandFormulaPrev').textContent = `Net Cost: ${fmt(pNet)} ৳`;

  const b=$('btnDetails');
  const ul=$('summaryList');
  if(b && !b.__bound){
    b.addEventListener('click', ()=>{
      const show = ul.classList.toggle('d-none');
      b.textContent = show ? 'Hide Details' : 'View Details';
      if(show) renderDetails(prevData?.perItem||{});
    });
    b.__bound=true;
  }
}

function renderDetails(perItem){
  const ul = $('summaryList');
  if(!ul) return;
  ul.innerHTML = '';
  const items = Object.entries(perItem||{}).sort((a,b)=>b[1]-a[1]);
  if(items.length===0){ ul.innerHTML = `<li class="list-group-item text-center text-muted bg-light">No details</li>`; return; }
  items.forEach(([name,amt])=>{
    const li=document.createElement('li');
    li.className='list-group-item d-flex justify-content-between align-items-center bg-light';
    li.innerHTML = `<span>${name}</span><span class="fw-semibold">${fmt(amt)}</span>`;
    ul.appendChild(li);
  });
}

// ===== Backend helpers (kept) =====
async function fetchReportFor(monthStr){
  const res = await apiGet({ action:'report', month: monthStr });
  if(!res?.ok) throw new Error('report failed');
  return res.data;
}
async function fetchSheetVersion(){
  try{
    const res = await apiGet({ action:'sheetver', t: Date.now() });
    if(res?.ok && res.data?.ver) return Number(res.data.ver);
  }catch(_){}
  return Date.now();
}

// ===== Main flow (FAST): render from cache immediately if available =====
async function fastInit(){
  setQuickLinksDisabled(true);
  showOverlay('loading');

  const cur = monthParts(0), prev = monthParts(-1);
  const cachedVer = (cacheGet(CK.SHEET_VER)||{}).data;
  const cachedCur = cacheGet(CK.CUR)?.data;
  const cachedPrev= cacheGet(CK.PREV)?.data;

  // 1) যদি ক্যাশ থাকে → সাথে সাথে UI দেখাই (non-blocking)
  if(cachedCur && cachedPrev){
    setDataStatus('checking');
    renderSummary(cachedCur, cachedPrev);
    showOverlay('hide');                // overlay তে আর আটকে রাখব না
  }

  // 2) দ্রুত অনলাইন চেক (≤1.5s)
  const online = await quickOnline();

  if(!online){
    // অফলাইন হলে
    if(cachedCur && cachedPrev){
      setQuickLinksDisabled(true);      // অফলাইনে লিংকগুলো নিষ্ক্রিয় থাকুক
      setDataStatus('cached');
      return;                           // ক্যাশড UI দেখানোই থাকবে
    }else{
      showOverlay('offline');
      return;
    }
  }

  // 3) অনলাইনে এলে ভার্সন দেখুন
  const serverVer = await fetchSheetVersion();

  // 3a) ভার্সন একই + ক্যাশ আছে → ক্যাশই রাখুন (super fast)
  if(cachedVer && cachedVer === serverVer && cachedCur && cachedPrev){
    setQuickLinksDisabled(false);
    setDataStatus('cached');
    showOverlay('hide');
    return;
  }

  // 3b) নাহলে fresh ফেচ → ক্যাশ আপডেট → UI রেন্ডার
  try{
    const [curData, prevData] = await Promise.all([
      fetchReportFor(cur.apiMonth),
      fetchReportFor(prev.apiMonth)
    ]);
    cacheSet(CK.CUR,  curData);
    cacheSet(CK.PREV, prevData);
    cacheSet(CK.SHEET_VER, serverVer);
    setQuickLinksDisabled(false);
    setDataStatus('live');
    renderSummary(curData, prevData);
    showOverlay('hide');
  }catch(_){
    // ফেচ ব্যর্থ হলেও যদি আগের ক্যাশ থাকে, সেটাই দেখান
    if(cachedCur && cachedPrev){
      setQuickLinksDisabled(false);
      setDataStatus('cached');
      showOverlay('hide');
    }else{
      $('errorMsg').style.display='block';
      showOverlay('offline');
    }
  }
}

// Boot
window.addEventListener('DOMContentLoaded', async ()=>{
  $('btnRetryNet')?.addEventListener('click', fastInit);
  await fastInit();
});
