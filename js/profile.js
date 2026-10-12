document.addEventListener('DOMContentLoaded',async()=>{
  let ctx;
  try{ctx=await AppBoot.ready();}catch(err){console.error(err);return;}
  if(!App.isUnified())App.nav('profile');
  const supa=Supa.getClient();
  const userId=ctx.user.id;
  let state=AppStorage.get();
  const form=document.getElementById('profileForm');
  function fillProfile(){Object.entries(state.profile||{}).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v||'';});}
  fillProfile();
  form.onsubmit=async e=>{
    e.preventDefault();
    const submit=form.querySelector('button[type="submit"],button:not([type])');if(submit)submit.disabled=true;
    const fd=new FormData(form);
    const row={user_id:userId};
    for(const k of ['full_name','school_name','school_head_name','school_id','school_year','region','division','district','position'])row[k]=String(fd.get(k)||'').trim();
    try{
      const data=await App.withLoading('Saving your profile…','Updating your ClassCheck teacher information.',async()=>{
        const {data,error}=await supa.from('classcheck_profiles').upsert(row,{onConflict:'user_id'}).select('*').single();
        if(error)throw error;
        return data;
      });
      state.profile=data;AppStorage.set(state,userId);sessionStorage.setItem('classcheck_teacher_name',data.full_name||'Teacher');App.toast('Profile saved');
    }catch(error){console.error(error);App.toast('Unable to save profile.');}
    finally{if(submit)submit.disabled=false;}
  };
  const deleteButton=document.getElementById('deleteMyAccountBtn');
  const deleteDialog=document.getElementById('deleteAccountDialog');
  const deleteForm=document.getElementById('deleteAccountForm');
  const deletePassword=document.getElementById('deleteAccountPassword');
  const deletePhrase=document.getElementById('deleteAccountPhrase');
  const deleteSubmit=document.getElementById('confirmDeleteAccountBtn');
  const deleteStatus=document.getElementById('deleteAccountFormStatus');
  function hideAccountDialog(){deleteDialog.hidden=true;deleteForm.reset();deleteSubmit.disabled=true;deleteStatus.textContent='';}
  if(deleteDialog){
    deleteButton?.addEventListener('click',()=>{
      if(APP_CONFIG.DEMO_MODE){App.toast('Account deletion is unavailable in demo mode.');return;}
      deleteDialog.hidden=false;deleteForm.reset();deleteSubmit.disabled=true;deleteStatus.textContent='';
      setTimeout(()=>deletePassword.focus(),30);
    });
    document.getElementById('cancelDeleteAccountBtn')?.addEventListener('click',hideAccountDialog);
    deleteDialog.addEventListener('click',event=>{if(event.target===deleteDialog)hideAccountDialog()});
    deletePhrase?.addEventListener('input',()=>{deleteSubmit.disabled=deletePhrase.value.trim()!=='DELETE MY ACCOUNT'||!deletePassword.value;});
    deletePassword?.addEventListener('input',()=>{deleteSubmit.disabled=deletePhrase.value.trim()!=='DELETE MY ACCOUNT'||!deletePassword.value;});
    deleteForm?.addEventListener('submit',async event=>{
      event.preventDefault();
      if(deletePhrase.value.trim()!=='DELETE MY ACCOUNT'||!deletePassword.value)return;
      const ok=await App.confirmAction({title:'Final warning — delete everything?',
        message:'This permanently deletes your ClassCheck account and your data. If you own advisory classes, their rosters and every teacher’s attendance in those classes will also be erased. There is no undo.',
        confirmText:'Yes, delete my account',danger:true});
      if(!ok)return;
      deleteSubmit.disabled=true;deleteStatus.textContent='Verifying your account…';
      try{
        const email=ctx.user.email;
        if(!email)throw new Error('This account has no email. Contact support for verified deletion.');
        // Reauthenticate the *signed-in owner* immediately before the destructive request.
        const {data:reauth,error:authError}=await supa.auth.signInWithPassword({email,password:deletePassword.value});
        if(authError)throw new Error('Incorrect password. Your account was not deleted.');
        if(reauth?.user?.id!==userId)throw new Error('Account verification failed. No changes were made.');
        deleteStatus.textContent='Deleting your account and Supabase data…';
        const {data,error}=await supa.functions.invoke('classcheck-delete-my-account',{body:{confirmation:'DELETE MY ACCOUNT',password:deletePassword.value}});
        if(error||!data?.deleted)throw new Error(data?.error||error?.message||'Deletion was not completed.');
        // Remove offline state; never restore deleted account data after next login.
        try{AppStorage.reset()}catch{}
        try{indexedDB.deleteDatabase('classcheckAttendanceDB')}catch{}
        try{sessionStorage.removeItem('classcheck_teacher_name')}catch{}
        try{await supa.auth.signOut({scope:'local'})}catch{}
        hideAccountDialog();
        App.navigate('index.html');
      }catch(error){console.error('Account deletion request failed:',error);deleteStatus.textContent=error?.message||'Could not delete your account; no confirmation received.';App.toast('Account deletion did not complete.');}
      finally{deleteSubmit.disabled=deletePhrase.value.trim()!=='DELETE MY ACCOUNT';}
    });
  }
  document.addEventListener('classcheck:panelchange',e=>{if(e.detail?.panel==='profile'){state=AppStorage.get();fillProfile();}});
  document.getElementById('signOutBtn')?.addEventListener('click',async()=>{
    const ok=await App.confirmAction({title:'Sign out of ClassCheck?',message:'Your saved ClassCheck data will remain in Supabase and on this device.',confirmText:'Sign out'});
    if(!ok)return;
    try{
      await App.withLoading('Signing you out…','Closing this ClassCheck session safely.',()=>Supa.signOut({redirect:false}),{minimum:420});
      App.navigate('index.html');
    }catch(error){console.error(error);App.toast('Unable to sign out. Please try again.');}
  });
});
