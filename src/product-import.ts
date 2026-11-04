import { stmt, storeMutationGuard } from './catalog';
import { object, product, requireThat, text, HttpError } from './validation';
import type { Settings, StoreRow } from './types';

// RFC 4180 quoting, UTF-8 BOM, Excel semicolon exports and multiline descriptions.
export function parseCSV(source: string): string[][] {
  source = source.replace(/^\uFEFF/, '');
  const first = source.split(/\r?\n/, 1)[0];
  const delimiter = first.includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === delimiter || c === '\n' || c === '\r') {
      row.push(cell);
      cell = '';
      closed = false;
      if (c !== delimiter) {
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
        if (c === '\r' && source[i + 1] === '\n') i++;
      }
    } else {
      requireThat(!closed && c !== '"', 'Некорректные кавычки в CSV');
      cell += c;
    }
    requireThat(rows.length <= 501, 'Максимум 500 товаров в файле');
  }
  requireThat(!quoted, 'Не закрыты кавычки в CSV');
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
export async function importProducts(env: Env, store: StoreRow, input: unknown) {
  const d = object(input),
    csv = text(d.csv, 480000, true),
    cfg = JSON.parse(store.settings) as Settings;
  const requestId = text(d.requestId, 36, true);
  requireThat(/^[a-f0-9-]{36}$/.test(requestId), 'Недопустимый идентификатор импорта');
  const previous = await stmt(
    env,
    'SELECT count FROM product_imports WHERE store_id=? AND request_id=?',
    store.id,
    requestId,
  ).first<{ count: number }>();
  if (previous) return { imported: previous.count, duplicate: true };
  const [header, ...rows] = parseCSV(csv);
  requireThat(
    header && rows.length > 0 && rows.length <= 500,
    'Файл должен содержать заголовки и от 1 до 500 товаров',
  );
  const columns = header.map((x) => x.trim());
  const allowed = [
    'Название',
    'Категория',
    'Описание',
    'Артикул',
    'Фото',
    'Варианты',
    'Наличие',
    ...cfg.currencies.map((c) => 'Цена ' + c),
  ];
  requireThat(
    new Set(columns).size === columns.length && columns.every((c) => allowed.includes(c)),
    'Не меняйте заголовки скачанного шаблона',
  );
  requireThat(
    ['Название', ...cfg.currencies.map((c) => 'Цена ' + c)].every((c) => columns.includes(c)),
    'Не хватает названия или цены в валюте магазина. Скачайте актуальный шаблон.',
  );
  const errors: { row: number; message: string }[] = [];
  const normalized = rows.map((cells, i) => {
    try {
      requireThat(cells.length === columns.length, 'Количество ячеек не совпадает с заголовком');
      const v = Object.fromEntries(columns.map((c, j) => [c, cells[j].trim()]));
      const prices = Object.fromEntries(
        cfg.currencies.map((c) => {
          const n = v['Цена ' + c].replace(',', '.');
          requireThat(
            /^\d+(\.\d{1,2})?$/.test(n),
            'Цена ' + c + ': число с точностью до двух знаков',
          );
          return [c, Math.round(Number(n) * 100)];
        }),
      );
      const variants = v['Варианты']
        ? v['Варианты'].split('|').map((x) => {
            const parts = x.split(':');
            requireThat(parts.length <= 2, 'Варианты: Размер:остаток|Размер:остаток');
            const [label, stock] = parts;
            requireThat(
              !stock || /^\d+$/.test(stock),
              'Остаток должен быть целым неотрицательным числом',
            );
            return { label: label.trim(), stock: stock ? Number(stock) : null };
          })
        : [{ label: 'Без вариантов', stock: null }];
      return {
        id: crypto.randomUUID(),
        ...product(
          {
            name: v['Название'],
            category: v['Категория'] || 'Прочее',
            description: v['Описание'] || '',
            sku: v['Артикул'] || '',
            photos: v['Фото'] ? v['Фото'].split('|').map((x) => x.trim()) : [],
            prices,
            variants,
            availability: v['Наличие'] || 'available',
          },
          cfg,
          store.id,
        ),
      };
    } catch (e) {
      errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Ошибка строки' });
      return null;
    }
  });
  const count = await stmt(
    env,
    'SELECT COUNT(*) n FROM products WHERE store_id=? AND deleted_at IS NULL',
    store.id,
  ).first<{ n: number }>();
  requireThat(
    (count?.n || 0) + rows.length <= 500,
    'Всего в каталоге может быть до 500 товаров. Освободите место перед импортом.',
  );
  if (errors.length || d.preview !== false)
    return {
      valid: !errors.length,
      count: rows.length,
      errors,
      preview: normalized
        .filter((x) => x)
        .slice(0, 5)
        .map((x) => x!.data.name),
    };
  const last = await stmt(
    env,
    'SELECT COALESCE(MAX(position),-1) n FROM products WHERE store_id=? AND deleted_at IS NULL',
    store.id,
  ).first<{ n: number }>();
  const ps = normalized.filter((x): x is NonNullable<typeof x> => !!x);
  try {
    await env.DB.batch([
      storeMutationGuard(env, store),
      stmt(
        env,
        'INSERT INTO mutation_guards(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM products WHERE store_id=? AND deleted_at IS NULL)+?<=500 THEN 1 ELSE 0 END',
        store.id,
        ps.length,
      ),
      stmt(
        env,
        'INSERT INTO product_imports(store_id,request_id,count) VALUES(?,?,?)',
        store.id,
        requestId,
        ps.length,
      ),
      stmt(env, 'UPDATE stores SET version=version+1 WHERE id=?', store.id),
      stmt(
        env,
        `INSERT INTO products(id,store_id,data,position) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.data'),?+CAST(key AS INTEGER) FROM json_each(?)`,
        store.id,
        (last?.n ?? -1) + 1,
        JSON.stringify(ps.map((p) => ({ id: p.id, data: JSON.stringify(p.data) }))),
      ),
      stmt(
        env,
        `INSERT INTO variants(id,store_id,product_id,label,stock) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.productId'),json_extract(value,'$.label'),json_extract(value,'$.stock') FROM json_each(?)`,
        store.id,
        JSON.stringify(ps.flatMap((p) => p.variants.map((v) => ({ ...v, productId: p.id })))),
      ),
      stmt(env, 'DELETE FROM mutation_guards'),
    ]);
  } catch (e) {
    const done = await stmt(
      env,
      'SELECT count FROM product_imports WHERE store_id=? AND request_id=?',
      store.id,
      requestId,
    ).first<{ count: number }>();
    if (done) return { imported: done.count, duplicate: true };
    if (String(e).includes('CHECK constraint'))
      throw new HttpError(409, 'Каталог изменился. Проверьте файл ещё раз.');
    throw e;
  }
  return { imported: ps.length };
}
