import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {start,stop,admin,req,notifications,failTelegram} from './harness.js';

before(()=>start());
after(stop);
test('contact is sent only to the authenticated user with a native Telegram link',async()=>{
  const count=notifications.length;
  assert.equal((await req('/api/admin/support-contact','POST',{})).status,401);
  assert.equal(notifications.length,count);
  const result=await admin(333,'support-contact','POST',{chat_id:'999'});
  assert.equal(result.status,200);
  const message=notifications.at(-1).payload;
  assert.equal(String(message.chat_id),'333');
  assert.equal(message.reply_markup.inline_keyboard[0][0].url,'https://t.me/Mirrorby');
});
test('failed delivery is reported and can be retried',async()=>{
  failTelegram(true);
  try { assert.notEqual((await admin(333,'support-contact','POST',{})).status,200); }
  finally { failTelegram(false); }
  assert.equal((await admin(333,'support-contact','POST',{})).status,200);
});
