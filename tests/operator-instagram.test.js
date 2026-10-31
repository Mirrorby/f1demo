import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, platform, admin, req, db, mockDomainService } from './harness.js';
let ready = false,
  username = '';
before(async () => {
  mockDomainService(async (request) => {
    const url = new URL(request.url);
    if (url.pathname.includes('/assets/'))
      return new Response(new Uint8Array([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    if (request.method === 'POST') {
      username = (await request.json()).instagram;
      return Response.json({ id: 'a'.repeat(32), status: 'queued' });
    }
    if (url.pathname.endsWith('/bundle'))
      return Response.json({
        username,
        source: {
          period: { complete: true },
          photo_posts: [
            { date: '2026-10-31', assets: [{ file: 'assets/' + 'f'.repeat(64) + '.jpg' }] },
          ],
        },
        store: {
          name: 'Imported store',
          settings: { description: 'Imported' },
          products: [
            { name: 'Product', prices: { USD: 1000 }, variants: [{ label: 'One', stock: 1 }] },
          ],
        },
      });
    return Response.json({ id: 'a'.repeat(32), status: ready ? 'ready' : 'running' });
  });
  await start({
    IMPORT_API_ORIGIN: 'https://collector.example',
    IMPORT_API_TOKEN: 'test-token-with-at-least-32-characters',
  });
});
after(stop);
test('operator creates and completes an unowned Instagram demo through authenticated routes', async () => {
  assert.equal((await req('/api/platform/demo-jobs', 'POST', {})).status, 401);
  assert.equal((await platform('demo-jobs', 'POST', { templateId: 'minimal' })).status, 400);
  const input = {
    instagram: '@operator_shop',
    templateId: 'minimal',
    language: 'ro',
    languages: ['ro', 'en'],
    currency: 'MDL',
    periodDays: 7,
  };
  const created = await platform('demo-jobs', 'POST', input);
  assert.equal(created.status, 201, JSON.stringify(created));
  const id = created.body.job.id;
  assert.equal(
    await db.prepare('SELECT id FROM stores WHERE id=?').bind(created.body.job.store_id).first(),
    null,
  );
  assert.equal((await platform('demo-jobs', 'POST', input)).body.job.id, id);
  assert.equal((await admin(111, 'demo-jobs')).body.length, 0);
  ready = true;
  await db.prepare('UPDATE collector_tasks SET checked_at=0 WHERE job_id=?').bind(id).run();
  const result = await platform('demo-jobs/' + id + '/sync', 'POST', {});
  assert.equal(result.status, 200);
  const row = await db
    .prepare('SELECT owner_id,orders_enabled FROM stores WHERE id=?')
    .bind(created.body.job.store_id)
    .first();
  assert.equal(row.owner_id, null);
  assert.equal(row.orders_enabled, 0);
  const jobs = (await platform('demo-jobs')).body;
  assert.equal(jobs[0].status, 'ready');
  const store = (await platform('stores/' + created.body.job.store_id)).body;
  assert.deepEqual(store.settings.languages, ['ro', 'en']);
  assert.deepEqual(store.settings.currencies, ['MDL']);
  assert.equal(
    (
      await platform('stores/' + store.id + '/delete-demo', 'POST', {
        version: store.version,
        confirmSlug: store.slug,
      })
    ).status,
    200,
  );
  assert.equal((await platform('demo-jobs')).body.length, 0);
  assert.equal(
    (await db.prepare('SELECT COUNT(*) n FROM demo_statistics WHERE job_id=?').bind(id).first()).n,
    1,
  );
});
