/* Only display choices sync. Never copy identity, GPS, searches or plan data. */
(() => {
  try {if(window.parent!==window&&window.parent.AustinMember===window.AustinMember&&window.parent.AustinPreferences){window.AustinPreferences=window.parent.AustinPreferences;return;}}catch(_){}
  const keys={theme:'theme',explore:'austin-explore-v1',ticker:'austin-ticker-preferences-v1',navigation:'austin:navigation-app'};
  const M=window.AustinMember,listeners=new Set();let error='';
  function clean(key,value) {
    if(key==='theme')return value==='dark'?'dark':'light';
    if(key==='navigation')return ['google','apple','waze'].includes(value)?value:'google';
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    if(key==='explore')return Object.fromEntries(['enabled','when','price','kind','movieType'].filter(k=>value[k]!==undefined).map(k=>[k,value[k]]));
    return JSON.parse(JSON.stringify(value));
  }
  function apply(key,value) {
    if(!keys[key])return;
    value=clean(key,value);const text=['theme','navigation'].includes(key)?value:JSON.stringify(value);
    try {const old=localStorage.getItem(keys[key]);if(old===text)return;localStorage.setItem(keys[key],text);
      window.dispatchEvent(new StorageEvent('storage',{key:keys[key],oldValue:old,newValue:text,storageArea:localStorage}));
    }catch(_){}
  }
  const notify=()=>listeners.forEach(fn=>fn(error));
  function sync(){for(const [key,value] of Object.entries(M.state?.preferences||{}))apply(key,value);}
  M.subscribe(section=>{if(['loaded','preferences'].includes(section))sync();});
  window.AustinPreferences={
    set(key,value){apply(key,value);return M.preference(key,clean(key,value)).then(()=>{error='';notify();}).catch(()=>{error='Display choices work on this device. Account sync failed; change the setting again to retry.';notify();});},
    get error(){return error;},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
  };
  M.ready().then(sync).catch(()=>{});
})();
