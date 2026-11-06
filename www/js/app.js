(function(){
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
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
  function toast(msg){let el=qs('.toast');if(el)el.remove();el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),2400)}
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
    book:'<path d="M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zm0 0v14"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    'shield-check':'<path d="M12 2 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-4Zm-4 10 3 3 5-6"/>',
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
  const panelPages={dashboard:'dashboard.html',classes:'classes.html',roster:'roster.html',attendance:'attendance.html',calendar:'calendar.html',import:'import.html',reports:'reports.html',archive:'archive.html',sync:'sync.html',profile:'profile.html'};
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
    const esc=escapeHtml;
    const state=window.AppStorage?.get?.()||{};
    const teacherName=(state.profile?.full_name||'Teacher').trim()||'Teacher';
    const initial=(teacherName[0]||'T').toUpperCase();
    const href=p=>isUnified()?`#${p}`:`app.html#${p}`;
    const items=[['dashboard','home','Dashboard'],['classes','users','My Classes'],['roster','users','Student Roster'],['attendance','clipboard-check','Daily Attendance'],['calendar','calendar','Monthly Calendar'],['import','download','SF1 Import'],['reports','report','SF2 Reports'],['archive','clipboard-check','Archived Classes']];
    let sidebar=qs('.ccx-sidebar');
    if(!sidebar){
      sidebar=document.createElement('aside');sidebar.className='ccx-sidebar';sidebar.setAttribute('aria-label','Main navigation');
      document.body.appendChild(sidebar);
      const scrim=document.createElement('button');scrim.type='button';scrim.className='ccx-nav-scrim';scrim.setAttribute('aria-label','Close navigation');scrim.addEventListener('click',()=>document.body.classList.remove('ccx-nav-open'));document.body.appendChild(scrim);
      const bottom=document.createElement('nav');bottom.className='ccx-mobile-nav';bottom.setAttribute('aria-label','Mobile navigation');document.body.appendChild(bottom);
      document.addEventListener('keydown',e=>{if(e.key==='Escape')document.body.classList.remove('ccx-nav-open');});
      document.addEventListener('click',e=>{if(e.target.closest('.ccx-sidebar a,.ccx-mobile-nav a'))document.body.classList.remove('ccx-nav-open');});
    }
    const link=([key,ico,label])=>`<a href="${href(key)}" class="ccx-nav-link ${active===key?'active':''}" ${active===key?'aria-current="page"':''}>${icon(ico)}<span>${label}</span></a>`;
    sidebar.innerHTML=`<a class="ccx-brand" href="${href('dashboard')}"><img src="assets/classcheck-logo-icon.png" alt=""><span><b>ClassCheck</b><small>ATTENDANCE MADE SIMPLE</small></span></a>
      <div class="ccx-nav-label">WORKSPACE</div><nav class="ccx-nav-stack">${items.map(link).join('')}</nav>
      <div class="ccx-nav-label ccx-account-label">ACCOUNT</div><nav class="ccx-nav-stack">${link(['sync','clipboard-check','Offline & Sync'])}${link(['profile','user','Settings & Profile'])}</nav>
      <div class="ccx-nav-spacer"></div><a class="ccx-sidebar-synccard" href="${href('sync')}"><span class="ccx-online-dot"></span><span><b>Offline-first ClassCheck</b><small>View saved records & sync</small></span>${icon('chevron-right')}</a>
      <div class="ccx-sidebar-footer">CLASSCHECK · TEACHER WORKSPACE</div>`;
    const bottom=qs('.ccx-mobile-nav');
    const mobile=[['dashboard','home','Home'],['classes','users','Classes'],['attendance','clipboard-check','Attendance'],['calendar','calendar','Calendar'],['sync','clipboard-check','Sync']];
    bottom.innerHTML=mobile.map(([key,ico,label])=>`<a href="${href(key)}" class="${active===key?'active':''}" ${active===key?'aria-current="page"':''}>${icon(ico)}<span>${label}</span></a>`).join('');
    document.querySelectorAll('.ccx-topbar .ccx-page-title').forEach(el=>{el.textContent=({dashboard:'Dashboard',classes:'My Classes',roster:'Student Roster',attendance:'Daily Attendance',calendar:'Monthly Calendar',import:'SF1 Import',reports:'SF2 Reports',archive:'Archived Classes',sync:'Offline & Sync',profile:'Settings & Profile'})[active]||'Dashboard';});
    document.querySelectorAll('.ccx-topbar .ccx-crumb-name').forEach(el=>{el.textContent=({dashboard:'OVERVIEW',classes:'CLASSES',roster:'LEARNERS',attendance:'REGISTER',calendar:'HISTORY',import:'ENROLLMENT',reports:'REPORTS',archive:'ARCHIVE',sync:'DATA SAFETY',profile:'ACCOUNT'})[active]||'OVERVIEW';});
    document.querySelectorAll('.ccx-account-name').forEach(el=>el.textContent=teacherName);
    document.querySelectorAll('.ccx-account-initial').forEach(el=>el.textContent=initial);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    ensureSystemUi();
    hydrateIcons(document);
    installNavigationTransitions();
    if(isUnified()){
      const raw=(location.hash||'#dashboard').replace(/^#/,'');
      const panel=raw.split('?')[0];
      const params=new URLSearchParams(raw.includes('?')?raw.slice(raw.indexOf('?')+1):'');
      showPanel(panelPages[panel]?panel:'dashboard',{params,historyMode:'replace'});
      window.addEventListener('popstate',()=>{
        const next=(location.hash||'#dashboard').replace(/^#/,'');
        const p=next.split('?')[0];
        const ps=new URLSearchParams(next.includes('?')?next.slice(next.indexOf('?')+1):'');
        showPanel(panelPages[p]?p:'dashboard',{params:ps,historyMode:'none'});
      });
    }
    document.body.classList.add('cc-page-ready');
  });
  window.App={escapeHtml,qs,qsa,fmtDate,longDate,studentName,toast,nav,icon,hydrateIcons,sleep,startLoading,stopLoading,withLoading,confirmAction,navigate,isUnified,routeParams,showPanel};
})();
