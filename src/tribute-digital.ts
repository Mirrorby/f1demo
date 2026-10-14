import { stmt } from './catalog';
import { notificationLanguage } from './telegram-i18n';
import { telegram } from './telegram';
import { int, object, requireThat, text } from './validation';

export function digitalUrl(env: Env) {
  const url = env.TRIBUTE_PRODUCT_URL;
  requireThat(
    /^https:\/\/web\.tribute\.tg\/p\/[a-zA-Z0-9]+$/.test(url),
    'Настройте ссылку товара Tribute',
    503,
  );
  return url;
}
async function get(env: Env, path: string) {
  requireThat(env.TRIBUTE_API_KEY, 'Настройте TRIBUTE_API_KEY', 503);
  const r = await fetch('https://tribute.tg/api/v1' + path, {
    headers: { 'Api-Key': env.TRIBUTE_API_KEY },
    signal: AbortSignal.timeout(10000),
  });
  requireThat(r.ok, 'Не удалось проверить товар Tribute', 502);
  return object(await r.json());
}
export async function digitalProduct(env: Env) {
  const wanted = digitalUrl(env);
  for (let page = 1; page <= 10; page++) {
    const data = await get(env, '/products?size=100&page=' + page);
    requireThat(Array.isArray(data.rows), 'Некорректный список товаров Tribute', 502);
    const found = data.rows.map(object).find((p) => p.webLink === wanted);
    if (found) {
      requireThat(
        ['digital', 'custom'].includes(String(found.type)),
        'Нужен цифровой товар или товар на заказ Tribute',
        503,
      );
      return found;
    }
    if (data.rows.length < 100) break;
  }
  requireThat(false, 'Товар по этой ссылке не найден в вашем аккаунте Tribute', 503);
}
export function productOrderLinkAvailable(product: Record<string, unknown>) {
  // Custom orders are fulfilled and moderated individually. The live API can
  // return "new" for their card, even though its documented enum omits it.
  // Opening Tribute lets the provider decide whether checkout is available;
  // this does not confirm approval, payment, fulfillment or seller payout.
  return product.status === 'approved' || (product.type === 'custom' && product.status === 'new');
}
export function productPaymentUrl(product: Record<string, unknown>, env: Env) {
  const url = digitalUrl(env);
  return product.type === 'custom'
    ? 'https://t.me/tribute/app?startapp=p' + url.split('/').at(-1)
    : url;
}
type Purchase = {
  purchase_id: string;
  owner_id: string;
  product_id: number;
  title: string;
  amount_minor: number;
  currency: string;
  status: string;
  created_at: number;
};
export async function digitalPurchases(env: Env, user?: string) {
  const rows = await stmt(
    env,
    'SELECT * FROM tribute_digital_purchases WHERE (? IS NULL OR owner_id=?) ORDER BY created_at DESC,purchase_id DESC LIMIT 50',
    user ?? null,
    user ?? null,
  ).all<Purchase>();
  return rows.results.map((p) => ({
    id: 'digital:' + p.purchase_id,
    type: 'digital',
    storeId: null,
    ownerId: p.owner_id,
    title: p.title,
    description: '',
    amountMinor: p.amount_minor,
    currency: p.currency,
    status: p.status,
    paymentUrl: null,
    createdAt: p.created_at,
    paidAt: null,
  }));
}
// Called only after the shared handler verifies the HMAC over the original body.
export async function digitalWebhook(env: Env, name: string, input: unknown) {
  const p = object(input);
  const productId = int(p.product_id, 1, Number.MAX_SAFE_INTEGER);
  const remote = await get(env, '/products/' + productId);
  if (remote.webLink !== digitalUrl(env) || !['digital', 'custom'].includes(String(remote.type)))
    return { status: 'ignored' };
  const purchase = String(int(p.purchase_id, 1, Number.MAX_SAFE_INTEGER));
  const owner = String(int(p.telegram_user_id, 1, Number.MAX_SAFE_INTEGER));
  const amount = int(p.amount, 0, Number.MAX_SAFE_INTEGER);
  const currency = text(p.currency, 3, true).toLowerCase();
  requireThat(['usd', 'eur', 'rub'].includes(currency), 'Неизвестная валюта оплаты', 400);
  const old = await stmt(
    env,
    'SELECT * FROM tribute_digital_purchases WHERE purchase_id=?',
    purchase,
  ).first<Purchase>();
  requireThat(
    !old ||
      (old.owner_id === owner &&
        old.product_id === productId &&
        old.currency === currency &&
        old.amount_minor === amount),
    'Покупка не соответствует сохранённой оплате',
    409,
  );
  const status = name === 'new_digital_product' ? 'paid' : 'refund_reported';
  const title = text(p.product_name ?? remote.name, 300, true);
  // The signed event carries the actual sale price, which may predate a price change.
  await env.DB.batch([
    stmt(
      env,
      "INSERT INTO tribute_digital_purchases(purchase_id,owner_id,product_id,title,amount_minor,currency,status) VALUES(?,?,?,?,?,?,?) ON CONFLICT(purchase_id) DO UPDATE SET status=CASE WHEN tribute_digital_purchases.status='refund_reported' THEN tribute_digital_purchases.status ELSE excluded.status END",
      purchase,
      owner,
      productId,
      title,
      amount,
      currency,
      status,
    ),
    stmt(
      env,
      'INSERT OR IGNORE INTO tribute_digital_outbox(id,purchase_id,kind) VALUES(?,?,?)',
      status + ':' + purchase,
      purchase,
      status,
    ),
  ]);
  return { status: 'ok' };
}
export async function digitalMenu(env: Env, user: string, language: string) {
  const ru = language.startsWith('ru');
  const product = await digitalProduct(env);
  const purchases = await digitalPurchases(env, user);
  for (const p of purchases.slice(0, 10)) {
    await telegram(env, 'sendMessage', {
      chat_id: user,
      text:
        p.title +
        '\n' +
        (p.amountMinor / 100).toFixed(2) +
        ' ' +
        p.currency.toUpperCase() +
        '\n' +
        (p.status === 'paid'
          ? ru
            ? 'Оплачено'
            : 'Paid'
          : ru
            ? 'Зарегистрирован возврат'
            : 'Refund reported'),
    });
  }
  if (!productOrderLinkAvailable(product)) {
    await telegram(env, 'sendMessage', {
      chat_id: user,
      text: ru
        ? 'Товар пока недоступен для оплаты.'
        : 'This product is not available for payment yet.',
    });
    return;
  }
  await telegram(env, 'sendMessage', {
    chat_id: user,
    text:
      text(product.name, 300, true) +
      '\n' +
      (int(product.amount, 0, Number.MAX_SAFE_INTEGER) / 100).toFixed(2) +
      ' ' +
      text(product.currency, 3, true).toUpperCase() +
      (product.type === 'custom'
        ? ru
          ? '\nТовар на заказ. Продавец отправит результат через Tribute после выполнения заказа и модерации.'
          : '\nMade to order. The seller will send the result through Tribute after fulfillment and moderation.'
        : ''),
    reply_markup: {
      inline_keyboard: [
        [
          {
            text:
              product.type === 'custom'
                ? ru
                  ? 'Заказать через Tribute'
                  : 'Order with Tribute'
                : ru
                  ? 'Оплатить через Tribute'
                  : 'Pay with Tribute',
            url: productPaymentUrl(product, env),
          },
        ],
      ],
    },
  });
}
export async function flushDigitalNotifications(env: Env) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const rows = await stmt(
    env,
    'SELECT n.id,n.kind,p.owner_id,p.title,p.amount_minor,p.currency,p.status FROM tribute_digital_outbox n JOIN tribute_digital_purchases p ON p.purchase_id=n.purchase_id WHERE n.sent_at IS NULL AND n.next_attempt<=unixepoch() AND n.lease_until<unixepoch() ORDER BY n.next_attempt LIMIT 5',
  ).all<Purchase & { id: string; kind: string }>();
  for (const p of rows.results) {
    const lease = await stmt(
      env,
      'UPDATE tribute_digital_outbox SET lease_until=unixepoch()+60 WHERE id=? AND sent_at IS NULL AND lease_until<unixepoch() RETURNING attempts',
      p.id,
    ).first<{ attempts: number }>();
    if (!lease) continue;
    try {
      const lang = await notificationLanguage(env, p.owner_id);
      if (!(p.kind === 'paid' && p.status === 'refund_reported'))
        await telegram(env, 'sendMessage', {
          chat_id: p.owner_id,
          text:
            (p.kind === 'paid'
              ? lang === 'ru'
                ? '✅ Оплата подтверждена'
                : '✅ Payment confirmed'
              : lang === 'ru'
                ? '↩️ Зарегистрирован возврат'
                : '↩️ Refund reported') +
            '\n' +
            p.title +
            '\n' +
            (p.amount_minor / 100).toFixed(2) +
            ' ' +
            p.currency.toUpperCase(),
        });
      await stmt(
        env,
        'UPDATE tribute_digital_outbox SET sent_at=unixepoch(),lease_until=0 WHERE id=?',
        p.id,
      ).run();
    } catch {
      await stmt(
        env,
        'UPDATE tribute_digital_outbox SET attempts=attempts+1,next_attempt=unixepoch()+?,lease_until=0 WHERE id=?',
        Math.min(86400, 60 * 2 ** Math.min(lease.attempts, 10)),
        p.id,
      ).run();
    }
  }
}
