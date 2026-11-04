import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, admin, db, req, mockDomainService } from './harness.js';
let calls = 0,
  fail = false,
  target;
before(async () => {
  mockDomainService(async (request) => {
    calls++;
    assert.equal(new URL(request.url).hostname, 'is.gd');
    target = new URLSearchParams(await request.text()).get('url');
    return Response.json(
      fail ? { errorcode: 3, errormessage: 'Rate limit' } : { shorturl: 'https://is.gd/testAb' },
    );
  });
  await start();
});
after(stop);
let storeId;
test('short link requires ownership and caches provider result', async () => {
  const created = await admin(8801, 'demo-jobs', 'POST', {
    name: 'Short link test',
    templateId: 'minimal',
    currency: 'USD',
    seedProducts: false,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  storeId = created.body.job.store_id;
  assert.equal((await admin(8802, 'stores/' + storeId + '/short-link', 'POST', {})).status, 404);
  assert.equal(calls, 0);
  const first = await admin(8801, 'stores/' + storeId + '/short-link', 'POST', {});
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.url, 'https://is.gd/testAb');
  assert.ok(target.startsWith('https://store.example/c/'));
  const cached = await admin(8801, 'stores/' + storeId + '/short-link', 'POST', {});
  assert.equal(cached.body.url, first.body.url);
  assert.equal(calls, 1);
  const redirect = await req(new URL(target).pathname + '?lang=en');
  assert.equal(redirect.status, 302);
  assert.ok(redirect.headers.get('location').endsWith('?lang=en'));
});
test('provider failure is recoverable and retries are throttled', async () => {
  await db.prepare("DELETE FROM maintenance_state WHERE key='shortener_next'").run();
  const created = await admin(8803, 'demo-jobs', 'POST', {
    name: 'Failure test',
    templateId: 'minimal',
    currency: 'USD',
    seedProducts: false,
  });
  const id = created.body.job.store_id;
  fail = true;
  assert.equal((await admin(8803, 'stores/' + id + '/short-link', 'POST', {})).status, 502);
  const n = calls;
  assert.equal((await admin(8803, 'stores/' + id + '/short-link', 'POST', {})).status, 429);
  assert.equal(calls, n);
  await db.prepare('UPDATE catalog_short_links SET lease_until=0 WHERE store_id=?').bind(id).run();
  await db.prepare("DELETE FROM maintenance_state WHERE key='shortener_next'").run();
  fail = false;
  assert.equal((await admin(8803, 'stores/' + id + '/short-link', 'POST', {})).status, 200);
});
