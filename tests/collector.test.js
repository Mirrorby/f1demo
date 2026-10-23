import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {start,stop,admin,db,platform,req,mockDomainService} from './harness.js';
let ready=false,restricted=false;
const submissions=[];
before(async()=>{
  mockDomainService(async request=>{
    const url=new URL(request.url);
    if(url.hostname.endsWith('.cdninstagram.com'))return new Response(new Uint8Array([255,216,255,0,0,0,0,0,0,0,0,0]));
    if(request.method==='POST'){
      submissions.push(await request.json());
      return Response.json({id:'a'.repeat(32),status:'queued'});
    }
    if(url.pathname.endsWith('/bundle'))return Response.json({
      username:'live_shop',source:{period:{complete:true,days:30},logo_url:'https://scontent.cdninstagram.com/logo.jpg',photo_posts:Array.from({length:9},(_,i)=>({date:'2026-10-23',assets:[{}],images:Array.from({length:8},(_,n)=>'https://scontent.cdninstagram.com/'+i+'-'+n+'.jpg')}))},
      store:{name:'Real shop',settings:{description:'Adapted catalogue introduction'},products:Array.from({length:9},(_,i)=>({name:'Real item '+i,description:'Adapted item description',prices:{USD:0},priceOnRequest:true,availability:'preorder',variants:[{label:'Ask',stock:null}]}))}
    });
    return Response.json({id:'a'.repeat(32),status:restricted?'restricted':ready?'ready':'running',products:9});
  });
  await start({IMPORT_API_ORIGIN:'https://collector.example',IMPORT_API_TOKEN:'test-token-with-at-least-32-characters-for-ci'});
});
after(stop);
let job;
test('no store exists until collection and every carousel image are copied',async()=>{
  assert.equal((await req('/api/import/tick','POST',{})).status,401);
  assert.equal((await req('/api/import/tick','POST',{}, {Authorization:'Bearer test-token-with-at-least-32-characters-for-ci'})).status,200);
  const created=await admin(930,'demo-jobs','POST',{instagram:'live_shop',templateId:'fashion',language:'en',currency:'USD'});
  assert.equal(created.status,201);job=created.body.job;
  assert.equal(submissions[0].periodDays,30);assert.equal(submissions[0].products,undefined);
  assert.equal((await admin(930,'stores')).body.length,0);
  ready=true;
  await db.prepare('UPDATE collector_tasks SET checked_at=0').run();
  const first=await admin(930,'demo-jobs/'+job.id+'/sync','POST',{});
  assert.equal(first.status,200);
  assert.equal((await admin(930,'stores')).body.length,0);
  for(let i=0;i<12;i++)await admin(930,'demo-jobs/'+job.id+'/sync','POST',{});
  const own=(await admin(930,'stores')).body;
  assert.equal(own.length,1);assert.equal(own[0].name,'Real shop');assert.equal(own[0].acceptingOrders,false);
  const products=(await admin(930,'stores/'+job.store_id+'/products')).body;
  assert.equal(products.length,9);
  assert.ok(products.every(p=>p.photos.length===8));
  assert.equal((await admin(930,'demo-jobs')).body[0].sample_content,0);
  await admin(930,'stores/'+job.store_id+'/settings','PUT',{version:own[0].version,name:'My edits',settings:own[0].settings});
  await admin(930,'demo-jobs/'+job.id+'/sync','POST',{});
  assert.equal((await admin(930,'stores/'+job.store_id)).body.name,'My edits');
  assert.equal(submissions.length,1);
});
test('restriction creates an error, never a fake demo; explicit resubmission retries once',async()=>{
  ready=false;restricted=true;
  const created=await admin(931,'demo-jobs','POST',{instagram:'blocked_shop',templateId:'minimal',currency:'USD'});
  const id=created.body.job.id;
  await db.prepare('UPDATE collector_tasks SET checked_at=0 WHERE job_id=?').bind(id).run();
  await admin(931,'demo-jobs/'+id+'/sync','POST',{});
  assert.equal((await admin(931,'demo-jobs')).body[0].status,'failed');
  assert.equal((await admin(931,'stores')).body.length,0);
  assert.equal((await admin(932,'demo-jobs/'+id+'/sync','POST',{})).status,404);
  const old=submissions.length;
  await admin(931,'demo-jobs','POST',{instagram:'blocked_shop',templateId:'minimal',currency:'USD'});
  assert.equal(submissions.length,old+1);
  assert.equal((await admin(931,'stores')).body.length,0);
});
