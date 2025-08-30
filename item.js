// ===== Existing API helpers (unchanged) =====
async function apiGet(params){
  const url = WEB_APP_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, {method:'GET'});
  return r.json();
}
async function apiPost(payload){
  const r = await fetch(WEB_APP_URL, {
    method:'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(payload)
  });
  return r.json();
}

// ===== Shortcuts (unchanged) =====
const $ = (id)=>document.getElementById(id);
const msg = (t)=>{$('msg').textContent = t;};

// ===== Alerts/validation helpers (unchanged) =====
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
  if(input){ input.disabled = isSaving; }
}
function showAlert(el, show){
  if(!el) return;
  el.classList.toggle('d-none', !show);
  if(show){ setTimeout(()=> el.classList.add('d-none'), 2500); }
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

// ===== Current Items: beautiful render =====
function renderList(items){
  const ul = $('itemList');
  const loading = $('listLoading');
  const empty = $('listEmpty');
  if(!ul) return;

  if(loading) loading.classList.add('d-none');
  ul.innerHTML = '';

  if(Array.isArray(items) && items.length){
    items.forEach(x=>{
      const li = document.createElement('li');
      // নতুন স্টাইল: ছোট কার্ডের মতো
      li.className = 'item-row';

      // নাম
      const name = document.createElement('div');
      name.className = 'item-name';
      name.textContent = x;

      // actions (ডান পাশে)
      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-danger btn-delete';
      btn.innerHTML = '<i class="bi bi-trash me-1" aria-hidden="true"></i>Delete';
      btn.setAttribute('data-item', x);

      actions.appendChild(btn);
      li.appendChild(name);
      li.appendChild(actions);
      ul.appendChild(li);
    });

    ul.classList.remove('d-none');
    empty && empty.classList.add('d-none');
  }else{
    ul.classList.add('d-none');
    empty && empty.classList.remove('d-none');
  }

  const card = $('listCard');
  if(card) card.hidden = false;
}

// ===== addItem (unchanged logic) =====
async function addItem(){
  if(!validateForm()) return;

  const item = $('newItem').value.trim();
  if(!item){ msg('Item name required'); return; }

  msg('Saving…');
  showAlert($('alertError'), false);
  showAlert($('alertSuccess'), false);

  try{
    setSavingState(true);
    const res = await apiPost({action:'additem', item});
    if(res.ok){
      $('newItem').value='';
      const form = $('itemForm'); if(form) form.classList.remove('was-validated');
      msg('Item added ✔'); showAlert($('alertSuccess'), true);
      await refreshList();
    }else{
      msg('Failed: ' + (res.error||'Unknown error')); showAlert($('alertError'), true);
    }
  }catch(ex){
    msg('Network error: ' + ex.message); showAlert($('alertError'), true);
  }finally{ setSavingState(false); }
}

// ===== Delete flow with Bootstrap modal (unchanged) =====
let __pendingDeleteItem = null;
let __confirmModal = null;

function openDeleteConfirm(item){
  __pendingDeleteItem = item;
  const nameSpan = $('confirmItemName');
  if(nameSpan){ nameSpan.textContent = `"${item}"`; }
  if(__confirmModal){ __confirmModal.show(); }
}

async function deleteItem(item){
  if(!item) return;
  openDeleteConfirm(item);
}

async function performDelete(){
  const item = __pendingDeleteItem;
  if(!item) return;

  msg('Deleting…');
  showAlert($('alertError'), false);
  showAlert($('alertSuccess'), false);

  try{
    const res = await apiPost({action:'deleteitem', item});
    if(res.ok){
      msg('Item deleted ✔'); showAlert($('alertSuccess'), true);
      await refreshList();
    }else{
      msg('Failed: ' + (res.error||'Unknown error')); showAlert($('alertError'), true);
    }
  }catch(ex){
    msg('Network error: ' + ex.message); showAlert($('alertError'), true);
  }finally{
    __pendingDeleteItem = null;
  }
}

// ===== Refresh (unchanged) =====
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
  }catch{
    renderList([]);
  }
}

// ===== Boot (unchanged ids & bindings) =====
window.addEventListener('DOMContentLoaded', async ()=>{
  const modalEl = $('confirmDeleteModal');
  if (modalEl && window.bootstrap && bootstrap.Modal){
    __confirmModal = new bootstrap.Modal(modalEl);
  }
  const confirmBtn = $('confirmDeleteBtn');
  if(confirmBtn){
    confirmBtn.addEventListener('click', async ()=>{
      confirmBtn.disabled = true;
      try{ await performDelete(); }
      finally{ confirmBtn.disabled = false; __confirmModal && __confirmModal.hide(); }
    });
  }

  $('btnSubmit').addEventListener('click', (e)=>{ e.preventDefault(); addItem(); });
  $('btnClear').addEventListener('click', ()=>{ $('newItem').value=''; msg('Cleared'); $('itemForm')?.classList.remove('was-validated'); });
  $('btnRefresh')?.addEventListener('click', (e)=>{ e.preventDefault(); refreshList(); });

  const ul = $('itemList');
  if(ul){
    ul.addEventListener('click', (e)=>{
      const btn = e.target.closest('.btn-delete');
      if(btn){ e.preventDefault(); deleteItem(btn.getAttribute('data-item')); }
    });
  }

  await refreshList();
});
