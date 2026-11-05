/* ClassCheck 2026 dashboard: real cached class/attendance state, no mock data. */
document.addEventListener('DOMContentLoaded',async()=>{
 const root=document.getElementById('dashboardContent');if(!root)return;
 let ctx;try{ctx=await AppBoot.ready();}catch(e){root.textContent=e.message||'Could not open dashboard.';return;}
 if(!App.isUnified())App.nav('dashboard');
 const esc=App.escapeHtml;
 const icon=(name)=>App.icon(name);
 const today=()=>App.fmtDate();
 const summary=row=>row?.session_status==='completed'||row?.status==='completed';
 let refreshInProgress=false;
 async function render(){
  if(refreshInProgress)return;refreshInProgress=true;
  try{
   const state=AppStorage.get();const date=today();const name=state.profile?.full_name?.trim()||'Teacher';
   const classes=(state.classes||[]).filter(c=>!c.archived);
   const students=(state.students||[]).filter(s=>!s.archived&&classes.some(c=>c.id===s.class_id));
   const allRows=await OfflineDB.all('attendance');
   const rows=allRows.filter(r=>r.teacher_id===ctx.user.id&&r.attendance_date===date&&students.some(s=>s.id===r.student_id));
   const allSessions=await OfflineDB.all('sessions');
   const sessions=allSessions.filter(s=>s.teacher_id===ctx.user.id&&s.attendance_date===date&&summary(s));
   const uniqueRows=[...new Map(rows.map(r=>[`${r.class_id}_${r.student_id}`,r])).values()];
   const counts={present:0,absent:0,late:0};uniqueRows.forEach(r=>{if(r.status in counts)counts[r.status]++;});
   const done=classes.filter(c=>sessions.some(s=>s.class_id===c.id));
   const totals=classes.map((c,i)=>({c,i,learners:students.filter(s=>s.class_id===c.id),saved:uniqueRows.filter(r=>r.class_id===c.id),finished:done.some(x=>x.id===c.id)}));
   const welcomeDate=App.longDate(date);
   root.innerHTML=`<div class="cc-dashboard">
    <header class="cc-dash-hero"><div><h1>Dashboard</h1><p>Good day, ${esc(name)}! Ready for today's class?</p></div><div class="cc-dash-date">${esc(welcomeDate)}</div></header>
    <section class="cc-kpis" aria-label="Today's attendance numbers">
      ${[
       ['users',classes.length,'Classes',''],['users',students.length,'Learners',''],
       ['check-circle',counts.present,'Present','success'],['user',counts.absent,'Absent','warning'],['calendar',counts.late,'Late','']
      ].map(([i,n,label,t])=>`<article class="cc-kpi"><span class="cc-kpi-icon ${t}">${icon(i)}</span><div><strong>${n}</strong><span>${label}</span></div></article>`).join('')}
    </section>
    <div class="cc-dash-grid">
      <section class="cc-maroon-panel"><div class="cc-panel-header"><h2>My Classes</h2><a href="#classes">Manage classes ${icon('chevron-right')}</a></div>
       ${totals.length?totals.map(({c,i,learners,saved,finished})=>`<a class="cc-dash-class" href="#attendance?class=${encodeURIComponent(c.id)}&date=${date}"><span class="cc-class-bubble">${esc((c.section_name||'CL').slice(0,2).toUpperCase())}</span><span class="cc-class-text"><b>${esc(c.grade_level)} – ${esc(c.section_name)}</b><small>${learners.length} learners · ${saved.length} marked today</small></span><span class="cc-finish-tag ${finished?'done':''}">${finished?'✓ Complete':saved.length?'In progress':'To do'}</span>${icon('chevron-right')}</a>`).join(''):`<div class="cc-empty-art"><img src="assets/empty-classes.png" alt="Books and classroom board"><b>No classes yet</b><p>Create a class or join an adviser’s shared class.</p><a class="btn primary" href="#classes">Open classes</a></div>`}
      </section>
      <section class="cc-maroon-panel"><div class="cc-panel-header"><h2>Quick Actions</h2></div>
       <div class="cc-quick-grid">
        <a class="cc-quick-tile" href="#attendance">${icon('clipboard-check')}<span>Mark Attendance<small>Record P, A or L</small></span></a>
        <a class="cc-quick-tile" href="#calendar">${icon('calendar')}<span>View Calendar<small>Attendance history</small></span></a>
        <a class="cc-quick-tile" href="#classes">${icon('users')}<span>Manage SF1<small>Open class → Upload SF1</small></span></a>
        <a class="cc-quick-tile" href="#reports">${icon('download')}<span>Export SF2<small>Monthly school form</small></span></a>
        <button class="cc-quick-tile" id="ccDashQrScanner" type="button">${icon('attendance')}<span>Scan QR<small>Check in learners</small></span></button>
        <button class="cc-quick-tile" id="ccDashQrCards" type="button">${icon('download')}<span>Student QR Cards<small>Prepare class cards</small></span></button>
       </div></section>
      <section class="cc-maroon-panel cc-dash-today"><div class="cc-panel-header"><h2>Today's Attendance</h2><a href="#attendance">Take attendance ${icon('chevron-right')}</a></div>
      ${totals.length?totals.map(({c,learners,saved,finished})=>`<div class="cc-attendance-line"><span class="cc-kpi-icon ${finished?'success':''}" style="width:35px;height:35px">${icon('clipboard-check')}</span><strong>${esc(c.grade_level)} – ${esc(c.section_name)}<small style="display:block;margin-top:3px">${saved.length} of ${learners.length} recorded</small></strong><span class="cc-today-chip ${finished?'done':''}">${finished?'✓ Completed':saved.length?'In progress':'Not started'}</span><a href="#attendance?class=${encodeURIComponent(c.id)}&date=${date}" aria-label="Open attendance for ${esc(c.section_name)}">${icon('chevron-right')}</a></div>`).join(''):`<div class="cc-empty-art"><img src="assets/empty-attendance.png" alt="Attendance checklist"><b>No attendance today</b><p>Add a class to start recording attendance.</p></div>`}
      </section>
      <section class="cc-maroon-panel"><div class="cc-panel-header"><h2>Progress & Reports</h2><a href="#reports">View reports ${icon('chevron-right')}</a></div>
        <div class="cc-attendance-line"><span class="cc-kpi-icon success">${icon('check-circle')}</span><strong>Completed registers</strong><b>${done.length} / ${classes.length}</b></div>
        <div class="cc-attendance-line"><span class="cc-kpi-icon">${icon('clipboard-check')}</span><strong>Explicitly saved marks</strong><b>${uniqueRows.length} / ${students.length}</b></div>
        <div class="cc-attendance-line"><span class="cc-kpi-icon warning">${icon('calendar')}</span><strong>Not yet marked</strong><b>${Math.max(0,students.length-uniqueRows.length)}</b></div>
        <p style="font-size:11px;color:#897b82;margin:12px 0 0">Statistics use marks saved on this device. A learner is not counted Present until that mark has been saved.</p>
      </section>
    </div>
    <div class="cc-dash-note">${icon('shield-check')}<span>Attendance saves to your device first. Pending changes upload automatically after reconnecting with a valid teacher session.</span><a href="#reports">View records</a></div>
    </div>`;
   root.querySelector('#ccDashQrScanner')?.addEventListener('click',()=>{App.showPanel('attendance');window.ClassCheckQR?.openScanner?.();});
   root.querySelector('#ccDashQrCards')?.addEventListener('click',()=>window.ClassCheckQR?.openCards?.());
  }catch(error){console.error('Dashboard unavailable',error);root.textContent='Cannot read device attendance records. Please reconnect without clearing your browser data.';}
  finally{refreshInProgress=false;}
 }
 // Keep legacy live sync elements functioning, alongside the newer header indicator.
 let lastState='';
 async function updateSync(){
  const title=document.getElementById('dashSyncText'),hint=document.getElementById('dashSyncHint'),retry=document.getElementById('dashSyncRetry');
  if(!title)return;
  try{
   const pending=(await OfflineDB.all('syncQueue')).filter(x=>x.payload?.teacher_id===ctx.user.id).length;
   const storageError=SyncManagerApp.storageError();
   title.textContent=storageError?'Device storage error':!navigator.onLine?`Offline · ${pending} pending`:
    lastState==='syncing'?`Syncing ${pending} changes`:pending?`${pending} changes saved locally`:'All attendance synced';
   if(hint)hint.textContent=storageError?'Do not clear site data; check device storage.':'Your saved attendance remains available on this device.';
   if(retry){retry.hidden=!pending||!navigator.onLine;retry.onclick=()=>SyncManagerApp.flush();}
  }catch(e){console.warn(e);}
 }
 SyncManagerApp.onState(event=>{lastState=event.type;updateSync();render();});
 document.addEventListener('classcheck:panelchange',event=>{if(event.detail.panel==='dashboard')render();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
 window.addEventListener('focus',render);
 await render();await updateSync();
});
