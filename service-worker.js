/* ClassCheck v18 complete design offline shell. Scoped to the repository path on GitHub Pages. */
const VERSION='classcheck-shell-v18-20261106';
const SHELL=[
 './','./index.html','./app.html','./offline.html',
 './dashboard.html','./attendance.html','./calendar.html','./classes.html','./reports.html','./profile.html',
 './roster.html','./import.html','./archive.html','./sync.html',
 './manifest.webmanifest',
 './css/styles.css','./css/responsive.css','./css/dashboard.css','./css/redesign.css','./css/maroon-2026.css','./css/preview-implementation.css',
 './js/config.js','./js/demo-data.js','./js/storage.js','./js/offline-db.js','./js/supabase-client.js','./js/bootstrap.js','./js/sync.js',
 './js/app.js','./js/auth.js','./js/dashboard.js','./js/classes.js','./js/attendance.js','./js/calendar.js','./js/reports.js',
 './js/profile.js','./js/profile-photo.js','./js/sf2-template.js','./js/pwa-register.js','./js/workspace-ui.js','./js/preview-live.js',
 './js/qr-attendance.js','./js/jszip.min.js','./js/vendor/supabase.js','./js/vendor/xlsx.js','./js/vendor/qrcode.js','./js/vendor/jsQR.js',
 './assets/classcheck-logo-icon.png','./assets/classcheck-tabicon.png','./assets/icons/classcheck-192.png','./assets/icons/classcheck-512.png',
 './assets/empty-classes.png','./assets/empty-roster.png','./assets/empty-attendance.png','./assets/empty-calendar.png','./assets/empty-archive.png',
 './assets/templates/SF2_SOURCE_TEMPLATE.xlsx'
];
const withinScope=url=>url.origin===self.location.origin&&url.pathname.startsWith(new URL(self.registration.scope).pathname);
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(VERSION);
  // Keep already-cached app intact if an optional asset fails to download.
  await cache.addAll(SHELL.map(x=>new Request(x,{cache:'reload'})));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('classcheck-shell-')&&k!==VERSION).map(k=>caches.delete(k)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);
 // Never intercept Supabase requests or other third-party resources.
 if(!withinScope(url))return;
 event.respondWith((async()=>{
  const cache=await caches.open(VERSION);
  const offline=async()=>{
   const found=await cache.match(request,{ignoreSearch:true});if(found)return found;
   if(request.mode==='navigate'){
    return await cache.match('./app.html')||await cache.match('./index.html')||await cache.match('./offline.html');
   }
   return Response.error();
  };
  // Avoid repeated slow network attempts when navigator is clearly offline.
  try{
   const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),4500);
   try{
    const fresh=await fetch(request,{signal:ctrl.signal});
    if(fresh?.ok){await cache.put(request,fresh.clone());return fresh;}
    if(fresh&&fresh.status!==503&&fresh.status!==504)return fresh;
   }finally{clearTimeout(timeout);}
  }catch(err){/* the app is allowed to operate from last downloaded assets */}
  return offline();
 })());
});
