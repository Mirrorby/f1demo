'use strict';
const main = document.getElementById('main'),
  noticeBox = document.getElementById('notice');
let apiKey = '',
  config = null,
  templates = [],
  stores = [],
  invoices = [],
  domains = [],
  domainSettings = null,
  paymentConfig = null;
let storeQuery = '';
let editorStoreId = null,
  copyTimer = null,
  templateEditor = null;
const escapeText = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function notice(message) {
  noticeBox.textContent = message;
  noticeBox.hidden = !message;
}
async function request(path, method = 'GET', body) {
  const r = await fetch('/api/platform/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + apiKey,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Не удалось выполнить запрос');
  return data;
}
async function loadStores() {
  const all = [];
  for (let offset = 0; ; offset += 200) {
    const page = await request('stores?offset=' + offset);
    all.push(...page);
    if (page.length < 200) return [...new Map(all.map((s) => [s.id, s])).values()];
  }
}
function filterStores() {
  const query = storeQuery.trim().toLowerCase().replace(/^@/, '');
  let count = 0;
  document.querySelectorAll('#store-list [data-store-id]').forEach((card) => {
    const store = stores.find((s) => s.id === card.dataset.storeId);
    card.hidden = ![store.name, store.slug, store.settings?.instagram]
      .join(' ')
      .toLowerCase()
      .includes(query);
    if (!card.hidden) count++;
  });
  document.getElementById('store-count').textContent = 'Найдено: ' + count + ' из ' + stores.length;
  document.getElementById('store-empty').hidden = count > 0 || !stores.length;
}
document.addEventListener('input', (event) => {
  if (event.target.id === 'reference-search') {
    const query = event.target.value.trim().toLowerCase();
    let count = 0;
    document.querySelectorAll('[data-reference-url]').forEach((card) => {
      card.hidden = !card.dataset.referenceUrl.toLowerCase().includes(query);
      if (!card.hidden) count++;
    });
    document.getElementById('reference-count').textContent = 'Найдено: ' + count;
    document.getElementById('reference-empty').hidden = count > 0;
    return;
  }
  if (event.target.id !== 'store-search') return;
  storeQuery = event.target.value;
  filterStores();
});
async function refresh() {
  [stores, invoices, domains, domainSettings] = await Promise.all([
    loadStores(),
    request('payments'),
    request('domains'),
    request('domains/config'),
  ]);
  try {
    paymentConfig = await request('payments/config');
  } catch (e) {
    paymentConfig = { configured: false, error: e.message };
  }
  if (!editorStoreId) render();
  await updateCopies();
}
async function updateCopies() {
  clearTimeout(copyTimer);
  const copies = await request('copies');
  const pending = copies.filter((job) => job.status === 'pending');
  if (
    !editorStoreId &&
    copies.some((job) => job.status === 'completed' && !stores.some((s) => s.id === job.targetId))
  ) {
    stores = await loadStores();
    render();
  }
  const box = document.getElementById('copy-status');
  if (box)
    box.innerHTML = copies
      .slice(0, 5)
      .map(
        (job) =>
          `<p>${escapeText(job.name)}: ${job.status === 'completed' ? 'Копия готова' : job.status === 'failed' ? escapeText(job.error) : `Копируем фото ${job.copied} / ${job.total}`}</p>`,
      )
      .join('');
  if (pending.length)
    copyTimer = setTimeout(async () => {
      try {
        await request('copies/' + pending[0].id + '/continue', 'POST', {});
        await updateCopies();
        const latest = await request('copies');
        if (!latest.some((job) => job.status === 'pending')) await refresh();
      } catch (e) {
        notice(e.message);
      }
    }, 2500);
}
window.addEventListener('message', (event) => {
  const frame = document.getElementById('store-editor');
  if (
    apiKey &&
    event.origin === location.origin &&
    event.source === frame?.contentWindow &&
    event.data?.type === 'catalog-editor-ready'
  )
    frame.contentWindow.postMessage({ type: 'catalog-platform-key', key: apiKey }, location.origin);
});

