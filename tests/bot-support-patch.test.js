import {test} from 'node:test';
import assert from 'node:assert/strict';
import {patchProductionBot} from '../scripts/production-bot-manual-support.js';
const original='BEFORE\nasync function paymentMenu(env, user, language) {\n  if (env.TRIBUTE_PRODUCT_URL) {\n    await digitalMenu(env, user, language);\n    return;\n  }\n}\nasync function flushPaymentNotifications(env) { return 1; }\nconst text = t.welcome + t.noStore + "\\n\\n" + t.telegramId + user;\nAFTER';
test('production patch changes only the payment menu and misleading welcome',async()=>{
  const next=patchProductionBot(original);
  assert.ok(next.startsWith('BEFORE\n'));assert.ok(next.endsWith('\nAFTER'));
  assert.ok(next.includes('async function flushPaymentNotifications(env) { return 1; }'));
  assert.ok(!next.includes('await digitalMenu(env, user, language)'));
  assert.ok(!next.includes('t.welcome + t.noStore'));
  const start=next.indexOf('async function paymentMenu'),end=next.indexOf('\nasync function flushPaymentNotifications',start);
  const sent=[];
  const fn=new Function('telegram','origin','detectLanguage',next.slice(start,end)+'; return paymentMenu;')(
    async(_env,method,payload)=>sent.push({method,payload}),()=> 'https://example.com',s=>s,
  );
  await fn({},'111','ru');await fn({},'222','en');
  assert.equal(sent[0].payload.reply_markup.inline_keyboard[0][0].url,'https://t.me/Mirrorby');
  assert.match(sent[0].payload.text,/Стоимость и способ оплаты/);
  assert.match(sent[1].payload.text,/pricing and payment/);
  assert.equal(sent[1].payload.reply_markup.inline_keyboard[1][0].web_app.url,'https://example.com/admin?tab=payments&lang=en');
});
test('production patch refuses unknown or duplicate code',()=>{
  assert.throws(()=>patchProductionBot('different'));
  assert.throws(()=>patchProductionBot(original+original));
  assert.throws(()=>patchProductionBot(original,'https://example.com'));
});
