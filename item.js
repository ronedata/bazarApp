// ===== Existing API helpers (kept intact) =====
async function apiGet(params){
  const url = WEB_APP_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, {method:'GET'});
  return r.json();
}
async function apiPost(payload){
  const r = await fetch(WEB_APP_URL, {
    method:'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(payload) // action=additem&item=Rice
  });
  return r.json();
}

// ===== Existing shortcuts (kept) =====
const $ = (id)=>document.getElementById(id);
const msg = (t)=>{$('msg').textContent = t;};

// ===== NEW: UI helpers for state/validation/alerts =====
function setSavingState(isSaving){
  const submitBtn = $('btnSubmit');
  const input = $('newItem');
  if(submitBtn){
    submitBtn.disabled = isSaving;
    const spinner = submitBtn.querySelector('.btn-spinner');
    const text = submitBtn.querySelector('.btn-text');
    if(spinner) spinner.classList.toggle('d-none', !isSaving);
    if(text) text.textContent = isSaving ? 'Saving…' : 'Submit';
  }
  if(input){
    input.disabled = isSaving;
  }
}
function showAlert(el, show){
  if(!el) return;
  el.classList.toggle('d-none', !show);
  if(show){
    // auto-hide for a nicer UX
    setTimeout(()=> el.classList.add('d-none'), 2500);
  }
}
function validateForm(){
  const form = $('itemForm');
  if(!form) return false;
  if(!form.checkValidity()){
    form.classList.add('was-validated');
    return false;
  }
  return true;
}

// ===== Existing renderList with small improvements =====
function renderList(items){
  const ul = $('itemList');
  const loading = $('listLoading');
  const empty = $('listEmpty');
  if(!ul) return;

  // hide loader
  if(loading) loading.classList.add('d-none');

  ul.innerHTML = '';
  if(Array.isArray(items) && items.length){
    items.forEach(x=>{
      const li = document.createElement('li');
      li.className = 'py-2 border-bottom';
      li.textContent = x;
      ul.appendChild(li);
    });
    ul.classList.remove('d-none');
    empty && empty.classList.add('d-none');
  }else{
    ul.classList.add('d-none');
    empty && empty.classList.remove('d-none');
  }

  // ensure card visible once we attempted to load
  const card = $('listCard');
  if(card) card.hidden = false;
}

// ===== Existing addItem with required behaviors added =====
async function addItem(){
  // Bootstrap validation
  if(!validateForm()) return;

  const item = $('newItem').value.trim();
  if(!item){ 
    // keep original message behavior too
    msg('Item name required'); 
    return; 
  }

  // UX messaging
  msg('Saving…');
  showAlert($('alertError'), false);
  showAlert($('alertSuccess'), false);

  try{
    setSavingState(true);
    const res = await apiPost({action:'additem', item});
    if(res.ok){
      $('newItem').value = '';
      // reset validation state
      const form = $('itemForm');
      if(form) form.classList.remove('was-validated');

      msg('Item added ✔');
      showAlert($('alertSuccess'), true);

      // refresh list (shows loader first)
      await refreshList();
    }else{
      msg('Failed: ' + (res.error||'Unknown error'));
      showAlert($('alertError'), true);
    }
  }catch(ex){
    msg('Network error: ' + ex.message);
    showAlert($('alertError'), true);
  }finally{
    setSavingState(false);
  }
}

// ===== Small helper to load list with loader =====
async function refreshList(){
  const loading = $('listLoading');
  const ul = $('itemList');
  const empty = $('listEmpty');
  if(loading) loading.classList.remove('d-none');
  ul && ul.classList.add('d-none');
  empty && empty.classList.add('d-none');

  try{
    const list = await apiGet({action:'items'});
    renderList(list.data||[]);
  }catch(_){
    // on error, just show empty state
    renderList([]);
  }
}

// ===== Boot =====
window.addEventListener('DOMContentLoaded', async ()=>{
  // bind buttons (kept ids)
  $('btnSubmit').addEventListener('click', (e)=>{
    // ensure form submit path for HTML5 validation
    e.preventDefault();
    addItem();
  });
  $('btnClear').addEventListener('click', ()=>{
    $('newItem').value='';
    msg('Cleared');
    const form = $('itemForm');
    if(form) form.classList.remove('was-validated');
  });
  const btnRefresh = $('btnRefresh');
  if(btnRefresh){
    btnRefresh.addEventListener('click', (e)=>{
      e.preventDefault();
      refreshList();
    });
  }

  // Initial load: show loader until list is ready
  await refreshList();
});
