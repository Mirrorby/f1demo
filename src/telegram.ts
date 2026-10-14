import { paymentMenu } from './tribute';
import { digest, equalSecret } from './auth';
import { stmt, ownedStore, storeMutationGuard } from './catalog';
import { changeStatus } from './orders';
import type { OrderRow, StoreRow, OrderItem, Customer } from './types';
import { object, requireThat, text } from './validation';
export async function telegram(env: Env, method: string, payload: unknown) {
  requireThat(env.TELEGRAM_BOT_TOKEN, 'Telegram не настроен', 503);
  const result = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await result.json()) as { ok: boolean; result?: unknown };
  requireThat(result.ok && data.ok, 'Не удалось выполнить запрос Telegram', 502);
  return data;
}
export function origin(env: Env): string {
  const u = new URL(env.PUBLIC_ORIGIN);
  requireThat(
    u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1',
    'Настройте PUBLIC_ORIGIN',
    503,
  );
  return u.origin;
}
export async function inviteOwner(env: Env, s: StoreRow, input: unknown) {
  const d = object(input);
  requireThat(!s.owner_id || d.transfer === true, 'Для смены владельца подтвердите передачу', 409);
  const owner = text(d.telegramUserId, 20, true);
  requireThat(/^[1-9]\d{0,15}$/.test(owner), 'Укажите Telegram ID владельца');
  requireThat(owner !== s.owner_id, 'Этот аккаунт уже владеет магазином', 409);
  requireThat(/^[a-z0-9_]{5,32}$/i.test(env.BOT_USERNAME), 'Настройте BOT_USERNAME', 503);
  const token =
    crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const hash = await digest(token);
  await env.DB.batch([
    storeMutationGuard(env, s),
    stmt(env, 'DELETE FROM owner_invites WHERE store_id=? AND used_at IS NULL', s.id),
    stmt(
      env,
      'INSERT INTO owner_invites(token_hash,store_id,expected_owner_id,source_owner_id,store_version,expires_at) SELECT ?,id,?,owner_id,version,unixepoch()+86400 FROM stores WHERE id=? AND version=?',
      hash,
      owner,
      s.id,
      s.version,
    ),
    stmt(env, 'DELETE FROM mutation_guards'),
  ]);
  return { url: `https://t.me/${env.BOT_USERNAME}?start=claim_${token}`, expiresIn: 86400 };
}
async function claim(env: Env, token: string, user: string) {
  const hash = await digest(token);
  const result = await stmt(
    env,
    'UPDATE stores SET owner_id=?,version=version+1 WHERE EXISTS(SELECT 1 FROM owner_invites i WHERE i.store_id=stores.id AND i.token_hash=? AND i.expected_owner_id=? AND i.expires_at>unixepoch() AND i.used_at IS NULL AND stores.owner_id IS i.source_owner_id AND (i.store_version IS NULL OR stores.version=i.store_version)) RETURNING *',
    user,
    hash,
    user,
  ).first<StoreRow>();
  requireThat(result, 'Приглашение недействительно, истекло или создано для другого аккаунта', 403);
  await stmt(env, 'UPDATE owner_invites SET used_at=unixepoch() WHERE token_hash=?', hash).run();
  return result;
}
async function menu(env: Env, user: string) {
  const stores = await stmt(
    env,
    'SELECT * FROM stores WHERE owner_id=? ORDER BY created_at LIMIT 20',
    user,
  ).all<StoreRow>();
  if (!stores.results.length) {
    await telegram(env, 'sendMessage', {
      chat_id: user,
      text:
        'Ваш Telegram ID: ' +
        user +
        '\nПопросите разработчика прислать персональную ссылку подключения магазина.',
    });
    return;
  }
  for (const s of stores.results) {
    await telegram(env, 'sendMessage', {
      chat_id: user,
      text: s.name + '\n' + origin(env) + `/${s.status === 'demo' ? 'demo' : 'shop'}/${s.slug}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Управлять магазином', web_app: { url: origin(env) + `/admin?store=${s.id}` } }],
          [{ text: 'Оплата / Payments', url: `https://t.me/${env.BOT_USERNAME}?start=payments` }],
        ],
      },
    });
  }
}
export async function webhook(request: Request, env: Env, input: unknown) {
  requireThat(
    env.TELEGRAM_WEBHOOK_SECRET &&
      (await equalSecret(
        request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '',
        env.TELEGRAM_WEBHOOK_SECRET,
      )),
    'Недопустимый webhook',
    401,
  );
  const update = object(input);
  if (update.callback_query) {
    const q = object(update.callback_query),
      from = object(q.from),
      message = object(q.message ?? {}),
      chat = object(message.chat ?? {});
    requireThat(
      chat.type === 'private' && String(chat.id) === String(from.id),
      'Действие доступно в личном чате',
      403,
    );
    const data = text(q.data, 64),
      parts = data.split(':');
    requireThat(parts.length === 2 && ['a', 'c', 'x'].includes(parts[0]), 'Неизвестная команда');
    let answer = 'Статус сохранён';
    try {
      const order = await stmt(env, 'SELECT * FROM orders WHERE id=?', parts[1]).first<OrderRow>();
      requireThat(order, 'Заказ не найден', 404);
      const access = await ownedStore(env, order.store_id, String(from.id));
      await changeStatus(
        env,
        order.store_id,
        order.id,
        { a: 'processing', c: 'completed', x: 'cancelled' }[parts[0]]!,
        access,
      );
    } catch (e) {
      answer = e instanceof Error ? e.message : 'Ошибка';
    }
    await telegram(env, 'answerCallbackQuery', {
      callback_query_id: text(q.id, 200, true),
      text: answer,
    });
    return;
  }
  if (update.message) {
    const m = object(update.message),
      chat = object(m.chat),
      from = object(m.from ?? {});
    requireThat(
      chat.type === 'private' && String(chat.id) === String(from.id),
      'Используйте личный чат с ботом',
      403,
    );
    const user = String(from.id);
    requireThat(/^[1-9]\d{0,15}$/.test(user), 'Недопустимый пользователь');
    const msg = text(m.text, 4096);
    if (msg.startsWith('/start claim_')) {
      try {
        const s = await claim(env, msg.slice('/start claim_'.length), user);
        await telegram(env, 'sendMessage', {
          chat_id: user,
          text: 'Магазин «' + s.name + '» подключён. Теперь вы можете управлять им в Telegram.',
        });
      } catch (e) {
        await telegram(env, 'sendMessage', {
          chat_id: user,
          text: e instanceof Error ? e.message : 'Не удалось подключить магазин',
        });
        return;
      }
    }
    if (/^\/(pay)(\s|$|@)/.test(msg) || msg === '/start payments') {
      await paymentMenu(env, user, text(from.language_code, 20));
      return;
    }
    if (/^\/(start|admin|shop)(\s|$|@)/.test(msg)) await menu(env, user);
  }
}
export async function flushNotifications(env: Env, onlyOrder?: string) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const pending = await stmt(
    env,
    `SELECT o.*,s.owner_id,s.name AS store_name FROM notification_outbox n JOIN orders o ON o.id=n.order_id JOIN stores s ON s.id=o.store_id WHERE n.sent_at IS NULL AND n.next_attempt<=unixepoch() AND n.lease_until<unixepoch() ${onlyOrder ? 'AND n.order_id=?' : ''} ORDER BY n.next_attempt LIMIT 10`,
    ...(onlyOrder ? [onlyOrder] : []),
  ).all<OrderRow & { owner_id: string; store_name: string }>();
  for (const o of pending.results) {
    const lease = await stmt(
      env,
      'UPDATE notification_outbox SET lease_until=unixepoch()+60 WHERE order_id=? AND sent_at IS NULL AND lease_until<unixepoch() RETURNING attempts',
      o.id,
    ).first<{ attempts: number }>();
    if (!lease) continue;
    try {
      const c = JSON.parse(o.customer) as Customer,
        items = JSON.parse(o.items) as OrderItem[];
      const body = `${o.store_name}\nНовый заказ №${o.number}\n${c.name}\nТелефон: ${c.phone}\n${c.deliveryMethod}: ${c.address}\n${c.city} ${c.region} ${c.index}\n${items.map((i) => `${i.name} (${i.variant}) — ${i.quantity} шт.`).join('\n')}\nИтого: ${(o.total_minor / 100).toFixed(2)} ${o.currency}${c.comment ? '\n' + c.comment : ''}`;
      await telegram(env, 'sendMessage', {
        chat_id: o.owner_id,
        text: body.slice(0, 4000),
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Принять', callback_data: 'a:' + o.id },
              { text: 'Выполнен', callback_data: 'c:' + o.id },
            ],
            [
              {
                text: 'Открыть заказ',
                web_app: { url: origin(env) + `/admin?store=${o.store_id}&order=${o.id}` },
              },
              { text: 'Отменить', callback_data: 'x:' + o.id },
            ],
          ],
        },
      });
      await stmt(
        env,
        'UPDATE notification_outbox SET sent_at=unixepoch(),lease_until=0 WHERE order_id=?',
        o.id,
      ).run();
    } catch {
      const delay = Math.min(86400, 60 * 2 ** Math.min(lease.attempts, 10));
      await stmt(
        env,
        'UPDATE notification_outbox SET attempts=attempts+1,next_attempt=unixepoch()+?,lease_until=0 WHERE order_id=?',
        delay,
        o.id,
      ).run();
      console.warn(JSON.stringify({ event: 'telegram_notification_retry', orderId: o.id }));
    }
  }
}

