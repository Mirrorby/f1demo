import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {start,stop,admin,db,platform,req,mockDomainService} from './harness.js';
const calls=new Map();
before(async()=>{
  mockDomainService(async r=>{
    const key=r.headers.get('Idempotency-Key');
    if(r.method==='POST')calls.set(key,(calls.get(key)||0)+1);
    return Response.json({id:'a'.repeat(32),status:'queued'});
  });
  await start({IMPORT_API_ORIGIN:'https://collector.example',IMPORT_API_TOKEN:'test-import-token'});
});
after(stop);
const create=(owner,changes={})=>admin(owner,'demo-jobs','POST',{instagram:'@new_shop',templateId:'fashion',language:'en',currency:'USD',...changes});
test('onboarding queues collection without exposing a placeholder store',async()=>{
  const result=await create(901,{instagram:'https://www.instagram.com/New_Shop/?igsh=test',referenceUrl:'https://example.com/shop?utm_source=x'});
  assert.equal(result.status,201,JSON.stringify(result));
  const j=result.body.job;
  assert.equal(j.instagram,'new_shop');assert.equal(j.auto_build,1);assert.equal(j.period_days,30);
  assert.equal(j.slug,null);assert.equal((await admin(901,'stores')).body.length,0);
  assert.equal((await create(901,{referenceUrl:'https://example.com/shop'})).body.job.id,j.id);
  assert.equal((await create(901,{templateId:'beauty'})).status,409);
  assert.equal((await admin(902,'demo-jobs')).body.length,0);
  assert.equal((await admin(902,'demo-jobs/'+j.id+'/sync','POST',{})).status,404);
  assert.equal((await req('/api/admin/demo-jobs','POST',{})).status,401);
  assert.equal((await platform('references')).body[0].url,'https://example.com/shop');
});
test('validates account, references and limits pending demos as well as ready demos',async()=>{
  for(const instagram of ['https://evil.com/name','https://instagram.com/p/abc','@','bad..name','https://instagram.com/reels'])assert.equal((await create(910,{instagram})).status,400);
  for(const referenceUrl of ['http://example.com','https://user:password@example.com','https://127.0.0.1','https://localhost'])assert.equal((await create(910,{referenceUrl})).status,400);
  for(const instagram of ['quota_a','quota_b','quota_c'])assert.equal((await create(910,{instagram})).status,201);
  assert.equal((await create(910,{instagram:'quota_d'})).status,429);
  assert.equal((await admin(910,'stores')).body.length,0);
});
test('concurrent submissions preserve one job',async()=>{
  const results=await Promise.all([create(920),create(920)]);
  assert.ok(results.every(r=>r.status===201),JSON.stringify(results));
  assert.equal(results[0].body.job.id,results[1].body.job.id);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM demo_build_jobs WHERE owner_id='920'").first()).n,1);
});

test('selected period is validated, persisted and cannot silently change an existing job',async()=>{
  for(const periodDays of [0,8,91,'30',true])assert.equal((await create(940,{periodDays})).status,400);
  const result=await create(940,{periodDays:7});
  assert.equal(result.status,201);assert.equal(result.body.job.period_days,7);
  assert.equal((await create(940,{periodDays:90})).status,409);
});
