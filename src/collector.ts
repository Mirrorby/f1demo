import { catalog, ownedStore, stmt, storeMutationGuard } from './catalog';
import {
  HttpError,
  int,
  limitedBytes,
  object,
  product,
  requireThat,
  settings,
  text,
} from './validation';

interface ImportJob {
  id: string;
  instagram: string;
  template_id: string;
  language: string;
  currency: string;
  reference_id: string | null;
  store_id: string;
  sample_content: number;
}
interface Task {
  kind: string;
  remote_id: string | null;
  status: string;
  summary: string;
}
const terminal = ['ready', 'needs_review', 'restricted', 'failed', 'interrupted'];
export const collectorEnabled = (env: Env) => !!(env.IMPORT_API_ORIGIN && env.IMPORT_API_TOKEN);

async function remote(env: Env, path: string, data?: unknown, key?: string) {
  requireThat(collectorEnabled(env), 'Сборщик пока не подключён', 503);
  const base = new URL(env.IMPORT_API_ORIGIN!);
  requireThat(
    base.protocol === 'https:' &&
      base.pathname === '/' &&
      !base.username &&
      !base.password &&
      !base.search &&
      !base.hash,
    'Ошибка настройки сборщика',
    503,
  );
  const response = await fetch(new URL(path, base), {
    method: data === undefined ? 'GET' : 'POST',
    redirect: 'manual',
    headers: {
      Authorization: 'Bearer ' + env.IMPORT_API_TOKEN,
      ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(12000),
  });
  requireThat(response.ok, 'Сборщик временно недоступен. Повторите проверку.', 503);
  return object(JSON.parse(new TextDecoder().decode(await limitedBytes(response, 3_000_000))));
}
async function jobFor(env: Env, owner: string, id: string) {
  const job = await stmt(
    env,
    'SELECT * FROM demo_build_jobs WHERE id=? AND owner_id=?',
    id,
    owner,
  ).first<ImportJob>();
  requireThat(job, 'Задание не найдено', 404);
  return job;
}
export async function syncCollector(env: Env, owner: string, id: string) {
  const job = await jobFor(env, owner, id);
  if (!collectorEnabled(env) || !job.sample_content) return;
  for (const kind of ['instagram', ...(job.reference_id ? ['website'] : [])]) {
    await stmt(
      env,
      'INSERT INTO collector_tasks(job_id,kind) VALUES(?,?) ON CONFLICT DO NOTHING',
      id,
      kind,
    ).run();
    const task = (await stmt(
      env,
      'SELECT * FROM collector_tasks WHERE job_id=? AND kind=?',
      id,
      kind,
    ).first<Task>())!;
    if (terminal.includes(task.status)) continue;
    const lease = await stmt(
      env,
      'UPDATE collector_tasks SET lease_until=unixepoch()+45 WHERE job_id=? AND kind=? AND lease_until<unixepoch() AND checked_at<unixepoch()-5',
      id,
      kind,
    ).run();
    if (!lease.meta.changes) continue;
    try {
      let result;
      if (task.remote_id) result = await remote(env, '/v1/jobs/' + task.remote_id);
      else {
        const ref = job.reference_id
          ? await stmt(env, 'SELECT url FROM site_references WHERE id=?', job.reference_id).first<{
              url: string;
            }>()
          : null;
        result = await remote(
          env,
          '/v1/jobs',
          kind === 'website'
            ? { kind, url: ref!.url }
            : {
                instagram: job.instagram,
                theme: job.template_id,
                language: ['ru', 'en'].includes(job.language) ? job.language : 'auto',
                currency: job.currency,
                products: 6,
              },
          'delokay-' + id + '-' + kind,
        );
      }
      const remoteId = text(result.id, 32, true),
        status = text(result.status, 30, true);
      requireThat(
        /^[a-f0-9]{32}$/.test(remoteId) && ['queued', 'running', ...terminal].includes(status),
        'Некорректный ответ сборщика',
        502,
      );
      const summary = JSON.stringify({
        status,
        products: result.products,
        profile: result.profile,
        issues: result.issues,
        error: result.error,
        ...(kind === 'website' ? { reference: result.reference } : {}),
      });
      await stmt(
        env,
        'UPDATE collector_tasks SET remote_id=?,status=?,summary=?,checked_at=unixepoch(),lease_until=0 WHERE job_id=? AND kind=?',
        remoteId,
        status,
        summary,
        id,
        kind,
      ).run();
      if (kind === 'website' && status === 'ready' && result.reference) {
        await stmt(
          env,
          "UPDATE site_references SET analysis=?,status='available' WHERE id=?",
          JSON.stringify(result.reference),
          job.reference_id,
        ).run();
      }
      if (kind === 'instagram')
        await stmt(
          env,
          'UPDATE demo_build_jobs SET status=?,updated_at=unixepoch() WHERE id=? AND sample_content=1',
          ['queued', 'running', 'ready', 'needs_review'].includes(status)
            ? 'running'
            : 'awaiting_import',
          id,
        ).run();
    } catch {
      // Preserve the remote ID and idempotency key: a lost response never creates a duplicate.
      await stmt(
        env,
        'UPDATE collector_tasks SET checked_at=unixepoch(),lease_until=0 WHERE job_id=? AND kind=?',
        id,
        kind,
      ).run();
    }
  }
}

async function archivePhoto(env: Env, input: unknown, storeId: string, uploaded: string[]) {
  const url = new URL(text(input, 3000, true));
  requireThat(
    url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      /\.(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname),
    'Неизвестный источник фотографии',
    502,
  );
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  requireThat(response.ok, 'Фото Instagram недоступно. Импорт не применён.', 502);
  const bytes = await limitedBytes(response, 3 * 1024 * 1024);
  let ext = '',
    mime = '';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    ext = 'jpg';
    mime = 'image/jpeg';
  } else if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) {
    ext = 'png';
    mime = 'image/png';
  } else if (
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  ) {
    ext = 'webp';
    mime = 'image/webp';
  }
  requireThat(ext, 'Формат фото не поддерживается', 502);
  const key = storeId + '/' + crypto.randomUUID() + '.' + ext;
  await env.IMAGES.put(key, bytes, {
    httpMetadata: { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' },
  });
  uploaded.push(key);
  return '/media/' + key;
}