export async function setupTelegram(env: Env) {
  const base = origin(env);
  requireThat(base.startsWith('https://'), 'Настройте HTTPS PUBLIC_ORIGIN', 503);
  requireThat(/^[a-z0-9_]{5,32}$/i.test(env.BOT_USERNAME), 'Настройте BOT_USERNAME', 503);
  requireThat(env.TELEGRAM_WEBHOOK_SECRET, 'Настройте TELEGRAM_WEBHOOK_SECRET', 503);
  const identity = object((await telegram(env, 'getMe', {})).result);
  requireThat(
    String(identity.username).toLowerCase() === String(env.BOT_USERNAME).toLowerCase(),
    'BOT_USERNAME не совпадает с ботом, которому принадлежит токен',
    409,
  );
  await telegram(env, 'setWebhook', {
    url: base + '/api/telegram/webhook',
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'callback_query'],
  });
  await telegram(env, 'setMyCommands', {
    commands: [
      { command: 'start', description: 'Подключить магазин' },
      { command: 'admin', description: 'Управлять магазином' },
      { command: 'shop', description: 'Мой сайт' },
      { command: 'pay', description: 'Оплата / Payments' },
    ],
  });
  await telegram(env, 'setChatMenuButton', {
    menu_button: { type: 'web_app', text: 'Мой магазин', web_app: { url: base + '/admin' } },
  });
  return { ok: true, botUsername: env.BOT_USERNAME, webhookUrl: base + '/api/telegram/webhook' };
}
