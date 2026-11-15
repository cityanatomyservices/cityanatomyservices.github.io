const {test}=require('node:test'),assert=require('node:assert/strict');
const {citySpace,cityZone,osmFacility}=require('./build.cjs');
const space=type=>({geometry:{type:'Point',coordinates:[-97.74,30.27]},properties:{PARKING_SPACE_TYPE:type,PARKING_SPACE_ID:'123'}});
test('ordinary and accessible City spaces are retained; restricted and changing-use spaces are not ordinary public spaces',()=>{
  assert.equal(citySpace(space('Paystation Zone')).properties.kind,'street');
  assert.equal(citySpace(space('Marked ADA Zone')).properties.kind,'accessible');
  for(const type of ['Police Only','No Parking','Residential Parking Permit','Passenger Loading Zone','Flex- Mobile Pay','Hybrid - Mobile Pay',null])assert.equal(citySpace(space(type)),null);
  const outside=space('Paystation Zone');outside.geometry.coordinates=[0,0];assert.equal(citySpace(outside),null);
});
test('mixed-use City zones preserve restrictions, schedule and source text without inferring availability',()=>{
  const zone=cityZone({geometry:{type:'LineString',coordinates:[[-97.74,30.27],[-97.741,30.27]]},properties:{PARKING_ZONE_ID:1,PARKING_TYPE:'Mobile Pay',ALL_RESTRICTION_TYPES:'Mobile Pay; Passenger Loading Zone',HOURS_OF_OPERATION:'See posted schedule',DAY_HOUR_CONCATENATE:'source schedule'}});
  assert.equal(zone.properties.kind,'conditional');assert.equal(zone.properties.hours,'See posted schedule');assert.equal(zone.properties.restrictions,'Mobile Pay; Passenger Loading Zone');assert.equal(zone.properties.schedule,'source schedule');
});
test('OSM excludes known restricted facilities and does not claim missing access or fee data is public/free',()=>{
  const el={type:'way',id:42,center:{lat:30.27,lon:-97.74},tags:{amenity:'parking',parking:'multi-storey'}};
  assert.equal(osmFacility(el).properties.kind,'garage');assert.match(osmFacility(el).properties.access,/not recorded/);assert.equal(osmFacility(el).properties.fee,'Fee not recorded');
  for(const access of ['private','customers','permit','no'])assert.equal(osmFacility({...el,tags:{...el.tags,access}}),null);
  assert.equal(osmFacility({...el,tags:{...el.tags,parking:'street_side'}}),null);
  const publicLot=osmFacility({...el,tags:{...el.tags,access:'yes',fee:'no',capacity:'75','access:conditional':'no @ (Mo 08:00-12:00)'}});
  assert.equal(publicLot.properties.fee,'No fee mapped');assert.equal(publicLot.properties.capacity,'75');assert.ok(publicLot.properties.conditional);assert.equal(publicLot.properties.sourceUrl,'https://www.openstreetmap.org/way/42');
});
