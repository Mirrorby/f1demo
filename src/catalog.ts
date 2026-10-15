import type { Product, ProductRow, StoreRow, Settings, Variant } from './types';
import { HttpError, object, product, requireThat, settings, text, int } from './validation';
import { findTemplate, resolvedTemplateProducts, templateSettings } from './templates';
export const stmt = (env: Env, sql: string, ...values: (string | number | null)[]) =>
  env.DB.prepare(sql).bind(...values);
export async function storeBySlug(env: Env, slug: string): Promise<StoreRow> {
  const row = await stmt(env, 'SELECT * FROM stores WHERE slug=?', slug).first<StoreRow>();
  requireThat(row, 'Магазин не найден', 404);
  return row;
}
export async function ownedStore(env: Env, id: string, owner: string): Promise<StoreRow> {
  const row = await stmt(
    env,
    'SELECT * FROM stores WHERE id=? AND owner_id=?',
    id,
    owner,
  ).first<StoreRow>();
  requireThat(row, 'Магазин не найден', 404);
  return row;
}
export function publicStore(s: StoreRow, botUsername = '') {
  return {
    id: s.id,
    slug: s.slug,
    shareUrl: botUsername ? `https://t.me/${botUsername}?startapp=s_${s.slug}` : '',
    name: s.name,
    status: s.status,
    version: s.version,
    acceptingOrders: s.orders_enabled === 1,
    settings: JSON.parse(s.settings) as Settings,
  };
}
export async function catalog(env: Env, storeId: string): Promise<Product[]> {
  const [ps, vs] = await env.DB.batch([
    stmt(
      env,
      'SELECT * FROM products WHERE store_id=? AND deleted_at IS NULL ORDER BY created_at,id LIMIT 501',
      storeId,
    ),
    stmt(
      env,
      'SELECT v.* FROM variants v JOIN products p ON p.id=v.product_id WHERE v.store_id=? AND p.deleted_at IS NULL AND v.archived=0',
      storeId,
    ),
  ]);
  requireThat(ps.results.length <= 500, 'Каталог превышает лимит MVP', 409);
  const rows = ps.results as ProductRow[];
  const variantRows = vs.results as {
    product_id: string;
    id: string;
    label: string;
    stock: number | null;
  }[];
  return rows.map((p) => ({
    ...JSON.parse(p.data),
    id: p.id,
    version: p.version,
    variants: variantRows
      .filter((v) => v.product_id === p.id)
      .map((v) => ({
        id: String(v.id),
        label: String(v.label),
        stock: v.stock === null ? null : Number(v.stock),
      })),
  }));
}
export function variantStatements(env: Env, storeId: string, id: string, variants: Variant[]) {
  return variants.map((v) =>
    stmt(
      env,
      'INSERT INTO variants(id,store_id,product_id,label,stock) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,stock=excluded.stock,archived=0 WHERE variants.store_id=excluded.store_id AND variants.product_id=excluded.product_id',
      v.id,
      storeId,
      id,
      v.label,
      v.stock,
    ),
  );
}
export async function createStore(env: Env, input: unknown, origin: string, targetId?: string) {
  const d = object(input);
  requireThat(d.status === undefined || d.status === 'demo', 'Новый магазин создаётся как демо');
  const name = text(d.name, 200, true),
    id = targetId ?? crypto.randomUUID();
  const templateId = text(d.templateId);
  const template = templateId ? findTemplate(templateId) : undefined;
  requireThat(!templateId || template, 'Неизвестный шаблон');
  requireThat(
    d.seedProducts === undefined || typeof d.seedProducts === 'boolean',
    'Недопустимый выбор примерных товаров',
  );
  requireThat(!d.seedProducts || template, 'Выберите шаблон для примерных товаров');
  const defaults: Partial<Settings> = template ? templateSettings(template) : {};
  const supplied = object(d.settings ?? {});
  const cfg = settings(
    {
      ...defaults,
      ...supplied,
      texts: { ...defaults.texts, ...object(supplied.texts ?? {}) },
      description: d.description ?? supplied.description ?? defaults.description,
      accentColor: d.accentColor ?? supplied.accentColor ?? defaults.accentColor,
    },
    id,
  );
  let slug =
    text(d.slug, 80) ||
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    'store';
  requireThat(/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug), 'Slug: латиница, цифры и дефис');
  if (await stmt(env, 'SELECT id FROM stores WHERE slug=?', slug).first())
    slug = slug.slice(0, 65) + '-' + crypto.randomUUID().slice(0, 8);
  const resolved =
    d.seedProducts && template && d.products === undefined
      ? await resolvedTemplateProducts(env, template, cfg.currencies)
      : undefined;
  const files: { source: string; target: string }[] = [];
  const raw =
    d.products ??
    resolved?.products.map((p) => ({
      ...p,
      photos: p.photos.map((url) => {
        if (!resolved.mediaId || !url.startsWith('/media/' + resolved.mediaId + '/')) return url;
        const key = id + '/' + crypto.randomUUID() + url.slice(url.lastIndexOf('.'));
        files.push({ source: url.slice(7), target: key });
        return '/media/' + key;
      }),
    })) ??
    [];
  requireThat(Array.isArray(raw) && raw.length <= (targetId ? 500 : 200), 'Слишком много товаров');
  const normalized = raw.map((p) => ({ id: crypto.randomUUID(), ...product(p, cfg, id) }));
  // A JSON table insert keeps the number of D1 statements below Free's per-invocation limit.
  const products = normalized.map((p) => ({ id: p.id, data: JSON.stringify(p.data) }));
  const variants = normalized.flatMap((p) => p.variants.map((v) => ({ ...v, productId: p.id })));
  try {
    for (const file of files) {
      const source = await env.IMAGES.get(file.source);
      requireThat(source, 'Фото шаблона недоступно. Обновите шаблон.', 409);
      await env.IMAGES.put(file.target, source.body, { httpMetadata: source.httpMetadata });
    }
    await env.DB.batch([
      stmt(
        env,
        'INSERT INTO stores(id,slug,name,settings) VALUES(?,?,?,?)',
        id,
        slug,
        name,
        JSON.stringify(cfg),
      ),
      stmt(
        env,
        "INSERT INTO products(id,store_id,data) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.data') FROM json_each(?)",
        id,
        JSON.stringify(products),
      ),
      stmt(
        env,
        "INSERT INTO variants(id,store_id,product_id,label,stock) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.productId'),json_extract(value,'$.label'),json_extract(value,'$.stock') FROM json_each(?)",
        id,
        JSON.stringify(variants),
      ),
    ]);
  } catch (e) {
    if (files.length) await env.IMAGES.delete(files.map((f) => f.target));
    throw e;
  }
  return { id, slug, status: 'demo', url: `${origin}/s/${slug}` };
}
export async function saveProduct(env: Env, s: StoreRow, input: unknown, id?: string) {
  const d = object(input),
    cfg = JSON.parse(s.settings) as Settings;
  const normalized = product(d, cfg, s.id, !!id);
  const pid = id ?? crypto.randomUUID();
  const statements: D1PreparedStatement[] = [storeMutationGuard(env, s)];
  if (id) {
    const old = await stmt(
      env,
      'SELECT * FROM products WHERE store_id=? AND id=? AND deleted_at IS NULL',
      s.id,
      id,
    ).first<ProductRow>();
    requireThat(old, 'Товар не найден', 404);
    const expected = int(d.version, 1, Number.MAX_SAFE_INTEGER);
    requireThat(expected === old.version, 'Товар уже изменён. Обновите список.', 409);
    const oldVariants = await stmt(
      env,
      'SELECT id FROM variants WHERE store_id=? AND product_id=?',
      s.id,
      id,
    ).all<{ id: string }>();
    requireThat(
      normalized.variants.every(
        (v) =>
          !d.variants ||
          !(d.variants as { id?: string }[]).some((x) => x.id === v.id) ||
          oldVariants.results.some((x) => x.id === v.id),
      ),
      'Вариант принадлежит другому товару',
    );
    // CAS guard causes entire batch to roll back if concurrent editing won.
    statements.push(
      stmt(
        env,
        'INSERT INTO mutation_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM products WHERE id=? AND store_id=? AND version=? AND deleted_at IS NULL) THEN 1 ELSE 0 END',
        id,
        s.id,
        expected,
      ),
    );
    statements.push(
      stmt(
        env,
        'UPDATE products SET data=?,version=version+1 WHERE store_id=? AND id=?',
        JSON.stringify(normalized.data),
        s.id,
        id,
      ),
    );
    const ids = normalized.variants.map((v) => v.id);
    // Keep removed variants for historical orders and stock restoration.
    statements.push(
      stmt(
        env,
        `UPDATE variants SET archived=1 WHERE store_id=? AND product_id=? AND id NOT IN (${ids.map(() => '?').join(',')})`,
        s.id,
        id,
        ...ids,
      ),
    );
  } else {
    const count = await stmt(
      env,
      'SELECT COUNT(*) n FROM products WHERE store_id=? AND deleted_at IS NULL',
      s.id,
    ).first<{ n: number }>();
    requireThat((count?.n ?? 0) < 500, 'Максимум 500 товаров в MVP', 409);
    statements.push(
      stmt(
        env,
        'INSERT INTO products(id,store_id,data) VALUES(?,?,?)',
        pid,
        s.id,
        JSON.stringify(normalized.data),
      ),
    );
  }
  statements.push(...variantStatements(env, s.id, pid, normalized.variants));
  statements.push(stmt(env, 'DELETE FROM mutation_guards'));
  try {
    await env.DB.batch(statements);
  } catch (e) {
    if (
      String(e).includes('CHECK constraint') ||
      String(e).includes('CATALOG_CHANGED') ||
      String(e).includes('PRODUCT_LIMIT')
    )
      throw new HttpError(409, 'Товар уже изменён. Обновите список.');
    throw e;
  }
  return { id: pid };
}
export async function updateSettings(env: Env, s: StoreRow, input: unknown) {
  const d = object(input),
    name = text(d.name, 200, true),
    cfg = settings(d.settings, s.id),
    version = int(d.version, 1, Number.MAX_SAFE_INTEGER);
  const ps = await catalog(env, s.id);
  requireThat(
    ps.every((p) => cfg.currencies.every((c) => p.prices[c] !== undefined)),
    'Сначала добавьте цены товаров в новой валюте',
  );
  let result;
  try {
    result = await stmt(
      env,
      'UPDATE stores SET name=?,settings=?,version=version+1 WHERE id=? AND owner_id IS ? AND version=?',
      name,
      JSON.stringify(cfg),
      s.id,
      s.owner_id,
      version,
    ).run();
  } catch (e) {
    if (String(e).includes('CATALOG_CHANGED'))
      throw new HttpError(409, 'Каталог изменился. Проверьте цены товаров в новой валюте.');
    throw e;
  }
  requireThat(result.meta.changes === 1, 'Настройки уже изменены. Обновите панель.', 409);
}
export function storeMutationGuard(env: Env, s: StoreRow) {
  return stmt(
    env,
    'INSERT INTO mutation_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM stores WHERE id=? AND owner_id IS ? AND version=?) THEN 1 ELSE 0 END',
    s.id,
    s.owner_id,
    s.version,
  );
}
