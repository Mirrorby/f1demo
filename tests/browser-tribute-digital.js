import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { start, stop, mf, req, PLATFORM, TRIBUTE, mockProduct, initData, shop } from './harness.js';
let browser, server;
try {
  mockProduct({ type: 'custom', status: 'new' });
  await start({ TRIBUTE_SHOP_ID: '', TRIBUTE_PRODUCT_URL: 'https://web.tribute.tg/p/H0x' });
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
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  let legacyScripts = 0;
  const staleAsset = (route) => {
    legacyScripts++;
    return route.fulfill({
      contentType: 'application/javascript',
      body: 'window.__legacyAsset=true;',
    });
  };
  await page.route(/\/(admin|platform)\.js(?:\?|$)/, staleAsset);
  await page.goto('http://127.0.0.1:' + server.address().port + '/platform');
  await page.locator('#platform-key').fill(PLATFORM);
  await page.getByRole('button', { name: 'Подключиться', exact: true }).click();
  const link = page.getByRole('link', { name: 'Открыть товар Tribute ↗', exact: true });
  await link.waitFor();
  assert.equal(await link.getAttribute('href'), 'https://t.me/tribute/app?startapp=pH0x');
  await page.getByText('Товар на заказ: выполните заказ', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Создать счёт', exact: true }).count(), 0);
  const event = {
    name: 'new_digital_product',
    created_at: '2026-10-14T10:00:00Z',
    sent_at: '2026-10-14T10:00:01Z',
    payload: {
      product_id: 456,
      purchase_id: 12345,
      telegram_user_id: 333,
      product_name: 'Online store setup',
      amount: 10000,
      currency: 'eur',
    },
  };
  const paid = await req('/api/tribute/webhook', 'POST', event, {
    'trbt-signature': createHmac('sha256', TRIBUTE).update(JSON.stringify(event)).digest('hex'),
  });
  assert.equal(paid.status, 200);
  await page.getByRole('button', { name: 'Обновить список', exact: true }).click();
  await page
    .getByText('Online store setup · 100.00 EUR · Telegram ID: 333 · Оплачено', { exact: true })
    .waitFor();
  const mini = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mini.route(/\/(admin|platform)\.js(?:\?|$)/, staleAsset);
  const errors = [];
  mini.on('pageerror', (e) => errors.push(e.message));
  let owner = 333;
  await mini.route('https://telegram.org/js/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.Telegram={WebApp:{initData:${JSON.stringify(initData(owner))},ready(){},expand(){},openTelegramLink(url){window.__paymentLink=url}}};`,
    }),
  );
  const origin = 'http://127.0.0.1:' + server.address().port;
  await mini.goto(origin + '/admin');
  await mini.getByRole('heading', { name: 'Начнём с вашего магазина', exact: true }).waitFor();
  assert.equal(await mini.getByRole('button', { name: 'Товары', exact: true }).isDisabled(), true);
  await mini.getByRole('button', { name: 'Ещё', exact: true }).click();
  await mini.getByRole('button', { name: 'Оплата', exact: true }).click();
  await mini.getByRole('heading', { name: 'Мои покупки и счета', exact: true }).waitFor();
  await mini.getByText('Покупка подтверждена', { exact: true }).waitFor();
  await mini.getByRole('button', { name: 'Заказать через Tribute', exact: true }).click();
  assert.equal(
    await mini.evaluate(() => window.__paymentLink),
    'https://t.me/tribute/app?startapp=pH0x',
  );
  assert.ok(await mini.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  owner = 111;
  await mini.goto(origin + '/admin?store=' + shop.id);
  await mini.getByText('Всё под рукой', { exact: true }).waitFor();
  await mini.getByRole('button', { name: 'Ещё', exact: true }).click();
  await mini.getByRole('button', { name: 'Оплата', exact: true }).click();
  await mini.getByText('Покупок и счетов пока нет.', { exact: true }).waitFor();
  owner = 777;
  await mini.goto(origin + '/admin?tab=payments');
  await mini.getByRole('button', { name: 'Заказать через Tribute', exact: true }).waitFor();
  assert.equal(await mini.locator('#store-name').innerText(), 'Мой кабинет');
  assert.equal(await mini.getByText('Покупка подтверждена', { exact: true }).count(), 0);
  let releaseStores;
  const pendingStores = new Promise((resolve) => {
    releaseStores = resolve;
  });
  await mini.route('**/api/admin/stores', async (route) => {
    await pendingStores;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Stores temporarily unavailable' }),
    });
  });
  await mini.goto(origin + '/admin');
  await mini.getByRole('button', { name: 'Ещё', exact: true }).click();
  await mini.getByRole('button', { name: 'Оплата', exact: true }).click();
  await mini.getByRole('button', { name: 'Заказать через Tribute', exact: true }).waitFor();
  const paymentReload = mini.waitForResponse((response) =>
    response.url().endsWith('/api/admin/payments/config'),
  );
  releaseStores();
  await paymentReload;
  await mini.getByRole('button', { name: 'Заказать через Tribute', exact: true }).waitFor();
  assert.equal(await mini.getByText('Не удалось подключиться.', { exact: false }).count(), 0);
  assert.equal(legacyScripts, 0);
  assert.deepEqual(errors, []);
  console.log(
    'Digital product browser check passed: exact H0x link, no Shop form, signed receipt visible in dashboard.',
  );
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await stop();
}
