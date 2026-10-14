import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { start, stop, mf, req, PLATFORM, TRIBUTE } from './harness.js';
let browser, server;
try {
  await start({ TRIBUTE_SHOP_ID: '', TRIBUTE_PRODUCT_URL: 'https://web.tribute.tg/p/H0e' });
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
  await page.goto('http://127.0.0.1:' + server.address().port + '/platform');
  await page.locator('#platform-key').fill(PLATFORM);
  await page.getByRole('button', { name: 'Подключиться', exact: true }).click();
  const link = page.getByRole('link', { name: 'Открыть товар Tribute ↗', exact: true });
  await link.waitFor();
  assert.equal(await link.getAttribute('href'), 'https://web.tribute.tg/p/H0e');
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
  console.log(
    'Digital product browser check passed: exact H0e link, no Shop form, signed receipt visible in dashboard.',
  );
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await stop();
}
