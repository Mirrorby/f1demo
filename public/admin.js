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
  main.innerHTML = `<section class="card hero-card"><span class="home-eyebrow">DELOKAY</span><h2>Создайте свой магазин</h2><p>Заполните данные, выберите оформление и добавьте товары вручную или одним файлом. До 3 демо на 7 дней.</p><button class="primary" data-tab="create">Создать магазин</button></section>`;
}
function supportButton(label = 'Написать в Delokay') {
  const url = 'https://t.me/Mirrorby';
  if (platformMode)
    return `<a class="primary support-link" href="${url}" target="_blank" rel="noopener"><span>${esc(label)}</span></a>`;
  return `<div class="support-contact"><button type="button" class="primary" data-support-contact><span>${esc(label)}</span></button><p class="support-result" role="status" hidden></p></div>`;
}
function launchOffer() {
  return `<section class="card launch-offer"><h2>Запустите свой магазин</h2><p>Настройте демо бесплатно: проверьте товары, фотографии и тексты.</p><p>24,99 USD в месяц за один активный сайт. Демо без активации живёт 7 дней. Оплатите через раздел «Оплата услуг»; активация после подтверждения оплаты.</p><button class="primary" data-tab="payments">Активировать сайт</button>${trialOffer()}${customOffer()}</section>`;
}

