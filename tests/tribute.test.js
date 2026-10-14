import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  start,
  stop,
  db,
  shop,
  second,
  req,
  platform,
  TRIBUTE,
  WEBHOOK,
  tributeOrders,
  failTribute,
  failTelegram,
} from './harness.js';
before(start);
after(stop);
function input(id = crypto.randomUUID()) {
  return {
    id,
    amountMinor: 12500,
    currency: 'EUR',
    title: 'Store setup',
    description: 'Setup of your online store',
  };
}
async function create(data = input(), store = shop) {
  const r = await platform('stores/' + store.id + '/invoices', 'POST', data);
  return { ...r, input: data };
}
function eventFor(remote, overrides = {}) {
  return {
    name: 'shop_order',
    created_at: '2026-10-14T09:00:00Z',
    sent_at: '2026-10-14T09:00:01Z',
    payload: {
      uuid: remote.uuid,
      shopId: 901,
      customerId: remote.customerId,
      amount: remote.amount,
      currency: remote.currency,
      status: 'paid',
      isRecurrent: false,
      ...overrides,
    },
  };
}
function send(event, key = TRIBUTE) {
  const signature = createHmac('sha256', key).update(JSON.stringify(event)).digest('hex');
  return req('/api/tribute/webhook', 'POST', event, { 'trbt-signature': signature });
}
function remoteFor(invoice) {
  return [...tributeOrders.values()].find((r) => r.customerId === invoice.id);
}
test('only platform can issue invoices; currencies, amounts and owner are validated', async () => {
  assert.equal(
    (await req('/api/platform/stores/' + shop.id + '/invoices', 'POST', input())).status,
    401,
  );
  assert.equal((await create({ ...input(), currency: 'BYN' })).status, 400);
  assert.equal((await create({ ...input(), amountMinor: 99 })).status, 400);
  const demo = await platform('stores', 'POST', { name: 'Unowned', slug: 'unowned' });
  assert.equal(
    (await platform('stores/' + demo.body.id + '/invoices', 'POST', input())).status,
    409,
  );
  const cfg = await platform('payments/config');
  assert.equal(cfg.body.cardsEnabled, true);
  assert.equal(cfg.body.callbackMatches, true);
});
test('one invoice UUID makes one provider order; conflicting reuse is rejected', async () => {
  const a = await create();
  assert.equal(a.status, 201, JSON.stringify(a));
  const count = tributeOrders.size;
  const b = await create(a.input);
  assert.equal(b.status, 201);
  assert.equal(b.body.paymentUrl, a.body.paymentUrl);
  assert.equal(tributeOrders.size, count);
  assert.equal((await create({ ...a.input, amountMinor: 13000 })).status, 409);
  assert.equal((await create(a.input, second)).status, 409);
});
test('signatures, amount, currency and matching customer are required', async () => {
  const a = await create(),
    remote = remoteFor(a.body);
  const event = eventFor(remote);
  assert.equal((await send(event, 'wrong-key')).status, 401);
  assert.equal((await send(eventFor(remote, { amount: 1 }))).status, 409);
  assert.equal((await send(eventFor(remote, { currency: 'rub' }))).status, 409);
  assert.equal((await send(eventFor(remote, { customerId: crypto.randomUUID() }))).status, 409);
  assert.equal((await send(eventFor(remote, { status: 'prepaid' }))).status, 409);
  assert.equal((await send(eventFor(remote, { isTrial: true }))).status, 409);
  assert.equal((await send(eventFor(remote, { shopId: 902 }))).status, 200);
  assert.equal(
    (await db.prepare('SELECT status FROM platform_invoices WHERE id=?').bind(a.body.id).first())
      .status,
    'pending',
  );
});
test('valid payment is recorded once even when Tribute retries with a new sent_at', async () => {
  const a = await create(),
    remote = remoteFor(a.body),
    event = eventFor(remote);
  failTelegram(true);
  try {
    assert.equal((await send(event)).status, 200);
    assert.equal((await send({ ...event, sent_at: '2026-10-14T09:01:00Z' })).status, 200);
  } finally {
    failTelegram(false);
  }
  const row = await db
    .prepare('SELECT * FROM platform_invoices WHERE id=?')
    .bind(a.body.id)
    .first();
  assert.equal(row.status, 'paid');
  assert.equal(row.owner_id, '111');
  assert.ok(row.paid_at);
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) n FROM platform_payment_events WHERE invoice_id=?')
        .bind(a.body.id)
        .first()
    ).n,
    1,
  );
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) n FROM platform_payment_outbox WHERE invoice_id=?')
        .bind(a.body.id)
        .first()
    ).n,
    1,
  );
  assert.equal(
    (await db.prepare('SELECT status FROM stores WHERE id=?').bind(shop.id).first()).status,
    'active',
  );
});
test('refund is recorded and a late original payment cannot undo it', async () => {
  const a = await create(),
    remote = remoteFor(a.body),
    event = eventFor(remote);
  const refund = {
    ...event,
    name: 'shop_order_refunded',
    created_at: '2026-10-14T09:02:00Z',
    payload: {
      uuid: remote.uuid,
      shopId: 901,
      currency: 'eur',
      customerId: a.body.id,
      amount: 500,
    },
  };
  assert.equal((await send(refund)).status, 200);
  assert.equal((await send(event)).status, 200);
  assert.equal(
    (await db.prepare('SELECT status FROM platform_invoices WHERE id=?').bind(a.body.id).first())
      .status,
    'refund_reported',
  );
});
test('timeout never creates a second order and can be recovered by authenticated reconciliation', async () => {
  const data = input();
  failTribute(true);
  let failed;
  try {
    failed = await create(data);
  } finally {
    failTribute(false);
  }
  assert.equal(failed.status, 502);
  const count = tributeOrders.size;
  assert.equal((await create(data)).status, 409);
  assert.equal(tributeOrders.size, count);
  const remote = remoteFor(data);
  const r = await platform('invoices/' + data.id + '/reconcile', 'POST', {
    remoteUuid: remote.uuid,
  });
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.body.status, 'pending');
  const other = await create();
  assert.equal(
    (
      await platform('invoices/' + other.body.id + '/reconcile', 'POST', {
        remoteUuid: remote.uuid,
      })
    ).status,
    409,
  );
});
test('signed webhook can recover an order even before create response was received', async () => {
  const data = input();
  failTribute(true);
  try {
    await create(data);
  } finally {
    failTribute(false);
  }
  assert.equal((await send(eventFor(remoteFor(data)))).status, 200);
  assert.equal(
    (await db.prepare('SELECT status FROM platform_invoices WHERE id=?').bind(data.id).first())
      .status,
    'paid',
  );
});
test('/pay gives a customer only their own invoices and an English checkout label', async () => {
  const a = await create(input(), second);
  const r = await req(
    '/api/telegram/webhook',
    'POST',
    {
      message: {
        text: '/pay',
        chat: { id: 222, type: 'private' },
        from: { id: 222, language_code: 'en' },
      },
    },
    { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK },
  );
  assert.equal(r.status, 200);
  const { notifications } = await import('./harness.js');
  const sent = notifications.filter((n) => n.payload.chat_id === '222');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.reply_markup.inline_keyboard[0][0].url, a.body.paymentUrl);
  assert.equal(sent[0].payload.reply_markup.inline_keyboard[0][0].text, 'Pay with Tribute');
});
