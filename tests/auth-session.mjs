import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const user={id:'teacher-a',email:'teacher@example.test'};
const state={profile:{full_name:'Teacher'},classes:[{id:'class-a'}],students:[],classTeachers:[]};
function setup({online=false,owner=user.id,saved=true,session=null,error=null,pending=false}={}){
 const data=new Map();
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 if(saved)storage.setItem('classcheck_offline_user',JSON.stringify(user));
 let calls=0,redirect=null;
 const context={console:{warn(){},error(){}},navigator:{onLine:online},localStorage:storage,sessionStorage:storage,
  APP_CONFIG:{DEMO_MODE:false},setTimeout,clearTimeout,
  App:{navigate:p=>redirect=p},location:{},OfflineDB:{all:async()=>pending?[{payload:{teacher_id:user.id}}]:[]},
  AppStorage:{meta:()=>({owner_id:owner}),get:()=>state,reset:()=>{owner=null;},isFresh:()=>false},
  supabase:{createClient:()=>({auth:{getSession:async()=>{calls++;return {data:{session},error};},signOut:async()=>({error:null})},from:()=>{throw Error('Unexpected network roster fetch');}})}};
 context.window=context;vm.createContext(context);vm.runInContext(read('js/supabase-client.js'),context);
 return {context,data,calls:()=>calls,redirect:()=>redirect};
}
let env=setup();
let ctx=await env.context.Supa.requireTeacher();
assert.equal(ctx.offline,true);assert.equal(ctx.user.id,user.id);
assert.equal(await env.context.Supa.loadState(ctx,true),state);assert.equal(env.calls(),0);
// A fresh JS runtime with persistent storage still reopens offline.
env=setup();assert.equal((await env.context.Supa.getSession()).user.id,user.id);
// Reported-online Wi-Fi with failed requests still uses only the matching cache.
env=setup({online:true,error:Error('Network unavailable')});
ctx=await env.context.Supa.requireTeacher();assert.equal(ctx.offline,true);
assert.equal(await env.context.Supa.loadState(ctx,true),state);
// No account or an unrelated account's cache cannot unlock a roster.
for(const options of [{saved:false},{owner:'teacher-b'}]){
 env=setup(options);await assert.rejects(()=>env.context.Supa.requireTeacher(),/AUTH_REQUIRED/);
 assert.equal(env.redirect(),'index.html');
}
// A confirmed empty online session does not override a server-side logout.
env=setup({online:true});assert.equal(await env.context.Supa.getSession(),null);
// An authenticated different account must not receive the old cached roster.
env=setup({online:true,session:{user:{id:'teacher-b'}}});
ctx=await env.context.Supa.requireTeacher();assert.equal(ctx.user.id,'teacher-b');
await assert.rejects(()=>env.context.Supa.loadState(ctx,true),/Connect once/);
// Explicit logout removes remembered access; queued attendance prevents data loss.
env=setup();await env.context.Supa.signOut({redirect:false});
assert.equal(env.data.has('classcheck_offline_user'),false);assert.equal(await env.context.Supa.getSession(),null);
env=setup({pending:true});await assert.rejects(()=>env.context.Supa.signOut(),/Sync pending/);
assert.equal(env.data.has('classcheck_offline_user'),true);
// Execute login-page boot with a minimal DOM for browser, PWA and WebView.
for(const platform of ['browser','pwa','android']){
 env=setup();const c=env.context;let boot,opened=false;
 const el={classList:{add(){},remove(){}},addEventListener(){},textContent:''};
 c.document={getElementById:()=>el,querySelector:()=>el,addEventListener:(event,fn)=>{boot=fn;}};
 c.App.withLoading=async(a,b,fn)=>fn();c.App.navigate=()=>{opened=true;};
 c.matchMedia=()=>({matches:platform==='pwa'});if(platform==='android')c.Capacitor={isNativePlatform:()=>true};
 vm.runInContext(read('js/auth.js'),c);await boot();assert.equal(opened,true,platform+' restores automatically');
}
console.log('PASS: offline cold launch, network failure, ownership isolation, logout, pending data protection, automatic browser/PWA/Android entry.');
