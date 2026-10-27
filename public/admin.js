'use strict';
const tg = window.Telegram?.WebApp;
const platformMode = document.body.dataset.mode === 'platform';
if (document.body.classList.contains('delokay-app')) {
  const applyTheme = () => {
    document.body.dataset.theme =
      tg?.colorScheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  };
  applyTheme();
  tg?.onEvent?.('themeChanged', applyTheme);
}
let platformKey = '';
function emptyStore() {
  document.getElementById('store-name').textContent = 'Мой кабинет';
  main.innerHTML = `<section class="card hero-card"><span class="home-eyebrow">DELOKAY</span><h2>Создайте свой магазин</h2><p>Добавьте Instagram, выберите оформление и подготовьте каталог к запуску.</p><button class="primary" data-tab="create">Создать магазин</button></section>`;
}
function supportButton(label='Написать в Delokay') {
  const url = 'https://t.me/Mirrorby';
  if (platformMode) return `<a class="primary support-link" href="${url}" target="_blank" rel="noopener"><span>${esc(label)}</span> <span data-no-i18n>@Mirrorby</span></a>`;
  return `<div class="support-contact"><button type="button" class="primary" data-support-contact><span>${esc(label)}</span> <span data-no-i18n>@Mirrorby</span></button><p class="support-result" role="status" hidden></p></div>`;
}
function launchOffer() {
  return `<section class="card launch-offer"><h2>Запустите свой магазин</h2><p>Настройте демо бесплатно: проверьте товары, фотографии и тексты.</p><p>После оплаты мы активируем сайт и приём заказов. Стоимость и способ оплаты обсудим лично.</p>${supportButton('Обсудить запуск')}</section>`;
}
let demoPollTimer=null, pendingDemoId=null;
function collectionNote(job){
  if(job.status==='ready'||job.status==='failed')return '';
  const value=JSON.parse(job.collector_tasks||'[]').find(t=>t.kind==='instagram')?.summary?.collection;
  if(!value)return '';
  return '<p>'+esc(value.phase==='saving_photos'?'Сохраняем фотографии: '+Number(value.files||0):'Найдено фотопубликаций за период: '+Number(value.posts||0))+'</p>';
}
function renderDemoJobs(jobs) {
  const target=document.getElementById('demo-jobs');
  if(!target)return;
  const labels={preparing:'Подключаем Instagram',running:'Собираем демо',awaiting_import:'Ожидаем данные Instagram',ready:'Демо готово',failed:'Не удалось создать демо'};
  target.innerHTML=jobs.map(j=>'<div class="demo-job"><strong data-no-i18n>@'+esc(j.instagram)+'</strong><p>'+esc(labels[j.status]||j.status)+(j.progress?' · '+j.progress+'%':'')+'</p>'+collectionNote(j)+(j.expires_at&&j.status==='ready'?'<p>Хранится до '+esc(new Date(j.expires_at*1000).toLocaleDateString())+'</p>':'')+(j.import_error?'<p role="status">'+esc(j.import_error)+'</p>'+supportButton('Получить помощь'):'')+((j.status==='ready'||!j.auto_build)&&j.slug?'<div class="actions"><button data-open-demo="'+esc(j.store_id)+'">Открыть демо</button><a href="/s/'+esc(j.slug)+'" target="_blank" rel="noopener">Посмотреть сайт ↗</a></div>':'')+'</div>').join('')||'<p>Здесь появятся готовые демо.</p>';
}
function scheduleDemoPoll(jobs) {
  clearTimeout(demoPollTimer);
  const pending=jobs.filter(j=>j.auto_build&&j.sample_content&&['preparing','running','awaiting_import'].includes(j.status));
  if(!pending.length||tab!=='create')return;
  demoPollTimer=setTimeout(async()=>{
    try {
      for(const job of pending)await api('demo-jobs/'+job.id+'/sync','POST',{});
      const fresh=await api('demo-jobs');
      if(tab!=='create')return;
      renderDemoJobs(fresh);
      const ready=fresh.find(j=>j.id===pendingDemoId&&j.status==='ready');
      if(ready){pendingDemoId=null;await openDemo(ready.store_id);notice('Демо готово. Проверьте товары и тексты.');return;}
      scheduleDemoPoll(fresh);
    }catch{if(tab==='create')demoPollTimer=setTimeout(()=>show('create'),8000);}
  },2500);
}
async function showCreate(seq) {
  main.innerHTML='<p>Загрузка…</p>';
  const [response,jobs]=await Promise.all([fetch('/api/templates'),api('demo-jobs')]);
  if(!response.ok)throw new Error('Не удалось загрузить шаблоны');
  const templates=await response.json();
  if(seq!==generation)return;
  main.innerHTML = `<h2>Создать магазин</h2><ol class="demo-steps"><li>Аккаунт и оформление</li><li>Подготовка демо</li><li>Редактирование и запуск</li></ol><section class="card"><p>Соберём фотопубликации за выбранный период, до 8 фотографий из каждой карусели, и подготовим тексты для каталога. Демо появится после завершения сборки.</p></section>
  <p class="section-caption">До трёх бесплатных демо на аккаунт. Неактивированное демо хранится 7 дней после готовности.</p><p>Для запуска сайта и приёма заказов свяжитесь с нами после подготовки демо.</p><form id="demo-form"><section class="card"><label for="demo-instagram">Instagram аккаунт</label><input id="demo-instagram" required maxlength="500" placeholder="@your_store или https://instagram.com/your_store/">
  <label for="demo-period">Период публикаций</label><select id="demo-period"><option value="7">7 дней</option><option value="30" selected>30 дней</option><option value="90">90 дней</option></select>
  <h3>Выберите оформление</h3><div class="demo-template-grid">${templates.map((t, i) => `<div class="demo-template-card"><label for="demo-template-${esc(t.id)}"><span class="demo-template-preview" aria-hidden="true"><iframe src="/templates/${esc(t.id)}?thumbnail=1&lang=${document.documentElement.lang === 'en' ? 'en' : 'ru'}" title="${esc(t.title)}" loading="lazy" tabindex="-1" inert></iframe></span><span class="demo-template-choice"><input id="demo-template-${esc(t.id)}" type="radio" name="demo-template" value="${esc(t.id)}" ${i === 0 ? 'checked' : ''}> <span>${esc(t.title)}</span></span></label><p>${esc(t.description)}</p><a href="/templates/${esc(t.id)}" target="_blank" rel="noopener">Посмотреть пример ↗</a></div>`).join('')}</div>
  <label for="demo-reference">Сайт, который вам нравится (необязательно)</label><input id="demo-reference" type="url" maxlength="2000" placeholder="https://example.com"><p>Сохраним сайт в базе референсов и адаптируем его цветовую палитру к выбранному оформлению. Тексты и фотографии возьмём из вашего Instagram.</p>
  <label for="demo-language">Язык сайта</label><select id="demo-language"><option value="ru">Русский</option><option value="en">English</option></select>
  <label for="demo-currency">Валюта</label><select id="demo-currency">${['BYN', 'RUB', 'USD', 'EUR', 'KZT'].map((c) => `<option>${c}</option>`).join('')}</select>
  <button class="primary" type="submit">Создать демо</button></section></form>
<section class="card"><h3>Мои демо</h3><div id="demo-jobs"></div></section>`;
  renderDemoJobs(jobs);
  scheduleDemoPoll(jobs);
}
async function openDemo(id) {
  stores = await api('stores');
  store = stores.find((s) => s.id === id);
  if (!store) throw new Error('Демо ещё готовится. Обновите статусы.');
  document.querySelectorAll('#nav [data-tab]').forEach((b) => (b.disabled = false));
  const picker = document.getElementById('store-picker');
  picker.hidden = stores.length < 2;
  picker.innerHTML = stores
    .map(
      (s) =>
        `<option value="${esc(s.id)}" ${s.id === id ? 'selected' : ''}>${esc(s.name)}</option>`,
    )
    .join('');
  await show('home');
  notice(store.demoJob?.sample_content ? 'Это ранее созданное демо с примерными товарами.' : 'Демо заполнено данными Instagram. Тексты можно редактировать.');
}

