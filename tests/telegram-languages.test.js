import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  start,
  stop,
  req,
  db,
  notifications,
  WEBHOOK,
  checkout,
  orderFor,
  shop,
} from './harness.js';
import { readFile } from 'node:fs/promises';
const extra = JSON.parse(await readFile('src/telegram-locales.json', 'utf8'));
const codes = ['ru', 'en', ...Object.keys(extra)];
before(start);
after(stop);
const webhook = (update) =>
  req('/api/telegram/webhook', 'POST', update, { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK });
function message(id, code, text) {
  return { message: { text, from: { id, language_code: code }, chat: { id, type: 'private' } } };
}
function callback(id, code, data) {
  return {
    callback_query: {
      id: 'callback-' + id,
      from: { id, language_code: code },
      message: { chat: { id, type: 'private' } },
      data,
    },
  };
}
test('all ten languages auto-detect regional codes, show menus and persist manual preferences', async () => {
  for (const [i, code] of codes.entries()) {
    const id = 3000 + i;
    notifications.length = 0;
    assert.equal((await webhook(message(id, code + '-XX', '/start'))).status, 200);
    const row = await db
      .prepare('SELECT * FROM telegram_preferences WHERE user_id=?')
      .bind(String(id))
      .first();
    assert.equal(row.language, code);
    assert.equal(row.manual, 0);
    const welcome = notifications.find((n) => n.path.endsWith('/sendMessage')).payload;
    if (extra[code]) assert.ok(welcome.text.startsWith(extra[code].welcome));
    notifications.length = 0;
    assert.equal((await webhook(message(id, code, '/language'))).status, 200);
    const buttons = notifications
      .find((n) => n.path.endsWith('/sendMessage'))
      .payload.reply_markup.inline_keyboard.flat();
    assert.deepEqual(
      buttons.map((b) => b.callback_data).sort(),
      codes.map((c) => 'lang:' + c).sort(),
    );
    assert.equal((await webhook(callback(id, code, 'lang:ja'))).status, 200);
    await webhook(message(id, 'de', '/start'));
    const manual = await db
      .prepare('SELECT * FROM telegram_preferences WHERE user_id=?')
      .bind(String(id))
      .first();
    assert.equal(manual.language, 'ja');
    assert.equal(manual.manual, 1);
  }
});
test('unsupported Telegram languages fall back to English', async () => {
  await webhook(message(5000, 'uk', '/start'));
  assert.equal(
    (
      await db
        .prepare('SELECT language FROM telegram_preferences WHERE user_id=?')
        .bind('5000')
        .first()
    ).language,
    'en',
  );
});
test('order notifications use the saved owner language including buttons', async () => {
  await webhook(callback(111, 'en', 'lang:pl'));
  notifications.length = 0;
  const order = await checkout(orderFor());
  assert.equal(order.status, 201);
  for (let i = 0; i < 30; i++) {
    const pending = await db
      .prepare('SELECT sent_at FROM notification_outbox WHERE order_id=?')
      .bind(order.body.id)
      .first();
    if (pending?.sent_at) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  const sent = notifications.find(
    (n) => n.path.endsWith('/sendMessage') && String(n.payload.chat_id) === '111',
  );
  assert.ok(sent);
  assert.ok(sent.payload.text.includes(extra.pl.newOrder));
  assert.equal(sent.payload.reply_markup.inline_keyboard[0][0].text, extra.pl.accept);
});

test('Mini App language preference authenticates, validates and is shared with bot notifications', async () => {
  assert.equal((await req('/api/admin/preferences')).status, 401);
  const { admin } = await import('./harness.js');
  assert.equal((await admin(111, 'preferences', 'PUT', { language: 'es' })).status, 200);
  assert.equal((await admin(111, 'preferences')).body.language, 'es');
  assert.equal((await admin(111, 'preferences')).body.manual, 1);
  assert.notEqual((await admin(222, 'preferences')).body.language, 'es');
  assert.equal((await admin(111, 'preferences', 'PUT', { language: 'xx' })).status, 400);
  notifications.length = 0;
  await webhook(message(111, 'ru', '/shop'));
  const menu = notifications.find((n) => n.path.endsWith('/sendMessage'));
  assert.ok(menu.payload.text.includes(extra.es.returning));
  assert.ok(menu.payload.reply_markup.inline_keyboard[0][0].web_app.url.endsWith('?lang=es'));
});
