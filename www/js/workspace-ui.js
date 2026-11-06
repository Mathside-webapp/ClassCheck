/* ClassCheck v18 — live status header. This UI never claims 'synced' until the local queue is empty. */
(()=>{
 if(!document.body?.classList?.contains('classcheck-app'))return;
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const header=document.createElement('header');header.className='ccx-topbar';
 header.innerHTML=`<div class="ccx-topbar-left"><button type="button" id="ccxMenu" class="ccx-menu-btn" aria-label="Open navigation" aria-expanded="false">☰</button><div class="ccx-topbar-heading"><small>CLASSCHECK <span>/</span> <b class="ccx-crumb-name">OVERVIEW</b></small><strong class="ccx-page-title">Dashboard</strong></div></div>
  <div class="ccx-topbar-right"><span class="ccx-today-chip" id="ccxToday"></span><button id="ccxSyncTrigger" type="button" class="ccx-sync-pill" data-status="checking" aria-expanded="false" aria-controls="ccxSyncPopover"><span class="ccx-sync-led"></span><span><b id="ccxSyncText">Checking device</b><small id="ccxSyncHint">Loading local data</small></span></button><a href="#profile" class="ccx-account-link"><span class="ccx-account-initial">T</span><span><b class="ccx-account-name">Teacher</b><small>My profile</small></span></a></div>`;
 const pop=document.createElement('section');pop.className='ccx-sync-popover';pop.id='ccxSyncPopover';pop.hidden=true;pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Synchronization details');
 pop.innerHTML=`<h3>Offline & synchronization</h3><p id="ccxSyncNetwork"></p><p id="ccxSyncCount"></p><p id="ccxSyncLast"></p><p id="ccxSyncProblem" role="status"></p><div class="ccx-sync-popover-actions"><a href="#sync" class="ccx-small-secondary">Open details</a><button type="button" id="ccxRetrySync" class="ccx-small-primary">Retry sync</button></div>`;
 document.body.append(header,pop);
 const el=id=>document.getElementById(id),trigger=el('ccxSyncTrigger');
 el('ccxToday').textContent=new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
 el('ccxMenu').addEventListener('click',()=>{const opened=document.body.classList.toggle('ccx-nav-open');el('ccxMenu').setAttribute('aria-expanded',String(opened));});
 let uid=null,lastEvent='',lastError='';
 async function update(){
  let pending=0,storageError='';
  try{const all=await OfflineDB.all('syncQueue');pending=all.filter(x=>uid&&x.payload?.teacher_id===uid).length;}catch(e){storageError=e.message||'Cannot read saved changes';}
  storageError=storageError||window.SyncManagerApp?.storageError?.()||'';
  const status=storageError?'error':!navigator.onLine?'offline':pending?(lastEvent==='syncing'?'syncing':lastEvent==='failed'?'error':'saved'):'synced';
  const states={error:['Sync needs attention','Changes remain on device'],offline:['Offline','Using saved records'],syncing:['Syncing…',`${pending} waiting`],saved:['Saved on device',`${pending} to synchronize`],synced:['Synced','0 pending changes']};
  trigger.dataset.status=status;el('ccxSyncText').textContent=states[status][0];el('ccxSyncHint').textContent=states[status][1];
  el('ccxSyncNetwork').textContent=`Connection: ${navigator.onLine?'Browser reports online':'Offline'}`;
  el('ccxSyncCount').textContent=`Pending changes for this account: ${pending}`;
  let last='';try{last=uid&&localStorage.getItem('cc_last_sync_'+uid);}catch{}
  el('ccxSyncLast').textContent=`Last successful sync: ${last?new Date(last).toLocaleString():'Not yet confirmed on this device'}`;
  el('ccxSyncProblem').textContent=storageError||lastEvent==='failed'&&lastError||'';
  document.dispatchEvent(new CustomEvent('classcheck:sync-ui',{detail:{status,pending,storageError}}));
 }
 window.ClassCheckSyncUI={refresh:update};
 trigger.addEventListener('click',()=>{pop.hidden=!pop.hidden;trigger.setAttribute('aria-expanded',String(!pop.hidden));if(!pop.hidden)update();});
 el('ccxRetrySync').addEventListener('click',()=>{if(!navigator.onLine){el('ccxSyncProblem').textContent='Reconnect to synchronize changes.';return;}window.SyncManagerApp?.flush?.().catch(e=>{el('ccxSyncProblem').textContent=e.message;});});
 pop.querySelector('a').addEventListener('click',()=>{pop.hidden=true;trigger.setAttribute('aria-expanded','false');});
 document.addEventListener('click',e=>{if(!pop.hidden&&!pop.contains(e.target)&&!trigger.contains(e.target)){pop.hidden=true;trigger.setAttribute('aria-expanded','false');}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){pop.hidden=true;trigger.setAttribute('aria-expanded','false');}});
 window.SyncManagerApp?.onState?.(e=>{lastEvent=e.type;if(e.message)lastError=e.message;if(e.type==='synced'&&uid)try{localStorage.setItem('cc_last_sync_'+uid,new Date().toISOString());}catch{}update();});
 ['online','offline','focus'].forEach(ev=>window.addEventListener(ev,update));
 document.addEventListener('classcheck:panelchange',e=>{pop.hidden=true;trigger.setAttribute('aria-expanded','false');update();document.body.classList.remove('ccx-nav-open');el('ccxMenu').setAttribute('aria-expanded','false');});
 document.addEventListener('DOMContentLoaded',async()=>{try{const ctx=await AppBoot.ready();uid=ctx.user.id;const name=(AppStorage.get().profile?.full_name||ctx.user.email||'Teacher').trim();el('ccxToday').textContent=new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});document.querySelectorAll('.ccx-account-name').forEach(x=>x.textContent=name);document.querySelectorAll('.ccx-account-initial').forEach(x=>x.textContent=(name[0]||'T').toUpperCase());}catch(e){console.warn('Could not load account label',e);}await update();});
})();
