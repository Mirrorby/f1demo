import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { start, stop, mf, db, shop, demo, initData, req } from './harness.js';
let browser, server;
try {
  await start();
  server = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const r = await mf.dispatchFetch('http://localhost' + request.url, {
        method: request.method,
        headers: request.headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.concat(chunks),
        redirect: 'manual',
      });
      response.writeHead(r.status, Object.fromEntries(r.headers));
      response.end(Buffer.from(await r.arrayBuffer()));
    } catch {
      response.writeHead(500);
      response.end('Test server error');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--disable-gpu',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://telegram.org/js/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.Telegram={WebApp:{initData:${JSON.stringify(initData(111))},ready(){},expand(){},showConfirm(message,callback){callback(true)}}};`,
    }),
  );
  await page.goto(origin + '/admin?store=' + shop.id);
  await page.getByRole('heading', { name: 'Всё под рукой' }).waitFor();
  await page.getByRole('button', { name: 'Добавить товар', exact: true }).click();
  await page.locator('#name').fill('Новая кепка');
  await page.locator('#category').fill('Аксессуары');
  await page.locator('#price-BYN').fill('15.50');
  await page.locator('#price-RUB').fill('450');
  await page.getByRole('button', { name: 'Сохранить товар', exact: true }).click();
  await page.getByRole('heading', { name: 'Новая кепка' }).waitFor();
  const data = (await req('/api/stores/' + shop.slug)).body;
  assert.ok(data.products.some((p) => p.name === 'Новая кепка' && p.prices.BYN === 1550));
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.locator('#store-title').fill('Тестовый магазин');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await page.locator('#store-name').filter({ hasText: 'Тестовый магазин' }).waitFor();
  await page.goto(origin + '/shop/' + shop.slug);
  await page.locator('#hero-title').filter({ hasText: 'Тестовый магазин' }).waitFor();
  assert.ok(await page.locator('.card-name').filter({ hasText: 'Новая кепка' }).count());
  await page.locator('.card').filter({ hasText: 'Новая кепка' }).click();
  await page.getByRole('button', { name: 'В корзину', exact: true }).click();
  await page.locator('.cart-btn').click();
  await page.locator('#delivery-name').fill('Покупатель');
  await page.locator('#delivery-phone').fill('+375291234567');
  await page.locator('#delivery-address').fill('Минск, тестовый адрес');
  await page.getByRole('button', { name: 'Сохранить данные доставки' }).click();
  // Failed network response must preserve the cart and never show confirmation.
  await page.route('**/api/stores/*/orders', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"Тестовая ошибка сохранения"}',
    }),
  );
  await page.getByRole('button', { name: 'Оформить заказ', exact: true }).click();
  await page.locator('#toast').filter({ hasText: 'Тестовая ошибка сохранения' }).waitFor();
  assert.equal(
    await page.locator('#confirm-ov').evaluate((el) => el.classList.contains('open')),
    false,
  );
  assert.equal(await page.locator('#cart-count').textContent(), '1');
  await page.unroute('**/api/stores/*/orders');
  await page.getByRole('button', { name: 'Оформить заказ', exact: true }).click();
  await page.locator('#confirm-ov.open').waitFor();
  assert.match(await page.locator('#confirm-order-num').textContent(), /^#\d+$/);
  assert.equal(
    (await db.prepare('SELECT COUNT(*) n FROM orders WHERE store_id=?').bind(shop.id).first()).n,
    1,
  );
  const shotDir = process.env.BROWSER_SCREENSHOT_DIR;
  if (shotDir) {
    await mkdir(shotDir, { recursive: true });
    await page.screenshot({ path: shotDir + '/checkout-mobile.png' });
  }
  await page.goto(origin + '/demo/' + demo.slug);
  await page.locator('#demo-banner').waitFor();
  assert.equal(await page.locator('#hero-wa').isVisible(), false);
  // Tenant content must be text, including HTML-like product names and categories.
  const p = (await req('/api/stores/' + shop.slug)).body.products[0];
  await db
    .prepare("UPDATE products SET data=json_set(data,'$.name',?,'$.category',?) WHERE id=?")
    .bind(
      '<img src=x onerror="window.injected=1">',
      "Bags ' <script>window.injected=1</script>",
      p.id,
    )
    .run();
  await page.goto(origin + '/shop/' + shop.slug);
  await page.locator('.card-name').filter({ hasText: '<img src=x' }).waitFor();
  assert.equal(await page.evaluate(() => window.injected), undefined);
  for (const width of [375, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (shotDir) await page.screenshot({ path: shotDir + `/storefront-${width}.png` });
  }
  await page.goto(origin + '/admin?store=' + shop.id);
  await page.getByRole('heading', { name: 'Всё под рукой' }).waitFor();
  await page.getByRole('button', { name: 'Заказы', exact: true }).click();
  await page.locator('[data-order]').first().click();
  await page.getByRole('button', { name: 'Принять', exact: true }).click();
  await page.getByText('В обработке', { exact: true }).waitFor();
  if (shotDir) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: shotDir + '/admin-order-mobile.png' });
  }
  assert.deepEqual(errors, []);
  console.log(
    'Browser smoke passed: admin CRUD/settings → public catalog → failed and successful checkout → D1 → order status; demo, XSS and 375/390/1280 layouts.',
  );
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await stop();
}