export async function applyCollector(env: Env, owner: string, id: string, input: unknown) {
  const job = await jobFor(env, owner, id);
  requireThat(job.sample_content === 1, 'Импорт уже применён', 409);
  const store = await ownedStore(env, job.store_id, owner);
  requireThat(
    store.status === 'demo' &&
      store.version === int(object(input).version, 1, Number.MAX_SAFE_INTEGER),
    'Магазин изменился. Обновите панель.',
    409,
  );
  const task = await stmt(
    env,
    "SELECT * FROM collector_tasks WHERE job_id=? AND kind='instagram'",
    id,
  ).first<Task>();
  requireThat(
    task?.remote_id && ['ready', 'needs_review'].includes(task.status),
    'Сначала дождитесь сбора данных',
    409,
  );
  const before = await catalog(env, store.id);
  const bundle = await remote(env, '/v1/jobs/' + task.remote_id + '/bundle');
  requireThat(bundle.username === job.instagram, 'Данные другого аккаунта', 502);
  const source = object(bundle.source),
    imported = object(bundle.store);
  requireThat(
    Array.isArray(imported.products) &&
      imported.products.length > 0 &&
      imported.products.length <= 6 &&
      Array.isArray(source.photo_posts),
    'Нет товаров для импорта',
    409,
  );
  const posts = source.photo_posts
    .map(object)
    .filter((p) => p.date && Array.isArray(p.assets) && p.assets.length);
  requireThat(posts.length === imported.products.length, 'Неполные данные товаров', 502);
  const uploaded: string[] = [];
  try {
    const oldSettings = JSON.parse(store.settings);
    const cfg = settings(
      {
        ...oldSettings,
        ...object(imported.settings),
        theme: job.template_id,
        language: job.language,
        currencies: [job.currency],
        texts: oldSettings.texts,
        backgrounds: oldSettings.backgrounds,
        logo: source.logo_url
          ? await archivePhoto(env, source.logo_url, store.id, uploaded)
          : oldSettings.logo,
      },
      store.id,
    );
    const normalized = [];
    for (let i = 0; i < imported.products.length; i++) {
      const images = posts[i].images;
      requireThat(Array.isArray(images) && images.length, 'Нет фотографии товара', 502);
      normalized.push({
        id: crypto.randomUUID(),
        ...product(
          {
            ...object(imported.products[i]),
            photos: [await archivePhoto(env, images[0], store.id, uploaded)],
          },
          cfg,
          store.id,
        ),
      });
    }
    const products = normalized.map((p) => ({ id: p.id, data: JSON.stringify(p.data) }));
    const variants = normalized.flatMap((p) => p.variants.map((v) => ({ ...v, productId: p.id })));
    await env.DB.batch([
      storeMutationGuard(env, store),
      stmt(
        env,
        "INSERT INTO mutation_guards(ok) SELECT CASE WHEN (SELECT sample_content FROM demo_build_jobs WHERE id=?)=1 AND (SELECT COUNT(*) FROM products WHERE store_id=? AND deleted_at IS NULL)=? AND NOT EXISTS(SELECT 1 FROM json_each(?) j LEFT JOIN products p ON p.id=json_extract(j.value,'$.id') AND p.store_id=? WHERE p.id IS NULL OR p.deleted_at IS NOT NULL OR p.version<>json_extract(j.value,'$.version')) THEN 1 ELSE 0 END",
        id,
        store.id,
        before.length,
        JSON.stringify(before.map((p) => ({ id: p.id, version: p.version }))),
        store.id,
      ),
      stmt(
        env,
        'UPDATE products SET deleted_at=unixepoch() WHERE store_id=? AND deleted_at IS NULL',
        store.id,
      ),
      stmt(
        env,
        "INSERT INTO products(id,store_id,data) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.data') FROM json_each(?)",
        store.id,
        JSON.stringify(products),
      ),
      stmt(
        env,
        "INSERT INTO variants(id,store_id,product_id,label,stock) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.productId'),json_extract(value,'$.label'),json_extract(value,'$.stock') FROM json_each(?)",
        store.id,
        JSON.stringify(variants),
      ),
      stmt(
        env,
        'UPDATE stores SET name=?,settings=?,version=version+1 WHERE id=?',
        text(imported.name, 200, true),
        JSON.stringify(cfg),
        store.id,
      ),
      stmt(
        env,
        "UPDATE demo_build_jobs SET sample_content=0,status='ready',updated_at=unixepoch() WHERE id=?",
        id,
      ),
      stmt(env, 'DELETE FROM mutation_guards'),
    ]);
  } catch (error) {
    if (uploaded.length) await env.IMAGES.delete(uploaded);
    if (String(error).includes('CHECK constraint'))
      throw new HttpError(409, 'Каталог изменился. Обновите панель.');
    throw error;
  }
  return { ok: true };
}
