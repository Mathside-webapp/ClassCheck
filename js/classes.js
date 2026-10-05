document.addEventListener('DOMContentLoaded',async()=>{
  let ctx;
  try{ctx=await AppBoot.ready();}catch(err){console.error(err);return;}
  if(!App.isUnified())App.nav('classes');
  const supa=Supa.getClient();
  const userId=ctx.user.id;
  let state=AppStorage.get();
  let sf1Rows=[];
  let currentFilter='active';
  const selectedStudentIds=new Set();
  const list=document.getElementById('classList');
  const classModal=document.getElementById('classModal');
  const joinModal=document.getElementById('joinClassModal');
  const roster=document.getElementById('rosterModal');
  const sf1Preview=document.getElementById('sf1PreviewModal');

  function saveCache(){AppStorage.set(state,userId);}
  function refreshState(){state=AppStorage.get();}
  function activeStudents(classId){return state.students.filter(s=>s.class_id===classId&&!s.archived);}
  function isAdviser(c){return c?.teacher_id===userId;}
  function membership(classId){return (state.classTeachers||[]).find(m=>m.class_id===classId&&m.teacher_id===userId);}
  function subjectTeachers(classId){return (state.classTeachers||[]).filter(m=>m.class_id===classId);}
  function roleText(c){const m=membership(c.id);return isAdviser(c)?'Class adviser':(m?`Subject teacher • ${m.subject}`:'Shared class');}
  function currentRosterStudents(classId){return activeStudents(classId).sort((a,b)=>App.studentName(a).localeCompare(App.studentName(b),undefined,{sensitivity:'base'}));}

  function filteredClasses(){
    if(currentFilter==='archived')return state.classes.filter(c=>c.archived);
    if(currentFilter==='shared')return state.classes.filter(c=>!c.archived&&!isAdviser(c)&&membership(c.id));
    return state.classes.filter(c=>!c.archived);
  }

  function render(){
    refreshState();
    document.querySelectorAll('[data-class-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.classFilter===currentFilter));
    const rows=filteredClasses();
    list.innerHTML=rows.map(c=>{
      const count=activeStudents(c.id).length;
      const adviser=isAdviser(c);
      const archived=c.archived;
      const action=archived&&adviser
        ? '<button class="btn primary restore-class" type="button">Restore</button>'
        : `<button class="btn soft open-roster" type="button">${archived?'View':'Open'}</button>`;
      return `<div class="card class-card ${archived?'is-archived':''}" data-id="${c.id}"><div class="class-badge">${c.section_name.slice(0,2).toUpperCase()}</div><div class="class-info"><h3>${c.grade_level} – ${c.section_name}</h3><p>${count} learners • ${roleText(c)}${archived?' • Archived':''}</p></div>${action}</div>`;
    }).join('')||`<div class="card empty">${currentFilter==='archived'?'No archived classes.':'No classes here yet.'}</div>`;
    document.querySelectorAll('.open-roster').forEach(btn=>btn.onclick=e=>openRoster(e.target.closest('[data-id]').dataset.id));
    document.querySelectorAll('.restore-class').forEach(btn=>btn.onclick=e=>setClassArchived(e.target.closest('[data-id]').dataset.id,false));
  }

  function updateRosterBulkUI(classId,adviser){
    const toolbar=document.getElementById('rosterBulkToolbar');
    const selectAll=document.getElementById('selectAllStudents');
    const countEl=document.getElementById('selectedStudentCount');
    const deleteBtn=document.getElementById('deleteSelectedStudentsBtn');
    if(!toolbar||!selectAll||!countEl||!deleteBtn)return;
    toolbar.classList.toggle('hidden',!adviser);
    const shown=currentRosterStudents(classId);
    const shownIds=shown.map(s=>s.id);
    const count=shownIds.filter(id=>selectedStudentIds.has(id)).length;
    countEl.textContent=`${count} selected`;
    deleteBtn.disabled=count===0;
    selectAll.checked=shownIds.length>0&&count===shownIds.length;
    selectAll.indeterminate=count>0&&count<shownIds.length;
  }

  async function deleteStudents(ids){
    const classId=roster.dataset.classId;if(!classId)return;
    const c=state.classes.find(x=>x.id===classId);if(!isAdviser(c)){App.toast('Only the class adviser can delete learners.');return;}
    const unique=[...new Set((Array.isArray(ids)?ids:[ids]).filter(Boolean))];
    if(!unique.length)return;
    const count=unique.length;
    const ok=await App.confirmAction({
      title:count===1?'Delete this learner?':`Delete ${count} learners?`,
      message:count===1
        ?'This permanently removes the learner from this class. Attendance records for this learner in this class will also be deleted.'
        :'This permanently removes the selected learners from this class. Their attendance records in this class will also be deleted.',
      confirmText:count===1?'Delete learner':`Delete ${count} learners`,danger:true
    });
    if(!ok)return;
    try{
      await App.withLoading(count===1?'Deleting learner…':`Deleting ${count} learners…`,'Removing the selected roster data and related attendance records.',async()=>{
        const {error}=await supa.rpc('classcheck_delete_students',{p_class_id:classId,p_student_ids:unique});
        if(error)throw error;
      },{minimum:320});
      const removed=new Set(unique);
      state.students=state.students.filter(s=>!removed.has(s.id));
      unique.forEach(id=>selectedStudentIds.delete(id));
      saveCache();
      await openRoster(classId,false);
      render();
      App.toast(count===1?'Learner deleted':`${count} learners deleted`);
    }catch(error){console.error(error);App.toast('Unable to delete the selected learner(s).');}
  }

  async function openRoster(id,resetSelection=true){
    refreshState();
    const c=state.classes.find(x=>x.id===id);if(!c)return;
    const adviser=isAdviser(c);const m=membership(id);
    if(resetSelection)selectedStudentIds.clear();
    const students=currentRosterStudents(id);
    roster.classList.remove('hidden');roster.dataset.classId=id;
    roster.querySelector('.modal-title').textContent=`${c.grade_level} – ${c.section_name}`;
    document.getElementById('rosterRoleMeta').textContent=adviser?'You are the class adviser.':`Shared roster • ${m?.subject||'Subject teacher'}`;
    roster.querySelector('.roster-body').innerHTML=students.map(s=>`<div class="student-row ${selectedStudentIds.has(s.id)?'is-selected':''}">${adviser?`<label class="roster-row-check"><input type="checkbox" class="student-select" data-id="${s.id}" ${selectedStudentIds.has(s.id)?'checked':''}><span class="sr-only">Select ${App.studentName(s)}</span></label>`:''}<div class="student-avatar">${s.last_name[0]||'?'}</div><div class="student-main"><b>${App.studentName(s)}</b><small>${s.sex} • ${s.lrn||'No LRN'}</small></div>${adviser?`<button class="btn danger del-student" data-id="${s.id}">Delete</button>`:''}</div>`).join('')||'<div class="empty">No learners yet.</div>';

    const sharePanel=document.getElementById('sharePanel');
    const subjectPanel=document.getElementById('subjectTeachersPanel');
    const tools=document.getElementById('adviserRosterTools');
    sharePanel.classList.toggle('hidden',!adviser);subjectPanel.classList.toggle('hidden',!adviser);tools.classList.toggle('hidden',!adviser);
    const archiveBtn=document.getElementById('archiveClassBtn');
    const leaveBtn=document.getElementById('leaveClassBtn');
    if(archiveBtn){archiveBtn.classList.toggle('hidden',!adviser);archiveBtn.textContent=c.archived?'Restore class':'Archive class';archiveBtn.onclick=()=>setClassArchived(id,!c.archived);}
    if(leaveBtn){leaveBtn.classList.toggle('hidden',adviser||!m);leaveBtn.onclick=()=>leaveClass(id);}
    updateRosterBulkUI(id,adviser);
    if(adviser){
      const {data:code,error:codeError}=await supa.rpc('classcheck_get_join_code',{p_class_id:id});
      document.getElementById('classJoinCode').textContent=codeError?'Unavailable':(code||'------');
      const teachers=subjectTeachers(id);
      document.getElementById('subjectTeachersList').innerHTML=teachers.map(t=>`<div class="shared-teacher-row"><div><b>${t.teacher_name||'Teacher'}</b><small>${t.subject}</small></div><span class="tag">Joined</span></div>`).join('')||'<div class="empty compact-empty">No subject teachers have joined yet.</div>';
      roster.querySelectorAll('.del-student').forEach(b=>b.onclick=()=>deleteStudents(b.dataset.id));
      roster.querySelectorAll('.student-select').forEach(box=>box.onchange=()=>{
        if(box.checked)selectedStudentIds.add(box.dataset.id);else selectedStudentIds.delete(box.dataset.id);
        box.closest('.student-row')?.classList.toggle('is-selected',box.checked);
        updateRosterBulkUI(id,true);
      });
    }
  }

  document.getElementById('addClassBtn').onclick=()=>classModal.classList.remove('hidden');
  document.getElementById('joinClassBtn').onclick=()=>joinModal.classList.remove('hidden');
  document.querySelectorAll('[data-class-filter]').forEach(btn=>btn.onclick=()=>{currentFilter=btn.dataset.classFilter||'active';render();});
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('.modal').classList.add('hidden'));

  document.getElementById('selectAllStudents').onchange=e=>{
    const id=roster.dataset.classId;if(!id)return;
    currentRosterStudents(id).forEach(s=>e.currentTarget.checked?selectedStudentIds.add(s.id):selectedStudentIds.delete(s.id));
    openRoster(id,false);
  };
  document.getElementById('deleteSelectedStudentsBtn').onclick=()=>{
    const id=roster.dataset.classId;if(!id)return;
    const ids=currentRosterStudents(id).map(s=>s.id).filter(studentId=>selectedStudentIds.has(studentId));
    deleteStudents(ids);
  };

  document.getElementById('copyCodeBtn').onclick=async()=>{
    const code=document.getElementById('classJoinCode').textContent.trim();
    try{await navigator.clipboard.writeText(code);App.toast('Class code copied');}
    catch{App.toast(`Class code: ${code}`);}
  };

  document.getElementById('classForm').onsubmit=async e=>{
    e.preventDefault();
    const submit=e.target.querySelector('button[type="submit"]');
    if(submit)submit.disabled=true;
    const fd=new FormData(e.target);
    const grade=String(fd.get('grade')||'').trim();
    const section=String(fd.get('section')||'').trim();
    if(!section){App.toast('Please enter a section name.');if(submit)submit.disabled=false;return;}
    try{
      const created=await App.withLoading('Creating your class…','Preparing the advisory roster and its share code.',async()=>{
        // Always read the current profile before creating a class. This avoids stale pre-V9 cached state.
        const profile=await Supa.ensureProfile(ctx.user);
        await Supa.ensureProfile(ctx.user);
        const {data:classId,error}=await supa.rpc('classcheck_create_class',{p_grade_level:grade,p_section_name:section});
        if(error)throw error;
        await Supa.loadState(ctx,true);
        const fresh=AppStorage.get();
        return fresh.classes.find(c=>c.id===classId)||{id:classId};
      },{minimum:420});
      refreshState();
      classModal.classList.add('hidden');
      e.target.reset();
      render();
      const {data:code,error:codeError}=await supa.rpc('classcheck_get_join_code',{p_class_id:created.id});
      App.toast(!codeError&&code?`Class created • code ${code}`:'Class created');
    }catch(error){
      console.error('CREATE CLASS ERROR',error);
      App.toast(error?.message?`Unable to create class: ${error.message}`:'Unable to create class.');
    }finally{if(submit)submit.disabled=false;}
  };

  document.getElementById('joinClassForm').onsubmit=async e=>{
    e.preventDefault();
    const submit=e.target.querySelector('button[type="submit"]')||e.submitter||e.target.querySelector('button');
    if(submit)submit.disabled=true;
    const fd=new FormData(e.target);
    const code=String(fd.get('code')||'').trim().toUpperCase().replace(/\s+/g,'');
    const subject=String(fd.get('subject')||'').trim();
    if(code.length!==6){App.toast('Enter the 6-character class code.');if(submit)submit.disabled=false;return;}
    if(!subject){App.toast('Enter the subject you teach.');if(submit)submit.disabled=false;return;}
    try{
      await App.withLoading('Joining class…','Linking the shared roster to your subject.',async()=>{
        // Ensure this account has a current ClassCheck profile before joining.
        await Supa.ensureProfile(ctx.user);
        const {data,error}=await supa.rpc('classcheck_join_class',{p_code:code,p_subject:subject});
        if(error)throw error;
        await Supa.loadState(ctx,true);
        return data;
      },{minimum:420});
      refreshState();
      joinModal.classList.add('hidden');
      e.target.reset();
      render();
      App.toast(`Joined class as ${subject} teacher`);
    }catch(error){
      console.error('JOIN CLASS ERROR',error);
      const message=error?.message?.replace(/^Database error:\s*/i,'')||'Unable to join that class.';
      App.toast(`Unable to join class: ${message}`);
    }finally{if(submit)submit.disabled=false;}
  };

  document.getElementById('addStudentForm').onsubmit=async e=>{
    e.preventDefault();
    const id=roster.dataset.classId;
    if(!id){App.toast('Open a class before adding a learner.');return;}
    refreshState();
    const c=state.classes.find(x=>x.id===id);
    if(!isAdviser(c)){App.toast('Only the class adviser can add learners.');return;}
    const submit=e.target.querySelector('button[type="submit"]');
    if(submit)submit.disabled=true;
    const fd=new FormData(e.target);
    const last=String(fd.get('last')||'').trim().toUpperCase();
    const first=String(fd.get('first')||'').trim();
    if(!last||!first){App.toast('Enter the learner’s first and last name.');if(submit)submit.disabled=false;return;}
    try{
      await App.withLoading('Adding learner…','Saving the learner to this class roster.',async()=>{
        const {error}=await supa.rpc('classcheck_add_student',{
          p_class_id:id,
          p_lrn:String(fd.get('lrn')||'').trim()||null,
          p_last_name:last,
          p_first_name:first,
          p_middle_name:String(fd.get('middle')||'').trim()||null,
          p_name_extension:null,
          p_sex:String(fd.get('sex')||'')
        });
        if(error)throw error;
        await Supa.loadState(ctx,true);
      },{minimum:320});
      refreshState();
      e.target.reset();
      await openRoster(id,false);
      render();
      App.toast('Learner added');
    }catch(error){
      console.error('ADD LEARNER ERROR',error);
      App.toast(error?.code==='23505'?'That LRN already exists in this class.':(error?.message?`Unable to add learner: ${error.message}`:'Unable to add learner.'));
    }finally{if(submit)submit.disabled=false;}
  };

  function norm(v){return String(v??'').replace(/\s+/g,' ').trim();}
  function normalizeSex(v){const s=norm(v).toLowerCase().replace(/\./g,'');if(['m','male','boy'].includes(s))return'Male';if(['f','female','girl'].includes(s))return'Female';return'';}
  function looksLikeLrn(v){return /^\d{12}$/.test(norm(v).replace(/[^0-9]/g,''));}
  function looksLikeStudentName(v){const t=norm(v);if(t.length<2||!/[A-Za-zÀ-ÿÑñ]/.test(t))return false;if(/^(name|student|learner|lrn|sex|gender|birth|age|address|father|mother|guardian|remarks|total|combined)/i.test(t))return false;return true;}
  function parseName(name){
    const raw=norm(name);if(!raw)return null;
    const comma=raw.split(',').map(norm).filter(Boolean);
    if(comma.length>=3){
      const last=comma[0].toUpperCase();const first=comma[1];const tail=comma.slice(2).join(' ').trim();
      const extMatch=tail.match(/^(JR\.?|SR\.?|II|III|IV|V)\b\s*(.*)$/i);
      return{last,first,middle:extMatch?norm(extMatch[2]):tail,extension:extMatch?extMatch[1].toUpperCase():''};
    }
    if(comma.length===2){
      const last=comma[0].toUpperCase();const tokens=comma[1].split(/\s+/).filter(Boolean);let middle='';
      if(tokens.length>1&&(/^[A-ZÑ]\.?$/i.test(tokens.at(-1))||/^[A-ZÑ][A-ZÑ]?\.?$/i.test(tokens.at(-1))))middle=tokens.pop();
      return{last,first:tokens.join(' ')||comma[1],middle,extension:''};
    }
    const tokens=raw.split(/\s+/).filter(Boolean);if(tokens.length<2)return null;
    return{last:tokens.shift().toUpperCase(),first:tokens.join(' '),middle:'',extension:''};
  }
  function findStudentHeader(rows){
    const limit=Math.min(rows.length,90);
    for(let r=0;r<limit;r++){
      const cells=(rows[r]||[]).map(norm);const n=cells.map(v=>v.toLowerCase());
      const lrnCol=n.findIndex(v=>/^lrn\b/.test(v)||v.includes('learner reference'));
      const nameCol=n.findIndex(v=>/^name\b/.test(v)||/^(student|learner)\s+name\b/.test(v)||/^full\s+name\b/.test(v)||v.includes('name of learner')||(v.includes('last name')&&v.includes('first name')));
      const sexCol=n.findIndex(v=>/^sex\b/.test(v)||/^gender\b/.test(v));
      if(nameCol>=0&&(lrnCol>=0||sexCol>=0))return{row:r,lrnCol,nameCol,sexCol};
    }
    return null;
  }
  function findStructuredColumns(rows){
    const result={lastCol:-1,firstCol:-1,middleCol:-1,extCol:-1,lrnCol:-1,sexCol:-1,lastRow:-1,firstRow:-1,middleRow:-1,extRow:-1,lrnRow:-1,sexRow:-1};
    for(let r=0;r<Math.min(rows.length,90);r++){
      (rows[r]||[]).forEach((cell,c)=>{
        const t=norm(cell).toLowerCase();if(!t)return;
        if(result.lrnCol<0&&(/^lrn\b/.test(t)||t.includes('learner reference'))){result.lrnCol=c;result.lrnRow=r;}
        if(result.sexCol<0&&(/^sex\b/.test(t)||/^gender\b/.test(t))){result.sexCol=c;result.sexRow=r;}
        const hasLast=/last\s*name/.test(t),hasFirst=/first\s*name/.test(t),hasMiddle=/middle\s*name/.test(t),hasExt=t.includes('name extension')||t.includes('name ext')||t==='extension';
        const labelCount=[hasLast,hasFirst,hasMiddle,hasExt].filter(Boolean).length;
        if(labelCount>1)return;
        if(result.lastCol<0&&hasLast){result.lastCol=c;result.lastRow=r;}
        if(result.firstCol<0&&hasFirst){result.firstCol=c;result.firstRow=r;}
        if(result.middleCol<0&&hasMiddle){result.middleCol=c;result.middleRow=r;}
        if(result.extCol<0&&hasExt){result.extCol=c;result.extRow=r;}
      });
    }
    if(result.lastCol<0||result.firstCol<0||result.lastCol===result.firstCol)return null;
    return result;
  }
  function extractStudentRecordsFromRows(sourceRows){
    const rows=(sourceRows||[]).map(row=>Array.isArray(row)?row:[]);
    const sampleText=rows.slice(0,90).flat().map(norm).join(' ').toUpperCase();
    const header=findStudentHeader(rows);const structured=findStructuredColumns(rows);
    const isSf1=sampleText.includes('SCHOOL FORM 1')||sampleText.includes('SCHOOL REGISTER')||sampleText.includes('LRN')||Boolean(header?.lrnCol>=0)||Boolean(structured?.lrnCol>=0);
    const records=[];
    if(isSf1){
      let groupGender='Male';
      const headerRows=[header?.row,structured?.lastRow,structured?.firstRow,structured?.middleRow,structured?.extRow,structured?.lrnRow,structured?.sexRow].filter(v=>Number.isInteger(v)&&v>=0);
      const firstDataRow=headerRows.length?Math.max(...headerRows)+1:0;
      for(let r=firstDataRow;r<rows.length;r++){
        const row=rows[r]||[];const cells=row.map(norm);const rowText=cells.join(' ').toUpperCase();
        if(rowText.includes('TOTAL MALE')){groupGender='Female';continue;}
        if(rowText.includes('TOTAL FEMALE')||rowText.includes('COMBINED'))break;
        let lrnCol=structured?.lrnCol??header?.lrnCol??-1;
        if(lrnCol<0||!looksLikeLrn(cells[lrnCol]))lrnCol=cells.findIndex(looksLikeLrn);
        if(lrnCol<0)continue;
        const lrn=norm(cells[lrnCol]).replace(/[^0-9]/g,'');
        let parsed=null;
        if(structured&&structured.lastCol!==structured.firstCol&&looksLikeStudentName(cells[structured.lastCol])&&looksLikeStudentName(cells[structured.firstCol])){
          parsed={last:norm(cells[structured.lastCol]).toUpperCase(),first:norm(cells[structured.firstCol]),middle:structured.middleCol>=0?norm(cells[structured.middleCol]):'',extension:structured.extCol>=0?norm(cells[structured.extCol]):''};
        }else{
          let combined=header?.nameCol>=0?norm(cells[header.nameCol]):'';
          if(!looksLikeStudentName(combined)){
            for(let c=lrnCol+1;c<Math.min(cells.length,lrnCol+7);c++){
              if(looksLikeStudentName(cells[c])&&!normalizeSex(cells[c])){combined=cells[c];break;}
            }
          }
          parsed=parseName(combined);
        }
        if(!parsed?.last||!parsed?.first)continue;
        let sexCol=structured?.sexCol??header?.sexCol??-1;
        let sex=sexCol>=0?normalizeSex(cells[sexCol]):'';
        if(!sex)sex=cells.map(normalizeSex).find(Boolean)||groupGender;
        if(!sex)continue;
        records.push({lrn:lrn||null,last_name:parsed.last,first_name:parsed.first,middle_name:parsed.middle||null,name_extension:parsed.extension||null,sex});
      }
      if(records.length)return{records,format:'DepEd SF1'};
    }
    if(header?.nameCol>=0){
      for(let r=header.row+1;r<rows.length;r++){
        const row=rows[r]||[];const parsed=parseName(row[header.nameCol]);if(!parsed?.last||!parsed?.first)continue;
        const sex=header.sexCol>=0?normalizeSex(row[header.sexCol]):'';if(!sex)continue;
        const lrn=header.lrnCol>=0?norm(row[header.lrnCol]).replace(/[^0-9]/g,''):'';
        records.push({lrn:lrn||null,last_name:parsed.last,first_name:parsed.first,middle_name:parsed.middle||null,name_extension:parsed.extension||null,sex});
      }
      if(records.length)return{records,format:'Excel learner list'};
    }
    return{records:[],format:'Unknown'};
  }
  function parseCsv(text){
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;continue;}
      if(ch===','&&!quoted){row.push(cell);cell='';continue;}
      if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';continue;}
      cell+=ch;
    }
    if(cell||row.length){row.push(cell);rows.push(row);}return rows;
  }
  async function ensureXlsx(){
    if(window.XLSX)return window.XLSX;
    for(let i=0;i<25;i++){await App.sleep(120);if(window.XLSX)return window.XLSX;}
    throw new Error('The Excel reader could not load. Check your connection and try again.');
  }
  async function parseSf1(file){
    const isCsv=/\.csv$/i.test(file.name)||file.type==='text/csv';
    if(isCsv){const parsed=extractStudentRecordsFromRows(parseCsv(await file.text()));return parsed.records;}
    await ensureXlsx();
    const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellDates:false});
    let best={records:[],format:'Unknown',sheetName:''};
    for(const sheetName of wb.SheetNames||[]){const ws=wb.Sheets[sheetName];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});const parsed=extractStudentRecordsFromRows(rows);if(parsed.records.length>best.records.length)best={...parsed,sheetName};}
    return best.records;
  }
  function setSf1Status(message,type=''){
    const el=document.getElementById('sf1ImportStatus');if(!el)return;el.textContent=message;el.classList.remove('error','success');if(type)el.classList.add(type);
  }

  document.getElementById('sf1File').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    setSf1Status(`Reading ${file.name}…`);
    try{
      sf1Rows=await App.withLoading('Reading SF1…','Finding learner names, LRNs, and sex from the uploaded file.',()=>parseSf1(file),{minimum:220});
      if(!sf1Rows.length)throw new Error('No learner rows were detected. Use the official DepEd SF1 .xls/.xlsx file, or a list with LRN, Name and Sex/Gender columns.');
      setSf1Status(`${sf1Rows.length} learners detected from ${file.name}. Review the preview before importing.`,'success');
      document.getElementById('sf1PreviewMeta').textContent=`${sf1Rows.length} learners found • ${file.name}`;
      document.getElementById('sf1PreviewBody').innerHTML=sf1Rows.slice(0,30).map((r,i)=>`<tr><td>${i+1}</td><td>${r.lrn||'—'}</td><td>${r.last_name}, ${r.first_name}${r.name_extension?' '+r.name_extension:''}${r.middle_name?' '+r.middle_name:''}</td><td>${r.sex}</td></tr>`).join('')+(sf1Rows.length>30?`<tr><td colspan="4">+ ${sf1Rows.length-30} more learners</td></tr>`:'');
      sf1Preview.classList.remove('hidden');
    }catch(error){console.error('SF1 IMPORT ERROR',error);sf1Rows=[];setSf1Status(error.message||'Unable to read this SF1 file.','error');App.toast(error.message||'Unable to read this SF1 file.');}
    finally{e.target.value='';}
  });

  document.getElementById('confirmSf1Import').onclick=async()=>{
    const classId=roster.dataset.classId;if(!classId||!sf1Rows.length)return;
    const c=state.classes.find(x=>x.id===classId);if(!isAdviser(c))return;
    const existing=activeStudents(classId);const lrnSet=new Set(existing.map(s=>norm(s.lrn)).filter(Boolean));const nameSet=new Set(existing.map(s=>`${norm(s.last_name).toUpperCase()}|${norm(s.first_name).toUpperCase()}|${norm(s.middle_name).toUpperCase()}`));
    const baselineSet=c.enrollment_baseline_male!==null&&c.enrollment_baseline_male!==undefined&&c.enrollment_baseline_female!==null&&c.enrollment_baseline_female!==undefined;
    const toInsert=sf1Rows.filter(r=>!(r.lrn&&lrnSet.has(r.lrn))&&!nameSet.has(`${r.last_name.toUpperCase()}|${r.first_name.toUpperCase()}|${norm(r.middle_name).toUpperCase()}`)).map(r=>({...r,teacher_id:userId,class_id:classId,date_enrolled:baselineSet?App.fmtDate():null,enrollment_status:'Active',archived:false}));
    if(!toInsert.length){App.toast('All learners in this SF1 are already in the class.');sf1Preview.classList.add('hidden');return;}
    try{
      const imported=await App.withLoading('Importing SF1 roster…',`Adding ${toInsert.length} learners to this class.`,async()=>{
        const payload=toInsert.map(({lrn,last_name,first_name,middle_name,name_extension,sex})=>({lrn,last_name,first_name,middle_name,name_extension,sex}));
        const {data,error}=await supa.rpc('classcheck_import_students',{p_class_id:classId,p_students:payload});
        if(error)throw error;
        await Supa.loadState(ctx,true);
        return Number(data||0);
      },{minimum:520});
      refreshState();sf1Rows=[];sf1Preview.classList.add('hidden');openRoster(classId);render();App.toast(`${imported} learners imported from SF1`);
    }catch(error){console.error(error);App.toast('Unable to import the SF1 roster.');}
  };

  async function setClassArchived(id,archived){
    const c=state.classes.find(x=>x.id===id);
    if(!c||!isAdviser(c)){App.toast('Only the class adviser can archive or restore this class.');return;}
    const label=archived?'Archive':'Restore';
    const ok=await App.confirmAction({
      title:`${label} this class?`,
      message:archived?'The class will move to Archived. Learners and attendance records are kept. You can restore it anytime.':'The class will return to your active classes with its learners and attendance history intact.',
      confirmText:label,danger:false
    });
    if(!ok)return;
    try{
      await App.withLoading(`${label}ing class…`,'Updating the class without deleting its records.',async()=>{
        const {error}=await supa.rpc('classcheck_set_class_archived',{p_class_id:id,p_archived:archived});
        if(error)throw error;
        await Supa.loadState(ctx,true);
      },{minimum:300});
      refreshState();
      roster.classList.add('hidden');
      if(!archived)currentFilter='active';
      render();
      App.toast(archived?'Class archived':'Class restored');
    }catch(error){console.error(error);App.toast(error?.message||`Unable to ${archived?'archive':'restore'} this class.`);}
  }

  async function leaveClass(id){
    const c=state.classes.find(x=>x.id===id);
    if(!c||isAdviser(c)){App.toast('The adviser cannot leave their own class.');return;}
    const ok=await App.confirmAction({
      title:'Leave this class?',
      message:'This removes the shared roster from your ClassCheck account. Your own attendance records stay in the class database for the adviser unless the adviser deletes the class.',
      confirmText:'Leave class',danger:true
    });
    if(!ok)return;
    try{
      await App.withLoading('Leaving class…','Removing your subject-teacher membership.',async()=>{
        const {error}=await supa.rpc('classcheck_leave_class',{p_class_id:id});
        if(error)throw error;
        await Supa.loadState(ctx,true);
      },{minimum:300});
      refreshState();roster.classList.add('hidden');render();App.toast('You left the class');
    }catch(error){console.error(error);App.toast(error?.message||'Unable to leave this class.');}
  }

  document.getElementById('deleteClassBtn').onclick=async()=>{
    const id=roster.dataset.classId;if(!id)return;
    const c=state.classes.find(x=>x.id===id);if(!isAdviser(c)){App.toast('Only the adviser can delete this class.');return;}
    const learnerCount=activeStudents(id).length;
    const ok=await App.confirmAction({
      title:'Delete this class permanently?',
      message:`${c.grade_level} – ${c.section_name} will be permanently deleted. This also removes ${learnerCount} learner${learnerCount===1?'':'s'}, shared-teacher links, and all attendance records for this class. This cannot be undone.`,
      confirmText:'Delete class',danger:true
    });
    if(!ok)return;
    try{
      await App.withLoading('Deleting class…','Removing the roster, shared links, and attendance history for this class.',async()=>{
        const {error}=await supa.rpc('classcheck_delete_class',{p_class_id:id});if(error)throw error;
      },{minimum:420});
      state.classes=state.classes.filter(x=>x.id!==id);
      state.students=state.students.filter(s=>s.class_id!==id);
      state.classTeachers=(state.classTeachers||[]).filter(m=>m.class_id!==id);
      state.sessions=(state.sessions||[]).filter(x=>x.class_id!==id);
      state.records=(state.records||[]).filter(x=>x.class_id!==id);
      selectedStudentIds.clear();saveCache();roster.classList.add('hidden');render();App.toast('Class deleted');
    }catch(error){console.error(error);App.toast('Unable to delete this class.');}
  };

  document.addEventListener('classcheck:panelchange',e=>{if(e.detail?.panel==='classes')render();});
  render();
});
