document.addEventListener('DOMContentLoaded',async()=>{
  const root=document.getElementById('dashboardContent');if(!root)return;
  let ctx;try{ctx=await AppBoot.ready();}catch(e){root.textContent=e.message;return;}
  const esc=App.escapeHtml;
  async function render(){
    const state=AppStorage.get(),today=App.fmtDate();
    const classes=state.classes.filter(c=>!c.archived);
    const learners=state.students.filter(s=>!s.archived&&classes.some(c=>c.id===s.class_id));
    const rows=(await OfflineDB.all('attendance')).filter(r=>r.teacher_id===ctx.user.id&&r.attendance_date===today&&learners.some(s=>s.id===r.student_id));
    const counts={present:0,absent:0,late:0};rows.forEach(r=>{if(r.status in counts)counts[r.status]++;});
    const marked=rows.length,rate=learners.length?Math.round(marked/learners.length*100):0;
    counts.present=Math.max(0,learners.length-counts.absent-counts.late);
    const sessions=(await OfflineDB.all('sessions')).filter(s=>s.teacher_id===ctx.user.id&&s.attendance_date===today&&s.session_status==='completed');
    const completed=classes.filter(c=>sessions.some(s=>s.class_id===c.id)).length;
    root.innerHTML=`<header class="qb-page-heading"><div><h1>Dashboard</h1><p>${esc(App.longDate(today))}</p></div><a class="dash-profile" href="#profile" aria-label="Open profile">${esc((state.profile.full_name||'T')[0])}</a></header>
    <section class="qb-register" aria-labelledby="todayClasses"><div class="qb-section-heading"><h2 id="todayClasses">Today’s classes</h2><a href="#classes">Manage classes</a></div>
    <div class="qb-table-head" aria-hidden="true"><span>Class</span><span>Learners</span><span>Register</span><span></span></div>
    ${classes.length?classes.map((c,index)=>{const total=learners.filter(s=>s.class_id===c.id).length,done=rows.filter(r=>r.class_id===c.id).length,complete=sessions.some(s=>s.class_id===c.id);return `<div class="qb-class-row"><div><h3>${esc(c.grade_level)} ${esc(c.section_name)}</h3><span class="qb-mobile-count">${total} learners</span></div><span class="qb-learner-count">${total}</span><span class="qb-register-status ${complete?'is-complete':''}">${complete?'Complete':done?'In progress':'Not started'}</span><a class="btn ${!complete&&index===0?'primary':'ghost'}" href="#attendance?class=${encodeURIComponent(c.id)}&date=${today}" aria-label="${complete?'View':'Take'} attendance for ${esc(c.section_name)}"><span class="qb-action-label">${complete?'View attendance':'Take attendance'}</span><span class="qb-mobile-arrow">${App.icon('chevron-right')}</span></a></div>`;}).join(''):'<div class="qb-empty"><h3>Your first class starts here</h3><p>Create or join a class to begin recording attendance.</p><a class="btn primary" href="#classes">Go to classes</a></div>'}
    <a class="btn primary qb-mobile-primary" href="#attendance">Take attendance</a><p class="qb-register-footer">${completed} of ${classes.length} class registers completed today.</p></section>
    <details class="qb-overview"><summary>Today’s attendance overview <span>${marked} of ${learners.length} learners saved</span></summary><dl><div><dt>Learners</dt><dd>${learners.length}</dd></div><div><dt>Present by default</dt><dd>${counts.present}</dd></div><div><dt>Absent</dt><dd>${counts.absent}</dd></div><div><dt>Late</dt><dd>${counts.late}</dd></div></dl><p>Present until marked absent or late. Overview uses records saved on this device.</p><a href="#reports">View attendance reports</a></details>
    <section class="qb-tools" aria-label="Quick tools"><button class="btn ghost" type="button" id="dashScan">${App.icon('attendance')} Scan student QR</button><button class="btn ghost" type="button" id="dashCards">${App.icon('download')} Student QR cards</button></section>`;
    document.getElementById('dashScan').onclick=()=>{App.showPanel('attendance');window.ClassCheckQR.openScanner();};
    document.getElementById('dashCards').onclick=()=>window.ClassCheckQR.openCards();
    await syncStatus();
  }
  let lastState='';
  async function syncStatus(){
    let pending=0,queueReadable=true;
    try{pending=(await OfflineDB.all('syncQueue')).filter(x=>x.payload?.teacher_id===ctx.user.id).length;}
    catch(err){queueReadable=false;console.error('Cannot inspect device attendance queue',err);}
    const el=document.getElementById('dashSyncText');
    const hint=document.getElementById('dashSyncHint');
    const retry=document.getElementById('dashSyncRetry');
    if(!el)return;
    const storageProblem=SyncManagerApp.storageError() || typeof window.OfflineDB?.saveQueued!=='function' || !queueReadable;
    el.textContent=storageProblem ? 'Device storage unavailable — changes may not be saved'
      :!navigator.onLine
      ? `Offline • ${pending} change${pending===1?'':'s'} saved on device`
      :lastState==='syncing' ? `Automatically syncing ${pending} change${pending===1?'':'s'}…`
      :lastState==='failed'&&pending ? `${pending} change${pending===1?'':'s'} not synced yet`
      :pending ? `${pending} change${pending===1?'':'s'} saved • waiting to sync`
      :'✓ All saved attendance synced';
    if(hint)hint.textContent=storageProblem ? 'Reopen ClassCheck online to get the latest app. Do not clear site data.'
      :!navigator.onLine
      ? 'Changes will upload automatically after you reconnect and open ClassCheck.'
      :pending ? 'ClassCheck will keep retrying automatically. You can continue taking attendance.'
      :'Attendance is saved locally first, with automatic cloud syncing.';
    if(retry)retry.hidden=storageProblem||!(navigator.onLine&&pending&&lastState==='failed');
  }
  document.getElementById('dashSyncRetry').onclick=()=>SyncManagerApp.flush().catch(console.error);
  SyncManagerApp.onState(s=>{lastState=s.type;syncStatus().catch(console.error);});
  document.addEventListener('classcheck:panelchange',e=>{if(e.detail.panel==='dashboard')render().catch(console.error);});
  await render();
});
