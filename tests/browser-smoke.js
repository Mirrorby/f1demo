import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { start, stop, mf, db, shop, demo, initData, req, PLATFORM } from './harness.js';
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
  // Reproduce WebKit's canvas fallback: requested WebP becomes an actual PNG Blob.
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      return toBlob.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality);
    };
  });
  const imageFile = {
    name: 'catalog.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGN8yMbAwMDAxMDAwMDAAAAL3wDrtkO4LAAAAABJRU5ErkJggg==',
      'base64',
    ),
  };
  await page.route('https://telegram.org/js/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.Telegram={WebApp:{initData:${JSON.stringify(initData(111))},ready(){},expand(){},showConfirm(message,callback){callback(true)}}};`,
    }),
  );
  const shotDir = process.env.BROWSER_SCREENSHOT_DIR;
  if (shotDir) await mkdir(shotDir, { recursive: true });
  for (const theme of ['fashion', 'home', 'beauty']) {
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + '/templates/' + theme);
      await page.locator('.card-name').first().waitFor();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('.card-img img')].every(
          (img) => img.complete && img.naturalWidth > 0,
        ),
      );
      assert.equal(await page.locator('.card').count(), 6);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (shotDir)
        await page.screenshot({
          path: shotDir + `/template-${theme}-${width}.png`,
          fullPage: true,
        });
      await page.locator('.card').first().click();
      await page.locator('#pm-attrs').filter({ hasText: 'Артикул' }).waitFor();
      assert.ok((await page.locator('#pm-attrs .pm-attr').count()) >= 3);
      assert.equal(
        await page.locator('#pm-name').evaluate((el) => getComputedStyle(el).color),
        await page.evaluate(() => getComputedStyle(document.body).color),
      );
      await page.locator('.size-btn').first().click();
      await page.getByRole('button', { name: 'В корзину', exact: true }).click();
      await page.locator('.cart-btn').click();
      assert.equal(
        await page
          .getByRole('button', { name: 'Заказы отключены в демо', exact: true })
          .isDisabled(),
        true,
      );
      if (shotDir && width === 390)
        await page.screenshot({ path: shotDir + `/template-${theme}-cart.png` });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/platform');
  await page.locator('#platform-key').fill(PLATFORM);
  await page.getByRole('button', { name: 'Подключиться', exact: true }).click();
  await page.getByRole('button', { name: 'Настроить Telegram-бота' }).waitFor();
  await page.getByRole('button', { name: 'Настроить Telegram-бота' }).click();
  await page.locator('#notice').filter({ hasText: 'Бот настроен' }).waitFor();
  await page.locator('#new-template').selectOption('fashion');
  assert.equal(await page.locator('#seed-products').isChecked(), true);
  assert.equal(await page.locator('#template-preview').getAttribute('href'), '/templates/fashion');
  await page.locator('#new-name').fill('Browser template');
  await page.locator('#new-slug').fill('browser-template');
  await page.locator('#new-currency').selectOption('EUR');
  await page.getByRole('button', { name: 'Создать демо', exact: true }).click();
  await page.getByRole('heading', { name: 'Browser template', exact: true }).waitFor();
  const seeded = (await req('/api/stores/browser-template')).body;
  assert.equal(seeded.store.settings.theme, 'fashion');
  assert.equal(seeded.products.length, 6);
  assert.ok(seeded.products.every((p) => p.prices.EUR > 0));
  await page.locator('#new-name').fill('Browser factory');
  await page.locator('#new-slug').fill('browser-factory');
  await page.getByRole('button', { name: 'Создать демо', exact: true }).click();
  await page.getByRole('heading', { name: 'Browser factory', exact: true }).waitFor();
  const factory = page.locator('section').filter({ hasText: 'Browser factory' });
  await factory.getByRole('button', { name: 'Редактировать магазин', exact: true }).click();
  const editor = page.frameLocator('#store-editor');
  await editor.getByRole('heading', { name: 'Всё под рукой' }).waitFor();
  await editor.getByRole('button', { name: 'Добавить товар', exact: true }).click();
  await editor.locator('#name').fill('Товар оператора');
  await editor.locator('#category').fill('Демо');
  await editor.locator('#price-BYN').fill('25');
  await editor
    .locator('summary')
    .filter({ hasText: 'Дополнительные валюты и характеристики' })
    .click();
  await editor.locator('#brand').fill('Studio');
  await editor.locator('#sku').fill('ST-001');
  await editor.locator('#attributes').fill('Материал: хлопок\nУход: стирка при 30°C');
  await editor.locator('#photo-upload').setInputFiles(imageFile);
  await editor.locator('#notice').filter({ hasText: 'Фотографии загружены' }).waitFor();
  await editor.getByRole('button', { name: 'Сохранить товар', exact: true }).click();
  await editor.getByRole('heading', { name: 'Товар оператора' }).waitFor();
  await editor.getByRole('button', { name: 'Настройки', exact: true }).click();
  await editor.locator('#hero-title').fill('Подготовлено оператором');
  await editor.locator('#theme').selectOption('home');
  await editor.locator('#logo-upload').setInputFiles(imageFile);
  await editor.locator('#notice').filter({ hasText: 'Логотип загружен' }).waitFor();
  await editor.getByRole('button', { name: 'Сохранить настройки' }).click();
  await editor.locator('#notice').filter({ hasText: 'Настройки сохранены' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await page.getByRole('button', { name: 'Все магазины', exact: false }).click();
  const answers = ['Browser clone', 'browser-clone'];
  const copyDialogs = (dialog) => dialog.accept(answers.shift());
  page.on('dialog', copyDialogs);
  await factory.getByRole('button', { name: 'Копировать магазин', exact: true }).click();
  await page.getByRole('heading', { name: 'Browser clone', exact: true }).waitFor();
  page.off('dialog', copyDialogs);
  const cloned = (await req('/api/stores/browser-clone')).body;
  assert.equal(cloned.products[0].name, 'Товар оператора');
  assert.equal(cloned.store.settings.theme, 'home');
  assert.equal(cloned.products[0].sku, 'ST-001');
  assert.deepEqual(cloned.products[0].attributes, [
    { label: 'Материал', value: 'хлопок' },
    { label: 'Уход', value: 'стирка при 30°C' },
  ]);
  assert.ok(cloned.store.settings.logo.startsWith('/media/' + cloned.store.id + '/'));
  const cloneCard = page.locator('section').filter({ hasText: 'Browser clone' });
  page.once('dialog', (dialog) => dialog.accept('browser-clone'));
  await cloneCard.getByRole('button', { name: 'Удалить демо', exact: true }).click();
  await page.locator('#notice').filter({ hasText: 'Демо удалено' }).waitFor();
  assert.equal((await req('/api/stores/browser-clone')).status, 404);
  await factory.locator('input').fill('555');
  await factory.getByRole('button', { name: 'Создать приглашение' }).click();
  await factory.locator('a[href^="https://t.me/"]').waitFor();
  const activeShop = page.locator(`section[data-store-id="${shop.id}"]`);
  page.once('dialog', (dialog) => dialog.accept());
  await activeShop.getByRole('button', { name: 'Приостановить заказы', exact: true }).click();
  await page.locator('#notice').filter({ hasText: 'Состояние приёма заказов сохранено' }).waitFor();
  const pausedSite = await browser.newPage();
  await pausedSite.goto(origin + '/shop/' + shop.slug);
  await pausedSite
    .locator('#demo-banner')
    .filter({ hasText: 'Приём заказов временно приостановлен' })
    .waitFor();
  await pausedSite.close();
  page.once('dialog', (dialog) => dialog.accept());
  await activeShop.getByRole('button', { name: 'Возобновить заказы', exact: true }).click();
  await activeShop.getByRole('button', { name: 'Приостановить заказы', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await page.goto(origin + '/admin?store=' + shop.id);
  await page.getByRole('heading', { name: 'Всё под рукой' }).waitFor();
  await page.getByRole('button', { name: 'Добавить товар', exact: true }).click();
  await page.locator('#name').fill('Новая кепка');
  await page.locator('#category').fill('Аксессуары');
  await page.locator('#price-BYN').fill('15.50');
  await page.locator('#price-RUB').fill('450');
  await page.locator('#photo-upload').setInputFiles(imageFile);
  await page.locator('#notice').filter({ hasText: 'Фотографии загружены' }).waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('#photos img');
    return image?.complete && image.naturalWidth > 0;
  });
  await page.getByRole('button', { name: 'Сохранить товар', exact: true }).click();
  await page.getByRole('heading', { name: 'Новая кепка' }).waitFor();
  const data = (await req('/api/stores/' + shop.slug)).body;
  assert.ok(data.products.some((p) => p.name === 'Новая кепка' && p.prices.BYN === 1550));
  const uploadedPhoto = data.products.find((p) => p.name === 'Новая кепка').photos[0];
  assert.ok(uploadedPhoto.endsWith('.png'));
  assert.equal((await req(uploadedPhoto)).headers.get('Content-Type'), 'image/png');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.locator('#store-title').fill('Тестовый магазин');
  await page.locator('#logo-upload').setInputFiles(imageFile);
  await page.locator('#notice').filter({ hasText: 'Логотип загружен' }).waitFor();
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await page.locator('#store-name').filter({ hasText: 'Тестовый магазин' }).waitFor();
  await page.goto(origin + '/shop/' + shop.slug);
  await page.locator('#hero-title').filter({ hasText: 'Тестовый магазин' }).waitFor();
  await page.waitForFunction(() => {
    const logo = document.getElementById('hero-logo');
    const photo = document.querySelector('.card img');
    return !logo.hidden && logo.naturalWidth > 0 && photo?.naturalWidth > 0;
  });
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
