import {circle} from './model.mjs?v=20261109h';
export async function createMap(container){
 const map=new maplibregl.Map({container,style:'https://tiles.openfreemap.org/styles/positron',center:[-97.7431,30.2672],zoom:14,pitch:0,attributionControl:true});
 window.geofenceMap=map;
 map.addControl(new maplibregl.NavigationControl(),'top-right');
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Map could not load. Reload to try again.')),30000);map.once('load',()=>{clearTimeout(timer);resolve();});});}catch(error){map.remove();throw error;}
 let last;
 function draw(fence,fit=true){last=fence;const feature=circle(fence);
  if(!map.getSource('custom-circle')){map.addSource('custom-circle',{type:'geojson',data:feature});map.addLayer({id:'custom-circle-fill',type:'fill',source:'custom-circle',paint:{'fill-color':'#007c75','fill-opacity':.22}});map.addLayer({id:'custom-circle-edge',type:'line',source:'custom-circle',paint:{'line-color':'#007c75','line-width':3}});}else map.getSource('custom-circle').setData(feature);
  if(fit){const b=feature.geometry.coordinates[0].reduce((bounds,p)=>bounds.extend(p),new maplibregl.LngLatBounds());map.fitBounds(b,{padding:70,maxZoom:19,duration:400});}
 }
 const observer=new ResizeObserver(()=>map.resize());observer.observe(typeof container==='string'?document.getElementById(container):container);
 return {map,draw,fit:()=>last&&draw(last),remove(){observer.disconnect();map.remove();}};
}
