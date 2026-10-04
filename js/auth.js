(function(){
  document.addEventListener('DOMContentLoaded',async()=>{
    if(!APP_CONFIG.DEMO_MODE){
      try{
        const session=await Supa.getSession();
        if(session){
          const ctx=await Supa.requireTeacher();
          await Supa.loadState(ctx,true);
          App.navigate('attendance.html');
          return;
        }
      }catch(err){console.warn(err)}
    }

    const signInTab=document.getElementById('showSignIn');
    const createTab=document.getElementById('showCreate');
    const loginForm=document.getElementById('loginForm');
    const createForm=document.getElementById('createForm');
    const authNote=document.getElementById('authNote');
    function mode(which){
      const creating=which==='create';
      loginForm.classList.toggle('hidden',creating);
      createForm.classList.toggle('hidden',!creating);
      signInTab.classList.toggle('active',!creating);
      createTab.classList.toggle('active',creating);
      authNote.textContent=creating?'Create a ClassCheck teacher account. You do not need a Mathside account.':'Sign in with your ClassCheck teacher account.';
    }
    signInTab.onclick=()=>mode('signin');
    createTab.onclick=()=>mode('create');

    loginForm.addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=loginForm.querySelector('button[type="submit"]');const original=btn.textContent;
      try{
        btn.disabled=true;btn.textContent='Signing in…';
        await App.withLoading('Signing you in…','Opening your ClassCheck workspace.',async()=>{
          if(APP_CONFIG.DEMO_MODE)return;
          const supa=Supa.getClient();
          const email=document.getElementById('email').value.trim();
          const password=document.getElementById('password').value;
          const {error}=await supa.auth.signInWithPassword({email,password});
          if(error)throw error;
          const ctx=await Supa.requireTeacher();
          await Supa.loadState(ctx,true);
        },{minimum:380});
        App.navigate('attendance.html');
      }catch(err){console.error(err);App.toast(err?.message||'Unable to sign in. Check your email, password, and connection.');}
      finally{btn.disabled=false;btn.textContent=original;}
    });

    createForm.addEventListener('submit',async e=>{
      e.preventDefault();
      const fd=new FormData(createForm);
      const fullName=String(fd.get('full_name')||'').trim();
      const email=String(fd.get('email')||'').trim();
      const password=String(fd.get('password')||'');
      const confirm=String(fd.get('confirm_password')||'');
      if(password.length<6){App.toast('Use at least 6 characters for your password.');return;}
      if(password!==confirm){App.toast('Passwords do not match.');return;}
      const btn=createForm.querySelector('button[type="submit"]');const original=btn.textContent;
      try{
        btn.disabled=true;btn.textContent='Creating…';
        const result=await App.withLoading('Creating your account…','Setting up your ClassCheck teacher workspace.',async()=>{
          const supa=Supa.getClient();
          const {data,error}=await supa.auth.signUp({email,password,options:{data:{full_name:fullName}}});
          if(error)throw error;
          if(data.session){
            await Supa.ensureProfile(data.user,fullName);
            const ctx={user:data.user,teacherProfile:null};
            await Supa.loadState(ctx,true);
          }
          return data;
        },{minimum:520});
        if(result.session){App.navigate('attendance.html');}
        else{
          authNote.textContent='Account created. Check your email to confirm the account, then sign in.';
          mode('signin');
          document.getElementById('email').value=email;
          App.toast('Account created. Please confirm your email.');
        }
      }catch(err){console.error(err);App.toast(err?.message||'Unable to create the account.');}
      finally{btn.disabled=false;btn.textContent=original;}
    });
  });
})();
