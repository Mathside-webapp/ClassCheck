/* Compact maroon shared header / accurate account-scoped synchronization indicator. */
(()=>{
 const app=document.body?.classList?.contains('classcheck-app');if(!app)return;
 let userId=null,sessionReady=false;
 const safe=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const top=document.createElement('header');top.className='cc-workspace-top';top.innerHTML=`
  <button type="button" class="cc-workspace-menu" aria-label="Go to my classes">☰</button>
  <div class="cc-top-title"><img class="cc-top-logo" src="assets/classcheck-logo-icon.png" alt=""><div><strong>ClassCheck</strong><small>Teacher Attendance Workspace</small></div></div>
  <button class="cc-sync-button" type="button" aria-haspopup="dialog" aria-controls="ccSyncDetail" data-status="checking"><span class="cc-sync-symbol">◌</span><span><b id="ccStatusText">Checking device...</b><small id="ccStatusHint">Inspecting saved records</small></span></button>
  <a class="cc-top-account" href="#profile"><span class="cc-top-avatar" id="ccAccountAvatar">T</span><span><b id="ccAccountName">Teacher</b><small>My profile</small></span></a>`;
 const pop=document.createElement('section');pop.id='ccSyncDetail';pop.className='cc-sync-detail';pop.hidden=true;pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Synchronization details');pop.innerHTML=`<h3>Attendance synchronization</h3><p id="ccSyncConnection"></p><p id="ccSyncPending"></p><p id="ccSyncLast"></p><p id="ccSyncError"></p><div class="cc-sync-actions"><button type="button" class="cc-close">Close</button><button type="button" class="cc-retry">Retry sync</button></div>`;
 document.body.append(top,pop);
 const trigger=top.querySelector('.cc-sync-button'),statusText=top.querySelector('#ccStatusText'),statusHint=top.querySelector('#ccStatusHint');
 let lastStatus='',lastError='';
 async function updateStatus(){
  let pending=0,readable=true;
  try{pending=(await OfflineDB.all('syncQueue')).filter(x=>x.payload?.teacher_id===userId).length;}catch(e){readable=false;lastError=e.message;}
  const storageError=window.SyncManagerApp?.storageError?.();
  const status=!readable||storageError?'storage-error':!navigator.onLine?'offline':pending?(lastStatus==='syncing'?'syncing':lastStatus==='failed'?'failed':'saved-local'):'synced';
  trigger.dataset.status=status;
  const labels={'storage-error':'Storage error',offline:'Offline — saved locally',syncing:'Syncing...',failed:'Sync error','saved-local':'Saved on device',synced:'Synced'};
  statusText.textContent=labels[status];statusHint.textContent=`${pending} pending change${pending===1?'':'s'}`;
  trigger.querySelector('.cc-sync-symbol').textContent=status==='synced'?'✓':status==='syncing'?'↻':status==='storage-error'||status==='failed'?'!':'↓';
  pop.querySelector('#ccSyncConnection').textContent=`Connection: ${navigator.onLine?'Browser reports online':'Offline'}`;
  pop.querySelector('#ccSyncPending').textContent=`Pending uploads for this teacher: ${pending}`;
  const stamp=localStorage.getItem('cc_last_sync_'+userId);
  pop.querySelector('#ccSyncLast').textContent=`Last confirmed sync: ${stamp?new Date(stamp).toLocaleString():'Not yet recorded on this device'}`;
  pop.querySelector('#ccSyncError').textContent=storageError||lastError||((status==='failed')?'Sync failed; your local changes remain queued.':'');
 }
 trigger.addEventListener('click',()=>{pop.hidden=!pop.hidden;if(!pop.hidden)updateStatus();});
 pop.querySelector('.cc-close').addEventListener('click',()=>{pop.hidden=true;trigger.focus();});
 pop.querySelector('.cc-retry').addEventListener('click',()=>{if(!navigator.onLine){pop.querySelector('#ccSyncError').textContent='Connect to the internet to synchronize.';return;}window.SyncManagerApp?.flush?.();});
 document.addEventListener('click',e=>{if(!pop.hidden&&!pop.contains(e.target)&&!trigger.contains(e.target))pop.hidden=true;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')pop.hidden=true;});
 top.querySelector('.cc-workspace-menu').addEventListener('click',()=>App.navigate('#classes'));
 window.SyncManagerApp?.onState?.(ev=>{lastStatus=ev.type;if(ev.message)lastError=ev.message;if(ev.type==='synced'&&userId)localStorage.setItem('cc_last_sync_'+userId,new Date().toISOString());updateStatus();});
 window.addEventListener('online',updateStatus);window.addEventListener('offline',updateStatus);window.addEventListener('focus',updateStatus);
 document.addEventListener('classcheck:panelchange',()=>{pop.hidden=true;updateStatus();});
 document.addEventListener('DOMContentLoaded',async()=>{
  try{const ctx=await AppBoot.ready();userId=ctx.user.id;sessionReady=true;const state=AppStorage.get();const name=state.profile?.full_name?.trim()||ctx.user.email||'Teacher';top.querySelector('#ccAccountName').textContent=name;top.querySelector('#ccAccountAvatar').textContent=(name[0]||'T').toUpperCase();}
  catch(e){console.warn('Account header is not ready',e);}updateStatus();
 });
})();
