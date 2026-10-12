import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  start,
  stop,
  mf,
  db,
  shop,
  platform,
  admin,
  req,
  WEBHOOK,
  PLATFORM,
  orderFor,
} from './harness.js';
before(start);
after(stop);
const fixture = {
  name: 'Operator demo',
  slug: 'operator-demo',
  settings: { currencies: ['BYN'] },
  products: [{ name: 'Item', prices: { BYN: 1000 }, variants: [{ label: 'M', stock: 5 }] }],
};
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGN8yMbAwMDAxMDAwMDAAAAL3wDrtkO4LAAAAABJRU5ErkJggg==',
  'base64',
);
async function create(slug) {
  const r = await platform('stores', 'POST', { ...fixture, slug });
  assert.equal(r.status, 201, JSON.stringify(r));
  return r.body;
}
async function claim(url, id) {
  return req(
    '/api/telegram/webhook',
    'POST',
    {
      message: {
        text: '/start ' + new URL(url).searchParams.get('start'),
        from: { id },
        chat: { id, type: 'private' },
      },
    },
    { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK },
  );
}
async function finishCopy(id) {
  for (let i = 0; i < 20; i++) {
    const jobs = (await platform('copies', 'GET')).body;
    const job = jobs.find((j) => j.id === id);
    if (job.status !== 'pending') return job;
    await platform(`copies/${id}/continue`, 'POST', {});
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail('Copy did not complete');
}
test('operator can manage an unowned demo; tenant images and platform auth stay isolated', async () => {
  const s = await create('unowned');
  const base = `stores/${s.id}`;
  assert.equal((await req('/api/platform/' + base + '/products')).status, 401);
  assert.equal((await admin(111, base + '/products')).status, 404);
  const p = (await platform(base + '/products', 'GET')).body[0];
  assert.equal(
    (await platform(base + '/products/' + p.id, 'PUT', { ...p, name: 'Updated item' })).status,
    200,
  );
  const current = (await platform(base, 'GET')).body;
  assert.equal(
    (
      await platform(base + '/settings', 'PUT', {
        name: 'Updated demo',
        settings: current.settings,
        version: current.version,
      })
    ).status,
    200,
  );
  assert.equal((await req('/api/stores/unowned')).body.store.name, 'Updated demo');
  assert.equal(
    (
      await platform(base + '/settings', 'PUT', {
        name: 'Stale',
        settings: current.settings,
        version: current.version,
      })
    ).status,
    409,
  );
  const upload = await mf.dispatchFetch('http://localhost/api/platform/' + base + '/images', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + PLATFORM,
      'Content-Type': 'image/png',
    },
    body: png,
  });
  assert.equal(upload.status, 201);
  const { url } = await upload.json();
  assert.equal((await req(url)).status, 200);
  const other = await create('other-unowned');
  const otherP = (await platform(`stores/${other.id}/products`, 'GET')).body[0];
  assert.equal(
    (
      await platform(`stores/${other.id}/products/${otherP.id}`, 'PUT', {
        ...otherP,
        photos: [url],
      })
    ).status,
    400,
  );
  assert.equal(
    (await platform(base + '/products/' + p.id, 'DELETE', { version: p.version + 1 })).status,
    200,
  );
  assert.equal((await platform(base + '/products', 'GET')).body.length, 0);
});
test('transfer keeps the old owner until acceptance, then rejects old access and replay', async () => {
  const s = await create('transfer-demo'),
    base = `stores/${s.id}`;
  let invite = await platform(base + '/invite', 'POST', { telegramUserId: '111' });
  await claim(invite.body.url, 111);
  assert.equal((await admin(111, base)).status, 200);
  assert.equal((await platform(base + '/invite', 'POST', { telegramUserId: '444' })).status, 409);
  invite = await platform(base + '/invite', 'POST', { telegramUserId: '444', transfer: true });
  assert.equal(invite.status, 200);
  assert.equal((await admin(111, base)).status, 200);
  await claim(invite.body.url, 555);
  assert.equal((await admin(444, base)).status, 404);
  await claim(invite.body.url, 444);
  assert.equal((await admin(111, base)).status, 404);
  assert.equal((await admin(444, base)).status, 200);
  await claim(invite.body.url, 444);
  assert.equal(
    (await db.prepare('SELECT version FROM stores WHERE id=?').bind(s.id).first()).version,
    3,
  );
  const stale = await platform(base + '/invite', 'POST', { telegramUserId: '666', transfer: true });
  const row = (await platform(base, 'GET')).body;
  await platform(base + '/settings', 'PUT', {
    name: row.name,
    settings: row.settings,
    version: row.version,
  });
  await claim(stale.body.url, 666);
  assert.equal((await admin(666, base)).status, 404);
});
test('pause blocks checkout and the SQL race guard while leaving the storefront open', async () => {
  const body = orderFor();
  const key = crypto.randomUUID();
  const placed = await req(`/api/stores/${shop.slug}/orders`, 'POST', body, {
    'Idempotency-Key': key,
  });
  assert.equal(placed.status, 201);
  const s = (await platform(`stores/${shop.id}`, 'GET')).body;
  assert.equal(
    (await platform(`stores/${shop.id}/intake`, 'POST', { enabled: false, version: s.version }))
      .status,
    200,
  );
  assert.equal((await req('/shop/' + shop.slug)).status, 200);
  assert.equal((await req('/api/stores/' + shop.slug)).body.store.acceptingOrders, false);
  assert.equal(
    (
      await req(`/api/stores/${shop.slug}/orders`, 'POST', body, {
        'Idempotency-Key': crypto.randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (await req(`/api/stores/${shop.slug}/orders`, 'POST', body, { 'Idempotency-Key': key })).body
      .id,
    placed.body.id,
  );
  assert.equal(
    (
      await platform(`stores/${shop.id}/orders/${placed.body.id}`, 'PATCH', {
        status: 'processing',
      })
    ).status,
    200,
  );
  await assert.rejects(
    db
      .prepare(
        "INSERT INTO orders(id,store_id,number,idempotency_key,request_hash,customer,items,currency,total_minor,ip_hash) VALUES(?,?,1,'pause-test','hash',?,?,'BYN',1000,'ip')",
      )
      .bind(crypto.randomUUID(), shop.id, JSON.stringify({ deliveryMethod: 'Доставка' }), '[]')
      .run(),
    /STORE_NOT_ACTIVE/,
  );
  assert.equal(
    (await platform(`stores/${shop.id}/intake`, 'POST', { enabled: true, version: s.version }))
      .status,
    409,
  );
  assert.equal(
    (await platform(`stores/${shop.id}/intake`, 'POST', { enabled: true, version: s.version + 1 }))
      .status,
    200,
  );
  assert.equal(
    (
      await platform(`stores/${shop.id}/delete-demo`, 'POST', {
        confirmSlug: shop.slug,
        version: s.version + 2,
      })
    ).status,
    409,
  );
});
test('copy duplicates R2 files and identifiers, and source demo deletion preserves the copy', async () => {
  const source = await create('copy-source'),
    base = `stores/${source.id}`;
  const key = source.id + '/' + crypto.randomUUID() + '.png';
  const bucket = await mf.getR2Bucket('IMAGES');
  await bucket.put(key, png, { httpMetadata: { contentType: 'image/png' } });
  const url = '/media/' + key;
  const p = (await platform(base + '/products', 'GET')).body[0];
  await platform(base + '/products/' + p.id, 'PUT', { ...p, photos: [url] });
  const row = (await platform(base, 'GET')).body;
  await platform(base + '/settings', 'PUT', {
    name: row.name,
    settings: { ...row.settings, logo: url },
    version: row.version,
  });
  const started = await platform(base + '/copy', 'POST', {
    name: 'Independent copy',
    slug: 'independent',
  });
  assert.equal(started.status, 202);
  const job = await finishCopy(started.body.id);
  assert.equal(job.status, 'completed');
  assert.equal(job.total, 1);
  const copy = (await req('/api/stores/independent')).body;
  assert.equal(copy.store.status, 'demo');
  assert.notEqual(copy.products[0].id, p.id);
  assert.notEqual(copy.products[0].variants[0].id, p.variants[0].id);
  assert.ok(copy.products[0].photos[0].startsWith('/media/' + job.targetId + '/'));
  assert.equal(copy.store.settings.logo, copy.products[0].photos[0]);
  assert.equal(
    (await db.prepare('SELECT owner_id FROM stores WHERE id=?').bind(job.targetId).first())
      .owner_id,
    null,
  );
  const current = (await platform(base, 'GET')).body;
  assert.equal(
    (
      await platform(base + '/delete-demo', 'POST', {
        confirmSlug: 'wrong',
        version: current.version,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await platform(base + '/delete-demo', 'POST', {
        confirmSlug: source.slug,
        version: current.version,
      })
    ).status,
    200,
  );
  assert.equal((await req('/api/stores/' + source.slug)).status, 404);
  assert.equal((await req(copy.products[0].photos[0])).status, 200);
});

test('copy resumes across chunks and failed copies never publish partial stores', async () => {
  const source = await create('chunk-source'),
    base = `stores/${source.id}`;
  const bucket = await mf.getR2Bucket('IMAGES');
  const photos = [];
  for (let i = 0; i < 6; i++) {
    const key = source.id + '/' + crypto.randomUUID() + '.png';
    await bucket.put(key, png, { httpMetadata: { contentType: 'image/png' } });
    photos.push('/media/' + key);
  }
  const p = (await platform(base + '/products', 'GET')).body[0];
  await platform(base + '/products/' + p.id, 'PUT', { ...p, photos });
  const started = await platform(base + '/copy', 'POST', {
    name: 'Chunk copy',
    slug: 'chunk-copy',
  });
  const completed = await finishCopy(started.body.id);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.copied, 6);
  const row = (await platform(base + '/products', 'GET')).body[0];
  await bucket.delete(row.photos[5].slice(7));
  const failed = await platform(base + '/copy', 'POST', {
    name: 'Failed copy',
    slug: 'failed-copy',
  });
  const failure = await finishCopy(failed.body.id);
  assert.equal(failure.status, 'failed');
  assert.equal((await req('/api/stores/failed-copy')).status, 404);
  for (let i = 0; i < 5; i++) {
    const worker = await mf.getWorker('engine');
    await worker.scheduled({ scheduledTime: Date.now(), cron: '*/10 * * * *' });
    if (!(await bucket.list({ prefix: failure.targetId + '/' })).objects.length) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal((await bucket.list({ prefix: failure.targetId + '/' })).objects.length, 0);
});
