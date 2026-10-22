import { catalog, createStore, stmt, storeMutationGuard } from './catalog';
import { HttpError, int, object, requireThat, text } from './validation';
import type { Settings, StoreRow } from './types';

export async function setOrderIntake(env: Env, s: StoreRow, input: unknown) {
  const d = object(input);
  requireThat(s.status === 'active', 'Сначала активируйте магазин', 409);
  requireThat(typeof d.enabled === 'boolean', 'Укажите состояние приёма заказов');
  const result = await stmt(
    env,
    'UPDATE stores SET orders_enabled=?,version=version+1 WHERE id=? AND version=?',
    d.enabled ? 1 : 0,
    s.id,
    int(d.version, 1, Number.MAX_SAFE_INTEGER),
  ).run();
  requireThat(result.meta.changes === 1, 'Магазин изменён. Обновите список.', 409);
  return { ok: true };
}

export async function deleteDemo(env: Env, s: StoreRow, input: unknown) {
  const d = object(input);
  requireThat(s.status === 'demo', 'Можно удалить только демо', 409);
  requireThat(d.confirmSlug === s.slug, 'Для удаления введите slug магазина');
  requireThat(int(d.version, 1, Number.MAX_SAFE_INTEGER) === s.version, 'Магазин изменён', 409);
  requireThat(
    !(await stmt(env, 'SELECT id FROM platform_invoices WHERE store_id=? LIMIT 1', s.id).first()),
    'Демо содержит счета и сохраняется для истории платежей',
    409,
  );
  requireThat(
    !(await stmt(env, 'SELECT id FROM store_domains WHERE store_id=? LIMIT 1', s.id).first()),
    'Сначала отключите домены этого магазина',
    409,
  );
  try {
    await env.DB.batch([
      storeMutationGuard(env, s),
      stmt(
        env,
        "INSERT INTO mutation_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM stores WHERE id=? AND status='demo') AND NOT EXISTS(SELECT 1 FROM orders WHERE store_id=?) AND NOT EXISTS(SELECT 1 FROM store_domains WHERE store_id=?) THEN 1 ELSE 0 END",
        s.id,
        s.id,
        s.id,
      ),
      stmt(env, 'INSERT OR IGNORE INTO media_cleanup(store_id) VALUES(?)', s.id),
      stmt(env, 'DELETE FROM owner_invites WHERE store_id=?', s.id),
      stmt(env, 'DELETE FROM variants WHERE store_id=?', s.id),
      stmt(env, 'DELETE FROM products WHERE store_id=?', s.id),
      stmt(env, 'DELETE FROM stores WHERE id=?', s.id),
      stmt(env, 'DELETE FROM mutation_guards'),
    ]);
  } catch (e) {
    if (String(e).includes('CHECK constraint'))
      throw new HttpError(409, 'Магазин изменён или содержит заказы. Обновите список.');
    throw e;
  }
}

export async function cleanupMedia(env: Env) {
  const pending = await stmt(env, 'SELECT store_id FROM media_cleanup LIMIT 1').first<{
    store_id: string;
  }>();
  if (!pending) return;
  try {
    const listed = await env.IMAGES.list({ prefix: pending.store_id + '/', limit: 200 });
    if (listed.objects.length) await env.IMAGES.delete(listed.objects.map((o) => o.key));
    if (!listed.truncated)
      await stmt(env, 'DELETE FROM media_cleanup WHERE store_id=?', pending.store_id).run();
  } catch {
    console.error(JSON.stringify({ event: 'media_cleanup_retry' }));
  }
}

