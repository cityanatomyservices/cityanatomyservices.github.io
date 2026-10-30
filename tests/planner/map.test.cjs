const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../planner/map.js'),'utf8');

// MapLibre registers Object in the map's own window for worker transfer.
// A plain geometry from the parent-owned Supabase client has another Object
// constructor and is rejected, even though it contains valid GeoJSON.
function checkWorkerData(value) {
  if(value===null||typeof value!=='object')return;
  if(Array.isArray(value)){value.forEach(checkWorkerData);return;}
  if(value.constructor!==Object)throw new Error("can't serialize object of unregistered class Object");
  Object.values(value).forEach(checkWorkerData);
}
function harness(loaded=true) {
  let map;
  const elements=new Map();
  const document={addEventListener(){},getElementById(id){
    if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',setAttribute(){},addEventListener(){}});
    return elements.get(id);
  }};
  class MapStub {
    constructor(){map=this;this.loaded=loaded;this.sources=new Map();this.layers=[];this.events={};}
    isStyleLoaded(){return this.loaded;}
    addControl(){}
    on(name,fn){this.events[name]=fn;}
    addSource(id,options){checkWorkerData(options.data);this.sources.set(id,{data:options.data,setData(data){checkWorkerData(data);this.data=data;}});}
    getSource(id){return this.sources.get(id);}
    addLayer(layer){this.layers.push(layer);}
  }
  const window={PlanModel:{},PlanRouting:{coordinates:item=>item?.source?.coordinates}};
  const maplibregl={Map:MapStub,AttributionControl:class{},NavigationControl:class{}};
  new Function('window','document','maplibregl','ResizeObserver','fetch',source)(
    window,document,maplibregl,class{observe(){}},async()=>({ok:false}));
  return {api:window.PlanMap,map,document};
}
const parentLegs=()=>vm.runInNewContext(`[
  {geometry:{type:'LineString',coordinates:[[-97.74,30.27],[-97.72,30.30]]}},
  {geometry:{type:'MultiLineString',coordinates:[[[-97.72,30.30],[-97.70,30.31]]]}},
  {geometry:null}
]`);

test('parent-window route geometry reaches the map worker and survives route refresh',()=>{
  const h=harness(),legs=parentLegs();
  assert.throws(()=>checkWorkerData(legs),/unregistered class Object/);
  h.api.routes(legs);
  const data=h.map.getSource('planner-routes').data;
  assert.equal(data.features.length,2);
  assert.deepEqual(data.features[0].geometry.coordinates,[[-97.74,30.27],[-97.72,30.30]]);
  assert.deepEqual(h.map.layers.map(x=>x.id),['planner-route-casing','planner-route-lines']);
  legs[0].geometry.coordinates[0][0]=0;
  assert.equal(data.features[0].geometry.coordinates[0][0],-97.74);
  h.api.routes(parentLegs());
  assert.equal(h.map.layers.length,2);
  assert.equal(h.map.getSource('planner-routes').data.features.length,2);
  h.api.routes([]);
  assert.equal(h.map.getSource('planner-routes').data.features.length,0);
});

test('routes returned before the basemap loads are drawn when it becomes ready',()=>{
  const h=harness(false);
  h.api.routes(parentLegs());
  assert.equal(h.map.getSource('planner-routes'),undefined);
  h.map.loaded=true;h.map.events.idle();
  assert.equal(h.map.getSource('planner-routes').data.features.length,2);
});
