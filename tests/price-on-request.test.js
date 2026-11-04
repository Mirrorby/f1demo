import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, req, platform, db, checkout, orderFor } from './harness.js';
before(start);
after(stop);

test('imported products retain price-on-request through export/copy and cannot be ordered at zero', async () => {
  const created = await platform('stores', 'POST', {
    name: 'Instagram demo',
    slug: 'ig-demo',
    settings: { language: 'en', currencies: ['USD'], instagram: 'shop' },
    products: [
      {
        name: 'Photo product',
        description: 'Original caption',
        sku: 'IG-POST',
        prices: { USD: 0 },
        priceOnRequest: true,
      },
    ],
  });
  assert.equal(created.status, 201);
  let data = (await req('/api/stores/ig-demo')).body;
  assert.equal(data.products[0].priceOnRequest, true);
  assert.equal(
    (await platform(`stores/${created.body.id}/export`)).body.products[0].priceOnRequest,
    true,
  );
  await db
    .prepare("UPDATE stores SET status='active',owner_id='111' WHERE id=?")
    .bind(created.body.id)
    .run();
  const order = orderFor(data.products[0]);
  order.currency = 'USD';
  order.customer.deliveryMethod = 'Delivery';
  order.items[0].expectedUnitMinor = 0;
  assert.equal((await checkout(order, undefined, 'ig-demo')).status, 409);
  const p = data.products[0];
  const updated = await platform(`stores/${created.body.id}/products/${p.id}`, 'PUT', {
    ...p,
    priceOnRequest: false,
    prices: { USD: 2500 },
  });
  assert.equal(updated.status, 200, JSON.stringify(updated));
  data = (await req('/api/stores/ig-demo')).body;
  const priced = orderFor(data.products[0]);
  priced.currency = 'USD';
  priced.customer.deliveryMethod = 'Delivery';
  priced.items[0].expectedUnitMinor = 2500;
  assert.equal((await checkout(priced, undefined, 'ig-demo')).status, 201);
});

test('price mode requires a boolean', async () => {
  const result = await platform('stores', 'POST', {
    name: 'Bad price',
    products: [{ name: 'Product', prices: { BYN: 0 }, priceOnRequest: 'true' }],
  });
  assert.equal(result.status, 400);
});