type CopyFile = { source: string; target: string };
type CopyJob = {
  id: string;
  target_id: string;
  payload: string;
  files: string;
  cursor: number;
  status: string;
};
export async function startCopy(env: Env, s: StoreRow, input: unknown) {
  const d = object(input),
    target = crypto.randomUUID(),
    id = crypto.randomUUID();
  const files: CopyFile[] = [],
    mapped = new Map<string, string>();
  function image(url: string) {
    if (!url.startsWith('/media/')) return url;
    requireThat(url.startsWith('/media/' + s.id + '/'), 'Изображение другого магазина');
    if (!mapped.has(url)) {
      const extension = url.slice(url.lastIndexOf('.'));
      const key = target + '/' + crypto.randomUUID() + extension;
      files.push({ source: url.slice(7), target: key });
      mapped.set(url, '/media/' + key);
    }
    return mapped.get(url)!;
  }
  const cfg = JSON.parse(s.settings) as Settings;
  cfg.logo = image(cfg.logo);
  for (const background of Object.values(cfg.backgrounds || {})) {
    if (background) background.image = image(background.image);
  }
  const products = (await catalog(env, s.id)).map((p) => ({
    ...p,
    id: undefined,
    version: undefined,
    photos: p.photos.map(image),
    variants: p.variants.map((v) => ({ label: v.label, stock: v.stock })),
  }));
  const name = text(d.name, 200, true),
    slug = text(d.slug, 80, true);
  requireThat(/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug), 'Slug: латиница, цифры и дефис');
  const payload = JSON.stringify({ name, slug, settings: cfg, products });
  requireThat(
    new TextEncoder().encode(payload + JSON.stringify(files)).length < 1800000,
    'Каталог слишком большой для копирования',
  );
  await stmt(
    env,
    'INSERT INTO store_copy_jobs(id,target_id,name,payload,files) VALUES(?,?,?,?,?)',
    id,
    target,
    name,
    payload,
    JSON.stringify(files),
  ).run();
  return { id, status: 'pending' };
}
export async function listCopies(env: Env) {
  const rows = await stmt(
    env,
    'SELECT id,target_id AS targetId,name,status,error,cursor AS copied,json_array_length(files) AS total FROM store_copy_jobs ORDER BY created_at DESC LIMIT 50',
  ).all();
  return rows.results;
}
export async function processCopy(env: Env, origin: string, jobId?: string, chunkSize = 4) {
  const job = await stmt(
    env,
    "UPDATE store_copy_jobs SET lease_until=unixepoch()+300 WHERE id=(SELECT id FROM store_copy_jobs WHERE status='pending' AND lease_until<unixepoch() AND (? IS NULL OR id=?) ORDER BY created_at LIMIT 1) RETURNING *",
    jobId ?? null,
    jobId ?? null,
  ).first<CopyJob>();
  if (!job) return;
  try {
    const files = JSON.parse(job.files) as CopyFile[];
    const end = Math.min(files.length, job.cursor + chunkSize);
    for (let i = job.cursor; i < end; i++) {
      const object = await env.IMAGES.get(files[i].source);
      requireThat(object, 'Исходное фото больше недоступно', 409);
      await env.IMAGES.put(files[i].target, object.body, {
        httpMetadata: object.httpMetadata,
        customMetadata: object.customMetadata,
      });
    }
    if (end === files.length) {
      const existing = await stmt(env, 'SELECT id FROM stores WHERE id=?', job.target_id).first();
      if (!existing) await createStore(env, JSON.parse(job.payload), origin, job.target_id);
      await stmt(
        env,
        "UPDATE store_copy_jobs SET status='completed',cursor=?,lease_until=0 WHERE id=?",
        end,
        job.id,
      ).run();
    } else {
      await stmt(
        env,
        'UPDATE store_copy_jobs SET cursor=?,lease_until=0 WHERE id=?',
        end,
        job.id,
      ).run();
    }
  } catch {
    // Do not remove media if the final DB insert succeeded before a transient ledger failure.
    const existing = await stmt(env, 'SELECT id FROM stores WHERE id=?', job.target_id).first();
    if (existing) {
      await stmt(
        env,
        "UPDATE store_copy_jobs SET status='completed',lease_until=0 WHERE id=?",
        job.id,
      ).run();
    } else {
      await env.DB.batch([
        stmt(
          env,
          "UPDATE store_copy_jobs SET status='failed',error=?,lease_until=0 WHERE id=?",
          'Не удалось скопировать магазин. Проверьте исходные фотографии и повторите.',
          job.id,
        ),
        stmt(env, 'INSERT OR IGNORE INTO media_cleanup(store_id) VALUES(?)', job.target_id),
      ]);
    }
  }
}
