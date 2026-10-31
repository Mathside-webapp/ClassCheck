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
    root.innerHTML=`<header class="dash-heading"><div><p class="dash-eyebrow">YOUR CLASSROOM, CONNECTED</p><h1>Today’s attendance<span class="cc-heading-dot">.</span></h1><p>Hello, ${esc(state.profile.full_name||'Teacher')}. Let’s make every learner count.</p></div><a class="dash-profile" href="#profile" aria-label="Open profile">${esc((state.profile.full_name||'T')[0])}</a></header>
    <section class="cc-today-banner"><div class="cc-date-tile"><span>${esc(new Date(today+'T12:00:00').toLocaleDateString(undefined,{month:'short'}))}</span><strong>${new Date(today+'T12:00:00').getDate()}</strong></div><div class="cc-today-copy"><span class="dash-eyebrow">YOUR DAILY REGISTER</span><h2>Ready for a great school day?</h2><p>${esc(App.longDate(today))}</p></div><a class="btn primary cc-start" href="#attendance">${App.icon('attendance')} Take attendance ${App.icon('chevron-right')}</a></section>
    <section class="dash-stats" aria-label="Today's attendance overview"><article><span class="cc-stat-icon">${App.icon('users')}</span><span>Learners</span><strong>${learners.length}</strong><small>In ${classes.length} active classes</small></article><article><span class="cc-stat-icon cc-green">${App.icon('check-circle')}</span><span>Present by default</span><strong>${counts.present}</strong><small>Until marked absent or late</small></article><article><span class="cc-stat-icon cc-red">${App.icon('user')}</span><span>Absent</span><strong>${counts.absent}</strong><small>Recorded today</small></article><article><span class="cc-stat-icon cc-amber">${App.icon('calendar')}</span><span>Late</span><strong>${counts.late}</strong><small>Recorded today</small></article></section>
    <div class="dash-columns"><section class="dash-card cc-class-overview"><div class="dash-section-title"><div><p class="dash-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Your classes <span class="cc-count">${classes.length}</span></h2></div><a href="#classes">Manage ${App.icon('chevron-right')}</a></div><div>${classes.length?classes.map((c,i)=>{const total=learners.filter(s=>s.class_id===c.id).length,done=rows.filter(r=>r.class_id===c.id).length,complete=sessions.some(s=>s.class_id===c.id);return `<a class="dash-class" href="#attendance?class=${encodeURIComponent(c.id)}&date=${today}"><span class="dash-class-icon cc-class-tone-${i%3}">${esc(c.section_name.slice(0,2).toUpperCase())}</span><span class="cc-class-detail"><b>${esc(c.section_name)}</b><small>${esc(c.grade_level)} · ${total} learners</small></span><span class="cc-class-status ${complete?'is-complete':''}">${complete?'✓ Complete':done?'In progress':'To do'}</span><span class="dash-class-arrow">${App.icon('chevron-right')}</span></a>`;}).join(''):'<div class="dash-empty">Your day starts with a class.<br><a href="#classes">Create a class and add your learners →</a></div>'}</div><p class="dash-footnote">${App.icon('clipboard-check')} ${completed} of ${classes.length} class registers completed today.</p></section>
    <aside class="dash-card cc-progress-card"><p class="dash-eyebrow">SMALL STEPS, REAL PROGRESS</p><h2>Today, so far</h2><div class="cc-progress-ring" style="--progress:${Math.min(100,rate)}%" role="img" aria-label="${rate}% of learners saved"><div><strong>${rate}<small>%</small></strong><span>of learners saved</span></div></div><p><b>${marked} of ${learners.length} learners</b><br>Finish attendance to save your class register.</p><a class="dash-report-link" href="#reports">View attendance reports ${App.icon('chevron-right')}</a></aside></div>
    <section class="cc-quick-tools" aria-label="Quick tools"><button type="button" id="dashScan"><span class="cc-tool-icon">${App.icon('attendance')}</span><span><b>Scan a student QR</b><small>A quick check-in, ready in seconds</small></span>${App.icon('chevron-right')}</button><button type="button" id="dashCards"><span class="cc-tool-icon">${App.icon('download')}</span><span><b>Student QR cards</b><small>Prepare cards for your next class</small></span>${App.icon('chevron-right')}</button></section>
    <p class="cc-data-caption">Overview uses attendance saved on this device. Open a class to refresh its cloud records.</p>`;
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
