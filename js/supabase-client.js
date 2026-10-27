(function(){
  let client=null;
  function getClient(){
    if(APP_CONFIG.DEMO_MODE) return null;
    if(client) return client;
    if(!window.supabase) throw new Error('Supabase SDK not loaded');
    client=window.supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    return client;
  }
  // Browsers sometimes report `online` while Wi-Fi has no usable Internet.
  // Use a previous device session ONLY for the matching cached classroom account.
  function cachedOfflineSession(){
    try{
      const saved=JSON.parse(localStorage.getItem('classcheck_offline_user')||'null');
      if(saved?.id&&AppStorage.meta().owner_id===saved.id){
        return {user:saved,offline:true};
      }
    }catch(err){console.warn('Stored offline login is unavailable',err);}
    return null;
  }
  async function bounded(promise,ms){
    let timer;
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Connection timed out')),ms);})]);}
    finally{clearTimeout(timer);}
  }
  async function getSession(){
    const local=cachedOfflineSession();
    if(!navigator.onLine&&local)return local;
    try{
      const supa=getClient();
      const {data,error}=await bounded(supa.auth.getSession(),local?3500:8000);
      if(error)throw error;
      if(data.session){
        localStorage.setItem('classcheck_offline_user',JSON.stringify({id:data.session.user.id,email:data.session.user.email}));
      }
      return data.session||null;
    }catch(err){
      if(local){console.warn('Using the saved ClassCheck session while the network is unavailable.',err);return local;}
      throw err;
    }
  }
  async function requireTeacher(){
    if(APP_CONFIG.DEMO_MODE)return {user:{id:'demo-teacher',email:'teacher@example.com'},teacherProfile:null};
    const session=await getSession();
    if(!session){(window.App?.navigate?App.navigate('index.html'):location.href='index.html');throw new Error('AUTH_REQUIRED');}
    return {user:session.user,teacherProfile:null};
  }
  async function ensureProfile(user,seedName=''){
    const supa=getClient();
    let {data,error}=await supa.from('classcheck_profiles').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(data)return data;
    const displayName=String(seedName||user.user_metadata?.full_name||sessionStorage.getItem('classcheck_teacher_name')||'').trim();
    const {data:created,error:createError}=await supa.from('classcheck_profiles')
      .insert({user_id:user.id,full_name:displayName,position:'Teacher'})
      .select('*').single();
    if(createError)throw createError;
    return created;
  }
  async function loadState(ctx,force=false){
    if(APP_CONFIG.DEMO_MODE)return AppStorage.get();
    const userId=ctx.user.id;
    const cached=AppStorage.meta().owner_id===userId?AppStorage.get():null;
    if(!navigator.onLine||ctx.offline){
      if(cached)return cached;
      throw new Error('Connect once to download this account’s classes and learner roster.');
    }
    if(!force&&cached&&AppStorage.isFresh(userId))return cached;
    const supa=getClient();
    try{
      // Never strand an already-downloaded roster behind a disconnected API call.
      return await bounded((async()=>{
        const profile=await ensureProfile(ctx.user);
        const [classesRes,studentsRes,teachersRes]=await Promise.all([
          supa.from('classcheck_classes').select('id,teacher_id,grade_level,section_name,school_year,adviser_name,class_color,archived,enrollment_baseline_male,enrollment_baseline_female,enrollment_baseline_set_at,created_at,updated_at').order('created_at',{ascending:true}),
          supa.from('classcheck_students').select('*').eq('archived',false).order('last_name',{ascending:true}),
          supa.from('classcheck_class_teachers').select('*').order('joined_at',{ascending:true})
        ]);
        if(classesRes.error)throw classesRes.error;
        if(studentsRes.error)throw studentsRes.error;
        if(teachersRes.error)throw teachersRes.error;
        const state={profile,classes:classesRes.data||[],students:studentsRes.data||[],classTeachers:teachersRes.data||[]};
        AppStorage.set(state,userId);
        sessionStorage.setItem('classcheck_teacher_name',profile.full_name||'Teacher');
        return state;
      })(),cached?4500:12000);
    }catch(err){
      console.warn('Using the cached ClassCheck roster when a refresh is unavailable.',err);
      if(cached)return cached;
      throw new Error('Unable to load your classes. Connect once to download your roster.');
    }
  }
  async function signOut(options={}){
    const redirect=options.redirect!==false;
    const uid=(await getSession())?.user?.id;
    if(window.OfflineDB && (await OfflineDB.all('syncQueue')).some(x=>x.payload.teacher_id===uid))throw new Error('Sync pending attendance before signing out.');
    if(APP_CONFIG.DEMO_MODE){if(redirect)(window.App?.navigate?App.navigate('index.html'):location.href='index.html');return;}
    const supa=getClient();
    const {error}=await supa.auth.signOut({scope:'local'});
    if(error)throw error;
    sessionStorage.removeItem('classcheck_teacher_name');
    localStorage.removeItem('classcheck_offline_user');
    AppStorage.reset();
    if(redirect)(window.App?.navigate?App.navigate('index.html'):location.href='index.html');
  }
  window.Supa={getClient,getSession,requireTeacher,ensureProfile,loadState,signOut};
})();
