import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { start, stop, mf, db, shop, demo, initData, req, platform, PLATFORM } from './harness.js';
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
  await page.route('https://images.example.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: imageFile.buffer }),
  );
  const shotDir = process.env.BROWSER_SCREENSHOT_DIR;
  if (shotDir) await mkdir(shotDir, { recursive: true });
  for (const theme of ['minimal', 'fashion', 'home', 'beauty']) {
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
      await page.locator('.shop-masthead').waitFor();
      assert.equal(await page.locator('.hero-visual').count(), 1);
      if (theme === 'home' || theme === 'beauty') {
        const firstCategory = page.locator('.collection-tiles button').first();
        await firstCategory.click();
        assert.ok((await page.locator('#grid .card').count()) < 6);
        await page.locator('#filters .fbtn').first().click();
        assert.equal(await page.locator('#grid .card').count(), 6);
      }
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
  const domainStore = page.locator(`section[data-store-id="${shop.id}"]`);
  await domainStore.locator('.domain-panel > summary').click();
  await domainStore
    .locator('form[data-domain-store] [name=hostname]')
    .fill('www.browser-client.com');
  await domainStore.getByRole('button', { name: 'Добавить домен', exact: true }).click();
  await page.locator('#notice').filter({ hasText: 'Домен добавлен' }).waitFor();
  await domainStore.locator('.domain-panel > summary').click();
  await domainStore.getByRole('button', { name: 'Подключить / проверить', exact: true }).click();
  await page.locator('#notice').filter({ hasText: 'Сначала настройте' }).waitFor();
  await domainStore.locator('.domain-panel > summary').click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (shotDir)
    await page.screenshot({ path: shotDir + '/client-domain-mobile.png', fullPage: true });
  page.once('dialog', (dialog) => dialog.accept());
  await domainStore.getByRole('button', { name: 'Отключить домен', exact: true }).click();
  await page.locator('#notice').filter({ hasText: 'Домен отключён' }).waitFor();
  await page.getByRole('button', { name: 'Универсальный', exact: true }).click();
  await page.locator('#template-photo-0').setInputFiles(imageFile);
  await page.locator('#notice').filter({ hasText: 'Фото загружено' }).waitFor();
  await page.getByRole('button', { name: 'Сохранить фото шаблона', exact: true }).click();
  await page.locator('#notice').filter({ hasText: 'Фото шаблона сохранены' }).waitFor();
  const templateImage = (await req('/api/templates/minimal')).body.products[0].photos[0];
  assert.ok(templateImage.startsWith('/media/'));
  await page.getByRole('button', { name: 'Универсальный', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.template-photo')?.naturalWidth > 0);
  await page.locator('#template-url-1').fill('https://images.example.com/mug.png');
  await page.locator('#template-url-1').press('Tab');
  await page.getByRole('button', { name: 'Сохранить фото шаблона', exact: true }).click();
  await page.locator('#notice').filter({ hasText: 'Фото шаблона сохранены' }).waitFor();
  assert.equal(
    (await req('/api/templates/minimal')).body.products[1].photos[0],
    'https://images.example.com/mug.png',
  );
  await page.getByRole('button', { name: 'Универсальный', exact: true }).click();
  assert.equal(
    await page.locator('#template-url-1').inputValue(),
    'https://images.example.com/mug.png',
  );
  await page.getByRole('button', { name: 'Все магазины', exact: false }).click();
  await page.locator('#new-template').selectOption('fashion');
  assert.equal(await page.locator('#seed-products').isChecked(), true);
  assert.equal(
    await page.locator('#template-preview').getAttribute('href'),
    '/templates/fashion?lang=ru',
  );
  await page.locator('#new-language').selectOption('en');
  await page.waitForFunction(
    () =>
      document.getElementById('template-preview').getAttribute('href') ===
      '/templates/fashion?lang=en',
  );
  await page.locator('#new-name').fill('Browser template');
  await page.locator('#new-slug').fill('browser-template');
  await page.locator('#new-currency').selectOption('EUR');
  await page.getByRole('button', { name: 'Создать демо', exact: true }).click();
  await page.getByRole('heading', { name: 'Browser template', exact: true }).waitFor();
  const seeded = (await req('/api/stores/browser-template')).body;
  assert.equal(seeded.store.settings.theme, 'fashion');
  assert.equal(seeded.products.length, 6);
  assert.equal(seeded.store.settings.language, 'en');
  assert.doesNotMatch(JSON.stringify(seeded.products), /[А-Яа-яЁё]/);
  assert.ok(seeded.products.every((p) => p.prices.EUR > 0));
  await page.locator('#seed-products').uncheck();
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
  await editor.locator('#photo-url').fill('https://images.example.com/product.png');
  await editor.getByRole('button', { name: 'Добавить фото по ссылке', exact: true }).click();
  assert.equal(await editor.locator('#photos img').count(), 2);
  await editor.getByRole('button', { name: 'Сохранить товар', exact: true }).click();
  await editor.getByRole('heading', { name: 'Товар оператора' }).waitFor();
  await editor.getByRole('button', { name: 'Ещё', exact: true }).click();
  await editor.getByRole('button', { name: 'Настройки', exact: true }).click();
  await editor.locator('#store-language').selectOption('en');
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
  await factory.locator('input[id^="owner-"]').fill('555');
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
  await activeShop.locator('summary').filter({ hasText: 'Оплата Tribute' }).click();
  const invoiceForm = activeShop.locator('form[data-invoice-store]');
  await invoiceForm.locator('[name=title]').fill('Online store setup');
  await invoiceForm.locator('[name=description]').fill('Telegram store management setup');
  await invoiceForm.locator('[name=amount]').fill('125.00');
  await invoiceForm.locator('[name=currency]').selectOption('EUR');
  await invoiceForm.getByRole('button', { name: 'Создать счёт', exact: true }).click();
  await page.locator('#notice').filter({ hasText: 'Счёт создан' }).waitFor();
  const bills = await req('/api/platform/stores/' + shop.id + '/invoices', 'GET', undefined, {
    Authorization: 'Bearer ' + PLATFORM,
  });
  assert.equal(bills.status, 200);
  assert.equal(bills.body.length, 1);
  assert.equal(bills.body[0].amountMinor, 12500);
  assert.equal(bills.body[0].currency, 'eur');
  await activeShop.locator('summary').filter({ hasText: 'Оплата Tribute' }).click();
  await activeShop.getByRole('link', { name: 'Открыть оплату ↗' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  const stockFixture = await req(
    '/api/platform/stores/' + shop.id + '/products',
    'POST',
    {
      name: 'Остатки по вариантам',
      prices: { BYN: 1000, RUB: 30000 },
      variants: [
        { label: 'Чёрная', stock: 5 },
        { label: 'Белая', stock: 0 },
        { label: 'Стандарт', stock: null },
        { label: '<img src=x onerror="window.injectedStock=1"> — длинный вариант', stock: 1000000 },
      ],
    },
    { Authorization: 'Bearer ' + PLATFORM },
  );
  assert.equal(stockFixture.status, 201);
  await page.goto(origin + '/admin?store=' + shop.id);
  await page.getByRole('heading', { name: 'Всё под рукой' }).waitFor();
  await page.getByRole('button', { name: 'Товары', exact: true }).click();
  await page.locator('#product-search').fill('not-found-in-the-catalog');
  await page.getByRole('heading', { name: 'Ничего не найдено', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Очистить поиск', exact: true }).click();
  await page.locator('#product-search').fill('Остатки');
  assert.equal(await page.locator('.product-row').count(), 1);
  await page.locator('#product-search').fill('');
  const stockCard = page.locator('.product').filter({ hasText: 'Остатки по вариантам' });
  await stockCard.waitFor();
  const stockItems = await stockCard.locator('[role=listitem]').allTextContents();
  assert.ok(stockItems.some((text) => text.includes('Чёрная') && text.includes('5 шт.')));
  assert.ok(stockItems.some((text) => text.includes('Белая') && text.includes('0 шт.')));
  assert.ok(stockItems.some((text) => text.includes('Стандарт') && text.includes('Без лимита')));
  assert.ok(stockItems.some((text) => text.includes('<img') && text.includes('1000000 шт.')));
  assert.equal(await page.evaluate(() => window.injectedStock), undefined);
  const themeColors = {
    dark: {
      '--tg-theme-bg-color': '#17212b',
      '--tg-theme-secondary-bg-color': '#0e1621',
      '--tg-theme-text-color': '#f5f5f5',
      '--tg-theme-hint-color': '#a8b6c4',
      '--tg-theme-button-color': '#2ea6ff',
    },
    light: {
      '--tg-theme-bg-color': '#ffffff',
      '--tg-theme-secondary-bg-color': '#f0f2f4',
      '--tg-theme-text-color': '#202124',
      '--tg-theme-hint-color': '#68717b',
      '--tg-theme-button-color': '#2274c4',
    },
  };
  for (const [theme, colors] of Object.entries(themeColors)) {
    await page.evaluate((colors) => {
      for (const [key, value] of Object.entries(colors))
        document.documentElement.style.setProperty(key, value);
    }, colors);
    for (const width of [320, 390, 720]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(
        await page.evaluate(() => {
          const heading = document.querySelector('.page-heading').getBoundingClientRect();
          const card = document.querySelector('.stack > .card').getBoundingClientRect();
          return card.top - heading.bottom >= 16;
        }),
      );
      if (shotDir)
        await page.screenshot({
          path: shotDir + `/admin-stock-${theme}-${width}.png`,
          fullPage: true,
        });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();

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
  await page.getByRole('button', { name: 'Ещё', exact: true }).click();
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
  const favicon = await page.locator('#store-favicon').getAttribute('href');
  assert.ok(favicon.startsWith('/media/'));
  assert.equal(favicon, await page.locator('#hero-logo').getAttribute('src'));
  assert.equal(favicon, await page.locator('#store-touch-icon').getAttribute('href'));
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
  assert.equal(await page.locator('#hero-wa').isVisible(), true);
  assert.equal(await page.locator('#hero-tg').isVisible(), true);
  assert.equal(await page.locator('#hero-ig').isVisible(), true);
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
  await page.locator('[data-order] .order-photo').first().waitFor();
  await page.locator('[data-order]').first().click();
  await page.waitForFunction(
    () => document.querySelector('.order-lines .order-photo')?.naturalWidth > 0,
  );
  await page.getByRole('button', { name: 'Принять', exact: true }).click();
  await page.getByText('В обработке', { exact: true }).waitFor();
  if (shotDir) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: shotDir + '/admin-order-mobile.png' });
  }
  await page.goto(origin + '/admin?tgWebAppStartParam=s_' + shop.slug);
  await page.waitForURL(origin + '/s/' + shop.slug);
  await page.locator('.card-name').first().waitFor();
  // Test public root routing on a real alternate origin; DNS/SSL are tested with a provider fixture separately.
  const bound = await req(
    '/api/platform/stores/' + shop.id + '/domains',
    'POST',
    { hostname: 'www.browser-client.com' },
    { Authorization: 'Bearer ' + PLATFORM },
  );
  await db
    .prepare("UPDATE store_domains SET status='active' WHERE id=?")
    .bind(bound.body[0].id)
    .run();
  await page.route('https://www.browser-client.com/**', async (route) => {
    const request = route.request();
    const response = await mf.dispatchFetch(request.url(), {
      method: request.method(),
      headers: request.headers(),
      body: request.postDataBuffer() || undefined,
      redirect: 'manual',
    });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
  await page.goto('https://www.browser-client.com/');
  await page.locator('#hero-title').filter({ hasText: 'Тестовый магазин' }).waitFor();
  await page.waitForFunction(() => document.getElementById('hero-logo').naturalWidth > 0);
  assert.equal(await page.locator('body').getAttribute('data-store-slug'), shop.slug);
  assert.ok(await page.locator('.card-name').filter({ hasText: 'Новая кепка' }).count());
  if (shotDir) await page.screenshot({ path: shotDir + '/client-domain-storefront.png' });
  // Complete English checkout uses the language chosen in the developer panel.
  await db
    .prepare("UPDATE stores SET status='active',owner_id='111' WHERE id=?")
    .bind(seeded.store.id)
    .run();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/s/browser-template');
  await page.locator('.card-name').first().waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('#lbl-cart').innerText(), 'Cart');
  assert.doesNotMatch(await page.locator('#grid').innerText(), /[А-Яа-яЁё]/);
  if (shotDir) await page.screenshot({ path: shotDir + '/english-storefront.png', fullPage: true });
  await page.locator('.card').first().click();
  await page.locator('.size-btn').first().click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.locator('.cart-btn').click();
  assert.doesNotMatch(await page.locator('#cart-body').innerText(), /[А-Яа-яЁё]/);
  await page.getByRole('button', { name: 'Save delivery details', exact: true }).click();
  await page.locator('#toast').filter({ hasText: 'Fill in the required fields' }).waitFor();
  await page.locator('#delivery-name').fill('English buyer');
  await page.locator('#delivery-phone').fill('+447700900123');
  await page.locator('#delivery-address').fill('10 Sample Street');
  await page.getByRole('button', { name: 'Save delivery details', exact: true }).click();
  if (shotDir) await page.screenshot({ path: shotDir + '/english-cart.png' });
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await page.locator('#confirm-ov.open').waitFor();
  assert.equal(await page.locator('#confirm-ov .panel-title').innerText(), 'Order received');
  assert.match(await page.locator('#confirm-ov .order-sub').innerText(), /^Order saved. Total:/);
  assert.doesNotMatch(await page.locator('#confirm-ov').innerText(), /[А-Яа-яЁё]/);
  assert.equal(
    (
      await db
        .prepare('SELECT COUNT(*) n FROM orders WHERE store_id=?')
        .bind(seeded.store.id)
        .first()
    ).n,
    1,
  );
  if (shotDir) await page.screenshot({ path: shotDir + '/english-order.png' });
  // Instagram photos without a known price remain viewable, but cannot enter the cart.
  const priceLabels = {
    ru: 'Цена по запросу',
    en: 'Price on request',
    es: 'Precio a consultar',
    pt: 'Preço sob consulta',
    fr: 'Prix sur demande',
    it: 'Prezzo su richiesta',
    tr: 'Fiyat için iletişime geçin',
    pl: 'Cena na zapytanie',
    ja: '価格はお問い合わせください',
    de: 'Preis auf Anfrage',
  };
  for (const language of Object.keys(priceLabels)) {
    const imported = await platform('stores', 'POST', {
      name: 'Photo shop',
      slug: 'photo-shop-' + language,
      settings: { language, instagram: 'photo_shop', currencies: ['USD'] },
      products: [
        {
          name: 'Silver ring',
          description: 'Original product caption',
          prices: { USD: 0 },
          priceOnRequest: true,
          photos: ['https://images.example.com/ring.png'],
        },
      ],
    });
    assert.equal(imported.status, 201);
    await page.goto(origin + '/s/' + imported.body.slug);
    await page.locator('.card-name').first().waitFor();
    const label = priceLabels[language];
    assert.equal(await page.locator('html').getAttribute('lang'), language);
    for (const id of ['hero-tg', 'hero-wa', 'hero-ig'])
      assert.equal(await page.locator('#' + id).isVisible(), true);
    assert.equal(await page.locator('#hero-tg').getAttribute('aria-disabled'), 'true');
    assert.match(await page.locator('#hero-ig').getAttribute('href'), /instagram.com/);
    assert.equal(await page.locator('#grid .price').innerText(), label);
    await page.locator('.card').first().click();
    assert.equal(await page.locator('#pm-price-row').innerText(), label);
    assert.equal(await page.locator('#pm-desc').innerText(), 'Original product caption');
    assert.equal(await page.locator('#pm-add').isDisabled(), true);
    if (shotDir) await page.screenshot({ path: shotDir + '/photo-demo-' + language + '.png' });
  }
  assert.deepEqual(errors, []);
  // Every editor locale translates controls and preserves customer/product content.
  const editorLocales = JSON.parse(await readFile('src/admin-locales.json', 'utf8'));
  await page.goto(origin + '/admin?store=' + shop.id + '&lang=ja');
  await page.locator('#locale-picker').waitFor();
  await page.getByRole('button', { name: editorLocales.ja.Products, exact: true }).waitFor();
  await page.evaluate(() => {
    const item = document.createElement('div');
    item.id = 'locale-user-data';
    item.setAttribute('data-no-i18n', '');
    item.textContent = 'Новый — Products — Description';
    document.body.append(item);
    const input = document.createElement('input');
    input.id = 'locale-user-input';
    input.value = 'Описание клиента';
    document.body.append(input);
  });
  for (const code of ['ru', 'en', ...Object.keys(editorLocales), 'ru']) {
    const pending = page.waitForResponse(
      (r) => r.url().endsWith('/api/admin/preferences') && r.request().method() === 'PUT',
    );
    await page.locator('#locale-picker').selectOption(code);
    assert.equal((await pending).status(), 200);
    assert.equal(await page.locator('html').getAttribute('lang'), code);
    const expected =
      code === 'ru' ? 'Заказы' : code === 'en' ? 'Orders' : editorLocales[code].Orders;
    assert.equal((await page.locator('nav [data-tab="orders"]').innerText()).trim(), expected);
    assert.equal(
      await page.locator('#locale-user-data').innerText(),
      'Новый — Products — Description',
    );
    assert.equal(await page.locator('#locale-user-input').inputValue(), 'Описание клиента');
    const dynamic = await page.evaluate(() => window.DelokayI18n.t('Заказ №42'));
    assert.equal(
      dynamic,
      code === 'ru'
        ? 'Заказ №42'
        : code === 'en'
          ? 'Order #42'
          : editorLocales[code]['Order #{n}'].replace('{n}', '42'),
    );
    assert.equal(
      (
        await db
          .prepare('SELECT language FROM telegram_preferences WHERE user_id=?')
          .bind('111')
          .first()
      ).language,
      code,
    );
  }
  console.log(
    'Browser smoke passed: admin CRUD/settings → public catalog → failed and successful checkout → D1 → order status; demo, XSS and 375/390/1280 layouts.',
  );
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await stop();
}
