import {
  digitalProduct,
  productOrderLinkAvailable,
  productPaymentUrl,
  digitalMenu,
  digitalPurchases,
  digitalWebhook,
  flushDigitalNotifications,
} from './tribute-digital';
import { equalSecret, digest } from './auth';
import { stmt } from './catalog';
import { telegram, origin } from './telegram';
import { HttpError, int, object, requireThat, text, limitedBytes } from './validation';
import type { StoreRow } from './types';

type Invoice = {
  id: string;
  store_id: string;
  owner_id: string;
  amount_minor: number;
  currency: string;
  title: string;
  description: string;
  remote_uuid: string | null;
  payment_url: string | null;
  status: string;
  created_at: number;
  paid_at: number | null;
  tribute_shop_id: string;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function configured(env: Env) {
  requireThat(
    env.TRIBUTE_API_KEY &&
      /^[1-9]\d{0,15}$/.test(env.TRIBUTE_SHOP_ID) &&
      Number.isSafeInteger(Number(env.TRIBUTE_SHOP_ID)),
    'Настройте TRIBUTE_API_KEY и TRIBUTE_SHOP_ID',
    503,
  );
}
async function api(env: Env, path: string, data?: unknown) {
  configured(env);
  const r = await fetch('https://tribute.tg/api/v1' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'Api-Key': env.TRIBUTE_API_KEY, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  requireThat(r.ok, 'Tribute не смог обработать запрос. Проверьте настройки магазина.', 502);
  return r.json();
}
function view(i: Invoice) {
  return {
    id: i.id,
    storeId: i.store_id,
    ownerId: i.owner_id,
    amountMinor: i.amount_minor,
    currency: i.currency,
    title: i.title,
    description: i.description,
    status: i.status,
    paymentUrl: i.payment_url,
    createdAt: i.created_at,
    paidAt: i.paid_at,
  };
}
export async function tributeConfig(env: Env) {
  const webhookUrl = origin(env) + '/api/tribute/webhook';
  if (env.TRIBUTE_PRODUCT_URL) {
    if (!env.TRIBUTE_API_KEY)
      return {
        configured: false,
        webhookUrl,
        mode: 'digital',
        paymentUrl: env.TRIBUTE_PRODUCT_URL,
      };
    const p = await digitalProduct(env);
    return {
      configured: true,
      mode: 'digital',
      webhookUrl,
      paymentUrl: productPaymentUrl(p, env),
      productId: p.id,
      productType: p.type,
      productStatus: p.status,
      fulfillmentRequired: p.type === 'custom',
      name: p.name,
      active: p.status === 'approved',
      orderLinkAvailable: productOrderLinkAvailable(p),
      cardsEnabled: p.acceptCards === true,
      amountMinor: p.amount,
      currency: p.currency,
    };
  }
  if (!env.TRIBUTE_API_KEY || !env.TRIBUTE_SHOP_ID) return { configured: false, webhookUrl };
  configured(env);
  const s = object(await api(env, '/shop?shopId=' + env.TRIBUTE_SHOP_ID));
  return {
    configured: true,
    webhookUrl,
    shopId: s.id,
    name: s.name,
    active: s.status === 1,
    cardsEnabled: s.onlyStars === false,
    callbackMatches: s.callbackUrl === webhookUrl,
  };
}
export async function listInvoices(env: Env, storeId?: string, owner?: string) {
  const rows = await stmt(
    env,
    'SELECT * FROM platform_invoices WHERE (? IS NULL OR store_id=?) AND (? IS NULL OR owner_id=?) ORDER BY created_at DESC,id DESC LIMIT 50',
    storeId ?? null,
    storeId ?? null,
    owner ?? null,
    owner ?? null,
  ).all<Invoice>();
  return [...rows.results.map(view), ...(!storeId ? await digitalPurchases(env, owner) : [])];
}
export async function createInvoice(env: Env, s: StoreRow, input: unknown) {
  configured(env);
  requireThat(s.owner_id, 'Сначала подключите владельца магазина', 409);
  const d = object(input);
  const id = text(d.id, 36, true);
  requireThat(uuid.test(id), 'Укажите UUID счёта для защиты от повторного создания');
  const amount = int(d.amountMinor, 100, 30000000);
  const currency = text(d.currency, 3, true).toLowerCase();
  requireThat(['eur', 'usd', 'rub'].includes(currency), 'Tribute: EUR, USD или RUB');
  requireThat(
    amount >= (currency === 'rub' ? 10000 : 100) &&
      amount <= (currency === 'rub' ? 30000000 : 300000),
    'Сумма вне диапазона Tribute',
  );
  const title = text(d.title, 100, true),
    description = text(d.description, 300, true);
  const old = await stmt(env, 'SELECT * FROM platform_invoices WHERE id=?', id).first<Invoice>();
  if (old) {
    requireThat(
      old.store_id === s.id &&
        old.owner_id === s.owner_id &&
        old.amount_minor === amount &&
        old.currency === currency &&
        old.title === title &&
        old.description === description,
      'UUID уже использован для другого счёта',
      409,
    );
    requireThat(
      old.payment_url,
      'Создание этого счёта требует проверки в Tribute. Не создавайте дубликат.',
      409,
    );
    return view(old);
  }
  const shop = object(await api(env, '/shop?shopId=' + env.TRIBUTE_SHOP_ID));
  requireThat(
    shop.id === Number(env.TRIBUTE_SHOP_ID) && shop.status === 1 && shop.onlyStars === false,
    'Нужен активный Tribute Shop с оплатой картами',
    503,
  );
  requireThat(
    shop.callbackUrl === origin(env) + '/api/tribute/webhook',
    'Укажите webhook этого проекта в настройках Tribute Shop',
    503,
  );
  const inserted = await stmt(
    env,
    'INSERT OR IGNORE INTO platform_invoices(id,store_id,owner_id,amount_minor,currency,title,description,tribute_shop_id) SELECT ?,id,owner_id,?,?,?,?,? FROM stores WHERE id=? AND owner_id=?',
    id,
    amount,
    currency,
    title,
    description,
    env.TRIBUTE_SHOP_ID,
    s.id,
    s.owner_id,
  ).run();
  requireThat(
    inserted.meta.changes === 1,
    'Счёт уже создаётся или владелец магазина изменился',
    409,
  );
  try {
    const remote = object(
      await api(env, '/shop/orders', {
        shopId: Number(env.TRIBUTE_SHOP_ID),
        amount,
        currency,
        title,
        description,
        customerId: id,
        comment: 'Catalog Factory ' + id,
        period: 'onetime',
        successUrl: 'https://t.me/' + env.BOT_USERNAME + '?start=payments',
        failUrl: 'https://t.me/' + env.BOT_USERNAME + '?start=payments',
        preferredPaymentMethods: [{ type: 'card' }],
      }),
    );
    const remoteId = text(remote.uuid, 36, true),
      paymentUrl = text(remote.paymentUrl, 2000, true);
    requireThat(
      uuid.test(remoteId) &&
        remote.shopId === Number(env.TRIBUTE_SHOP_ID) &&
        remote.amount === amount &&
        remote.currency === currency &&
        remote.period === 'onetime' &&
        remote.onlyStars !== true,
      'Некорректный счёт Tribute',
      502,
    );
    const u = new URL(paymentUrl);
    requireThat(
      u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        (u.hostname === 'tribute.tg' || u.hostname.endsWith('.tribute.tg')),
      'Некорректная ссылка Tribute',
      502,
    );
    await stmt(
      env,
      "UPDATE platform_invoices SET remote_uuid=?,payment_url=?,status=CASE WHEN status IN ('creating','review') THEN 'pending' ELSE status END WHERE id=? AND (remote_uuid IS NULL OR remote_uuid=?)",
      remoteId,
      paymentUrl,
      id,
      remoteId,
    ).run();
  } catch {
    await stmt(
      env,
      "UPDATE platform_invoices SET status='review' WHERE id=? AND status='creating'",
      id,
    ).run();
    throw new HttpError(
      502,
      'Tribute не подтвердил создание счёта. Проверьте его в кабинете; повторный запрос с этим UUID не создаст дубликат.',
    );
  }
  const created = await stmt(
    env,
    'SELECT * FROM platform_invoices WHERE id=?',
    id,
  ).first<Invoice>();
  requireThat(created, 'Счёт не найден', 500);
  return view(created);
}
export async function tributeWebhook(request: Request, env: Env) {
  requireThat(env.TRIBUTE_API_KEY, 'Настройте TRIBUTE_API_KEY', 503);
  const raw = new TextDecoder().decode(await limitedBytes(request, 64000));
  requireThat(
    await verifyTributeSignature(
      raw,
      request.headers.get('trbt-signature') ?? '',
      env.TRIBUTE_API_KEY,
    ),
    'Недопустимая подпись Tribute',
    401,
  );
  let event: Record<string, unknown>;
  try {
    event = object(JSON.parse(raw));
  } catch {
    throw new HttpError(400, 'Некорректный webhook');
  }
  const name = text(event.name, 100, true);
  if (env.TRIBUTE_PRODUCT_URL && ['new_digital_product', 'digital_product_refunded'].includes(name))
    return digitalWebhook(env, name, event.payload);
  if (!['shop_order', 'shop_order_refunded'].includes(name)) return { status: 'ignored' };
  const p = object(event.payload);
  if (String(p.shopId) !== env.TRIBUTE_SHOP_ID) return { status: 'ignored' };
  const remoteId = text(p.uuid, 36, true);
  requireThat(uuid.test(remoteId), 'Некорректный UUID платежа');
  const customer = text(p.customerId, 256);
  const i = await stmt(
    env,
    'SELECT * FROM platform_invoices WHERE remote_uuid=? OR id=?',
    remoteId,
    customer,
  ).first<Invoice>();
  requireThat(i, 'Счёт ещё не зарегистрирован', 404);
  requireThat(
    i.tribute_shop_id === env.TRIBUTE_SHOP_ID &&
      (!i.remote_uuid || i.remote_uuid === remoteId) &&
      (!customer || customer === i.id),
    'Платёж не соответствует счёту',
    409,
  );
  requireThat(p.currency === i.currency, 'Валюта платежа не соответствует счёту', 409);
  if (name === 'shop_order') {
    requireThat(
      p.status === 'paid' && p.amount === i.amount_minor && p.isRecurrent === false && !p.isTrial,
      'Оплата не подтверждена или сумма не соответствует счёту',
      409,
    );
  }
  const eventId = await digest(JSON.stringify([name, event.created_at, p]));
  const next = name === 'shop_order' ? 'paid' : 'refund_reported';
  await env.DB.batch([
    stmt(
      env,
      'INSERT OR IGNORE INTO platform_payment_events(id,invoice_id,name) VALUES(?,?,?)',
      eventId,
      i.id,
      name,
    ),
    stmt(
      env,
      "UPDATE platform_invoices SET remote_uuid=COALESCE(remote_uuid,?),status=CASE WHEN status='refund_reported' THEN status ELSE ? END,paid_at=CASE WHEN ?='paid' THEN COALESCE(paid_at,unixepoch()) ELSE paid_at END WHERE id=?",
      remoteId,
      next,
      next,
      i.id,
    ),
    stmt(
      env,
      'INSERT OR IGNORE INTO platform_payment_outbox(id,invoice_id,kind) VALUES(?,?,?)',
      next === 'paid' ? 'paid:' + i.id : eventId,
      i.id,
      next,
    ),
  ]);
  return { status: 'ok' };
}

export async function reconcileInvoice(env: Env, id: string, input: unknown) {
  const i = await stmt(env, 'SELECT * FROM platform_invoices WHERE id=?', id).first<Invoice>();
  requireThat(i, 'Счёт не найден', 404);
  const d = object(input);
  const remoteId = text(d.remoteUuid ?? i.remote_uuid, 36, true);
  requireThat(
    uuid.test(remoteId) && (!i.remote_uuid || i.remote_uuid === remoteId),
    'Некорректный UUID Tribute',
    409,
  );
  const r = object(await api(env, '/shop/orders/' + remoteId));
  requireThat(
    String(r.shopId) === i.tribute_shop_id &&
      r.amount === i.amount_minor &&
      r.currency === i.currency &&
      r.comment === 'Catalog Factory ' + i.id &&
      r.period === 'onetime' &&
      !r.onlyStars,
    'Счёт Tribute не соответствует этому счёту',
    409,
  );
  const paymentUrl = text(r.paymentUrl, 2000, true);
  const u = new URL(paymentUrl);
  requireThat(
    u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      (u.hostname === 'tribute.tg' || u.hostname.endsWith('.tribute.tg')),
    'Некорректная ссылка Tribute',
    502,
  );
  await stmt(
    env,
    "UPDATE platform_invoices SET remote_uuid=?,payment_url=?,status=CASE WHEN status IN ('paid','refund_reported') THEN status WHEN ?='paid' THEN 'paid' ELSE 'pending' END,paid_at=CASE WHEN ?='paid' THEN COALESCE(paid_at,unixepoch()) ELSE paid_at END WHERE id=?",
    remoteId,
    paymentUrl,
    r.status === 'paid' ? 'paid' : 'pending',
    r.status === 'paid' ? 'paid' : 'pending',
    i.id,
  ).run();
  if (r.status === 'paid')
    await stmt(
      env,
      "INSERT OR IGNORE INTO platform_payment_outbox(id,invoice_id,kind) VALUES(?,?,'paid')",
      'paid:' + i.id,
      i.id,
    ).run();
  const updated = await stmt(
    env,
    'SELECT * FROM platform_invoices WHERE id=?',
    id,
  ).first<Invoice>();
  requireThat(updated, 'Счёт не найден', 500);
  return view(updated);
}
export async function paymentMenu(env: Env, user: string, language: string) {
  if (env.TRIBUTE_PRODUCT_URL) {
    await digitalMenu(env, user, language);
    return;
  }
  const ru = language.startsWith('ru');
  const invoices = await listInvoices(env, undefined, user);
  if (!invoices.length) {
    await telegram(env, 'sendMessage', {
      chat_id: user,
      text: ru ? 'Для вас пока нет счетов на оплату.' : 'You have no invoices yet.',
    });
    return;
  }
  for (const i of invoices.slice(0, 10)) {
    const status =
      i.status === 'paid'
        ? ru
          ? 'Оплачено'
          : 'Paid'
        : i.status === 'refund_reported'
          ? ru
            ? 'Зарегистрирован возврат'
            : 'Refund reported'
          : ru
            ? 'Ожидает оплаты'
            : 'Awaiting payment';
    await telegram(env, 'sendMessage', {
      chat_id: user,
      text:
        i.title +
        '\n' +
        i.description +
        '\n' +
        (i.amountMinor / 100).toFixed(2) +
        ' ' +
        i.currency.toUpperCase() +
        '\n' +
        status,
      ...(i.paymentUrl && i.status === 'pending'
        ? {
            reply_markup: {
              inline_keyboard: [
                [{ text: ru ? 'Оплатить через Tribute' : 'Pay with Tribute', url: i.paymentUrl }],
              ],
            },
          }
        : {}),
    });
  }
}
export async function flushPaymentNotifications(env: Env) {
  await flushDigitalNotifications(env);
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const pending = await stmt(
    env,
    'SELECT n.id,n.kind,i.owner_id,i.title,i.amount_minor,i.currency,i.status FROM platform_payment_outbox n JOIN platform_invoices i ON i.id=n.invoice_id WHERE n.sent_at IS NULL AND n.next_attempt<=unixepoch() AND n.lease_until<unixepoch() ORDER BY n.next_attempt LIMIT 5',
  ).all<{
    id: string;
    kind: string;
    owner_id: string;
    title: string;
    amount_minor: number;
    currency: string;
    status: string;
  }>();
  for (const n of pending.results) {
    const lease = await stmt(
      env,
      'UPDATE platform_payment_outbox SET lease_until=unixepoch()+60 WHERE id=? AND sent_at IS NULL AND lease_until<unixepoch() RETURNING attempts',
      n.id,
    ).first<{ attempts: number }>();
    if (!lease) continue;
    try {
      if (!(n.kind === 'paid' && n.status === 'refund_reported')) {
        await telegram(env, 'sendMessage', {
          chat_id: n.owner_id,
          text:
            (n.kind === 'paid'
              ? 'Payment confirmed / Оплата подтверждена'
              : 'Refund reported / Зарегистрирован возврат') +
            '\n' +
            n.title +
            '\n' +
            (n.amount_minor / 100).toFixed(2) +
            ' ' +
            n.currency.toUpperCase(),
        });
      }
      await stmt(
        env,
        'UPDATE platform_payment_outbox SET sent_at=unixepoch(),lease_until=0 WHERE id=?',
        n.id,
      ).run();
    } catch {
      await stmt(
        env,
        'UPDATE platform_payment_outbox SET attempts=attempts+1,next_attempt=unixepoch()+?,lease_until=0 WHERE id=?',
        Math.min(86400, 60 * 2 ** Math.min(lease.attempts, 10)),
        n.id,
      ).run();
      console.warn(JSON.stringify({ event: 'payment_notification_retry' }));
    }
  }
}

export async function verifyTributeSignature(body: string, signature: string, apiKey: string) {
  if (
    !apiKey ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    new TextEncoder().encode(body).length > 64000
  )
    return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const bytes = new Uint8Array(signature.match(/.{2}/g)!.map((part) => parseInt(part, 16)));
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(body));
}
