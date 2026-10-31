import {readFileSync,readdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
for(const name of readdirSync(root).filter(x=>x.endsWith('.html'))){
 const html=readFileSync(new URL(name,root),'utf8');
 assert.doesNotMatch(html,/data-install-|pwa-install|js\/pwa.js|rel="manifest"|mobile-web-app-capable/,name);
}
assert.equal(existsSync(new URL('manifest.webmanifest',root)),false);
const removed=[],deleted=[];
const reg=(scope,scriptURL)=>({scope,active:{scriptURL},unregister:async()=>removed.push(scope)});
const context={URL,console,document:{currentScript:{src:'https://example.test/classcheck/js/retire-web-install.js?v=14.2'}},
 navigator:{serviceWorker:{getRegistrations:async()=>[
 reg('https://example.test/classcheck/','https://example.test/classcheck/service-worker.js'),
 reg('https://example.test/other/','https://example.test/other/service-worker.js')]}},
 caches:{keys:async()=>['classcheck-pwa-old','unrelated-cache'],delete:async name=>deleted.push(name)}};
context.window=context;
await vm.runInNewContext(readFileSync(new URL('js/retire-web-install.js',root),'utf8'),context);
assert.deepEqual(removed,['https://example.test/classcheck/']);
assert.deepEqual(deleted,['classcheck-pwa-old']);
console.log('PASS: no install UI/manifest; cleanup targets legacy ClassCheck worker/cache only.');
