import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import {
  start,
  stop,
  mf,
  db,
  shop,
  demo,
  second,
  catalog,
  secondCatalog,
  req,
  platform,
  admin,
  checkout,
  orderFor,
  initData,
  WEBHOOK,
  notifications,
  failTelegram,
} from './harness.js';
before(start);
after(stop);

test('catalog isolation, assets and unknown stores', async () => {
  const a = await req('/shop/' + shop.slug);
  assert.equal(a.status, 200);
  assert.match(a.body, /storefront.js/);
  assert.equal((await req('/shop/not-found')).status, 404);
  assert.equal((await req('/api/stores/' + demo.slug)).body.store.status, 'demo');
  assert.notEqual(
    catalog.products.find((p) => p.name === 'Bag').id,
    secondCatalog.products.find((p) => p.name === 'Bag').id,
  );
  assert.equal((await req('/api/admin/stores')).status, 401);
});
test('Telegram auth rejects forged, stale, future and duplicate fields', async () => {
  assert.equal((await admin(111, 'stores')).status, 200);
  for (const data of [
    initData(111) + '&user={"id":222}',
    initData(111, 1),
    initData(111, Math.floor(Date.now() / 1000) + 1000),
    initData(111).replace(/hash=./, 'hash=fake'),
  ])
    assert.equal(
      (await req('/api/admin/stores', 'GET', undefined, { Authorization: 'tma ' + data })).status,
      401,
    );
});
test('another owner cannot read or mutate any store resource', async () => {
  for (const [path, method, data] of [
    [`stores/${second.id}`, 'GET'],
    [`stores/${second.id}/products`, 'GET'],
    [`stores/${second.id}/orders`, 'GET'],
    [`stores/${second.id}/settings`, 'PUT', {}],
    [`stores/${second.id}/images`, 'POST', {}],
  ])
    assert.equal((await admin(111, path, method, data)).status, 404, path);
  assert.equal((await admin(111, `stores/${shop.id}`)).body.stats.productCount, 2);
});
test('demo checkout, foreign products, stale prices and invalid quantities are rejected', async () => {
  assert.equal((await checkout(orderFor(), undefined, demo.slug)).status, 409);
  assert.equal(
    (await checkout(orderFor(secondCatalog.products.find((p) => p.name === 'Bag')))).status,
    409,
  );
  const stale = orderFor();
  stale.items[0].expectedUnitMinor = 1;
  assert.equal((await checkout(stale)).status, 409);
  const invalid = orderFor();
  invalid.items[0].quantity = 0;
  assert.equal((await checkout(invalid)).status, 400);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM orders').first()).n, 0);
});
test('orders calculate discounts, reserve stock and notify the correct owner', async () => {
  const r = await checkout({ ...orderFor(), total: 1, price: 1 }, 'test-key-first-order');
  assert.equal(r.status, 201, JSON.stringify(r));
  assert.equal(r.body.totalMinor, 9000);
  const row = await db.prepare('SELECT * FROM orders WHERE id=?').bind(r.body.id).first();
  assert.equal(row.status, 'new');
  assert.equal(
    (
      await db
        .prepare('SELECT stock FROM variants WHERE id=?')
        .bind(catalog.products.find((p) => p.name === 'Bag').variants[0].id)
        .first()
    ).stock,
    4,
  );
  // Miniflare completes waitUntil independently. Wait on the durable outbox status.
  for (let i = 0; i < 20; i++) {
    const n = await db
      .prepare('SELECT sent_at FROM notification_outbox WHERE order_id=?')
      .bind(r.body.id)
      .first();
    if (n.sent_at) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const sent = notifications.find(
    (n) => n.path.endsWith('/sendMessage') && n.payload.text?.includes('Новый заказ'),
  );
  assert.ok(sent, 'notification delivered');
  assert.equal(String(sent.payload.chat_id), '111');
});
test('idempotency prevents duplicates, including simultaneous retries', async () => {
  const data = orderFor(),
    key = 'concurrent-key-001';
  const rs = await Promise.all([checkout(data, key), checkout(data, key)]);
  assert.deepEqual(
    rs.map((x) => x.status),
    [201, 201],
  );
  assert.equal(rs[0].body.id, rs[1].body.id);
  assert.equal((await checkout(data, key)).body.id, rs[0].body.id);
  assert.equal(
    (await db.prepare('SELECT COUNT(*) n FROM orders WHERE idempotency_key=?').bind(key).first()).n,
    1,
  );
  assert.equal((await checkout(orderFor(undefined, 2), key)).status, 409);
});
test('competing orders cannot oversell; failed insert rolls back', async () => {
  await db
    .prepare('UPDATE variants SET stock=1 WHERE id=?')
    .bind(catalog.products.find((p) => p.name === 'Bag').variants[0].id)
    .run();
  const rs = await Promise.all([checkout(orderFor()), checkout(orderFor())]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (
      await db
        .prepare('SELECT stock FROM variants WHERE id=?')
        .bind(catalog.products.find((p) => p.name === 'Bag').variants[0].id)
        .first()
    ).stock,
    0,
  );
});
test('cancellation persists, restores stock once and is terminal', async () => {
  const o = await db
      .prepare('SELECT * FROM orders WHERE store_id=? ORDER BY number DESC LIMIT 1')
      .bind(shop.id)
      .first(),
    path = `stores/${shop.id}/orders/${o.id}`;
  assert.equal((await admin(222, path, 'PATCH', { status: 'cancelled' })).status, 404);
  assert.equal((await admin(111, path, 'PATCH', { status: 'cancelled' })).status, 200);
  assert.equal((await admin(111, path, 'PATCH', { status: 'cancelled' })).status, 200);
  assert.equal(
    (
      await db
        .prepare('SELECT stock FROM variants WHERE id=?')
        .bind(catalog.products.find((p) => p.name === 'Bag').variants[0].id)
        .first()
    ).stock,
    1,
  );
  assert.equal((await admin(111, path, 'PATCH', { status: 'processing' })).status, 409);
});
test('product CRUD uses revision checks; settings changes appear in public API', async () => {
  const data = {
    name: 'New cap <script>',
    category: 'Caps',
    prices: { BYN: 1200, RUB: 35000 },
    photos: [],
    variants: [{ label: 'Без вариантов', stock: null }],
  };
  const created = await admin(111, `stores/${shop.id}/products`, 'POST', data);
  assert.equal(created.status, 201);
  let p = (await admin(111, `stores/${shop.id}/products`)).body.find(
    (p) => p.id === created.body.id,
  );
  assert.equal(p.name, data.name);
  assert.equal(
    (await admin(111, `stores/${shop.id}/products/${p.id}`, 'PUT', { ...p, name: 'Updated cap' }))
      .status,
    200,
  );
  assert.equal((await admin(111, `stores/${shop.id}/products/${p.id}`, 'PUT', p)).status, 409);
  p = (await admin(111, `stores/${shop.id}/products`)).body.find((x) => x.id === p.id);
  assert.equal(
    (await admin(111, `stores/${shop.id}/products/${p.id}`, 'DELETE', { version: p.version }))
      .status,
    200,
  );
  assert.ok(!(await req('/api/stores/' + shop.slug)).body.products.some((x) => x.id === p.id));
  const s = (await admin(111, `stores/${shop.id}`)).body;
  assert.equal(
    (
      await admin(111, `stores/${shop.id}/settings`, 'PUT', {
        ...s,
        name: 'Changed store',
        settings: { ...s.settings, accentColor: '#112233' },
      })
    ).status,
    200,
  );
  assert.equal((await req('/api/stores/' + shop.slug)).body.store.name, 'Changed store');
});
test('R2 upload validates actual image type and store prefix', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=',
    'base64',
  );
  const r = await mf.dispatchFetch(`http://localhost/api/admin/stores/${shop.id}/images`, {
    method: 'POST',
    headers: { Authorization: 'tma ' + initData(111), 'Content-Type': 'image/png' },
    body: png,
  });
  assert.equal(r.status, 201);
  const { url } = await r.json();
  assert.ok(url.startsWith('/media/' + shop.id + '/'));
  assert.equal((await req(url)).status, 200);
  const bad = await mf.dispatchFetch(`http://localhost/api/admin/stores/${shop.id}/images`, {
    method: 'POST',
    headers: { Authorization: 'tma ' + initData(111), 'Content-Type': 'image/png' },
    body: '<svg onload=alert(1) />',
  });
  assert.equal(bad.status, 415);
  const p = (await admin(222, `stores/${second.id}/products`)).body[0];
  assert.equal(
    (await admin(222, `stores/${second.id}/products/${p.id}`, 'PUT', { ...p, photos: [url] }))
      .status,
    400,
  );
});
test('webhook secret, expected owner and single-use invitation', async () => {
  const invite = await platform(`stores/${demo.id}/invite`, 'POST', { telegramUserId: '333' });
  assert.equal(invite.status, 200);
  const token = new URL(invite.body.url).searchParams.get('start');
  const message = (id) => ({
    update_id: 1,
    message: { text: '/start ' + token, from: { id }, chat: { id, type: 'private' } },
  });
  const secret = { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK };
  assert.equal((await req('/api/telegram/webhook', 'POST', message(333))).status, 401);
  await req('/api/telegram/webhook', 'POST', message(444), secret);
  assert.equal(
    (await db.prepare('SELECT owner_id FROM stores WHERE id=?').bind(demo.id).first()).owner_id,
    null,
  );
  await req('/api/telegram/webhook', 'POST', message(333), secret);
  assert.equal(
    (await db.prepare('SELECT owner_id FROM stores WHERE id=?').bind(demo.id).first()).owner_id,
    '333',
  );
  await req('/api/telegram/webhook', 'POST', message(444), secret);
  assert.equal(
    (await db.prepare('SELECT owner_id FROM stores WHERE id=?').bind(demo.id).first()).owner_id,
    '333',
  );
  assert.equal((await platform(`stores/${demo.id}/activate`, 'POST', {})).status, 200);
  assert.equal((await req('/demo/' + demo.slug)).status, 302);
});
test('bot status callbacks verify the owner and update D1', async () => {
  const o = await db
    .prepare("SELECT * FROM orders WHERE store_id=? AND status='new' LIMIT 1")
    .bind(shop.id)
    .first();
  const secret = { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK };
  const callback = (id) => ({
    callback_query: {
      id: 'test-callback',
      from: { id },
      message: { chat: { id, type: 'private' } },
      data: 'a:' + o.id,
    },
  });
  await req('/api/telegram/webhook', 'POST', callback(222), secret);
  assert.equal(
    (await db.prepare('SELECT status FROM orders WHERE id=?').bind(o.id).first()).status,
    'new',
  );
  await req('/api/telegram/webhook', 'POST', callback(111), secret);
  assert.equal(
    (await db.prepare('SELECT status FROM orders WHERE id=?').bind(o.id).first()).status,
    'processing',
  );
});
test('factory validates status, handles slug collisions and exports data', async () => {
  assert.equal((await platform('stores', 'POST', { name: 'Bad', status: 'active' })).status, 400);
  const other = await platform('stores', 'POST', { name: 'Second', slug: shop.slug });
  assert.equal(other.status, 201);
  assert.notEqual(other.body.slug, shop.slug);
  const exp = await platform(`stores/${shop.id}/export`, 'GET');
  assert.equal(exp.status, 200);
  assert.equal(exp.body.schemaVersion, 1);
  assert.ok(exp.body.products.length);
  assert.equal(exp.body.owner_id, undefined);
});

