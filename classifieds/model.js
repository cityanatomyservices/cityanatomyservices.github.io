/* Text-only ad rules shared by the form and browser tests. SQL enforces them too. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ClassifiedsModel=api;})(globalThis,()=>{
  const categories=[['for-sale','For Sale'],['free','Free Stuff'],['services','Services'],['housing','Housing'],['jobs','Jobs'],['gigs','Gigs'],['community','Community'],['lost-found','Lost & Found']].map(([id,title])=>({id,title}));
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  function validate(category,title,body){
    if(!categories.some(c=>c.id===category))return 'Choose a category.';
    if(!clean(title)||clean(title).length>100)return 'Use a title of 1–100 characters.';
    if(!clean(body)||clean(body).length>1000)return 'Use a paragraph of 1–1,000 characters.';
    return '';
  }
  return {categories,clean,validate};
});