const siteLanguageNames = {
  ru: 'Русский',
  en: 'English',
  ro: 'Română',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  it: 'Italiano',
  tr: 'Türkçe',
  pl: 'Polski',
  ja: '日本語',
  de: 'Deutsch',
};
function languageOptions(selected = document.documentElement.lang || 'ru') {
  return Object.entries(siteLanguageNames)
    .map(
      ([code, name]) =>
        `<option value="${code}" ${code === selected ? 'selected' : ''}>${name}</option>`,
    )
    .join('');
}
function languagesField(languages = [], id = 'site-languages') {
  return `<fieldset id="${id}" class="language-choices"><legend>Языки сайта</legend><p>Основной язык включается автоматически. Выберите дополнительные языки.</p>${Object.entries(
    siteLanguageNames,
  )
    .map(
      ([code, name]) =>
        `<label><input type="checkbox" value="${code}" ${languages.includes(code) ? 'checked' : ''}> ${name}</label>`,
    )
    .join('')}</fieldset>`;
}
function chosenLanguages(id, primary) {
  return [
    ...new Set([
      primary,
      ...[...document.querySelectorAll('#' + id + ' input:checked')].map((el) => el.value),
    ]),
  ];
}
function storeTranslationFields(s) {
  const labels = {
    name: 'Название магазина',
    heroTitle: 'Заголовок витрины',
    description: 'Описание магазина',
    footerText: 'Текст внизу сайта',
    deliveryHint: 'Условия доставки',
  };
  const textLabels = {
    about_title: 'О магазине: заголовок',
    about_body: 'О магазине: текст',
    sizing_title: 'Выбор товара: заголовок',
    sizing_body: 'Выбор товара: текст',
    ordering_title: 'Заказ: заголовок',
    ordering_body: 'Заказ: текст',
    shipping_title: 'Доставка: заголовок',
    shipping_body: 'Доставка: текст',
    returns_title: 'Возврат: заголовок',
    returns_body: 'Возврат: текст',
    faq_title: 'Вопросы: заголовок',
    faq_1_question: 'Вопрос 1',
    faq_1_answer: 'Ответ 1',
    faq_2_question: 'Вопрос 2',
    faq_2_answer: 'Ответ 2',
    faq_3_question: 'Вопрос 3',
    faq_3_answer: 'Ответ 3',
  };
  return (s.languages || [s.language])
    .filter((code) => code !== s.language)
    .map((code) => {
      const tr = s.translations?.[code] || {};
      return `<details class="card" data-store-translation="${code}"><summary>Перевод сайта · ${siteLanguageNames[code]}</summary><p>Заполните перевод своих текстов. Пустые поля используют основной язык. Стандартные кнопки переводятся автоматически.</p>${Object.entries(
        labels,
      )
        .map(
          ([key, label]) =>
            `<label for="tr-store-${code}-${key}">${label}</label><textarea id="tr-store-${code}-${key}" data-translation-key="${key}">${esc(tr[key] || '')}</textarea>`,
        )
        .join(
          '',
        )}<label for="tr-store-${code}-deliveryMethods">Способы доставки: перевод по строкам в исходном порядке</label><textarea id="tr-store-${code}-deliveryMethods" data-translation-key="deliveryMethods">${esc((tr.deliveryMethods || []).join('\n'))}</textarea>${Object.entries(
        textLabels,
      )
        .map(
          ([key, label]) =>
            `<label for="tr-text-${code}-${key}">${label}</label><textarea id="tr-text-${code}-${key}" data-translation-text="${key}">${esc(tr.texts?.[key] || '')}</textarea>`,
        )
        .join('')}</details>`;
    })
    .join('');
}
function productTranslationFields(p) {
  return (store.settings.languages || [store.settings.language])
    .filter((code) => code !== store.settings.language)
    .map(
      (code) =>
        `<details class="card" data-product-translation="${code}"><summary>Перевод товара · ${siteLanguageNames[code]}</summary><p>Пустые поля используют основной язык.</p>${Object.entries(
          {
            name: 'Название',
            category: 'Категория',
            description: 'Описание',
            brand: 'Бренд',
            collection: 'Коллекция',
            color: 'Цвет',
          },
        )
          .map(
            ([key, label]) =>
              `<label>${label}<textarea data-translation-key="${key}">${esc(p.translations?.[code]?.[key] || '')}</textarea></label>`,
          )
          .join(
            '',
          )}<label>Характеристики: перевод, по одной на строке<textarea data-translation-key="attributes">${esc((p.translations?.[code]?.attributes || []).map((a) => a.label + ': ' + a.value).join('\n'))}</textarea></label>${(p.variants || []).map((v) => `<label>${esc(v.label)}<input data-translation-variant="${esc(v.id)}" value="${esc(p.translations?.[code]?.variantLabels?.[v.id] || '')}"></label>`).join('')}</details>`,
    )
    .join('');
}
function readTranslations(selector, previous = {}) {
  const result = { ...previous };
  for (const panel of document.querySelectorAll(selector)) {
    const code = panel.dataset.storeTranslation || panel.dataset.productTranslation;
    const tr = { ...result[code] };
    for (const el of panel.querySelectorAll('[data-translation-key]')) {
      const value = el.value.trim(),
        key = el.dataset.translationKey;
      if (value)
        tr[key] =
          key === 'deliveryMethods'
            ? value
                .split('\n')
                .map((x) => x.trim())
                .filter(Boolean)
            : key === 'attributes'
              ? value
                  .split('\n')
                  .filter((x) => x.trim())
                  .map((line) => {
                    const i = line.indexOf(':');
                    if (i < 1 || !line.slice(i + 1).trim())
                      throw new Error('Характеристики: используйте формат «Название: значение»');
                    return { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
                  })
              : value;
      else delete tr[key];
    }
    if (panel.querySelector('[data-translation-text]')) {
      tr.texts = { ...tr.texts };
      for (const el of panel.querySelectorAll('[data-translation-text]')) {
        if (el.value.trim()) tr.texts[el.dataset.translationText] = el.value.trim();
        else delete tr.texts[el.dataset.translationText];
      }
    }
    if (panel.querySelector('[data-translation-variant]')) {
      tr.variantLabels = {};
      for (const el of panel.querySelectorAll('[data-translation-variant]'))
        if (el.value.trim()) tr.variantLabels[el.dataset.translationVariant] = el.value.trim();
    }
    result[code] = tr;
  }
  return result;
}
function updateDemoSource() {
  const instagram = document.getElementById('demo-instagram');
  if (!instagram) return;
  const manual = !instagram.value.trim();
  document.getElementById('manual-demo-fields').hidden = !manual;
  document.getElementById('demo-name').required = manual;
  document.getElementById('demo-period-fields').hidden = manual;
}

let demoPollTimer = null,
  pendingDemoId = null;
function collectionNote(job) {
  if (job.status === 'ready' || job.status === 'failed') return '';
  const value = JSON.parse(job.collector_tasks || '[]').find((t) => t.kind === 'instagram')?.summary
    ?.collection;
  if (!value) return '';
  return (
    '<p>' +
    esc(
      value.phase === 'saving_photos'
        ? 'Сохраняем фотографии: ' + Number(value.files || 0)
        : 'Найдено фотопубликаций за период: ' + Number(value.posts || 0),
    ) +
    '</p>'
  );
}
function renderDemoJobs(jobs) {
  const target = document.getElementById('demo-jobs');
  if (!target) return;
  const labels = {
    preparing: 'Подготавливаем каталог',
    running: 'Собираем демо',
    awaiting_import: 'Ожидаем данные',
    ready: 'Демо готово',
    failed: 'Не удалось создать демо',
  };
  target.innerHTML =
    jobs
      .map(
        (j) =>
          '<div class="demo-job"><strong ' +
          (j.auto_build ? 'data-no-i18n' : '') +
          '>' +
          esc('Демо-каталог') +
          '</strong><p>' +
          esc(labels[j.status] || j.status) +
          (j.progress ? ' · ' + j.progress + '%' : '') +
          '</p>' +
          collectionNote(j) +
          (j.expires_at && j.status === 'ready'
            ? '<p>Без активации доступно до ' +
              esc(new Date(j.expires_at * 1000).toLocaleDateString()) +
              '</p>'
            : '') +
          (j.import_error
            ? '<p role="status">' + esc(j.import_error) + '</p>' + supportButton('Получить помощь')
            : '') +
          ((j.status === 'ready' || !j.auto_build) && j.slug
            ? '<div class="actions"><button data-open-demo="' +
              esc(j.store_id) +
              '">Открыть демо</button><a href="/s/' +
              esc(j.slug) +
              '" target="_blank" rel="noopener">Посмотреть сайт ↗</a></div>'
            : '') +
          '</div>',
      )
      .join('') || '<p>Здесь появятся готовые демо.</p>';
}
function scheduleDemoPoll(jobs) {
  clearTimeout(demoPollTimer);
  const pending = jobs.filter(
    (j) =>
      j.auto_build &&
      j.sample_content &&
      ['preparing', 'running', 'awaiting_import'].includes(j.status),
  );
  if (!pending.length || tab !== 'create') return;
  demoPollTimer = setTimeout(async () => {
    try {
      for (const job of pending) await api('demo-jobs/' + job.id + '/sync', 'POST', {});
      const fresh = await api('demo-jobs');
      if (tab !== 'create') return;
      renderDemoJobs(fresh);
      const ready = fresh.find((j) => j.id === pendingDemoId && j.status === 'ready');
      if (ready) {
        pendingDemoId = null;
        await openDemo(ready.store_id);
        notice('Демо готово. Добавьте товары и проверьте настройки.');
        return;
      }
      scheduleDemoPoll(fresh);
    } catch {
      if (tab === 'create') demoPollTimer = setTimeout(() => show('create'), 8000);
    }
  }, 2500);
}
async function showCreate(seq) {
  main.innerHTML = '<p>Загрузка…</p>';
  const [response, jobs] = await Promise.all([
    fetch('/api/templates?lang=' + encodeURIComponent(document.documentElement.lang || 'ru')),
    api('demo-jobs'),
  ]);
  if (!response.ok) throw new Error('Не удалось загрузить шаблоны');
  const templates = await response.json();
  if (seq !== generation) return;
  main.innerHTML = `<h2>Создать магазин${guideButton('create')}</h2><ol class="demo-steps"><li>Данные магазина</li><li>Оформление</li><li>Товары и запуск</li></ol>
<section class="card"><p>До трёх бесплатных демо на аккаунт. Без активации демо живёт 7 дней и затем удаляется.</p><p>24,99 USD в месяц за один активный сайт. Каждый дополнительный сайт оплачивается отдельно.</p><p>Один сайт можно активировать бесплатно на 14 дней — один раз на аккаунт, без карты и автоматического списания.</p></section>
<form id="demo-form"><section class="card"><h3>Данные магазина</h3><label for="demo-name">Название магазина</label><input id="demo-name" maxlength="200" required><label for="demo-description">Описание магазина</label><textarea id="demo-description" maxlength="2000"></textarea><label for="demo-logo">Ссылка на логотип</label><input id="demo-logo" type="url" placeholder="https://example.com/logo.png"><label for="demo-telegram">Telegram username без @</label><input id="demo-telegram" maxlength="64"><label for="demo-whatsapp">WhatsApp: номер с кодом страны, только цифры</label><input id="demo-whatsapp" maxlength="20">
<label for="demo-language">Основной язык сайта</label><select id="demo-language">${languageOptions()}</select>${languagesField([], 'demo-languages')}
<label for="demo-currency">Валюта</label><input id="demo-currency" value="USD" required maxlength="3" pattern="[A-Za-z]{3}"><p>Трёхбуквенный код, например USD, EUR, MDL или RON.</p></section>
<section class="card"><h3>Выберите оформление</h3><div class="demo-template-grid">${templates.map((t, i) => `<div class="demo-template-card"><label for="demo-template-${esc(t.id)}"><span class="demo-template-preview" aria-hidden="true"><iframe src="/templates/${esc(t.id)}?thumbnail=1&lang=${document.documentElement.lang || 'ru'}" title="${esc(t.title)}" loading="lazy" tabindex="-1" inert></iframe></span><span class="demo-template-choice"><input id="demo-template-${esc(t.id)}" type="radio" name="demo-template" value="${esc(t.id)}" ${i === 0 ? 'checked' : ''}> <span>${esc(t.title)}</span></span></label><p>${esc(t.description)}</p><a href="/templates/${esc(t.id)}" target="_blank" rel="noopener">Посмотреть пример ↗</a></div>`).join('')}</div></section><section class="card"><h3>Добавьте свои товары</h3><p>После создания откройте раздел «Товары». Добавляйте карточки вручную или скачайте шаблон CSV, заполните его и загрузите одним файлом.</p><label><input type="checkbox" id="demo-samples"> Добавить примерные товары для знакомства с оформлением</label><button class="primary" type="submit">Создать демо</button></section></form>
${customOffer()}<section class="card"><h3>Мои демо</h3><div id="demo-jobs"></div></section>`;
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
  notice(
    store.demoJob?.sample_content
      ? 'Демо создано. Добавьте свои товары вручную или импортируйте CSV. Примерные товары замените перед запуском.'
      : 'Добавьте товары вручную или импортируйте CSV в разделе «Товары».',
  );
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
  main.innerHTML = `<div class="row between page-heading"><div><h2>Оплата услуг</h2><p class="section-caption">Оплачивайте услуги и следите за статусом покупок в одном месте.</p></div></div><div class="card payment-intro"><h3>Один активный сайт · 24,99 USD в месяц${guideButton('activation')}</h3>${trialOffer()}<p>Каждый сайт оплачивается отдельно. После подтверждения оплаты выберите покупку ниже и активируйте текущий сайт на один месяц. Автоматическое списание не включено.</p>
    </div>${
      config.mode === 'digital'
        ? `<div class="card payment-offer"><h3>${esc(config.name || 'Создание сайта')}</h3>${config.configured ? `<p>${(config.amountMinor / 100).toFixed(2)} ${esc(String(config.currency).toUpperCase())}</p>` : ''}
    ${config.fulfillmentRequired ? '<p>Товар на заказ. Продавец отправит результат через Tribute после выполнения заказа и модерации.</p>' : ''}
    ${canOrder && config.paymentUrl ? paymentButton(config.paymentUrl, config.fulfillmentRequired ? 'Заказать через Tribute' : 'Оплатить через Tribute') : '<p>Оплата тарифа пока настраивается. Свяжитесь с Delokay.</p>' + supportButton('Уточнить оплату')}</div>`
        : ''
    }
    <h3 class="section-label">Мои покупки и счета</h3>${purchases.map((p) => `<div class="card payment-item"><h3 data-no-i18n>${esc(p.title)}</h3><p>${(p.amountMinor / 100).toFixed(2)} ${esc(p.currency.toUpperCase())}</p><span class="badge payment-badge">${esc(labels[p.status] || p.status)}</span>${p.paymentUrl && p.status === 'pending' ? paymentButton(p.paymentUrl, 'Оплатить через Tribute') : ''}</div>`).join('') || '<div class="card empty-panel"><p>Покупок и счетов пока нет.</p></div>'}
    ${
      store
        ? `<section class="card"><h3>Активировать текущий сайт</h3><p data-no-i18n>${esc(store.name)}</p><select id="paid-purchase">${purchases
            .filter(
              (p) =>
                p.status === 'paid' &&
                p.amountMinor === 2499 &&
                String(p.currency).toLowerCase() === 'usd' &&
                p.type === 'digital',
            )
            .map(
              (p) =>
                `<option value="${esc(p.id.replace('digital:', ''))}">${esc(p.title)} · №${esc(p.id.replace('digital:', ''))}</option>`,
            )
            .join(
              '',
            )}</select><button type="button" data-apply-purchase>Применить оплату к этому сайту</button><p>Одна покупка используется только для одного месяца одного сайта.</p></section>`
        : ''
    }${customOffer()}<button data-tab="payments">Обновить оплату</button>`;
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
  if (!r.ok) {
    trackActivity('error', path, {
      message: result.error || 'Не удалось выполнить запрос',
      status: String(r.status),
    });
    throw new Error(result.error || 'Не удалось выполнить запрос');
  }
  return result;
}
const base = () => `stores/${store.id}`;
const siteUrl = () => store.customUrl || location.origin + '/s/' + store.slug;
const shareUrl = () => store.shortUrl || '';
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
    ${importPanel()}<div class="product-toolbar"><label class="visually-hidden" for="product-search">Поиск товаров</label>
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
  rememberScreen({ kind: 'tab', tab: next, storeId: store?.id || null });
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
      if (seq !== generation) return;
      const sub = store.subscription;
      main.innerHTML =
        '<h2>Подписка</h2><section class="card">' +
        (store.trial?.active ? '<p>Бесплатный пробный период · 14 дней</p>' : '') +
        (sub
          ? '<p>Статус: ' +
            (sub.status === 'expired' ? 'срок закончился' : 'действует') +
            '</p><p>Действует до: ' +
            esc(new Date(sub.expires_at * 1000).toLocaleDateString()) +
            '</p><p>' +
            (store.notificationsAvailable ? 'Напомним о продлении за три дня.</p><p>' : '') +
            'Для продления откройте раздел оплаты.</p><button class="primary" data-tab="payments">Перейти к оплате</button>'
          : (store.status === 'demo'
              ? '<p>Вы можете активировать бесплатный триал или оплатить месяц в разделе оплаты.</p>'
              : '<p>Данные подписки пока не указаны. Свяжитесь с нами, чтобы уточнить условия.</p>') +
            supportButton(store.status === 'demo' ? 'Обсудить запуск' : 'Написать в Delokay')) +
        '</section>' +
        trialOffer();
    } else if (tab === 'more') {
      moreScreen();
    } else if (!store) {
      emptyStore();
    } else if (tab === 'home') {
      await reload();
      if (seq !== generation) return;
      main.innerHTML = `<section class="card hero-card">
      <span class="home-eyebrow">DELOKAY · КАТАЛОГИ</span>
      <h2>Всё под рукой</h2>${store.demoJob?.sample_content ? '<p>Тестовое демо: товары и цены примерные. Отредактируйте их перед запуском.</p>' : ''}${!platformMode ? '<button data-tab="create">Создать ещё магазин</button>' : ''}
      <p>Товары, заказы и ваш сайт в одном удобном месте. Изменения появляются на витрине сразу после сохранения.</p>${store.subscription ? `<p>Подписка ${store.subscription.status === 'expired' ? 'закончилась' : 'действует'} до ${new Date(store.subscription.expires_at * 1000).toLocaleDateString()}. Для продления откройте раздел оплаты.</p>` : store.status === 'demo' ? '<p>Пробная активация на 14 дней — один раз на аккаунт. Затем 24,99 USD в месяц за один активный сайт. Демо без активации хранится 7 дней.</p>' : '<p>Данные подписки пока не указаны. Свяжитесь с нами, чтобы уточнить условия.</p>'}
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
      if (store.status === 'demo' && !platformMode) main.innerHTML = launchOffer();
      else renderOrdersList();
    } else if (tab === 'settings') await renderSettings(seq);
    else if (tab === 'site')
      main.innerHTML = `<div class="row between page-heading"><div><h2>Мой сайт${guideButton('link')}</h2><p class="section-caption">Ссылка на витрину</p></div></div>
        <div class="card site-overview"><div class="row between"><h3 data-no-i18n>${esc(store.name)}</h3><span class="badge">${storeState()}</span></div>
        <p class="section-caption">${store.status === 'demo' ? 'Заказы отключены в демонстрационном режиме.' : 'Магазин готов делиться с клиентами.'}</p>
        <div class="site-link" data-no-i18n>${esc(shareUrl() || 'Нажмите «Получить короткую ссылку»')}</div>
        <div class="actions"><button class="primary" data-action="copy">${store.shortUrl ? 'Скопировать ссылку' : 'Получить короткую ссылку'}</button><a class="site-open-link" href="${esc(siteUrl())}" target="_blank" rel="noopener">Открыть витрину ↗</a></div></div>${store.status === 'demo' && !platformMode ? launchOffer() : ''}`;
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
  rememberScreen({ kind: 'product', index, tab: 'products', storeId: store?.id || null });
  edited = index === undefined ? null : products[index];
  photos = [...(edited?.photos || [])];
  const p = edited || {};
  main.innerHTML = `<div class="row between page-heading"><div><h2>${edited ? 'Редактировать товар' : 'Новый товар'}</h2><p class="section-caption">Цены, фото и варианты товара</p></div><button data-tab="products">Закрыть</button></div><form id="product-form"><div class="card"><h3 class="form-section-heading">Основные сведения</h3><div id="photos" class="photo-row"></div><label for="photo-upload">Фотографии (до 8)</label><input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple><label for="photo-url">Ссылка на фото</label><input id="photo-url" type="url" maxlength="1000" placeholder="https://example.com/photo.jpg"><button type="button" data-action="photo-link">Добавить фото по ссылке</button>${productTranslationFields(p)}${field('name', 'Название', p.name, 'text', true)}${field('category', 'Категория', p.category || 'Прочее', 'text', true)}<datalist id="categories">${[...new Set(products.map((p) => p.category))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist><label for="description">Описание</label><textarea id="description">${esc(p.description || '')}</textarea></div><div class="card"><h3 class="form-section-heading">Цены и остатки</h3>
 <label><input id="price-on-request" type="checkbox" ${p.priceOnRequest ? 'checked' : ''}> Цена по запросу</label>
 ${store.settings.currencies.map((c) => field('price-' + c, 'Цена, ' + c, (p.prices?.[c] ?? 0) / 100, 'number', true)).join('')}
 <div id="custom-price-fields"></div><label for="custom-price-code">Добавить свою валюту</label><input id="custom-price-code" maxlength="3" placeholder="MDL"><button type="button" data-action="add-price-currency">Добавить валюту</button><details><summary>Дополнительные валюты и характеристики</summary>${[
   ...new Set(['USD', 'EUR', 'BYN', 'RUB', 'KZT', 'MDL', 'RON', ...Object.keys(p.prices || {})]),
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
  main.innerHTML = `<h2>Настройки</h2><p class="section-caption">Управление магазином</p><form id="settings-form"><div class="card"><h3 class="form-section-heading">Сведения о магазине</h3>${field('store-title', 'Название магазина', store.name, 'text', true)}<label for="store-language">Язык сайта</label><select id="store-language">${languageOptions(s.language)}</select>${languagesField(s.languages || [s.language])}<p>Сохраните выбор языков, чтобы заполнить переводы ниже.</p><p>Язык интерфейса и стандартных текстов. Собственные названия и описания товаров редактируются отдельно.</p>${storeTranslationFields(s)}${field('hero-title', 'Заголовок витрины', s.heroTitle)}<label for="store-description">Описание магазина</label><textarea id="store-description">${esc(s.description)}</textarea></div><div class="card"><h3 class="form-section-heading">Оформление</h3><label for="theme">Шаблон витрины</label><select id="theme">${[
    ['minimal', 'Универсальный'],
    ['fashion', 'Одежда и аксессуары'],
    ['home', 'Дом и декор'],
    ['beauty', 'Косметика и уход'],
    ['food', 'Кофейня и пекарня'],
    ['flowers', 'Цветы и подарки'],
    ['tech', 'Электроника и аксессуары'],
  ]
    .map(
      ([k, label]) =>
        `<option value="${k}" ${k === (s.theme || 'minimal') ? 'selected' : ''}>${label}</option>`,
    )
    .join(
      '',
    )}</select><p>Меняет оформление. Товары и цены сохраняются; основной цвет и название вариантов можно настроить ниже.</p>${field('accent', 'Основной цвет', s.accentColor, 'color')}${field('logo', 'Ссылка на логотип', s.logo)}<label for="logo-upload">Загрузить логотип</label><input id="logo-upload" type="file" accept="image/jpeg,image/png,image/webp"><p>Логотип также используется как иконка вкладки магазина.</p></div>${backgroundEditors(s)}<div class="card"><h3 class="form-section-heading">Контакты</h3>${field('whatsapp', 'WhatsApp: номер с кодом страны, только цифры', s.whatsapp)}${field('telegram', 'Telegram username без @', s.telegram)}${platformMode ? field('instagram', 'Instagram username без @', s.instagram) : ''}</div><div class="card"><h3 class="form-section-heading">Доставка и оплата</h3><label for="currencies">Валюты (1 или 2, через запятую)</label><input id="currencies" value="${esc(s.currencies.join(', '))}" required><p>Любой трёхбуквенный код: USD, MDL, RON и другие. Перед включением новой валюты добавьте цены в карточках товаров.</p><label for="delivery">Способы доставки (по одному на строке)</label><textarea id="delivery" required>${esc(s.deliveryMethods.join('\n'))}</textarea><label for="delivery-hint">Условия доставки</label><textarea id="delivery-hint">${esc(s.deliveryHint)}</textarea>${field('footer', 'Текст внизу сайта', s.footerText)}<details><summary>Тексты кнопок и подписей</summary>${[
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
  rememberScreen({ kind: 'order', order: o, tab: 'orders', storeId: store?.id || null });
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
      const result = button.parentElement.querySelector('.support-result');
      button.disabled = true;
      let sent = false;
      try {
        await api('support-contact', 'POST', {});
        sent = true;
        result.textContent =
          window.DelokayI18n?.language && window.DelokayI18n.language !== 'ru'
            ? 'The contact was sent to the bot chat. Close this window to open it.'
            : 'Контакт отправлен в чат бота. Закройте это окно и нажмите кнопку в сообщении.';
      } catch (_) {
        result.textContent =
          window.DelokayI18n?.language && window.DelokayI18n.language !== 'ru'
            ? 'Could not send the contact. Find @Mirrorby in Telegram.'
            : 'Не удалось отправить контакт. Найдите @Mirrorby в поиске Telegram.';
      } finally {
        result.hidden = false;
        button.disabled = sent;
      }
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
    if (button.dataset.action === 'product-order') {
      renderProductOrder();
      return;
    }
    if (button.dataset.moveProduct) {
      const sortGeneration = ++generation;
      button.disabled = true;
      try {
        const ids = products.map((p) => p.id),
          from = ids.indexOf(button.dataset.moveProduct);
        const to =
          button.dataset.direction === 'first'
            ? 0
            : from + (button.dataset.direction === 'up' ? -1 : 1);
        if (from < 0 || to < 0 || to >= ids.length) return;
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        await api(base() + '/product-order', 'PUT', { version: store.version, ids });
        await reload();
        if (sortGeneration === generation) renderProductOrder();
      } finally {
        button.disabled = false;
      }
      return;
    }
    if (button.dataset.action === 'add-price-currency') {
      const code = document.getElementById('custom-price-code').value.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) throw new Error('Укажите трёхбуквенный код валюты');
      if (!document.getElementById('price-' + code))
        document
          .getElementById('custom-price-fields')
          .insertAdjacentHTML('beforeend', field('price-' + code, 'Цена, ' + code, '', 'number'));
      const priceInput = document.getElementById('price-' + code);
      priceInput.min = '0';
      priceInput.max = '1000000';
      priceInput.step = '0.01';
      priceInput.closest('details')?.setAttribute('open', '');
      priceInput.focus();
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
      const selectedId = store.id;
      button.disabled = true;
      try {
        const result = store.shortUrl
          ? { url: store.shortUrl }
          : await api(base() + '/short-link', 'POST', {});
        if (store.id !== selectedId) return;
        store.shortUrl = result.url;
        document.querySelector('.site-link').textContent = result.url;
        button.textContent = 'Скопировать ссылку';
        try {
          await navigator.clipboard.writeText(result.url);
        } catch {
          notice('Ссылка готова. Нажмите «Скопировать ссылку» ещё раз или скопируйте её вручную.');
          return;
        }
      } finally {
        button.disabled = false;
      }
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
  if (event.target.id === 'demo-instagram') updateDemoSource();
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
        requestId: form.dataset.requestId || (form.dataset.requestId = clientEventId()),
        name: val('demo-name'),
        description: val('demo-description'),
        logo: val('demo-logo'),
        telegram: val('demo-telegram'),
        whatsapp: val('demo-whatsapp'),
        languages: chosenLanguages('demo-languages', val('demo-language')),
        seedProducts: document.getElementById('demo-samples').checked,
        templateId: form.querySelector('[name=demo-template]:checked').value,
        language: val('demo-language'),
        currency: val('demo-currency').toUpperCase(),
      });
      pendingDemoId = result.job?.id;
      if (result.job?.status === 'ready' && result.job?.slug) await openDemo(result.job.store_id);
      else await show('create');
      return;
    }
    if (form.id === 'product-form') {
      const prices = {};
      for (const input of document.querySelectorAll('input[id^=price-]')) {
        if (!/^price-[A-Z]{3}$/.test(input.id)) continue;
        const c = input.id.slice(6),
          raw = input.value.trim();
        if (raw !== '') prices[c] = Math.round(Number(raw) * 100);
      }
      const data = {
        translations: readTranslations('[data-product-translation]', edited?.translations),
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
        languages: chosenLanguages('site-languages', val('store-language')),
        translations: readTranslations('[data-store-translation]', store.settings.translations),
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
        instagram: platformMode ? val('instagram') : store.settings.instagram || '',
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
    if (form.id === 'demo-form') button.textContent = 'Создать демо';
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
    if (!platformMode && ['payments', 'subscription'].includes(params.get('tab')))
      tab = params.get('tab');
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

const screenHistory = [];
let currentScreen = null,
  restoringScreen = false;
function rememberScreen(next) {
  if (restoringScreen) return;
  if (currentScreen?.storeId !== next.storeId) screenHistory.length = 0;
  if (currentScreen && JSON.stringify(currentScreen) !== JSON.stringify(next))
    screenHistory.push(currentScreen);
  if (screenHistory.length > 40) screenHistory.shift();
  currentScreen = next;
  if (screenHistory.length) tg?.BackButton?.show();
  else tg?.BackButton?.hide();
  trackActivity('screen', next.kind, { tab: next.tab });
}
async function goBack(trigger = 'back') {
  if (!screenHistory.length) return;
  if (
    document.querySelector('form[data-dirty="1"]') &&
    !confirm('Вернуться без сохранения изменений?')
  )
    return;
  const previous = screenHistory.pop();
  restoringScreen = true;
  try {
    if (previous.kind === 'product') editProduct(previous.index);
    else if (previous.kind === 'order') showOrder(previous.order);
    else if (previous.kind === 'sort') renderProductOrder();
    else await show(previous.tab);
    currentScreen = previous;
    trackActivity('screen', 'back', { tab: previous.tab, trigger });
  } finally {
    restoringScreen = false;
  }
  if (screenHistory.length) tg?.BackButton?.show();
  else tg?.BackButton?.hide();
}
tg?.BackButton?.onClick(() => {
  void goBack('telegram');
});
let edgeGesture = null;
document.addEventListener(
  'touchstart',
  (event) => {
    const t = event.touches[0];
    if (
      event.touches.length !== 1 ||
      t.clientX > 28 ||
      !screenHistory.length ||
      event.target.closest('input,textarea,select,[contenteditable],.photo-list,[data-gallery]')
    ) {
      edgeGesture = null;
      return;
    }
    edgeGesture = { x: t.clientX, y: t.clientY, time: Date.now() };
  },
  { passive: true },
);
document.addEventListener(
  'touchmove',
  (event) => {
    if (!edgeGesture) return;
    const t = event.touches[0];
    if (event.touches.length !== 1) {
      edgeGesture = null;
      return;
    }
    const dx = t.clientX - edgeGesture.x,
      dy = t.clientY - edgeGesture.y;
    if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) {
      edgeGesture = null;
      return;
    }
    if (dx > 15 && Math.abs(dy) < dx * 0.6) event.preventDefault();
  },
  { passive: false },
);
document.addEventListener(
  'touchend',
  (event) => {
    if (!edgeGesture) return;
    const start = edgeGesture;
    edgeGesture = null;
    const t = event.changedTouches[0];
    if (
      t.clientX - start.x >= 70 &&
      Math.abs(t.clientY - start.y) < 50 &&
      Date.now() - start.time < 900
    ) {
      event.preventDefault();
      void goBack('swipe');
    }
  },
  { passive: false },
);
function renderProductOrder() {
  generation++;
  rememberScreen({ kind: 'sort', tab: 'products', storeId: store?.id || null });
  main.innerHTML =
    '<h2>Порядок товаров</h2><p>Первый товар будет титульным в каталоге. Изменения сохраняются сразу.</p>' +
    products
      .map(
        (p, i) =>
          '<section class="card"><strong>' +
          esc(p.name) +
          '</strong>' +
          (i === 0 ? '<p>Титульный товар</p>' : '') +
          '<div class="actions"><button data-move-product="' +
          esc(p.id) +
          '" data-direction="first" ' +
          (i === 0 ? 'disabled' : '') +
          '>На первое место</button><button aria-label="Поднять товар" data-move-product="' +
          esc(p.id) +
          '" data-direction="up" ' +
          (i === 0 ? 'disabled' : '') +
          '>↑</button><button aria-label="Опустить товар" data-move-product="' +
          esc(p.id) +
          '" data-direction="down" ' +
          (i === products.length - 1 ? 'disabled' : '') +
          '>↓</button></div></section>',
      )
      .join('');
}

const activityQueue = [];
let activityTimer = null,
  activitySending = false;
const privateField =
  /password|passwd|secret|token|session|cookie|authorization|platform.?key|wallet|private.?key/i;
function clientEventId() {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    const s = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return (
      s.slice(0, 8) +
      '-' +
      s.slice(8, 12) +
      '-' +
      s.slice(12, 16) +
      '-' +
      s.slice(16, 20) +
      '-' +
      s.slice(20)
    );
  } catch {
    return null;
  }
}
function trackActivity(event, target, details = {}) {
  if (platformMode || !tg?.initData || privateField.test(target)) return;
  const clean = {};
  for (const [key, value] of Object.entries(details))
    if (!privateField.test(key)) clean[key] = String(value ?? '').slice(0, 5000);
  const id = clientEventId();
  if (!id) return;
  activityQueue.push({
    id,
    event,
    screen: typeof tab === 'string' ? tab : 'home',
    target: String(target).slice(0, 120),
    details: clean,
  });
  if (activityQueue.length > 200) activityQueue.shift();
  clearTimeout(activityTimer);
  activityTimer = setTimeout(() => {
    void flushActivity();
  }, 2000);
}
async function flushActivity() {
  if (activitySending || !activityQueue.length || !tg?.initData) return;
  activitySending = true;
  const batch = activityQueue.splice(0, 10);
  try {
    const r = await fetch('/api/admin/activity', {
      method: 'POST',
      headers: { Authorization: 'tma ' + tg.initData, 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (!r.ok && r.status !== 429) activityQueue.unshift(...batch);
  } catch {
    activityQueue.unshift(...batch);
  } finally {
    activitySending = false;
    if (activityQueue.length)
      activityTimer = setTimeout(() => {
        void flushActivity();
      }, 8000);
  }
}
document.addEventListener(
  'click',
  (event) => {
    const el = event.target.closest('button,a,input[type=radio],input[type=checkbox]');
    if (!el) return;
    const target =
      el.id || el.dataset.action || el.dataset.tab || el.name || el.textContent.trim().slice(0, 80);
    trackActivity('click', target, {
      label: el.textContent.trim().slice(0, 120),
      storeId: el.dataset.openDemo || store?.id || '',
      productId:
        el.dataset.moveProduct ||
        (el.dataset.edit !== undefined ? products[Number(el.dataset.edit)]?.id : '') ||
        '',
      direction: el.dataset.direction || '',
    });
  },
  { capture: true },
);
document.addEventListener(
  'input',
  (event) => {
    const form = event.target.closest('form');
    if (form) form.dataset.dirty = '1';
  },
  { capture: true },
);
document.addEventListener(
  'change',
  (event) => {
    const el = event.target;
    if (!el.matches('input,textarea,select') || ['password', 'hidden'].includes(el.type)) return;
    if (el.type === 'file') {
      trackActivity('change', el.id || el.name || 'upload', {
        files: JSON.stringify(
          [...el.files].map((f) => ({ name: f.name, size: f.size, type: f.type })),
        ),
      });
      return;
    }
    const target = el.id || el.name || 'field';
    if (privateField.test(target)) return;
    trackActivity('change', target, {
      value: el.type === 'checkbox' ? String(el.checked) : el.value,
    });
  },
  { capture: true },
);
document.addEventListener(
  'submit',
  (event) => {
    trackActivity('submit', event.target.id || 'form');
    const active = document.activeElement;
    if (
      active?.form === event.target &&
      !['password', 'hidden', 'file'].includes(active.type) &&
      !privateField.test(active.id || active.name || '')
    )
      trackActivity('change', active.id || active.name || 'field', { value: active.value });
  },
  { capture: true },
);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushActivity();
});

function customOffer() {
  return `<section class="card"><h3>Нужен другой шаблон или новая функция?</h3><p>Напишите нам в личные сообщения. Индивидуальные доработки оплачиваются отдельно; стоимость согласуем до начала работы.</p>${supportButton('Обсудить доработку')}</section>`;
}
function importPanel() {
  return `<section class="card"><h3>Все товары одним файлом${guideButton('import')}</h3><p>Скачайте шаблон, заполните своими товарами и загрузите CSV для проверки перед импортом.</p><p>Импорт добавляет товары к существующим. Максимум 500 товаров в каталоге. Примерную строку замените своими данными.</p><button type="button" data-csv-template>Скачать шаблон CSV</button><label for="catalog-csv">Загрузить заполненный CSV</label><input type="file" id="catalog-csv" accept=".csv,text/csv"><div id="csv-preview" role="status"></div><button type="button" data-csv-import hidden>Подтвердить импорт</button></section>`;
}
let importCandidate = null;
document.addEventListener('click', async (e) => {
  const button = e.target.closest('button');
  if (!button) return;
  try {
    if (button.hasAttribute('data-csv-template')) {
      const columns = [
        'Название',
        'Категория',
        'Описание',
        'Артикул',
        'Фото',
        'Варианты',
        'Наличие',
        ...store.settings.currencies.map((c) => 'Цена ' + c),
      ];
      const example = [
        'Замените своим товаром',
        'Категория',
        'Описание',
        'SKU-001',
        '',
        'Стандарт:10',
        'available',
        ...store.settings.currencies.map(() => '24.99'),
      ];
      const encode = (row) => row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(';');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(
        new Blob(['\uFEFF' + [columns, example].map(encode).join('\r\n')], {
          type: 'text/csv;charset=utf-8',
        }),
      );
      a.download = 'delokay-products.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    if (button.hasAttribute('data-csv-import') && importCandidate?.storeId === store.id) {
      button.disabled = true;
      const result = await api(base() + '/products-import', 'POST', {
        ...importCandidate,
        preview: false,
      });
      if (result.errors?.length)
        throw new Error(result.errors.map((x) => 'Строка ' + x.row + ': ' + x.message).join('\n'));
      importCandidate = null;
      await reload();
      await show('products');
      notice('Добавлено товаров: ' + result.imported);
    }
  } catch (err) {
    notice(err.message);
  } finally {
    button.disabled = false;
  }
});
document.addEventListener('change', async (e) => {
  if (e.target.id !== 'catalog-csv') return;
  const target = document.getElementById('csv-preview'),
    commit = document.querySelector('[data-csv-import]');
  commit.hidden = true;
  importCandidate = null;
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 480000) throw new Error('Файл должен быть меньше 480 КБ');
    const candidate = { csv: await file.text(), requestId: clientEventId(), storeId: store.id };
    target.textContent = 'Проверяем файл…';
    const result = await api(base() + '/products-import', 'POST', { ...candidate, preview: true });
    if (!document.contains(target) || store.id !== candidate.storeId) return;
    target.textContent = result.valid
      ? 'Товаров к добавлению: ' + result.count + '. Первые строки: ' + result.preview.join(', ')
      : result.errors.map((x) => 'Строка ' + x.row + ': ' + x.message).join('\n');
    if (result.valid) {
      importCandidate = candidate;
      commit.hidden = false;
    }
  } catch (err) {
    target.textContent = err.message;
  }
});
const guideCopy = {
  create:
    'Название, описание, контакты и оформление можно изменить после создания каталога. При смене шаблона ваши товары сохранятся.',
  import:
    'Сохраните файл как CSV UTF-8 и не меняйте заголовки. Цена — число, например 24.99. До 8 прямых HTTPS-ссылок на фото разделяйте знаком |. Варианты записывайте как S:5|M:10; пустой остаток означает отсутствие ограничения.',
  activation:
    'Если оплатить во время триала, оставшиеся дни сохранятся. При продлении действующей подписки оплаченный месяц добавляется к её дате окончания; после истечения — отсчитывается от момента активации оплаты.',
  link: 'Короткая ссылка сохраняется за каталогом и не меняется при редактировании товаров. После перехода браузер покажет исходный адрес Cloudflare — это ожидаемо для стороннего сокращателя.',
};
function guideButton(key) {
  const message = guideCopy[key];
  return message
    ? `<button type="button" class="help-trigger" data-guide-key="${key}" data-guide="${esc(message)}" aria-label="Подсказка">?</button>`
    : '';
}
document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-guide]');
  if (!button) return;
  e.preventDefault();
  const dialog = document.createElement('dialog');
  dialog.className = 'help-dialog';
  const text = document.createElement('p');
  text.textContent = button.dataset.guide;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Понятно';
  close.onclick = () => dialog.close();
  dialog.append(text, close);
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (button.isConnected) button.focus();
  });
  dialog.showModal();
});

document.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-apply-purchase]');
  if (!button) return;
  try {
    button.disabled = true;
    const purchaseId = document.getElementById('paid-purchase').value;
    if (!purchaseId) throw new Error('Сначала оплатите тариф и обновите список покупок.');
    await api(base() + '/activate-purchase', 'POST', { purchaseId });
    await reload();
    await show('home');
    notice('Сайт активирован. Срок действия указан в подписке.');
  } catch (err) {
    notice(err.message);
  } finally {
    button.disabled = false;
  }
});

function trialOffer() {
  if (platformMode || !store || store.status !== 'demo') return '';
  return store.trial?.available
    ? `<section class="card trial-offer"><h3>Попробуйте сайт в работе 14 дней бесплатно</h3><p>Включим приём заказов для этого сайта на 14 дней. Пробный период доступен один раз на аккаунт для одного сайта. Карта не нужна, автоматических списаний нет. После окончания приём заказов приостановится до оплаты; данные каталога сохранятся.</p><button class="primary" type="button" data-start-trial>Активировать бесплатно на 14 дней</button></section>`
    : `<p>Пробный период на этом аккаунте уже использован. Для активации ещё одного сайта выберите месячный тариф.</p>`;
}
document.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-start-trial]');
  if (!button) return;
  try {
    button.disabled = true;
    await api(base() + '/trial', 'POST', {});
    await reload();
    await show('subscription');
    notice('Пробный период активирован на 14 дней. Приём заказов включён.');
  } catch (err) {
    notice(err.message);
  } finally {
    button.disabled = false;
  }
});
