import { stmt } from './catalog';
import { limitedBytes, object, requireThat } from './validation';
import type { StoreRow } from './types';

export async function shortLink(env: Env, store: StoreRow) {
  requireThat(env.DEPLOYMENT_ENV !== 'staging', 'Короткие ссылки доступны после публикации', 409);
  const existing = await stmt(
    env,
    'SELECT url FROM catalog_short_links WHERE store_id=?',
    store.id,
  ).first<{ url: string | null }>();
  if (existing?.url) return { url: existing.url };
  const target = new URL('/c/' + store.slug, env.PUBLIC_ORIGIN);
  requireThat(target.protocol === 'https:', 'Не настроен адрес каталога', 503);
  // Reserve one store and throttle the shared provider. Failures remain retryable after a minute.
  const lease = await stmt(
    env,
    `INSERT INTO catalog_short_links(store_id,target,lease_until) VALUES(?,?,unixepoch()+60)
    ON CONFLICT(store_id) DO UPDATE SET lease_until=unixepoch()+60
    WHERE catalog_short_links.url IS NULL AND catalog_short_links.lease_until<unixepoch() RETURNING store_id`,
    store.id,
    target.href,
  ).first();
  requireThat(lease, 'Ссылка ещё создаётся. Повторите через минуту.', 429);
  const throttle = await stmt(
    env,
    `INSERT INTO maintenance_state(key,value) VALUES('shortener_next',CAST(unixepoch()+20 AS TEXT))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(maintenance_state.value AS INTEGER)<unixepoch() RETURNING key`,
  ).first();
  requireThat(throttle, 'Сервис занят. Повторите через минуту.', 429);
  try {
    const response = await fetch('https://is.gd/create.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ format: 'json', url: target.href }),
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
    requireThat(response.ok, 'Сокращатель временно недоступен. Повторите через минуту.', 502);
    const result = object(JSON.parse(new TextDecoder().decode(await limitedBytes(response, 8192))));
    requireThat(
      typeof result.shorturl === 'string' &&
        /^https:\/\/is\.gd\/[A-Za-z0-9_]{1,30}$/.test(result.shorturl),
      'Не удалось создать короткую ссылку. Повторите через минуту.',
      502,
    );
    await stmt(
      env,
      'UPDATE catalog_short_links SET url=?,lease_until=0 WHERE store_id=?',
      result.shorturl,
      store.id,
    ).run();
    return { url: result.shorturl };
  } catch (e) {
    console.warn(JSON.stringify({ event: 'shortener_unavailable', storeId: store.id }));
    throw e;
  }
}
