(() => {
  let deferredPrompt = null;
  let registrationRef = null;
  let reloadingForUpdate = false;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIOS = () => {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    return /iphone|ipad|ipod/i.test(ua) ||
      (platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
  };
  const isAndroid = () => /android/i.test(navigator.userAgent || '');
  const isSamsungBrowser = () => /SamsungBrowser/i.test(navigator.userAgent || '');
  const isSafari = () => {
    const ua = navigator.userAgent || '';
    return /safari/i.test(ua) && !/crios|fxios|edgios|opios|duckduckgo/i.test(ua);
  };

  function toast(message){
    if(window.App?.toast){ window.App.toast(message); return; }
    const el=document.createElement('div');
    el.className='pwa-mini-toast';
    el.textContent=message;
    document.body.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),180)},3200);
  }

  function closeDialog(dialog){
    if(!dialog)return;
    if(typeof dialog.close==='function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  function showDialog(dialog){
    if(!dialog)return;
    if(typeof dialog.showModal==='function') dialog.showModal();
    else dialog.setAttribute('open','');
  }

  function ensureDialogs(){
    if(!document.getElementById('pwaAndroidInstallDialog')){
      const d=document.createElement('dialog');
      d.id='pwaAndroidInstallDialog';
      d.className='pwa-dialog';
      const samsung=isSamsungBrowser();
      d.innerHTML=`<div class="pwa-card pwa-ios-card">
        <button type="button" class="pwa-guide-close" data-close-pwa aria-label="Close">×</button>
        <div class="pwa-guide-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 16v3h14v-3"/></svg></div>
        <p class="eyebrow">INSTALL CLASSCHECK</p>
        <h2>Install ClassCheck on Android</h2>
        <p class="pwa-guide-lead">ClassCheck can open from your Home Screen like a regular app.</p>
        <div class="pwa-guide-steps">
          <section><b>1. Try Install now</b><span>If your browser supports direct installation, use the button below.</span></section>
          <section><b>2. If no install box appears</b><span>${samsung?'Open the browser menu → Add page to → Home screen.':'Open the browser ⋮ menu → Install app or Add to Home screen.'}</span></section>
          <section><b>3. Confirm</b><span>Tap Install or Add. ClassCheck will appear with your other apps.</span></section>
        </div>
        <div class="pwa-install-actions">
          <button type="button" class="btn soft block" data-close-pwa>Close</button>
          <button type="button" class="btn primary block" id="pwaAndroidTryInstall">Install now</button>
        </div>
      </div>`;
      document.body.appendChild(d);
      d.querySelectorAll('[data-close-pwa]').forEach(b=>b.addEventListener('click',()=>closeDialog(d)));
      d.addEventListener('click',e=>{if(e.target===d)closeDialog(d)});
      d.querySelector('#pwaAndroidTryInstall')?.addEventListener('click',async()=>{
        if(deferredPrompt){
          closeDialog(d);
          try{
            deferredPrompt.prompt();
            const choice=await deferredPrompt.userChoice;
            deferredPrompt=null;
            if(choice?.outcome==='accepted') toast('ClassCheck installation started.');
            else toast('Installation was cancelled. You can also use your browser menu.');
          }catch(error){
            console.error(error);
            toast('Use the browser menu → Install app or Add to Home screen.');
          }
          updateButtons();
        }else{
          toast('Use your browser menu → Install app or Add to Home screen.');
        }
      });
    }

    if(!document.getElementById('pwaIosInstallDialog')){
      const d=document.createElement('dialog');
      d.id='pwaIosInstallDialog';
      d.className='pwa-dialog';
      d.innerHTML=`<div class="pwa-card pwa-ios-card">
        <button type="button" class="pwa-guide-close" data-close-pwa aria-label="Close">×</button>
        <div class="pwa-guide-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 15V3m0 0L8 7m4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg></div>
        <p class="eyebrow">INSTALL CLASSCHECK</p>
        <h2>Add ClassCheck to iPhone or iPad</h2>
        <p class="pwa-guide-lead">Apple installs web apps from Safari's Share menu.</p>
        <div class="pwa-guide-steps">
          <section><b>1. Open in Safari</b><span>${isSafari()?'You are already using Safari.':'Open this ClassCheck page in Safari first.'}</span></section>
          <section><b>2. Tap Share</b><span>Tap the square-with-arrow Share button.</span></section>
          <section><b>3. Add to Home Screen</b><span>Choose Add to Home Screen, keep Open as Web App enabled if shown, then tap Add.</span></section>
        </div>
        <button type="button" class="btn primary block" data-close-pwa>Got it</button>
      </div>`;
      document.body.appendChild(d);
      d.querySelectorAll('[data-close-pwa]').forEach(b=>b.addEventListener('click',()=>closeDialog(d)));
      d.addEventListener('click',e=>{if(e.target===d)closeDialog(d)});
    }

    if(!document.getElementById('pwaInstallHelpDialog')){
      const d=document.createElement('dialog');
      d.id='pwaInstallHelpDialog';
      d.className='pwa-dialog';
      d.innerHTML=`<div class="pwa-card pwa-ios-card">
        <button type="button" class="pwa-guide-close" data-close-pwa aria-label="Close">×</button>
        <div class="pwa-guide-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 16v3h14v-3"/></svg></div>
        <p class="eyebrow">INSTALL CLASSCHECK</p>
        <h2>Use ClassCheck like an app</h2>
        <div class="pwa-guide-steps">
          <section><b>Android</b><span>Browser menu ⋮ → Install app or Add to Home screen.</span></section>
          <section><b>iPhone / iPad</b><span>Safari → Share → Add to Home Screen.</span></section>
          <section><b>Computer</b><span>Chrome or Edge → use the install icon in the address bar, or the browser menu.</span></section>
        </div>
        <p class="pwa-guide-note">Installation requires the HTTPS version of ClassCheck, such as your GitHub Pages site.</p>
        <button type="button" class="btn primary block" data-close-pwa>Got it</button>
      </div>`;
      document.body.appendChild(d);
      d.querySelectorAll('[data-close-pwa]').forEach(b=>b.addEventListener('click',()=>closeDialog(d)));
      d.addEventListener('click',e=>{if(e.target===d)closeDialog(d)});
    }
  }

  function updateButtons(){
    const installed=isStandalone();
    document.documentElement.classList.toggle('pwa-installed',installed);
    document.documentElement.classList.toggle('pwa-install-ready',Boolean(deferredPrompt));
    document.querySelectorAll('[data-install-classcheck]').forEach(btn=>{
      btn.disabled=installed;
      btn.classList.toggle('installed',installed);
      const label=btn.querySelector('[data-install-label]');
      if(label) label.textContent=installed?'Installed':(btn.classList.contains('pwa-header-install')?'Install':'Install ClassCheck');
    });
    document.querySelectorAll('[data-pwa-status]').forEach(el=>{
      el.textContent=installed?'Installed on this device':deferredPrompt?'Ready to install':isIOS()?'Safari → Add to Home Screen':isAndroid()?'Tap Install for Android steps':'Install from your browser';
    });
  }

  async function install(){
    if(isStandalone()) return toast('ClassCheck is already installed on this device.');
    ensureDialogs();
    if(isIOS()) return showDialog(document.getElementById('pwaIosInstallDialog'));
    if(isAndroid()) return showDialog(document.getElementById('pwaAndroidInstallDialog'));
    if(deferredPrompt){
      try{
        deferredPrompt.prompt();
        const choice=await deferredPrompt.userChoice;
        deferredPrompt=null;
        if(choice?.outcome==='accepted') toast('ClassCheck installation started.');
        else toast('Installation was cancelled.');
      }catch(error){ console.error(error); }
      updateButtons();
      return;
    }
    showDialog(document.getElementById('pwaInstallHelpDialog'));
  }

  function openGuide(){
    ensureDialogs();
    if(isIOS()) showDialog(document.getElementById('pwaIosInstallDialog'));
    else if(isAndroid()) showDialog(document.getElementById('pwaAndroidInstallDialog'));
    else showDialog(document.getElementById('pwaInstallHelpDialog'));
  }

  function bind(){
    ensureDialogs();
    document.querySelectorAll('[data-install-classcheck]').forEach(btn=>{
      if(btn.dataset.pwaBound==='1')return;
      btn.dataset.pwaBound='1';
      btn.addEventListener('click',install);
    });
    document.querySelectorAll('[data-install-help]').forEach(btn=>{
      if(btn.dataset.pwaBound==='1')return;
      btn.dataset.pwaBound='1';
      btn.addEventListener('click',openGuide);
    });
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
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(reloadingForUpdate)return;
      if(sessionStorage.getItem('classcheck_sw_reloaded_10_1')==='1')return;
      reloadingForUpdate=true;
      sessionStorage.setItem('classcheck_sw_reloaded_10_1','1');
      location.reload();
    });

    window.addEventListener('load',async()=>{
      try{
        const registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
        registrationRef=registration;
        await navigator.serviceWorker.ready;
        registration.update().catch(()=>{});
        window.addEventListener('focus',()=>registration.update().catch(()=>{}));
      }catch(error){
        console.error('ClassCheck service worker registration failed:',error);
        toast('App installation is unavailable until ClassCheck is opened from its HTTPS site.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded',bind);
  window.ClassCheckPWA={install,openGuide,isStandalone};
})();
