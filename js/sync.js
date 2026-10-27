(function(){
  let timer=null;let syncing=false;const listeners=[];
  function emit(state){listeners.forEach(fn=>fn(state));}
  function onState(fn){listeners.push(fn);}
  function revisionId(){return globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;}
  async function queueAttendance(record){
    const op={id:`attendance_${record.teacher_id}_${record.class_id}_${record.student_id}_${record.attendance_date}`,type:'attendance_upsert',payload:record,status:'pending',revision:revisionId(),updated_at:new Date().toISOString()};
    await OfflineDB.saveQueued('attendance',record,op);emit({type:'saved-local'});schedule();
  }
  async function queueSession(session){
    const op={id:`session_${session.teacher_id}_${session.class_id}_${session.attendance_date}`,type:'session_upsert',payload:session,status:'pending',revision:revisionId(),updated_at:new Date().toISOString()};
    await OfflineDB.saveQueued('sessions',session,op);emit({type:'saved-local'});schedule();
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>flush().catch(console.error),1200);}
  function attendanceRow(r){return {teacher_id:r.teacher_id,class_id:r.class_id,student_id:r.student_id,attendance_date:r.attendance_date,status:r.status,note:r.note||null,subject:r.subject||'Advisory',client_updated_at:r.client_updated_at||new Date().toISOString()};}
  function sessionRow(s){return {teacher_id:s.teacher_id,class_id:s.class_id,attendance_date:s.attendance_date,session_status:s.session_status||'completed',notes:s.notes||null,subject:s.subject||'Advisory',client_updated_at:s.client_updated_at||new Date().toISOString()};}
  async function flush(){
    if(syncing)return;
    const uid=window.AppBoot?.getContext()?.user?.id;
    if(!uid)return;
    syncing=true;
    try {
    const pending=(await OfflineDB.all('syncQueue')).filter(x=>x.status==='pending'&&x.payload.teacher_id===uid);
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
      const remaining=(await OfflineDB.all('syncQueue')).filter(x=>x.payload.teacher_id===uid).length;
      emit({type:remaining?'saved-local':'synced',count:remaining});
      if(remaining)schedule();
    }catch(err){console.error('ClassCheck sync failed',err);emit({type:'failed',count:pending.length});}
    } finally{syncing=false;}
  }
  setInterval(()=>{if(navigator.onLine)flush().catch(console.error);},30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)flush().catch(console.error);});
  window.addEventListener('online',()=>flush().catch(console.error));
  window.addEventListener('offline',async()=>emit({type:'offline',count:(await OfflineDB.all('syncQueue')).length}));
  window.SyncManagerApp={queueAttendance,queueSession,flush,onState};
})();
