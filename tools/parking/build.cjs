/* Public parking snapshots. City and OSM data remain separate for attribution/licensing. */
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'chat/data/parking');
const CITY='https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Parking_Inventory_FME_UPDATE_view/FeatureServer';
// Austin-area coverage, including its north/south neighborhoods; not a claim of citywide completeness.
const BOUNDS=[-98.05,30.00,-97.50,30.60];
const trim=v=>String(v??'').trim().slice(0,1200);
const point=c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&c[0]>=BOUNDS[0]&&c[0]<=BOUNDS[2]&&c[1]>=BOUNDS[1]&&c[1]<=BOUNDS[3];
const feature=(id,geometry,properties)=>({type:'Feature',id,geometry,properties});
function cityCategory(type){
  // Flex/hybrid curbs can change use by time. Do not flatten these to ordinary parking.
  if(/^(Flex|Hybrid)/i.test(type))return 'conditional';
  if(type==='Marked ADA Zone')return 'accessible';
  if(['Paystation Zone','Mobile Pay','Parking Meter Zone','Time Limited Parking','Unrestricted Parking'].includes(type))return 'street';
  return null;
}
function citySpace(f){
  const p=f.properties,type=trim(p.PARKING_SPACE_TYPE),kind=cityCategory(type);
  if(!kind||kind==='conditional'||!point(f.geometry?.coordinates))return null;
  return feature('city-space-'+p.PARKING_SPACE_ID,{type:'Point',coordinates:f.geometry.coordinates.map(n=>+n.toFixed(6))},{name:type==='Marked ADA Zone'?'Accessible street space':'Street parking',kind,type,space:trim(p.PARKING_SPACE_ID)});
}
function cityZone(f){
  const p=f.properties,type=trim(p.PARKING_TYPE),kind=cityCategory(type);
  const mixed=trim(p.ALL_RESTRICTION_TYPES);
  if(!kind||!['LineString','MultiLineString'].includes(f.geometry?.type))return null;
  const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates;
  if(!lines.length||!lines.every(line=>line.length>=2&&line.every(point)))return null;
  // Keep scheduled/mixed-use zones visibly conditional and display all source restrictions.
  return feature('city-zone-'+p.PARKING_ZONE_ID,f.geometry,{name:trim(p.BLOCK_NAME)||'Street parking zone',kind:kind==='conditional'||mixed&&mixed!==type?'conditional':kind,type,restrictions:mixed,hours:trim(p.HOURS_OF_OPERATION),schedule:trim(p.DAY_HOUR_CONCATENATE),limit:trim(p.TIME_LIMIT),paymentZone:trim(p.MOBILE_PAY_ID),notes:trim(p.COMMENTS)});
}
function osmFacility(el){
  const t=el.tags||{},at=el.type==='node'?[el.lon,el.lat]:[el.center?.lon,el.center?.lat];
  if(t.amenity!=='parking'||!point(at)||['private','no','customers','permit','delivery','agricultural','forestry'].includes(t.access)||t.disused==='yes'||t.abandoned==='yes')return null;
  if(['lane','street_side','layby'].includes(t.parking))return null; // City is the source for street parking.
  const garage=['multi-storey','underground','garage','rooftop'].includes(t.parking);
  return feature('osm-'+el.type+'-'+el.id,{type:'Point',coordinates:at.map(n=>+n.toFixed(6))},{name:trim(t.name)|| (garage?'Parking garage':'Parking lot'),kind:garage?'garage':'lot',type:garage?'Garage':'Surface / other parking',access:['yes','public','permissive','designated'].includes(t.access)?'Public access mapped':'Access not recorded — check signs',conditional:trim(t['access:conditional']),fee:t.fee==='no'?'No fee mapped':t.fee==='yes'?'Paid parking':'Fee not recorded',feeConditional:trim(t['fee:conditional']),hours:trim(t.opening_hours),capacity:/^\d+$/.test(t.capacity||'')?t.capacity:'',accessible:trim(t['capacity:disabled']),height:trim(t.maxheight),operator:trim(t.operator),sourceUrl:`https://www.openstreetmap.org/${el.type}/${el.id}`});
}
async function json(url,options={}){
  const response=await fetch(url,{...options,headers:{'User-Agent':'AustinChatParking/1.0 (https://austin.chat/contact/)',...options.headers},signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error(`HTTP ${response.status}: ${url.split('?')[0]}`);
  const data=await response.json();if(data.error||data.remark)throw Error(data.error?.message||data.remark);return data;
}
async function city(layer,fields){
  const features=[];
  for(let offset=0;;offset+=2000){
    const query=new URLSearchParams({where:'1=1',outFields:fields,orderByFields:'OBJECTID',resultOffset:String(offset),resultRecordCount:'2000',outSR:'4326',f:'geojson'});
    const data=await json(`${CITY}/${layer}/query?${query}`);
    if(!Array.isArray(data.features))throw Error('Invalid City response');features.push(...data.features);
    if(!data.properties?.exceededTransferLimit&&!data.exceededTransferLimit)break;
    if(!data.features.length||offset>60000)throw Error('Incomplete City pagination');
  }
  return features;
}
async function build(){
  const [spaces,zones]=await Promise.all([
    city(1,'OBJECTID,PARKING_SPACE_ID,PARKING_SPACE_TYPE'),
    city(0,'OBJECTID,PARKING_ZONE_ID,BLOCK_NAME,PARKING_TYPE,HOURS_OF_OPERATION,ALL_RESTRICTION_TYPES,TIME_LIMIT,MOBILE_PAY_ID,COMMENTS,DAY_HOUR_CONCATENATE')
  ]);
  const query=`[out:json][timeout:120];nwr["amenity"="parking"](${BOUNDS[1]},${BOUNDS[0]},${BOUNDS[3]},${BOUNDS[2]});out center tags;`;
  let osm,lastError;
  for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){
    try{osm=await json(endpoint,{method:'POST',body:new URLSearchParams({data:query})});break;}catch(error){lastError=error;}
  }
  if(!osm?.elements?.length)throw lastError||Error('Empty OSM response');
  const generated=new Date().toISOString();
  const data={
    'city-spaces.geojson':{type:'FeatureCollection',generated,source:CITY+'/1',attribution:'City of Austin Transportation and Public Works',features:spaces.map(citySpace).filter(Boolean)},
    'city-zones.geojson':{type:'FeatureCollection',generated,source:CITY+'/0',attribution:'City of Austin Transportation and Public Works',features:zones.map(cityZone).filter(Boolean)},
    'osm-parking.geojson':{type:'FeatureCollection',generated,sourceDate:osm.osm3s?.timestamp_osm_base,license:'https://opendatacommons.org/licenses/odbl/1-0/',attribution:'© OpenStreetMap contributors',bounds:BOUNDS,features:osm.elements.map(osmFacility).filter(Boolean)}
  };
  const minimums={'city-spaces.geojson':5000,'city-zones.geojson':500,'osm-parking.geojson':100};
  // Fetch and validate everything before touching the last good snapshots.
  for(const [file,value] of Object.entries(data)){
    if(value.features.length<minimums[file])throw Error(`Unexpectedly small ${file}: ${value.features.length}`);
    const old=path.join(OUT,file);if(fs.existsSync(old)&&value.features.length<JSON.parse(fs.readFileSync(old)).features.length*.7)throw Error(`Large drop in ${file}; retain the previous snapshot for review`);
  }
  fs.mkdirSync(OUT,{recursive:true});
  for(const [file,value] of Object.entries(data)){fs.writeFileSync(path.join(OUT,file),JSON.stringify(value)+'\n');console.log(`${file}: ${value.features.length} features`);}
}
module.exports={cityCategory,citySpace,cityZone,osmFacility,point};
if(require.main===module)build().catch(e=>{console.error(e.message);process.exitCode=1;});
