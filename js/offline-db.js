(function(){
  const DB_NAME='classcheckAttendanceDB';
  const VERSION=1;
  let dbPromise;
  function openDB(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,VERSION);
      req.onupgradeneeded=e=>{
        const db=e.target.result;
        if(!db.objectStoreNames.contains('attendance'))db.createObjectStore('attendance',{keyPath:'key'});
        if(!db.objectStoreNames.contains('syncQueue'))db.createObjectStore('syncQueue',{keyPath:'id'});
        if(!db.objectStoreNames.contains('sessions'))db.createObjectStore('sessions',{keyPath:'key'});
      };
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    return dbPromise;
  }
  async function put(store,value){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>res(value);tx.onerror=()=>rej(tx.error);});}
  async function get(store,key){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
  async function all(store){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}
  async function remove(store,key){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
  async function attendanceFor(classId,date,teacherId=null){return (await all('attendance')).filter(x=>x.class_id===classId&&x.attendance_date===date&&(!teacherId||x.teacher_id===teacherId));}
  async function saveQueued(store,record,op){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction([store,'syncQueue'],'readwrite');tx.objectStore(store).put(record);tx.objectStore('syncQueue').put(op);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async function acknowledge(op){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('syncQueue','readwrite');const store=tx.objectStore('syncQueue');const req=store.get(op.id);req.onsuccess=()=>{if(req.result?.revision===op.revision)store.delete(op.id);};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  window.OfflineDB={version:'13.4',openDB,saveQueued,acknowledge,put,get,all,remove,attendanceFor};
})();
