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
  async function getSession(){
    const supa=getClient();
    const {data,error}=await supa.auth.getSession();
    if(error)throw error;
    return data.session||null;
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
    if(!force&&AppStorage.isFresh(userId))return AppStorage.get();
    const supa=getClient();
    try{
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
    }catch(err){
      console.error('ClassCheck bootstrap failed',err);
      const cached=AppStorage.get();
      if(!navigator.onLine&&cached)return cached;
      throw err;
    }
  }
  async function signOut(options={}){
    const redirect=options.redirect!==false;
    if(APP_CONFIG.DEMO_MODE){if(redirect)(window.App?.navigate?App.navigate('index.html'):location.href='index.html');return;}
    const supa=getClient();
    const {error}=await supa.auth.signOut({scope:'local'});
    if(error)throw error;
    sessionStorage.removeItem('classcheck_teacher_name');
    AppStorage.reset();
    if(redirect)(window.App?.navigate?App.navigate('index.html'):location.href='index.html');
  }
  window.Supa={getClient,getSession,requireTeacher,ensureProfile,loadState,signOut};
})();
