// Helpers
async function apiGet(params){
  const url = WEB_APP_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, { method: 'GET' });
  return r.json();
}
async function apiPost(payload){
  // form-urlencoded => preflight এড়ায়
  const r = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(payload)
  });
  return r.json();
}
const $ = (id)=>document.getElementById(id);
const showLoader = (on)=>{ $('appLoader').hidden = !on; };
const msg = (t)=>{ $('msg').textContent = t || ''; };

// Dropdown fill from Items sheet
async function loadItems(){
  const wrap = document.querySelector('.select-wrap');
  const sel = $('item');

  // লোডিং শুরু
  wrap.classList.add('loading');
  sel.disabled = true;
  sel.innerHTML = '<option value="" selected>Loading...</option>';

  try{
    const res = await apiGet({ action:'items' });

    // প্রথম অপশন: Select item
    sel.innerHTML = '<option value="" selected disabled hidden>Select item</option>';
    (res.data || []).forEach(x=>{
      const o = document.createElement('option');
      o.value = o.textContent = x;
      sel.appendChild(o);
    });

    if((res.data || []).length === 0){
      const o = document.createElement('option');
      o.value = ''; o.textContent = 'No items found';
      sel.appendChild(o);
    }
  }catch(ex){
    sel.innerHTML = '<option value="">Failed to load items</option>';
  }finally{
    // লোডিং শেষ
    wrap.classList.remove('loading');
    sel.disabled = false;
  }
}

function clearForm(){
  const today = new Date().toISOString().slice(0,10);
  $('date').value = today;
  $('item').value = '';
  $('price').value = '';
  $('desc').value = '';
  msg('Cleared');
}

function formatDateMDY(dateStr){
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const m = d.getMonth() + 1; // 1-12
  const day = d.getDate();
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

async function saveHisab(){
  const dateRaw = $('date').value;
  const item = $('item').value;
  const price = $('price').value;
  const description = $('desc').value.trim();

  if(!dateRaw || !item || !price){
    msg('Date, Item, Price required');
    return;
  }

  // তারিখ ফরম্যাট করুন -> MM/DD/YYYY
  const date = formatDateMDY(dateRaw);
  if(!date){
    msg('Invalid date');
    return;
  }

  msg('Saving...');
  try{
    const res = await apiPost({ action:'addhisab', date, item, price, description });
    if(res.ok){      
      clearForm();
	  msg('Hisab saved ✔');
    }else{
      msg('Failed: ' + (res.error || 'Unknown error'));
    }
  }catch(ex){
    msg('Network error: ' + ex.message);
  }
}

// Initialize
window.addEventListener('DOMContentLoaded', async ()=>{
  // আজকের তারিখ ডিফল্ট
  $('date').value = new Date().toISOString().slice(0,10);

  // বোতাম ইভেন্ট
  $('btnSubmit').addEventListener('click', saveHisab);
  $('btnClear').addEventListener('click', clearForm);

  // ফुल-পেজ লডিং দেখাও যতক্ষণ না dropdown রেডি
  showLoader(true);
  await loadItems();
  showLoader(false);
});
