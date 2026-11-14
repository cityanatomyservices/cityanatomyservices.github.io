// CAPCOG's public address points cover the metro, including its smaller cities.
export const ADDRESS_SERVICE='https://services5.arcgis.com/8DjE4f6iFLArDhsU/arcgis/rest/services/Regional_Address_Points/FeatureServer/0/query';
export const METRO_COUNTIES=['Travis','Williamson','Hays','Bastrop','Caldwell'];
const countyNames=new Set(METRO_COUNTIES.map(n=>n.toUpperCase()));
const countyCodes=new Set(['453','491','209','021','055']);
const abbreviations={NORTH:'N',SOUTH:'S',EAST:'E',WEST:'W',STREET:'ST',ROAD:'RD',DRIVE:'DR',LANE:'LN',BOULEVARD:'BLVD',AVENUE:'AVE',COURT:'CT',CIRCLE:'CIR',TRAIL:'TRL',PARKWAY:'PKWY',HIGHWAY:'HWY'};
const clean=value=>String(value||'').trim().replace(/\s+/g,' ');
const quoted=value=>"'"+value.replaceAll("'","''")+"'";
// A generous coordinate sanity check; county membership defines eligibility.
const localPoint=(latitude,longitude)=>Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=29&&latitude<=31.5&&longitude>=-99&&longitude<=-96;

export function addressQuery(address){
 const text=clean(address).toUpperCase().replace(/[^A-Z0-9/' -]/g,' '),match=text.match(/^(\d{1,7})\s+(.+)$/);
 if(!match)return null;
 const terms=match[2].split(/\s+/).filter(Boolean).filter(t=>!['TX','TEXAS','USA','US'].includes(t)).map(t=>abbreviations[t]||t);
 if(!terms.length||terms.length>24)return null;
 const clauses=[`Add_Number = ${Number(match[1])}`,"UPPER(A1) = 'TX'",`UPPER(A2) IN (${[...countyNames].map(quoted).join(',')})`];
 for(const term of terms){
  // Match word beginnings, not arbitrary substrings: "2nd" must not find 32nd,
  // and a house-number fraction must not satisfy the street-name search.
  const fields=term==='1/2'?['FULL_ADDR']:['FULL_NAME','Post_Comm','MSAGComm'];
  const comparisons=fields.flatMap(field=>/^[NSEW]$/.test(term)
   ?[`UPPER(${field}) = ${quoted(term)}`,`UPPER(${field}) LIKE ${quoted(term+' %')}`,`UPPER(${field}) LIKE ${quoted('% '+term+' %')}`,`UPPER(${field}) LIKE ${quoted('% '+term)}`]
   :[`UPPER(${field}) LIKE ${quoted(term+'%')}`,`UPPER(${field}) LIKE ${quoted('% '+term+'%')}`]);
  clauses.push('('+[...comparisons,`Post_Code LIKE ${quoted(term+'%')}`].join(' OR ')+')');
 }
 return clauses.join(' AND ');
}

export function regionalMatches(data){
 if(data.error||!Array.isArray(data.features))throw Error('Address suggestions unavailable');
 const unique=new Map();
 for(const f of data.features){
  const a=f.attributes||{},county=clean(a.A2),street=clean(a.FULL_ADDR),city=clean(a.Post_Comm)||clean(a.MSAGComm);
  const latitude=f.geometry?.y,longitude=f.geometry?.x;
  if(clean(a.A1).toUpperCase()!=='TX'||!countyNames.has(county.toUpperCase())||!localPoint(latitude,longitude)||!/^\d/.test(street)||!city)continue;
  const label=`${street}, ${city}, TX${clean(a.Post_Code)?' '+clean(a.Post_Code):''}`,key=label.toUpperCase();
  if(!unique.has(key))unique.set(key,{label,latitude,longitude,county});
 }
 return [...unique.values()].sort((a,b)=>Number(!/, AUSTIN, TX/i.test(a.label))-Number(!/, AUSTIN, TX/i.test(b.label))||a.label.localeCompare(b.label,undefined,{numeric:true})).slice(0,6);
}

export function censusMatches(data){
 return (data.result?.addressMatches||[]).filter(m=>m.geographies?.Counties?.some(c=>c.STATE==='48'&&countyCodes.has(c.COUNTY)))
  .map(m=>({label:m.matchedAddress,latitude:m.coordinates?.y,longitude:m.coordinates?.x}))
  .filter(m=>typeof m.label==='string'&&localPoint(m.latitude,m.longitude)).slice(0,6);
}

export async function searchAddresses(address,fetcher,suggestOnly=false){
 const where=addressQuery(address);
 if(where){
  try{
   const url=new URL(ADDRESS_SERVICE);url.search=new URLSearchParams({f:'json',where,outFields:'FULL_ADDR,A1,A2,Post_Comm,MSAGComm,Post_Code',returnGeometry:'true',outSR:'4326',resultRecordCount:'40',orderByFields:'FULL_ADDR,Post_Comm,OBJECTID'});
   const response=await fetcher(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Address suggestions unavailable');
   const matches=regionalMatches(await response.json());if(matches.length||suggestOnly)return matches;
  }catch(error){if(suggestOnly)throw error;}
 }else if(suggestOnly)return [];
 // Full-address fallback must also verify the county, never just an Austin bias.
 const url=new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
 url.search=new URLSearchParams({address:clean(address),benchmark:'Public_AR_Current',vintage:'Current_Current',layers:'Counties',format:'json'});
 const response=await fetcher(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Address lookup unavailable');
 return censusMatches(await response.json());
}
