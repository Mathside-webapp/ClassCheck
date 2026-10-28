(function(){
  const esc=v=>App.escapeHtml(v);let dialog,stream,frame,run=0,priorFocus;
  function stop(){run++;cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());stream=null;}
  function close(){stop();dialog?.close();dialog?.remove();dialog=null;priorFocus?.focus();}
  function shell(title,body){close();priorFocus=document.activeElement;dialog=document.createElement('dialog');dialog.className='cc-qr-dialog';dialog.innerHTML=`<header><h2>${title}</h2><button class="icon-btn" id="qrClose" aria-label="Close">×</button></header>${body}`;document.body.append(dialog);dialog.querySelector('#qrClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.showModal();return dialog;}
  function payload(student){return 'CLASSCHECK:1:'+student.id;}
  function openCards(){
    const state=AppStorage.get(),classes=state.classes.filter(c=>!c.archived);
    const d=shell('Student QR cards',`<p>Each card belongs to one learner. Print once; the same card works offline on devices with this roster loaded.</p><label>Class<select id="qrClass">${classes.map(c=>`<option value="${esc(c.id)}">${esc(c.grade_level+' · '+c.section_name)}</option>`).join('')}</select></label><button class="btn primary" id="qrPrint">Print cards</button><div id="qrCards" class="cc-qr-cards"></div>`);
    function render(){const students=state.students.filter(s=>s.class_id===d.querySelector('#qrClass').value&&!s.archived);d.querySelector('#qrCards').innerHTML=students.map(s=>{const qr=qrcode(0,'M');qr.addData(payload(s));qr.make();return `<article class="cc-qr-card"><small>CLASSCHECK · STUDENT PASS</small>${qr.createSvgTag({cellSize:4,margin:16,scalable:true}).replace('xMinYMin meet','xMidYMid meet')}<b>${esc(App.studentName(s))}</b><span>${esc(classes.find(c=>c.id===s.class_id)?.section_name||'')}</span></article>`;}).join('')||'<p>No learners in this class yet.</p>';d.querySelector('#qrPrint').disabled=!students.length;}
    d.querySelector('#qrClass').onchange=render;d.querySelector('#qrPrint').onclick=()=>window.print();render();
  }
  function openScanner(){
    const api=window.ClassCheckAttendance;
    if(!api){App.toast('Attendance is still loading. Please try again.');return;}
    const context=api.context(),state=AppStorage.get(),c=state.classes.find(c=>c.id===context.classId);
    if(!c){App.toast('Create or select a class first.');return;}
    const d=shell('Scan attendance',`<p><b>${esc(c.grade_level+' · '+c.section_name)}</b><br>${esc(App.longDate(context.date))}</p><p class="cc-qr-warning">Check the date before scanning. ClassCheck keeps its weekday-only attendance rule.</p><label>Mark scanned learners as<select id="qrStatus"><option value="present">Present</option><option value="late">Late</option></select></label><div class="cc-camera"><video id="qrVideo" playsinline muted></video><span>Position the student QR inside the camera view</span></div><div class="dash-actions"><button class="btn primary" id="qrStart">Start camera</button><button class="btn soft" id="qrStop">Stop camera</button></div><p id="qrResult" role="status" aria-live="polite">Camera is off. QR processing stays on your device.</p><details><summary>Use a USB scanner or paste a QR value</summary><form id="qrManual"><label>QR value<input id="qrValue" required placeholder="CLASSCHECK:1:…" autocomplete="off"></label><button class="btn soft">Record learner</button></form></details><p class="dash-footnote">All learners are Present by default. Scans explicitly save Present or Late. Repeated scans do not overwrite a saved status; use the attendance list for corrections.</p>`);
    const video=d.querySelector('video'),result=d.querySelector('#qrResult');let busy=false,last='',lastAt=0;
    async function accept(raw){if(busy)return;busy=true;try{if(!raw.startsWith('CLASSCHECK:1:'))throw new Error('Not a ClassCheck student QR.');const current=api.context();if(current.classId!==context.classId||current.date!==context.date)throw new Error('Class or date changed. Reopen the scanner.');const out=await api.scan(raw.slice(13),d.querySelector('#qrStatus').value);result.textContent=`${App.studentName(out.student)} — ${out.duplicate?'already recorded; no change':'saved on this device'}.`;if(!out.duplicate)navigator.vibrate?.(60);}catch(e){result.textContent=e.message;}finally{busy=false;}}
    d.querySelector('#qrManual').onsubmit=async e=>{e.preventDefault();await accept(d.querySelector('#qrValue').value.trim());d.querySelector('#qrValue').value='';};
    d.querySelector('#qrStop').onclick=()=>{stop();result.textContent='Camera stopped.';d.querySelector('#qrStart').disabled=false;};
    d.querySelector('#qrStart').onclick=async()=>{
      stop();const token=run;d.querySelector('#qrStart').disabled=true;
      try{
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera needs HTTPS or localhost. You can also use a USB QR scanner.');
        const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:640}},audio:false});
        if(token!==run){media.getTracks().forEach(t=>t.stop());return;}
        stream=media;video.srcObject=stream;await video.play();result.textContent='Camera ready. Show a student QR.';
        const canvas=document.createElement('canvas'),g=canvas.getContext('2d',{willReadFrequently:true});let tick=0;
        function scan(time){if(token!==run)return;if(video.readyState>=2&&time-tick>180){tick=time;canvas.width=640;canvas.height=Math.round(640*video.videoHeight/video.videoWidth);g.drawImage(video,0,0,canvas.width,canvas.height);const img=g.getImageData(0,0,canvas.width,canvas.height),code=jsQR(img.data,img.width,img.height,{inversionAttempts:'dontInvert'});if(code&&(code.data!==last||Date.now()-lastAt>2500)){last=code.data;lastAt=Date.now();accept(code.data);}}frame=requestAnimationFrame(scan);}frame=requestAnimationFrame(scan);
      }catch(e){stop();result.textContent=e.name==='NotAllowedError'?'Camera permission denied. Allow camera access or use a USB scanner.':e.message;d.querySelector('#qrStart').disabled=false;}
    };
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&stream){stop();const b=dialog?.querySelector('#qrStart');if(b)b.disabled=false;}});
  document.addEventListener('classcheck:panelchange',()=>{if(dialog)close();});window.addEventListener('pagehide',stop);
  document.addEventListener('DOMContentLoaded',()=>{const summary=document.getElementById('attendanceSummary');if(summary){const bar=document.createElement('div');bar.className='cc-qr-toolbar';bar.innerHTML='<button class="btn primary" id="attendanceQR">Scan student QR</button><button class="btn soft" id="attendanceCards">Student QR cards</button>';summary.after(bar);bar.querySelector('#attendanceQR').onclick=openScanner;bar.querySelector('#attendanceCards').onclick=openCards;}});
  window.ClassCheckQR={openScanner,openCards,payload};
})();
