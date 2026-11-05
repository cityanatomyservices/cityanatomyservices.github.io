/* Inventory the site's published data; never include account exports or config secrets. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const files=cp.execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0');
const privateFiles=JSON.parse(fs.readFileSync(path.join(root,'billing/pro-assets.json'),'utf8')).files;
const title=s=>s.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const reports=[];
for(const file of files){
 if(!/^(AISD|budget|datacenters|news|chat\/data|apps\/[^/]+)\/.+\.geojson$/.test(file)&&
    !/^chat\/data\/places\/(?!index\.json)[^/]+\.json$/.test(file)&&!['chat/data/city-hall.json','ticker/feed.json','ticker/scores.json'].includes(file))continue;
 const value=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 const key=Array.isArray(value)?null:value.type==='FeatureCollection'?'features':['records','items','groups'].find(k=>Array.isArray(value[k]))||Object.keys(value).find(k=>Array.isArray(value[k]));
 if(key===undefined)continue;
 const rows=key===null?value:value[key],sample=rows[0]?.properties||rows[0]||{};
 const dateField=['created_at','starts_at','start','date','startDate','published_at','published'].find(k=>k in sample)||null;
 const section=file.startsWith('chat/data/places/')?'Neighborhood businesses':file.startsWith('chat/data/explore/')?'Explore':file.split('/')[0]==='apps'?'Shopping Apps':file.startsWith('chat/')?'Neighborhoods and City Hall':title(file.split('/')[0]);
 const label=title(file.endsWith('/data.geojson')?file.split('/')[1]:path.basename(file).replace(/\.(geo)?json$/,''));
 reports.push({id:'data:'+file,title:label,section,key,dateField,
  url:privateFiles['/'+file]?'https://raw.githubusercontent.com/cityanatomyservices/cityanatomyservices.github.io/main/'+file:'/'+file,
  description:dateField?'Published dataset. Dates filter '+dateField+'.':'Published dataset. No date column; leave date filters blank.'});
}
reports.sort((a,b)=>a.section.localeCompare(b.section)||a.title.localeCompare(b.title));
fs.mkdirSync(path.join(root,'dashboard'),{recursive:true});
fs.writeFileSync(path.join(root,'dashboard/datasets.json'),JSON.stringify(reports,null,2)+'\n');
console.log('Cataloged '+reports.length+' site datasets. No subscriber data included.');
