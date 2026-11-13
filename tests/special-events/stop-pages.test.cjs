const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),source=JSON.parse(fs.readFileSync(path.join(root,'special-events/data/austin-studio-tour-2026.geojson'),'utf8'));
const model=require('../../special-events/model.js'),event=model.validate(source);
test('Every published location has a small page with its exact existing boundary and room',()=>{
  const folder=path.join(root,'maps/austin-studio-tour/stops');
  assert.equal(fs.readdirSync(folder,{withFileTypes:true}).filter(d=>d.isDirectory()).length,307);
  for(const [i,f]of source.features.entries()){
    const html=fs.readFileSync(path.join(folder,String(f.properties.number),'index.html'),'utf8');
    const data=JSON.parse(html.match(/<script id="stop-data" type="application\/json">(.*?)<\/script>/s)[1]);
    const stop=model.validate(data);
    assert.deepEqual(stop.chatGeofences.features[0],event.chatGeofences.features[i]);
    assert.equal(stop.expiresAt,'2026-11-24T22:00:00-06:00');
    assert.ok(html.includes(`href="https://austin.chat/maps/austin-studio-tour/stops/${f.properties.number}/"`));
    assert.ok(Buffer.byteLength(html)<40000,'Stop pages should not embed the full tour dataset');
    assert.ok(!html.includes('/geofences/manage/')&&!html.includes('checkout'));
  }
});
test('Downloaded PNG QR images decode to the right public stop URLs',()=>{
  const {PNG}=require('../../tools/special-events/node_modules/pngjs'),decode=require('../../tools/special-events/node_modules/jsqr');
  for(const n of [1,47,233,308]){
    const png=PNG.sync.read(fs.readFileSync(path.join(root,`maps/austin-studio-tour/stops/${n}/qr.png`)));
    assert.equal(decode(new Uint8ClampedArray(png.data),png.width,png.height)?.data,`https://austin.chat/maps/austin-studio-tour/stops/${n}/`);
  }
});
test('Directory and CSV list actual organizer numbers, including gaps',()=>{
  const html=fs.readFileSync(path.join(root,'maps/austin-studio-tour/stops/index.html'),'utf8'),csv=fs.readFileSync(path.join(root,'maps/austin-studio-tour/stops/links.csv'),'utf8');
  assert.equal((html.match(/class="stop-qr-link"/g)||[]).length,307);
  for(const f of source.features){const n=f.properties.number;assert.ok(html.includes(`href="${n}/"`));assert.ok(csv.includes(`"https://austin.chat/maps/austin-studio-tour/stops/${n}/"`));}
});
