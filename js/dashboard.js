/* ClassCheck v18 preview-to-live dashboard. Real cached teacher data only. */
document.addEventListener('DOMContentLoaded',async()=>{
 const root=document.getElementById('dashboardContent');if(!root)return;
 let ctx;try{ctx=await AppBoot.ready()}catch(e){root.textContent=e.message||'Sign in to open your dashboard.';return;}
 if(!App.isUnified())App.nav('dashboard');
 const esc=App.escapeHtml,icon=App.icon,today=()=>App.fmtDate();
 const empty=(asset,title,description,action)=>`<div class="ccx-illustrated-empty"><img src="assets/${asset}.png" alt="" loading="lazy"><h3>${esc(title)}</h3><p>${esc(description)}</p>${action||''}</div>`;
 let isRendering=false,rerender=false;
 async function render(){
  if(isRendering){rerender=true;return;}isRendering=true;
  try{
    const state=AppStorage.get();const name=state.profile?.full_name?.trim()||'Teacher';
    const date=today();const d=new Date(`${date}T12:00:00`);const classes=(state.classes||[]).filter(c=>!c.archived);
    const studentList=(state.students||[]).filter(s=>!s.archived&&classes.some(c=>c.id===s.class_id));
    const rows=(await OfflineDB.all('attendance')).filter(r=>r.teacher_id===ctx.user.id&&r.attendance_date===date);
    const latest=new Map(rows.map(r=>[`${r.class_id}:${r.student_id}`,r]));
    const sessions=(await OfflineDB.all('sessions')).filter(s=>s.teacher_id===ctx.user.id&&s.attendance_date===date&&(s.session_status==='completed'||s.status==='completed'));
    const allowed=new Set(studentList.map(s=>`${s.class_id}:${s.id}`));
    const marks=[...latest].filter(([key])=>allowed.has(key)).map(([,r])=>r);
    const count={present:0,absent:0,late:0};marks.forEach(m=>{if(m.status in count)count[m.status]++});
    const details=classes.map(c=>({c,roster:studentList.filter(s=>s.class_id===c.id),marks:marks.filter(m=>m.class_id===c.id),completed:sessions.some(x=>x.class_id===c.id)}));
    const stats=[['users',classes.length,'Active classes','Your current sections',''],['users',studentList.length,'Total learners','Across active classes',''],['check-circle',count.present,'Present today','Saved attendance','green'],['calendar',count.absent,'Absent today','Saved attendance','red'],['calendar',count.late,'Late today','Saved attendance','amber']];
    const item=({c,roster,marks,completed})=>`<a class="ccx-dash-class-row" href="#attendance?class=${encodeURIComponent(c.id)}&date=${date}"><span class="ccx-class-initial">${esc((c.section_name||'CL').slice(0,2).toUpperCase())}</span><span class="ccx-class-title"><b>${esc(c.grade_level)} — ${esc(c.section_name)}</b><small>${roster.length} learners · ${marks.length} recorded today</small></span><span class="ccx-chip ${completed?'success':marks.length?'rose':'amber'}">${completed?'Completed':marks.length?'In progress':'Not started'}</span>${icon('chevron-right')}</a>`;
    const activity=[...(await OfflineDB.all('sessions')).filter(r=>r.teacher_id===ctx.user.id&&(r.session_status==='completed'||r.status==='completed'))].sort((a,b)=>String(b.client_updated_at||b.updated_at||b.attendance_date).localeCompare(String(a.client_updated_at||a.updated_at||a.attendance_date))).slice(0,4);
    root.innerHTML=`<section class="ccx-dashboard-hero"><div><span class="ccx-eyebrow">TEACHER WORKSPACE</span><h1>Every learner counts. Every day.</h1><p>Good day, ${esc(name)}! Your classes, attendance and reports in one calm workspace.</p></div><div class="ccx-hero-date"><strong>${d.getDate()}</strong><span>${d.toLocaleDateString(undefined,{month:'long',year:'numeric'})}<small>${d.toLocaleDateString(undefined,{weekday:'long'})}</small></span></div></section>
    <section class="ccx-stat-grid" aria-label="Today's saved attendance statistics">${stats.map(([ico,n,label,help,tone])=>`<article class="ccx-stat-card"><span class="ccx-stat-icon ${tone}">${icon(ico)}</span><div><small>${esc(label)}</small><strong>${n}</strong><span>${esc(help)}</span></div></article>`).join('')}</section>
    <div class="ccx-dashboard-grid"><div class="ccx-dashboard-stack"><section class="ccx-card ccx-card-pad"><header class="ccx-section-title"><h2>My Classes</h2><a href="#classes">View all ${icon('chevron-right')}</a></header>${details.length?details.map(item).join(''):empty('empty-classes','No classes yet','Create a class or join an adviser’s class.','<a class="btn primary" href="#classes">Manage classes</a>')}</section>
    <section class="ccx-card ccx-card-pad"><header class="ccx-section-title"><h2>Today's Attendance</h2><a href="#attendance">Open register ${icon('chevron-right')}</a></header>${details.length?details.map(({c,roster,marks,completed})=>`<a class="ccx-dash-class-row" href="#attendance?class=${encodeURIComponent(c.id)}&date=${date}"><span class="ccx-class-initial">${icon('clipboard-check')}</span><span class="ccx-class-title"><b>${esc(c.grade_level)} — ${esc(c.section_name)}</b><small>${marks.length} of ${roster.length} marked</small></span><span class="ccx-chip ${completed?'success':'amber'}">${completed?'Complete':marks.length?'In progress':'Pending'}</span></a>`).join(''):empty('empty-attendance','No attendance yet','Open your classes to get started','<a class="btn primary" href="#attendance">Daily attendance</a>')}</section></div>
    <div class="ccx-dashboard-stack"><section class="ccx-card ccx-card-pad"><header class="ccx-section-title"><h2>Quick Actions</h2></header><div class="ccx-action-grid"><a href="#attendance">${icon('clipboard-check')}<b>Mark Attendance</b></a><a href="#calendar">${icon('calendar')}<b>View Calendar</b></a><a href="#import">${icon('download')}<b>Import SF1</b></a><a href="#reports">${icon('report')}<b>Export SF2</b></a><button type="button" id="ccxDashScan">${icon('attendance')}<b>Scan QR</b></button><button type="button" id="ccxDashQrCards">${icon('download')}<b>QR Cards</b></button></div></section>
    <section class="ccx-card ccx-card-pad"><header class="ccx-section-title"><h2>Recent Activity</h2><a href="#calendar">View history ${icon('chevron-right')}</a></header>${activity.length?activity.map(a=>`<div class="ccx-activity-row"><span class="ccx-activity-symbol">${icon('check-circle')}</span><span><b>Completed attendance register</b><small>${esc(a.attendance_date)} · ${esc(classes.find(c=>c.id===a.class_id)?.section_name||'Class')}</small></span><span class="ccx-chip success">Saved</span></div>`).join(''):empty('empty-calendar','No saved activity yet','Completed registers will appear here.')}</section></div></div>
    <div class="ccx-dashboard-hint">${icon('clipboard-check')} Attendance is saved on this device first and then synchronized with Supabase after reconnection and authentication.</div>`;
    root.querySelector('#ccxDashScan')?.addEventListener('click',()=>{App.showPanel('attendance');window.ClassCheckQR?.openScanner?.();});
    root.querySelector('#ccxDashQrCards')?.addEventListener('click',()=>{App.showPanel('attendance');window.ClassCheckQR?.openCards?.();});
  }catch(e){console.error('Dashboard read failed',e);root.innerHTML='<div class="ccx-card ccx-card-pad"><h2>Local records unavailable</h2><p>Do not clear your browser data. Reopen ClassCheck with a valid session or retry when your local database is accessible.</p></div>';}finally{isRendering=false;if(rerender){rerender=false;render();}}
 }
 window.ClassCheckDashboard={refresh:render};
 window.SyncManagerApp?.onState?.(()=>render());
 document.addEventListener('classcheck:panelchange',e=>{if(e.detail?.panel==='dashboard')render();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.querySelector('[data-app-panel="dashboard"]:not([hidden])'))render();});
 await render();
});
