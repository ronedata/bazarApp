// Item Add only
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

const $ = (id)=>document.getElementById(id);
const msg = (t)=>{$('msg').textContent = t;};

async function addItem(){
  const item = $('newItem').value.trim();
  if(!item){ msg('Item name required'); return; }
  msg('Saving...');
  try{
    const res = await apiPost({action:'additem', item});
    if(res.ok){      
      $('newItem').value = '';
	  msg('Item added ✔');
      // try to refresh list if allowed
      try{
        const list = await apiGet({action:'items'});
        renderList(list.data||[]);
      }catch(_){}
    }else{
      msg('Failed: ' + (res.error||'Unknown error'));
    }
  }catch(ex){
    msg('Network error: ' + ex.message);
  }
}
function renderList(items){
  const ul = $('itemList');
  if(!ul) return;
  ul.innerHTML = '';
  items.forEach(x=>{
    const li = document.createElement('li');
    li.textContent = x;
    ul.appendChild(li);
  });
  $('listCard').hidden = items.length===0;
}

window.addEventListener('DOMContentLoaded', async ()=>{
  $('btnSubmit').addEventListener('click', addItem);
  $('btnClear').addEventListener('click', ()=>{$('newItem').value=''; msg('Cleared');});
  // load list initially (optional)
  try{
    const list = await apiGet({action:'items'});
    renderList(list.data||[]);
  }catch(_){ /* ignore if GET blocked */ }
});
