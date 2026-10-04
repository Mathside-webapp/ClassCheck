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
