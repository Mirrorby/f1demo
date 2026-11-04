import { tributeConfig } from './tribute';
import { digitalProduct } from './tribute-digital';
import { stmt, storeMutationGuard } from './catalog';
import { monthFrom, subscriptionFor } from './subscriptions';
import { object, text, requireThat } from './validation';
import type { StoreRow } from './types';
export const catalogPlan = { amountMinor: 2499, currency: 'usd', months: 1, sites: 1 };
export async function catalogPlanConfig(env: Env) {
  try {
    const config = await tributeConfig(env);
    const matching =
      config.configured &&
      'amountMinor' in config &&
      config.amountMinor === catalogPlan.amountMinor &&
      'currency' in config &&
      String(config.currency).toLowerCase() === catalogPlan.currency;
    return {
      ...config,
      configured: !!matching,
      paymentUrl: matching && 'paymentUrl' in config ? config.paymentUrl : null,
      plan: catalogPlan,
    };
  } catch {
    return { configured: false, paymentUrl: null, plan: catalogPlan };
  }
}
export async function applyCatalogPurchase(env: Env, store: StoreRow, input: unknown) {
  const purchaseId = text(object(input).purchaseId, 30, true);
  requireThat(/^\d+$/.test(purchaseId), 'Некорректная покупка');
  const remote = await digitalProduct(env);
  requireThat(
    remote.amount === 2499 && String(remote.currency).toLowerCase() === 'usd',
    'Товар месячного тарифа ещё не настроен',
    409,
  );
  const purchase = await stmt(
    env,
    `SELECT p.*,a.store_id applied_store FROM tribute_digital_purchases p LEFT JOIN catalog_purchase_activations a ON a.purchase_id=p.purchase_id WHERE p.purchase_id=? AND p.owner_id=?`,
    purchaseId,
    store.owner_id,
  ).first<{
    status: string;
    product_id: number;
    amount_minor: number;
    currency: string;
    applied_store: string | null;
  }>();
  requireThat(
    purchase &&
      purchase.status === 'paid' &&
      purchase.product_id === remote.id &&
      purchase.amount_minor === 2499 &&
      purchase.currency.toLowerCase() === 'usd',
    'Нет подходящей подтверждённой оплаты',
    409,
  );
  if (purchase.applied_store) {
    requireThat(
      purchase.applied_store === store.id,
      'Эта оплата уже использована для другого сайта',
      409,
    );
    return { subscription: await subscriptionFor(env, store.id), duplicate: true };
  }
  const sub = await subscriptionFor(env, store.id),
    now = Math.floor(Date.now() / 1000);
  const expiry = monthFrom(Math.max(now, sub?.expires_at || 0), 1);
  await env.DB.batch([
    storeMutationGuard(env, store),
    stmt(
      env,
      `INSERT INTO catalog_purchase_activations(purchase_id,store_id,expires_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM tribute_digital_purchases WHERE purchase_id=? AND owner_id=? AND status='paid')`,
      purchaseId,
      store.id,
      expiry,
      purchaseId,
      store.owner_id,
    ),
    stmt(
      env,
      `INSERT INTO mutation_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM catalog_purchase_activations WHERE purchase_id=? AND store_id=?) THEN 1 ELSE 0 END`,
      purchaseId,
      store.id,
    ),
    stmt(
      env,
      "UPDATE stores SET status='active',orders_enabled=1,version=version+1 WHERE id=?",
      store.id,
    ),
    stmt(
      env,
      `INSERT INTO subscriptions(store_id,started_at,expires_at) VALUES(?,?,?) ON CONFLICT(store_id) DO UPDATE SET expires_at=excluded.expires_at,reminder_sent_at=NULL,reminder_attempts=0,reminder_next_at=0,reminder_lease_until=0,updated_at=unixepoch()`,
      store.id,
      now,
      expiry,
    ),
    stmt(env, 'DELETE FROM mutation_guards'),
  ]);
  return { subscription: await subscriptionFor(env, store.id) };
}

export async function configureCatalogPlan(env: Env, input: unknown) {
  let url = text(object(input).productUrl, 300, true);
  const telegram = url.match(/^https:\/\/t\.me\/tribute\/app\?startapp=p([A-Za-z0-9]+)$/);
  if (telegram) url = 'https://web.tribute.tg/p/' + telegram[1];
  requireThat(
    /^https:\/\/web\.tribute\.tg\/p\/[A-Za-z0-9]+$/.test(url),
    'Укажите ссылку товара Tribute',
  );
  const remote = await digitalProduct(env, url);
  requireThat(
    remote.amount === 2499 && String(remote.currency).toLowerCase() === 'usd',
    'Товар должен стоить ровно 24,99 USD',
    409,
  );
  await stmt(
    env,
    'INSERT INTO platform_plan_settings(id,product_url) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET product_url=excluded.product_url,updated_at=unixepoch()',
    url,
  ).run();
  return { ok: true, productUrl: url };
}
