import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {start,stop,db,demo,shop,admin,platform,req,notifications,failTelegram} from './harness.js';
const token='test-subscription-import-token-32-characters';
before(()=>start({IMPORT_API_TOKEN:token}));
after(stop);
async function tick(){return req('/api/import/tick','POST',{}, {Authorization:'Bearer '+token});}
test('operator activates a linked demo and opens orders; owner sees the paid period',async()=>{
  assert.equal((await platform(`stores/${demo.id}/activate`,'POST',{})).status,409);
  await db.prepare("UPDATE stores SET owner_id='333',orders_enabled=0 WHERE id=?").bind(demo.id).run();
  const activated=await platform(`stores/${demo.id}/activate`,'POST',{months:1});
  assert.equal(activated.status,200,JSON.stringify(activated.body));
  assert.equal(activated.body.subscription.status,'active');
  const store=await admin(333,`stores/${demo.id}`);
  assert.equal(store.body.status,'active');assert.equal(store.body.acceptingOrders,true);
  assert.equal(store.body.subscription.expires_at,activated.body.subscription.expires_at);
  assert.equal((await admin(111,`stores/${demo.id}`)).status,404);
  assert.equal((await req(`/api/platform/stores/${demo.id}/renew`,'POST',{months:1})).status,401);
  assert.equal((await platform(`stores/${demo.id}/renew`,'POST',{months:13})).status,400);
  assert.equal((await platform(`stores/${demo.id}/activate`,'POST',{months:1})).status,409);
});
test('reminder is sent in the final three days, not duplicated, and renewal resets it',async()=>{
  await db.prepare('UPDATE subscriptions SET expires_at=unixepoch()+259300 WHERE store_id=?').bind(demo.id).run();
  const initial=notifications.length;
  assert.equal((await tick()).status,200);
  assert.equal(notifications.length,initial);
  await db.prepare('UPDATE subscriptions SET expires_at=unixepoch()+172800 WHERE store_id=?').bind(demo.id).run();
  assert.equal((await tick()).status,200);
  assert.equal(notifications.length,initial+1);
  assert.equal(String(notifications.at(-1).payload.chat_id),'333');
  assert.match(notifications.at(-1).payload.text,/subscription|подписк/i);
  assert.match(notifications.at(-1).payload.text,/https:\/\/t\.me\/Mirrorby/);
  assert.equal(notifications.at(-1).payload.reply_markup.inline_keyboard[0][0].url,'https://t.me/Mirrorby');
  await tick();assert.equal(notifications.length,initial+1);
  const previous=(await admin(333,`stores/${demo.id}`)).body.subscription.expires_at;
  const renewed=await platform(`stores/${demo.id}/renew`,'POST',{months:1});
  assert.equal(renewed.status,200);assert.ok(renewed.body.subscription.expires_at>previous);
  assert.equal(renewed.body.subscription.reminder_sent_at,null);
});
test('delivery failure is retried; expiration never silently turns off orders',async()=>{
  await db.prepare('UPDATE subscriptions SET expires_at=unixepoch()+86400,reminder_sent_at=NULL,reminder_next_at=0 WHERE store_id=?').bind(demo.id).run();
  const initial=notifications.length;failTelegram(true);await tick();failTelegram(false);
  let row=await db.prepare('SELECT * FROM subscriptions WHERE store_id=?').bind(demo.id).first();
  assert.equal(row.reminder_sent_at,null);assert.equal(row.reminder_attempts,1);
  await db.prepare('UPDATE subscriptions SET reminder_next_at=0 WHERE store_id=?').bind(demo.id).run();
  await tick();row=await db.prepare('SELECT * FROM subscriptions WHERE store_id=?').bind(demo.id).first();
  assert.ok(row.reminder_sent_at);assert.equal(notifications.length,initial+2);
  await db.prepare('UPDATE subscriptions SET expires_at=unixepoch()-1 WHERE store_id=?').bind(demo.id).run();
  const store=(await admin(333,`stores/${demo.id}`)).body;
  assert.equal(store.subscription.status,'expired');assert.equal(store.acceptingOrders,true);
});

test('bot identity can be checked without sending a message or exposing credentials',async()=>{
  const count=notifications.length;
  assert.equal((await req('/api/platform/bot-status')).status,401);
  const result=await platform('bot-status');
  assert.equal(result.status,200);assert.equal(result.body.matchesConfigured,true);
  assert.equal(result.body.username,'catalog_test_bot');
  assert.equal(notifications.length,count+1);
  assert.ok(notifications.at(-1).path.endsWith('/getMe'));
});
