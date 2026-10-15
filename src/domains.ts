import { equalSecret } from './auth';
import { stmt } from './catalog';
import { HttpError, int, limitedBytes, object, requireThat, text } from './validation';

interface DomainConfig {
  zone_id: string;
  cname_target: string;
  version: number;
}
export interface DomainRow {
  id: string;
  store_id: string;
  hostname: string;
  verification_token: string;
  cloudflare_id: string | null;
  provision_started: number;
  status: string;
  hostname_status: string;
  ssl_status: string;
  validation_records: string;
  error: string;
  checked_at: number | null;
  lease_until: number;
}
interface RemoteHostname {
  id: string;
  hostname: string;
  status: string;
  ownership_verification?: { name: string; type: string; value: string };
  ssl?: {
    status?: string;
    validation_records?: { txt_name?: string; txt_value?: string }[];
    validation_errors?: { message?: string }[];
  };
}
// Optional secret: ordinary catalog operation does not require Cloudflare API access.
function apiToken(env: Env) {
  return 'CUSTOM_DOMAINS_API_TOKEN' in env && typeof env.CUSTOM_DOMAINS_API_TOKEN === 'string'
    ? env.CUSTOM_DOMAINS_API_TOKEN
    : '';
}
export function hostname(input: unknown) {
  const raw = text(input, 253, true).toLowerCase().replace(/\.$/, '');
  requireThat(!/[\s/@:#?%\\]/.test(raw), 'Введите только домен, без https://, порта и пути');
  let host = '';
  try {
    host = new URL('https://' + raw).hostname;
  } catch {
    /* validated below */
  }
  requireThat(
    host.length <= 253 &&
      host.split('.').length >= 2 &&
      host.split('.').every((s) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s)) &&
      /[a-z]/.test(host.split('.').at(-1) || ''),
    'Недопустимый домен',
  );
  requireThat(
    !/(^|\.)(localhost|local|internal|test|invalid|example|workers\.dev|pages\.dev)$/.test(host),
    'Нужен собственный публичный домен',
  );
  return host;
}
async function readJson<T>(response: Response): Promise<T> {
  const bytes = await limitedBytes(response, 128000);
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new HttpError(502, 'Сервис доменов вернул некорректный ответ');
  }
}
async function cf<T>(env: Env, zone: string, path: string, method = 'GET', body?: unknown) {
  const token = apiToken(env);
  requireThat(token, 'Добавьте секрет CUSTOM_DOMAINS_API_TOKEN в настройках Worker', 503);
  let r: Response;
  try {
    r = await fetch('https://api.cloudflare.com/client/v4/zones/' + zone + path, {
      method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new HttpError(502, 'Cloudflare не ответил. Повторите проверку.');
  }
  const data = await readJson<{ success: boolean; result: T; errors?: { code: number }[] }>(r);
  if (r.status === 404) throw new HttpError(404, 'Подключение не найдено в Cloudflare');
  requireThat(
    r.ok && data.success,
    `Cloudflare: проверьте API-токен, права на зону и Cloudflare for SaaS (HTTP ${r.status})`,
    502,
  );
  return data.result;
}
async function config(env: Env) {
  return stmt(env, 'SELECT * FROM platform_domain_config WHERE id=1').first<DomainConfig>();
}
export async function domainConfig(env: Env) {
  const c = await config(env);
  return {
    zoneId: c?.zone_id || '',
    cnameTarget: c?.cname_target || '',
    version: c?.version || 0,
    tokenConfigured: !!apiToken(env),
  };
}
export async function saveDomainConfig(env: Env, input: unknown) {
  const d = object(input),
    zone = text(d.zoneId, 32, true),
    target = hostname(d.cnameTarget),
    version = int(d.version, 0, Number.MAX_SAFE_INTEGER);
  requireThat(/^[a-f0-9]{32}$/.test(zone), 'Zone ID: 32 символа из панели Cloudflare');
  requireThat(
    target !== new URL(env.PUBLIC_ORIGIN).hostname,
    'Используйте отдельный CNAME-адрес для клиентских сайтов',
  );
  // Do not change a live zone/target or race a provision/delete operation.
  const result = await stmt(
    env,
    `INSERT INTO platform_domain_config(id,zone_id,cname_target,version)
    SELECT 1,?,?,1 WHERE ?=0 AND NOT EXISTS(SELECT 1 FROM platform_domain_config)
    ON CONFLICT(id) DO NOTHING`,
    zone,
    target,
    version,
  ).run();
  if (!result.meta.changes) {
    const updated = await stmt(
      env,
      `UPDATE platform_domain_config SET zone_id=?,cname_target=?,version=version+1 WHERE id=1 AND version=?
      AND (zone_id=? AND cname_target=? OR NOT EXISTS(SELECT 1 FROM store_domains WHERE cloudflare_id IS NOT NULL OR provision_started=1 OR lease_until>unixepoch()))`,
      zone,
      target,
      version,
      zone,
      target,
    ).run();
    requireThat(
      updated.meta.changes === 1,
      'Настройки изменены либо уже используются доменами. Сначала отключите домены.',
      409,
    );
  }
  return domainConfig(env);
}
export async function checkDomainConfig(env: Env) {
  const c = await config(env);
  requireThat(c, 'Сначала сохраните Zone ID и CNAME-адрес', 409);
  const [zone, fallback, routes] = await Promise.all([
    cf<{ name: string; status: string }>(env, c.zone_id, ''),
    cf<{ origin: string; status: string }>(env, c.zone_id, '/custom_hostnames/fallback_origin'),
    cf<{ pattern: string; script: string }[]>(env, c.zone_id, '/workers/routes'),
  ]);
  requireThat(zone.status === 'active', 'Основной домен ещё не активирован в Cloudflare', 409);
  requireThat(
    c.cname_target.endsWith('.' + zone.name),
    'CNAME-адрес должен принадлежать выбранной зоне',
    409,
  );
  requireThat(
    fallback.status === 'active',
    'Настройте активный fallback origin в Cloudflare for SaaS',
    409,
  );
  requireThat(
    routes.some((r) => r.pattern === '*/*' && r.script === 'catalog-factory'),
    'В выбранной SaaS-зоне добавьте Workers Route */* → catalog-factory',
    409,
  );
  return { ok: true, fallbackOrigin: fallback.origin };
}
export async function listDomains(env: Env, storeId?: string) {
  const c = await config(env);
  const rows = await stmt(
    env,
    `SELECT * FROM store_domains ${storeId ? 'WHERE store_id=?' : ''} ORDER BY created_at DESC,id LIMIT 500`,
    ...(storeId ? [storeId] : []),
  ).all<DomainRow>();
  return rows.results.map((r) => ({
    id: r.id,
    storeId: r.store_id,
    hostname: r.hostname,
    url: 'https://' + r.hostname,
    status: r.status,
    hostnameStatus: r.hostname_status,
    sslStatus: r.ssl_status,
    checkedAt: r.checked_at,
    error: r.error,
    dnsRecords: [
      ...(c
        ? [{ type: 'CNAME', name: r.hostname, value: c.cname_target, purpose: 'Адрес сайта' }]
        : []),
      {
        type: 'TXT',
        name: '_delokay.' + r.hostname,
        value: r.verification_token,
        purpose: 'Подтверждение подключения к Delokay',
      },
      ...JSON.parse(r.validation_records),
    ],
  }));
}
export async function addDomain(env: Env, storeId: string, input: unknown) {
  const d = object(input),
    host = hostname(d.hostname),
    c = await config(env);
  requireThat(
    host !== new URL(env.PUBLIC_ORIGIN).hostname && host !== c?.cname_target,
    'Служебный домен нельзя привязать к магазину',
  );
  const store = await stmt(env, 'SELECT id FROM stores WHERE id=?', storeId).first();
  requireThat(store, 'Магазин не найден', 404);
  try {
    const r = await stmt(
      env,
      `INSERT INTO store_domains(id,store_id,hostname,verification_token)
      SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM store_domains WHERE store_id=?)<5`,
      crypto.randomUUID(),
      storeId,
      host,
      crypto.randomUUID() + crypto.randomUUID(),
      storeId,
    ).run();
    requireThat(r.meta.changes === 1, 'Максимум пять доменов на магазин', 409);
  } catch (e) {
    if (String(e).includes('UNIQUE'))
      throw new HttpError(409, 'Домен уже добавлен. Сначала отключите прежнюю привязку.');
    throw e;
  }
  return listDomains(env, storeId);
}
async function lockDomain(env: Env, storeId: string, id: string) {
  const r = await stmt(
    env,
    'UPDATE store_domains SET lease_until=unixepoch()+120 WHERE id=? AND store_id=? AND lease_until<unixepoch() RETURNING *',
    id,
    storeId,
  ).first<DomainRow>();
  requireThat(r, 'Домен не найден или уже проверяется. Повторите позже.', 409);
  return r;
}
async function txtOwned(row: DomainRow) {
  const r = await fetch(
    'https://cloudflare-dns.com/dns-query?name=' +
      encodeURIComponent('_delokay.' + row.hostname) +
      '&type=TXT',
    {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(8000),
      redirect: 'manual',
    },
  );
  requireThat(r.ok, 'Не удалось проверить DNS', 502);
  const data = await readJson<{ Status: number; Answer?: { type: number; data: string }[] }>(r);
  return (
    data.Status === 0 &&
    data.Answer?.some(
      (a) =>
        a.type === 16 &&
        a.data.replace(/"\s*"/g, '').replace(/^"|"$/g, '') === row.verification_token,
    )
  );
}
export async function domainProof(env: Env, row: DomainRow, nonce: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.PLATFORM_API_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(row.id + ':' + row.hostname + ':' + nonce),
  );
  return Array.from(new Uint8Array(signed), (v) => v.toString(16).padStart(2, '0')).join('');
}
export async function checkDomain(env: Env, storeId: string, id: string) {
  const row = await lockDomain(env, storeId, id);
  try {
    const c = await config(env);
    requireThat(c, 'Сначала настройте подключение доменов в панели', 409);
    await checkDomainConfig(env);
    await stmt(env, 'UPDATE store_domains SET provision_started=1 WHERE id=?', id).run();
    let remote: RemoteHostname;
    if (row.cloudflare_id)
      remote = await cf(env, c.zone_id, '/custom_hostnames/' + row.cloudflare_id);
    else {
      // Reconcile after a lost create response before creating another paid resource.
      const existing = await cf<RemoteHostname[]>(
        env,
        c.zone_id,
        '/custom_hostnames?hostname=' + encodeURIComponent(row.hostname),
      );
      remote =
        existing.find((r) => r.hostname === row.hostname) ||
        (await cf<RemoteHostname>(env, c.zone_id, '/custom_hostnames', 'POST', {
          hostname: row.hostname,
          ssl: { method: 'txt', type: 'dv', settings: { min_tls_version: '1.2' } },
        }));
    }
    requireThat(
      remote.hostname === row.hostname && /^[a-f0-9-]{32,36}$/.test(remote.id),
      'Cloudflare вернул другой домен',
      502,
    );
    // Persist remote ID immediately, even while DNS and certificates are pending.
    const records: { type: string; name: string; value: string; purpose: string }[] = [];
    if (remote.ownership_verification?.type?.toLowerCase() === 'txt')
      records.push({
        type: 'TXT',
        name: remote.ownership_verification.name,
        value: remote.ownership_verification.value,
        purpose: 'Подтверждение владения для Cloudflare',
      });
    for (const v of remote.ssl?.validation_records || [])
      if (v.txt_name && v.txt_value)
        records.push({
          type: 'TXT',
          name: v.txt_name,
          value: v.txt_value,
          purpose: 'Сертификат HTTPS',
        });
    await stmt(
      env,
      "UPDATE store_domains SET cloudflare_id=?,hostname_status=?,ssl_status=?,validation_records=?,status=CASE WHEN status='active' AND ?='active' AND ?='active' THEN 'active' ELSE 'pending' END,error='' WHERE id=?",
      remote.id,
      remote.status,
      remote.ssl?.status || '',
      JSON.stringify(records),
      remote.status,
      remote.ssl?.status || '',
      row.id,
    ).run();
    let state = 'pending',
      message = '';
    if (remote.status !== 'active' || remote.ssl?.status !== 'active')
      message =
        'Ожидаем подтверждения домена и выпуска HTTPS. Добавьте DNS-записи и повторите проверку.';
    else if (!(await txtOwned(row)))
      message = 'TXT-запись Delokay пока не найдена. Проверьте запись и дождитесь обновления DNS.';
    else {
      const nonce = crypto.randomUUID();
      try {
        const probe = await fetch(
          'https://' + row.hostname + '/__delokay/domain-check?nonce=' + nonce,
          { redirect: 'manual', signal: AbortSignal.timeout(10000) },
        );
        const expected = await domainProof(env, row, nonce);
        if (probe.ok && (await equalSecret(probe.headers.get('X-Delokay-Proof') || '', expected)))
          state = 'active';
        else message = 'Домен пока не открывает Delokay. Проверьте CNAME/ALIAS и маршрут Worker.';
        await probe.body?.cancel();
      } catch {
        message = 'HTTPS-сайт пока недоступен. Проверьте DNS и повторите проверку.';
      }
    }
    await stmt(
      env,
      'UPDATE store_domains SET status=?,error=?,checked_at=unixepoch() WHERE id=?',
      state,
      message,
      id,
    ).run();
  } catch (e) {
    await stmt(
      env,
      "UPDATE store_domains SET status=CASE WHEN status='active' THEN 'active' ELSE 'error' END,error=?,checked_at=unixepoch() WHERE id=?",
      e instanceof HttpError ? e.message : 'Не удалось проверить домен. Повторите проверку.',
      id,
    ).run();
  } finally {
    await stmt(env, 'UPDATE store_domains SET lease_until=0 WHERE id=?', id).run();
  }
  return listDomains(env, storeId);
}
export async function removeDomain(env: Env, storeId: string, id: string) {
  const row = await lockDomain(env, storeId, id);
  try {
    // Revoke routing first; preserve the row if provider deletion fails.
    await stmt(env, "UPDATE store_domains SET status='disconnecting' WHERE id=?", id).run();
    if (row.cloudflare_id || row.provision_started) {
      const c = await config(env);
      requireThat(c, 'Настройки Cloudflare отсутствуют', 409);
      let remoteId = row.cloudflare_id;
      if (!remoteId) {
        const existing = await cf<RemoteHostname[]>(
          env,
          c.zone_id,
          '/custom_hostnames?hostname=' + encodeURIComponent(row.hostname),
        );
        remoteId = existing.find((r) => r.hostname === row.hostname)?.id || null;
      }
      try {
        if (remoteId) await cf(env, c.zone_id, '/custom_hostnames/' + remoteId, 'DELETE');
      } catch (e) {
        if (!(e instanceof HttpError && e.status === 404)) throw e;
      }
    }
    await stmt(env, 'DELETE FROM store_domains WHERE id=?', id).run();
  } catch (e) {
    await stmt(
      env,
      'UPDATE store_domains SET error=?,lease_until=0 WHERE id=?',
      e instanceof HttpError ? e.message : 'Не удалось отключить домен',
      id,
    ).run();
    throw e;
  }
  return listDomains(env, storeId);
}
export async function domainUrl(env: Env, storeId: string) {
  const r = await stmt(
    env,
    "SELECT hostname FROM store_domains WHERE store_id=? AND status='active' ORDER BY created_at,id LIMIT 1",
    storeId,
  ).first<{ hostname: string }>();
  return r ? 'https://' + r.hostname : '';
}
export async function incomingDomain(request: Request, env: Env) {
  const url = new URL(request.url);
  if ([new URL(env.PUBLIC_ORIGIN).hostname, 'localhost', '127.0.0.1'].includes(url.hostname))
    return null;
  const row = await stmt(
    env,
    'SELECT * FROM store_domains WHERE hostname=?',
    url.hostname.toLowerCase(),
  ).first<DomainRow>();
  requireThat(row, 'Домен не подключён', 404);
  if (url.protocol !== 'https:')
    return Response.redirect('https://' + url.host + url.pathname + url.search, 308);
  if (url.pathname === '/__delokay/domain-check' && request.method === 'GET') {
    const nonce = url.searchParams.get('nonce') || '';
    requireThat(/^[a-f0-9-]{36}$/.test(nonce), 'Недопустимая проверка');
    requireThat(row.status !== 'disconnecting', 'Домен отключается', 404);
    return new Response(null, {
      headers: {
        'X-Delokay-Proof': await domainProof(env, row, nonce),
        'Cache-Control': 'no-store',
      },
    });
  }
  requireThat(row.status === 'active', 'Домен ожидает подключения', 503);
  return row;
}
