import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, admin, db, mockDomainService, platform, req } from './harness.js';
const token = 'test-collector-secret-never-in-browser';
const tasks = new Map();
const instagramId = 'a'.repeat(32),
  websiteId = 'b'.repeat(32);
let submissions = 0,
  ready = false,
  fail = false;
const respond = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
before(async () => {
  mockDomainService(async (request) => {
    const url = new URL(request.url);
    if (url.hostname.endsWith('.cdninstagram.com'))
      return new Response(new Uint8Array([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0]), {
        headers: { 'Content-Type': 'image/jpeg' },
      });
    assert.equal(url.hostname, 'collector.example');
    assert.equal(request.headers.get('Authorization'), 'Bearer ' + token);
    if (fail) return respond({}, 503);
    if (request.method === 'POST') {
      const payload = await request.json();
      const kind = payload.kind === 'website' ? 'website' : 'instagram';
      const key = request.headers.get('Idempotency-Key');
      if (!tasks.has(key)) {
        submissions++;
        tasks.set(key, payload);
      }
      return respond({ id: kind === 'website' ? websiteId : instagramId, status: 'queued' }, 202);
    }
    if (url.pathname.endsWith('/bundle'))
      return respond({
        username: 'live_shop',
        source: {
          logo_url: 'https://scontent.cdninstagram.com/logo.jpg',
          photo_posts: [
            {
              date: '2026-10-23',
              assets: [{}],
              images: ['https://scontent.cdninstagram.com/item.jpg'],
            },
          ],
        },
        store: {
          name: 'Real shop',
          settings: { description: 'Profile biography' },
          products: [
            {
              name: 'Real item',
              description: 'Actual caption',
              prices: { USD: 0 },
              priceOnRequest: true,
              availability: 'preorder',
              variants: [{ label: 'Ask', stock: null }],
            },
          ],
        },
      });
    const id = url.pathname.split('/').at(-1);
    return respond(
      id === websiteId
        ? {
            id,
            status: 'ready',
            reference: {
              title: 'Reference shop',
              url: 'https://example.com/',
              analysis: 'static_html_css',
            },
          }
        : {
            id,
            status: ready ? 'ready' : 'restricted',
            products: ready ? 1 : 0,
            error: ready ? undefined : 'instagram_access_restricted',
          },
    );
  });
  await start({ IMPORT_API_ORIGIN: 'https://collector.example', IMPORT_API_TOKEN: token });
});
after(stop);
let job;
test('collector submits once, isolates ownership, records restrictions and reference analysis', async () => {
  const created = await admin(930, 'demo-jobs', 'POST', {
    instagram: 'live_shop',
    templateId: 'fashion',
    language: 'en',
    currency: 'USD',
    referenceUrl: 'https://example.com/',
  });
  assert.equal(created.status, 201, JSON.stringify(created));
  job = created.body.job;
  assert.equal(JSON.parse(job.collector_tasks).length, 2);
  assert.equal(submissions, 2);
  await db.prepare('UPDATE collector_tasks SET checked_at=0').run();
  assert.equal((await req(`/api/platform/demo-jobs/${job.id}/sync`, 'POST', {})).status, 401);
  assert.equal((await platform(`demo-jobs/${job.id}/sync`, 'POST', {})).status, 200);
  const denied = await admin(931, `demo-jobs/${job.id}/sync`, 'POST', {});
  assert.equal(denied.status, 404);
  const synced = await admin(930, `demo-jobs/${job.id}/sync`, 'POST', {});
  const tasks = JSON.parse(synced.body.job.collector_tasks);
  assert.equal(tasks.find((t) => t.kind === 'instagram').status, 'restricted');
  assert.equal(tasks.find((t) => t.kind === 'website').status, 'ready');
  assert.equal(synced.body.job.sample_content, 1);
  const refs = await platform('references');
  assert.equal(JSON.parse(refs.body[0].analysis).title, 'Reference shop');
  assert.equal(JSON.stringify(synced.body).includes(token), false);
  assert.equal((await admin(930, `demo-jobs/${job.id}/apply`, 'POST', { version: 1 })).status, 409);
  assert.equal((await admin(931, `demo-jobs/${job.id}/apply`, 'POST', { version: 1 })).status, 404);
});
test('network failure retains retryable task and existing remote ID', async () => {
  fail = true;
  await db
    .prepare("UPDATE collector_tasks SET status='running',checked_at=0 WHERE kind='instagram'")
    .run();
  assert.equal((await admin(930, `demo-jobs/${job.id}/sync`, 'POST', {})).status, 200);
  assert.equal(
    (await db.prepare("SELECT remote_id FROM collector_tasks WHERE kind='instagram'").first())
      .remote_id,
    instagramId,
  );
  fail = false;
});
test('explicit apply archives photos, keeps design and owner, does not activate orders, and cannot repeat', async () => {
  ready = true;
  await db.prepare("UPDATE collector_tasks SET checked_at=0 WHERE kind='instagram'").run();
  await admin(930, `demo-jobs/${job.id}/sync`, 'POST', {});
  assert.equal(
    (await admin(930, `demo-jobs/${job.id}/apply`, 'POST', { version: 99 })).status,
    409,
  );
  const applied = await admin(930, `demo-jobs/${job.id}/apply`, 'POST', { version: 1 });
  assert.equal(applied.status, 200, JSON.stringify(applied));
  const own = await admin(930, `stores/${job.store_id}`);
  assert.equal(own.body.name, 'Real shop');
  assert.equal(own.body.settings.theme, 'fashion');
  assert.equal(own.body.settings.language, 'en');
  assert.equal(own.body.acceptingOrders, false);
  assert.ok(own.body.settings.logo.startsWith('/media/' + job.store_id + '/'));
  const ps = await admin(930, `stores/${job.store_id}/products`);
  assert.equal(ps.body.length, 1);
  assert.equal(ps.body[0].name, 'Real item');
  assert.equal(ps.body[0].priceOnRequest, true);
  assert.ok(ps.body[0].photos[0].startsWith('/media/' + job.store_id + '/'));
  assert.equal((await admin(930, `demo-jobs/${job.id}/apply`, 'POST', { version: 2 })).status, 409);
  await admin(930, `demo-jobs/${job.id}/sync`, 'POST', {});
  assert.equal((await admin(930, 'demo-jobs')).body[0].sample_content, 0);
  assert.equal(submissions, 2);
});
