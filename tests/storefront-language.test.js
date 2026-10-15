import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, req, platform, db, checkout, orderFor } from './harness.js';
before(start);
after(stop);

test('English templates have complete English copy and seed English sample products', async () => {
  for (const templateId of ['minimal', 'fashion', 'home', 'beauty']) {
    const preview = (await req('/api/templates/' + templateId + '?lang=en')).body;
    assert.equal(preview.store.settings.language, 'en');
    assert.equal(preview.store.settings.texts.btn_cart, 'Cart');
    assert.deepEqual(preview.store.settings.deliveryMethods, ['Delivery', 'Pickup']);
    assert.doesNotMatch(JSON.stringify(preview), /[А-Яа-яЁё]/);
    assert.match((await req('/templates/' + templateId + '?lang=en')).body, /<html lang="en">/);
    const created = await platform('stores', 'POST', {
      name: 'English ' + templateId,
      templateId,
      seedProducts: true,
      settings: { language: 'en', currencies: ['USD'] },
    });
    assert.equal(created.status, 201, JSON.stringify(created));
    const data = (await req('/api/stores/' + created.body.slug)).body;
    assert.doesNotMatch(JSON.stringify(data.store.settings), /[А-Яа-яЁё]/);
    assert.doesNotMatch(JSON.stringify(data.products), /[А-Яа-яЁё]/);
    assert.match((await req('/s/' + created.body.slug)).body, /<html lang="en">/);
    await db
      .prepare("UPDATE stores SET status='active',owner_id='111' WHERE id=?")
      .bind(created.body.id)
      .run();
    const input = orderFor(data.products[0]);
    input.currency = 'USD';
    input.expectedUnitMinor = undefined;
    input.items[0].expectedUnitMinor = data.products[0].prices.USD;
    input.customer.deliveryMethod = 'Delivery';
    assert.equal((await checkout(input, undefined, created.body.slug)).status, 201);
  }
});

test('language switching translates untouched defaults and preserves custom copy and catalog data', async () => {
  const created = (
    await platform('stores', 'POST', {
      name: 'Language switch',
      templateId: 'fashion',
      seedProducts: true,
    })
  ).body;
  let data = (await req('/api/stores/' + created.slug)).body;
  const products = data.products;
  const save = async (cfg) => {
    const result = await platform('stores/' + created.id + '/settings', 'PUT', {
      name: data.store.name,
      version: data.store.version,
      settings: cfg,
    });
    assert.equal(result.status, 200, JSON.stringify(result));
    data = (await req('/api/stores/' + created.slug)).body;
  };
  await save({
    ...data.store.settings,
    language: 'en',
    heroTitle: 'Наш авторский заголовок',
    texts: { ...data.store.settings.texts, btn_cart: 'Моя корзина' },
  });
  assert.equal(data.store.settings.language, 'en');
  assert.equal(data.store.settings.heroTitle, 'Наш авторский заголовок');
  assert.equal(data.store.settings.texts.btn_cart, 'Моя корзина');
  assert.equal(data.store.settings.texts.btn_add, 'Add to cart');
  assert.deepEqual(data.store.settings.deliveryMethods, ['Delivery', 'Pickup']);
  assert.deepEqual(data.products, products);
  await save({ ...data.store.settings, language: 'ru' });
  assert.equal(data.store.settings.texts.btn_add, 'В корзину');
  assert.equal(data.store.settings.texts.btn_cart, 'Моя корзина');
  assert.deepEqual(data.store.settings.deliveryMethods, ['Доставка', 'Самовывоз']);
  assert.deepEqual(data.products, products);
  assert.equal(
    (await platform('stores', 'POST', { name: 'Bad lang', settings: { language: 'xx' } })).status,
    400,
  );
  await db
    .prepare("UPDATE stores SET settings=json_remove(settings,'$.language') WHERE id=?")
    .bind(created.id)
    .run();
  assert.equal((await req('/api/stores/' + created.slug)).body.store.settings.language, 'ru');
});

test('template photo URLs persist and seed stores; non-HTTPS and credential URLs are rejected', async () => {
  const initial = (await platform('templates/home')).body;
  const url = 'https://images.example.com/sample.jpg?width=1200';
  const path = 'templates/home';
  assert.equal(
    (await platform(path, 'PUT', { version: initial.version, photos: { 0: url } })).status,
    200,
  );
  for (const bad of [
    'http://example.com/a.jpg',
    'javascript:alert(1)',
    'https://user:pass@example.com/a.jpg',
  ])
    assert.equal(
      (await platform(path, 'PUT', { version: initial.version + 1, photos: { 0: bad } })).status,
      400,
    );
  assert.equal((await req('/api/templates/home')).body.products[0].photos[0], url);
  const created = (
    await platform('stores', 'POST', {
      name: 'Linked photo',
      templateId: 'home',
      seedProducts: true,
    })
  ).body;
  assert.ok(
    (await req('/api/stores/' + created.slug)).body.products.some((p) => p.photos[0] === url),
  );
});

test('all supported storefront languages persist and translate catalog controls', async () => {
  const expected = {
    es: 'Carrito',
    pt: 'Carrinho',
    fr: 'Panier',
    it: 'Carrello',
    tr: 'Sepet',
    pl: 'Koszyk',
    ja: 'カート',
    de: 'Warenkorb',
  };
  for (const [language, cart] of Object.entries(expected)) {
    const result = await platform('stores', 'POST', {
      name: 'Localized ' + language,
      templateId: 'minimal',
      settings: { language },
    });
    assert.equal(result.status, 201, JSON.stringify(result));
    const data = (await req('/api/stores/' + result.body.slug)).body;
    assert.equal(data.store.settings.language, language);
    assert.equal(data.store.settings.texts.btn_cart, cart);
    const html = (await req('/s/' + result.body.slug)).body;
    assert.match(html, new RegExp('<html lang="' + language + '">'));
    assert.ok(html.includes(cart));
  }
  const config = (await platform('config')).body;
  assert.equal(config.features.supportedLanguages.length, 10);
});
