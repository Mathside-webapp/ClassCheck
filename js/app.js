(function(){
  function qs(s,p=document){return p.querySelector(s)}
  function qsa(s,p=document){return [...p.querySelectorAll(s)]}
  function fmtDate(d=new Date()){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function longDate(date){return new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
  function studentName(s){return `${s.last_name}, ${s.first_name}${s.name_extension?' '+s.name_extension:''}${s.middle_name?' '+s.middle_name:''}`}
  function toast(msg){let el=qs('.toast');if(el)el.remove();el=document.createElement('div');el.className='toast';el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),2400)}
  function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

  const icons={
    home:'<path d="M3 10.8 12 3l9 7.8v9.2a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    attendance:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    report:'<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    'arrow-left':'<path d="m15 18-6-6 6-6"/>',
    'chevron-left':'<path d="m15 18-6-6 6-6"/>',
    'chevron-right':'<path d="m9 18 6-6-6-6"/>',
    'chevron-down':'<path d="m6 9 6 6 6-6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    close:'<path d="M6 6l12 12M18 6 6 18"/>',
    'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/>',
    'clipboard-check':'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 13l2 2 4-4"/>',
    download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'
  };
  function icon(name,cls=''){
    return `<svg class="svg-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.attendance}</svg>`;
  }
  function hydrateIcons(root=document){
    qsa('[data-icon]',root).forEach(el=>{
      const name=el.dataset.icon;
      if(!el.querySelector('svg')) el.innerHTML=icon(name);
    });
  }

  let loadingDepth=0;
  function ensureSystemUi(){
    if(!document.getElementById('ccActionLoading')){
      document.body.insertAdjacentHTML('beforeend',`
        <div id="ccActionLoading" class="cc-action-loading hidden" role="status" aria-live="polite" aria-busy="true">
          <div class="cc-loading-card">
            <div class="cc-loading-mark" aria-hidden="true"><span>CC</span><i></i></div>
            <div class="cc-loading-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
            <h2 id="ccLoadingTitle">Working…</h2>
            <p id="ccLoadingMessage">Please wait a moment.</p>
          </div>
        </div>
        <div id="ccConfirm" class="cc-confirm hidden" role="dialog" aria-modal="true" aria-labelledby="ccConfirmTitle">
          <div class="cc-confirm-card">
            <div class="cc-confirm-mark" aria-hidden="true">!</div>
            <h2 id="ccConfirmTitle">Please confirm</h2>
            <p id="ccConfirmMessage"></p>
            <div class="cc-confirm-actions">
              <button type="button" class="btn ghost" id="ccConfirmCancel">Cancel</button>
              <button type="button" class="btn primary" id="ccConfirmOk">Continue</button>
            </div>
          </div>
        </div>
`);
    }
  }
  function startLoading(title='Working…',message='Please wait a moment.'){
    ensureSystemUi();
    loadingDepth+=1;
    const overlay=qs('#ccActionLoading');
    qs('#ccLoadingTitle').textContent=title;
    qs('#ccLoadingMessage').textContent=message;
    overlay.classList.remove('hidden','leaving');
    requestAnimationFrame(()=>overlay.classList.add('visible'));
    document.body.classList.add('cc-busy');
  }
  async function stopLoading(){
    loadingDepth=Math.max(0,loadingDepth-1);
    if(loadingDepth)return;
    const overlay=qs('#ccActionLoading');
    if(!overlay)return;
    overlay.classList.remove('visible');
    overlay.classList.add('leaving');
    await sleep(180);
    overlay.classList.add('hidden');
    overlay.classList.remove('leaving');
    document.body.classList.remove('cc-busy');
  }
  async function withLoading(title,message,fn,{minimum=420}={}){
    startLoading(title,message);
    const started=performance.now();
    try{return await fn();}
    finally{
      const wait=Math.max(0,minimum-(performance.now()-started));
      if(wait)await sleep(wait);
      await stopLoading();
    }
  }
  function confirmAction({title='Please confirm',message='',confirmText='Continue',cancelText='Cancel',danger=false}={}){
    ensureSystemUi();
    return new Promise(resolve=>{
      const overlay=qs('#ccConfirm');
      const ok=qs('#ccConfirmOk');
      const cancel=qs('#ccConfirmCancel');
      qs('#ccConfirmTitle').textContent=title;
      qs('#ccConfirmMessage').textContent=message;
      ok.textContent=confirmText;
      cancel.textContent=cancelText;
      ok.classList.toggle('danger',danger);
      overlay.classList.remove('hidden');
      requestAnimationFrame(()=>overlay.classList.add('visible'));
      const finish=value=>{
        overlay.classList.remove('visible');
        setTimeout(()=>overlay.classList.add('hidden'),150);
        ok.onclick=null;cancel.onclick=null;document.removeEventListener('keydown',onKey);
        resolve(value);
      };
      const onKey=e=>{if(e.key==='Escape')finish(false)};
      ok.onclick=()=>finish(true);cancel.onclick=()=>finish(false);
      document.addEventListener('keydown',onKey);
      setTimeout(()=>ok.focus(),30);
    });
  }
  const panelPages={classes:'classes.html',attendance:'attendance.html',calendar:'calendar.html',reports:'reports.html',profile:'profile.html'};
  const pagePanels=Object.fromEntries(Object.entries(panelPages).map(([panel,page])=>[page,panel]));
  function isUnified(){return document.body?.dataset?.classcheckUnified==='true'}
  function routeParams(){
    if(!isUnified())return new URLSearchParams(location.search);
    const raw=(location.hash||'').replace(/^#/,'');
    const q=raw.includes('?')?raw.slice(raw.indexOf('?')+1):'';
    return new URLSearchParams(q);
  }
  function panelFromHref(href){
    if(!href)return null;
    if(href.startsWith('#')){
      const raw=href.slice(1).split('?')[0];
      return panelPages[raw]?raw:null;
    }
    let url;try{url=new URL(href,location.href)}catch{return null;}
    const file=(url.pathname.split('/').pop()||'').toLowerCase();
    return pagePanels[file]||null;
  }
  function unifiedHash(panel,params){
    const query=params instanceof URLSearchParams?params.toString():String(params||'').replace(/^\?/,'');
    return `#${panel}${query?`?${query}`:''}`;
  }
  function showPanel(panel,{params=null,historyMode='push'}={}){
    if(!isUnified()||!panelPages[panel])return false;
    qsa('[data-app-panel]').forEach(el=>{el.hidden=el.dataset.appPanel!==panel;});
    qsa('.modal').forEach(el=>el.classList.add('hidden'));
    nav(panel);
    const nextHash=unifiedHash(panel,params||new URLSearchParams());
    if(historyMode==='replace')history.replaceState({panel},'',nextHash);
    else if(historyMode==='push'&&location.hash!==nextHash)history.pushState({panel},'',nextHash);
    document.title=`ClassCheck • ${panel==='profile'?'Profile':panel.charAt(0).toUpperCase()+panel.slice(1)}`;
    document.dispatchEvent(new CustomEvent('classcheck:panelchange',{detail:{panel,params:routeParams()}}));
    window.scrollTo({top:0,left:0,behavior:'auto'});
    return true;
  }
  function navigate(href){
    if(!href)return;
    const panel=panelFromHref(href);
    let url;try{url=new URL(href,location.href)}catch{url=null;}
    if(panel){
      const params=href.startsWith('#')?new URLSearchParams(href.includes('?')?href.slice(href.indexOf('?')+1):''):(url?.searchParams||new URLSearchParams());
      if(isUnified()){showPanel(panel,{params,historyMode:'push'});return;}
      const target=`app.html${unifiedHash(panel,params)}`;
      location.href=target;return;
    }
    location.href=href;
  }
  function installNavigationTransitions(){
    document.addEventListener('click',e=>{
      if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
      const a=e.target.closest('a[href]');
      if(!a||a.target||a.hasAttribute('download'))return;
      const raw=a.getAttribute('href')||'';
      if(!raw||raw.startsWith('mailto:')||raw.startsWith('tel:')||raw.startsWith('javascript:'))return;
      const panel=panelFromHref(raw);
      if(panel){e.preventDefault();navigate(raw);return;}
      if(raw.startsWith('#'))return;
      let url;try{url=new URL(a.href,location.href)}catch{return;}
      if(location.protocol!=='file:'&&url.origin!==location.origin)return;
      if(url.href===location.href)return;
      e.preventDefault();navigate(url.href);
    },true);
  }

  function nav(active){
    const state=window.AppStorage?AppStorage.get():null;
    const teacherName=state?.profile?.full_name||sessionStorage.getItem('classcheck_teacher_name')||'Teacher';
    const teacherInitial=(teacherName.trim()[0]||'T').toUpperCase();
    const items=[
      ['classes','users','Classes'],
      ['attendance','attendance','Attendance'],
      ['calendar','calendar','Calendar'],
      ['reports','report','Reports'],
      ['profile','user','Profile']
    ];
    const hrefFor=panel=>isUnified()?`#${panel}`:panelPages[panel];
    let el=qs('.classcheck-sidebar');
    if(!el){
      el=document.createElement('nav');
      el.className='bottom-nav classcheck-sidebar';
      el.setAttribute('aria-label','ClassCheck navigation');
      document.body.appendChild(el);
    }
    el.innerHTML=`
      <a class="classcheck-teacher-card ${active==='profile'?'active':''}" href="${hrefFor('profile')}">
        <span class="classcheck-avatar">${teacherInitial}</span>
        <span><b>${teacherName}</b><small>Daily attendance</small></span>
      </a>
      <div class="classcheck-nav-links">
        ${items.map(([key,ico,label])=>`<a class="nav-item ${key==='profile'?'classcheck-mobile-profile-nav ':''}${active===key?'active':''}" href="${hrefFor(key)}"><span class="nav-icon">${icon(ico)}</span><span>${label}</span></a>`).join('')}
      </div>
      <a class="classcheck-profile-link ${active==='profile'?'active':''}" href="${hrefFor('profile')}"><span class="nav-icon">${icon('user')}</span><span>Teacher Profile</span></a>`;
    hydrateIcons(el);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    ensureSystemUi();
    hydrateIcons(document);
    installNavigationTransitions();
    if(isUnified()){
      const raw=(location.hash||'#attendance').replace(/^#/,'');
      const panel=raw.split('?')[0];
      const params=new URLSearchParams(raw.includes('?')?raw.slice(raw.indexOf('?')+1):'');
      showPanel(panelPages[panel]?panel:'attendance',{params,historyMode:'replace'});
      window.addEventListener('popstate',()=>{
        const next=(location.hash||'#attendance').replace(/^#/,'');
        const p=next.split('?')[0];
        const ps=new URLSearchParams(next.includes('?')?next.slice(next.indexOf('?')+1):'');
        showPanel(panelPages[p]?p:'attendance',{params:ps,historyMode:'none'});
      });
    }
    document.body.classList.add('cc-page-ready');
  });
  window.App={qs,qsa,fmtDate,longDate,studentName,toast,nav,icon,hydrateIcons,sleep,startLoading,stopLoading,withLoading,confirmAction,navigate,isUnified,routeParams,showPanel};
})();
