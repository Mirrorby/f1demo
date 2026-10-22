import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, admin, req, db, platform } from './harness.js';
before(start);
after(stop);
const create = (owner, changes = {}) =>
  admin(owner, 'demo-jobs', 'POST', {
    instagram: '@new_shop',
    templateId: 'fashion',
    language: 'en',
    currency: 'USD',
    ...changes,
  });
test('self service owns demo atomically, persists reference and protects edits on retry', async () => {
  const created = await create(901, {
    instagram: 'https://www.instagram.com/New_Shop/?igsh=test',
    referenceUrl: 'https://example.com/shop?utm_source=ig#top',
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const j = created.body.job;
  assert.equal(j.instagram, 'new_shop');
  assert.equal(j.status, 'awaiting_import');
  assert.equal(j.sample_content, 1);
  const own = await admin(901, `stores/${j.store_id}`);
  assert.equal(own.status, 200);
  assert.equal(own.body.acceptingOrders, false);
  assert.equal(own.body.settings.instagram, 'new_shop');
  assert.equal(own.body.settings.language, 'en');
  const products = await admin(901, `stores/${j.store_id}/products`);
  assert.equal(products.body.length, 6);
  await admin(901, `stores/${j.store_id}/settings`, 'PUT', {
    name: 'Edited',
    version: 1,
    settings: own.body.settings,
  });
  const again = await create(901, { referenceUrl: 'https://example.com/shop' });
  assert.equal(again.body.job.id, j.id);
  assert.equal((await admin(901, `stores/${j.store_id}`)).body.name, 'Edited');
  assert.equal((await create(901, { templateId: 'beauty' })).status, 409);
  assert.equal((await admin(902, `stores/${j.store_id}`)).status, 404);
  assert.deepEqual((await admin(902, 'demo-jobs')).body, []);
  assert.equal((await req('/api/admin/demo-jobs', 'POST', {})).status, 401);
  assert.equal((await req('/api/stores/' + j.slug + '/orders', 'POST', {})).status, 409);
  const refs = await platform('references');
  assert.equal(refs.status, 200);
  assert.equal(refs.body[0].url, 'https://example.com/shop');
  assert.equal((await admin(901, '../platform/references')).status, 401);
});
test('validates inputs, deduplicates references and enforces free demo quota', async () => {
  for (const instagram of [
    'https://evil.com/name',
    'https://instagram.com/p/abc',
    '@',
    'bad..name',
    'https://instagram.com/reels',
  ])
    assert.equal((await create(910, { instagram })).status, 400, instagram);
  for (const referenceUrl of [
    'http://example.com',
    'https://user:password@example.com',
    'https://127.0.0.1',
    'https://localhost',
  ])
    assert.equal((await create(910, { referenceUrl })).status, 400, referenceUrl);
  assert.equal((await create(910, { templateId: 'missing' })).status, 400);
  for (const instagram of ['quota_a', 'quota_b', 'quota_c'])
    assert.equal(
      (await create(910, { instagram, referenceUrl: 'https://example.com/shop' })).status,
      201,
    );
  assert.equal((await create(910, { instagram: 'quota_d' })).status, 429);
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) n FROM site_references WHERE url=?')
        .bind('https://example.com/shop')
        .first()
    ).n,
    1,
  );
});
test('concurrent submissions return one job and one store', async () => {
  const results = await Promise.all([create(920), create(920)]);
  assert.ok(
    results.every((r) => r.status === 201),
    JSON.stringify(results),
  );
  assert.equal(results[0].body.job.id, results[1].body.job.id);
  assert.equal((await admin(920, 'stores')).body.length, 1);
});
