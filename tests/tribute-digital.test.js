import { mf } from './harness.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { start, stop, db, req, platform, TRIBUTE, WEBHOOK, notifications } from './harness.js';
before(() => start({ TRIBUTE_SHOP_ID: '', TRIBUTE_PRODUCT_URL: 'https://web.tribute.tg/p/H0e' }));
after(stop);
function event(id, overrides = {}, name = 'new_digital_product') {
  return {
    name,
    created_at: '2026-10-14T10:00:00Z',
    sent_at: '2026-10-14T10:00:01Z',
    payload: {
      product_id: 456,
      product_name: 'Online store setup',
      amount: 10000,
      currency: 'eur',
      telegram_user_id: 333,
      purchase_id: id,
      transaction_id: 12345,
      ...overrides,
    },
  };
}
function send(e, key = TRIBUTE) {
  return req('/api/tribute/webhook', 'POST', e, {
    'trbt-signature': createHmac('sha256', key).update(JSON.stringify(e)).digest('hex'),
  });
}
test('exact product URL resolves through the API without a Shop ID', async () => {
  const r = await platform('payments/config');
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.body.mode, 'digital');
  assert.equal(r.body.productId, 456);
  assert.equal(r.body.paymentUrl, 'https://web.tribute.tg/p/H0e');
  assert.equal(r.body.cardsEnabled, true);
});
test('/pay presents the product to a customer before store ownership is linked', async () => {
  const r = await req(
    '/api/telegram/webhook',
    'POST',
    {
      message: {
        text: '/pay',
        chat: { id: 333, type: 'private' },
        from: { id: 333, language_code: 'en' },
      },
    },
    { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK },
  );
  assert.equal(r.status, 200);
  const m = notifications.find((n) => n.payload.chat_id === '333');
  assert.equal(m.payload.reply_markup.inline_keyboard[0][0].url, 'https://web.tribute.tg/p/H0e');
});
test('digital events require valid HMAC and retain one receipt per purchase', async () => {
  const e = event(9001);
  assert.equal((await send(e, 'bad-key')).status, 401);
  assert.equal((await send(e)).status, 200);
  assert.equal((await send({ ...e, sent_at: '2026-10-14T10:05:00Z' })).status, 200);
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) n FROM tribute_digital_purchases WHERE purchase_id=?')
        .bind('9001')
        .first()
    ).n,
    1,
  );
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) n FROM tribute_digital_outbox WHERE purchase_id=?')
        .bind('9001')
        .first()
    ).n,
    1,
  );
  assert.equal(
    (
      await db
        .prepare('SELECT owner_id FROM tribute_digital_purchases WHERE purchase_id=?')
        .bind('9001')
        .first()
    ).owner_id,
    '333',
  );
  assert.equal(
    (await platform('payments')).body.find((p) => p.id === 'digital:9001').type,
    'digital',
  );
});
test('another product is ignored and a reused purchase cannot change its payer', async () => {
  assert.equal((await send(event(9002, { product_id: 999 }))).status, 200);
  assert.equal(
    await db
      .prepare('SELECT * FROM tribute_digital_purchases WHERE purchase_id=?')
      .bind('9002')
      .first(),
    null,
  );
  assert.equal((await send(event(9001, { telegram_user_id: 444 }))).status, 409);
  assert.equal((await send(event(9003, { purchase_id: undefined }))).status, 400);
});
test('refund arriving before purchase is retained; later paid cannot overwrite it', async () => {
  assert.equal((await send(event(9004, {}, 'digital_product_refunded'))).status, 200);
  assert.equal((await send(event(9004))).status, 200);
  assert.equal(
    (
      await db
        .prepare('SELECT status FROM tribute_digital_purchases WHERE purchase_id=?')
        .bind('9004')
        .first()
    ).status,
    'refund_reported',
  );
});
test('personal payment history excludes other payers and signed sale price survives catalog changes', async () => {
  assert.equal((await send(event(9005, { amount: 8000, telegram_user_id: 444 }))).status, 200);
  const offset = notifications.length;
  await req(
    '/api/telegram/webhook',
    'POST',
    {
      message: {
        text: '/pay',
        chat: { id: 333, type: 'private' },
        from: { id: 333, language_code: 'ru' },
      },
    },
    { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK },
  );
  const history = notifications.slice(offset).filter((n) => n.payload.chat_id === '333');
  assert.equal(history.length, 3);
  assert.ok(history.some((n) => n.payload.text.includes('Оплачено')));
  assert.ok(history.every((n) => !n.payload.text.includes('80.00')));
});

test('private bridge verifies signatures, ignores non-payment probes and is unavailable over public HTTP', async () => {
  const { TEST_BRIDGE } = await mf.getBindings();
  const e = event(9020);
  const body = JSON.stringify(e);
  const signature = createHmac('sha256', TRIBUTE).update(body).digest('hex');
  assert.equal(await TEST_BRIDGE.verifySignature(body, signature), true);
  assert.equal(await TEST_BRIDGE.verifySignature(body, 'b'.repeat(64)), false);
  assert.equal(
    (await TEST_BRIDGE.receiveEvent(JSON.stringify({ name: 'integration_probe', payload: {} })))
      .status,
    'ignored',
  );
  assert.equal((await req('/receiveEvent', 'POST', e)).status, 404);
});
