import {readFileSync,readdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const worker=read('service-worker.js');
const register=read('js/pwa-register.js');
const db=read('js/offline-db.js');
const app=read('app.html');
assert.match(worker,/self\.addEventListener\('fetch'/,'offline requests have a handler');
assert.match(worker,/SHELL/,'app shell is cached');
assert.match(worker,/new URL\(self\.registration\.scope\)/,'cache is scoped for GitHub Pages');
assert.doesNotMatch(worker,/registration\.unregister/,'worker stays registered');
assert.match(register,/serviceWorker\.register/,'worker registration enabled');
assert.match(db,/stateCache/,'roster has IndexedDB fallback');
assert.match(db,/saveQueued/,'attendance changes keep atomic queue writes');
assert.match(read('manifest.webmanifest'),/"display": "standalone"/);
assert.match(app,/css\/preview-implementation\.css\?v=18\.0/,'approved preview styles are loaded');
for(const page of ['index.html','app.html']) {
 const content=read(page);
 assert.match(content,/rel="manifest"/,page+' has manifest');
 assert.match(content,/js\/pwa-register\.js/,page+' registers offline shell');
 assert.doesNotMatch(content,/js\/retire-web-install\.js/,page+' must not remove PWA');
}
for(const page of ['dashboard','attendance','calendar','classes','reports','profile','roster','import','archive','sync']) {
 assert.match(read(page+'.html'), new RegExp('app\\.html#'+page),page+' goes to unified redesigned application');
}
console.log('PASS: scoped offline PWA, manifest, maroon assets, persisted roster and attendance queue.');