function digitalPaymentPanel() {
  if (paymentConfig?.mode !== 'digital') return '';
  const purchases = invoices.filter((p) => p.type === 'digital');
  return `<section class="card"><h2>Оплата через Tribute</h2>
    <p>${escapeText(paymentConfig.name || 'Товар для оплаты услуг')}</p>
    <p>${paymentConfig.configured ? (paymentConfig.active ? 'Товар доступен для оплаты' : paymentConfig.orderLinkAvailable ? 'Товар на заказ: доступность оформления и оплаты проверяется на странице Tribute.' : 'Товар пока не одобрен Tribute') : 'Добавьте TRIBUTE_API_KEY для проверки товара и подтверждения оплат.'}</p>
    ${paymentConfig.configured ? `<p>Оплата картами: ${paymentConfig.cardsEnabled ? 'включена' : 'не включена в настройках товара'}</p>` : ''}
    <p><a href="${escapeText(paymentConfig.paymentUrl)}" target="_blank" rel="noopener">Открыть товар Tribute ↗</a></p>
    <p>Клиент открывает товар командой /pay. Покупки учитываются по его Telegram ID при получении подтверждения Tribute.</p>
    ${paymentConfig.fulfillmentRequired ? '<p>Товар на заказ: выполните заказ и отправьте результат покупателю через @Tribute → «Ответить» → «Прикрепить» → «Отправить товар». Tribute проверит результат перед выдачей и выплатой. Подтверждение покупки не означает завершение заказа или выплату продавцу.</p>' : ''}
    ${purchases.map((p) => `<p>${escapeText(p.title)} · ${(p.amountMinor / 100).toFixed(2)} ${p.currency.toUpperCase()} · Telegram ID: ${escapeText(p.ownerId)} · ${p.status === 'paid' ? 'Оплачено' : 'Зарегистрирован возврат'}</p>`).join('') || '<p>Подтверждённых покупок пока нет.</p>'}
  </section>`;
}

function invoicePanel(s, i) {
  if (paymentConfig?.mode === 'digital')
    return '<p>Оплата услуг доступна клиенту в боте командой /pay.</p>';
  const rows = invoices.filter((x) => x.storeId === s.id);
  const labels = {
    creating: 'Создаётся',
    review: 'Нужна сверка в Tribute',
    pending: 'Ожидает оплаты',
    paid: 'Оплачено',
    refund_reported: 'Зарегистрирован возврат',
  };
  return `<details><summary>Оплата Tribute</summary>
    <p>${escapeText(paymentConfig?.error || (paymentConfig?.configured && paymentConfig?.active && paymentConfig?.cardsEnabled && paymentConfig?.callbackMatches ? 'Tribute подключён' : 'Настройте Tribute API-ключ, Shop ID и webhook перед выставлением счетов.'))}</p>
    <p>Webhook: ${escapeText(paymentConfig?.webhookUrl || config.publicOrigin + '/api/tribute/webhook')}</p>
    <p>Клиент найдёт счёт в боте командой /pay.</p>
    ${
      rows
        .map(
          (
            x,
          ) => `<p>${escapeText(x.title)} · ${(x.amountMinor / 100).toFixed(2)} ${x.currency.toUpperCase()} · ${labels[x.status] || escapeText(x.status)}
      ${x.paymentUrl && x.status === 'pending' ? `<a href="${escapeText(x.paymentUrl)}" target="_blank" rel="noopener">Открыть оплату ↗</a>` : ''}
      <button data-reconcile="${x.id}">Сверить с Tribute</button></p>`,
        )
        .join('') || '<p>Счетов пока нет.</p>'
    }
    <form id="invoice-form-${i}" data-invoice-store="${s.id}" class="card">
      <input type="hidden" name="invoiceId" value="${crypto.randomUUID()}">
      <label for="invoice-title-${i}">Название услуги для клиента</label><input id="invoice-title-${i}" name="title" required maxlength="100" value="Online store setup">
      <label for="invoice-description-${i}">Описание для клиента</label><textarea id="invoice-description-${i}" name="description" required maxlength="300">Setup of your online store with Telegram management.</textarea>
      <label for="invoice-amount-${i}">Сумма</label><input id="invoice-amount-${i}" name="amount" required inputmode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="100.00">
      <label for="invoice-currency-${i}">Валюта</label><select id="invoice-currency-${i}" name="currency"><option>EUR</option><option>USD</option><option>RUB</option></select>
      <button type="submit" ${s.ownerLinked ? '' : 'disabled'}>Создать счёт</button>
    </form></details>`;
}

