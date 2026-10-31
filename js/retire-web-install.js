// Migration only: remove this deployment's old web installation without touching records.
(async()=>{
  if(!('serviceWorker' in navigator))return;
  const base=new URL('../',document.currentScript.src);
  const legacyURL=new URL('service-worker.js',base);
  try{
    const registrations=await navigator.serviceWorker.getRegistrations();
    for(const registration of registrations){
      const workers=[registration.active,registration.waiting,registration.installing].filter(Boolean);
      if(registration.scope===base.href&&workers.some(w=>{
        const url=new URL(w.scriptURL);
        return url.origin===legacyURL.origin&&url.pathname===legacyURL.pathname;
      }))await registration.unregister();
    }
    if('caches' in window){
      const names=await caches.keys();
      await Promise.all(names.filter(name=>name.startsWith('classcheck-pwa-')).map(name=>caches.delete(name)));
    }
  }catch(error){console.warn('Legacy web installation cleanup will retry next visit.',error);}
})();
