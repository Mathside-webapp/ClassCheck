// Retirement worker at the former URL, so older cached deployments can update.
// No fetch handler, app-shell caching, manifest, or new registration remains.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith('classcheck-pwa-')).map(name=>caches.delete(name)));
    await self.registration.unregister();
  })());
});