function domainSetupPanel() {
  const d = domainSettings;
  return `<section class="card"><h2>Клиентские домены</h2><p>Подключайте личные домены в карточке нужного магазина ниже.</p>
    <details><summary>Первоначальная настройка Cloudflare</summary>
    <p>Один раз подключите свой основной домен к Cloudflare и включите Cloudflare for SaaS. Создайте проксируемый адрес для клиентских CNAME, настройте fallback origin и маршрут <code>*/* → catalog-factory</code> в этой отдельной зоне.</p>
    <p>${d.tokenConfigured ? 'API-токен подключён.' : 'API-токен пока не подключён. В Worker catalog-factory → Settings → Variables and Secrets добавьте секрет CUSTOM_DOMAINS_API_TOKEN с правами Zone Read, SSL and Certificates Edit и Workers Routes Read только для SaaS-зоны. Токен в эту панель вводить не нужно.'}</p>
    <form id="domain-config-form"><label for="domain-zone">Zone ID основного домена</label><input id="domain-zone" name="zoneId" value="${escapeText(d.zoneId)}" pattern="[a-f0-9]{32}" required>
    <label for="domain-target">CNAME-адрес для клиентских сайтов</label><input id="domain-target" name="cnameTarget" value="${escapeText(d.cnameTarget)}" placeholder="customers.your-domain.com" required>
    <div class="actions"><button class="primary" type="submit">Сохранить настройки доменов</button><button type="button" data-action="domain-config-check">Проверить настройку Cloudflare</button></div></form>
    <p>Для CNAME-адреса можно использовать проксируемую AAAA-запись <code>100::</code> как fallback origin. Маршрут <code>*/*</code> действует на всю выбранную зону, поэтому используйте отдельный домен Delokay.</p>
    </details></section>`;
}
function domainPanel(store, index) {
  const labels = {
    draft: 'Сохранён, не подключён',
    pending: 'Ожидает DNS / HTTPS',
    active: 'Подключён',
    error: 'Нужна настройка',
    disconnecting: 'Отключается',
  };
  const rows = domains.filter((d) => d.storeId === store.id);
  return `<details class="domain-panel"><summary>Клиентские домены (${rows.length})</summary>
    <p>Добавьте каждый адрес отдельно: например, www.shop.by и shop.by. Для корня домена нужен CNAME flattening / ALIAS у DNS-провайдера; если его нет, начните с www. Обычная A-запись на IP Cloudflare здесь не подходит.</p>
    ${rows
      .map(
        (
          d,
        ) => `<div class="card domain-row"><h4>${escapeText(d.hostname)}</h4><p>${labels[d.status] || escapeText(d.status)}${d.status === 'active' ? ` · <a href="${escapeText(d.url)}" target="_blank" rel="noopener">Открыть сайт ↗</a>` : ''}</p>
      <p>Домен Cloudflare: ${escapeText(d.hostnameStatus || 'не создан')} · HTTPS: ${escapeText(d.sslStatus || 'ожидает')}</p>
      ${d.error ? `<p class="domain-error">${escapeText(d.error)}</p>` : ''}
      ${d.checkedAt ? `<p>Проверено: ${escapeText(new Date(d.checkedAt * 1000).toLocaleString('ru-RU'))}</p>` : ''}
      <div class="domain-dns"><table><thead><tr><th>Тип</th><th>Имя</th><th>Значение</th></tr></thead><tbody>${d.dnsRecords.map((r) => `<tr><td>${escapeText(r.type)}</td><td><code>${escapeText(r.name)}</code></td><td><code>${escapeText(r.value)}</code><small>${escapeText(r.purpose)}</small></td></tr>`).join('')}</tbody></table></div>
      <p>Записи добавляются у DNS-провайдера клиента. Нажмите «Подключить / проверить», чтобы получить записи подтверждения домена и сертификата. Обновление DNS может занять время.</p>
      <div class="actions"><button type="button" data-domain-check="${d.id}" data-domain-store="${store.id}">Подключить / проверить</button><button type="button" class="danger" data-domain-remove="${d.id}" data-domain-store="${store.id}">Отключить домен</button></div></div>`,
      )
      .join('')}
    <form data-domain-store="${store.id}"><label for="domain-host-${index}">Домен клиента</label><input id="domain-host-${index}" name="hostname" placeholder="www.shop.by" maxlength="253" required><button type="submit">Добавить домен</button></form>
    <p>Товары и заказы останутся в этом магазине. Стандартная ссылка продолжит работать.</p></details>`;
}

