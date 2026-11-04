import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, admin, platform, req, db, checkout, orderFor } from './harness.js';
before(() => start());
after(stop);
const requestId = '11111111-2222-4333-8444-555555555555';
let manual;
test('manual demo works without collector, defaults to USD, is owned, marked as sample and idempotent', async () => {
  const input = {
    requestId,
    templateId: 'fashion',
    name: 'Magazin manual',
    description: 'Descriere proprie',
    language: 'ro',
    languages: ['ro', 'ru', 'en'],
  };
  const created = await admin(701, 'demo-jobs', 'POST', input);
  assert.equal(created.status, 201, JSON.stringify(created));
  manual = created.body.job;
  assert.equal(manual.status, 'ready');
  assert.equal(manual.sample_content, 1);
  assert.equal(manual.auto_build, 0);
  assert.equal(manual.instagram, '');
  assert.equal((await admin(701, 'demo-jobs', 'POST', input)).body.job.id, manual.id);
  const store = (await admin(701, 'stores/' + manual.store_id)).body;
  assert.equal(store.name, input.name);
  assert.equal(store.settings.description, input.description);
  assert.deepEqual(store.settings.currencies, ['USD']);
  assert.deepEqual(store.settings.languages, input.languages);
  assert.equal(store.acceptingOrders, false);
  assert.equal(store.demoJob.sample_content, 1);
  assert.equal((await admin(702, 'stores/' + manual.store_id)).status, 404);
  const publicData = (await req('/api/stores/' + manual.slug)).body;
  assert.ok(publicData.products.length > 0);
  assert.equal(publicData.products[0].name, 'Tricou cu croială lejeră');
  assert.ok(publicData.products.every((p) => Number.isSafeInteger(p.prices.USD)));
  const html = (await req('/s/' + manual.slug)).body;
  assert.match(html, /<html lang="ro">/);
  assert.match(html, /hreflang="ru"/);
  assert.match(html, /Coș/);
  assert.ok(
    await db.prepare('SELECT * FROM demo_retention WHERE job_id=?').bind(manual.id).first(),
  );
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) n FROM collector_tasks WHERE job_id=?')
        .bind(manual.id)
        .first()
    ).n,
    0,
  );
});
test('localized merchant copy and products are selected per enabled language, escape HTML and preserve stock IDs', async () => {
  const s = (await admin(701, 'stores/' + manual.store_id)).body;
  const save = await admin(701, 'stores/' + s.id + '/settings', 'PUT', {
    name: s.name,
    version: s.version,
    settings: {
      ...s.settings,
      translations: {
        ru: {
          name: 'Магазин',
          description: 'Описание <script>',
          heroTitle: 'Наши товары',
          deliveryMethods: ['Курьер', 'Самовывоз'],
        },
        en: { name: 'My shop', description: 'English description' },
      },
    },
  });
  assert.equal(save.status, 200, JSON.stringify(save));
  const p = (await admin(701, 'stores/' + s.id + '/products')).body[0];
  const changed = await admin(701, 'stores/' + s.id + '/products/' + p.id, 'PUT', {
    ...p,
    translations: {
      ru: {
        name: 'Переведённый товар',
        description: 'Русское описание',
        variantLabels: { [p.variants[0].id]: 'Русский вариант' },
        attributes: [{ label: 'Материал', value: 'Хлопок' }],
      },
      en: { name: 'Translated item' },
    },
  });
  assert.equal(changed.status, 200, JSON.stringify(changed));
  const russian = (await req('/api/stores/' + manual.slug + '?lang=ru')).body;
  assert.equal(russian.store.name, 'Магазин');
  assert.equal(russian.products[0].name, 'Переведённый товар');
  assert.equal(russian.products[0].variants[0].id, p.variants[0].id);
  assert.equal(russian.products[0].variants[0].label, 'Русский вариант');
  assert.equal(russian.products[0].attributes[0].value, 'Хлопок');
  assert.equal(
    (await req('/api/stores/' + manual.slug + '?lang=en')).body.products[0].name,
    'Translated item',
  );
  assert.equal(
    (await req('/api/stores/' + manual.slug + '?lang=de')).body.store.settings.language,
    'ro',
  );
  const html = (await req('/s/' + manual.slug + '?lang=ru')).body;
  assert.match(html, /<html lang="ru">/);
  assert.match(html, /Описание &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>Описание/);
  await db
    .prepare("UPDATE stores SET status='active',orders_enabled=1 WHERE id=?")
    .bind(s.id)
    .run();
  const order = orderFor(russian.products[0]);
  order.currency = 'USD';
  order.language = 'ru';
  order.customer.deliveryMethod = 'Курьер';
  order.items[0].expectedUnitMinor = p.prices.USD;
  const placed = await checkout(order, undefined, manual.slug);
  assert.equal(placed.status, 201, JSON.stringify(placed));
});
test('custom currencies have explicit sample prices and checkout accepts the chosen code', async () => {
  const created = await admin(703, 'demo-jobs', 'POST', {
    name: 'MDL shop',
    templateId: 'home',
    currency: 'mdl',
    language: 'ro',
  });
  assert.equal(created.status, 201, JSON.stringify(created));
  const j = created.body.job;
  const data = (await req('/api/stores/' + j.slug)).body;
  assert.deepEqual(data.store.settings.currencies, ['MDL']);
  assert.ok(Number.isSafeInteger(data.products[0].prices.MDL));
  await db
    .prepare("UPDATE stores SET status='active',orders_enabled=1 WHERE id=?")
    .bind(j.store_id)
    .run();
  const order = orderFor(data.products[0]);
  order.currency = 'MDL';
  order.customer.deliveryMethod = 'Livrare';
  order.items[0].expectedUnitMinor = data.products[0].prices.MDL;
  assert.equal((await checkout(order, undefined, j.slug)).status, 201);
  for (const currency of ['<x>', 'US', '$', 'MDLL'])
    assert.equal(
      (await admin(704, 'demo-jobs', 'POST', { name: 'Invalid', templateId: 'home', currency }))
        .status,
      400,
    );
  assert.equal(
    (
      await admin(704, 'demo-jobs', 'POST', {
        name: 'Invalid',
        templateId: 'home',
        language: 'ro',
        languages: ['xx'],
      })
    ).status,
    400,
  );
});
test('manual creation shares the three-demo quota and Romanian preference persists', async () => {
  for (let i = 0; i < 3; i++)
    assert.equal(
      (await admin(705, 'demo-jobs', 'POST', { name: 'Demo ' + i, templateId: 'minimal' })).status,
      201,
    );
  assert.equal(
    (await admin(705, 'demo-jobs', 'POST', { name: 'Fourth', templateId: 'minimal' })).status,
    429,
  );
  assert.equal((await admin(701, 'preferences', 'PUT', { language: 'ro' })).status, 200);
  assert.equal((await admin(701, 'preferences')).body.language, 'ro');
});

test('copying a multilingual catalog remaps translated variants to independent IDs', async () => {
  const copied = await platform('stores/' + manual.store_id + '/copy', 'POST', {
    name: 'Copy',
    slug: 'localized-copy',
  });
  assert.equal(copied.status, 202, JSON.stringify(copied));
  await platform('copies/' + copied.body.id + '/continue', 'POST', {});
  const result = await req('/api/stores/localized-copy?lang=ru');
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.body.products[0].variants[0].label, 'Русский вариант');
  const original = (await req('/api/stores/' + manual.slug + '?lang=ru')).body;
  assert.notEqual(result.body.products[0].variants[0].id, original.products[0].variants[0].id);
});
