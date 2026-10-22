import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, req, platform, db } from './harness.js';
before(start);
after(stop);

test('public previews are read-only, use bundled images and do not create stores', async () => {
  const count = (await db.prepare('SELECT COUNT(*) n FROM stores').first()).n;
  const list = await req('/api/templates');
  assert.deepEqual(
    list.body.map((t) => t.id),
    ['minimal', 'fashion', 'home', 'beauty'],
  );
  for (const id of ['fashion', 'home', 'beauty']) {
    const preview = await req('/api/templates/' + id);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.store.settings.theme, id);
    assert.equal(preview.body.store.acceptingOrders, false);
    assert.equal(preview.body.products.length, 6);
    assert.equal((await req('/templates/' + id)).status, 200);
    assert.equal((await req(preview.body.products[0].photos[0])).status, 200);
    assert.equal((await req('/api/templates/' + id, 'POST', {})).status, 404);
    assert.equal((await req('/api/templates/' + id + '/orders', 'POST', {})).status, 404);
  }
  assert.equal((await req('/api/templates/missing')).status, 404);
  assert.equal((await req('/templates/missing')).status, 404);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM stores').first()).n, count);
});

test('template creation seeds only when requested, respects selected currencies and independent IDs', async () => {
  for (const templateId of ['fashion', 'home', 'beauty']) {
    const input = {
      name: templateId,
      slug: 'seed-' + templateId,
      templateId,
      seedProducts: true,
      settings: { currencies: ['USD', 'EUR'] },
    };
    const created = await platform('stores', 'POST', input);
    assert.equal(created.status, 201, JSON.stringify(created));
    const data = (await req('/api/stores/' + created.body.slug)).body;
    assert.equal(data.store.settings.theme, templateId);
    assert.equal(data.store.status, 'demo');
    assert.equal(data.products.length, 6);
    for (const p of data.products) {
      assert.deepEqual(Object.keys(p.prices), ['USD', 'EUR']);
      assert.ok(p.prices.USD > 0);
      assert.equal(p.attributes.length, 1);
      assert.ok(p.brand && p.sku);
    }
    const again = await platform('stores', 'POST', { ...input, slug: input.slug + '-two' });
    const other = (await req('/api/stores/' + again.body.slug)).body;
    assert.notEqual(data.products[0].id, other.products[0].id);
    assert.notEqual(data.products[0].variants[0].id, other.products[0].variants[0].id);
    assert.equal(
      (await req('/api/stores/' + created.body.slug + '/orders', 'POST', {})).status,
      409,
    );
    const exported = await platform('stores/' + created.body.id + '/export');
    assert.equal(exported.body.settings.theme, templateId);
  }
  const empty = await platform('stores', 'POST', { name: 'Empty', templateId: 'beauty' });
  assert.equal((await req('/api/stores/' + empty.body.slug)).body.products.length, 0);
  assert.equal(
    (await platform('stores', 'POST', { name: 'Bad', templateId: 'missing' })).status,
    400,
  );
  assert.equal((await platform('stores', 'POST', { name: 'Bad', seedProducts: true })).status, 400);
  assert.equal(
    (await platform('stores', 'POST', { name: 'Bad', templateId: 'home', seedProducts: 'yes' }))
      .status,
    400,
  );
});

test('switching theme preserves products, copy preserves styling and legacy fields stay editable', async () => {
  const created = await platform('stores', 'POST', {
    name: 'Legacy',
    products: [
      { name: 'Old item', prices: { BYN: 1000 }, team: 'Brand', year: '2025', number: '42' },
    ],
  });
  const base = 'stores/' + created.body.id;
  const initial = (await req('/api/stores/' + created.body.slug)).body;
  assert.equal(initial.store.settings.theme, 'minimal');
  assert.equal(initial.products[0].brand, 'Brand');
  assert.equal(initial.products[0].collection, '2025');
  assert.equal(initial.products[0].sku, '42');
  assert.equal(
    (
      await platform(base + '/settings', 'PUT', {
        name: 'Legacy',
        version: 1,
        settings: { ...initial.store.settings, theme: 'beauty' },
      })
    ).status,
    200,
  );
  const changed = (await req('/api/stores/' + created.body.slug)).body;
  assert.deepEqual(changed.products, initial.products);
  assert.equal(changed.store.settings.theme, 'beauty');
  const copy = await platform(base + '/copy', 'POST', { name: 'Copy', slug: 'template-copy' });
  assert.equal(copy.status, 202);
  await platform('copies/' + copy.body.id + '/continue', 'POST', {});
  assert.equal((await req('/api/stores/template-copy')).body.store.settings.theme, 'beauty');
  assert.equal(
    (
      await platform(base + '/settings', 'PUT', {
        name: 'Legacy',
        version: 2,
        settings: { ...changed.store.settings, theme: 'bad' },
      })
    ).status,
    400,
  );
  for (const attributes of [
    Array.from({ length: 13 }, (_, i) => ({ label: 'L' + i, value: 'V' })),
    [
      { label: 'L', value: 'V' },
      { label: 'L', value: 'X' },
    ],
    [{ label: '', value: 'V' }],
  ]) {
    assert.equal(
      (
        await platform(base + '/products', 'POST', {
          name: 'Invalid',
          prices: { BYN: 1000 },
          attributes,
        })
      ).status,
      400,
    );
  }
});

test('fashion copy is server rendered, editable and escaped; previews stay out of search', async () => {
  const preview = await req('/templates/fashion?lang=en');
  assert.equal(preview.status, 200);
  assert.match(preview.body, /Everyday clothing and accessories/);
  assert.match(preview.body, /How do I choose a size/);
  assert.match(preview.body, /name="robots" content="noindex, follow"/);
  const created = await platform('stores', 'POST', {
    name: 'Fashion content',
    templateId: 'fashion',
    seedProducts: true,
  });
  const data = (await req('/api/stores/' + created.body.slug)).body;
  const saved = await platform('stores/' + created.body.id + '/settings', 'PUT', {
    name: 'Fashion content',
    version: 1,
    settings: {
      ...data.store.settings,
      texts: {
        ...data.store.settings.texts,
        about_title: '<script>alert(1)</script>',
        about_body: 'Merchant copy & details',
      },
    },
  });
  assert.equal(saved.status, 200);
  const page = await req('/s/' + created.body.slug);
  assert.match(page.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(page.body, /Merchant copy &amp; details/);
  assert.match(page.body, /name="description"/);
  assert.doesNotMatch(page.body, /<script>alert\(1\)<\/script>/);
});
