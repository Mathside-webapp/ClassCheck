document.addEventListener('DOMContentLoaded',async()=>{
  let ctx;
  try{ctx=await AppBoot.ready();}catch(err){console.error(err);return;}
  if(!App.isUnified())App.nav('calendar');
  const supa=Supa.getClient();const userId=ctx.user.id;
  let cursor=new Date();cursor.setDate(1);
  let state=AppStorage.get();const grid=document.getElementById('calendarGrid'),label=document.getElementById('calendarPageMonthLabel');
  function iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  async function monthSessions(year,month){
    const local=(await OfflineDB.all('sessions')).filter(s=>{const d=new Date(`${s.attendance_date}T12:00:00`);return s.teacher_id===userId&&d.getFullYear()===year&&d.getMonth()===month&&s.status==='completed';});
    const map=new Map(local.map(s=>[`${s.teacher_id}_${s.class_id}_${s.attendance_date}`,s]));
    if(navigator.onLine&&!APP_CONFIG.DEMO_MODE){
      const first=`${year}-${String(month+1).padStart(2,'0')}-01`;const next=new Date(year,month+1,1);const upper=iso(next);
      const {data,error}=await supa.from('classcheck_attendance_sessions').select('teacher_id,class_id,attendance_date,session_status,subject,updated_at').eq('teacher_id',userId).eq('session_status','completed').gte('attendance_date',first).lt('attendance_date',upper);
      if(!error)for(const s of data||[]){const item={...s,key:`${s.teacher_id}_${s.class_id}_${s.attendance_date}`,status:'completed'};if(!map.has(item.key)){map.set(item.key,item);await OfflineDB.put('sessions',item);}}
      else console.warn('Calendar refresh failed',error);
    }
    return [...map.values()];
  }
  async function render(){
    const year=cursor.getFullYear(),month=cursor.getMonth();label.textContent=cursor.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const start=new Date(year,month,1),end=new Date(year,month+1,0),prev=new Date(year,month,0).getDate(),cells=[];const sessions=await monthSessions(year,month);
    for(let i=0;i<42;i++){
      const delta=i-start.getDay()+1;let d,muted=false;if(delta<1){d=prev+delta;muted=true}else if(delta>end.getDate()){d=delta-end.getDate();muted=true}else d=delta;
      let dayIso='';if(!muted)dayIso=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const complete=sessions.some(s=>s.attendance_date===dayIso&&s.status==='completed'),today=dayIso===App.fmtDate();
      cells.push(`<a ${dayIso?`href="attendance.html?date=${dayIso}&class=${state.classes.find(c=>!c.archived)?.id||''}"`:''} class="cal-day ${muted?'muted':''} ${complete?'complete':''} ${today?'today':''}"><span class="num">${d}</span>${complete?'<span class="dot"></span>':''}</a>`);
    }
    grid.innerHTML=cells.join('');
  }
  document.getElementById('prevMonth').onclick=()=>{cursor.setMonth(cursor.getMonth()-1);render();};document.getElementById('nextMonth').onclick=()=>{cursor.setMonth(cursor.getMonth()+1);render();};
  document.addEventListener('classcheck:panelchange',e=>{if(e.detail?.panel==='calendar'){state=AppStorage.get();render();}});
  render();
});
