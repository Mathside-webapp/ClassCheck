document.addEventListener('DOMContentLoaded',async()=>{
  let ctx;
  try{ctx=await AppBoot.ready();}catch(err){console.error(err);return;}
  if(!App.isUnified())App.nav('reports');

  let state=AppStorage.get();
  const supa=Supa.getClient();
  const userId=ctx.user.id;
  const select=document.getElementById('reportClass');
  const teacherSelect=document.getElementById('reportTeacher');
  const monthInput=document.getElementById('reportMonth');
  const monthBtn=document.getElementById('reportMonthBtn');
  const monthLabel=document.getElementById('reportMonthLabel');
  const monthBadge=document.getElementById('reportMonthBadge');
  const drawer=document.getElementById('reportMonthDrawer');
  const yearLabel=document.getElementById('reportYearLabel');
  const monthGrid=document.getElementById('reportMonthGrid');
  const sf2Modal=document.getElementById('sf2ResultModal');
  const sf2DownloadBtn=document.getElementById('downloadSf2Btn');
  const sf2CloseBtn=document.getElementById('sf2ResultClose');
  const sf2DetailsModal=document.getElementById('sf2DetailsModal');
  const sf2DetailsClose=document.getElementById('sf2DetailsClose');
  const sf2DetailsCancel=document.getElementById('sf2DetailsCancel');
  const sf2DetailsGenerate=document.getElementById('sf2DetailsGenerate');
  const sf2BaselineMale=document.getElementById('sf2BaselineMale');
  const sf2BaselineFemale=document.getElementById('sf2BaselineFemale');
  const sf2BaselineTotal=document.getElementById('sf2BaselineTotal');
  const sf2BaselineStatus=document.getElementById('sf2BaselineStatus');
  let sf2Download=null;

  const MAROON='7A1730',MAROON_DARK='571022',BLUSH='F8E9EE',BLUSH_LIGHT='FFF7F8',WHITE='FFFFFF',INK='2D2025',MUTED='765964',GRAY='F0ECEE',GREEN='E8F4EC';
  const maroonBorder={top:{style:'thin',color:{rgb:MAROON}},bottom:{style:'thin',color:{rgb:MAROON}},left:{style:'thin',color:{rgb:MAROON}},right:{style:'thin',color:{rgb:MAROON}}};

  let activeClasses=state.classes.filter(c=>!c.archived);
  function populateClasses(){
    const previous=select.value;
    activeClasses=state.classes.filter(c=>!c.archived);
    select.innerHTML=activeClasses.map(c=>`<option value="${c.id}">${c.grade_level} – ${c.section_name}</option>`).join('');
    if(previous&&activeClasses.some(c=>c.id===previous))select.value=previous;
  }
  populateClasses();
  function membership(classId,teacherId=userId){return (state.classTeachers||[]).find(m=>m.class_id===classId&&m.teacher_id===teacherId);}
  function isAdviserOfCurrentClass(){
    const c=state.classes.find(x=>x.id===select.value);
    return !!c&&c.teacher_id===userId;
  }
  // Adviser-controlled permission grants are fetched from Supabase, not trusted from localStorage.
  let adviserAccess={cid:null,loaded:false,granted:new Set(),pending:new Set(),error:''};
  const accessPanel=document.getElementById('adviserAccessBar');
  const accessStrip=document.getElementById('adviserAccessStrip');
  const accessCount=document.getElementById('adviserAccessCount');
  const accessStatus=document.getElementById('adviserAccessStatus');
  function resetAdviserAccess(){adviserAccess={cid:null,loaded:false,granted:new Set(),pending:new Set(),error:''};}
  function allowedToViewAdviser(cid){return adviserAccess.cid===cid&&adviserAccess.loaded&&adviserAccess.granted.has(userId);}
  function sourcesForClass(cid){
    const c=state.classes.find(x=>x.id===cid);if(!c)return[];
    // Both the owner and joined subject teachers can inspect every attendance source
    // for their shared class. Editing attendance remains teacher-specific elsewhere.
    const members=(state.classTeachers||[]).filter(m=>m.class_id===cid);
    const isAdviser=c.teacher_id===userId;
    if(!isAdviser&&!members.some(m=>m.teacher_id===userId))return[];
    const adviser={teacher_id:c.teacher_id,teacher_name:c.teacher_id===userId?(state.profile.full_name||c.adviser_name||'Adviser'):(c.adviser_name||'Class adviser'),subject:'Advisory',label:'Adviser attendance'};
    const joined=members.filter(m=>m.teacher_id!==c.teacher_id)
      .sort((a,b)=>(a.subject||'').localeCompare(b.subject||'')||(a.teacher_name||'').localeCompare(b.teacher_name||''))
      .map(m=>({...m,label:`${m.teacher_id===userId?'My attendance • ':''}${m.subject||'Subject'} • ${m.teacher_name||'Teacher'}`}));
    return (isAdviser||allowedToViewAdviser(cid))?[adviser,...joined]:joined;
  }
  const sf2Btn=document.getElementById('sf2Btn');
  const sourceNote=document.getElementById('reportSourceNote');
  function currentSource(){const sources=sourcesForClass(select.value);return sources.find(s=>s.teacher_id===teacherSelect.value)||sources[0]||null;}
  function canGenerateSf2(){return isAdviserOfCurrentClass()&&currentSource()?.teacher_id===userId;}
  function updateSourcePermissions(){
    const allowed=canGenerateSf2();
    sf2Btn?.classList.toggle('hidden',!allowed);
    if(sourceNote){
      const source=currentSource();
      if(!source){sourceNote.textContent='No attendance source is available. Join this class or refresh while online.';}
      else if(allowed){sourceNote.textContent='Official adviser source selected. SF2 is available. To compare attendance, choose a joined subject teacher.';}
      else if(isAdviserOfCurrentClass()){sourceNote.textContent='Viewing another teacher’s attendance (read-only). Return to Adviser attendance to create SF2.';}
      else if(source.teacher_id===userId){sourceNote.textContent='Your subject attendance. Adviser attendance is available only if the adviser grants access. SF2 belongs to the adviser.';}
      else{sourceNote.textContent='Shared class attendance (read-only). Only the class adviser can create SF2.';}
    }
  }
  function renderSources(){
    const previous=teacherSelect.value;
    const sources=sourcesForClass(select.value);
    teacherSelect.replaceChildren();
    for(const source of sources){
      const option=document.createElement('option');
      option.value=source.teacher_id;option.dataset.subject=source.subject||'';option.textContent=source.label;
      teacherSelect.appendChild(option);
    }
    if(sources.some(item=>item.teacher_id===previous))teacherSelect.value=previous;
    updateSourcePermissions();
    renderAccessControl();
  }

  // A swipeable/drag-scroll access bar, shown only to the class adviser.
  function renderAccessControl(){
    if(!accessPanel||!accessStrip)return;
    const cid=select.value;
    const owned=isAdviserOfCurrentClass();
    accessPanel.classList.toggle('hidden',!owned);
    if(!owned)return;
    const members=(state.classTeachers||[]).filter(m=>m.class_id===cid&&m.teacher_id!==userId)
      .sort((a,b)=>(a.subject||'').localeCompare(b.subject||'')||(a.teacher_name||'').localeCompare(b.teacher_name||''));
    const loaded=adviserAccess.cid===cid&&adviserAccess.loaded;
    const count=members.filter(m=>adviserAccess.granted.has(m.teacher_id)).length;
    if(accessCount)accessCount.textContent=loaded?`${count} of ${members.length} allowed`:'Loading access…';
    if(accessStatus){
      accessStatus.textContent=adviserAccess.error||(!navigator.onLine?'Connect to the internet to change access.':
        !members.length?'No joined subject teachers yet. Invite a teacher from My Classes.':
        !loaded?'Checking saved permissions…':'Access changes save automatically. Other subjects remain shared.');
    }
    accessStrip.replaceChildren();
    if(!members.length){
      const empty=document.createElement('span');empty.className='adviser-access-empty';empty.textContent='Subject teachers will appear here after joining.';accessStrip.appendChild(empty);return;
    }
    for(const m of members){
      const enabled=loaded&&adviserAccess.granted.has(m.teacher_id);
      const pending=adviserAccess.pending.has(m.teacher_id);
      const nameText=m.teacher_name||'Teacher';
      const subjectText=m.subject||'Subject';
      const initials=nameText.trim().split(/\s+/).slice(0,2).map(word=>word.charAt(0)).join('').toUpperCase();
      const card=document.createElement('button');card.type='button';
      card.className=`cc-access-card ${enabled?'is-allowed':'is-blocked'}`;
      card.setAttribute('role','switch');card.setAttribute('aria-checked',String(enabled));
      card.setAttribute('aria-label',`${nameText}, ${subjectText}: ${enabled?'Allowed':'Blocked'}. Activate to ${enabled?'block':'allow'} access to adviser attendance.`);
      card.title=`${nameText} • ${subjectText}`;
      card.disabled=!loaded||pending||!navigator.onLine||APP_CONFIG.DEMO_MODE;
      const head=document.createElement('span');head.className='cc-access-card-head';
      const avatar=document.createElement('span');avatar.className='cc-access-avatar';avatar.textContent=initials||'T';avatar.setAttribute('aria-hidden','true');
      const person=document.createElement('span');person.className='cc-access-person';
      const name=document.createElement('b');name.textContent=nameText;
      const subject=document.createElement('small');subject.textContent=subjectText;
      person.append(name,subject);head.append(avatar,person);
      const foot=document.createElement('span');foot.className='cc-access-card-foot';
      const status=document.createElement('span');status.className='cc-access-state';status.textContent=pending?'Saving…':enabled?'Allowed':'Blocked';
      const track=document.createElement('span');track.className='cc-access-switch';track.setAttribute('aria-hidden','true');
      const thumb=document.createElement('span');thumb.className='cc-access-switch-thumb';track.appendChild(thumb);
      foot.append(status,track);card.append(head,foot);
      card.addEventListener('click',()=>saveTeacherAccess(cid,m.teacher_id,!enabled));
      accessStrip.appendChild(card);
    }
  }
  async function saveTeacherAccess(cid,teacherId,allowed){
    if(!isAdviserOfCurrentClass()||cid!==select.value||!adviserAccess.loaded||adviserAccess.pending.has(teacherId))return;
    adviserAccess.pending.add(teacherId);renderAccessControl();
    try{
      const {error}=await supa.rpc('classcheck_set_adviser_attendance_access',
        {p_class_id:cid,p_teacher_id:teacherId,p_allowed:allowed});
      if(error)throw error;
      if(cid!==select.value)return;
      if(allowed)adviserAccess.granted.add(teacherId);else adviserAccess.granted.delete(teacherId);
      adviserAccess.error='';
      const member=(state.classTeachers||[]).find(m=>m.class_id===cid&&m.teacher_id===teacherId);
      App.toast(`${member?.teacher_name||'Teacher'} ${allowed?'can now view':'can no longer view'} adviser attendance.`);
    }catch(error){console.error('Failed to update adviser attendance permission:',error);
      if(cid===select.value){adviserAccess.error=error?.message||'Could not save permission; try again.';App.toast('Could not save access. Check your connection and V12.3 SQL.');}
    }finally{adviserAccess.pending.delete(teacherId);if(cid===select.value)renderAccessControl();}
  }
  async function loadAdviserAccess(cid,sequence){
    if(!cid||APP_CONFIG.DEMO_MODE||!navigator.onLine){renderAccessControl();return;}
    const {data,error}=await supa.from('classcheck_adviser_attendance_access')
      .select('teacher_id').eq('class_id',cid);
    if(sequence!==teacherRefreshSequence||cid!==select.value)return;
    if(error){
      adviserAccess={cid,loaded:false,granted:new Set(),pending:new Set(),error:'Cannot load access controls. Run the V12.3 SQL in ClassCheck Supabase.'};
      console.warn('Access permission refresh failed',error);
    }else{
      adviserAccess={cid,loaded:true,granted:new Set((data||[]).map(x=>x.teacher_id)),pending:new Set(),error:''};
    }
    renderSources();
  }
  // Check live adviser grant immediately before each external adviser preview/export.
  async function requireAdviserAccessForRead(cid,source){
    const c=state.classes.find(x=>x.id===cid);
    if(!c||c.teacher_id===userId||source.teacher_id!==c.teacher_id)return;
    if(!navigator.onLine)throw new Error('Connect to the internet to view adviser attendance.');
    const {data,error}=await supa.from('classcheck_adviser_attendance_access')
      .select('teacher_id').eq('class_id',cid).eq('teacher_id',userId).maybeSingle();
    if(error)throw new Error('Unable to verify adviser attendance permission.');
    if(!data){
      adviserAccess.granted.delete(userId);renderSources();
      throw new Error('The adviser has not allowed you to view this attendance.');
    }
  }
  let teacherRefreshSequence=0;
  async function refreshSharedSources(){
    const cid=select.value;
    if(!cid||!state.classes.some(c=>c.id===cid)||APP_CONFIG.DEMO_MODE||!navigator.onLine)return;
    const sequence=++teacherRefreshSequence;
    if(sourceNote)sourceNote.textContent='Refreshing shared attendance sources…';
    // Refresh all class memberships for any authorized adviser or joined teacher.
    // V12.2 SQL grants participant-scoped SELECT access without modifying write permissions.
    const {data,error}=await supa.from('classcheck_class_teachers')
      .select('class_id,teacher_id,teacher_name,subject,joined_at').eq('class_id',cid).order('joined_at',{ascending:true});
    if(sequence!==teacherRefreshSequence||cid!==select.value)return;
    if(error){
      console.warn('Unable to refresh subject teachers',error);
      if(sourceNote)sourceNote.textContent='Could not refresh attendance sources. Run the V12.2 SQL update in ClassCheck Supabase and reopen Reports.';
      return;
    }
    const cached=AppStorage.get();
    cached.classTeachers=(cached.classTeachers||[]).filter(m=>m.class_id!==cid).concat(data||[]);
    AppStorage.set(cached,userId);
    state=cached;
    await loadAdviserAccess(cid,sequence);
    if(sequence!==teacherRefreshSequence||cid!==select.value)return;
    renderSources();
    await preview();
  }
  const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLong=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now=new Date();let selectedYear=now.getFullYear(),selectedMonthIndex=now.getMonth(),drawerYear=selectedYear;
  function monthValue(){return `${selectedYear}-${String(selectedMonthIndex+1).padStart(2,'0')}`;}
  function monthText(y,m){return `${monthLong[m]} ${y}`;}
  function syncMonthUI(){monthInput.value=monthValue();monthLabel.textContent=monthText(selectedYear,selectedMonthIndex);monthBadge.textContent=monthText(selectedYear,selectedMonthIndex);}
  function setDrawerOpen(open){drawer.classList.toggle('open',open);drawer.setAttribute('aria-hidden',String(!open));monthBtn.setAttribute('aria-expanded',String(open));if(open)renderMonthGrid();}
  function renderMonthGrid(){yearLabel.textContent=drawerYear;monthGrid.innerHTML=monthNames.map((name,idx)=>`<button type="button" class="report-month-chip ${drawerYear===selectedYear&&idx===selectedMonthIndex?'active':''}" data-month="${idx}">${name}</button>`).join('');monthGrid.querySelectorAll('.report-month-chip').forEach(btn=>btn.onclick=()=>{selectedYear=drawerYear;selectedMonthIndex=Number(btn.dataset.month);syncMonthUI();setDrawerOpen(false);preview();});}
  monthBtn.onclick=()=>setDrawerOpen(!drawer.classList.contains('open'));
  document.getElementById('reportPrevYear').onclick=()=>{drawerYear--;renderMonthGrid();};
  document.getElementById('reportNextYear').onclick=()=>{drawerYear++;renderMonthGrid();};
  document.getElementById('reportMonthToday').onclick=()=>{const d=new Date();selectedYear=d.getFullYear();selectedMonthIndex=d.getMonth();drawerYear=selectedYear;syncMonthUI();setDrawerOpen(false);preview();};
  document.getElementById('reportMonthClear').onclick=()=>{const d=new Date();selectedYear=d.getFullYear();selectedMonthIndex=d.getMonth();drawerYear=selectedYear;syncMonthUI();renderMonthGrid();};
  document.addEventListener('click',e=>{const wrap=document.querySelector('.report-month-wrap');if(drawer.classList.contains('open')&&wrap&&!wrap.contains(e.target))setDrawerOpen(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){setDrawerOpen(false);sf2Modal?.classList.add('hidden');}});

  function nextMonth(prefix){const [y,m]=prefix.split('-').map(Number);const d=new Date(y,m,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;}
  function isSchoolWeekday(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;
    const d=new Date(`${value}T12:00:00`);
    const day=d.getDay();
    return day!==0&&day!==6;
  }
  async function getRecords(cid,prefix,teacherId){
    if(teacherId!==userId&&!APP_CONFIG.DEMO_MODE&&!navigator.onLine)throw new Error('Connect to the internet to view another teacher’s attendance.');
    const local=teacherId===userId?(await OfflineDB.all('attendance')).filter(r=>r.teacher_id===teacherId&&r.class_id===cid&&r.attendance_date.startsWith(prefix)&&isSchoolWeekday(r.attendance_date)):[];
    const map=new Map(local.map(r=>[`${r.teacher_id}_${r.class_id}_${r.student_id}_${r.attendance_date}`,r]));
    if(navigator.onLine&&!APP_CONFIG.DEMO_MODE){
      const {data,error}=await supa.from('classcheck_attendance_records')
        .select('teacher_id,class_id,student_id,attendance_date,status,note,subject,client_updated_at,updated_at')
        .eq('teacher_id',teacherId).eq('class_id',cid).gte('attendance_date',`${prefix}-01`).lt('attendance_date',nextMonth(prefix));
      if(!error){for(const r of data||[]){if(!isSchoolWeekday(r.attendance_date))continue;const key=`${r.teacher_id}_${r.class_id}_${r.student_id}_${r.attendance_date}`;if(!map.has(key))map.set(key,{...r,key});}}
      else if(teacherId!==userId)throw new Error('Unable to load shared attendance. Check V12.2 permissions and your connection.');
      else console.warn('Report refresh failed',error);
    }
    return [...map.values()];
  }

  async function getCompletedSessionDates(cid,prefix,teacherId){
    if(teacherId!==userId&&!APP_CONFIG.DEMO_MODE&&!navigator.onLine)throw new Error('Connect to the internet to view another teacher’s attendance.');
    const dates=new Set();
    if(teacherId===userId){
      const local=await OfflineDB.all('sessions');
      for(const s of local){
        const completed=(s.session_status==='completed'||s.status==='completed');
        if(completed&&s.teacher_id===teacherId&&s.class_id===cid&&String(s.attendance_date||'').startsWith(prefix)&&isSchoolWeekday(s.attendance_date))dates.add(s.attendance_date);
      }
    }
    if(navigator.onLine&&!APP_CONFIG.DEMO_MODE){
      const {data,error}=await supa.from('classcheck_attendance_sessions')
        .select('attendance_date,session_status')
        .eq('teacher_id',teacherId).eq('class_id',cid).eq('session_status','completed')
        .gte('attendance_date',`${prefix}-01`).lt('attendance_date',nextMonth(prefix));
      if(error&&teacherId!==userId)throw new Error('Unable to load shared attendance sessions. Check V12.2 permissions.');
      if(!error){for(const row of data||[])if(row.attendance_date&&isSchoolWeekday(row.attendance_date))dates.add(row.attendance_date);}
      else console.warn('Completed-session refresh failed',error);
    }
    return [...dates].sort();
  }

  function sortStudents(students){return [...students].sort((a,b)=>{const sx=(a.sex==='Male'?0:1)-(b.sex==='Male'?0:1);return sx||App.studentName(a).localeCompare(App.studentName(b),undefined,{sensitivity:'base'});});}
  function safe(v,fallback='Not provided'){const s=String(v??'').trim();return s||fallback;}
  function statusCounts(records){return{present:records.filter(x=>x.status==='present').length,absent:records.filter(x=>x.status==='absent').length,late:records.filter(x=>x.status==='late').length};}
  function monthBounds(prefix){const [y,m]=prefix.split('-').map(Number);const days=new Date(y,m,0).getDate();return{year:y,month:m,days,start:`${prefix}-01`,end:`${prefix}-${String(days).padStart(2,'0')}`};}
  function monthWeekdayCalendar(prefix){
    const bounds=monthBounds(prefix);
    let firstWeekday=null;
    for(let day=1;day<=bounds.days;day++){
      const date=new Date(Date.UTC(bounds.year,bounds.month-1,day));
      const dow=date.getUTCDay();
      if(dow>=1&&dow<=5){firstWeekday=date;break;}
    }
    if(!firstWeekday)return[];
    const firstWeekMonday=new Date(firstWeekday);
    firstWeekMonday.setUTCDate(firstWeekMonday.getUTCDate()-(firstWeekday.getUTCDay()-1));
    const result=[];
    for(let day=1;day<=bounds.days;day++){
      const date=new Date(Date.UTC(bounds.year,bounds.month-1,day));
      const dow=date.getUTCDay();
      if(dow===0||dow===6)continue;
      const weekIndex=Math.floor((date-firstWeekMonday)/(7*24*60*60*1000));
      const weekdayIndex=dow-1; // Monday=0 ... Friday=4
      const slotIndex=(weekIndex*5)+weekdayIndex;
      result.push({date:`${prefix}-${String(day).padStart(2,'0')}`,day,dow,weekIndex,weekdayIndex,slotIndex});
    }
    return result;
  }
  function inSelectedMonth(value,prefix){return typeof value==='string'&&value.startsWith(prefix);}

  async function collectReportData(){
    state=AppStorage.get();
    const cid=select.value,prefix=monthInput.value,c=state.classes.find(x=>x.id===cid),source=currentSource();
    if(!c||!source)throw new Error('Choose a class and attendance source first.');
    await requireAdviserAccessForRead(cid,source);
    const students=sortStudents(state.students.filter(s=>s.class_id===cid&&!s.archived));
    const [rawRecords,completedSessionDates]=await Promise.all([
      getRecords(cid,prefix,source.teacher_id),
      getCompletedSessionDates(cid,prefix,source.teacher_id)
    ]);
    // Ignore any legacy weekend test records. SF2 school days are Monday-Friday only.
    const records=rawRecords.filter(r=>isSchoolWeekday(r.attendance_date));
    const bounds=monthBounds(prefix);
    const byStudent=new Map();
    const byDate=new Map();
    for(const r of records){
      if(!byStudent.has(r.student_id))byStudent.set(r.student_id,new Map());
      byStudent.get(r.student_id).set(r.attendance_date,r);
      if(!byDate.has(r.attendance_date))byDate.set(r.attendance_date,[]);
      byDate.get(r.attendance_date).push(r);
    }
    const recordedDates=[...byDate.keys()].filter(isSchoolWeekday).sort();
    // SF2 uses the fixed Monday-Friday calendar for the selected month.
    // Saturdays and Sundays never get a slot and never count as school days.
    const calendarDays=monthWeekdayCalendar(prefix);
    const schoolDates=calendarDays.map(item=>item.date);
    const schoolDays=calendarDays.length;
    const counts=statusCounts(records);
    const base={cid,prefix,c,source,students,records,byStudent,byDate,recordedDates,completedSessionDates,calendarDays,schoolDates,bounds,schoolDays,counts,profile:state.profile||{}};
    const totalSummary=attendanceSummaryFor(students,base);
    return{
      ...base,
      registeredEnd:totalSummary.registered,
      enrolmentStart:totalSummary.start,
      lateEnrollment:totalSummary.late,
      transferredIn:totalSummary.transferredIn,
      transferredOut:totalSummary.transferredOut,
      dropped:totalSummary.dropped,
      totalDailyAttendance:totalSummary.totalDaily,
      averageDailyAttendance:totalSummary.ada,
      percentageAttendance:totalSummary.pctAttendance,
      percentageEnrollment:totalSummary.pctEnrollment
    };
  }

  // Daily register: report only explicit saved marks. A school day with no saved mark
  // is NOT the same as a Present status, even if the attendance screen defaults to Present.
  const daySymbols={present:'P',absent:'A',late:'L'};
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function safeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function dayStatus(d,student,date){
    const mark=d.byStudent.get(student.id)?.get(date)?.status;
    return Object.hasOwn(daySymbols,mark)?daySymbols[mark]:'—';
  }
  function dailyRows(d){return d.students.map((student,index)=>({
    index:index+1,name:App.studentName(student),sex:student.sex,
    marks:d.calendarDays.map(day=>dayStatus(d,student,day.date))
  }));}
  let previewSerial=0;
  async function preview(){
    const serial=++previewSerial;
    const thead=document.querySelector('.report-table thead');
    const tbody=document.getElementById('reportBody');
    const meta=document.getElementById('reportMeta');
    if(!thead||!tbody)return;
    tbody.innerHTML='<tr><td>Loading daily attendance…</td></tr>';
    try{
      const d=await collectReportData();
      if(serial!==previewSerial)return;
      const days=d.calendarDays;
      const header=`<tr><th scope="col">#</th><th scope="col">Learner Name</th>${days.map(day=>`<th scope="col" title="${safeHtml(day.date)}">${day.day}<small>${dayNames[day.dow]}</small></th>`).join('')}</tr>`;
      thead.innerHTML=header;
      const rows=dailyRows(d);
      tbody.innerHTML=rows.map(row=>`<tr><td class="daily-row-num">${row.index}</td><td class="daily-learner">${safeHtml(row.name)}</td>${row.marks.map((mark,i)=>`<td class="daily-mark daily-mark-${mark==='P'?'present':mark==='A'?'absent':mark==='L'?'late':'empty'}" title="${safeHtml(days[i].date)}: ${mark==='P'?'Present':mark==='A'?'Absent':mark==='L'?'Late':'Not Recorded'}">${mark}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${2+days.length}">No learners in this class.</td></tr>`;
      meta.textContent=`${d.source.subject} • ${d.source.teacher_name||'Teacher'} • ${rows.length} learners • ${days.length} weekdays | P = Present · A = Absent · L = Late · — = Not Recorded`;
    }catch(error){
      if(serial!==previewSerial)return;
      console.warn('Daily attendance preview failed',error);
      thead.innerHTML='<tr><th>Daily attendance</th></tr>';
      tbody.innerHTML=`<tr><td>${safeHtml(error?.message||'Unable to load attendance. Check your connection and permissions.')}</td></tr>`;
      meta.textContent='';
    }
  }

  function setCell(ws,address,value,style){const cell=ws[address]||{t:typeof value==='number'?'n':'s',v:value};cell.v=value;cell.t=typeof value==='number'?'n':'s';if(style)cell.s=style;ws[address]=cell;}
  function styleRange(ws,rangeRef,style){const range=XLSX.utils.decode_range(rangeRef);for(let r=range.s.r;r<=range.e.r;r++)for(let c=range.s.c;c<=range.e.c;c++){const a=XLSX.utils.encode_cell({r,c});if(!ws[a])ws[a]={t:'s',v:''};ws[a].s={...(ws[a].s||{}),...style};}}
  function addMaroonBorders(ws,rangeRef){styleRange(ws,rangeRef,{border:maroonBorder});}
  function workbookBlob(wb){const bytes=XLSX.write(wb,{bookType:'xlsx',type:'array',cellStyles:true});return new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
  function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);}
  function filePart(v){return String(v||'').trim().replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'Class';}

  const SF2_DATE_COLUMNS=['F','H','I','J','K','L','N','O','P','Q','R','T','U','V','X','Z','AB','AC','AD','AE','AF','AG','AI','AJ','AK'];
  let sf2TemplateBytesPromise=null;

  function cloneStyle(value){
    if(value==null)return value;
    try{return structuredClone(value);}catch(_){return JSON.parse(JSON.stringify(value));}
  }
  function setTemplateCell(ws,address,value){
    const cell=ws[address]||{};
    delete cell.f;delete cell.F;delete cell.w;
    cell.v=value==null?'':value;
    cell.t=typeof value==='number'?'n':'s';
    ws[address]=cell;
  }
  function clearTemplateCell(ws,address){setTemplateCell(ws,address,'');}
  function copyTemplateRowStyle(ws,sourceRow,targetRow){
    for(let c=0;c<47;c++){
      const sa=XLSX.utils.encode_cell({r:sourceRow-1,c});
      const da=XLSX.utils.encode_cell({r:targetRow-1,c});
      const src=ws[sa];
      const dst=ws[da]||{t:'s',v:''};
      if(src?.s)dst.s=cloneStyle(src.s);
      if(src?.z!=null)dst.z=src.z;
      ws[da]=dst;
    }
    if(ws['!rows']?.[sourceRow-1]){
      ws['!rows']=ws['!rows']||[];
      ws['!rows'][targetRow-1]=cloneStyle(ws['!rows'][sourceRow-1]);
    }
  }
  function clearTemplateRow(ws,row){
    for(let c=0;c<47;c++)clearTemplateCell(ws,XLSX.utils.encode_cell({r:row-1,c}));
  }
  function sf2LearnerName(s){
    const last=String(s.last_name||'').trim().toUpperCase();
    const first=String(s.first_name||'').trim().toUpperCase();
    const ext=String(s.name_extension||'').trim().toUpperCase();
    const middle=String(s.middle_name||'').trim().toUpperCase();
    let out=`${last},${first}`;
    if(ext)out+=`, ${ext}`;
    if(middle)out+=`, ${middle}`;
    return out.replace(/,\s*-/g,'').replace(/\s+/g,' ').trim();
  }
  function weekdayCode(dateString){
    const dte=new Date(`${dateString}T12:00:00`);
    return ['SU','M','T','W','TH','F','SA'][dte.getDay()];
  }
  function splitBySex(students){
    return{
      male:students.filter(s=>s.sex==='Male'),
      female:students.filter(s=>s.sex==='Female')
    };
  }
  function studentIsRegisteredAtEnd(s,bounds){
    const st=String(s.enrollment_status||'Active').toLowerCase();
    if((st==='dropped'||st==='transferred out'||st==='archived')&&s.status_effective_date&&s.status_effective_date<=bounds.end)return false;
    return true;
  }
  function movementCount(students,prefix,status){
    const wanted=status.toLowerCase();
    return students.filter(s=>String(s.enrollment_status||'').toLowerCase()===wanted&&(
      inSelectedMonth(s.status_effective_date,prefix)||
      (wanted==='transferred in'&&inSelectedMonth(s.date_enrolled,prefix))
    )).length;
  }
  function lateEnrollmentCount(students,prefix){
    return students.filter(s=>inSelectedMonth(s.date_enrolled,prefix)&&String(s.enrollment_status||'Active').toLowerCase()==='active').length;
  }
  function baselineForStudents(students,d){
    const hasMale=students.some(s=>s.sex==='Male'),hasFemale=students.some(s=>s.sex==='Female');
    const maleRaw=d.c.enrollment_baseline_male,femaleRaw=d.c.enrollment_baseline_female;
    const maleOk=maleRaw!==null&&maleRaw!==undefined&&Number.isFinite(Number(maleRaw))&&Number(maleRaw)>=0;
    const femaleOk=femaleRaw!==null&&femaleRaw!==undefined&&Number.isFinite(Number(femaleRaw))&&Number(femaleRaw)>=0;
    const bm=maleOk?Number(maleRaw):null,bf=femaleOk?Number(femaleRaw):null;
    if(hasMale&&!hasFemale)return maleOk?bm:null;
    if(hasFemale&&!hasMale)return femaleOk?bf:null;
    return maleOk&&femaleOk?bm+bf:null;
  }
  function baselineSetInSelectedMonth(d){return String(d.c.enrollment_baseline_set_at||'').startsWith(d.prefix);}
  function manualSf2Movement(d,sexHint='total'){
    if(!d.sf2Manual)return null;
    const male=d.sf2Manual.male||{},female=d.sf2Manual.female||{};
    if(sexHint==='male')return male;
    if(sexHint==='female')return female;
    return{
      late:Number(male.late||0)+Number(female.late||0),
      transferredIn:Number(male.transferredIn||0)+Number(female.transferredIn||0),
      transferredOut:Number(male.transferredOut||0)+Number(female.transferredOut||0),
      dropped:Number(male.dropped||0)+Number(female.dropped||0)
    };
  }
  function attendanceSummaryFor(students,d,sexHint='total'){
    const ids=new Set(students.map(s=>s.id));
    const records=d.records.filter(r=>ids.has(r.student_id));
    const counts=statusCounts(records);
    // Registered learners are the learners currently shown in the class roster.
    // This keeps the SF2 M/F/TOTAL figures aligned with the actual list.
    const registered=students.length;
    const storedBaseline=baselineForStudents(students,d);
    const manual=manualSf2Movement(d,sexHint);
    let late,transferredIn,transferredOut,dropped;
    if(manual){
      late=Math.max(0,Number(manual.late)||0);
      transferredIn=Math.max(0,Number(manual.transferredIn)||0);
      transferredOut=Math.max(0,Number(manual.transferredOut)||0);
      dropped=Math.max(0,Number(manual.dropped)||0);
    }else{
      late=lateEnrollmentCount(students,d.prefix);
      transferredIn=movementCount(students,d.prefix,'transferred in');
      transferredOut=movementCount(students,d.prefix,'transferred out');
      dropped=movementCount(students,d.prefix,'dropped');
    }
    const fallbackStart=Math.max(0,registered-late-transferredIn+transferredOut+dropped);
    const start=storedBaseline==null?fallbackStart:storedBaseline;

    // SF2 convention: blank = Present and L = Late but still Present.
    // Therefore monthly Present is the number of weekday school-day slots minus X absences.
    const totalPossibleAttendance=registered*d.schoolDays;
    const totalDaily=Math.max(0,totalPossibleAttendance-counts.absent);
    const ada=d.schoolDays?totalDaily/d.schoolDays:0;
    const pctAttendance=registered?ada/registered:0;
    const pctEnrollment=start?registered/start:0;
    return{start,registered,late,transferredIn,transferredOut,dropped,counts,totalDaily,ada,pctAttendance,pctEnrollment};
  }
  function absentFiveConsecutive(students,d){
    let count=0;
    for(const s of students){
      const map=d.byStudent.get(s.id)||new Map();
      let streak=0,hit=false;
      for(const date of (d.schoolDates||d.recordedDates)){
        const rec=map.get(date);
        if(rec?.status==='absent'){streak++;if(streak>=5){hit=true;break;}}
        else streak=0;
      }
      if(hit)count++;
    }
    return count;
  }
  function decodeEmbeddedSf2Template(){
    const b64=window.CLASSCHECK_SF2_TEMPLATE_BASE64;
    if(!b64)throw new Error('The embedded SF2 template is unavailable.');
    const binary=atob(b64);
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return bytes.buffer;
  }
  async function getSf2TemplateBytes(){
    if(!sf2TemplateBytesPromise){
      sf2TemplateBytesPromise=Promise.resolve(decodeEmbeddedSf2Template());
    }
    const original=await sf2TemplateBytesPromise;
    return original.slice(0);
  }

  function xmlEscapeText(value){
    return String(value??'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }
  function patchTemplateCellXml(xml,address,value){
    const escaped=address.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp(`<c\\b([^>]*?\\br="${escaped}"[^>]*?)(?:\\/\\>|>([\\s\\S]*?)<\\/c>)`);
    const m=xml.match(re);
    if(!m)throw new Error(`SF2 template cell ${address} was not found.`);
    let attrs=(m[1]||'')
      .replace(/\s+t="[^"]*"/g,'')
      .replace(/\s+t='[^']*'/g,'')
      .replace(/\s*\/$/,'');
    let replacement;
    if(value===null||value===undefined||value===''){
      replacement=`<c${attrs}/>`;
    }else if(typeof value==='number'&&Number.isFinite(value)){
      replacement=`<c${attrs}><v>${value}</v></c>`;
    }else{
      const textValue=xmlEscapeText(value);
      replacement=`<c${attrs} t="inlineStr"><is><t xml:space="preserve">${textValue}</t></is></c>`;
    }
    return xml.replace(re,replacement);
  }
  function patchManyTemplateCells(xml,entries){
    let out=xml;
    for(const [address,value] of entries)out=patchTemplateCellXml(out,address,value);
    return out;
  }

  // The official SF2 template shipped with ClassCheck has 25 built-in male
  // learner rows and 19 built-in female learner rows.  Those are treated as
  // minimum capacities, not hard limits.  When a class is larger, ClassCheck
  // inserts styled learner rows into the workbook XML and shifts the total,
  // summary and signature blocks downward without changing the form design.
  function sf2DynamicLayout(maleCount,femaleCount){
    const maleExtra=Math.max(0,Number(maleCount||0)-25);
    const femaleExtra=Math.max(0,Number(femaleCount||0)-19);
    const totalExtra=maleExtra+femaleExtra;
    const mapOriginalRow=row=>{
      const n=Number(row);
      if(n>=53)return n+totalExtra;
      if(n>=33)return n+maleExtra;
      return n;
    };
    return{
      maleExtra,femaleExtra,totalExtra,mapOriginalRow,
      maleStart:8,
      maleTotal:33+maleExtra,
      femaleStart:34+maleExtra,
      femaleTotal:53+totalExtra,
      combinedTotal:54+totalExtra,
      summaryStart:55+totalExtra,
      adviserRow:80+totalExtra,
      schoolHeadRow:86+totalExtra,
      finalRow:87+totalExtra
    };
  }

  function sf2RemapRowReference(ref,layout){
    return String(ref).replace(/([A-Z]+)(\d+)/g,(_m,col,row)=>`${col}${layout.mapOriginalRow(Number(row))}`);
  }

  function sf2RemapExistingRowXml(rowXml,newRow){
    let out=String(rowXml);
    out=out.replace(/(<row\b[^>]*?\br=")\d+("[^>]*>)/,`$1${newRow}$2`);
    out=out.replace(/(<c\b[^>]*?\br="[A-Z]+)\d+("[^>]*?)/g,`$1${newRow}$2`);
    return out;
  }

  function sf2BlankLearnerRowClone(sourceXml,sourceRow,targetRow){
    let out=sf2RemapExistingRowXml(sourceXml,targetRow);
    // Keep every style/border attribute but remove the old learner's content.
    out=out.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,(_m,attrs)=>{
      let clean=String(attrs||'').replace(/\s+t=("[^"]*"|'[^']*')/g,'').replace(/\s*\/$/,'');
      clean=clean.replace(new RegExp(`(\\br="[A-Z]+)${targetRow}(\")`),`$1${targetRow}$2`);
      return `<c${clean}/>`;
    });
    return out;
  }

  function sf2ExpandTemplateXml(xml,maleCount,femaleCount){
    const layout=sf2DynamicLayout(maleCount,femaleCount);
    if(!layout.totalExtra)return{xml,layout};

    const sheetDataMatch=xml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
    if(!sheetDataMatch)throw new Error('The SF2 template worksheet rows are unavailable.');
    const originalSheetData=sheetDataMatch[1];
    const rows=[];
    const originalRows=new Map();
    const rowRe=/<row\b[^>]*?\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g;
    let rowMatch;
    while((rowMatch=rowRe.exec(originalSheetData))){
      const originalRow=Number(rowMatch[1]);
      const rowXml=rowMatch[0];
      originalRows.set(originalRow,rowXml);
      rows.push({row:layout.mapOriginalRow(originalRow),xml:sf2RemapExistingRowXml(rowXml,layout.mapOriginalRow(originalRow))});
    }

    const maleSource=originalRows.get(32);
    const femaleSource=originalRows.get(52)||maleSource;
    if(!maleSource||!femaleSource)throw new Error('The SF2 learner-row style could not be copied.');

    for(let i=0;i<layout.maleExtra;i++){
      const row=33+i;
      rows.push({row,xml:sf2BlankLearnerRowClone(maleSource,32,row)});
    }
    for(let i=0;i<layout.femaleExtra;i++){
      const row=53+layout.maleExtra+i;
      rows.push({row,xml:sf2BlankLearnerRowClone(femaleSource,52,row)});
    }
    rows.sort((a,b)=>a.row-b.row);
    xml=xml.replace(sheetDataMatch[0],`<sheetData>${rows.map(item=>item.xml).join('')}</sheetData>`);

    // Remap all existing merged ranges, then give every inserted learner row
    // the same merged-cell pattern as the template learner rows.
    const mergeMatch=xml.match(/<mergeCells\b([^>]*)>([\s\S]*?)<\/mergeCells>/);
    if(!mergeMatch)throw new Error('The SF2 template merged cells are unavailable.');
    const originalMergeRefs=[...mergeMatch[2].matchAll(/<mergeCell\s+ref="([^"]+)"\s*\/>/g)].map(m=>m[1]);
    const remapped=originalMergeRefs.map(ref=>sf2RemapRowReference(ref,layout));
    const learnerMergePattern=originalMergeRefs.filter(ref=>{
      const nums=[...ref.matchAll(/(\d+)/g)].map(m=>Number(m[1]));
      return nums.length&&nums.every(n=>n===32);
    });
    const inserted=[];
    const cloneMergeRow=(ref,target)=>ref.replace(/(\d+)/g,String(target));
    for(let i=0;i<layout.maleExtra;i++)for(const ref of learnerMergePattern)inserted.push(cloneMergeRow(ref,33+i));
    for(let i=0;i<layout.femaleExtra;i++)for(const ref of learnerMergePattern)inserted.push(cloneMergeRow(ref,53+layout.maleExtra+i));
    const allMerges=[...remapped,...inserted];
    const mergeXml=`<mergeCells count="${allMerges.length}">${allMerges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`;
    xml=xml.replace(mergeMatch[0],mergeXml);

    // Extend the worksheet used range so spreadsheet apps include the shifted
    // summary/signature block in print/layout calculations.
    xml=xml.replace(/<dimension\b([^>]*?\bref=")([A-Z]+)(\d+):([A-Z]+)(\d+)("[^>]*\/>)/,(_m,prefix,c1,r1,c2,r2,suffix)=>
      `<dimension${prefix}${c1}${layout.mapOriginalRow(Number(r1))}:${c2}${layout.mapOriginalRow(Number(r2))}${suffix}`
    );
    return{xml,layout};
  }
  async function buildSf2WorkbookExact(d){
    if(!window.JSZip)throw new Error('The SF2 workbook engine is not available. Refresh the page and try again.');
    const bytes=await getSf2TemplateBytes();
    const zip=await JSZip.loadAsync(bytes);
    const sheetPath='xl/worksheets/sheet1.xml';
    const sheetFile=zip.file(sheetPath);
    if(!sheetFile)throw new Error('The converted SF2 template is missing its worksheet.');
    let xml=await sheetFile.async('string');

    const {male,female}=splitBySex(d.students);
    const expanded=sf2ExpandTemplateXml(xml,male.length,female.length);
    xml=expanded.xml;
    const layout=expanded.layout;
    const shifted=row=>layout.mapOriginalRow(row);
    const changes=[];
    const put=(address,value)=>changes.push([address,value]);

    // Header values.  Section/grade/school/adviser are read from the selected
    // ClassCheck class and Teacher Profile; nothing is tied to Beryl.
    put('F3',safe(d.profile.school_id,''));
    put('M3',safe(d.c.school_year||d.profile.school_year,''));
    put('AA3',monthText(d.bounds.year,d.bounds.month-1));
    put('F4',safe(d.profile.school_name,''));
    put('AA4',safe(d.c.grade_level,''));
    put('AM4',safe(d.c.section_name,'').toUpperCase());
    put(`AN${layout.adviserRow}`,safe(d.c.adviser_name||d.profile.full_name,'').toUpperCase());
    put(`AN${layout.schoolHeadRow}`,safe(d.profile.school_head_name,'').toUpperCase());

    const calendarDays=d.calendarDays||monthWeekdayCalendar(d.prefix);
    SF2_DATE_COLUMNS.forEach(col=>put(`${col}6`,''));
    calendarDays.forEach(item=>{
      const col=SF2_DATE_COLUMNS[item.slotIndex];
      if(!col)throw new Error(`The supplied SF2 format has no weekday slot for ${item.date}.`);
      put(`${col}6`,item.day);
    });
    // Preserve row 7 exactly as supplied: M, T, W, TH, F repeated in the original order.

    const clearLearnerRow=(row)=>{
      put(`A${row}`,'');put(`C${row}`,'');
      SF2_DATE_COLUMNS.forEach(col=>put(`${col}${row}`,''));
      put(`AM${row}`,'');put(`AO${row}`,'');put(`AQ${row}`,'');
    };
    for(let row=layout.maleStart;row<layout.maleTotal;row++)clearLearnerRow(row);
    for(let row=layout.femaleStart;row<layout.femaleTotal;row++)clearLearnerRow(row);

    const writeLearner=(student,row,number)=>{
      put(`A${row}`,number);
      put(`C${row}`,sf2LearnerName(student));
      const map=d.byStudent.get(student.id)||new Map();
      let absent=0,present=0;
      calendarDays.forEach(item=>{
        const rec=map.get(item.date);
        let mark='';
        if(rec?.status==='absent'){mark='X';absent++;}
        else if(rec?.status==='late'){mark='L';present++;}
        else if(rec?.status==='present'){present++;}
        put(`${SF2_DATE_COLUMNS[item.slotIndex]}${row}`,mark);
      });
      present=Math.max(0,d.schoolDays-absent);
      put(`AM${row}`,absent);
      put(`AO${row}`,present);
      const remarks=student.remarks||((student.enrollment_status&&student.enrollment_status!=='Active')?student.enrollment_status:'');
      put(`AQ${row}`,remarks||'');
    };
    male.forEach((student,index)=>writeLearner(student,layout.maleStart+index,index+1));
    female.forEach((student,index)=>writeLearner(student,layout.femaleStart+index,index+1));

    const writeTotalRow=(row,label,students)=>{
      put(`A${row}`,students.length);
      put(`C${row}`,label);
      SF2_DATE_COLUMNS.forEach(col=>put(`${col}${row}`,''));
      const ids=new Set(students.map(s=>s.id));
      calendarDays.forEach(item=>{
        const col=SF2_DATE_COLUMNS[item.slotIndex];
        const recs=(d.byDate.get(item.date)||[]).filter(r=>ids.has(r.student_id));
        const absent=recs.filter(r=>r.status==='absent').length;
        put(`${col}${row}`,Math.max(0,students.length-absent));
      });
      const counts=statusCounts(d.records.filter(r=>ids.has(r.student_id)));
      put(`AM${row}`,counts.absent);
      put(`AO${row}`,Math.max(0,(students.length*d.schoolDays)-counts.absent));
      put(`AQ${row}`,'');
    };
    writeTotalRow(layout.maleTotal,'<=== MALE | TOTAL Per Day ===>',male);
    writeTotalRow(layout.femaleTotal,'<=== FEMALE | TOTAL Per Day ===>',female);
    writeTotalRow(layout.combinedTotal,'Combined TOTAL Per Day',d.students);

    // Fill the original SF2 summary/computation block at its shifted location.
    const maleSum=attendanceSummaryFor(male,d,'male');
    const femaleSum=attendanceSummaryFor(female,d,'female');
    const totalSum=attendanceSummaryFor(d.students,d,'total');
    const setTriplet=(originalRow,a,b,total)=>{
      const row=shifted(originalRow);
      put(`AR${row}`,a);put(`AS${row}`,b);put(`AT${row}`,total);
    };
    put(`AM${shifted(55)}`,`Month :
${monthText(d.bounds.year,d.bounds.month-1)}`);
    put(`AP${shifted(55)}`,`No. of Days of Classes:
${d.schoolDays}`);
    setTriplet(57,maleSum.start,femaleSum.start,totalSum.start);
    setTriplet(59,maleSum.late,femaleSum.late,totalSum.late);
    setTriplet(63,maleSum.registered,femaleSum.registered,totalSum.registered);
    setTriplet(65,`${(maleSum.pctEnrollment*100).toFixed(2)}%`,`${(femaleSum.pctEnrollment*100).toFixed(2)}%`,`${(totalSum.pctEnrollment*100).toFixed(2)}%`);
    setTriplet(67,Number(maleSum.ada.toFixed(2)),Number(femaleSum.ada.toFixed(2)),Number(totalSum.ada.toFixed(2)));
    setTriplet(69,`${(maleSum.pctAttendance*100).toFixed(2)}%`,`${(femaleSum.pctAttendance*100).toFixed(2)}%`,`${(totalSum.pctAttendance*100).toFixed(2)}%`);
    setTriplet(70,absentFiveConsecutive(male,d),absentFiveConsecutive(female,d),absentFiveConsecutive(d.students,d));
    setTriplet(71,maleSum.dropped,femaleSum.dropped,totalSum.dropped);
    setTriplet(73,maleSum.transferredOut,femaleSum.transferredOut,totalSum.transferredOut);
    setTriplet(75,maleSum.transferredIn,femaleSum.transferredIn,totalSum.transferredIn);

    xml=patchManyTemplateCells(xml,changes);
    zip.file(sheetPath,xml);
    return zip;
  }

  async function sf2WorkbookBlobExact(zip){
    return zip.generateAsync({
      type:'blob',
      mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      compression:'DEFLATE',
      compressionOptions:{level:6}
    });
  }

  function sf2WorkbookBlob(wb){
    // IMPORTANT: write as XLSX. Re-serializing the original BIFF8 .xls template
    // back to .xls strips/normalizes legacy formatting in browser-side writers.
    // XLSX preserves the template's cell styles, row heights, column widths,
    // merged cells, borders, fills and alignment far more faithfully.
    const bytes=XLSX.write(wb,{bookType:'xlsx',type:'array',cellStyles:true,bookSST:true});
    return new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

  function recolorExistingBorders(ws,color){
    const ref=ws['!ref'];if(!ref)return;
    const range=XLSX.utils.decode_range(ref);
    for(let r=range.s.r;r<=range.e.r;r++)for(let c=range.s.c;c<=range.e.c;c++){
      const address=XLSX.utils.encode_cell({r,c});const cell=ws[address];
      if(!cell?.s?.border)continue;
      const border=cloneStyle(cell.s.border)||{};
      for(const side of ['top','bottom','left','right','diagonal']){
        if(border[side]?.style)border[side].color={rgb:color};
      }
      cell.s={...(cell.s||{}),border};
    }
  }

  async function buildAttendanceWorkbook(d){
    if(!window.XLSX)throw new Error('Excel library is not available.');
    const days=d.calendarDays;
    const width=2+days.length;
    const classTitle=`${safe(d.c.grade_level)} – ${safe(d.c.section_name)}`;
    const sourceTitle=`${safe(d.source.subject)} • ${safe(d.source.teacher_name)}`;
    const register=[
      ['CLASSCHECK | DAILY ATTENDANCE REGISTER'],
      [`Class: ${classTitle}   |   Month: ${monthText(d.bounds.year,d.bounds.month-1)}`],
      [`Attendance source: ${sourceTitle}`],
      ['P = Present    A = Absent    L = Late    — = Not Recorded (no saved mark)'],
      ['Monday–Friday only • Blank/unsaved dates are not counted as present'],
      [],
      ['#','LEARNER NAME',...days.map(day=>`${String(day.day).padStart(2,'0')} ${dayNames[day.dow]}`)]
    ];
    dailyRows(d).forEach(row=>register.push([row.index,row.name,...row.marks]));
    const ws=XLSX.utils.aoa_to_sheet(register);
    ws['!merges']=[0,1,2,3,4].map(r=>({s:{r,c:0},e:{r,c:width-1}}));
    ws['!cols']=[{wch:6},{wch:40},...days.map(()=>({wch:9}))];
    ws['!rows']=[{hpt:29},{hpt:23},{hpt:23},{hpt:22},{hpt:22},{hpt:10},{hpt:34},...d.students.map(()=>({hpt:23}))];
    const right=XLSX.utils.encode_col(width-1);
    const endRow=register.length;
    styleRange(ws,`A1:${right}${endRow}`,{font:{name:'Arial',sz:10,color:{rgb:INK}},alignment:{vertical:'center'},border:maroonBorder});
    styleRange(ws,`A1:${right}1`,{fill:{patternType:'solid',fgColor:{rgb:MAROON}},font:{name:'Arial',bold:true,sz:15,color:{rgb:WHITE}},alignment:{horizontal:'center',vertical:'center'},border:maroonBorder});
    styleRange(ws,`A2:${right}5`,{fill:{patternType:'solid',fgColor:{rgb:BLUSH_LIGHT}},font:{name:'Arial',bold:true,sz:10,color:{rgb:MAROON_DARK}},border:maroonBorder});
    styleRange(ws,`A7:${right}7`,{fill:{patternType:'solid',fgColor:{rgb:MAROON_DARK}},font:{bold:true,color:{rgb:WHITE},sz:9},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:maroonBorder});
    for(let i=0;i<d.students.length;i++){
      const row=8+i;
      const tone=i%2===0?'FFFFFF':'FFF7F8';
      styleRange(ws,`A${row}:${right}${row}`,{fill:{patternType:'solid',fgColor:{rgb:tone}},border:maroonBorder});
      for(let day=0;day<days.length;day++){
        const addr=XLSX.utils.encode_cell({r:row-1,c:day+2});
        const cell=ws[addr]||{t:'s',v:'—'};
        const isAbsent=cell.v==='A',isLate=cell.v==='L',isPresent=cell.v==='P';
        cell.s={...(cell.s||{}),font:{name:'Arial',bold:true,sz:10,color:{rgb:isAbsent?'B42339':isLate?'925C00':isPresent?'126B43':'90838A'}},fill:{patternType:'solid',fgColor:{rgb:isAbsent?'FCE8EC':isLate?'FFF3D7':isPresent?'E8F4EC':tone}},alignment:{horizontal:'center',vertical:'center'},border:maroonBorder};
        ws[addr]=cell;
      }
    }
    ws['!autofilter']={ref:`A7:${right}${endRow}`};
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Daily Attendance');
    return wb;
  }

  function fillSf2Result(d,filename){
    const map={sf2ResultSchool:safe(d.profile.school_name),sf2ResultClass:`${safe(d.c.grade_level)} – ${safe(d.c.section_name)}`,sf2ResultMonth:monthText(d.bounds.year,d.bounds.month-1),sf2ResultSource:`${safe(d.source.subject)} • ${safe(d.source.teacher_name)}`,sf2ResultLearners:String(d.students.length),sf2ResultDays:String(d.schoolDays),sf2ResultAdviser:safe(d.c.adviser_name),sf2ResultSchoolHead:safe(d.profile.school_head_name)};
    Object.entries(map).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.textContent=val;});
    const meta=document.getElementById('sf2ResultMeta');if(meta)meta.textContent=filename;
  }

  function cleanCount(value){
    const n=Math.floor(Number(value)||0);
    return Math.max(0,n);
  }
  function updateSf2BaselineTotal(){
    if(!sf2BaselineTotal)return;
    sf2BaselineTotal.textContent=String(cleanCount(sf2BaselineMale?.value)+cleanCount(sf2BaselineFemale?.value));
  }
  function cacheBaseline(classId,row){
    const cached=AppStorage.get();
    const idx=(cached.classes||[]).findIndex(c=>c.id===classId);
    if(idx>=0)cached.classes[idx]={...cached.classes[idx],...row};
    AppStorage.set(cached,userId);state=cached;
  }
  async function loadSf2BaselineFields(){
    const cid=select.value;
    if(!cid)throw new Error('Choose a class first.');
    state=AppStorage.get();
    let row=state.classes.find(c=>c.id===cid)||null;
    if(!APP_CONFIG.DEMO_MODE){
      const {data,error}=await supa.from('classcheck_classes')
        .select('id,teacher_id,enrollment_baseline_male,enrollment_baseline_female,enrollment_baseline_set_at')
        .eq('id',cid).single();
      if(error)throw error;
      row={...(row||{}),...(data||{})};
      cacheBaseline(cid,row);
    }
    const male=row?.enrollment_baseline_male;
    const female=row?.enrollment_baseline_female;
    if(sf2BaselineMale)sf2BaselineMale.value=String(male==null?0:cleanCount(male));
    if(sf2BaselineFemale)sf2BaselineFemale.value=String(female==null?0:cleanCount(female));
    const editable=APP_CONFIG.DEMO_MODE||row?.teacher_id===userId;
    if(sf2BaselineMale)sf2BaselineMale.disabled=!editable;
    if(sf2BaselineFemale)sf2BaselineFemale.disabled=!editable;
    updateSf2BaselineTotal();
    if(sf2BaselineStatus){
      sf2BaselineStatus.innerHTML=editable
        ? '<strong>Saved baseline:</strong> these values carry to every future month for this class. Edit them here only when the baseline needs correction.'
        : '<strong>Adviser baseline:</strong> these values carry to every future month. Only the class adviser can change them.';
    }
  }
  async function persistSf2BaselineFromModal(){
    const cid=select.value;
    state=AppStorage.get();
    const c=state.classes.find(x=>x.id===cid);
    if(!c)throw new Error('Choose a class first.');
    const male=cleanCount(sf2BaselineMale?.value),female=cleanCount(sf2BaselineFemale?.value);
    if((state.students||[]).some(s=>s.class_id===cid&&!s.archived) && male+female===0){
      throw new Error('Enter the enrolment as of the 1st Friday of June before generating SF2.');
    }
    const oldMale=c.enrollment_baseline_male==null?null:cleanCount(c.enrollment_baseline_male);
    const oldFemale=c.enrollment_baseline_female==null?null:cleanCount(c.enrollment_baseline_female);
    if(c.teacher_id!==userId && !APP_CONFIG.DEMO_MODE){
      if(oldMale!==male||oldFemale!==female)throw new Error('Only the class adviser can update the first-Friday enrolment baseline.');
      return{male,female};
    }
    if(oldMale===male&&oldFemale===female)return{male,female};
    const row={enrollment_baseline_male:male,enrollment_baseline_female:female,enrollment_baseline_set_at:new Date().toISOString()};
    if(!APP_CONFIG.DEMO_MODE){
      const {error}=await supa.rpc('classcheck_set_sf2_baseline',{p_class_id:cid,p_male:male,p_female:female});
      if(error)throw error;
      cacheBaseline(cid,row);
    }else cacheBaseline(cid,row);
    if(sf2BaselineStatus)sf2BaselineStatus.innerHTML='<strong>Saved.</strong> This baseline will be reused automatically for the next month.';
    return{male,female};
  }

  function resetSf2Details(){
    sf2DetailsModal?.querySelectorAll('[data-sf2-kind]').forEach(input=>{input.value='0';});
    sf2DetailsModal?.querySelectorAll('.sf2-detail-toggle').forEach(btn=>btn.setAttribute('aria-expanded','false'));
    sf2DetailsModal?.querySelectorAll('[data-sf2-inputs]').forEach(panel=>panel.classList.add('hidden'));
    sf2DetailsModal?.querySelectorAll('[data-sf2-count]').forEach(badge=>badge.textContent='0');
  }
  function updateSf2DetailCount(kind){
    if(!sf2DetailsModal)return;
    const values=[...sf2DetailsModal.querySelectorAll(`[data-sf2-kind="${kind}"]`)].map(input=>cleanCount(input.value));
    const badge=sf2DetailsModal.querySelector(`[data-sf2-count="${kind}"]`);
    if(badge)badge.textContent=String(values.reduce((a,b)=>a+b,0));
  }
  function readSf2Details(){
    const result={male:{late:0,transferredIn:0,transferredOut:0,dropped:0},female:{late:0,transferredIn:0,transferredOut:0,dropped:0}};
    sf2DetailsModal?.querySelectorAll('[data-sf2-kind]').forEach(input=>{
      const kind=input.dataset.sf2Kind,sex=input.dataset.sf2Sex;
      if(result[sex]&&Object.prototype.hasOwnProperty.call(result[sex],kind))result[sex][kind]=cleanCount(input.value);
    });
    return result;
  }
  function applySf2Details(d,manual){
    d.sf2Manual=manual;
    const summary=attendanceSummaryFor(d.students,d,'total');
    d.registeredEnd=summary.registered;d.enrolmentStart=summary.start;d.lateEnrollment=summary.late;
    d.transferredIn=summary.transferredIn;d.transferredOut=summary.transferredOut;d.dropped=summary.dropped;
    d.totalDailyAttendance=summary.totalDaily;d.averageDailyAttendance=summary.ada;
    d.percentageAttendance=summary.pctAttendance;d.percentageEnrollment=summary.pctEnrollment;
    return d;
  }
  async function refreshSf2Identity(d){
    if(APP_CONFIG.DEMO_MODE)return d;

    // Always read identity fields fresh from Supabase before creating an SF2.
    // This avoids stale local-cache values after the teacher edits Profile.
    const [{data:profile,error:profileError},{data:classRow,error:classError}]=await Promise.all([
      supa.from('classcheck_profiles')
        .select('full_name,school_name,school_head_name,school_id,school_year,region,division,district,position')
        .eq('user_id',userId).single(),
      supa.from('classcheck_classes')
        .select('id,teacher_id,adviser_name')
        .eq('id',d.cid).single()
    ]);
    if(profileError)throw profileError;
    if(classError)throw classError;

    const freshProfile={...(d.profile||{}),...(profile||{})};
    let adviserName=String(classRow?.adviser_name||d.c?.adviser_name||'').trim();
    if(classRow?.teacher_id===userId&&String(freshProfile.full_name||'').trim()){
      adviserName=String(freshProfile.full_name).trim();
    }

    if(!adviserName){
      throw new Error('Add the adviser/teacher Full Name in Teacher Profile before generating SF2.');
    }
    if(!String(freshProfile.school_head_name||'').trim()){
      throw new Error('Add the School Head Name in Teacher Profile, save it, then generate the SF2 again.');
    }

    d.profile=freshProfile;
    d.c={...d.c,...(classRow||{}),adviser_name:adviserName};

    // Refresh the local cache too so the rest of ClassCheck immediately reflects the saved profile.
    const cached=AppStorage.get();
    cached.profile={...(cached.profile||{}),...freshProfile};
    const idx=(cached.classes||[]).findIndex(c=>c.id===d.cid);
    if(idx>=0)cached.classes[idx]={...cached.classes[idx],adviser_name:adviserName};
    AppStorage.set(cached,userId);
    state=cached;
    return d;
  }

  async function generateSf2(manual){
    if(!canGenerateSf2()){App.toast('Only the adviser can generate SF2 using Adviser attendance.');return;}
    try{
      let d,blob,filename;
      await App.withLoading('Generating SF2…','Refreshing the Teacher Profile and adding attendance data to the original SF2 form.',async()=>{
        d=applySf2Details(await collectReportData(),manual);
        if(d.c.teacher_id!==userId||d.source.teacher_id!==userId)throw new Error('SF2 requires your own advisory attendance.');
        d=await refreshSf2Identity(d);
        const wb=await buildSf2WorkbookExact(d);blob=await sf2WorkbookBlobExact(wb);filename=`SF2_${filePart(d.c.grade_level)}_${filePart(d.c.section_name)}_${d.prefix}.xlsx`;
      },{minimum:420});
      if(sf2Download?.url)URL.revokeObjectURL(sf2Download.url);
      sf2Download={url:URL.createObjectURL(blob),filename};fillSf2Result(d,filename);sf2Modal?.classList.remove('hidden');
    }catch(error){console.error(error);App.toast(error?.message||'Unable to generate SF2.');}
  }

  select.onchange=()=>{teacherRefreshSequence++;resetAdviserAccess();renderSources();preview();refreshSharedSources();};
  teacherSelect.onchange=()=>{updateSourcePermissions();preview();};

  document.getElementById('excelBtn').onclick=async()=>{
    try{
      await App.withLoading('Creating daily attendance Excel…','Exporting each student’s saved attendance for every school day.',async()=>{
        const d=await collectReportData();const wb=await buildAttendanceWorkbook(d);const blob=workbookBlob(wb);downloadBlob(blob,`DailyAttendance_${filePart(d.c.section_name)}_${filePart(d.source.subject)}_${d.prefix}.xlsx`);
      },{minimum:320});
      App.toast('Excel attendance export downloaded');
    }catch(error){console.error(error);App.toast(error?.message||'Unable to export Excel.');}
  };

  document.getElementById('sf2Btn').onclick=async()=>{
    if(!canGenerateSf2()){App.toast('SF2 is adviser-only. Select Adviser attendance to continue.');return;}
    if(!select.value||!monthInput.value){App.toast('Choose a class and month first.');return;}
    resetSf2Details();
    try{
      await loadSf2BaselineFields();
      sf2DetailsModal?.classList.remove('hidden');
    }catch(error){console.error(error);App.toast(error?.message||'Unable to load the saved enrolment baseline.');}
  };

  [sf2BaselineMale,sf2BaselineFemale].forEach(input=>input?.addEventListener('input',()=>{
    input.value=String(cleanCount(input.value));updateSf2BaselineTotal();
  }));

  sf2DetailsModal?.querySelectorAll('.sf2-detail-toggle').forEach(btn=>btn.addEventListener('click',()=>{
    const kind=btn.dataset.sf2Detail,panel=sf2DetailsModal.querySelector(`[data-sf2-inputs="${kind}"]`);
    const open=btn.getAttribute('aria-expanded')==='true';
    btn.setAttribute('aria-expanded',String(!open));panel?.classList.toggle('hidden',open);
    if(!open)panel?.querySelector('input')?.focus();
  }));
  sf2DetailsModal?.querySelectorAll('[data-sf2-kind]').forEach(input=>input.addEventListener('input',()=>{
    input.value=String(cleanCount(input.value));updateSf2DetailCount(input.dataset.sf2Kind);
  }));
  sf2DetailsGenerate?.addEventListener('click',async()=>{
    if(!canGenerateSf2()){App.toast('SF2 is only available for the class adviser’s attendance.');return;}
    try{
      sf2DetailsGenerate.disabled=true;
      await persistSf2BaselineFromModal();
      const manual=readSf2Details();
      sf2DetailsModal?.classList.add('hidden');
      await generateSf2(manual);
    }catch(error){console.error(error);App.toast(error?.message||'Unable to save the SF2 enrolment baseline.');}
    finally{sf2DetailsGenerate.disabled=false;}
  });
  const closeSf2Details=()=>sf2DetailsModal?.classList.add('hidden');
  sf2DetailsClose?.addEventListener('click',closeSf2Details);
  sf2DetailsCancel?.addEventListener('click',closeSf2Details);
  sf2DetailsModal?.addEventListener('click',e=>{if(e.target===sf2DetailsModal)closeSf2Details();});

  sf2DownloadBtn?.addEventListener('click',()=>{
    if(!sf2Download)return;
    const a=document.createElement('a');a.href=sf2Download.url;a.download=sf2Download.filename;document.body.appendChild(a);a.click();a.remove();App.toast('SF2 download started');
  });
  sf2CloseBtn?.addEventListener('click',()=>sf2Modal?.classList.add('hidden'));
  sf2Modal?.addEventListener('click',e=>{if(e.target===sf2Modal)sf2Modal.classList.add('hidden');});

  document.addEventListener('classcheck:panelchange',e=>{if(e.detail?.panel==='reports'){state=AppStorage.get();populateClasses();resetAdviserAccess();renderSources();preview();refreshSharedSources();}});
  renderSources();syncMonthUI();preview();refreshSharedSources();
});