function paymentButton(url, label) {
  return `<button class="primary" data-payment-url="${esc(url)}">${esc(label)}</button>`;
}
async function showPayments(seq) {
  main.innerHTML = '<h2>Оплата услуг</h2><div class="card"><p>Загружаем данные Tribute…</p></div>';
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
  main.innerHTML = `<div class="row between page-heading"><div><h2>Оплата услуг</h2><p class="section-caption">Оплачивайте услуги и следите за статусом покупок в одном месте.</p></div></div><div class="card payment-intro"><h3>Создание и настройка сайта-каталога.</h3>
    </div>${
      config.mode === 'digital'
        ? `<div class="card payment-offer"><h3>${esc(config.name || 'Создание сайта')}</h3>${config.configured ? `<p>${(config.amountMinor / 100).toFixed(2)} ${esc(String(config.currency).toUpperCase())}</p>` : ''}
    ${config.fulfillmentRequired ? '<p>Товар на заказ. Продавец отправит результат через Tribute после выполнения заказа и модерации.</p>' : ''}
    ${canOrder && config.paymentUrl ? paymentButton(config.paymentUrl, config.fulfillmentRequired ? 'Заказать через Tribute' : 'Оплатить через Tribute') : '<p>Товар пока недоступен для оформления заказа.</p>'}</div>`
        : ''
    }
    <h3 class="section-label">Мои покупки и счета</h3>${purchases.map((p) => `<div class="card payment-item"><h3 data-no-i18n>${esc(p.title)}</h3><p>${(p.amountMinor / 100).toFixed(2)} ${esc(p.currency.toUpperCase())}</p><span class="badge payment-badge">${esc(labels[p.status] || p.status)}</span>${p.paymentUrl && p.status === 'pending' ? paymentButton(p.paymentUrl, 'Оплатить через Tribute') : ''}</div>`).join('') || '<div class="card empty-panel"><p>Покупок и счетов пока нет.</p></div>'}
    <button data-tab="payments">Обновить оплату</button>`;
}
function moreScreen() {
  main.innerHTML = `<div class="section-label">Ваши инструменты</div><div class="more-list">
    ${store ? '<button class="more-link" data-tab="site" aria-label="Мой сайт"><span class="more-icon mint">↗</span><span class="more-copy"><strong>Мой сайт</strong><small>Ссылка на вашу витрину и её статус</small></span><span class="more-chevron">›</span></button>' : ''}
    ${store ? '<button class="more-link" data-tab="settings" aria-label="Настройки"><span class="more-icon">⚙</span><span class="more-copy"><strong>Настройки</strong><small>Оформление магазина, контакты и доставка</small></span><span class="more-chevron">›</span></button>' : ''}
    ${!platformMode && store ? '<button class="more-link" data-tab="subscription"><span class="more-icon mint">▣</span><span class="more-copy"><strong>Подписка</strong><small>Срок действия и продление</small></span><span class="more-chevron">›</span></button>' : ''}
    </div>
    <div class="section-label">Delokay</div><div class="card"><h3>Нужна помощь?</h3><p>Ответим на вопросы о настройке, запуске и продлении.</p>${supportButton()}</div><div class="hint-strip">Меньше рутины. Больше дела. ✨<br>Новые инструменты будут появляться здесь по мере запуска.</div>`;
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
  generation = 0,
  productQuery = '',
  productCategory = '';
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
  if (!r.ok) {trackActivity('error',path,{message:result.error||'Не удалось выполнить запрос',status:String(r.status)});throw new Error(result.error || 'Не удалось выполнить запрос');}
  return result;
}
const base = () => `stores/${store.id}`;
const siteUrl = () => store.customUrl || location.origin + '/s/' + store.slug;
const shareUrl = () => store.customUrl || store.shareUrl || siteUrl();
function money(p) {
  if (p.priceOnRequest) return 'Цена по запросу';
  return Object.entries(p.prices)
    .filter(([c]) => store.settings.currencies.includes(c))
    .map(([c, v]) => (v / 100).toLocaleString(window.DelokayI18n?.locale() || 'ru-RU') + ' ' + c)
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

function drawProductRows() {
  const target = document.getElementById('product-results');
  if (!target) return;
  const query = productQuery.trim().toLocaleLowerCase();
  const visible = products
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        (!productCategory || p.category === productCategory) &&
        (!query ||
          [p.name, p.category, p.brand, p.sku].some((x) =>
            String(x || '')
              .toLocaleLowerCase()
              .includes(query),
          )),
    );
  target.innerHTML =
    visible
      .map(
        ({ p, i }) => `<button class="card product product-row" data-edit="${i}">
    ${p.photos[0] ? `<img src="${esc(p.photos[0])}" alt="" loading="lazy">` : '<span class="product-placeholder" aria-hidden="true">▦</span>'}
    <span class="info"><h3 class="product-title" data-no-i18n>${esc(p.name)}</h3>
    <span class="product-meta" data-no-i18n>${esc(p.category)} · ${esc(money(p))}</span>
    <span class="badge availability-${esc(p.availability)}">${{ available: 'В наличии', preorder: 'На заказ', unavailable: 'Нет в наличии' }[p.availability]}</span>
    ${stockSummary(p)}</span><span class="product-chevron" aria-hidden="true">›</span></button>`,
      )
      .join('') ||
    `<div class="card empty-panel"><div class="empty-visual">⌕</div><h3>${products.length ? 'Ничего не найдено' : 'Пока нет товаров'}</h3>
    <p>${products.length ? 'Попробуйте другой запрос или категорию.' : 'Ваш каталог начнётся с первого товара. Добавьте фото, цену и описание.'}</p>
    ${products.length ? '<button data-action="clear-search">Очистить поиск</button>' : '<button class="primary" data-action="add">Добавить товар</button>'}</div>`;
}
function renderProductsList() {
  const categories = [...new Set(products.map((p) => p.category))].sort((a, b) =>
    a.localeCompare(b),
  );
  main.innerHTML = `<div class="row between page-heading"><div><h2>Товары · ${products.length}</h2>
    <p class="section-caption">Управление магазином</p></div><div class="actions"><button data-action="product-order">Порядок товаров</button><button class="primary" data-action="add">Добавить</button></div></div>
    <div class="product-toolbar"><label class="visually-hidden" for="product-search">Поиск товаров</label>
      <input id="product-search" type="search" autocomplete="off" placeholder="Найти товар…" value="${esc(productQuery)}">
      <label class="visually-hidden" for="product-category">Все категории товаров</label>
      <select id="product-category" aria-label="Все категории товаров"><option value="">Все категории</option>
      ${categories.map((c) => `<option value="${esc(c)}" ${c === productCategory ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
    <div id="product-results" class="stack"></div>`;
  drawProductRows();
}
function orderPhoto(item) {
  return item?.photo
    ? `<img class="order-photo" src="${esc(item.photo)}" alt="${esc(item.name)}" loading="lazy">`
    : '<span class="order-symbol" aria-hidden="true">▤</span>';
}
document.addEventListener(
  'error',
  (event) => {
    const img = event.target;
    if (img instanceof HTMLImageElement && img.classList.contains('order-photo')) {
      const fallback = document.createElement('span');
      fallback.className = 'order-symbol';
      fallback.textContent = '▤';
      fallback.setAttribute('aria-hidden', 'true');
      img.replaceWith(fallback);
    }
  },
  true,
);
function renderOrdersList() {
  main.innerHTML = `<div class="row between page-heading"><div><h2>Заказы</h2><p class="section-caption">Заказы клиентов</p></div></div>
    <div class="order-filter-row"><label for="order-filter">Статус заказов</label>
      <select id="order-filter"><option value="">Все</option>
      ${Object.entries(statusNames)
        .map(
          ([k, v]) => `<option value="${k}" ${k === orderFilter ? 'selected' : ''}>${v}</option>`,
        )
        .join('')}</select></div>
    <div class="stack">${
      orders
        .map(
          (o, i) => `<button class="card product order-row" data-order="${i}">
      ${orderPhoto(o.items.find((item) => item.photo) || o.items[0])}<span class="info">
      <h3 class="product-title">№${o.number} · <span data-no-i18n>${esc(o.customer.name)}</span></h3>
      <span class="product-meta">${(o.totalMinor / 100).toLocaleString(window.DelokayI18n?.locale() || 'ru-RU')} ${esc(o.currency)} · ${new Date(o.createdAt * 1000).toLocaleDateString(window.DelokayI18n?.locale() || 'ru-RU')}</span>
      <span class="badge order-${esc(o.status)}">${statusNames[o.status]}</span></span>
      <span class="product-chevron">›</span></button>`,
        )
        .join('') ||
      `<div class="card empty-panel"><div class="empty-visual">▤</div>
      <h3>${orderFilter ? 'Нет заказов по выбранному статусу' : 'Заказов пока нет.'}</h3>
      <p>${orderFilter ? 'Попробуйте выбрать другой статус.' : 'Новые заказы появятся здесь и в Telegram.'}</p></div>`
    }</div>
    <div class="actions pagination"><button data-page="prev" ${orderOffset === 0 ? 'disabled' : ''}>Назад</button>
    <button data-page="next" ${orders.length < 50 ? 'disabled' : ''}>Далее</button></div>`;
}

async function reload() {
  const id = store.id;
  const [next, ps] = await Promise.all([api(`stores/${id}`), api(`stores/${id}/products`)]);
  if (store.id !== id) return;
  store = next;
  if (!platformMode) {
    const jobs = await api('demo-jobs');
    if (store.id !== id) return;
    store.demoJob = jobs.find((j) => j.store_id === id);
  }
  products = ps;
  document.getElementById('store-name').setAttribute('data-no-i18n', '');
  document.getElementById('store-name').textContent = store.name;
}
async function show(next = tab) {
  rememberScreen({kind:'tab',tab:next,storeId:store?.id||null});
  clearTimeout(demoPollTimer);
  tab = next;
  edited = null;
  notice('');
  const selectedNav = ['settings', 'site', 'payments', 'subscription'].includes(tab) ? 'more' : tab;
  document
    .querySelectorAll('#nav [data-tab]')
    .forEach((b) => b.classList.toggle('active', b.dataset.tab === selectedNav));
  const seq = ++generation;
  try {
    if (tab === 'create' && !platformMode) {
      await showCreate(seq);
    } else if (tab === 'payments' && !platformMode) {
      await showPayments(seq);
    } else if (tab === 'subscription' && store) {
      await reload();
      if(seq!==generation)return;
      const sub=store.subscription;
      main.innerHTML='<h2>Подписка</h2><section class="card">'+(sub?'<p>Статус: '+(sub.status==='expired'?'срок закончился':'действует')+'</p><p>Действует до: '+esc(new Date(sub.expires_at*1000).toLocaleDateString())+'</p><p>'+(store.notificationsAvailable?'Напомним о продлении за три дня.</p><p>':'')+'Чтобы продлить подписку, свяжитесь с Delokay.</p>'+supportButton('Обсудить продление'):(store.status==='demo'?'<p>Подписка ещё не активирована. После оплаты Delokay активирует ваш сайт вручную.</p>':'<p>Данные подписки пока не указаны. Свяжитесь с нами, чтобы уточнить условия.</p>')+supportButton(store.status==='demo'?'Обсудить запуск':'Написать в Delokay'))+'</section>';
    } else if (tab === 'more') {
      moreScreen();
    } else if (!store) {
      emptyStore();
    } else if (tab === 'home') {
      await reload();
      if (seq !== generation) return;
      main.innerHTML = `<section class="card hero-card">
      <span class="home-eyebrow">DELOKAY · КАТАЛОГИ</span>
      <h2>Всё под рукой</h2>${store.demoJob?.sample_content ? '<p>Если данные Instagram ещё не применены, товары и цены в демо примерные. Статус сбора доступен в разделе «Создать магазин».</p>' : ''}${!platformMode ? '<button data-tab="create">Создать ещё магазин</button>' : ''}
      <p>Товары, заказы и ваш сайт в одном удобном месте. Изменения появляются на витрине сразу после сохранения.</p>${store.subscription ? `<p>Подписка ${store.subscription.status === 'expired' ? 'закончилась' : 'действует'} до ${new Date(store.subscription.expires_at*1000).toLocaleDateString()}. Для продления свяжитесь с Delokay.</p>` : store.status === 'demo' ? '<p>После оплаты мы вручную активируем ваш сайт и подписку.</p>' : '<p>Данные подписки пока не указаны. Свяжитесь с нами, чтобы уточнить условия.</p>'}
      <div class="actions"><button class="primary" data-action="add">Добавить товар</button></div>
    </section>
    ${store.status === 'demo' && !platformMode ? launchOffer() : ''}
    <div class="section-label">Обзор магазина</div>
    <div class="stats">
      <div class="card"><div class="stat-symbol">▦</div><div class="stat">${store.stats.productCount}</div><p>Товаров</p></div>
      <div class="card"><div class="stat-symbol mint">▤</div><div class="stat">${store.stats.newOrderCount}</div><p>Новых заказов</p></div>
    </div>
    <div class="section-label">Быстрые действия</div>
    <div class="quick-grid">
      <button class="quick-action" data-tab="products"><span class="quick-icon">▦</span><span>Все товары →</span></button>
      <button class="quick-action" data-tab="orders"><span class="quick-icon mint">▤</span><span>Посмотреть заказы →</span></button>
    </div>
    <div class="section-label">Ваш сайт</div>
    <div class="card"><div class="status-row"><span class="status-indicator"></span><div><h3>${storeState()}</h3><p class="muted">${store.status === 'demo' ? 'Заказы отключены в демонстрационном режиме.' : 'Новые заказы появятся здесь и в Telegram.'}</p><a href="${esc(siteUrl())}" target="_blank" rel="noopener">Открыть витрину ↗</a></div></div></div>`;
    } else if (tab === 'products') {
      await reload();
      if (seq !== generation) return;
      renderProductsList();
    } else if (tab === 'orders') {
      orders = await api(base() + `/orders?offset=${orderOffset}&status=${orderFilter}`);
      if (seq !== generation) return;
      if (store.status === 'demo' && !platformMode) main.innerHTML=launchOffer();
      else renderOrdersList();
    } else if (tab === 'settings') await renderSettings(seq);
    else if (tab === 'site')
      main.innerHTML = `<div class="row between page-heading"><div><h2>Мой сайт</h2><p class="section-caption">Ссылка на витрину</p></div></div>
        <div class="card site-overview"><div class="row between"><h3 data-no-i18n>${esc(store.name)}</h3><span class="badge">${storeState()}</span></div>
        <p class="section-caption">${store.status === 'demo' ? 'Заказы отключены в демонстрационном режиме.' : 'Магазин готов делиться с клиентами.'}</p>
        <div class="site-link" data-no-i18n>${esc(shareUrl())}</div>
        <div class="actions"><button class="primary" data-action="copy">Скопировать ссылку</button><a class="site-open-link" href="${esc(siteUrl())}" target="_blank" rel="noopener">Открыть витрину ↗</a></div></div>${store.status === 'demo' && !platformMode ? launchOffer() : ''}`;
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
  rememberScreen({kind:'product',index,tab:'products',storeId:store?.id||null});
  edited = index === undefined ? null : products[index];
  photos = [...(edited?.photos || [])];
  const p = edited || {};
  main.innerHTML = `<div class="row between page-heading"><div><h2>${edited ? 'Редактировать товар' : 'Новый товар'}</h2><p class="section-caption">Цены, фото и варианты товара</p></div><button data-tab="products">Закрыть</button></div><form id="product-form"><div class="card"><h3 class="form-section-heading">Основные сведения</h3><div id="photos" class="photo-row"></div><label for="photo-upload">Фотографии (до 8)</label><input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple><label for="photo-url">Ссылка на фото</label><input id="photo-url" type="url" maxlength="1000" placeholder="https://example.com/photo.jpg"><button type="button" data-action="photo-link">Добавить фото по ссылке</button>${field('name', 'Название', p.name, 'text', true)}${field('category', 'Категория', p.category || 'Прочее', 'text', true)}<datalist id="categories">${[...new Set(products.map((p) => p.category))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist><label for="description">Описание</label><textarea id="description">${esc(p.description || '')}</textarea></div><div class="card"><h3 class="form-section-heading">Цены и остатки</h3>
 <label><input id="price-on-request" type="checkbox" ${p.priceOnRequest ? 'checked' : ''}> Цена по запросу</label>
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
function backgroundEditors(settings) {
  return `<div class="card"><h3>Фон сайта и блоков</h3><p>Выберите цвет или своё фото. Режим «Как в шаблоне» возвращает исходное оформление блока. После изменений сохраните настройки.</p>${[
    ['page', 'Вся страница'],
    ['hero', 'Первый экран'],
    ['catalog', 'Область каталога'],
    ['cards', 'Карточки товаров'],
    ['information', 'Информационные блоки'],
    ['footer', 'Подвал сайта'],
  ]
    .map(([key, title]) => {
      const bg = settings.backgrounds?.[key] || {
        mode: 'template',
        color: '#f7f8fc',
        image: '',
        tone: 'auto',
        overlay: 60,
      };
      return `<details class="background-editor" data-background-editor="${key}"><summary>${title}</summary><label for="bg-${key}-mode">Режим фона</label><select id="bg-${key}-mode" data-background-mode>${[
        ['template', 'Как в шаблоне'],
        ['color', 'Свой цвет'],
        ['image', 'Своё фото'],
      ]
        .map(
          ([value, label]) =>
            `<option value="${value}" ${bg.mode === value ? 'selected' : ''}>${label}</option>`,
        )
        .join('')}</select>
    <div data-background-color ${bg.mode === 'template' ? 'hidden' : ''}><label for="bg-${key}-color">Цвет фона</label><input id="bg-${key}-color" type="color" value="${esc(bg.color)}"></div>
    <div data-background-image ${bg.mode === 'image' ? '' : 'hidden'}><label for="bg-${key}-image">Фото по ссылке</label><input id="bg-${key}-image" type="text" inputmode="url" maxlength="1000" placeholder="https://example.com/background.jpg" value="${esc(bg.image)}" ${bg.mode === 'image' ? 'required' : ''}><label for="bg-${key}-upload">Загрузить фото фона</label><input id="bg-${key}-upload" data-background-upload="${key}" type="file" accept="image/jpeg,image/png,image/webp"><label for="bg-${key}-overlay">Подложка для читаемости (%)</label><input id="bg-${key}-overlay" type="number" min="0" max="80" step="1" value="${bg.overlay}"></div>
    <div data-background-tone ${bg.mode === 'template' ? 'hidden' : ''}><label for="bg-${key}-tone">Текст поверх фона</label><select id="bg-${key}-tone">${[
      ['auto', 'Автоматически'],
      ['light', 'Светлый'],
      ['dark', 'Тёмный'],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}" ${bg.tone === value ? 'selected' : ''}>${label}</option>`,
      )
      .join(
        '',
      )}</select></div><div class="background-swatch" data-background-swatch hidden></div></details>`;
    })
    .join('')}</div>`;
}
function updateBackgroundEditor(panel) {
  const key = panel.dataset.backgroundEditor;
  const mode = document.getElementById('bg-' + key + '-mode').value;
  panel.querySelector('[data-background-color]').hidden = mode === 'template';
  panel.querySelector('[data-background-image]').hidden = mode !== 'image';
  panel.querySelector('[data-background-tone]').hidden = mode === 'template';
  const image = document.getElementById('bg-' + key + '-image');
  image.required = mode === 'image';
  const swatch = panel.querySelector('[data-background-swatch]');
  swatch.hidden = mode === 'template';
  swatch.style.backgroundColor = document.getElementById('bg-' + key + '-color').value;
  swatch.style.backgroundImage =
    mode === 'image' && /^(https:\/\/|\/media\/|\/template-assets\/)/.test(image.value.trim())
      ? `url(${JSON.stringify(image.value.trim())})`
      : 'none';
}
async function renderSettings(seq) {
  const selected = store;
  let defaults = {};
  if (selected.status === 'demo') {
    const response = await fetch(
      '/api/templates/' +
        encodeURIComponent(selected.settings.theme || 'minimal') +
        '?lang=' +
        encodeURIComponent(selected.settings.language || 'ru'),
    );
    if (!response.ok) throw new Error('Не удалось загрузить шаблоны');
    defaults = (await response.json()).store.settings.texts;
  }
  if (seq !== generation || selected.id !== store.id) return;
  const s = { ...selected.settings, texts: { ...defaults, ...selected.settings.texts } };
  main.innerHTML = `<h2>Настройки</h2><p class="section-caption">Управление магазином</p><form id="settings-form"><div class="card"><h3 class="form-section-heading">Сведения о магазине</h3>${field('store-title', 'Название магазина', store.name, 'text', true)}<label for="store-language">Язык сайта</label><select id="store-language"><option value="ru" ${s.language === 'ru' ? 'selected' : ''}>Русский</option><option value="en" ${s.language === 'en' ? 'selected' : ''}>English</option><option value="es" ${s.language === 'es' ? 'selected' : ''}>Español</option><option value="pt" ${s.language === 'pt' ? 'selected' : ''}>Português</option><option value="fr" ${s.language === 'fr' ? 'selected' : ''}>Français</option><option value="it" ${s.language === 'it' ? 'selected' : ''}>Italiano</option><option value="tr" ${s.language === 'tr' ? 'selected' : ''}>Türkçe</option><option value="pl" ${s.language === 'pl' ? 'selected' : ''}>Polski</option><option value="ja" ${s.language === 'ja' ? 'selected' : ''}>日本語</option><option value="de" ${s.language === 'de' ? 'selected' : ''}>Deutsch</option></select><p>Язык интерфейса и стандартных текстов. Собственные названия и описания товаров редактируются отдельно.</p>${field('hero-title', 'Заголовок витрины', s.heroTitle)}<label for="store-description">Описание магазина</label><textarea id="store-description">${esc(s.description)}</textarea></div><div class="card"><h3 class="form-section-heading">Оформление</h3><label for="theme">Шаблон витрины</label><select id="theme">${[
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
    )}</select><p>Меняет оформление. Товары и цены сохраняются; основной цвет и название вариантов можно настроить ниже.</p>${field('accent', 'Основной цвет', s.accentColor, 'color')}${field('logo', 'Ссылка на логотип', s.logo)}<label for="logo-upload">Загрузить логотип</label><input id="logo-upload" type="file" accept="image/jpeg,image/png,image/webp"><p>Логотип также используется как иконка вкладки магазина.</p></div>${backgroundEditors(s)}<div class="card"><h3 class="form-section-heading">Контакты</h3>${field('whatsapp', 'WhatsApp: номер с кодом страны, только цифры', s.whatsapp)}${field('telegram', 'Telegram username без @', s.telegram)}${field('instagram', 'Instagram username без @', s.instagram)}</div><div class="card"><h3 class="form-section-heading">Доставка и оплата</h3><label for="currencies">Валюты (1 или 2, через запятую)</label><input id="currencies" value="${esc(s.currencies.join(', '))}" required><p>BYN, RUB, KZT, USD, EUR. Перед включением новой валюты добавьте цены в карточках товаров.</p><label for="delivery">Способы доставки (по одному на строке)</label><textarea id="delivery" required>${esc(s.deliveryMethods.join('\n'))}</textarea><label for="delivery-hint">Условия доставки</label><textarea id="delivery-hint">${esc(s.deliveryHint)}</textarea>${field('footer', 'Текст внизу сайта', s.footerText)}<details><summary>Тексты кнопок и подписей</summary>${[
    ['btn_cart', 'Кнопка корзины'],
    ['btn_add', 'Добавить в корзину'],
    ['btn_add_size', 'Подсказка выбора варианта'],
    ['btn_clear', 'Очистить корзину'],
    ['label_size', 'Название вариантов'],
    ['label_qty', 'Количество'],
    ['label_year', 'Коллекция'],
    ['label_color', 'Цвет'],
    ['label_number', 'Артикул'],
    ['label_total', 'Итого'],
    ['label_pick', 'Выбор параметров'],
    ['msg_empty_cart', 'Пустая корзина'],
    ['msg_added', 'Товар добавлен'],
    ['wa_msg_header', 'Начало сообщения WhatsApp'],
    ['wa_msg_footer', 'Конец сообщения WhatsApp'],
    ['tg_msg_header', 'Начало сообщения Telegram'],
    ['tg_msg_footer', 'Конец сообщения Telegram'],
    ['filter_all', 'Все категории'],
    ['support_label', 'Подпись к контактам'],
  ]
    .map(([k, label]) => field('text-' + k, label, s.texts[k] || ''))
    .join(
      '',
    )}</details></div><div class="card"><h3>Информация для покупателей</h3><p>Заполните факты о своём магазине. Укажите реальные условия доставки, оплаты и возврата. Пустые поля скрывают соответствующий блок.</p>${[
    ['about_title', 'О магазине: заголовок'],
    ['about_body', 'О магазине: текст'],
    ['sizing_title', 'Помощь с выбором: заголовок'],
    ['sizing_body', 'Помощь с выбором: текст'],
    ['ordering_title', 'Как оформить заказ?: заголовок'],
    ['ordering_body', 'Как оформить заказ?: текст'],
    ['shipping_title', 'Доставка и оплата: заголовок'],
    ['shipping_body', 'Доставка и оплата: текст'],
    ['returns_title', 'Обмен и возврат: заголовок'],
    ['returns_body', 'Обмен и возврат: текст'],
    ['faq_title', 'FAQ: заголовок'],
    ['faq_1_question', 'Вопрос 1'],
    ['faq_1_answer', 'Ответ 1'],
    ['faq_2_question', 'Вопрос 2'],
    ['faq_2_answer', 'Ответ 2'],
    ['faq_3_question', 'Вопрос 3'],
    ['faq_3_answer', 'Ответ 3'],
  ]
    .map(
      ([key, label]) =>
        `<label for="text-${key}">${label}</label><textarea id="text-${key}" data-information="true" data-no-i18n maxlength="500" rows="3">${esc(s.texts[key] || '')}</textarea>`,
    )
    .join(
      '',
    )}</div><div class="actions form-actions"><button class="primary" type="submit">Сохранить настройки</button></div></form>`;
  document.querySelectorAll('[data-background-editor]').forEach(updateBackgroundEditor);
}
function showOrder(o) {
  rememberScreen({kind:'order',order:o,tab:'orders',storeId:store?.id||null});
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
  const locale = window.DelokayI18n?.locale() || 'ru-RU';
  main.innerHTML = `<div class="row between page-heading"><div><h2>Заказ №${o.number}</h2><p class="section-caption">Информация о заказе</p></div><button data-tab="orders">Назад</button></div>
    <section class="card"><div class="row between"><h3>Статус заказов</h3><span class="badge order-${esc(o.status)}">${statusNames[o.status]}</span></div>
      <div class="order-total">${(o.totalMinor / 100).toLocaleString(locale)} ${esc(o.currency)}</div>
      <p class="section-caption">${new Date(o.createdAt * 1000).toLocaleString(locale)}</p></section>
    <section class="card"><h3 class="form-section-heading">Клиент</h3>
      <div class="order-customer" data-no-i18n><strong>${esc(c.name)}</strong><p>${esc(c.phone)}</p>
      <p>${esc(c.deliveryMethod)}<br>${esc(c.address)}<br>${esc([c.city, c.region, c.index].filter(Boolean).join(', '))}</p>
      ${c.comment ? `<p>${esc(c.comment)}</p>` : ''}</div></section>
    <section class="card"><h3 class="form-section-heading">Состав заказа</h3>
      <ul class="order-lines">${o.items.map((i) => `<li>${orderPhoto(i)}<div class="order-item-copy"><strong data-no-i18n>${esc(i.name)}</strong><span class="muted" data-no-i18n>${esc(i.variant)}</span><span>${i.quantity} × ${(i.unitMinor / 100).toLocaleString(locale)} ${esc(o.currency)}</span></div></li>`).join('')}</ul>
      <div class="row between order-summary"><strong>Итого</strong><strong>${(o.totalMinor / 100).toLocaleString(locale)} ${esc(o.currency)}</strong></div></section>
    ${buttons[o.status].length ? `<div class="actions order-actions">${buttons[o.status].map(([status, label]) => `<button data-status="${status}" data-order-id="${o.id}" class="${status === 'cancelled' ? 'danger' : 'primary'}">${label}</button>`).join('')}</div>` : ''}`;
}
async function uploadImage(file, destination = base()) {
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
  return (await api(destination + '/images', 'POST', blob, blob.type)).url;
}
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  try {
    if (button.hasAttribute('data-support-contact')) {
      const result=button.parentElement.querySelector('.support-result');
      button.disabled=true;
      let sent=false;
      try {
        await api('support-contact','POST',{});
        sent=true;
        result.textContent=window.DelokayI18n?.language && window.DelokayI18n.language !== 'ru' ? 'The contact was sent to the bot chat. Close this window to open it.' : 'Контакт отправлен в чат бота. Закройте это окно и нажмите кнопку в сообщении.';
      } catch (_) {
        result.textContent=window.DelokayI18n?.language && window.DelokayI18n.language !== 'ru' ? 'Could not send the contact. Find @Mirrorby in Telegram.' : 'Не удалось отправить контакт. Найдите @Mirrorby в поиске Telegram.';
      } finally { result.hidden=false; button.disabled=sent; }
      return;
    }
    if (button.dataset.openDemo) {
      await openDemo(button.dataset.openDemo);
      return;
    }
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
    if (button.dataset.action === 'photo-link') {
      if (photos.length >= 8) throw new Error('Максимум 8 фотографий');
      const input = document.getElementById('photo-url');
      let url;
      try {
        url = new URL(input.value.trim());
      } catch {
        throw new Error('Укажите прямую HTTPS-ссылку на фото');
      }
      if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 1000)
        throw new Error('Укажите прямую HTTPS-ссылку на фото');
      if (!photos.includes(url.href)) photos.push(url.href);
      input.value = '';
      renderPhotos();
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
    if(button.dataset.action==='product-order'){renderProductOrder();return;}
    if(button.dataset.moveProduct){
      const sortGeneration=++generation;
      button.disabled=true;
      try {
        const ids=products.map(p=>p.id),from=ids.indexOf(button.dataset.moveProduct);
        const to=button.dataset.direction==='first'?0:from+(button.dataset.direction==='up'?-1:1);
        if(from<0||to<0||to>=ids.length)return;
        ids.splice(to,0,ids.splice(from,1)[0]);
        await api(base()+'/product-order','PUT',{version:store.version,ids});
        await reload();if(sortGeneration===generation)renderProductOrder();
      } finally {button.disabled=false;}
      return;
    }
    if (button.dataset.action === 'add') editProduct();
    if (button.dataset.action === 'clear-search') {
      productQuery = '';
      productCategory = '';
      renderProductsList();
    }
    if (button.dataset.action === 'variant') {
      if (document.querySelectorAll('.variant').length >= 30)
        throw new Error('Максимум 30 вариантов');
      document.getElementById('variants').insertAdjacentHTML('beforeend', variantRow());
    }
    if (button.dataset.action === 'copy') {
      await navigator.clipboard.writeText(shareUrl());
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
document.addEventListener('input', (event) => {
  if (event.target.id === 'product-search') {
    productQuery = event.target.value;
    drawProductRows();
  }
});
document.addEventListener('change', async (event) => {
  const el = event.target;
  try {
    const panel = el.closest('[data-background-editor]');
    if (panel && el.dataset.backgroundUpload === undefined) updateBackgroundEditor(panel);
    if (el.dataset.backgroundUpload !== undefined) {
      if (!el.files.length) return;
      const selectedGeneration = generation,
        destination = base();
      const form = el.closest('form'),
        save = form.querySelector('[type=submit]');
      const uploads = [...form.querySelectorAll('input[type=file]')];
      save.disabled = true;
      uploads.forEach((input) => (input.disabled = true));
      notice('Загружаем фото фона…');
      try {
        const url = await uploadImage(el.files[0], destination);
        if (selectedGeneration !== generation || !panel.isConnected) return;
        document.getElementById('bg-' + el.dataset.backgroundUpload + '-image').value = url;
        document.getElementById('bg-' + el.dataset.backgroundUpload + '-mode').value = 'image';
        updateBackgroundEditor(panel);
        notice('Фон загружен. Сохраните настройки.');
      } finally {
        if (form.isConnected) {
          save.disabled = false;
          uploads.forEach((input) => (input.disabled = false));
        }
      }
      return;
    }
    if (el.id === 'store-picker') {
      store = stores.find((s) => s.id === el.value);
      generation++;
      orderOffset = 0;
      await show('home');
    }
    if (el.id === 'product-category') {
      productCategory = el.value;
      drawProductRows();
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
    if (form.id === 'demo-form') {
      button.textContent = 'Готовим демо…';
      const result = await api('demo-jobs', 'POST', {
        instagram: val('demo-instagram'),
        templateId: form.querySelector('[name=demo-template]:checked').value,
        referenceUrl: val('demo-reference'),
        language: val('demo-language'),
        currency: val('demo-currency'),
        periodDays: Number(val('demo-period')),
      });
      pendingDemoId=result.job?.id;
      if (result.job?.status==='ready' && result.job?.slug) await openDemo(result.job.store_id);
      else await show('create');
      return;
    }
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
        priceOnRequest: document.getElementById('price-on-request').checked,
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
        language: val('store-language'),
        accentColor: val('accent'),
        logo: val('logo'),
        backgrounds: Object.fromEntries(
          [...document.querySelectorAll('[data-background-editor]')].map((panel) => {
            const key = panel.dataset.backgroundEditor;
            return [
              key,
              {
                mode: val('bg-' + key + '-mode'),
                color: val('bg-' + key + '-color'),
                image: val('bg-' + key + '-image'),
                tone: val('bg-' + key + '-tone'),
                overlay: Number(val('bg-' + key + '-overlay')),
              },
            ];
          }),
        ),
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
        if (el.value.trim() || el.dataset.information) s.texts[el.id.slice(5)] = el.value.trim();
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
    if (form.id === 'demo-form') button.textContent = 'Создать тестовое демо';
  }
});
(async () => {
  const startParam =
    tg?.initDataUnsafe?.start_param ||
    new URLSearchParams(location.search).get('tgWebAppStartParam') ||
    '';
  if (!platformMode && /^s_[a-z0-9][a-z0-9-]{0,79}$/.test(startParam)) {
    tg?.ready?.();
    location.replace('/s/' + startParam.slice(2));
    return;
  }
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
    if (!platformMode && params.get('tab') === 'payments') tab = 'subscription';
    if (!stores.length) {
      document.getElementById('store-name').textContent = 'Мой кабинет';
      document.querySelectorAll('#nav [data-tab]').forEach((button) => {
        button.disabled = !['home', 'more'].includes(button.dataset.tab);
      });
      await show(tab);
      return;
    }
    store = stores.find((s) => s.id === params.get('store')) || stores[0];
    const picker = document.getElementById('store-picker');
    picker.setAttribute('data-no-i18n', '');
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


const screenHistory=[];
let currentScreen=null, restoringScreen=false;
function rememberScreen(next) {
  if(restoringScreen)return;
  if(currentScreen?.storeId!==next.storeId)screenHistory.length=0;
  if(currentScreen&&JSON.stringify(currentScreen)!==JSON.stringify(next))screenHistory.push(currentScreen);
  if(screenHistory.length>40)screenHistory.shift();
  currentScreen=next;
  if(screenHistory.length)tg?.BackButton?.show();else tg?.BackButton?.hide();
  trackActivity('screen',next.kind,{tab:next.tab});
}
async function goBack(trigger='back') {
  if(!screenHistory.length)return;
  if(document.querySelector('form[data-dirty="1"]')&&!confirm('Вернуться без сохранения изменений?'))return;
  const previous=screenHistory.pop();
  restoringScreen=true;
  try {
    if(previous.kind==='product')editProduct(previous.index);
    else if(previous.kind==='order')showOrder(previous.order);
    else if(previous.kind==='sort')renderProductOrder();
    else await show(previous.tab);
    currentScreen=previous;
    trackActivity('screen','back',{tab:previous.tab,trigger});
  } finally {restoringScreen=false;}
  if(screenHistory.length)tg?.BackButton?.show();else tg?.BackButton?.hide();
}
tg?.BackButton?.onClick(()=>{void goBack('telegram');});
let edgeGesture=null;
document.addEventListener('touchstart',event=>{
  const t=event.touches[0];
  if(event.touches.length!==1||t.clientX>28||!screenHistory.length||event.target.closest('input,textarea,select,[contenteditable],.photo-list,[data-gallery]')){edgeGesture=null;return;}
  edgeGesture={x:t.clientX,y:t.clientY,time:Date.now()};
},{passive:true});
document.addEventListener('touchmove',event=>{
  if(!edgeGesture)return;
  const t=event.touches[0];
  if(event.touches.length!==1){edgeGesture=null;return;}
  const dx=t.clientX-edgeGesture.x,dy=t.clientY-edgeGesture.y;
  if(Math.abs(dy)>40&&Math.abs(dy)>Math.abs(dx)){edgeGesture=null;return;}
  if(dx>15&&Math.abs(dy)<dx*.6)event.preventDefault();
},{passive:false});
document.addEventListener('touchend',event=>{
  if(!edgeGesture)return;
  const start=edgeGesture;edgeGesture=null;
  const t=event.changedTouches[0];
  if(t.clientX-start.x>=70&&Math.abs(t.clientY-start.y)<50&&Date.now()-start.time<900){event.preventDefault();void goBack('swipe');}
},{passive:false});
function renderProductOrder(){
  generation++;
  rememberScreen({kind:'sort',tab:'products',storeId:store?.id||null});
  main.innerHTML='<h2>Порядок товаров</h2><p>Первый товар будет титульным в каталоге. Изменения сохраняются сразу.</p>'+products.map((p,i)=>'<section class="card"><strong>'+esc(p.name)+'</strong>'+(i===0?'<p>Титульный товар</p>':'')+'<div class="actions"><button data-move-product="'+esc(p.id)+'" data-direction="first" '+(i===0?'disabled':'')+'>На первое место</button><button aria-label="Поднять товар" data-move-product="'+esc(p.id)+'" data-direction="up" '+(i===0?'disabled':'')+'>↑</button><button aria-label="Опустить товар" data-move-product="'+esc(p.id)+'" data-direction="down" '+(i===products.length-1?'disabled':'')+'>↓</button></div></section>').join('');
}

const activityQueue=[];
let activityTimer=null,activitySending=false;
const privateField=/password|passwd|secret|token|session|cookie|authorization|platform.?key|wallet|private.?key/i;
function clientEventId(){
  try{
    if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
    const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
    const s=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
    return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);
  }catch{return null;}
}
function trackActivity(event,target,details={}){
  if(platformMode||!tg?.initData||privateField.test(target))return;
  const clean={};
  for(const [key,value] of Object.entries(details))if(!privateField.test(key))clean[key]=String(value??'').slice(0,5000);
  const id=clientEventId();if(!id)return;
  activityQueue.push({id,event,screen:typeof tab==='string'?tab:'home',target:String(target).slice(0,120),details:clean});
  if(activityQueue.length>200)activityQueue.shift();
  clearTimeout(activityTimer);activityTimer=setTimeout(()=>{void flushActivity();},2000);
}
async function flushActivity(){
  if(activitySending||!activityQueue.length||!tg?.initData)return;
  activitySending=true;
  const batch=activityQueue.splice(0,10);
  try {
    const r=await fetch('/api/admin/activity',{method:'POST',headers:{Authorization:'tma '+tg.initData,'Content-Type':'application/json'},body:JSON.stringify({events:batch}),keepalive:true});
    if(!r.ok&&r.status!==429)activityQueue.unshift(...batch);
  }catch{activityQueue.unshift(...batch);}
  finally{activitySending=false;if(activityQueue.length)activityTimer=setTimeout(()=>{void flushActivity();},8000);}
}
document.addEventListener('click',event=>{
  const el=event.target.closest('button,a,input[type=radio],input[type=checkbox]');
  if(!el)return;
  const target=el.id||el.dataset.action||el.dataset.tab||el.name||el.textContent.trim().slice(0,80);
  trackActivity('click',target,{label:el.textContent.trim().slice(0,120),storeId:el.dataset.openDemo||store?.id||'',productId:el.dataset.moveProduct||(el.dataset.edit!==undefined?products[Number(el.dataset.edit)]?.id:'')||'',direction:el.dataset.direction||''});
},{capture:true});
document.addEventListener('input',event=>{
  const form=event.target.closest('form');if(form)form.dataset.dirty='1';
},{capture:true});
document.addEventListener('change',event=>{
  const el=event.target;
  if(!el.matches('input,textarea,select')||['password','hidden'].includes(el.type))return;
  if(el.type==='file'){trackActivity('change',el.id||el.name||'upload',{files:JSON.stringify([...el.files].map(f=>({name:f.name,size:f.size,type:f.type})))});return;}
  const target=el.id||el.name||'field';
  if(privateField.test(target))return;
  trackActivity('change',target,{value:el.type==='checkbox'?String(el.checked):el.value});
},{capture:true});
document.addEventListener('submit',event=>{
  trackActivity('submit',event.target.id||'form');
  const active=document.activeElement;
  if(active?.form===event.target && !['password','hidden','file'].includes(active.type) && !privateField.test(active.id||active.name||''))trackActivity('change',active.id||active.name||'field',{value:active.value});
},{capture:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flushActivity();});
