const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../../classifieds/model.js');
test('simple notes allow author-chosen contact details and plain text',()=>{
  assert.equal(M.validate('community','Neighborhood note','Call (512) 555-0123 at 123 Main Street, or email chosen@example.invalid.'),'');
  assert.equal(M.validate('for-sale','<img src=x>','https://example.invalid/item — $100'),'');
  assert.equal(M.clean(' One\n\nparagraph. '),'One paragraph.');
});
test('category and size rules keep the form to a short title and paragraph',()=>{
  assert.equal(M.categories.length,8);assert.equal(new Set(M.categories.map(c=>c.id)).size,8);
  assert.match(M.validate('missing','Title','Body'),/category/);
  assert.match(M.validate('free','  ','Body'),/title/);
  assert.match(M.validate('free','x'.repeat(101),'Body'),/title/);
  assert.match(M.validate('free','Title','x'.repeat(1001)),/paragraph/);
  assert.equal(M.validate('free','x'.repeat(100),'x'.repeat(1000)),'');
});
