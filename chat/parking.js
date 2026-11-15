/* Optional parking overlay. It reads public snapshots and never edits a plan. */
window.AustinParking={
  init(map){
    const button=document.getElementById('ctrlParking'),key=document.getElementById('parking-key'),status=document.getElementById('parking-status');
    if(!button)return;
    let enabled=false,pending,popup;
    const cityCredit='<a href="https://experience.arcgis.com/experience/5010870614c5488dbb107f599d15e8e1" target="_blank">City of Austin parking</a>';
    const datasets=[
      {id:'parking-spaces',file:'city-spaces.geojson',geometry:['Point'],credit:cityCredit},
      {id:'parking-zones',file:'city-zones.geojson',geometry:['LineString','MultiLineString'],credit:cityCredit},
      {id:'parking-facilities',file:'osm-parking.geojson',geometry:['Point'],credit:'<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors · ODbL</a>'}
    ];
    const interactive=['parking-facilities-points','parking-facilities-clusters','parking-spaces-points','parking-spaces-clusters','parking-zones-line'];
    const shown=()=>enabled&&!window.AustinChatMap?.active;
    const color=['match',['get','kind'],'accessible','#8255b4','conditional','#b57218','street','#007e83','#2465a6'];
    function draw(){
      for(const d of datasets){
        if(d.data&&enabled&&!map.getSource(d.id)){
          map.addSource(d.id,{type:'geojson',data:d.data,attribution:d.credit,...(d.id==='parking-zones'?{}:{cluster:true,clusterRadius:38,clusterMaxZoom:d.id==='parking-spaces'?15:12})});
          if(d.id==='parking-zones'){
            map.addLayer({id:d.id+'-halo',source:d.id,type:'line',minzoom:14,paint:{'line-color':'#ffffff','line-width':6,'line-opacity':.9}});
            map.addLayer({id:d.id+'-line',source:d.id,type:'line',minzoom:14,paint:{'line-color':color,'line-width':3,'line-opacity':.85}});
          }else{
            map.addLayer({id:d.id+'-clusters',source:d.id,type:'circle',filter:['has','point_count'],paint:{'circle-color':d.id==='parking-spaces'?'#007e83':'#2465a6','circle-radius':17,'circle-stroke-color':'#ffffff','circle-stroke-width':2}});
            map.addLayer({id:d.id+'-counts',source:d.id,type:'symbol',filter:['has','point_count'],layout:{'text-field':['concat','P ',['to-string',['get','point_count_abbreviated']]],'text-font':['Noto Sans Bold'],'text-size':11,'text-allow-overlap':true},paint:{'text-color':'#ffffff'}});
            map.addLayer({id:d.id+'-points',source:d.id,type:'circle',filter:['!', ['has','point_count']],paint:{'circle-color':color,'circle-radius':d.id==='parking-spaces'?['interpolate',['linear'],['zoom'],15,4,19,7]:12,'circle-stroke-color':'#ffffff','circle-stroke-width':2}});
            if(d.id==='parking-facilities')map.addLayer({id:d.id+'-letters',source:d.id,type:'symbol',filter:['!', ['has','point_count']],layout:{'text-field':'P','text-font':['Noto Sans Bold'],'text-size':14,'text-allow-overlap':true},paint:{'text-color':'#ffffff'}});
          }
        }
      }
      const discovery=map.getStyle().layers.find(l=>l.id.startsWith('explore-'))?.id;
      for(const layer of map.getStyle().layers.filter(l=>l.id.startsWith('parking-'))){
        map.setLayoutProperty(layer.id,'visibility',shown()?'visible':'none');
        if(discovery)map.moveLayer(layer.id,discovery);
      }
      key.hidden=!shown();button.setAttribute('aria-pressed',String(enabled));button.classList.toggle('is-on',enabled);
      button.title=enabled?'Hide parking':'Show parking';
      if(!shown()){popup?.remove();popup=null;}
    }
    function report(){
      const loaded=datasets.filter(d=>d.data);
      if(!enabled)return;
      if(!loaded.length){enabled=false;draw();key.hidden=false;status.textContent='Parking could not load. Tap P to retry.';return;}
      const dates=loaded.map(d=>Date.parse(d.data.generated)).filter(Number.isFinite),oldest=Math.min(...dates);
      const date=Number.isFinite(oldest)?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric'}).format(oldest):'';
      status.textContent=(loaded.length<datasets.length?'Some data unavailable · Tap P off/on to retry. ':`Checked ${date}${Date.now()-oldest>14*86400000?' · Update delayed':''}. `)+'Locations, not live availability. Follow posted signs.';
    }
    async function load(){
      if(pending)return pending;
      if(datasets.every(d=>d.data)){report();return;}
      status.textContent='Loading parking…';button.setAttribute('aria-busy','true');
      pending=Promise.allSettled(datasets.filter(d=>!d.data).map(async d=>{
        const response=await fetch('/chat/data/parking/'+d.file,{cache:'no-cache',signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw Error('Parking unavailable');
        const data=await response.json();
        if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.features.length||!Number.isFinite(Date.parse(data.generated))||!data.features.every(f=>d.geometry.includes(f.geometry?.type)&&f.properties?.kind))throw Error('Invalid parking data');
        d.data=data;
      })).then(()=>{draw();report();}).finally(()=>{pending=null;button.removeAttribute('aria-busy');});
      return pending;
    }
    function hit(point){
      if(!shown())return null;
      // Discovery pins stay above parking and retain their existing event popup.
      const discovery=map.getStyle().layers.filter(l=>/^explore-.*-(points|clusters)$/.test(l.id)).map(l=>l.id);
      if(discovery.length&&map.queryRenderedFeatures(point,{layers:discovery}).length)return null;
      const layers=interactive.filter(id=>map.getLayer(id));
      const features=layers.length?map.queryRenderedFeatures(point,{layers}):[];
      return features.sort((a,b)=>interactive.indexOf(a.layer.id)-interactive.indexOf(b.layer.id))[0]||null;
    }
    const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
    function showFeature(f,at){
      const p=f.properties,body=node('div','');body.className='parking-popup-body';
      body.append(node('h3',p.name));
      const detail=(label,value)=>{if(value)body.append(node('p',label+value));};
      detail('',p.type);detail('Space ',p.space);detail('',p.access);detail('Access conditions: ',p.conditional);detail('',p.fee);detail('Fee conditions: ',p.feeConditional);
      detail('Hours: ',p.hours);detail('Time limit: ',p.limit);detail('Restrictions: ',p.restrictions);detail('Payment zone: ',p.paymentZone);
      detail('Mapped capacity: ',p.capacity);detail('Accessible spaces: ',p.accessible);detail('Height limit: ',p.height);detail('Operator: ',p.operator);detail('',p.notes);
      if(p.kind==='conditional')body.append(node('p','This curb changes use. Check its posted schedule before parking.'));
      body.append(node('p','Mapped location, not an available-space guarantee. Check signs and the vehicle entrance.'));
      const links=node('div','');links.className='parking-popup-links';
      function link(label,url){const el=node('a',label);el.href=url;el.target='_blank';el.rel='noopener noreferrer';links.append(el);}
      link('Directions ↗','https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(at[1]+','+at[0]));
      link('Source ↗',/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/.test(p.sourceUrl||'')?p.sourceUrl:'https://experience.arcgis.com/experience/5010870614c5488dbb107f599d15e8e1');
      body.append(links);popup?.remove();popup=new maplibregl.Popup({maxWidth:'290px',offset:15,className:'parking-popup'}).setLngLat(at).setDOMContent(body).addTo(map);
    }
    button.addEventListener('click',()=>{
      enabled=!enabled;
      if(enabled){window.AustinChatMap?.leave();window.AustinChatCard?.close();window.AustinMapLayers?.close();window.PlanPanel?.close();}
      draw();if(enabled)load();else key.hidden=true;
    });
    map.on('click',async event=>{
      // Leave the existing explicit entrance picker in control of its click.
      if(map.getCanvas().style.cursor==='crosshair')return;
      const f=hit(event.point);if(!f)return;
      if(f.properties.cluster){
        try{const zoom=await map.getSource(f.source).getClusterExpansionZoom(f.properties.cluster_id);if(shown())map.easeTo({center:f.geometry.coordinates,zoom,duration:350});}catch{}
      }else showFeature(f,f.geometry.type==='Point'?f.geometry.coordinates:[event.lngLat.lng,event.lngLat.lat]);
    });
    for(const id of interactive){map.on('mouseenter',id,()=>{if(shown()&&map.getCanvas().style.cursor!=='crosshair')map.getCanvas().style.cursor='pointer';});map.on('mouseleave',id,()=>{if(map.getCanvas().style.cursor==='pointer')map.getCanvas().style.cursor='';});}
    map.on('style.load',draw);
    window.addEventListener('austin:chat-view',draw);
    window.AustinParking={hit,get enabled(){return enabled;},get visible(){return shown();}};
    draw();
  }
};
