'use strict';
const main = document.getElementById('main'),
  noticeBox = document.getElementById('notice');
let apiKey = '',
  config = null,
  templates = [],
  stores = [];
let editorStoreId = null,
  copyTimer = null;
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
async function refresh() {
  stores = await request('stores');
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
    stores = await request('stores');
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
function render() {
  document.getElementById('logout').hidden = false;
  main.innerHTML = `<div class="card"><h2>1. Подключить Telegram</h2><p>Бот: @${escapeText(config.botUsername)}<br>Адрес: ${escapeText(config.publicOrigin)}</p><p>Кнопка устанавливает webhook, команды и меню вашего бота. Для новой фабрики используйте отдельного бота.</p><button class="primary" data-action="telegram">Настроить Telegram-бота</button></div>
 <form id="create-form" class="card"><h2>2. Создать магазин</h2><label for="new-template">Шаблон витрины</label><select id="new-template">${templates.map((t) => `<option value="${t.id}">${escapeText(t.title)}</option>`).join('')}</select><p id="template-description"></p><a id="template-preview" href="/templates/minimal" target="_blank" rel="noopener">Открыть предпросмотр шаблона ↗</a><label class="seed-choice"><input id="seed-products" type="checkbox" disabled> Добавить примерные товары</label><p>Примерные цены, остатки и иллюстрации замените перед активацией магазина.</p><label for="new-name">Название</label><input id="new-name" required maxlength="200" placeholder="Мой магазин"><label for="new-slug">Slug для ссылки</label><input id="new-slug" required maxlength="80" pattern="[a-z0-9][a-z0-9-]*" placeholder="my-store"><label for="new-description">Описание</label><textarea id="new-description" maxlength="2000"></textarea><label for="new-currency">Основная валюта</label><select id="new-currency">${['BYN', 'RUB', 'KZT', 'USD', 'EUR'].map((c) => `<option>${c}</option>`).join('')}</select><label for="new-accent">Основной цвет</label><input id="new-accent" type="color" value="#354f46"><button class="primary" type="submit" style="margin-top:16px">Создать демо</button><details><summary>Создать из готового JSON</summary><p>Если поле заполнено, используется JSON вместо полей выше. Формат соответствует API фабрики.</p><textarea id="new-json" aria-label="JSON магазина" placeholder="Вставьте JSON магазина"></textarea></details></form>
 <div id="copy-status" role="status"></div><h2>3. Магазины</h2><div id="store-list">${stores.map((s, i) => `<section class="card" data-store-id="${s.id}"><h3>${escapeText(s.name)}</h3><p>${s.status === 'demo' ? 'Демонстрация' : s.acceptingOrders ? 'Активный магазин' : 'Приём заказов приостановлен'} · ${s.ownerLinked ? 'Владелец подключён' : 'Владелец не подключён'}</p><p><a href="/${s.status === 'demo' ? 'demo' : 'shop'}/${escapeText(s.slug)}" target="_blank" rel="noopener">Открыть сайт</a></p><label for="owner-${i}">${s.ownerLinked ? 'Telegram ID нового владельца' : 'Числовой Telegram ID владельца'}</label><input id="owner-${i}" inputmode="numeric" placeholder="ID, который показал бот после /start"><button data-invite="${i}" style="margin-top:12px">${s.ownerLinked ? 'Передать магазин' : 'Создать приглашение'}</button><div id="invite-${i}"></div><div class="actions" style="margin-top:16px"><button class="primary" data-edit="${i}">Редактировать магазин</button><button data-copy="${i}">Копировать магазин</button>${s.status === 'demo' ? `<button class="primary" data-activate="${i}" ${s.ownerLinked ? '' : 'disabled'}>Активировать магазин</button>` : ''}${s.status === 'active' ? `<button data-intake="${i}">${s.acceptingOrders ? 'Приостановить заказы' : 'Возобновить заказы'}</button>` : `<button class="danger" data-delete-demo="${i}">Удалить демо</button>`}<button data-export="${i}">Экспорт JSON</button></div></section>`).join('') || '<p>Создайте первый магазин.</p>'}</div><button data-action="refresh">Обновить список</button>`;
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
    } else if (form.id === 'create-form') {
      const raw = document.getElementById('new-json').value.trim();
      const input = raw
        ? JSON.parse(raw)
        : {
            templateId: document.getElementById('new-template').value,
            seedProducts: document.getElementById('seed-products').checked,
            name: document.getElementById('new-name').value.trim(),
            slug: document.getElementById('new-slug').value.trim(),
            description: document.getElementById('new-description').value.trim(),
            accentColor: document.getElementById('new-accent').value,
            settings: { currencies: [document.getElementById('new-currency').value] },
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
    button.dataset.deleteDemo === undefined
  )
    return;
  button.disabled = true;
  notice('');
  try {
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

document.addEventListener('change', (event) => {
  if (event.target.id !== 'new-template') return;
  const t = templates.find((t) => t.id === event.target.value);
  document.getElementById('new-description').value = t.description;
  document.getElementById('new-accent').value = t.accentColor;
  document.getElementById('template-description').textContent =
    t.title +
    (t.productCount ? ' · ' + t.productCount + ' примерных товаров' : ' · пустой каталог');
  document.getElementById('template-preview').href = '/templates/' + t.id;
  document.getElementById('seed-products').checked = t.productCount > 0;
  document.getElementById('seed-products').disabled = !t.productCount;
});
