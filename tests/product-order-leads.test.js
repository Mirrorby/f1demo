import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {start,stop,admin,platform,req,shop,catalog} from './harness.js';
before(start);after(stop);
test('product order is owned, complete, persistent and public; stale sorting cannot win',async()=>{
  const own=(await admin(111,'stores/'+shop.id)).body;
  const ids=[...catalog.products].reverse().map(p=>p.id);
  assert.equal((await admin(222,'stores/'+shop.id+'/product-order','PUT',{version:own.version,ids})).status,404);
  assert.equal((await admin(111,'stores/'+shop.id+'/product-order','PUT',{version:own.version,ids:[ids[0],ids[0]]})).status,400);
  assert.equal((await admin(111,'stores/'+shop.id+'/product-order','PUT',{version:own.version,ids:[ids[0]]})).status,409);
  assert.equal((await admin(111,'stores/'+shop.id+'/product-order','PUT',{version:own.version,ids})).status,200);
  assert.deepEqual((await req('/api/stores/'+shop.slug)).body.products.map(p=>p.id),ids);
  assert.equal((await admin(111,'stores/'+shop.id+'/product-order','PUT',{version:own.version,ids})).status,409);
});
test('lead passports bind events to the signed owner, redact sensitive fields and isolate operator access',async()=>{
  const event={id:crypto.randomUUID(),event:'change',screen:'create',target:'demo-template',details:{value:'fashion',token:'should-not-save'}};
  assert.equal((await admin(111,'activity','POST',{ownerId:'222',events:[event]})).status,200);
  await admin(111,'activity','POST',{events:[event]});
  await admin(111,'activity','POST',{events:[{event:'change',screen:'settings',target:'platform-key',details:{value:'do-not-save'}}]});
  assert.equal((await req('/api/platform/leads')).status,401);
  const passport=(await platform('leads/111')).body;
  assert.equal(passport.events.length,2);
  assert.ok(!JSON.stringify(passport).includes('should-not-save'));
  assert.ok(!JSON.stringify(passport).includes('do-not-save'));
  assert.equal((await platform('leads/222')).body.events.length,0);
  assert.equal((await admin(111,'../platform/leads')).status,401);
  assert.equal((await platform('leads')).body[0].owner_id,'111');
});
