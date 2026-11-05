/* Register service-worker app shell. Never delete IndexedDB or pending attendance. */
(()=>{
 if(!('serviceWorker' in navigator))return;
 if(window.Capacitor?.isNativePlatform?.())return;
 if(!['https:','http:'].includes(location.protocol))return;
 if(location.protocol==='http:'&&!['localhost','127.0.0.1'].includes(location.hostname))return;
 window.addEventListener('load',async()=>{
  try{
   const reg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
   reg.update().catch(()=>{});
   if(reg.waiting&&!navigator.serviceWorker.controller)reg.waiting.postMessage({type:'SKIP_WAITING'});
  }catch(err){console.warn('Offline app files were not saved. Reopen ClassCheck while connected.',err);}
 });
})();
