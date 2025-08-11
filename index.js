// ---- Helpers ----
async function apiGet(params){
  const url = WEB_APP_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, { method: 'GET' });
  return r.json();
}
const $ = (id)=>document.getElementById(id);
const fmtMoney = n => Number(n||0).toLocaleString(undefined,{ maximumFractionDigits: 2 });

// মাসের সহায়ক: offsetMonths = 0 (কারেন্ট), -1 (পূর্বের মাস)
function monthParts(offsetMonths = 0){
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offsetMonths);
  const y = base.getFullYear();
  const mNum = base.getMonth() + 1;
  const m = String(mNum).padStart(2,'0');
  const apiMonth = `${y}-${m}`; // 'yyyy-MM'
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(base);
  return { apiMonth, label };
}

// ---- Summary Loader (current + previous with exclusions) ----
async function loadSummary(){
  const { apiMonth, label } = monthParts(0);     // current
  const prev = monthParts(-1);                   // previous

  $('monthTitle').textContent = label;
  $('totalLine').textContent = 'Loading...';
  $('prevLine').style.display = 'none';
  $('summaryList').innerHTML = '';
  $('emptyMsg').style.display = 'none';
  $('errorMsg').style.display = 'none';

  // 1) current month report
  let curRes;
  try{
    curRes = await apiGet({ action:'report', month: apiMonth });
  }catch{
    $('errorMsg').style.display = 'block';
    $('totalLine').textContent = '';
    return;
  }
  if(!curRes || !curRes.ok){
    $('errorMsg').style.display = 'block';
    $('totalLine').textContent = '';
    return;
  }

  const curTotal = curRes.data?.total || 0;
  const perItem = curRes.data?.perItem || {};
  const rows = curRes.data?.rows || [];

  $('totalLine').innerHTML = `Total: ${fmtMoney(curTotal)}`;

  if(rows.length === 0){
    $('emptyMsg').style.display = 'block';
  }else{
    // Per-item breakdown (desc)
    const items = Object.entries(perItem).sort((a,b)=> b[1]-a[1]);
    const ul = $('summaryList');
    items.forEach(([name, amt])=>{
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `<span>${name}</span><span class="fw-semibold">${fmtMoney(amt)}</span>`;
      ul.appendChild(li);
    });
  }

  // 2) previous month report (মোট, মাইনাস নির্দিষ্ট ক্যাটাগরি)
  try{
    const prevRes = await apiGet({ action:'report', month: prev.apiMonth });
    if(prevRes && prevRes.ok){
      const prevTotal = prevRes.data?.total || 0;
      const prevPerItem = prevRes.data?.perItem || {};

      // যেসব ক্যাটাগরি বাদ দিতে চান (নামের সাথে শিটের নাম হুবহু মিলতে হবে)
      const excludedItems = ["বাসা ভাড়া", "বিদ্যুৎ বিল", "Wifi"];

      // sum of exclusions
      let excludedSum = 0;
      excludedItems.forEach(k=>{
        if(Object.prototype.hasOwnProperty.call(prevPerItem, k)){
          excludedSum += Number(prevPerItem[k]) || 0;
        }
      });

      const netPrev = prevTotal - excludedSum;

      // উদাহরণ: July 2025 Total: 37,064 − (বাসা ভাড়া + বিদ্যুৎ বিল + Wifi = 1,500) = 35,564
      const excludeLabel = excludedItems.join(' + ');
      const line = `${prev.label} Total: ${fmtMoney(prevTotal)} \u2212 (${excludeLabel} = ${fmtMoney(excludedSum)}) = ${fmtMoney(netPrev)}`;

      $('prevLine').textContent = line;
      $('prevLine').style.display = 'block';
    }
  }catch{
    // আগের মাস না পেলেও পেজ চলবে—কিছু দেখাবো না
  }
}

// ---- Init (index পেজ) ----
window.addEventListener('DOMContentLoaded', async ()=>{
  await loadSummary();
});
