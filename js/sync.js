(function(){
  let timer=null;let syncing=false;const listeners=[];
  function emit(state){listeners.forEach(fn=>fn(state));}
  function onState(fn){listeners.push(fn);}
  async function queueAttendance(record){
    const op={id:`attendance_${record.teacher_id}_${record.class_id}_${record.student_id}_${record.attendance_date}`,type:'attendance_upsert',payload:record,status:'pending',updated_at:new Date().toISOString()};
    await OfflineDB.put('syncQueue',op);emit({type:'saved-local'});schedule();
  }
  async function queueSession(session){
    const op={id:`session_${session.teacher_id}_${session.class_id}_${session.attendance_date}`,type:'session_upsert',payload:session,status:'pending',updated_at:new Date().toISOString()};
    await OfflineDB.put('syncQueue',op);emit({type:'saved-local'});schedule();
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(flush,1200);}
  function attendanceRow(r){return {teacher_id:r.teacher_id,class_id:r.class_id,student_id:r.student_id,attendance_date:r.attendance_date,status:r.status,note:r.note||null,subject:r.subject||'Advisory',client_updated_at:r.client_updated_at||new Date().toISOString()};}
  function sessionRow(s){return {teacher_id:s.teacher_id,class_id:s.class_id,attendance_date:s.attendance_date,session_status:s.session_status||'completed',notes:s.notes||null,subject:s.subject||'Advisory',client_updated_at:s.client_updated_at||new Date().toISOString()};}
  async function flush(){
    if(syncing)return;
    const pending=(await OfflineDB.all('syncQueue')).filter(x=>x.status==='pending');
    if(!pending.length){emit({type:'synced',count:0});return;}
    if(!navigator.onLine){emit({type:'offline',count:pending.length});return;}
    if(APP_CONFIG.DEMO_MODE){emit({type:'demo',count:pending.length});return;}
    syncing=true;emit({type:'syncing',count:pending.length});
    try{
      const supa=Supa.getClient();
      const attendanceOps=pending.filter(x=>x.type==='attendance_upsert');
      const sessionOps=pending.filter(x=>x.type==='session_upsert');
      if(attendanceOps.length){
        const {error}=await supa.from('classcheck_attendance_records').upsert(attendanceOps.map(x=>attendanceRow(x.payload)),{onConflict:'class_id,teacher_id,student_id,attendance_date'});
        if(error)throw error;
        for(const item of attendanceOps)await OfflineDB.remove('syncQueue',item.id);
      }
      if(sessionOps.length){
        const {error}=await supa.from('classcheck_attendance_sessions').upsert(sessionOps.map(x=>sessionRow(x.payload)),{onConflict:'class_id,teacher_id,attendance_date'});
        if(error)throw error;
        for(const item of sessionOps)await OfflineDB.remove('syncQueue',item.id);
      }
      emit({type:'synced',count:0});
    }catch(err){console.error('ClassCheck sync failed',err);emit({type:'failed',count:pending.length});}
    finally{syncing=false;}
  }
  window.addEventListener('online',flush);
  window.addEventListener('offline',async()=>emit({type:'offline',count:(await OfflineDB.all('syncQueue')).length}));
  window.SyncManagerApp={queueAttendance,queueSession,flush,onState};
})();
