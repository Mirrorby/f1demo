import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { start, stop, mf, initData, db } from './harness.js';
let browser, server;
try {
  await start();
  server = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const c of request) chunks.push(c);
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
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://telegram.org/js/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.Telegram={WebApp:{initData:${JSON.stringify(initData(950))},initDataUnsafe:{user:{language_code:'ru'}},ready(){},expand(){},onEvent(){}}};`,
    }),
  );
  await page.goto('http://127.0.0.1:' + server.address().port + '/admin?lang=ru');
  await page.getByRole('button', { name: 'Создать магазин', exact: true }).click();
  for (const width of [320, 360, 390, 520]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `Create form overflows at ${width}px`,
    );
    const currency = await page.locator('#demo-currency').boundingBox();
    const submit = await page.locator('#demo-form button[type="submit"]').boundingBox();
    assert.ok(
      submit.y >= currency.y + currency.height + 12,
      `Submit button touches currency field at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#demo-instagram').fill('@browser_shop');
  await page.locator('input[name="demo-template"][value="fashion"]').check();
  await page.locator('#demo-reference').fill('https://example.com/design');
  await page.getByRole('button', { name: 'Создать тестовое демо', exact: true }).click();
  await page.getByRole('heading', { name: 'Всё под рукой' }).waitFor();
  assert.match(await page.locator('#notice').innerText(), /Тестовое демо/);
  await page.locator('#nav [data-tab="products"]').click();
  await page.getByText('Футболка свободного кроя', { exact: true }).waitFor();
  await page.locator('#nav [data-tab="home"]').click();
  await page.getByRole('button', { name: 'Создать ещё магазин' }).click();
  await page.getByText('@browser_shop', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await page.getByRole('heading', { name: 'Всё под рукой' }).waitFor();
  const row = await db
    .prepare(
      'SELECT owner_id,orders_enabled FROM stores WHERE id=(SELECT store_id FROM demo_build_jobs WHERE owner_id=?)',
    )
    .bind('950')
    .first();
  assert.equal(row.owner_id, '950');
  assert.equal(row.orders_enabled, 0);
  assert.deepEqual(errors, []);
  console.log(
    'Browser onboarding passed: mobile form, sample demo, editor, saved jobs, no overflow.',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  await stop();
}
