import { stmt } from './catalog';
import { telegram, notificationToken, origin } from './telegram';
import { notificationLanguage } from './telegram-i18n';
interface Notice {
  id: string;
  store_id: string;
  owner_id: string;
  kind: 'trial_started' | 'activated' | 'renewed' | 'reminder' | 'expired';
  plan_type: 'trial' | 'paid';
  expires_at: number;
  attempts: number;
}
export function notificationCopy(
  kind: Notice['kind'],
  plan: Notice['plan_type'],
  language: string,
  name: string,
  expiry: number,
) {
  const locale = language === 'ru' ? 'ru-RU' : language === 'ro' ? 'ro-RO' : 'en-GB';
  const date =
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(expiry * 1000)) + ' UTC';
  const trial = plan === 'trial';
  const ru = {
    trial_started: `✅ Пробный период сайта «${name}» активирован до ${date}. Приём заказов включён. Карта не требуется, автоматических списаний нет.`,
    activated: `✅ Подписка сайта «${name}» активирована до ${date}.`,
    renewed: `✅ Подписка сайта «${name}» продлена до ${date}. Новый срок уже указан в Mini App.`,
    reminder: trial
      ? `⏳ Пробный период сайта «${name}» заканчивается ${date}. После окончания приём заказов приостановится, каталог и товары сохранятся. Чтобы продолжить работу, активируйте подписку — 24,99 USD в месяц за один сайт.`
      : `⏳ Подписка сайта «${name}» заканчивается ${date}. Продлите её, чтобы продолжать принимать заказы. Тариф — 24,99 USD в месяц за один сайт.`,
    expired: trial
      ? `Пробный период сайта «${name}» завершился ${date}. Приём заказов приостановлен. Каталог и товары сохранены. Активируйте подписку, чтобы снова принимать заказы.`
      : `Срок подписки сайта «${name}» истёк ${date}. Приём заказов приостановлен. Каталог и товары сохранены. Продлите подписку, чтобы возобновить работу.`,
  };
  const en = {
    trial_started: `✅ The free trial for “${name}” is active until ${date}. Orders are enabled. No card or automatic charges.`,
    activated: `✅ The subscription for “${name}” is active until ${date}.`,
    renewed: `✅ The subscription for “${name}” has been extended until ${date}. The new expiry is shown in the Mini App.`,
    reminder: trial
      ? `⏳ The free trial for “${name}” ends on ${date}. Orders will pause; your catalog and products will stay saved. Activate a subscription to continue: 24.99 USD per month for one site.`
      : `⏳ The subscription for “${name}” ends on ${date}. Renew to keep accepting orders: 24.99 USD per month for one site.`,
    expired: trial
      ? `The free trial for “${name}” ended on ${date}. Orders are paused. Your catalog and products are saved. Activate a subscription to resume orders.`
      : `The subscription for “${name}” expired on ${date}. Orders are paused. Your catalog and products are saved. Renew your subscription to resume.`,
  };
  const ro = {
    trial_started: `✅ Perioada de probă pentru „${name}” este activă până la ${date}. Comenzile sunt activate. Fără card și fără debitări automate.`,
    activated: `✅ Abonamentul pentru „${name}” este activ până la ${date}.`,
    renewed: `✅ Abonamentul pentru „${name}” a fost prelungit până la ${date}. Noul termen apare în Mini App.`,
    reminder: trial
      ? `⏳ Perioada de probă pentru „${name}” se încheie la ${date}. Comenzile se vor suspenda; catalogul și produsele rămân salvate. Activează abonamentul: 24,99 USD pe lună pentru un site.`
      : `⏳ Abonamentul pentru „${name}” expiră la ${date}. Prelungește-l pentru a primi în continuare comenzi: 24,99 USD pe lună pentru un site.`,
    expired: trial
      ? `Perioada de probă pentru „${name}” s-a încheiat la ${date}. Comenzile sunt suspendate. Catalogul și produsele sunt salvate. Activează abonamentul pentru a relua comenzile.`
      : `Abonamentul pentru „${name}” a expirat la ${date}. Comenzile sunt suspendate. Catalogul și produsele sunt salvate. Prelungește abonamentul pentru a relua activitatea.`,
  };
  const action = kind === 'reminder' || kind === 'expired';
  return {
    text: (language === 'ru' ? ru : language === 'ro' ? ro : en)[kind],
    button:
      language === 'ru'
        ? action
          ? trial
            ? 'Активировать подписку'
            : 'Продлить подписку'
          : 'Открыть мой сайт'
        : language === 'ro'
          ? action
            ? trial
              ? 'Activează abonamentul'
              : 'Prelungește abonamentul'
            : 'Deschide site-ul meu'
          : action
            ? trial
              ? 'Activate subscription'
              : 'Renew subscription'
            : 'Open my site',
    action,
  };
}
export async function sendSubscriptionNotifications(env: Env) {
  await stmt(
    env,
    'UPDATE stores SET orders_enabled=0,version=version+1 WHERE orders_enabled=1 AND id IN (SELECT store_id FROM subscriptions WHERE expires_at<=unixepoch())',
  ).run();
  if (!notificationToken(env)) return;
  // Unique event IDs also cover concurrent cron/import ticks and owner transfers.
  for (const kind of ['reminder', 'expired'] as const) {
    const due =
      kind === 'reminder'
        ? 'b.expires_at>unixepoch() AND b.expires_at<=unixepoch()+259200 AND b.reminder_sent_at IS NULL'
        : "b.expires_at<=unixepoch() AND b.expires_at>=COALESCE((SELECT CAST(value AS INTEGER) FROM maintenance_state WHERE key='subscription_notifications_since'),unixepoch())";
    await stmt(
      env,
      `INSERT OR IGNORE INTO subscription_notifications(id,store_id,owner_id,kind,plan_type,expires_at)
    SELECT b.store_id||':'||b.expires_at||':${kind}:'||s.owner_id,b.store_id,s.owner_id,'${kind}',
     CASE WHEN EXISTS(SELECT 1 FROM trial_activations t WHERE t.store_id=b.store_id AND t.expires_at=b.expires_at) THEN 'trial' ELSE 'paid' END,b.expires_at
    FROM subscriptions b JOIN stores s ON s.id=b.store_id WHERE s.status='active' AND s.owner_id IS NOT NULL AND ${due} ORDER BY b.expires_at LIMIT 50`,
    ).run();
  }
  const pending = await stmt(
    env,
    `SELECT * FROM subscription_notifications WHERE sent_at IS NULL AND cancelled_at IS NULL AND next_attempt<=unixepoch() AND lease_until<unixepoch() ORDER BY created_at,id LIMIT 5`,
  ).all<Notice>();
  for (const notice of pending.results) {
    const lease = await stmt(
      env,
      `UPDATE subscription_notifications SET lease_until=unixepoch()+60 WHERE id=? AND sent_at IS NULL AND cancelled_at IS NULL AND next_attempt<=unixepoch() AND lease_until<unixepoch() RETURNING attempts`,
      notice.id,
    ).first<{ attempts: number }>();
    if (!lease) continue;
    try {
      const current = await stmt(
        env,
        `SELECT s.owner_id,s.name,s.status,b.expires_at FROM stores s JOIN subscriptions b ON b.store_id=s.id WHERE s.id=?`,
        notice.store_id,
      ).first<{ owner_id: string; name: string; status: string; expires_at: number }>();
      const expired = notice.expires_at <= Math.floor(Date.now() / 1000);
      if (
        !current ||
        current.owner_id !== notice.owner_id ||
        current.status !== 'active' ||
        current.expires_at !== notice.expires_at ||
        (notice.kind === 'expired' ? !expired : expired)
      ) {
        await stmt(
          env,
          'UPDATE subscription_notifications SET cancelled_at=unixepoch(),lease_until=0 WHERE id=?',
          notice.id,
        ).run();
        continue;
      }
      const language = await notificationLanguage(env, notice.owner_id);
      const copy = notificationCopy(
        notice.kind,
        notice.plan_type,
        language,
        current.name,
        notice.expires_at,
      );
      const url = new URL('/admin', origin(env));
      url.searchParams.set('store', notice.store_id);
      url.searchParams.set('tab', copy.action ? 'payments' : 'subscription');
      url.searchParams.set('lang', language);
      await telegram(env, 'sendMessage', {
        chat_id: notice.owner_id,
        text: copy.text,
        reply_markup: { inline_keyboard: [[{ text: copy.button, web_app: { url: url.href } }]] },
      });
      await env.DB.batch([
        stmt(
          env,
          'UPDATE subscription_notifications SET sent_at=unixepoch(),lease_until=0 WHERE id=?',
          notice.id,
        ),
        ...(notice.kind === 'reminder'
          ? [
              stmt(
                env,
                'UPDATE subscriptions SET reminder_sent_at=unixepoch(),reminder_attempts=0,reminder_next_at=0,reminder_lease_until=0 WHERE store_id=? AND expires_at=?',
                notice.store_id,
                notice.expires_at,
              ),
            ]
          : []),
      ]);
    } catch {
      const delay = Math.min(86400, 60 * 2 ** Math.min(lease.attempts, 10));
      await stmt(
        env,
        'UPDATE subscription_notifications SET attempts=attempts+1,next_attempt=unixepoch()+?,lease_until=0 WHERE id=?',
        delay,
        notice.id,
      ).run();
      if (notice.kind === 'reminder')
        await stmt(
          env,
          'UPDATE subscriptions SET reminder_attempts=?,reminder_next_at=unixepoch()+?,reminder_lease_until=0 WHERE store_id=? AND expires_at=?',
          lease.attempts + 1,
          delay,
          notice.store_id,
          notice.expires_at,
        ).run();
      console.warn(
        JSON.stringify({
          event: 'subscription_notification_retry',
          kind: notice.kind,
          storeId: notice.store_id,
        }),
      );
    }
  }
}
