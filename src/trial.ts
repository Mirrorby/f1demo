import { stmt, storeMutationGuard } from './catalog';
import { subscriptionFor } from './subscriptions';
import { requireThat, HttpError } from './validation';
import type { StoreRow } from './types';
const trialSeconds = 14 * 86400;
export async function trialStatus(env: Env, owner: string | null) {
  if (!owner) return { available: false, active: false };
  const trial = await stmt(
    env,
    `SELECT t.store_id,t.started_at,t.expires_at,
    CASE WHEN t.expires_at>unixepoch() AND s.expires_at=t.expires_at THEN 1 ELSE 0 END active
    FROM trial_activations t LEFT JOIN subscriptions s ON s.store_id=t.store_id WHERE t.owner_id=?`,
    owner,
  ).first<{ store_id: string; started_at: number; expires_at: number; active: number }>();
  return trial
    ? { ...trial, available: false, active: !!trial.active }
    : { available: true, active: false };
}
export async function activateTrial(env: Env, store: StoreRow) {
  requireThat(store.owner_id, 'Сначала подключите владельца', 409);
  const existing = await trialStatus(env, store.owner_id);
  if (!existing.available) {
    requireThat(
      'store_id' in existing && existing.store_id === store.id,
      'Пробный период уже использован на другом сайте',
      409,
    );
    return { trial: existing, subscription: await subscriptionFor(env, store.id), duplicate: true };
  }
  requireThat(store.status === 'demo', 'Пробный период доступен для неактивированного демо', 409);
  requireThat(!(await subscriptionFor(env, store.id)), 'У этого сайта уже есть подписка', 409);
  const now = Math.floor(Date.now() / 1000),
    expiry = now + trialSeconds;
  try {
    await env.DB.batch([
      storeMutationGuard(env, store),
      stmt(
        env,
        'INSERT INTO trial_activations(owner_id,store_id,started_at,expires_at) VALUES(?,?,?,?)',
        store.owner_id,
        store.id,
        now,
        expiry,
      ),
      stmt(
        env,
        "UPDATE stores SET status='active',orders_enabled=1,version=version+1 WHERE id=?",
        store.id,
      ),
      stmt(
        env,
        'INSERT INTO subscriptions(store_id,started_at,expires_at) VALUES(?,?,?)',
        store.id,
        now,
        expiry,
      ),
      stmt(env, 'DELETE FROM mutation_guards'),
    ]);
  } catch (e) {
    if (/UNIQUE constraint|CHECK constraint/.test(String(e)))
      throw new HttpError(
        409,
        'Сайт изменился или пробный период уже использован. Обновите страницу.',
      );
    throw e;
  }
  return {
    trial: await trialStatus(env, store.owner_id),
    subscription: await subscriptionFor(env, store.id),
  };
}
