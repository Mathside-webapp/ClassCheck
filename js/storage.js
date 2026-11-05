(function(){
  const KEY='classcheck_state_v5';
  const META='classcheck_state_meta_v5';
  const emptyProfile={full_name:'',school_name:'',school_head_name:'',school_id:'',region:'',division:'',district:'',position:'Teacher',school_year:''};
  function empty(){return {profile:{...emptyProfile},classes:[],students:[],classTeachers:[]};}
  function seed(){
    if(!localStorage.getItem(KEY)){
      const state=APP_CONFIG.DEMO_MODE?{profile:DemoData.profile,classes:DemoData.classes,students:DemoData.students,classTeachers:[]}:empty();
      localStorage.setItem(KEY,JSON.stringify(state));
    }
  }
  function get(){
    seed();
    try{const owner=meta().owner_id;const recent=JSON.parse(localStorage.getItem('classcheck_offline_user')||'null')?.id;if(owner&&recent&&owner!==recent)return empty();}catch{}
    try{
      const s=JSON.parse(localStorage.getItem(KEY))||empty();
      s.profile={...emptyProfile,...(s.profile||{})};
      if(!Array.isArray(s.classes))s.classes=[];
      if(!Array.isArray(s.students))s.students=[];
      if(!Array.isArray(s.classTeachers))s.classTeachers=[];
      return s;
    }catch{return empty()}
  }
  let stateWrite=Promise.resolve();
  function set(state,ownerId){
    const normalized={...state,classTeachers:Array.isArray(state.classTeachers)?state.classTeachers:[]};
    localStorage.setItem(KEY,JSON.stringify(normalized));touch(ownerId);
    // Durable IDB copy for service-worker-powered offline cold launches.
    if(ownerId&&window.OfflineDB?.put)stateWrite=stateWrite.catch(()=>{}).then(()=>OfflineDB.put('stateCache',{owner_id:ownerId,state:normalized,updated_at:Date.now()})).catch(error=>console.warn('ClassCheck roster IndexedDB mirror failed',error));
  }
  async function flushWrites(){await stateWrite;}
  async function restoreFromIndexedDB(ownerId){
    if(!ownerId||!window.OfflineDB?.get)return null;
    const saved=await OfflineDB.get('stateCache',ownerId);
    if(!saved?.state)return null;
    set(saved.state,ownerId);return get();
  }
  function touch(ownerId){localStorage.setItem(META,JSON.stringify({owner_id:ownerId||null,synced_at:Date.now()}));}
  function meta(){try{return JSON.parse(localStorage.getItem(META))||{}}catch{return {}}}
  function isFresh(ownerId,maxAge=(APP_CONFIG.CACHE_TTL_MS||300000)){const m=meta();return !!ownerId&&m.owner_id===ownerId&&Date.now()-(m.synced_at||0)<maxAge;}
  function reset(){localStorage.removeItem(KEY);localStorage.removeItem(META);seed();}
  window.AppStorage={get,set,meta,seed,reset,touch,isFresh,empty,restoreFromIndexedDB,flushWrites};
})();