function render() {
  document.getElementById('logout').hidden = false;
  templateEditor = null;
  main.innerHTML = `<section class="card"><h2>Паспорта лидов</h2><p>Действия клиентов, выбранные шаблоны и история подготовки демо.</p><button data-action="leads">Открыть лидов</button></section><section class="card"><h2>Референсы пользователей</h2><p>Сайты, добавленные при самостоятельном создании демо.</p><button data-action="references">Открыть базу референсов</button></section>${digitalPaymentPanel()}${domainSetupPanel()}<div class="card"><h2>1. Подключить Telegram</h2><p>Бот: @${escapeText(config.botUsername)}<br>Адрес: ${escapeText(config.publicOrigin)}</p><p>Кнопка устанавливает webhook, команды и меню вашего бота. Для новой фабрики используйте отдельного бота.</p><button class="primary" data-action="telegram">Настроить Telegram-бота</button></div>
 <form id="create-form" class="card"><h2>2. Создать магазин</h2><label for="new-template">Шаблон витрины</label><select id="new-template">${templates.map((t) => `<option value="${t.id}">${escapeText(t.title)}</option>`).join('')}</select><p id="template-description"></p><a id="template-preview" href="/templates/minimal" target="_blank" rel="noopener">Открыть предпросмотр шаблона ↗</a><label class="seed-choice"><input id="seed-products" type="checkbox" checked> Добавить примерные товары</label><p>Примерные цены, остатки и иллюстрации замените перед активацией магазина.</p><label for="new-name">Название</label><input id="new-name" required maxlength="200" placeholder="Мой магазин"><label for="new-slug">Slug для ссылки</label><input id="new-slug" required maxlength="80" pattern="[a-z0-9][a-z0-9-]*" placeholder="my-store"><label for="new-description">Описание</label><textarea id="new-description" maxlength="2000"></textarea><label for="new-language">Язык сайта</label><select id="new-language"><option value="ru">Русский</option><option value="en">English</option><option value="es">Español</option><option value="pt">Português</option><option value="fr">Français</option><option value="it">Italiano</option><option value="tr">Türkçe</option><option value="pl">Polski</option><option value="ja">日本語</option><option value="de">Deutsch</option></select><label for="new-currency">Основная валюта</label><select id="new-currency">${['BYN', 'RUB', 'KZT', 'USD', 'EUR'].map((c) => `<option>${c}</option>`).join('')}</select><label for="new-accent">Основной цвет</label><input id="new-accent" type="color" value="#354f46"><button class="primary" type="submit" style="margin-top:16px">Создать демо</button><details><summary>Создать из готового JSON</summary><p>Если поле заполнено, используется JSON вместо полей выше. Формат соответствует API фабрики.</p><textarea id="new-json" aria-label="JSON магазина" placeholder="Вставьте JSON магазина"></textarea></details></form>
 <section class="card"><h2>Фото примеров в шаблонах</h2><p>Загрузите главное фото или вставьте ссылку для каждого примерного товара. Оно появится в предпросмотре и в новых магазинах; существующие магазины сохранят свои фото.</p><div class="actions">${templates.map((t) => `<button data-template-edit="${t.id}">${escapeText(t.title)}</button>`).join('')}</div></section>
 <div id="copy-status" role="status"></div><h2>3. Магазины</h2><label for="store-search">Поиск по аккаунту или названию магазина</label><input id="store-search" type="search" placeholder="@аккаунт, название или адрес демо" value="${escapeText(storeQuery)}"><p id="store-count" role="status"></p><p id="store-empty" hidden>Магазины не найдены.</p><div id="store-list">${stores.map((s, i) => `<section class="card" data-store-id="${s.id}"><h3>${escapeText(s.name)}</h3>${s.settings?.instagram ? `<p>@${escapeText(s.settings.instagram)}</p>` : ''}<p>${s.status === 'demo' ? 'Демонстрация' : s.acceptingOrders ? 'Активный магазин' : 'Приём заказов приостановлен'} · ${s.ownerLinked ? 'Владелец подключён' : 'Владелец не подключён'}</p><p><a href="/${s.status === 'demo' ? 'demo' : 'shop'}/${escapeText(s.slug)}" target="_blank" rel="noopener">Открыть сайт</a></p>${s.shareUrl ? `<p>Ссылка для клиента:<br><a class="share-link" href="${escapeText(s.shareUrl)}" target="_blank" rel="noopener">${escapeText(s.shareUrl)}</a></p>` : ''}<label for="owner-${i}">${s.ownerLinked ? 'Telegram ID нового владельца' : 'Числовой Telegram ID владельца'}</label><input id="owner-${i}" inputmode="numeric" placeholder="ID, который показал бот после /start"><button data-invite="${i}" style="margin-top:12px">${s.ownerLinked ? 'Передать магазин' : 'Создать приглашение'}</button><div id="invite-${i}"></div><div class="actions" style="margin-top:16px"><button class="primary" data-edit="${i}">Редактировать магазин</button><button data-copy="${i}">Копировать магазин</button>${s.status === 'demo' ? `<button class="primary" data-activate="${i}" ${s.ownerLinked ? '' : 'disabled'}>Активировать магазин</button>` : ''}${s.status === 'active' ? `<button data-intake="${i}">${s.acceptingOrders ? 'Приостановить заказы' : 'Возобновить заказы'}</button>` : `<button class="danger" data-delete-demo="${i}">Удалить демо</button>`}<button data-export="${i}">Экспорт JSON</button></div>${invoicePanel(s, i)}${domainPanel(s, i)}</section>`).join('') || '<p>Создайте первый магазин.</p>'}</div><button data-action="refresh">Обновить список</button>`;
  filterStores();
  document.getElementById('new-template').dispatchEvent(new Event('change', { bubbles: true }));
}
document.getElementById('logout').addEventListener('click', () => {
  apiKey = '';
  location.reload();
});
document.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target,
    button = form.querySelector('[type="submit"]');
  button.disabled = true;
  notice('');
  try {
    if (form.id === 'login-form') {
      apiKey = document.getElementById('platform-key').value.trim();
      config = await request('config');
      const templateResponse = await fetch('/api/templates');
      if (!templateResponse.ok) throw new Error('Не удалось загрузить шаблоны');
      templates = await templateResponse.json();
      document.getElementById('platform-key').value = '';
      await refresh();
    } else if (form.id === 'domain-config-form') {
      await request('domains/config', 'PUT', {
        version: domainSettings.version,
        zoneId: form.elements.zoneId.value.trim(),
        cnameTarget: form.elements.cnameTarget.value.trim(),
      });
      await refresh();
      notice('Настройки доменов сохранены. Нажмите «Проверить настройку Cloudflare».');
    } else if (form.dataset.domainStore) {
      await request('stores/' + form.dataset.domainStore + '/domains', 'POST', {
        hostname: form.elements.hostname.value.trim(),
      });
      await refresh();
      notice(
        'Домен добавлен. Откройте «Клиентские домены» у магазина, нажмите «Подключить / проверить» и добавьте DNS-записи.',
      );
    } else if (form.id === 'template-photos-form') {
      const photos = {};
      for (const input of form.querySelectorAll('[data-template-url]')) {
        const value = input.value.trim();
        if (value) photos[input.dataset.templateUrl] = value;
      }
      await request('templates/' + templateEditor.id, 'PUT', {
        version: templateEditor.version,
        photos,
      });
      await refresh();
      notice('Фото шаблона сохранены. Они используются в новых магазинах.');
    } else if (form.dataset.invoiceStore) {
      const rawAmount = form.elements.amount.value.trim().replace(',', '.');
      if (!/^\d+(\.\d{1,2})?$/.test(rawAmount))
        throw new Error('Введите сумму с точностью до двух знаков');
      const [whole, fraction = ''] = rawAmount.split('.');
      const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
      if (!Number.isSafeInteger(amountMinor)) throw new Error('Некорректная сумма');
      const result = await request('stores/' + form.dataset.invoiceStore + '/invoices', 'POST', {
        id: form.elements.invoiceId.value,
        amountMinor,
        currency: form.elements.currency.value,
        title: form.elements.title.value,
        description: form.elements.description.value,
      });
      await refresh();
      notice('Счёт создан. Клиент может открыть его командой /pay. Номер: ' + result.id);
    } else if (form.id === 'create-form') {
      const raw = document.getElementById('new-json').value.trim();
      const input = raw
        ? JSON.parse(raw)
        : {
            templateId: document.getElementById('new-template').value,
            seedProducts: document.getElementById('seed-products').checked,
            name: document.getElementById('new-name').value.trim(),
            slug: document.getElementById('new-slug').value.trim(),
            description: (() => {
              const field = document.getElementById('new-description');
              return !field.value.trim() || field.value === field.dataset.defaultValue
                ? undefined
                : field.value.trim();
            })(),
            accentColor: document.getElementById('new-accent').value,
            settings: {
              language: document.getElementById('new-language').value,
              currencies: [document.getElementById('new-currency').value],
            },
          };
      const result = await request('stores', 'POST', input);
      await refresh();
      notice('Демонстрация создана: ' + result.url);
    }
  } catch (e) {
    if (form.id === 'login-form') apiKey = '';
    notice(e.message);
  } finally {
    button.disabled = false;
  }
});
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (
    !button.dataset.action &&
    button.dataset.invite === undefined &&
    button.dataset.activate === undefined &&
    button.dataset.export === undefined &&
    button.dataset.edit === undefined &&
    button.dataset.copy === undefined &&
    button.dataset.intake === undefined &&
    button.dataset.reconcile === undefined &&
    button.dataset.deleteDemo === undefined &&
    button.dataset.templateEdit === undefined &&
    button.dataset.templateReset === undefined &&
    button.dataset.domainCheck === undefined &&
    button.dataset.domainRemove === undefined
  )
    return;
  button.disabled = true;
  notice('');
  try {
    if(button.dataset.action==='leads'){
      const leads=await request('leads');
      main.innerHTML='<button data-action="back">← Все магазины</button><h2>Лиды</h2>'+leads.map(l=>'<section class="card"><h3>'+escapeText(l.first_name||l.username||l.owner_id)+'</h3><p>'+escapeText(l.instagram?'@'+l.instagram:'Telegram: '+l.owner_id)+' · Событий: '+l.event_count+'</p><button data-action="lead" data-owner="'+escapeText(l.owner_id)+'">Открыть паспорт</button></section>').join('');
      return;
    }
    if(button.dataset.action==='lead'){
      const lead=await request('leads/'+button.dataset.owner+'?offset='+(button.dataset.offset||0));
      main.innerHTML='<button data-action="leads">← К лидам</button><h2>'+escapeText(lead.profile?.first_name||lead.ownerId)+'</h2><p>Telegram: '+escapeText(lead.profile?.username?'@'+lead.profile.username:lead.ownerId)+'</p><h3>Демо</h3>'+lead.demos.map(d=>'<section class="card"><strong>@'+escapeText(d.instagram)+'</strong><p>'+escapeText(d.template_id)+' · '+escapeText(d.status)+'</p>'+(d.import_error?'<p>'+escapeText(d.import_error)+'</p>':'')+'</section>').join('')+'<h3>Удалённые демо — статистика</h3>'+(lead.expiredDemos||[]).map(d=>'<section class="card"><p>'+escapeText(d.template_id)+' · '+escapeText(d.outcome)+' · Товаров: '+Number(d.products)+'</p><p>'+new Date(d.expired_at*1000).toLocaleString()+'</p></section>').join('')+'<h3>История действий</h3>'+lead.events.map(e=>'<section class="card"><p>'+new Date(e.created_at*1000).toLocaleString()+' · '+escapeText(e.screen)+'</p><strong>'+escapeText(e.event)+' · '+escapeText(e.target)+'</strong><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+escapeText(JSON.stringify(JSON.parse(e.details),null,2))+'</pre></section>').join('')+(lead.nextOffset!==null?'<button data-action="lead" data-owner="'+escapeText(lead.ownerId)+'" data-offset="'+lead.nextOffset+'">Предыдущие события</button>':'');
      return;
    }
    if (button.dataset.action === 'references') {
      const refs = await request('references');
      const labels = { reference: 'Добавлен', preparing: 'Изучается', available: 'Готов' };
      main.innerHTML = `<button data-action="back">← Все магазины</button><h2>Референсы пользователей</h2><p>Общая база ссылок. Сохранённый референс ещё не является готовым шаблоном. Показаны до 200 последних записей.</p><label for="reference-search">Найти сайт</label><input id="reference-search" type="search" placeholder="Домен или часть ссылки"><p id="reference-count" role="status">Найдено: ${refs.length}</p>${refs.map((r) => `<section class="card" data-reference-url="${escapeText(r.url)}"><a href="${escapeText(r.url)}" target="_blank" rel="noopener noreferrer">${escapeText(r.url)}</a><p>Статус: ${escapeText(labels[r.status] || r.status)} · Использований: ${Number(r.uses) || 0}</p></section>`).join('')}<p id="reference-empty" ${refs.length ? 'hidden' : ''}>Референсы не найдены.</p>`;
      return;
    }

    if (button.dataset.action === 'domain-config-check') {
      await request('domains/config/check', 'POST', {});
      notice('Cloudflare настроен: зона, fallback origin и маршрут Worker готовы.');
    }
    if (button.dataset.domainCheck !== undefined) {
      const result = await request(
        'stores/' +
          button.dataset.domainStore +
          '/domains/' +
          button.dataset.domainCheck +
          '/check',
        'POST',
        {},
      );
      const checked = result.find((d) => d.id === button.dataset.domainCheck);
      await refresh();
      notice(
        checked.status === 'active'
          ? 'Домен подключён. Сайт доступен по личному адресу.'
          : checked.error || 'Домен ожидает настройки DNS и HTTPS.',
      );
    }
    if (button.dataset.domainRemove !== undefined) {
      const domain = domains.find((d) => d.id === button.dataset.domainRemove);
      if (
        !confirm(
          'Отключить ' +
            domain.hostname +
            '? Сайт по этому адресу перестанет открываться. Магазин и стандартная ссылка сохранятся.',
        )
      )
        return;
      await request('stores/' + domain.storeId + '/domains/' + domain.id, 'DELETE');
      await refresh();
      notice('Домен отключён. DNS-записи у регистратора можно удалить.');
    }
    if (button.dataset.reconcile !== undefined) {
      const invoice = invoices.find((x) => x.id === button.dataset.reconcile);
      if (!invoice) throw new Error('Обновите список счетов');
      const remoteUuid = prompt(
        'UUID счёта из кабинета Tribute (для проверки после обрыва соединения):',
      );
      if (!remoteUuid) return;
      await request('invoices/' + invoice.id + '/reconcile', 'POST', {
        remoteUuid: remoteUuid.trim(),
      });
      await refresh();
      notice('Статус счёта обновлён.');
    }
    if (button.dataset.action === 'telegram') {
      await request('telegram/setup', 'POST', {});
      notice('Бот настроен. Отправьте ему /start, чтобы узнать Telegram ID.');
    }
    if (button.dataset.action === 'refresh') await refresh();
    if (button.dataset.invite !== undefined) {
      const i = Number(button.dataset.invite),
        s = stores[i],
        id = document.getElementById('owner-' + i).value.trim();
      if (!/^[1-9]\d{0,15}$/.test(id)) throw new Error('Введите числовой Telegram ID');
      if (
        s.ownerLinked &&
        !confirm(
          'Передать магазин новому владельцу? Он получит доступ к каталогу и всей истории заказов после принятия приглашения. Прежний владелец потеряет доступ.',
        )
      )
        return;
      const result = await request(`stores/${s.id}/invite`, 'POST', {
        telegramUserId: id,
        transfer: s.ownerLinked,
      });
      const box = document.getElementById('invite-' + i);
      box.replaceChildren();
      const p = document.createElement('p');
      p.textContent = 'Ссылка действует 24 часа. Откройте её в аккаунте указанного владельца:';
      const a = document.createElement('a');
      a.href = result.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = result.url;
      box.append(p, a);
    }
    if (button.dataset.activate !== undefined) {
      const s = stores[Number(button.dataset.activate)];
      if (!confirm('Включить реальные заказы в магазине «' + s.name + '»?')) return;
      const result = await request(`stores/${s.id}/activate`, 'POST', {});
      await refresh();
      notice('Магазин активирован: ' + result.url);
    }
    if (button.dataset.edit !== undefined) {
      const s = stores[Number(button.dataset.edit)];
      editorStoreId = s.id;
      main.innerHTML = `<button data-action="back">← Все магазины</button><iframe id="store-editor" title="Редактор магазина" src="/platform/editor?store=${s.id}" style="display:block;width:100%;height:1000px;border:0;margin-top:16px;border-radius:16px"></iframe>`;
    }
    if (button.dataset.templateEdit !== undefined) {
      clearTimeout(copyTimer);
      templateEditor = await request('templates/' + button.dataset.templateEdit);
      renderTemplateEditor();
    }
    if (button.dataset.templateReset !== undefined) {
      const index = Number(button.dataset.templateReset);
      delete templateEditor.photos[index];
      renderTemplateEditor();
    }
    if (button.dataset.action === 'back') {
      editorStoreId = null;
      await refresh();
    }
    if (button.dataset.copy !== undefined) {
      const s = stores[Number(button.dataset.copy)];
      const name = prompt('Название нового магазина', s.name + ' — копия');
      if (!name) return;
      const slug = prompt(
        'Slug нового магазина: латиница, цифры и дефисы',
        s.slug.slice(0, 65) + '-copy',
      );
      if (!slug) return;
      await request(`stores/${s.id}/copy`, 'POST', { name, slug });
      await refresh();
      notice('Копирование началось. Новый магазин появится как демо без владельца и заказов.');
    }
    if (button.dataset.intake !== undefined) {
      const s = stores[Number(button.dataset.intake)];
      if (
        !confirm(
          s.acceptingOrders
            ? 'Приостановить новые заказы? Каталог и существующие заказы останутся доступны.'
            : 'Возобновить приём заказов?',
        )
      )
        return;
      await request(`stores/${s.id}/intake`, 'POST', {
        enabled: !s.acceptingOrders,
        version: s.version,
      });
      await refresh();
      notice('Состояние приёма заказов сохранено');
    }
    if (button.dataset.deleteDemo !== undefined) {
      const s = stores[Number(button.dataset.deleteDemo)];
      const confirmSlug = prompt(
        'Удалить демо вместе с товарами и фотографиями? Для подтверждения введите: ' + s.slug,
      );
      if (confirmSlug === null) return;
      await request(`stores/${s.id}/delete-demo`, 'POST', { confirmSlug, version: s.version });
      await refresh();
      notice('Демо удалено');
    }
    if (button.dataset.export !== undefined) {
      const s = stores[Number(button.dataset.export)],
        data = await request(`stores/${s.id}/export`);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = s.slug + '-export.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    notice(e.message);
  } finally {
    button.disabled = false;
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'new-json') {
    const useJson = !!event.target.value.trim();
    document.getElementById('new-name').required = !useJson;
    document.getElementById('new-slug').required = !useJson;
  }
});

