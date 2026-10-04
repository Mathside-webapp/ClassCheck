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
    try{
      const s=JSON.parse(localStorage.getItem(KEY))||empty();
      s.profile={...emptyProfile,...(s.profile||{})};
      if(!Array.isArray(s.classes))s.classes=[];
      if(!Array.isArray(s.students))s.students=[];
      if(!Array.isArray(s.classTeachers))s.classTeachers=[];
      return s;
    }catch{return empty()}
  }
  function set(state,ownerId){localStorage.setItem(KEY,JSON.stringify({...state,classTeachers:Array.isArray(state.classTeachers)?state.classTeachers:[]}));touch(ownerId);}
  function touch(ownerId){localStorage.setItem(META,JSON.stringify({owner_id:ownerId||null,synced_at:Date.now()}));}
  function meta(){try{return JSON.parse(localStorage.getItem(META))||{}}catch{return {}}}
  function isFresh(ownerId,maxAge=(APP_CONFIG.CACHE_TTL_MS||300000)){const m=meta();return !!ownerId&&m.owner_id===ownerId&&Date.now()-(m.synced_at||0)<maxAge;}
  function reset(){localStorage.removeItem(KEY);localStorage.removeItem(META);seed();}
  window.AppStorage={get,set,seed,reset,touch,isFresh,empty};
})();
