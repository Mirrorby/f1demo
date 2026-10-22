import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  start,
  stop,
  req,
  platform,
  admin,
  mf,
  db,
  PLATFORM,
  orderFor,
  checkout,
} from './harness.js';
before(start);
after(stop);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGN8yMbAwMDAxMDAwMDAAAAL3wDrtkO4LAAAAABJRU5ErkJggg==',
  'base64',
);

test('all templates contain complete editable copy and six sample products', async () => {
  for (const id of ['minimal', 'fashion', 'home', 'beauty']) {
    const preview = await req('/api/templates/' + id);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.products.length, 6);
    const cfg = preview.body.store.settings;
    assert.ok(cfg.heroTitle && cfg.footerText && cfg.deliveryHint);
    assert.equal(Object.keys(cfg.texts).length, id === 'fashion' ? 27 : 19);
    for (const p of preview.body.products) {
      assert.ok(p.description.length > 80 && p.color && p.brand && p.sku && p.collection);
      assert.ok(!p.description.includes('Пример товара'));
    }
  }
});

test('platform template photos require authentication, survive saves, and seed independent store files', async () => {
  const path = 'templates/minimal';
  assert.equal((await req('/api/platform/' + path)).status, 401);
  assert.equal((await admin(111, path)).status, 404);
  const initial = (await platform(path)).body;
  const uploaded = await mf.dispatchFetch('http://localhost/api/platform/' + path + '/images', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PLATFORM, 'Content-Type': 'image/png' },
    body: png,
  });
  assert.equal(uploaded.status, 201);
  const { url } = await uploaded.json();
  assert.equal(
    (await platform(path, 'PUT', { version: initial.version, photos: { 0: url } })).status,
    200,
  );
  assert.equal((await platform(path, 'PUT', { version: initial.version, photos: {} })).status, 409);
  assert.equal(
    (await platform(path, 'PUT', { version: initial.version + 1, photos: { 6: url } })).status,
    400,
  );
  const other = (await platform('templates/home')).body;
  assert.equal(
    (await platform('templates/home', 'PUT', { version: other.version, photos: { 0: url } }))
      .status,
    400,
  );
  assert.equal((await req('/api/templates/minimal')).body.products[0].photos[0], url);
  const created = await platform('stores', 'POST', {
    name: 'Custom sample photos',
    templateId: 'minimal',
    seedProducts: true,
  });
  assert.equal(created.status, 201, JSON.stringify(created));
  const data = (await req('/api/stores/' + created.body.slug)).body;
  const copied = data.products.find((p) => p.name === initial.products[0].name).photos[0];
  assert.ok(copied.startsWith('/media/' + created.body.id + '/'));
  assert.notEqual(copied, url);
  const bucket = await mf.getR2Bucket('IMAGES');
  assert.deepEqual(Buffer.from(await (await bucket.get(copied.slice(7))).arrayBuffer()), png);
  assert.equal(
    (await platform(path, 'PUT', { version: initial.version + 1, photos: {} })).status,
    200,
  );
  await bucket.delete(url.slice(7));
  assert.equal((await req(copied)).status, 200);
  assert.ok(
    (await req('/api/templates/minimal')).body.products[0].photos[0].startsWith(
      '/template-assets/',
    ),
  );
});

test('short storefront aliases support demo and active status and share links contain no personal domain', async () => {
  const created = (await platform('stores', 'POST', { name: 'Short', slug: 'short' })).body;
  assert.equal((await req('/s/short')).status, 200);
  let data = (await req('/api/stores/short')).body;
  assert.equal(data.store.shareUrl, 'https://t.me/catalog_test_bot?startapp=s_short');
  await db
    .prepare("UPDATE stores SET status='active',owner_id='111' WHERE id=?")
    .bind(created.id)
    .run();
  assert.equal((await req('/s/short')).status, 200);
  assert.equal((await req('/demo/short')).status, 302);
  assert.equal((await req('/s/missing')).status, 404);
  assert.equal(
    (await req('/s/app.js')).headers.get('Content-Type'),
    'application/javascript; charset=utf-8',
  );
});

test('order images are authoritative snapshots; legacy orders use catalog photos only when missing', async () => {
  const store = (
    await platform('stores', 'POST', {
      name: 'Snapshot',
      products: [
        { name: 'Photo item', prices: { BYN: 1000 }, photos: ['/template-assets/home-cup.svg'] },
      ],
    })
  ).body;
  await db
    .prepare("UPDATE stores SET status='active',owner_id='111' WHERE id=?")
    .bind(store.id)
    .run();
  const p = (await req('/api/stores/' + store.slug)).body.products[0];
  const input = orderFor(p);
  input.items[0].photo = 'https://untrusted.example/forged.jpg';
  const order = await checkout(input, undefined, store.slug);
  assert.equal(order.status, 201);
  const path = `stores/${store.id}/orders/${order.body.id}`;
  assert.equal((await admin(111, path)).body.items[0].photo, '/template-assets/home-cup.svg');
  assert.equal(
    (
      await platform(`stores/${store.id}/products/${p.id}`, 'PUT', {
        ...(await req('/api/stores/' + store.slug)).body.products[0],
        photos: ['/template-assets/home-vase.svg'],
      })
    ).status,
    200,
  );
  assert.equal((await admin(111, path)).body.items[0].photo, '/template-assets/home-cup.svg');
  await db
    .prepare("UPDATE orders SET items=json_remove(items,'$[0].photo') WHERE id=?")
    .bind(order.body.id)
    .run();
  assert.equal((await admin(111, path)).body.items[0].photo, '/template-assets/home-vase.svg');
  await db
    .prepare("UPDATE orders SET items=json_set(items,'$[0].photo','') WHERE id=?")
    .bind(order.body.id)
    .run();
  assert.equal((await admin(111, path)).body.items[0].photo, '');
});
