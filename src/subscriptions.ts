import { stmt, storeMutationGuard } from './catalog';
import { notificationToken } from './telegram';
import { int, object, requireThat, HttpError } from './validation';
import type { StoreRow } from './types';

interface Subscription {
  store_id: string;
  started_at: number;
  expires_at: number;
  reminder_sent_at: number | null;
}
export function monthFrom(seconds: number, months: number) {
  const d = new Date(seconds * 1000),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return Math.floor(d.getTime() / 1000);
}
export async function subscriptionFor(env: Env, storeId: string) {
  const s = await stmt(
    env,
    'SELECT store_id,started_at,expires_at,reminder_sent_at FROM subscriptions WHERE store_id=?',
    storeId,
  ).first<Subscription>();
  return s
    ? { ...s, status: s.expires_at > Math.floor(Date.now() / 1000) ? 'active' : 'expired' }
    : null;
}
export async function manualSubscription(env: Env, s: StoreRow, input: unknown) {
  requireThat(s.owner_id, 'Сначала подключите владельца', 409);
  const d = object(input),
    months = int(d.months ?? 1, 1, 12);
  const existing = await subscriptionFor(env, s.id);
  const now = Math.floor(Date.now() / 1000);
  const start = existing?.expires_at && existing.expires_at > now ? existing.expires_at : now;
  const expiry = monthFrom(start, months);
  try {
    await env.DB.batch([
      storeMutationGuard(env, s),
      stmt(
        env,
        "UPDATE stores SET status='active',orders_enabled=CASE WHEN status='demo' OR EXISTS(SELECT 1 FROM subscriptions WHERE store_id=stores.id AND expires_at<=unixepoch()) THEN 1 ELSE orders_enabled END,version=version+1 WHERE id=? AND version=? AND owner_id IS ?",
        s.id,
        s.version,
        s.owner_id,
      ),
      stmt(
        env,
        `INSERT INTO subscriptions(store_id,started_at,expires_at) VALUES(?,?,?)
        ON CONFLICT(store_id) DO UPDATE SET expires_at=excluded.expires_at,started_at=CASE WHEN subscriptions.expires_at>? THEN subscriptions.started_at ELSE excluded.started_at END,
        reminder_sent_at=NULL,reminder_attempts=0,reminder_next_at=0,reminder_lease_until=0,updated_at=unixepoch()`,
        s.id,
        now,
        expiry,
        now,
      ),
      stmt(env, 'DELETE FROM mutation_guards'),
    ]);
  } catch (e) {
    if (String(e).includes('CHECK constraint'))
      throw new HttpError(409, 'Магазин изменился. Обновите страницу.');
    throw e;
  }
  return {
    subscription: await subscriptionFor(env, s.id),
    notificationsAvailable: !!notificationToken(env),
  };
}
export { sendSubscriptionNotifications as sendSubscriptionReminders } from './subscription-notifications';