function renderTemplateEditor() {
  main.innerHTML = `<button data-action="back">← Все магазины</button><form id="template-photos-form" class="card"><h2>Фото шаблона: ${escapeText(templateEditor.title)}</h2><p>По одному главному фото на товар. JPEG, PNG или WebP, до 3 МБ. Можно загрузить файл или вставить прямую HTTPS-ссылку на фото. После изменения нажмите «Сохранить фото шаблона».</p><div class="template-photo-grid">${templateEditor.products.map((p, i) => `<div class="card"><img class="template-photo" src="${escapeText(templateEditor.photos[i] || p.defaultPhoto)}" alt="${escapeText(p.name)}"><h3>${escapeText(p.name)}</h3><p>${escapeText(p.description)}</p><label for="template-url-${i}">Ссылка на фото</label><input id="template-url-${i}" data-template-url="${i}" maxlength="1000" placeholder="https://example.com/photo.jpg" value="${escapeText(templateEditor.photos[i] || '')}"><label for="template-photo-${i}">Фото товара</label><input id="template-photo-${i}" data-template-photo="${i}" type="file" accept="image/jpeg,image/png,image/webp">${templateEditor.photos[i] ? `<button type="button" data-template-reset="${i}">Вернуть иллюстрацию</button>` : ''}</div>`).join('')}</div><button class="primary" type="submit">Сохранить фото шаблона</button></form>`;
}
document.addEventListener('change', async (event) => {
  const input = event.target;
  if (input.dataset.templateUrl !== undefined) {
    const index = Number(input.dataset.templateUrl);
    const value = input.value.trim();
    if (value && value !== templateEditor.photos[index]) {
      let url;
      try {
        url = new URL(value);
      } catch {
        notice('Укажите прямую HTTPS-ссылку на фото');
        return;
      }
      if (url.protocol !== 'https:' || url.username || url.password) {
        notice('Укажите прямую HTTPS-ссылку на фото');
        return;
      }
    }
    if (value) templateEditor.photos[index] = value;
    else delete templateEditor.photos[index];
    input.closest('.card').querySelector('img').src =
      value || templateEditor.products[index].defaultPhoto;
    return;
  }
  if (input.dataset.templatePhoto !== undefined) {
    const file = input.files[0];
    if (!file) return;
    const current = templateEditor;
    const index = Number(input.dataset.templatePhoto);
    const controls = [
      ...document.querySelectorAll('#template-photos-form input, #template-photos-form button'),
    ];
    controls.forEach((control) => {
      control.disabled = true;
    });
    try {
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 3 * 1024 * 1024
      )
        throw new Error('Загрузите JPEG, PNG или WebP размером до 3 МБ');
      const r = await fetch('/api/platform/templates/' + current.id + '/images', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': file.type },
        body: file,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Не удалось загрузить фото');
      if (templateEditor !== current) return;
      current.photos[index] = data.url;
      renderTemplateEditor();
      notice('Фото загружено. Сохраните фото шаблона.');
    } catch (e) {
      notice(e.message);
    } finally {
      controls.forEach((control) => {
        control.disabled = false;
      });
    }
    return;
  }
  if (!['new-template', 'new-language'].includes(event.target.id)) return;
  const t = templates.find((t) => t.id === document.getElementById('new-template').value);
  const language = document.getElementById('new-language').value;
  const description = document.getElementById('new-description');
  if (event.target.id === 'new-template')
    document.getElementById('new-accent').value = t.accentColor;
  document.getElementById('template-description').textContent =
    t.title +
    (t.productCount ? ' · ' + t.productCount + ' примерных товаров' : ' · пустой каталог');
  document.getElementById('template-preview').href = '/templates/' + t.id + '?lang=' + language;
  if (event.target.id === 'new-template')
    document.getElementById('seed-products').checked = t.productCount > 0;
  document.getElementById('seed-products').disabled = !t.productCount;
  try {
    const response = await fetch('/api/templates/' + t.id + '?lang=' + language);
    const preview = await response.json();
    if (
      document.getElementById('new-template')?.value !== t.id ||
      document.getElementById('new-language')?.value !== language
    )
      return;
    if (!description.value || description.value === description.dataset.defaultValue)
      description.value = preview.store.settings.description;
    description.dataset.defaultValue = preview.store.settings.description;
  } catch {
    if (!description.value) description.value = t.description;
  }
});