test('notification failures preserve the order and cron retries the durable outbox', async () => {
  failTelegram(true);
  const p = (await req('/api/stores/' + shop.slug)).body.products.find(
    (p) => p.name === 'No-size item',
  );
  const saved = await checkout(orderFor(p));
  assert.equal(saved.status, 201);
  let outbox;
  for (let i = 0; i < 30; i++) {
    outbox = await db
      .prepare('SELECT * FROM notification_outbox WHERE order_id=?')
      .bind(saved.body.id)
      .first();
    if (outbox.attempts) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(outbox.attempts >= 1);
  assert.equal(outbox.sent_at, null);
  assert.ok(await db.prepare('SELECT id FROM orders WHERE id=?').bind(saved.body.id).first());
  failTelegram(false);
  await db
    .prepare('UPDATE notification_outbox SET next_attempt=0 WHERE order_id=?')
    .bind(saved.body.id)
    .run();
  const worker = await mf.getWorker('engine');
  await worker.scheduled({ scheduledTime: Date.now(), cron: '*/10 * * * *' });
  for (let i = 0; i < 30; i++) {
    outbox = await db
      .prepare('SELECT * FROM notification_outbox WHERE order_id=?')
      .bind(saved.body.id)
      .first();
    if (outbox.sent_at) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(outbox.sent_at, 'cron delivered queued notification');
});

test('uploads enforce size and product edits reject foreign variant IDs', async () => {
  // Send only headers: an early 413 must not race a large Undici upload.
  const endpoint = new URL(`/api/admin/stores/${shop.id}/images`, await mf.ready);
  const status = await new Promise((resolve, reject) => {
    const upload = httpRequest(
      endpoint,
      {
        method: 'POST',
        headers: {
          Authorization: 'tma ' + initData(111),
          'Content-Type': 'image/png',
          'Content-Length': String(3 * 1024 * 1024 + 1),
        },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode);
        upload.destroy();
      },
    );
    upload.on('error', reject);
    upload.end();
  });
  assert.equal(status, 413);
  const p = (await admin(111, `stores/${shop.id}/products`)).body.find(
    (p) => p.name === 'No-size item',
  );
  const foreign = secondCatalog.products[0].variants[0];
  assert.equal(
    (await admin(111, `stores/${shop.id}/products/${p.id}`, 'PUT', { ...p, variants: [foreign] }))
      .status,
    400,
  );
});

test('checkout rate limit is enforced without affecting another store', async () => {
  const p = secondCatalog.products.find((p) => p.name === 'No-size item');
  for (let i = 0; i < 10; i++)
    assert.equal((await checkout(orderFor(p), crypto.randomUUID(), second.slug)).status, 201);
  assert.equal((await checkout(orderFor(p), crypto.randomUUID(), second.slug)).status, 429);
});

test('database currency guards reject races that bypass an earlier API read', async () => {
  const current = await db.prepare('SELECT * FROM stores WHERE id=?').bind(shop.id).first();
  const config = JSON.parse(current.settings);
  config.currencies = ['USD'];
  await assert.rejects(
    db
      .prepare('UPDATE stores SET settings=? WHERE id=?')
      .bind(JSON.stringify(config), shop.id)
      .run(),
    /CATALOG_CHANGED/,
  );
  const p = (await admin(111, `stores/${shop.id}/products`)).body[0];
  await assert.rejects(
    db
      .prepare("UPDATE products SET data=json_remove(data,'$.prices.BYN') WHERE id=?")
      .bind(p.id)
      .run(),
    /CATALOG_CHANGED/,
  );
});

test('Delokay welcomes users in their Telegram language, supports manual choice and help', async () => {
  const headers = { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK };
  const message = (id, txt, lang) => ({
    message: { chat: { id, type: 'private' }, from: { id, language_code: lang }, text: txt },
  });
  const callback = (id, data, lang) => ({
    callback_query: {
      id: 'callback-' + id + '-' + data,
      from: { id, language_code: lang },
      message: { chat: { id, type: 'private' } },
      data,
    },
  });
  let before = notifications.length;
  assert.equal(
    (await req('/api/telegram/webhook', 'POST', message(777, '/start', 'en'), headers)).status,
    200,
  );
  let sent = notifications.slice(before).filter((n) => n.path.endsWith('/sendMessage'));
  assert.ok(sent.some((n) => n.payload.text.includes('Welcome to Delokay')));
  before = notifications.length;
  assert.equal(
    (await req('/api/telegram/webhook', 'POST', message(777, '/help', 'en'), headers)).status,
    200,
  );
  sent = notifications.slice(before).filter((n) => n.path.endsWith('/sendMessage'));
  assert.ok(sent.some((n) => n.payload.text.includes('Delokay help')));
  assert.equal(
    (await req('/api/telegram/webhook', 'POST', callback(777, 'lang:ru', 'en'), headers)).status,
    200,
  );
  before = notifications.length;
  assert.equal(
    (await req('/api/telegram/webhook', 'POST', message(777, '/start', 'en'), headers)).status,
    200,
  );
  sent = notifications.slice(before).filter((n) => n.path.endsWith('/sendMessage'));
  assert.ok(sent.some((n) => n.payload.text.includes('Привет! Добро пожаловать в Delokay')));
  before = notifications.length;
  assert.equal(
    (await req('/api/telegram/webhook', 'POST', message(778, '/start', 'ru'), headers)).status,
    200,
  );
  sent = notifications.slice(before).filter((n) => n.path.endsWith('/sendMessage'));
  assert.ok(sent.some((n) => n.payload.text.includes('Привет!')));
});

test('browser factory routes require the platform key and do not expose secrets', async () => {
  assert.equal((await req('/api/platform/config')).status, 401);
  assert.equal((await req('/api/platform/stores')).status, 401);
  assert.equal((await req('/api/platform/telegram/setup', 'POST', {})).status, 401);
  const config = await platform('config', 'GET');
  assert.equal(config.status, 200);
  assert.equal(config.body.botUsername, 'catalog_test_bot');
  assert.equal(config.body.TELEGRAM_BOT_TOKEN, undefined);
  const shops = await platform('stores', 'GET');
  assert.ok(shops.body.find((s) => s.id === shop.id).ownerLinked);
  assert.ok(!JSON.stringify(shops.body).includes('owner_id'));
  const setup = await platform('telegram/setup', 'POST', {});
  assert.equal(setup.status, 200, JSON.stringify(setup));
  assert.equal(setup.body.webhookUrl, 'https://store.example/api/telegram/webhook');
  const commands = notifications.filter((n) => n.path.endsWith('/setMyCommands'));
  assert.equal(commands.length, 6);
  assert.deepEqual(
    new Set(commands.map((n) => n.payload.scope.type)),
    new Set(['default', 'all_private_chats']),
  );
  assert.ok(commands.every((n) => n.payload.commands.some((c) => c.command === 'pay')));
  assert.ok(
    commands.some(
      (n) =>
        n.payload.language_code === 'en' &&
        n.payload.commands.find((c) => c.command === 'pay').description === 'Payments and purchases',
    ),
  );
  const profiles = notifications.filter((n) => n.path.endsWith('/setMyDescription'));
  assert.equal(profiles.length, 3);
  assert.ok(
    profiles.some(
      (n) => n.payload.language_code === 'ru' && n.payload.description.includes('Меньше рутины'),
    ),
  );
  assert.ok(
    profiles.some(
      (n) => n.payload.language_code === 'en' && n.payload.description.includes('Less busywork'),
    ),
  );
  const calls = notifications.filter((n) => n.path.endsWith('/setWebhook'));
  assert.ok(calls.length);
  assert.equal(calls.at(-1).payload.secret_token, WEBHOOK);
  assert.equal((await req('/platform')).status, 200);
});
