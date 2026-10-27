(function(){
  let timer=null;let syncing=false;const listeners=[];
  let lastStorageError=null;
  function requireStorage(){
    if(!window.OfflineDB || ['saveQueued','acknowledge','all','attendanceFor','get','put'].some(name=>typeof OfflineDB[name]!=='function')){
      throw new Error('ClassCheck offline storage needs an update. Reopen ClassCheck while connected; do not clear device data.');
    }
  }
  function storageError(){return lastStorageError;}
  function reportStorageError(error){
    lastStorageError=error?.message||String(error);
    emit({type:'storage-error',message:lastStorageError});
  }
  function emit(state){listeners.forEach(fn=>fn(state));}
  function onState(fn){listeners.push(fn);}
  function revisionId(){return globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;}
  async function queueAttendance(record){
    const op={id:`attendance_${record.teacher_id}_${record.class_id}_${record.student_id}_${record.attendance_date}`,type:'attendance_upsert',payload:record,status:'pending',revision:revisionId(),updated_at:new Date().toISOString()};
    await persist('attendance',record,op);
  }
  async function queueSession(session){
    const op={id:`session_${session.teacher_id}_${session.class_id}_${session.attendance_date}`,type:'session_upsert',payload:session,status:'pending',revision:revisionId(),updated_at:new Date().toISOString()};
    await persist('sessions',session,op);
  }
  async function persist(store,record,op){
    try{
      requireStorage();
      // Both the attendance row and its pending upload are written in ONE
      // IndexedDB transaction. Never mark a row as saved before commit.
      await OfflineDB.saveQueued(store,record,op);
      lastStorageError=null;
      emit({type:'saved-local'});
      schedule();
    }catch(error){reportStorageError(error);throw error;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>flush().catch(console.error),1200);}
  function attendanceRow(r){return {teacher_id:r.teacher_id,class_id:r.class_id,student_id:r.student_id,attendance_date:r.attendance_date,status:r.status,note:r.note||null,subject:r.subject||'Advisory',client_updated_at:r.client_updated_at||new Date().toISOString()};}
  function sessionRow(s){return {teacher_id:s.teacher_id,class_id:s.class_id,attendance_date:s.attendance_date,session_status:s.session_status||'completed',notes:s.notes||null,subject:s.subject||'Advisory',client_updated_at:s.client_updated_at||new Date().toISOString()};}
  async function flush(){
    if(syncing)return;
    try{requireStorage();}catch(error){reportStorageError(error);return;}
    if(lastStorageError){emit({type:'storage-error',message:lastStorageError});return;}
    const uid=window.AppBoot?.getContext()?.user?.id;
    if(!uid)return;
    syncing=true;
    try {
    const pending=(await OfflineDB.all('syncQueue')).filter(x=>x.status==='pending'&&x.payload?.teacher_id===uid);
    if(!pending.length){emit({type:'synced',count:0});return;}
    if(!navigator.onLine){emit({type:'offline',count:pending.length});return;}
    if(APP_CONFIG.DEMO_MODE){emit({type:'demo',count:pending.length});return;}
    emit({type:'syncing',count:pending.length});
    try{
      const session=await Supa.getSession();
      if(!session||session.user.id!==uid)throw new Error('Sign in to sync this account.');
      const supa=Supa.getClient();
      const attendanceOps=pending.filter(x=>x.type==='attendance_upsert');
      const sessionOps=pending.filter(x=>x.type==='session_upsert');
      if(attendanceOps.length||sessionOps.length){
        const records=attendanceOps.map(x=>{const r=attendanceRow(x.payload);delete r.teacher_id;return r;});
        const sessions=sessionOps.map(x=>{const s=sessionRow(x.payload);delete s.teacher_id;return s;});
        const controller=new AbortController();
        let timeout;
        try{
          let request=supa.rpc('classcheck_sync_attendance',{p_records:records,p_sessions:sessions});
          if(typeof request.abortSignal==='function')request=request.abortSignal(controller.signal);
          const {error}=await Promise.race([
            request,
            new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(new Error('Sync timed out. Your device records are safe and will retry.'));},9000);})
          ]);
          if(error)throw error;
        }finally{clearTimeout(timeout);}

        for(const item of [...attendanceOps,...sessionOps])await OfflineDB.acknowledge(item);
      }
      const remaining=(await OfflineDB.all('syncQueue')).filter(x=>x.payload?.teacher_id===uid).length;
      emit({type:remaining?'saved-local':'synced',count:remaining});
      if(remaining)schedule();
    }catch(err){console.error('ClassCheck sync failed',err);emit({type:'failed',count:pending.length});}
    } finally{syncing=false;}
  }
  // No user action is required: catch pending work when the app first opens,
  // when the device reconnects, and whenever the teacher returns to the tab.
  // A periodic retry also handles unreliable networks that never fire 'online'.
  function syncInBackground(){flush().catch(err=>console.warn('Automatic attendance sync unavailable',err));}
  setInterval(()=>{if(navigator.onLine)syncInBackground();},30000);
  document.addEventListener('DOMContentLoaded',()=>{
    try{requireStorage();}catch(error){reportStorageError(error);}
    if(window.AppBoot?.ready)AppBoot.ready().then(syncInBackground).catch(()=>{});
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncInBackground();});
  window.addEventListener('pageshow',syncInBackground);
  window.addEventListener('focus',syncInBackground);
  window.addEventListener('online',syncInBackground);
  window.addEventListener('offline',async()=>{
    try{
      const uid=window.AppBoot?.getContext()?.user?.id;
      const items=await OfflineDB.all('syncQueue');
      emit({type:'offline',count:items.filter(x=>!uid||x.payload?.teacher_id===uid).length});
    }catch(err){console.warn('Cannot read offline sync queue',err);}
  });
  window.SyncManagerApp={queueAttendance,queueSession,flush,onState,storageError};
})();
