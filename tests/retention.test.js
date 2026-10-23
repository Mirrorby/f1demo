import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {start,stop,db,req,platform} from './harness.js';
const token='retention-test-token-with-at-least-32-characters';
before(()=>start({IMPORT_API_TOKEN:token}));
after(stop);
async function seed(id,status='demo') {
  await db.prepare('INSERT INTO stores(id,slug,name,status,settings,owner_id) VALUES(?,?,?,?,?,?)').bind(id,id,'Expired shop',status,JSON.stringify({language:'ru'}),'950').run();
  await db.prepare("INSERT INTO demo_build_jobs(id,owner_id,instagram,template_id,store_id,language,currency,status,sample_content) VALUES(?,?,?,?,?,?,?,'ready',0)").bind(id,'950',id,'fashion',id,'ru','BYN').run();
  await db.prepare('INSERT INTO demo_retention(job_id,expires_at) VALUES(?,unixepoch()-1)').bind(id).run();
}
async function tick(){
  await db.prepare("DELETE FROM maintenance_state WHERE key='retention_next'").run();
  const result=await req('/api/import/tick','POST',{}, {Authorization:'Bearer '+token});
  assert.equal(result.status,200,JSON.stringify(result.body));
}
test('expired unpaid demo material is deleted; statistics, lead history and reference remain',async()=>{
  await seed('expired-demo');
  await db.prepare("INSERT INTO products(id,store_id,data) VALUES('expired-product','expired-demo','{}')").run();
  await db.prepare("INSERT INTO lead_events(id,owner_id,event,screen,target,details) VALUES('retention-event','950','click','create','template','{}')").run();
  await db.prepare("INSERT INTO site_references(id,url) VALUES('reference-retention','https://example.com/')").run();
  await tick();
  assert.equal(await db.prepare("SELECT id FROM stores WHERE id='expired-demo'").first(),null);
  assert.equal(await db.prepare("SELECT id FROM products WHERE store_id='expired-demo'").first(),null);
  assert.equal(await db.prepare("SELECT id FROM demo_build_jobs WHERE id='expired-demo'").first(),null);
  const saved=await db.prepare("SELECT * FROM demo_statistics WHERE job_id='expired-demo'").first();
  assert.equal(saved.products,1);assert.equal(saved.owner_id,'950');assert.equal(saved.outcome,'expired_ready');
  assert.ok(await db.prepare("SELECT id FROM lead_events WHERE id='retention-event'").first());
  assert.ok(await db.prepare("SELECT id FROM site_references WHERE id='reference-retention'").first());
  assert.equal((await platform('leads/950')).body.expiredDemos.length,1);
});
test('active stores and fresh grace periods are preserved',async()=>{
  await seed('active-protected','active');
  await seed('fresh-demo');
  await db.prepare("DELETE FROM demo_retention WHERE job_id='fresh-demo'").run();
  await tick();
  assert.ok(await db.prepare("SELECT id FROM stores WHERE id='active-protected'").first());
  assert.ok(await db.prepare("SELECT id FROM stores WHERE id='fresh-demo'").first());
  const grace=await db.prepare("SELECT expires_at FROM demo_retention WHERE job_id='fresh-demo'").first();
  assert.ok(grace.expires_at>Date.now()/1000+6*86400);
});

test('paid purchases protect a demo even before its store status changes',async()=>{
  await seed('paid-protected');
  await db.prepare("INSERT INTO tribute_digital_purchases(purchase_id,owner_id,product_id,title,amount_minor,currency,status) VALUES('paid-retention','950',1,'Site',100,'usd','paid')").run();
  await tick();
  assert.ok(await db.prepare("SELECT id FROM stores WHERE id='paid-protected'").first());
});
