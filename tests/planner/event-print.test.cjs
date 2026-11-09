const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../../special-events/plan-print.js');
test('map labels use Austin visit dates and times without inventing an arrival',()=>{
 const item={schedule:{start:'2026-11-14T19:00:00Z',duration:75}};
 assert.deepEqual(P.visit(item,'2026-11-14'),{date:'Sat, Nov 14, 2026',time:'1:00 PM–2:15 PM CT'});
 assert.deepEqual(P.visit({schedule:{start:null,duration:60}},'2026-11-14'),{date:'Sat, Nov 14, 2026',time:'Visit time not set'});
 const overnight=P.visit({schedule:{start:'2026-11-15T05:30:00Z',duration:90}},'2026-11-14');
 assert.match(overnight.date,/Nov 14/);assert.match(overnight.time,/11:30 PM–1:00 AM \(Sun, Nov 15, 2026\)/);
 const nextMorning=P.visit({schedule:{start:'2026-11-15T07:00:00Z',duration:60}},'2026-11-14');assert.match(nextMorning.date,/Nov 15/);
});
test('long names wrap intact and crowded sheets retain every stop and number',()=>{
 const text='Atelier María & friends — '+('verylongname'.repeat(10));const lines=P.wrap(text,120,s=>[...s].length*8);
 assert.ok(lines.every(l=>[...l].length*8<=120));assert.equal(lines.join('').replaceAll(' ',''),text.replaceAll(' ',''));
 const entries=Array.from({length:150},(_,i)=>({number:i+1,height:70+(i%3)*40})),sheets=P.sheets(entries);
 assert.equal(sheets.flat(2).length,150);assert.equal(new Set(sheets.flat(2).map(e=>e.number)).size,150);
 for(const page of sheets)for(const column of page)assert.ok(column.reduce((n,e)=>n+e.height+18,0)-18<=620);
});
test('PDF offsets and image stream lengths remain correct for binary JPEG data and multiple pages',()=>{
 const images=[{bytes:new Uint8Array([255,216,0,10,128,255,217]),width:2400,height:1855},{bytes:new Uint8Array([255,216,0,0,255,217]),width:2400,height:1855}];
 const bytes=P.pdf(images),text=Buffer.from(bytes).toString('latin1');assert.match(text,/\/Count 2/);assert.match(text,/\/MediaBox \[0 0 792 612\]/);
 const start=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(text.slice(start,start+4),'xref');
 const rows=text.slice(start).split('\n');assert.equal(rows[1],'0 9');
 for(let id=1;id<9;id++){const offset=Number(rows[2+id].slice(0,10));assert.ok(text.slice(offset).startsWith(id+' 0 obj\n'));}
 assert.match(text,/\/DCTDecode \/Length 7/);assert.throws(()=>P.pdf([]),/No map sheets/);
});
test('an unscheduled stop shows its available hours separately from the missing visit time',()=>{
 const label=P.visit({source:{hoursText:'11 AM–5 PM'},schedule:{start:null}},'2026-11-14');
 assert.equal(label.time,'Visit time not set');assert.equal(label.hours,'Available: 11 AM–5 PM');
 assert.equal(P.visit({source:{hoursText:'Old hours',eventUnavailable:true},schedule:{}},'2026-11-14').hours,undefined);
});
test('co-located printed stop numbers remain distinct and point back to their original locations',()=>{
 const points=Array.from({length:150},()=>({x:565,y:340})),before=structuredClone(points),bounds={left:255,right:875,top:18,bottom:662};
 const placed=P.placePins(points,bounds);assert.deepEqual(points,before);assert.equal(placed.length,150);
 for(let i=0;i<placed.length;i++){const p=placed[i];assert.ok(p.x>=bounds.left&&p.x<=bounds.right&&p.y>=bounds.top&&p.y<=bounds.bottom);for(let j=0;j<i;j++)assert.ok(Math.hypot(p.x-placed[j].x,p.y-placed[j].y)>=29);}
});


test('printed notes include both saved stop and visit notes only for registered users',()=>{
  const item={schedule:{note:'Bring the measurements'}};
  assert.equal(P.notes(item,'Ask about framing',true),'Ask about framing\nVisit notes: Bring the measurements');
  assert.equal(P.notes(item,'Ask about framing',false),'');
  assert.equal(P.notes(item,'Bring the measurements',true),'Bring the measurements');
});
test('long private notes continue across sheets without truncation or callout overflow',()=>{
  const lines=Array.from({length:100},(_,i)=>'Note line '+i);
  const entries=P.withNotes([{number:1,height:140,noteLines:lines,position:{x:500,y:300}}],640);
  assert.ok(entries.length>1);assert.deepEqual(entries.flatMap(e=>e.noteLines),lines);
  assert.ok(entries.every(e=>e.height<=640));
  const sheets=P.sheets(entries,640);assert.equal(sheets.length,entries.length);
  assert.equal(sheets[1][0][0].continued,true);
});
