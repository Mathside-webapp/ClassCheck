(function(){
  let readyPromise=null;
  let context=null;
  async function ready(options={}){
    if(readyPromise&&!options.force)return readyPromise;
    readyPromise=(async()=>{
      const ctx=await Supa.requireTeacher();
      const state=await Supa.loadState(ctx,!!options.force);
      context={...ctx,state};
      return context;
    })();
    try{return await readyPromise}catch(err){readyPromise=null;throw err}
  }
  function getContext(){return context;}
  window.AppBoot={ready,getContext};
})();
