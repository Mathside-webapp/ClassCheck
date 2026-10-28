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
    root.innerHTML=`<header class="dash-heading"><div><p class="dash-eyebrow">YOUR TEACHING DAY, AT A GLANCE</p><h1>Hello, ${esc(state.profile.full_name||'Teacher')}.</h1><p>${esc(App.longDate(today))}</p></div><a class="dash-profile" href="#profile" aria-label="Open profile">${esc((state.profile.full_name||'T')[0])}</a></header>
    <section class="dash-hero"><div><span class="dash-kicker">A LITTLE CHECK. A BIG DIFFERENCE.</span><h2>Every learner.<br>Every school day.</h2><p>Your classes, attendance and daily progress.<br>Ready wherever teaching takes you.</p><div class="dash-actions"><a class="btn primary" href="#attendance">Take attendance ${App.icon('chevron-right')}</a><button class="btn ghost" id="dashScan">Scan student QR</button></div></div><div class="dash-art" aria-hidden="true"><div class="dash-sheet"><span>CLASSCHECK / DAILY REGISTER</span><b>Ready for class.</b><i>✓ <em>Learners</em><small>CHECKED IN</small></i><i>✓ <em>Attendance</em><small>ON DEVICE</small></i><i>✓ <em>Your day</em><small>ORGANIZED</small></i><div class="dash-stamp">CC<span>EVERY DAY COUNTS</span></div></div></div></section>
    <section class="dash-stats" aria-label="Today's saved attendance"><article><span>Learners</span><strong>${learners.length}</strong><small>Across ${classes.length} active classes</small></article><article><span>Present</span><strong>${counts.present}</strong><small>Default unless changed</small></article><article><span>Absent</span><strong>${counts.absent}</strong><small>Recorded today</small></article><article><span>Late</span><strong>${counts.late}</strong><small>Recorded today</small></article></section>
    <div class="dash-columns"><section class="dash-card"><div class="dash-section-title"><div><p class="dash-eyebrow">YOUR ROSTER</p><h2>Classes today</h2></div><a href="#classes">Manage classes ↗</a></div><div>${classes.length?classes.map(c=>{const total=learners.filter(s=>s.class_id===c.id).length,done=rows.filter(r=>r.class_id===c.id).length;return `<a class="dash-class" href="#attendance?class=${encodeURIComponent(c.id)}&date=${today}"><span class="dash-class-icon">${App.icon('users')}</span><span><b>${esc(c.grade_level)} · ${esc(c.section_name)}</b><small>${total} learners · ${done} saved${sessions.some(s=>s.class_id===c.id)?' · Completed':''}</small></span><span class="dash-class-arrow">${App.icon('chevron-right')}</span></a>`;}).join(''):'<div class="dash-empty">Your day starts with a class.<br><a href="#classes">Create a class and add your learners →</a></div>'}</div><p class="dash-footnote">Based on attendance saved on this device. Open a class to refresh its cloud records.</p></section>
    <aside class="dash-card"><p class="dash-eyebrow">TODAY’S PROGRESS</p><h2>One check at a time</h2><div class="dash-progress"><strong>${rate}<small>%</small></strong><span>${marked} of ${learners.length}<br>learners saved</span></div><progress value="${marked}" max="${Math.max(1,learners.length)}" aria-label="Learners marked today"></progress><p>${Math.max(0,learners.length-marked)} learners still shown as Present by default. Tap Finish Attendance to save the full class register.</p><button class="btn soft block" id="dashCards">Print student QR cards</button><a class="dash-report-link" href="#reports">Open attendance reports →</a></aside></div>`;
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
