/* ClassCheck PWA — V10.7 editable learners with optional LRN. */
const CACHE_NAME = 'classcheck-pwa-v12-0-highlighted-hero';
const CACHE_PREFIX = 'classcheck-pwa-';
const APP_SHELL = [
  './',
  './index.html',
  './app.html',
  './attendance.html',
  './calendar.html',
  './classes.html',
  './profile.html',
  './reports.html',
  './offline.html',
  './manifest.webmanifest',
  './css/styles.css?v=12.0',
  './css/responsive.css?v=11.6',
  './assets/classcheck-tabicon.png?v=11.9',
  './assets/classcheck-tabicon.png?v=11.9',
  './assets/classcheck-logo-full.png',
  './assets/icons/classcheck-180.png?v=11.9',
  './assets/icons/classcheck-192.png?v=11.9',
  './assets/icons/classcheck-512.png?v=11.9',
  './assets/icons/classcheck-maskable-512.png?v=11.9',
  './js/config.js?v=10.4',
  './js/demo-data.js?v=9',
  './js/storage.js?v=9.4',
  './js/offline-db.js?v=9',
  './js/supabase-client.js?v=9',
  './js/bootstrap.js?v=9',
  './js/sync.js?v=10.5',
  './js/app.js?v=11.5',
  './js/auth.js?v=10.2',
  './js/classes.js?v=10.6',
  './js/attendance.js?v=9.3',
  './js/calendar.js?v=9.3',
  './js/reports.js?v=10.5',
  './js/profile.js?v=9.2',
  './js/pwa.js?v=10.2',
  './js/jszip.min.js?v=9.5',
  './js/sf2-template.js?v=9.5',
  './assets/templates/SF2_SOURCE_TEMPLATE.xlsx'
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
    try{
      const fresh=await fetch(req);
      if(fresh?.ok){const cache=await caches.open(CACHE_NAME);cache.put(req,fresh.clone());}
      return fresh;
    }catch(_){
      return (await caches.match(req,{ignoreSearch:false})) || (await caches.match(req,{ignoreSearch:true})) || Response.error();
    }
  })());
});
