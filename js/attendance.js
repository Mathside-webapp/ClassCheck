document.addEventListener('DOMContentLoaded',async()=>{
  let ctx;
  try{ctx=await AppBoot.ready();}catch(err){console.error(err);return;}
  if(!App.isUnified())App.nav('attendance');
  const supa=Supa.getClient();
  const userId=ctx.user.id;
  let state=AppStorage.get();
  let params=App.routeParams();
  const dateInput=document.getElementById('dateInput');
  const dateRail=document.getElementById('dateRail');
  const dateDeck=document.querySelector('.date-deck');
  const monthPickerBtn=document.getElementById('monthPickerBtn');
  const calendarDrawer=document.getElementById('calendarDrawer');
  const calendarDays=document.getElementById('calendarDays');
  const calendarTodayBtn=document.getElementById('calendarTodayBtn');
  const calendarDoneBtn=document.getElementById('calendarDoneBtn');
  const classRail=document.getElementById('classRail');
  const monthLabel=document.getElementById('monthLabel');
  const selectedDateText=document.getElementById('selectedDateText');
  const list=document.getElementById('studentList');
  const title=document.getElementById('attendanceTitle');
  const summary=document.getElementById('attendanceSummary');
  const syncBadge=document.getElementById('syncBadge');
  let activeClasses=state.classes.filter(c=>!c.archived);
  let selectedClassId=params.get('class')||activeClasses[0]?.id||'';

  function isWeekendDate(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;
    const d=new Date(`${value}T12:00:00`);
    return d.getDay()===0||d.getDay()===6;
  }
  function previousSchoolDate(value){
    const d=new Date(`${value}T12:00:00`);
    while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()-1);
    return dateKey(d.getFullYear(),d.getMonth(),d.getDate());
  }
  function normalizeSchoolDate(value){
    return isWeekendDate(value)?previousSchoolDate(value):value;
  }

  let selectedDate=normalizeSchoolDate(params.get('date')||App.fmtDate());
  let displayMonth=new Date(`${selectedDate}T12:00:00`);
  displayMonth.setDate(1);
  let records={};
  let attendanceLoading=0;
  let loadVersion=0;
  let storageError=null;
  function subjectForClass(classId){
    const c=state.classes.find(x=>x.id===classId);
    if(!c)return 'Advisory';
    if(c.teacher_id===userId)return 'Advisory';
    return (state.classTeachers||[]).find(m=>m.class_id===classId&&m.teacher_id===userId)?.subject||'Subject';
  }

  dateInput.value=selectedDate;

  function setSync(type,count=0){
    syncBadge.className='sync-badge';
    if(type==='storage-error' || storageError || SyncManagerApp.storageError()){
      syncBadge.classList.add('offline');
      syncBadge.textContent='Device save failed';
      syncBadge.title=storageError||SyncManagerApp.storageError()||'Device storage is unavailable';
    }else if(type==='offline'){
      syncBadge.classList.add('offline');
      syncBadge.textContent=`Offline • ${count} waiting`;
    }else if(type==='syncing'){
      syncBadge.textContent=`Syncing ${count}…`;
    }else if(type==='synced'){
      syncBadge.classList.add('synced');
      syncBadge.textContent='✓ All synced';
    }else if(type==='failed'){
      syncBadge.textContent=`Sync failed • ${count} waiting`;
    }else if(type==='demo'){
      syncBadge.textContent='Demo • saved on device';
    }else{
      syncBadge.textContent='Saved on device';
    }
  }
  SyncManagerApp.onState(s=>setSync(s.type,s.count));

  function daysInMonth(d){return new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}
  function dateKey(year,month,day){return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`}

  function renderDates(){
    const year=displayMonth.getFullYear();
    const month=displayMonth.getMonth();
    monthLabel.textContent=displayMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const max=daysInMonth(displayMonth);
    const todayKey=App.fmtDate();
    let html='';
    for(let day=1;day<=max;day++){
      const key=dateKey(year,month,day);
      const d=new Date(year,month,day);
      const weekday=d.toLocaleDateString(undefined,{weekday:'short'}).toUpperCase();
      const isSelected=key===selectedDate;
      const isToday=key===todayKey;
      const weekend=d.getDay()===0||d.getDay()===6;
      html+=`<button class="date-chip ${isSelected?'selected':''} ${isToday?'today':''} ${weekend?'weekend disabled':''}" data-date="${key}" type="button" aria-pressed="${isSelected}" ${weekend?'disabled aria-disabled="true" title="Weekend attendance is not allowed"':''}><small>${weekday}</small><strong>${day}</strong>${isToday?'<i>Today</i>':''}</button>`;
    }
    dateRail.innerHTML=html;
    dateRail.querySelectorAll('.date-chip:not([disabled])').forEach(btn=>btn.onclick=async()=>{
      selectedDate=btn.dataset.date;
      dateInput.value=selectedDate;
      renderDates();
      await load();
      requestAnimationFrame(()=>scrollSelectedDate());
    });
    requestAnimationFrame(()=>scrollSelectedDate());
  }

  function scrollSelectedDate(){
    dateRail.querySelector('.date-chip.selected')?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
  }

  function setCalendarOpen(open){
    calendarDrawer.classList.toggle('open',open);
    calendarDrawer.setAttribute('aria-hidden',String(!open));
    monthPickerBtn.setAttribute('aria-expanded',String(open));
    if(open) renderCalendarDrawer();
  }

  function renderCalendarDrawer(){
    const year=displayMonth.getFullYear();
    const month=displayMonth.getMonth();
    const firstWeekday=new Date(year,month,1).getDay();
    const monthDays=daysInMonth(displayMonth);
    const previousMonthDays=new Date(year,month,0).getDate();
    const todayKey=App.fmtDate();
    let html='';

    for(let slot=0;slot<42;slot++){
      let cellYear=year;
      let cellMonth=month;
      let day;
      let outside=false;

      if(slot<firstWeekday){
        day=previousMonthDays-firstWeekday+slot+1;
        cellMonth=month-1;
        outside=true;
      }else if(slot>=firstWeekday+monthDays){
        day=slot-firstWeekday-monthDays+1;
        cellMonth=month+1;
        outside=true;
      }else{
        day=slot-firstWeekday+1;
      }

      if(cellMonth<0){cellMonth=11;cellYear--;}
      if(cellMonth>11){cellMonth=0;cellYear++;}
      const key=dateKey(cellYear,cellMonth,day);
      const date=new Date(cellYear,cellMonth,day);
      const weekend=date.getDay()===0||date.getDay()===6;
      const selected=key===selectedDate;
      const today=key===todayKey;
      html+=`<button type="button" role="gridcell" class="calendar-day-button ${outside?'outside':''} ${weekend?'weekend disabled':''} ${today?'today':''} ${selected?'selected':''}" data-date="${key}" aria-selected="${selected}" aria-label="${App.longDate(key)}${today?' (Today)':''}${weekend?' (Weekend — attendance disabled)':''}" ${weekend?'disabled aria-disabled="true" title="Weekend attendance is not allowed"':''}><span>${day}</span></button>`;
    }

    calendarDays.innerHTML=html;
    calendarDays.querySelectorAll('.calendar-day-button:not([disabled])').forEach(btn=>btn.onclick=async()=>{
      selectedDate=btn.dataset.date;
      dateInput.value=selectedDate;
      displayMonth=new Date(`${selectedDate}T12:00:00`);
      displayMonth.setDate(1);
      renderDates();
      renderCalendarDrawer();
      await load();
      requestAnimationFrame(()=>scrollSelectedDate());
      setCalendarOpen(false);
    });
  }

  function renderClasses(){
    classRail.innerHTML=activeClasses.map(c=>`<button type="button" class="class-pill ${c.id===selectedClassId?'selected':''}" data-class="${c.id}" aria-pressed="${c.id===selectedClassId}">${c.grade_level}<b>${c.section_name}</b><small>${subjectForClass(c.id)}</small></button>`).join('');
    classRail.querySelectorAll('.class-pill').forEach(btn=>btn.onclick=async()=>{
      selectedClassId=btn.dataset.class;
      renderClasses();
      await load();
      requestAnimationFrame(()=>classRail.querySelector('.class-pill.selected')?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}));
    });
  }

  // Local-first: tapping a radio option must never wait on a cloud request.
  async function load(){
    const version=++loadVersion;
    const classId=selectedClassId;
    const date=selectedDate;
    attendanceLoading++;
    try{
      records={};
      const c=activeClasses.find(x=>x.id===classId);
      if(title)title.textContent=c?`${c.grade_level} – ${c.section_name}`:'Attendance';
      const subjectBadge=document.getElementById('attendanceSubjectBadge');
      if(subjectBadge)subjectBadge.textContent=subjectForClass(classId);
      selectedDateText.textContent=App.longDate(date);
      if(!classId){
        list.innerHTML='<div class="empty">Create a class first to take attendance.</div>';
        summary.textContent='0 present • 0 absent • 0 late';
        return;
      }
      if(typeof window.OfflineDB?.saveQueued!=='function')throw new Error('Offline storage update is incomplete. Reopen ClassCheck while online.');
      const saved=await OfflineDB.attendanceFor(classId,date,userId);
      if(version!==loadVersion)return;
      saved.forEach(r=>records[r.student_id]=r);
      renderStudents();
      const pending=(await OfflineDB.all('syncQueue')).filter(x=>x.payload?.teacher_id===userId).length;
      if(version===loadVersion)setSync(navigator.onLine?(pending?'saved-local':'synced'):'offline',pending);
    }catch(err){
      console.error('Unable to open locally saved attendance',err);
      if(version===loadVersion){
        list.innerHTML='<div class="empty">Device storage is unavailable. Check browser storage permissions, then try again.</div>';
        storageError=err.message;setSync('storage-error');
        App.toast('Could not read attendance stored on this device.');
      }
    }finally{attendanceLoading--;}
    if(navigator.onLine&&!APP_CONFIG.DEMO_MODE){
      // Fire and forget. Even a hung or unavailable Supabase endpoint cannot
      // prevent offline selections or make the attendance screen unresponsive.
      refreshFromCloud(classId,date,version).catch(err=>console.warn('Attendance cloud refresh unavailable',err));
    }
  }

  async function refreshFromCloud(classId,date,version){
    let timer;
    const cloudQuery=supa.from('classcheck_attendance_records')
      .select('teacher_id,class_id,student_id,attendance_date,status,note,subject,client_updated_at,updated_at')
      .eq('teacher_id',userId).eq('class_id',classId).eq('attendance_date',date);
    const result=await Promise.race([
      cloudQuery,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Cloud attendance request timed out')),5000);})
    ]).finally(()=>clearTimeout(timer));
    if(result.error)throw result.error;
    if(version!==loadVersion)return;
    const pendingIds=new Set((await OfflineDB.all('syncQueue'))
      .filter(x=>x.type==='attendance_upsert'&&x.payload?.teacher_id===userId)
      .map(x=>x.id));
    for(const r of result.data||[]){
      if(version!==loadVersion)return;
      const key=`${r.teacher_id}_${r.class_id}_${r.student_id}_${r.attendance_date}`;
      const queueId=`attendance_${key}`;
      if(pendingIds.has(queueId))continue;
      const existing=await OfflineDB.get('attendance',key);
      if(existing?.client_updated_at&&Date.parse(existing.client_updated_at)>Date.parse(r.client_updated_at||r.updated_at||0))continue;
      // A new mark could have been queued while IndexedDB was being read.
      if(await OfflineDB.get('syncQueue',queueId))continue;
      await OfflineDB.put('attendance',{...r,key});
    }
    if(version!==loadVersion)return;
    const saved=await OfflineDB.attendanceFor(classId,date,userId);
    if(version!==loadVersion)return;
    const upToDate={};
    saved.forEach(r=>upToDate[r.student_id]=r);
    records=upToDate;
    renderStudents();
  }

  function statusLabel(status){
    if(status==='absent')return 'Absent';
    if(status==='late')return 'Late';
    return 'Present';
  }

  function renderStudents(){
    const students=state.students
      .filter(s=>s.class_id===selectedClassId&&!s.archived)
      .sort((a,b)=>App.studentName(a).localeCompare(App.studentName(b)));

    if(!students.length){
      list.innerHTML='<div class="empty">No learners in this class yet.</div>';
      updateSummary(0);
      return;
    }

    const normalizeSex=s=>String(s.sex||'').trim().toLowerCase();
    const groups=[
      {key:'male',label:'Males',students:students.filter(s=>normalizeSex(s)==='male'||normalizeSex(s)==='m')},
      {key:'female',label:'Females',students:students.filter(s=>normalizeSex(s)==='female'||normalizeSex(s)==='f')}
    ];
    const knownIds=new Set(groups.flatMap(group=>group.students.map(s=>s.id)));
    const other=students.filter(s=>!knownIds.has(s.id));
    if(other.length)groups.push({key:'other',label:'Other learners',students:other});

    let learnerNumber=0;
    list.innerHTML=groups.filter(group=>group.students.length).map(group=>{
      const rows=group.students.map(s=>{
        learnerNumber+=1;
        // No saved exception means Present. Do not upload a default until Finish.
        const st=records[s.id]?.status||'present';
        const radios=['present','absent','late'].map(status=>`<label class="status-radio ${status} ${st===status?'checked':''}"><input type="radio" name="status-${s.id}" value="${status}" ${st===status?'checked':''}><span class="radio-dot"></span><span>${statusLabel(status)}</span></label>`).join('');
        return `<article class="student-row ${st}" data-id="${s.id}">
          <div class="student-avatar">${learnerNumber}</div>
          <div class="student-main"><b>${App.escapeHtml(App.studentName(s))}</b></div>
          <div class="status-radio-group" role="radiogroup" aria-label="Attendance for ${App.escapeHtml(App.studentName(s))}">${radios}</div>
        </article>`;
      }).join('');
      return `<section class="learner-group learner-group-${group.key}" aria-labelledby="learner-group-${group.key}">
        <div class="learner-group-heading">
          <div class="learner-group-title-wrap"><h3 id="learner-group-${group.key}">${group.label}</h3></div>
          <span class="learner-group-count">${group.students.length} ${group.students.length===1?'learner':'learners'}</span>
        </div>
        <div class="learner-group-list">${rows}</div>
      </section>`;
    }).join('');

    list.querySelectorAll('input[type="radio"]').forEach(input=>input.onchange=async e=>{
      if(!e.target.checked)return;
      const row=e.target.closest('.student-row');
      const value=e.target.value;
      row.classList.remove('unmarked','present','absent','late');
      row.classList.add(value);
      row.querySelectorAll('.status-radio').forEach(label=>label.classList.toggle('checked',label.querySelector('input')?.checked));
      const task=save(row.dataset.id,value);
      savingTasks.add(task);
      try{await task;}catch(err){
        storageError=err.message;setSync('storage-error');
        App.toast('Could not save on this device: '+err.message);
        // Revert the optimistic radio selection to the last COMMITTED value.
        renderStudents();
      }finally{savingTasks.delete(task);}
    });
    updateSummary(students.length);
  }

  function updateSummary(total){
    // Count only learners in this class, not records from another date/class.
    // A missing record represents Present until the full register is completed.
    const learnerIds=new Set(state.students.filter(s=>s.class_id===selectedClassId&&!s.archived).map(s=>s.id));
    const current=Object.entries(records).filter(([id])=>learnerIds.has(id));
    const absent=current.filter(([,r])=>r.status==='absent').length;
    const late=current.filter(([,r])=>r.status==='late').length;
    const present=Math.max(0,total-absent-late);
    summary.textContent=`${present} present • ${absent} absent • ${late} late`;
  }

  async function save(studentId,status){
    if(isWeekendDate(selectedDate)){
      App.toast('Saturday and Sunday attendance is not allowed.');
      return;
    }
    const rec={
      key:`${userId}_${selectedClassId}_${studentId}_${selectedDate}`,
      teacher_id:userId,
      class_id:selectedClassId,
      student_id:studentId,
      attendance_date:selectedDate,
      status,
      subject:subjectForClass(selectedClassId),
      note:null,
      client_updated_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    };
    await SyncManagerApp.queueAttendance(rec);
    storageError=null;
    // Do not replace the entire list after each tap: touch controls stay usable.
    if(selectedClassId===rec.class_id&&selectedDate===rec.attendance_date){
      records[studentId]=rec;
      updateSummary(state.students.filter(s=>s.class_id===selectedClassId&&!s.archived).length);
    }
    const count=(await OfflineDB.all('syncQueue')).filter(x=>x.payload?.teacher_id===userId).length;
    setSync(navigator.onLine?'saved-local':'offline',count);
  }

  document.getElementById('prevMonthBtn').onclick=()=>{
    displayMonth=new Date(displayMonth.getFullYear(),displayMonth.getMonth()-1,1);
    const max=daysInMonth(displayMonth);
    const currentDay=Math.min(Number(selectedDate.slice(-2)),max);
    selectedDate=normalizeSchoolDate(dateKey(displayMonth.getFullYear(),displayMonth.getMonth(),currentDay));
    dateInput.value=selectedDate;
    renderDates();
    renderCalendarDrawer();
    load();
  };

  document.getElementById('nextMonthBtn').onclick=()=>{
    displayMonth=new Date(displayMonth.getFullYear(),displayMonth.getMonth()+1,1);
    const max=daysInMonth(displayMonth);
    const currentDay=Math.min(Number(selectedDate.slice(-2)),max);
    selectedDate=normalizeSchoolDate(dateKey(displayMonth.getFullYear(),displayMonth.getMonth(),currentDay));
    dateInput.value=selectedDate;
    renderDates();
    renderCalendarDrawer();
    load();
  };

  monthPickerBtn.onclick=()=>setCalendarOpen(!calendarDrawer.classList.contains('open'));
  calendarDoneBtn.onclick=()=>setCalendarOpen(false);
  calendarTodayBtn.onclick=async()=>{
    const today=App.fmtDate();
    selectedDate=normalizeSchoolDate(today);
    if(selectedDate!==today)App.toast('Weekend attendance is not allowed. Showing the previous school day.');
    dateInput.value=selectedDate;
    displayMonth=new Date(`${selectedDate}T12:00:00`);
    displayMonth.setDate(1);
    renderDates();
    renderCalendarDrawer();
    await load();
    requestAnimationFrame(()=>scrollSelectedDate());
  };

  document.addEventListener('click',e=>{
    if(calendarDrawer.classList.contains('open')&&!dateDeck.contains(e.target))setCalendarOpen(false);
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&calendarDrawer.classList.contains('open')){
      setCalendarOpen(false);
      monthPickerBtn.focus();
    }
  });

  let finishing=false;
  const savingTasks=new Set();
  document.getElementById('finishBtn').onclick=async()=>{
    if(finishing)return;
    finishing=true;
    const finishButton=document.getElementById('finishBtn');
    finishButton.disabled=true;
    try{
      // A tap followed immediately by Finish must not race the device write.
      const pendingResults=await Promise.allSettled([...savingTasks]);
      if(pendingResults.some(result=>result.status==='rejected')){
        App.toast('A mark could not be saved. Please retry the change before finishing.');
        return;
      }
    if(!selectedClassId)return;
    if(isWeekendDate(selectedDate)){
      App.toast('Saturday and Sunday attendance is not allowed.');
      return;
    }
    const students=state.students.filter(s=>s.class_id===selectedClassId&&!s.archived);
    // Every learner is Present unless a saved Absent or Late exception exists.
    // Finish writes the entire register, including untouched Present learners.
    const now=new Date().toISOString();
    try{
    for(const s of students){
      const rec=records[s.id]||{
        key:`${userId}_${selectedClassId}_${s.id}_${selectedDate}`,teacher_id:userId,class_id:selectedClassId,student_id:s.id,attendance_date:selectedDate,status:'present',subject:subjectForClass(selectedClassId),note:null,client_updated_at:now
      };
      records[s.id]=rec;
      await SyncManagerApp.queueAttendance(rec);
    }
    const key=`${userId}_${selectedClassId}_${selectedDate}`;
    const session={key,teacher_id:userId,class_id:selectedClassId,attendance_date:selectedDate,session_status:'completed',status:'completed',subject:subjectForClass(selectedClassId),notes:null,client_updated_at:now,updated_at:now};
    await SyncManagerApp.queueSession(session);
    // Completion is local-first too; cloud sync runs separately without blocking.
    SyncManagerApp.flush().catch(err=>console.warn('Background sync unavailable',err));
    renderStudents();
    const pending=(await OfflineDB.all('syncQueue')).some(x=>x.payload.teacher_id===userId);
    App.toast(pending?'Attendance saved on device. Sync pending.':'Attendance completed and synced.');
    }catch(err){
      storageError=err.message;setSync('storage-error');
      App.toast('Attendance completion could not be saved on this device. Please retry.');
    }
    }finally{finishing=false;finishButton.disabled=false;}
  };


  document.addEventListener('classcheck:panelchange',async e=>{
    if(e.detail?.panel!=='attendance')return;
    state=AppStorage.get();
    activeClasses=state.classes.filter(c=>!c.archived);
    params=e.detail.params||App.routeParams();
    const routeClass=params.get('class');
    const routeDate=params.get('date');
    if(routeClass&&activeClasses.some(c=>c.id===routeClass))selectedClassId=routeClass;
    else if(!activeClasses.some(c=>c.id===selectedClassId))selectedClassId=activeClasses[0]?.id||'';
    if(routeDate&&/^\d{4}-\d{2}-\d{2}$/.test(routeDate)){
      selectedDate=normalizeSchoolDate(routeDate);
      if(selectedDate!==routeDate)App.toast('Weekend attendance is not allowed. Showing the previous school day.');
    }
    dateInput.value=selectedDate;
    displayMonth=new Date(`${selectedDate}T12:00:00`);displayMonth.setDate(1);
    renderClasses();renderDates();await load();
  });

  window.ClassCheckAttendance={
    context:()=>({classId:selectedClassId,date:selectedDate,userId}),
    scan:async(studentId,status)=>{
      if(attendanceLoading)throw new Error("Attendance is loading. Scan again in a moment.");
      if(!["present","late"].includes(status))throw new Error("Invalid scan status.");
      const student=state.students.find(s=>s.id===studentId&&s.class_id===selectedClassId&&!s.archived);
      if(!student)throw new Error('This QR does not belong to a learner in the selected class.');
      if(isWeekendDate(selectedDate))throw new Error('Weekend attendance is disabled.');
      if(records[studentId])return {student,duplicate:true};
      await save(studentId,status);return {student,duplicate:false};
    }
  };
  renderClasses();
  renderDates();
  await load();
  await SyncManagerApp.flush();
});
