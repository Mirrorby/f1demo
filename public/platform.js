'use strict';
const main = document.getElementById('main'),
  noticeBox = document.getElementById('notice');
let apiKey = '',
  config = null,
  stores = [];
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
  render();
}
function render() {
  document.getElementById('logout').hidden = false;
  main.innerHTML = `<div class="card"><h2>1. Подключить Telegram</h2><p>Бот: @${escapeText(config.botUsername)}<br>Адрес: ${escapeText(config.publicOrigin)}</p><p>Кнопка устанавливает webhook, команды и меню вашего бота. Для новой фабрики используйте отдельного бота.</p><button class="primary" data-action="telegram">Настроить Telegram-бота</button></div>
 <form id="create-form" class="card"><h2>2. Создать магазин</h2><label for="new-name">Название</label><input id="new-name" required maxlength="200" placeholder="Мой магазин"><label for="new-slug">Slug для ссылки</label><input id="new-slug" required maxlength="80" pattern="[a-z0-9][a-z0-9-]*" placeholder="my-store"><label for="new-description">Описание</label><textarea id="new-description" maxlength="2000"></textarea><label for="new-currency">Основная валюта</label><select id="new-currency">${['BYN', 'RUB', 'KZT', 'USD', 'EUR'].map((c) => `<option>${c}</option>`).join('')}</select><label for="new-accent">Основной цвет</label><input id="new-accent" type="color" value="#e10600"><button class="primary" type="submit" style="margin-top:16px">Создать демо</button><details><summary>Создать из готового JSON</summary><p>Если поле заполнено, используется JSON вместо полей выше. Формат соответствует API фабрики.</p><textarea id="new-json" aria-label="JSON магазина" placeholder="Вставьте JSON магазина"></textarea></details></form>
 <h2>3. Подключить владельца и активировать</h2><div id="store-list">${stores.map((s, i) => `<section class="card"><h3>${escapeText(s.name)}</h3><p>${s.status === 'demo' ? 'Демонстрация' : 'Активный магазин'} · ${s.ownerLinked ? 'Владелец подключён' : 'Владелец не подключён'}</p><p><a href="/${s.status === 'demo' ? 'demo' : 'shop'}/${escapeText(s.slug)}" target="_blank" rel="noopener">Открыть сайт</a></p>${!s.ownerLinked ? `<label for="owner-${i}">Числовой Telegram ID владельца</label><input id="owner-${i}" inputmode="numeric" placeholder="ID, который показал бот после /start"><button data-invite="${i}" style="margin-top:12px">Создать приглашение</button><div id="invite-${i}"></div>` : ''}<div class="actions" style="margin-top:16px">${s.status === 'demo' ? `<button class="primary" data-activate="${i}" ${s.ownerLinked ? '' : 'disabled'}>Активировать магазин</button>` : ''}<button data-export="${i}">Экспорт JSON</button></div></section>`).join('') || '<p>Создайте первый магазин.</p>'}</div><button data-action="refresh">Обновить список</button>`;
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
      document.getElementById('platform-key').value = '';
      await refresh();
    } else if (form.id === 'create-form') {
      const raw = document.getElementById('new-json').value.trim();
      const input = raw
        ? JSON.parse(raw)
        : {
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
    button.dataset.export === undefined
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
      const result = await request(`stores/${s.id}/invite`, 'POST', { telegramUserId: id });
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
