/* ClassCheck PWA — V10.7 editable learners with optional LRN. */
const CACHE_NAME = 'classcheck-pwa-v13-3-auto-sync-storage';
const CACHE_PREFIX = 'classcheck-pwa-';
const APP_SHELL = [
  "./",
  "./app.html",
  "./assets/classcheck-tabicon.png?v=11.9",
  "./assets/icons/classcheck-180.png?v=11.9",
  "./assets/templates/SF2_SOURCE_TEMPLATE.xlsx",
  "./attendance.html",
  "./calendar.html",
  "./classes.html",
  "./css/dashboard.css?v=13.3",
  "./css/responsive.css?v=11.6",
  "./css/styles.css?v=12.5",
  "./dashboard.html",
  "./index.html",
  "./js/app.js?v=11.5",
  "./js/attendance.js?v=13.3",
  "./js/auth.js?v=13.3",
  "./js/bootstrap.js?v=9",
  "./js/calendar.js?v=9",
  "./js/classes.js?v=12.4",
  "./js/config.js?v=10.4",
  "./js/dashboard.js?v=13.3",
  "./js/demo-data.js?v=9",
  "./js/jszip.min.js?v=9.5",
  "./js/offline-db.js?v=9",
  "./js/profile.js?v=12.4",
  "./js/pwa.js?v=13.3",
  "./js/qr-attendance.js",
  "./js/reports.js?v=12.5",
  "./js/sf2-template.js?v=9.5",
  "./js/storage.js?v=13.3",
  "./js/supabase-client.js?v=13.3",
  "./js/sync.js?v=13.3",
  "./js/vendor/jsQR.js",
  "./js/vendor/qrcode.js",
  "./js/vendor/supabase.js",
  "./js/vendor/xlsx.js",
  "./manifest.webmanifest",
  "./offline.html",
  "./profile.html",
  "./reports.html"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if(event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req);
        if(fresh?.ok){const cache=await caches.open(CACHE_NAME);cache.put(req,fresh.clone());}
        return fresh;
      }catch(_){
        return (await caches.match(req,{ignoreSearch:true})) || (await caches.match('./index.html')) || (await caches.match('./offline.html'));
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(req,{ignoreSearch:false});
    if(cached)return cached;
    try{
      const fresh=await fetch(req);
      if(fresh?.ok){const cache=await caches.open(CACHE_NAME);cache.put(req,fresh.clone());}
      return fresh;
    }catch(_){
      return (await caches.match(req,{ignoreSearch:false})) || (await caches.match(req,{ignoreSearch:true})) || Response.error();
    }
  })());
});
