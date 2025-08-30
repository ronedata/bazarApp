// ===================== Helpers (unchanged API behavior) =====================
async function apiGet(params){
  const url = WEB_APP_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, { method: 'GET' });
  return r.json();
}

async function apiPost(payload){
  // form-urlencoded => preflight এড়ায় (আপনার আগের ইমপ্লিমেন্টেশন 그대로)
  const r = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(payload)
  });
  return r.json();
}

const $ = (id)=>document.getElementById(id);

const showLoader = (on)=>{ $('appLoader').hidden = !on; };

function setAlert(type, text){
  // type: 'success' | 'danger' | 'warning' | 'info' | 'secondary'
  $('msg').innerHTML = text
    ? `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
         ${text}
         <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
       </div>`
    : '';
}

// ===================== UI State helpers =====================
function setFormDisabled(disabled){
  const form = $('hisabForm');
  const controls = form.querySelectorAll('input, select, textarea, button');
  controls.forEach(el => {
    // msg area's close button/others বাইরে—form এর ভিতরেরগুলোকেই টার্গেট
    if (el.id !== 'msg') el.disabled = disabled;
  });
  form.setAttribute('aria-busy', disabled ? 'true' : 'false');

  // Submit button spinner toggle
  const sp = $('btnSpinner');
  if (sp) sp.classList.toggle('d-none', !disabled);
}

function clearForm(){
  const today = new Date().toISOString().slice(0,10);
  $('date').value = today;
  $('item').value = '';
  $('price').value = '';
  $('desc').value = '';
  // Bootstrap validation reset
  $('hisabForm').classList.remove('was-validated');
}

function formatDateMDY(dateStr){
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const m = d.getMonth() + 1; // 1-12
  const day = d.getDate();
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

// ===================== Data load (items) =====================
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
    setAlert('danger', 'Items লোড করতে সমস্যা হয়েছে। নেটওয়ার্ক বা API চেক করুন।');
  }finally{
    // লোডিং শেষ
    wrap.classList.remove('loading');
    sel.disabled = false;
  }
}

// ===================== Save =====================
async function saveHisab(){
  const form = $('hisabForm');

  // Bootstrap validation
  if (!form.checkValidity()){
    form.classList.add('was-validated');
    setAlert('danger', 'প্রয়োজনীয় ফিল্ডগুলো পূরণ করুন।');
    return;
  }

  const dateRaw = $('date').value;
  const item = $('item').value;
  const price = $('price').value;
  const description = $('desc').value.trim();

  // তারিখ ফরম্যাট -> MM/DD/YYYY (আগের লজিক বজায়)
  const date = formatDateMDY(dateRaw);
  if(!date){
    form.classList.add('was-validated');
    setAlert('danger', 'ভ্যালিড তারিখ দিন।');
    return;
  }

  // সাবমিট ক্লিকের পর: সব ফিল্ড + সাবমিট বাটন ডিজেবল
  setFormDisabled(true);
  setAlert('info', 'Saving...');

  try{
    const res = await apiPost({ action:'addhisab', date, item, price, description });
    if(res.ok){
      clearForm();
      setAlert('success', 'Hisab saved ✔');
    }else{
      setAlert('danger', 'Failed: ' + (res.error || 'Unknown error'));
    }
  }catch(ex){
    setAlert('danger', 'Network error: ' + ex.message);
  }finally{
    // সেভ শেষ: সবকিছু রি-এনেবল
    setFormDisabled(false);
  }
}

// ===================== Init =====================
window.addEventListener('DOMContentLoaded', async ()=>{
  // আজকের তারিখ ডিফল্ট
  $('date').value = new Date().toISOString().slice(0,10);

  // ফর্ম সাবমিট হ্যান্ডলার
  $('hisabForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    await saveHisab();
  });

  // ক্লিয়ার বাটন
  $('btnClear').addEventListener('click', ()=>{
    clearForm();
    setAlert('secondary', 'Cleared');
  });

  // প্রাথমিক ড্রপডাউন লোড হওয়া পর্যন্ত ফুল-পেজ লোডার
  showLoader(true);
  await loadItems();
  showLoader(false);
});
