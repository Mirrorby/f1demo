'use strict';
const tg = window.Telegram?.WebApp;
const platformMode = document.body.dataset.mode === 'platform';
let platformKey = '';
function emptyStore() {
  document.getElementById('store-name').textContent = 'Магазин не подключён';
  main.innerHTML =
    '<div class="card"><h2>Подключить магазин</h2><p>Получите персональную ссылку приглашения от разработчика и откройте её в Telegram.</p><p>Оформить заказ на создание сайта можно в разделе «Оплата».</p><button class="primary" data-tab="payments">Перейти к оплате</button></div>';
}
function paymentButton(url, label) {
  return `<button class="primary" data-payment-url="${esc(url)}">${esc(label)}</button>`;
}
async function showPayments(seq) {
  main.innerHTML = '<h2>Оплата услуг</h2><p>Загружаем данные Tribute…</p>';
  const [config, purchases] = await Promise.all([api('payments/config'), api('payments')]);
  if (seq !== generation) return;
  const canOrder = config.configured && (config.orderLinkAvailable || config.active);
  const labels = {
    paid: 'Покупка подтверждена',
    refund_reported: 'Возврат зарегистрирован',
    pending: 'Ожидает оплаты',
    review: 'Нужна сверка',
    creating: 'Создаётся',
  };
  main.innerHTML = `<h2>Оплата услуг</h2><p>Создание и настройка сайта-каталога.</p>
    ${
      config.mode === 'digital'
        ? `<div class="card"><h3>${esc(config.name || 'Создание сайта')}</h3>${config.configured ? `<p>${(config.amountMinor / 100).toFixed(2)} ${esc(String(config.currency).toUpperCase())}</p>` : ''}
    ${config.fulfillmentRequired ? '<p>Товар на заказ. Продавец отправит результат через Tribute после выполнения заказа и модерации.</p>' : ''}
    ${canOrder && config.paymentUrl ? paymentButton(config.paymentUrl, config.fulfillmentRequired ? 'Заказать через Tribute' : 'Оплатить через Tribute') : '<p>Товар пока недоступен для оформления заказа.</p>'}</div>`
        : ''
    }
    <h3>Мои покупки и счета</h3>${purchases.map((p) => `<div class="card"><h3>${esc(p.title)}</h3><p>${(p.amountMinor / 100).toFixed(2)} ${esc(p.currency.toUpperCase())}</p><p>${esc(labels[p.status] || p.status)}</p>${p.paymentUrl && p.status === 'pending' ? paymentButton(p.paymentUrl, 'Оплатить через Tribute') : ''}</div>`).join('') || '<p>Покупок и счетов пока нет.</p>'}
    <button data-tab="payments">Обновить оплату</button>`;
}
function storeState() {
  return store.status === 'demo'
    ? 'Демонстрация'
    : store.acceptingOrders
      ? 'Магазин активен'
      : 'Приём заказов приостановлен';
}
const main = document.getElementById('main');
let stores = [],
  store = null,
  products = [],
  orders = [],
  tab = 'home',
  edited = null,
  photos = [],
  orderOffset = 0,
  orderFilter = '',
  generation = 0;
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const statusNames = {
  new: 'Новый',
  processing: 'В обработке',
  completed: 'Выполнен',
  cancelled: 'Отменён',
};
function notice(msg) {
  const el = document.getElementById('notice');
  el.textContent = msg;
  el.hidden = !msg;
}
async function api(path, method = 'GET', data, contentType = 'application/json') {
  const r = await fetch('/api/' + (platformMode ? 'platform' : 'admin') + '/' + path, {
    method,
    headers: {
      Authorization: platformMode ? 'Bearer ' + platformKey : 'tma ' + tg.initData,
      ...(data !== undefined ? { 'Content-Type': contentType } : {}),
    },
    body:
      data === undefined
        ? undefined
        : contentType === 'application/json'
          ? JSON.stringify(data)
          : data,
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || 'Не удалось выполнить запрос');
  return result;
}
const base = () => `stores/${store.id}`;
const siteUrl = () =>
  location.origin + `/${store.status === 'demo' ? 'demo' : 'shop'}/${store.slug}`;
function money(p) {
  return Object.entries(p.prices)
    .filter(([c]) => store.settings.currencies.includes(c))
    .map(([c, v]) => (v / 100).toLocaleString('ru-RU') + ' ' + c)
    .join(' / ');
}
function stockSummary(p) {
  return `<span class="stock-summary" role="list" aria-label="Остатки по вариантам">${p.variants
    .map(
      (v) =>
        `<span class="stock-item${v.stock === 0 ? ' stock-empty' : ''}" role="listitem"><span>${esc(v.label)}</span><strong>${v.stock === null ? 'Без лимита' : v.stock + ' шт.'}</strong></span>`,
    )
    .join('')}</span>`;
}
async function reload() {
  const id = store.id;
  const [next, ps] = await Promise.all([api(`stores/${id}`), api(`stores/${id}/products`)]);
  if (store.id !== id) return;
  store = next;
  products = ps;
  document.getElementById('store-name').textContent = store.name;
}
async function show(next = tab) {
  tab = next;
  edited = null;
  notice('');
  document
    .querySelectorAll('[data-tab]')
    .forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const seq = ++generation;
  try {
    if (tab === 'payments' && !platformMode) {
      await showPayments(seq);
    } else if (!store) {
      emptyStore();
    } else if (tab === 'home') {
      await reload();
      if (seq !== generation) return;
      main.innerHTML = `<div class="stats"><div class="card"><div class="stat">${store.stats.productCount}</div><p>Товаров</p></div><div class="card"><div class="stat">${store.stats.newOrderCount}</div><p>Новых заказов</p></div></div><div class="card"><h2>Всё под рукой</h2><p>Каталог и настройки обновляются на сайте сразу после сохранения.</p><div class="actions"><button class="primary" data-action="add">Добавить товар</button><button data-tab="orders">Посмотреть заказы</button></div></div><div class="card"><h3>${storeState()}</h3><p>${store.status === 'demo' ? 'Заказы отключены. После продажи разработчик активирует магазин.' : 'Новые заказы появятся в Telegram и в разделе «Заказы».'}</p><a href="${esc(siteUrl())}" target="_blank" rel="noopener">Открыть мой сайт</a></div>`;
    } else if (tab === 'products') {
      await reload();
      if (seq !== generation) return;
      main.innerHTML = `<div class="row between page-heading"><h2>Товары · ${products.length}</h2><button class="primary" data-action="add">Добавить</button></div><div class="stack">${products.map((p, i) => `<button class="card product" data-edit="${i}">${p.photos[0] ? `<img src="${esc(p.photos[0])}" alt="" loading="lazy">` : ''}<div class="info"><h3>${esc(p.name)}</h3><p>${esc(p.category)} · ${esc(money(p))}</p><span class="badge">${{ available: 'В наличии', preorder: 'На заказ', unavailable: 'Нет в наличии' }[p.availability]}</span>${stockSummary(p)}</div><span class="product-chevron" aria-hidden="true">›</span></button>`).join('') || '<p>Добавьте первый товар.</p>'}</div>`;
    } else if (tab === 'orders') {
      orders = await api(base() + `/orders?offset=${orderOffset}&status=${orderFilter}`);
      if (seq !== generation) return;
      main.innerHTML = `<h2>Заказы</h2><select id="order-filter" aria-label="Статус заказов"><option value="">Все</option>${Object.entries(
        statusNames,
      )
        .map(
          ([k, v]) => `<option value="${k}" ${k === orderFilter ? 'selected' : ''}>${v}</option>`,
        )
        .join(
          '',
        )}</select><div style="margin-top:16px">${orders.map((o, i) => `<button class="card product" data-order="${i}"><div class="info"><h3>№${o.number} · ${esc(o.customer.name)}</h3><p>${esc(statusNames[o.status])} · ${(o.totalMinor / 100).toLocaleString('ru-RU')} ${o.currency}</p><p>${new Date(o.createdAt * 1000).toLocaleString('ru-RU')}</p></div><span>›</span></button>`).join('') || '<p>Заказов пока нет.</p>'}</div><div class="actions"><button data-page="prev" ${orderOffset === 0 ? 'disabled' : ''}>Назад</button><button data-page="next" ${orders.length < 50 ? 'disabled' : ''}>Далее</button></div>`;
    } else if (tab === 'settings') renderSettings();
    else if (tab === 'site')
      main.innerHTML = `<h2>Мой сайт</h2><div class="card"><h3>${esc(store.name)}</h3><p>${storeState()}</p><p><a href="${esc(siteUrl())}" target="_blank" rel="noopener">${esc(siteUrl())}</a></p><button class="primary" data-action="copy">Скопировать ссылку</button></div>`;
  } catch (e) {
    if (seq !== generation) return;
    notice(e.message);
    if (tab === 'payments')
      main.innerHTML =
        '<h2>Оплата услуг</h2><p>Не удалось загрузить оплату. Попробуйте ещё раз.</p><button data-tab="payments">Обновить оплату</button>';
  }
}
function field(key, label, value = '', type = 'text', required = false) {
  return `<label for="${key}">${label}</label><input id="${key}" name="${key}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''}>`;
}
function variantRow(v = { label: '', stock: null }) {
  return `<div class="variant" ${v.id ? `data-id="${v.id}"` : ''}><input class="variant-label" aria-label="Размер, цвет или вариант" placeholder="Например: M / Красный" value="${esc(v.label)}" required maxlength="80"><input class="variant-stock" aria-label="Остаток" type="number" min="0" max="1000000" step="1" placeholder="∞" value="${v.stock ?? ''}"><button type="button" data-remove-variant aria-label="Удалить вариант">×</button></div>`;
}
function renderPhotos() {
  document.getElementById('photos').innerHTML = photos
    .map(
      (url, i) =>
        `<button type="button" data-remove-photo="${i}" aria-label="Удалить фото"><img class="thumb" src="${esc(url)}" alt="Фото ${i + 1}"> ×</button>`,
    )
    .join('');
}
function editProduct(index) {
  edited = index === undefined ? null : products[index];
  photos = [...(edited?.photos || [])];
  const p = edited || {};
  main.innerHTML = `<div class="row between page-heading"><h2>${edited ? 'Редактировать товар' : 'Новый товар'}</h2><button data-tab="products">Закрыть</button></div><form id="product-form"><div class="card"><div id="photos" class="photo-row"></div><label for="photo-upload">Фотографии (до 8)</label><input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple>${field('name', 'Название', p.name, 'text', true)}${field('category', 'Категория', p.category || 'Прочее', 'text', true)}<datalist id="categories">${[...new Set(products.map((p) => p.category))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist><label for="description">Описание</label><textarea id="description">${esc(p.description || '')}</textarea>
 ${store.settings.currencies.map((c) => field('price-' + c, 'Цена, ' + c, (p.prices?.[c] ?? 0) / 100, 'number', true)).join('')}
 <details><summary>Дополнительные валюты и характеристики</summary>${[
   'BYN',
   'RUB',
   'KZT',
   'USD',
   'EUR',
 ]
   .filter((c) => !store.settings.currencies.includes(c))
   .map((c) =>
     field(
       'price-' + c,
       'Цена, ' + c,
       p.prices?.[c] === undefined ? '' : p.prices[c] / 100,
       'number',
     ),
   )
   .join(
     '',
   )}${field('brand', 'Бренд', p.brand ?? p.team)}${field('color', 'Цвет', p.color)}${field('collection', 'Коллекция', p.collection ?? p.year)}${field('sku', 'Артикул', p.sku ?? p.number)}<label for="attributes">Характеристики (до 12, по одной на строке)</label><textarea id="attributes" placeholder="Материал: хлопок&#10;Объём: 100 мл">${esc((p.attributes || []).map((a) => a.label + ': ' + a.value).join('\n'))}</textarea></details>
 ${field('discount', 'Скидка, %', p.discountPercent || 0, 'number')}<label for="availability">Наличие</label><select id="availability">${[
   ['available', 'В наличии'],
   ['preorder', 'На заказ'],
   ['unavailable', 'Нет в наличии'],
 ]
   .map(([k, v]) => `<option value="${k}" ${k === p.availability ? 'selected' : ''}>${v}</option>`)
   .join(
     '',
   )}</select></div><div class="card"><h3>Варианты</h3><p>Размер, цвет или модель. Если выбора нет, оставьте «Без вариантов». Пустой остаток означает отсутствие ограничения.</p><div id="variants">${(p.variants || [{ label: 'Без вариантов', stock: null }]).map(variantRow).join('')}</div><button type="button" data-action="variant">Добавить вариант</button></div><div class="actions form-actions"><button class="primary" type="submit">Сохранить товар</button>${edited ? '<button type="button" class="danger" data-action="delete">Удалить товар</button>' : ''}</div></form>`;
  document.getElementById('category').setAttribute('list', 'categories');
  document.querySelectorAll('[id^="price-"]').forEach((el) => {
    el.min = '0';
    el.max = '1000000';
    el.step = '.01';
  });
  document.getElementById('discount').min = '0';
  document.getElementById('discount').max = '99';
  document.getElementById('discount').step = '1';
  renderPhotos();
}
function renderSettings() {
  const s = store.settings;
  main.innerHTML = `<h2>Настройки</h2><form id="settings-form"><div class="card">${field('store-title', 'Название магазина', store.name, 'text', true)}${field('hero-title', 'Заголовок витрины', s.heroTitle)}<label for="store-description">Описание магазина</label><textarea id="store-description">${esc(s.description)}</textarea><label for="theme">Шаблон витрины</label><select id="theme">${[
    ['minimal', 'Универсальный'],
    ['fashion', 'Одежда и аксессуары'],
    ['home', 'Дом и декор'],
    ['beauty', 'Косметика и уход'],
  ]
    .map(
      ([k, label]) =>
        `<option value="${k}" ${k === (s.theme || 'minimal') ? 'selected' : ''}>${label}</option>`,
    )
    .join(
      '',
    )}</select><p>Меняет оформление. Товары и цены сохраняются; основной цвет и название вариантов можно настроить ниже.</p>${field('accent', 'Основной цвет', s.accentColor, 'color')}${field('logo', 'Ссылка на логотип', s.logo)}<label for="logo-upload">Загрузить логотип</label><input id="logo-upload" type="file" accept="image/jpeg,image/png,image/webp">${field('whatsapp', 'WhatsApp: номер с кодом страны, только цифры', s.whatsapp)}${field('telegram', 'Telegram username без @', s.telegram)}${field('instagram', 'Instagram username без @', s.instagram)}<label for="currencies">Валюты (1 или 2, через запятую)</label><input id="currencies" value="${esc(s.currencies.join(', '))}" required><p>BYN, RUB, KZT, USD, EUR. Перед включением новой валюты добавьте цены в карточках товаров.</p><label for="delivery">Способы доставки (по одному на строке)</label><textarea id="delivery" required>${esc(s.deliveryMethods.join('\n'))}</textarea><label for="delivery-hint">Условия доставки</label><textarea id="delivery-hint">${esc(s.deliveryHint)}</textarea>${field('footer', 'Текст внизу сайта', s.footerText)}<details><summary>Тексты кнопок и подписей</summary>${[
    ['btn_cart', 'Кнопка корзины'],
    ['btn_add', 'Добавить в корзину'],
    ['label_size', 'Название вариантов'],
    ['filter_all', 'Все категории'],
    ['support_label', 'Подпись к контактам'],
  ]
    .map(([k, label]) => field('text-' + k, label, s.texts[k] || ''))
    .join(
      '',
    )}</details></div><div class="actions form-actions"><button class="primary" type="submit">Сохранить настройки</button></div></form>`;
}
function showOrder(o) {
  const c = o.customer;
  const buttons = {
    new: [
      ['processing', 'Принять'],
      ['completed', 'Выполнен'],
      ['cancelled', 'Отменить'],
    ],
    processing: [
      ['completed', 'Выполнен'],
      ['cancelled', 'Отменить'],
    ],
    completed: [],
    cancelled: [],
  };
  main.innerHTML = `<div class="row between page-heading"><h2>Заказ №${o.number}</h2><button data-tab="orders">Назад</button></div><div class="card"><span class="badge">${statusNames[o.status]}</span><h3 style="margin-top:16px">${esc(c.name)}</h3><p>${esc(c.phone)}</p><p>${esc(c.deliveryMethod)}<br>${esc(c.address)}<br>${esc([c.city, c.region, c.index].filter(Boolean).join(', '))}</p>${c.comment ? `<p>${esc(c.comment)}</p>` : ''}<ul class="order-lines">${o.items.map((i) => `<li>${esc(i.name)} · ${esc(i.variant)}<br>${i.quantity} × ${(i.unitMinor / 100).toLocaleString('ru-RU')} ${o.currency}</li>`).join('')}</ul><h3>Итого: ${(o.totalMinor / 100).toLocaleString('ru-RU')} ${o.currency}</h3><div class="actions">${buttons[o.status].map(([s, label]) => `<button data-status="${s}" data-order-id="${o.id}" class="${s === 'cancelled' ? 'danger' : 'primary'}">${label}</button>`).join('')}</div></div>`;
}
async function uploadImage(file) {
  if (
    !file ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error('Выберите JPEG, PNG или WebP до 20 МБ');
  // Resize before upload to keep R2 storage and mobile traffic small.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob || blob.size > 3 * 1024 * 1024) throw new Error('Изображение слишком большое');
  // WebKit can fall back to PNG when its canvas encoder does not support WebP.
  // Use the actual Blob type so the server's signature validation still matches.
  return (await api(base() + '/images', 'POST', blob, blob.type)).url;
}
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  try {
    if (button.dataset.paymentUrl) {
      const url = new URL(button.dataset.paymentUrl);
      if (
        url.protocol !== 'https:' ||
        !(
          url.hostname === 't.me' ||
          url.hostname === 'tribute.tg' ||
          url.hostname.endsWith('.tribute.tg')
        )
      )
        throw new Error('Некорректная ссылка оплаты');
      if (url.hostname === 't.me' && tg?.openTelegramLink) tg.openTelegramLink(url.href);
      else if (tg?.openLink) tg.openLink(url.href);
      else window.open(url.href, '_blank', 'noopener');
      return;
    }
    if (button.dataset.tab) {
      orderOffset = 0;
      await show(button.dataset.tab);
      return;
    }
    if (button.dataset.edit !== undefined) {
      editProduct(Number(button.dataset.edit));
      return;
    }
    if (button.dataset.order !== undefined) {
      showOrder(orders[Number(button.dataset.order)]);
      return;
    }
    if (button.dataset.removePhoto !== undefined) {
      photos.splice(Number(button.dataset.removePhoto), 1);
      renderPhotos();
      return;
    }
    if (button.hasAttribute('data-remove-variant')) {
      if (document.querySelectorAll('.variant').length > 1) button.closest('.variant').remove();
      else notice('Оставьте хотя бы один вариант');
      return;
    }
    if (button.dataset.page) {
      orderOffset = Math.max(0, orderOffset + (button.dataset.page === 'next' ? 50 : -50));
      await show('orders');
      return;
    }
    if (button.dataset.status) {
      button.disabled = true;
      await api(base() + '/orders/' + button.dataset.orderId, 'PATCH', {
        status: button.dataset.status,
      });
      showOrder(await api(base() + '/orders/' + button.dataset.orderId));
      notice('Статус сохранён');
      return;
    }
    if (button.dataset.action === 'add') editProduct();
    if (button.dataset.action === 'variant') {
      if (document.querySelectorAll('.variant').length >= 30)
        throw new Error('Максимум 30 вариантов');
      document.getElementById('variants').insertAdjacentHTML('beforeend', variantRow());
    }
    if (button.dataset.action === 'copy') {
      await navigator.clipboard.writeText(siteUrl());
      notice('Ссылка скопирована');
    }
    if (button.dataset.action === 'delete') {
      const ok = tg?.showConfirm
        ? await new Promise((resolve) => tg.showConfirm('Удалить товар из каталога?', resolve))
        : confirm('Удалить товар?');
      if (!ok) return;
      button.disabled = true;
      await api(base() + '/products/' + edited.id, 'DELETE', { version: edited.version });
      await show('products');
      notice('Товар удалён');
    }
  } catch (e) {
    button.disabled = false;
    notice(e.message);
  }
});
document.addEventListener('change', async (event) => {
  const el = event.target;
  try {
    if (el.id === 'store-picker') {
      store = stores.find((s) => s.id === el.value);
      generation++;
      orderOffset = 0;
      await show('home');
    }
    if (el.id === 'order-filter') {
      orderFilter = el.value;
      orderOffset = 0;
      await show('orders');
    }
    if (el.id === 'photo-upload') {
      if (photos.length + el.files.length > 8) throw new Error('Максимум 8 фотографий');
      const save = document.querySelector('#product-form [type=submit]');
      save.disabled = true;
      notice('Загружаем фотографии…');
      try {
        for (const file of el.files) photos.push(await uploadImage(file));
        renderPhotos();
        notice('Фотографии загружены');
      } finally {
        save.disabled = false;
      }
    }
    if (el.id === 'logo-upload') {
      const save = document.querySelector('#settings-form [type=submit]');
      save.disabled = true;
      notice('Загружаем логотип…');
      try {
        document.getElementById('logo').value = await uploadImage(el.files[0]);
        notice('Логотип загружен. Сохраните настройки.');
      } finally {
        save.disabled = false;
      }
    }
  } catch (e) {
    notice(e.message);
  }
});
document.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target,
    button = form.querySelector('[type=submit]');
  button.disabled = true;
  notice('');
  const val = (id) => document.getElementById(id).value.trim();
  try {
    if (form.id === 'product-form') {
      const prices = {};
      for (const c of ['BYN', 'RUB', 'KZT', 'USD', 'EUR']) {
        const raw = val('price-' + c);
        if (raw !== '') prices[c] = Math.round(Number(raw) * 100);
      }
      const data = {
        name: val('name'),
        category: val('category'),
        description: val('description'),
        brand: val('brand'),
        collection: val('collection'),
        sku: val('sku'),
        attributes: val('attributes')
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            const separator = line.indexOf(':');
            if (separator < 1 || !line.slice(separator + 1).trim())
              throw new Error('Характеристики: используйте формат «Название: значение»');
            return {
              label: line.slice(0, separator).trim(),
              value: line.slice(separator + 1).trim(),
            };
          }),
        color: val('color'),
        availability: val('availability'),
        discountPercent: Number(val('discount')),
        photos,
        prices,
        variants: [...document.querySelectorAll('.variant')].map((row) => ({
          ...(row.dataset.id ? { id: row.dataset.id } : {}),
          label: row.querySelector('.variant-label').value.trim(),
          stock:
            row.querySelector('.variant-stock').value === ''
              ? null
              : Number(row.querySelector('.variant-stock').value),
        })),
      };
      if (edited) data.version = edited.version;
      await api(
        base() + '/products' + (edited ? '/' + edited.id : ''),
        edited ? 'PUT' : 'POST',
        data,
      );
      await show('products');
      notice('Товар сохранён');
    } else if (form.id === 'settings-form') {
      const s = {
        ...store.settings,
        heroTitle: val('hero-title'),
        description: val('store-description'),
        theme: val('theme'),
        accentColor: val('accent'),
        logo: val('logo'),
        whatsapp: val('whatsapp'),
        telegram: val('telegram'),
        instagram: val('instagram'),
        currencies: val('currencies')
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
        deliveryMethods: val('delivery')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        deliveryHint: val('delivery-hint'),
        footerText: val('footer'),
        texts: { ...store.settings.texts },
      };
      for (const el of document.querySelectorAll('[id^=text-]')) {
        if (el.value.trim()) s.texts[el.id.slice(5)] = el.value.trim();
        else delete s.texts[el.id.slice(5)];
      }
      await api(base() + '/settings', 'PUT', {
        name: val('store-title'),
        settings: s,
        version: store.version,
      });
      await reload();
      await show('settings');
      notice('Настройки сохранены');
    }
  } catch (e) {
    notice(e.message);
  } finally {
    button.disabled = false;
  }
});
(async () => {
  if (platformMode) {
    if (window.parent === window) {
      main.innerHTML = '<p>Откройте редактор из <a href="/platform">панели фабрики</a>.</p>';
      document.getElementById('nav').hidden = true;
      return;
    }
    platformKey = await new Promise((resolve) => {
      const listener = (event) => {
        if (
          event.origin !== location.origin ||
          event.source !== window.parent ||
          event.data?.type !== 'catalog-platform-key'
        )
          return;
        window.removeEventListener('message', listener);
        resolve(event.data.key);
      };
      window.addEventListener('message', listener);
      window.parent.postMessage({ type: 'catalog-editor-ready' }, location.origin);
    });
  }
  if (!platformMode && !tg?.initData) {
    document.getElementById('store-name').textContent = 'Мой магазин';
    main.innerHTML =
      '<div class="card"><h2>Откройте панель в Telegram</h2><p>Нажмите «Управлять магазином» в личном чате с ботом.</p></div>';
    document.getElementById('nav').hidden = true;
    return;
  }
  if (!platformMode) {
    tg.ready();
    tg.expand();
  }
  try {
    stores = await api('stores');
    const params = new URLSearchParams(location.search);
    if (!platformMode && params.get('tab') === 'payments') tab = 'payments';
    if (!stores.length) {
      document.getElementById('store-name').textContent = 'Мой кабинет';
      document.querySelectorAll('#nav [data-tab]').forEach((button) => {
        button.disabled = !['home', 'payments'].includes(button.dataset.tab);
      });
      await show(tab);
      return;
    }
    store = stores.find((s) => s.id === params.get('store')) || stores[0];
    const picker = document.getElementById('store-picker');
    picker.hidden = platformMode || stores.length < 2;
    picker.innerHTML = stores
      .map(
        (s) =>
          `<option value="${s.id}" ${s.id === store.id ? 'selected' : ''}>${esc(s.name)}</option>`,
      )
      .join('');
    await show(tab);
    if (params.get('order'))
      showOrder(await api(base() + '/orders/' + encodeURIComponent(params.get('order'))));
  } catch (e) {
    if (!store) document.getElementById('store-name').textContent = 'Мой кабинет';
    if (tab === 'payments') {
      await show('payments');
      return;
    }
    notice(e.message);
    main.innerHTML =
      '<p>Не удалось подключиться. Обновите страницу или откройте панель заново.</p>';
  }
})();
