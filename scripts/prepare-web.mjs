import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
const dest = new URL('../www/', import.meta.url);
await rm(dest, { recursive:true, force:true });
await mkdir(dest, { recursive:true });
for(const dir of ['assets','css','js']) await cp(new URL(`../${dir}/`, import.meta.url), new URL(`../www/${dir}/`,import.meta.url), { recursive:true });
for(const file of ['index.html','app.html','attendance.html','calendar.html','classes.html','dashboard.html','profile.html','reports.html','offline.html','manifest.webmanifest','service-worker.js']) {
  await cp(new URL(`../${file}`,import.meta.url), new URL(`../www/${file}`,import.meta.url));
}
console.log('Bundled all ClassCheck pages, scripts, QR readers and assets into www/.');
