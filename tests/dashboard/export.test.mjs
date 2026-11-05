import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {workbook} from '../../dashboard/export.js';
const require=createRequire(import.meta.url),XLSX=require('../../dashboard/vendor/xlsx-0.20.3.min.js');
test('Actual XLSX bytes round-trip user content as strings, not formulas',()=>{
 const rows=[{email:'=cmd@example.invalid',message:'=HYPERLINK("https://evil.invalid")',value:12,active:true,nested:{text:'<script>alert(1)</script>'}},
   {email:'+other@example.invalid',message:'@SUM(1,2)',value:0,active:false}];
 const book=workbook(XLSX,rows,{Report:'Chat',Rows:2});
 const bytes=XLSX.write(book,{bookType:'xlsx',type:'buffer'}),read=XLSX.read(bytes,{type:'buffer'});
 assert.equal(Buffer.from(bytes).subarray(0,2).toString(),'PK');assert.deepEqual(read.SheetNames,['Report','Export details']);
 assert.equal(read.Sheets.Report.B2.t,'s');assert.equal(read.Sheets.Report.B2.f,undefined);
 assert.equal(read.Sheets.Report.B2.v,rows[0].message);assert.equal(read.Sheets.Report.C2.t,'n');assert.equal(read.Sheets.Report.D2.t,'b');
 assert.equal(XLSX.utils.sheet_to_json(read.Sheets.Report).length,2);
});
test('Excel cell limits fail explicitly rather than silently dropping content',()=>{
 assert.throws(()=>workbook(XLSX,[{text:'x'.repeat(32768)}],{}),/text limit/);
});
test('The dashboard is unlisted and search engines are told not to index it',()=>{
 const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
 assert.match(read('dashboard/index.html'),/noindex,nofollow,noarchive/);
 for(const file of ['home.json','shell.js','index.html'])assert.doesNotMatch(read(file),/href=["']\/dashboard|"url":\s*"\/dashboard/);
});
test('The dataset catalog points only to deliberate public content sources',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('../../dashboard/datasets.json',import.meta.url)));
 assert.ok(catalog.length>100);
 assert.equal(catalog.find(r=>r.id==='data:chat/data/city-hall.json').key,'records');
 assert.equal(catalog.find(r=>r.id==='data:ticker/feed.json').key,'items');
 for(const r of catalog)assert.match(r.url,/^(\/(chat|apps|AISD|budget|datacenters|news|ticker)\/|https:\/\/raw\.githubusercontent\.com\/cityanatomyservices\/cityanatomyservices\.github\.io\/main\/apps\/)/);
});
