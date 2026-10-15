import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  start,
  stop,
  req,
  platform,
  admin,
  mf,
  db,
  shop,
  second,
  catalog,
  PLATFORM,
  mockDomainService,
  orderFor,
} from './harness.js';
const zoneId = 'a'.repeat(32),
  remote = new Map();
let ready = false,
  owned = true,
  proofOK = true,
  removeFails = false,
  loseCreate = false;
let creates = 0;
const response = (result, status = 200) =>
  new Response(JSON.stringify({ success: status < 400, result }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
before(async () => {
  await start({ CUSTOM_DOMAINS_API_TOKEN: 'test-cloudflare-domains-secret' });
  mockDomainService(async (request) => {
    const u = new URL(request.url);
    if (u.hostname === 'api.cloudflare.com') {
      assert.equal(request.headers.get('Authorization'), 'Bearer test-cloudflare-domains-secret');
      const path = u.pathname.replace('/client/v4/zones/' + zoneId, '');
      if (path === '') return response({ name: 'delokay-demo.com', status: 'active' });
      if (path === '/workers/routes')
        return response([{ pattern: '*/*', script: 'catalog-factory' }]);
      if (path === '/custom_hostnames/fallback_origin')
        return response({ origin: 'customers.delokay-demo.com', status: 'active' });
      if (path === '/custom_hostnames' && request.method === 'GET')
        return response(
          [...remote.values()].filter((r) => r.hostname === u.searchParams.get('hostname')),
        );
      if (path === '/custom_hostnames' && request.method === 'POST') {
        const data = await request.json();
        assert.equal(data.ssl.method, 'txt');
        assert.equal(data.custom_metadata, undefined);
        creates++;
        const row = {
          id: crypto.randomUUID(),
          hostname: data.hostname,
          status: 'pending',
          ownership_verification: {
            type: 'txt',
            name: '_cf.' + data.hostname,
            value: 'cloudflare-ownership',
          },
          ssl: {
            status: 'pending_validation',
            validation_records: [
              { txt_name: '_acme-challenge.' + data.hostname, txt_value: 'certificate-token' },
            ],
          },
        };
        remote.set(row.id, row);
        if (loseCreate) {
          loseCreate = false;
          throw Error('Response lost after provider created hostname');
        }
        return response(row);
      }
      const id = path.split('/').at(-1);
      if (request.method === 'DELETE') {
        if (removeFails) return response(null, 503);
        remote.delete(id);
        return response({ id });
      }
      const row = remote.get(id);
      return row
        ? response({
            ...row,
            status: ready ? 'active' : 'pending',
            ssl: { ...row.ssl, status: ready ? 'active' : 'pending_validation' },
          })
        : response(null, 404);
    }
    if (u.hostname === 'cloudflare-dns.com') {
      const host = u.searchParams.get('name').slice('_delokay.'.length);
      const row = await db
        .prepare('SELECT * FROM store_domains WHERE hostname=?')
        .bind(host)
        .first();
      return new Response(
        JSON.stringify({
          Status: 0,
          Answer: [
            { type: 16, data: '"' + (owned ? row.verification_token : 'wrong-token') + '"' },
          ],
        }),
        { headers: { 'Content-Type': 'application/dns-json' } },
      );
    }
    const row = await db
      .prepare('SELECT * FROM store_domains WHERE hostname=?')
      .bind(u.hostname)
      .first();
    const proof =
      row &&
      createHmac('sha256', PLATFORM)
        .update(row.id + ':' + row.hostname + ':' + u.searchParams.get('nonce'))
        .digest('hex');
    return new Response(null, { headers: { 'X-Delokay-Proof': proofOK ? proof : 'forged' } });
  });
});
after(stop);
const client = async (host, path, method = 'GET', data) => {
  const r = await mf.dispatchFetch('https://' + host + path, {
    method,
    headers: data
      ? { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }
      : {},
    body: data ? JSON.stringify(data) : undefined,
    redirect: 'manual',
  });
  const raw = await r.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  return { status: r.status, body, headers: r.headers };
};
let domain;
test('only platform manages domain configuration and bindings; public hostnames are validated', async () => {
  assert.equal((await req('/api/platform/domains')).status, 401);
  assert.equal((await admin(111, 'domains/config')).status, 404);
  assert.equal(
    (await admin(111, 'stores/' + shop.id + '/domains', 'POST', { hostname: 'client.com' })).status,
    404,
  );
  const cfg = (await platform('domains/config')).body;
  assert.equal(cfg.tokenConfigured, true);
  assert.ok(!JSON.stringify(cfg).includes('test-cloudflare'));
  for (const hostname of [
    'localhost',
    '127.0.0.1',
    'x.local',
    'https://client.com/path',
    '*.client.com',
    'client.com:443',
    'user@client.com',
    'x.workers.dev',
    'client.com/x',
    'foo..com',
  ])
    assert.equal(
      (await platform('stores/' + shop.id + '/domains', 'POST', { hostname })).status,
      400,
      hostname,
    );
  const added = await platform('stores/' + shop.id + '/domains', 'POST', {
    hostname: 'WWW.Client-Demo.com.',
  });
  assert.equal(added.status, 201);
  domain = added.body[0];
  assert.equal(domain.hostname, 'www.client-demo.com');
  assert.equal(domain.status, 'draft');
  assert.equal(domain.dnsRecords[0].type, 'TXT');
  assert.equal(
    (await platform('stores/' + second.id + '/domains', 'POST', { hostname: domain.hostname }))
      .status,
    409,
  );
  assert.equal((await client(domain.hostname, '/')).status, 503);
  const beforeSetup = await platform(`stores/${shop.id}/domains/${domain.id}/check`, 'POST', {});
  assert.equal(beforeSetup.body[0].status, 'error');
  assert.ok(beforeSetup.body[0].error.includes('настройте'));
  assert.equal(creates, 0);
});
test('configuration uses CAS; provider record is created once and returns actionable DNS records', async () => {
  const cfg = { zoneId, cnameTarget: 'customers.delokay-demo.com', version: 0 };
  assert.equal((await platform('domains/config', 'PUT', cfg)).status, 200);
  assert.equal((await platform('domains/config', 'PUT', cfg)).status, 409);
  const checkedConfig = await platform('domains/config/check', 'POST', {});
  assert.equal(checkedConfig.status, 200, JSON.stringify(checkedConfig));
  const check = () => platform(`stores/${shop.id}/domains/${domain.id}/check`, 'POST', {});
  let data = (await check()).body[0];
  assert.equal(data.status, 'pending');
  assert.equal(creates, 1);
  assert.equal(data.dnsRecords.length, 4);
  assert.ok(data.dnsRecords.some((r) => r.value === 'certificate-token'));
  await check();
  assert.equal(creates, 1);
  assert.equal(
    (
      await platform('domains/config', 'PUT', {
        ...cfg,
        version: 1,
        cnameTarget: 'other.delokay-demo.com',
      })
    ).status,
    409,
  );
});
test('active requires provider SSL, independent TXT ownership, and real HTTPS routing proof', async () => {
  ready = true;
  owned = false;
  const check = async () =>
    (await platform(`stores/${shop.id}/domains/${domain.id}/check`, 'POST', {})).body[0];
  let row = await check();
  assert.equal(row.status, 'pending');
  assert.ok(row.error.includes('TXT'));
  owned = true;
  proofOK = false;
  row = await check();
  assert.equal(row.status, 'pending');
  assert.ok(row.error.includes('открывает'));
  proofOK = true;
  row = await check();
  assert.equal(row.status, 'active');
  assert.equal(
    (await admin(111, 'stores/' + shop.id)).body.customUrl,
    'https://' + domain.hostname,
  );
});
test('client domain serves its store at root, allows checkout, and blocks other stores and admin assets', async () => {
  const insecure = await mf.dispatchFetch('http://' + domain.hostname + '/', {
    redirect: 'manual',
  });
  assert.equal(insecure.status, 308);
  assert.equal(insecure.headers.get('Location'), 'https://' + domain.hostname + '/');
  const html = await client(domain.hostname, '/');
  assert.equal(html.status, 200);
  assert.ok(html.body.includes('data-store-slug="' + shop.slug + '"'));
  const data = await client(domain.hostname, '/api/stores/' + shop.slug);
  assert.equal(data.body.store.id, shop.id);
  assert.equal((await client(domain.hostname, '/api/stores/' + second.slug)).status, 404);
  for (const path of [
    '/admin',
    '/admin.html',
    '/admin.js',
    '/platform',
    '/platform.html',
    '/api/platform/domains',
    '/api/tribute/webhook',
    '/templates/home',
    '/s/' + second.slug,
    '/media/' + second.id + '/' + crypto.randomUUID() + '.jpg',
  ])
    assert.equal((await client(domain.hostname, path)).status, 404, path);
  assert.equal((await client(domain.hostname, '/storefront.css')).status, 200);
  assert.equal((await client(domain.hostname, '/s/app.js')).status, 200);
  const order = await client(
    domain.hostname,
    '/api/stores/' + shop.slug + '/orders',
    'POST',
    orderFor(catalog.products.find((p) => p.name === 'Bag')),
  );
  assert.equal(order.status, 201, JSON.stringify(order));
});
test('lost provider response is reconciled, and deletion failure retains a disabled recoverable binding', async () => {
  const add = await platform('stores/' + second.id + '/domains', 'POST', {
    hostname: 'recover-client.com',
  });
  const recovery = add.body.find((r) => r.hostname === 'recover-client.com');
  const check = () => platform(`stores/${second.id}/domains/${recovery.id}/check`, 'POST', {});
  loseCreate = true;
  assert.equal((await check()).body[0].status, 'error');
  const count = creates;
  await check();
  assert.equal(creates, count);
  removeFails = true;
  assert.equal(
    (await platform(`stores/${second.id}/domains/${recovery.id}`, 'DELETE')).status,
    502,
  );
  const remaining = (await platform('domains')).body.find((r) => r.id === recovery.id);
  assert.equal(remaining.status, 'disconnecting');
  assert.equal((await client(recovery.hostname, '/')).status, 503);
  removeFails = false;
  assert.equal(
    (await platform(`stores/${second.id}/domains/${recovery.id}`, 'DELETE')).status,
    200,
  );
  assert.equal((await client(recovery.hostname, '/')).status, 404);
});
test('domains must be disconnected before deleting a demo and default links survive removal', async () => {
  const store = (await platform('stores', 'POST', { name: 'Domain demo' })).body;
  const add = await platform(`stores/${store.id}/domains`, 'POST', { hostname: 'demo-client.com' });
  assert.equal(
    (
      await platform(`stores/${store.id}/delete-demo`, 'POST', {
        version: 1,
        confirmSlug: store.slug,
      })
    ).status,
    409,
  );
  await platform(`stores/${store.id}/domains/${add.body[0].id}`, 'DELETE');
  assert.equal(
    (
      await platform(`stores/${store.id}/delete-demo`, 'POST', {
        version: 1,
        confirmSlug: store.slug,
      })
    ).status,
    200,
  );
  assert.equal((await platform(`stores/${shop.id}/domains/${domain.id}`, 'DELETE')).status, 200);
  assert.equal((await client(domain.hostname, '/')).status, 404);
  assert.equal((await req('/s/' + shop.slug)).status, 200);
  assert.equal((await admin(111, 'stores/' + shop.id)).body.customUrl, '');
});
