import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
export let mf, db, shop, demo, second, catalog, secondCatalog;
let telegramFails = false;
export function failTelegram(value) {
  telegramFails = value;
}
export const PLATFORM = 'local-test-platform-key-with-more-than-32-characters';
export const BOT = '123456:local-test-bot-token',
  WEBHOOK = 'local-test-webhook-secret',
  notifications = [];
export function initData(id, date = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({
    auth_date: String(date),
    query_id: 'test',
    user: JSON.stringify({ id, first_name: 'Test' }),
  });
  const check = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => k + '=' + v)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}
export async function req(path, method = 'GET', data, headers = {}) {
  const r = await mf.dispatchFetch('http://localhost' + path, {
    method,
    redirect: 'manual',
    headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const raw = await r.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  return { status: r.status, body, headers: r.headers };
}
export const platform = (path, method, data) =>
  req('/api/platform/' + path, method, data, { Authorization: 'Bearer ' + PLATFORM });
export const admin = (id, path, method = 'GET', data) =>
  req('/api/admin/' + path, method, data, { Authorization: 'tma ' + initData(id) });
export function orderFor(p = catalog.products.find((p) => p.name === 'Bag'), quantity = 1) {
  return {
    currency: 'BYN',
    customer: {
      name: 'Buyer',
      phone: '+375291234567',
      address: 'Test address',
      deliveryMethod: 'Доставка',
    },
    items: [
      {
        productId: p.id,
        variantId: p.variants[0].id,
        quantity,
        expectedUnitMinor: Math.round((p.prices.BYN * (100 - p.discountPercent)) / 100),
      },
    ],
  };
}
export const checkout = (data, key = crypto.randomUUID(), slug = shop.slug) =>
  req(`/api/stores/${slug}/orders`, 'POST', data, { 'Idempotency-Key': key });
export async function start() {
  const result = await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'engine',
      modules: true,
      script: result.outputFiles[0].text,
      compatibilityDate: '2026-10-06',
      compatibilityFlags: ['nodejs_compat'],
      cronTriggers: ['*/10 * * * *'],
      d1Databases: { DB: 'engine' },
      r2Buckets: ['IMAGES'],
      bindings: {
        PLATFORM_API_KEY: PLATFORM,
        TELEGRAM_BOT_TOKEN: BOT,
        TELEGRAM_WEBHOOK_SECRET: WEBHOOK,
        BOT_USERNAME: 'catalog_test_bot',
        PUBLIC_ORIGIN: 'https://store.example',
      },
      outboundService: async (request) => {
        notifications.push({ path: new URL(request.url).pathname, payload: await request.json() });
        return new Response(JSON.stringify({ ok: !telegramFails, result: { message_id: 1 } }), {
          status: telegramFails ? 503 : 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
      assets: {
        directory: 'public',
        binding: 'ASSETS',
        run_worker_first: true,
        routerConfig: { has_user_worker: true },
      },
    }),
  );
  db = await mf.getD1Database('DB');
  const sql = await readFile('migrations/0001_engine.sql', 'utf8');
  const clean = sql.replace(/^\s*--[^\n]*\n/gm, '');
  const statements = clean.match(
    /CREATE TRIGGER[\s\S]*?\nEND;|(?:PRAGMA|CREATE TABLE|CREATE INDEX|ALTER TABLE)[^;]+;/g,
  );
  for (const statement of statements) await db.prepare(statement.trim()).run();
  const fixture = {
    name: 'Store A',
    slug: 'store-a',
    settings: { currencies: ['BYN', 'RUB'], deliveryMethods: ['Доставка', 'Самовывоз'] },
    products: [
      {
        name: 'Bag',
        category: 'Bags',
        prices: { BYN: 10000, RUB: 300000 },
        discountPercent: 10,
        variants: [{ label: 'Standard', stock: 5 }],
      },
      { name: 'No-size item', prices: { BYN: 1000, RUB: 30000 } },
    ],
  };
  const created = await platform('stores', 'POST', fixture);
  assert.equal(created.status, 201, JSON.stringify(created));
  shop = created.body;
  demo = (await platform('stores', 'POST', { ...fixture, slug: 'demo' })).body;
  second = (await platform('stores', 'POST', { ...fixture, slug: 'second-store' })).body;
  await db
    .prepare("UPDATE stores SET owner_id='111',status='active' WHERE id=?")
    .bind(shop.id)
    .run();
  await db
    .prepare("UPDATE stores SET owner_id='222',status='active' WHERE id=?")
    .bind(second.id)
    .run();
  catalog = (await req('/api/stores/' + shop.slug)).body;
  secondCatalog = (await req('/api/stores/' + second.slug)).body;
}
export async function stop() {
  if (mf) await mf.dispose();
}
