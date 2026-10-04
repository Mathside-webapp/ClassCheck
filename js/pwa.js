(function(){
  let deferredPrompt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function toast(message){
    if(window.App?.toast){ window.App.toast(message); return; }
    const el=document.createElement('div');
    el.className='pwa-mini-toast';
    el.textContent=message;
    document.body.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),180)},3200);
  }

  function ensureGuide(){
    if(document.getElementById('pwaInstallGuide')) return;
    const wrap=document.createElement('div');
    wrap.id='pwaInstallGuide';
    wrap.className='pwa-install-guide hidden';
    wrap.innerHTML=`
      <div class="pwa-guide-card" role="dialog" aria-modal="true" aria-labelledby="pwaGuideTitle">
        <button type="button" class="pwa-guide-close" data-pwa-close aria-label="Close">×</button>
        <div class="pwa-guide-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 16v3h14v-3"/></svg>
        </div>
        <p class="eyebrow">INSTALL CLASSCHECK</p>
        <h2 id="pwaGuideTitle">Use ClassCheck like a regular app</h2>
        <p class="pwa-guide-lead">After installing, ClassCheck opens from your Home Screen or desktop without the normal browser interface.</p>
        <div class="pwa-guide-steps">
          <section><b>Android • Chrome</b><span>Tap <strong>Install ClassCheck</strong>. If no prompt appears, open Chrome’s ⋮ menu → <strong>Add to Home screen</strong> or <strong>Install app</strong> → Install.</span></section>
          <section><b>iPhone / iPad • Safari</b><span>Open ClassCheck in Safari → tap the <strong>Share</strong> button → <strong>Add to Home Screen</strong> → Add.</span></section>
          <section><b>Computer • Chrome / Edge</b><span>Tap <strong>Install ClassCheck</strong>, or use the install icon at the right side of the address bar.</span></section>
        </div>
        <p class="pwa-guide-note">ClassCheck must be opened from an HTTPS site such as GitHub Pages for installation to work.</p>
        <button type="button" class="btn primary block" data-pwa-close>Got it</button>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click',e=>{if(e.target===wrap || e.target.closest('[data-pwa-close]')) closeGuide();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!wrap.classList.contains('hidden'))closeGuide();});
  }

  function openGuide(){
    ensureGuide();
    const guide=document.getElementById('pwaInstallGuide');
    guide.classList.remove('hidden');
    requestAnimationFrame(()=>guide.classList.add('visible'));
    document.body.classList.add('pwa-guide-open');
  }
  function closeGuide(){
    const guide=document.getElementById('pwaInstallGuide');
    if(!guide)return;
    guide.classList.remove('visible');
    document.body.classList.remove('pwa-guide-open');
    setTimeout(()=>guide.classList.add('hidden'),160);
  }

  function updateButtons(){
    const installed=isStandalone();
    document.documentElement.classList.toggle('pwa-installed',installed);
    document.querySelectorAll('[data-install-classcheck]').forEach(btn=>{
      btn.disabled=installed;
      btn.classList.toggle('installed',installed);
      const label=btn.querySelector('[data-install-label]');
      if(label) label.textContent=installed?'ClassCheck is installed':'Install ClassCheck';
      else btn.textContent=installed?'ClassCheck is installed':'Install ClassCheck';
    });
    document.querySelectorAll('[data-pwa-status]').forEach(el=>{
      el.textContent=installed?'Installed on this device':deferredPrompt?'Ready to install':isIOS()?'Use Safari → Add to Home Screen':'Install from your browser';
    });
  }

  async function install(){
    if(isStandalone()){
      toast('ClassCheck is already installed on this device.');
      return;
    }
    if(deferredPrompt){
      deferredPrompt.prompt();
      const choice=await deferredPrompt.userChoice;
      deferredPrompt=null;
      if(choice?.outcome==='accepted') toast('ClassCheck installation started.');
      else toast('Installation was cancelled.');
      updateButtons();
      return;
    }
    openGuide();
  }

  function bind(){
    ensureGuide();
    document.querySelectorAll('[data-install-classcheck]').forEach(btn=>btn.addEventListener('click',install));
    document.querySelectorAll('[data-install-help]').forEach(btn=>btn.addEventListener('click',openGuide));
    updateButtons();
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    updateButtons();
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    updateButtons();
    toast('ClassCheck was installed successfully.');
  });

  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(err=>console.warn('ClassCheck service worker:',err)));
  }

  document.addEventListener('DOMContentLoaded',bind);
  window.ClassCheckPWA={install,openGuide,isStandalone};
})();
