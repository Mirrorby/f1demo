import { catalog, stmt } from './catalog';
import { digest } from './auth';
import type { StoreRow, Settings, Customer, OrderRow, OrderItem } from './types';
import { HttpError, int, object, requireThat, text } from './validation';
export async function placeOrder(env: Env, s: StoreRow, input: unknown, key: string, ip: string) {
  requireThat(s.status === 'active', 'Это демонстрация. Реальные заказы отключены.', 409);
  requireThat(s.owner_id, 'Владелец магазина ещё не подключён', 409);
  requireThat(/^[a-zA-Z0-9_-]{16,80}$/.test(key), 'Требуется ключ повторного запроса');
  const d = object(input),
    cfg = JSON.parse(s.settings) as Settings,
    currency = text(d.currency, 3, true);
  requireThat(cfg.currencies.includes(currency), 'Недопустимая валюта');
  const c = object(d.customer);
  const customer: Customer = {
    name: text(c.name, 100, true),
    phone: text(c.phone, 30, true),
    address: text(c.address, 500, true),
    city: text(c.city, 100),
    region: text(c.region, 100),
    index: text(c.index, 20),
    comment: text(c.comment, 1000),
    deliveryMethod: text(c.deliveryMethod, 100, true),
  };
  requireThat(/^[+\d\s()-]{7,30}$/.test(customer.phone), 'Проверьте номер телефона');
  requireThat(
    cfg.deliveryMethods.includes(customer.deliveryMethod),
    'Недопустимый способ доставки',
  );
  const raw = d.items;
  requireThat(
    Array.isArray(raw) && raw.length > 0 && raw.length <= 20,
    'От 1 до 20 позиций в заказе',
  );
  const selected = raw
    .map((x) => {
      const i = object(x);
      return {
        productId: text(i.productId, 36, true),
        variantId: text(i.variantId, 36, true),
        quantity: int(i.quantity, 1, 99),
        expectedUnitMinor: int(i.expectedUnitMinor, 0, 100000000),
      };
    })
    .sort((a, b) => a.variantId.localeCompare(b.variantId));
  requireThat(
    new Set(selected.map((x) => x.variantId)).size === selected.length,
    'Объедините одинаковые варианты',
  );
  const hash = await digest(JSON.stringify({ customer, currency, items: selected }));
  const previous = await stmt(
    env,
    'SELECT * FROM orders WHERE store_id=? AND idempotency_key=?',
    s.id,
    key,
  ).first<OrderRow>();
  if (previous) {
    requireThat(
      previous.request_hash === hash,
      'Этот ключ уже использован для другого заказа',
      409,
    );
    return receipt(previous);
  }
  requireThat(s.orders_enabled === 1, 'Приём заказов приостановлен', 409);
  const ps = await catalog(env, s.id);
  const items: OrderItem[] = selected.map((i) => {
    const p = ps.find((p) => p.id === i.productId),
      v = p?.variants.find((v) => v.id === i.variantId);
    requireThat(p && v, 'Товар или вариант не найден', 409);
    requireThat(p.availability !== 'unavailable', 'Товар недоступен', 409);
    requireThat(!p.priceOnRequest, 'Сначала уточните цену товара', 409);
    requireThat(
      p.availability === 'preorder' || v.stock === null || v.stock >= i.quantity,
      'Недостаточно товара в наличии',
      409,
    );
    const unitMinor = Math.round((p.prices[currency] * (100 - p.discountPercent)) / 100);
    requireThat(Number.isSafeInteger(unitMinor), 'Цена недоступна', 409);
    requireThat(
      i.expectedUnitMinor === unitMinor,
      'Цена изменилась. Обновите страницу и корзину.',
      409,
    );
    return {
      ...i,
      name: p.name,
      photo: p.photos[0] || '',
      variant: v.label,
      unitMinor,
      version: p.version,
      reserved: p.availability !== 'preorder' && v.stock !== null,
    };
  });
  const total = items.reduce((sum, i) => sum + i.unitMinor * i.quantity, 0);
  requireThat(Number.isSafeInteger(total) && total <= 1000000000, 'Слишком большая сумма заказа');
  const id = crypto.randomUUID(),
    ipHash = await digest(s.id + ':' + ip);
  try {
    await stmt(
      env,
      'INSERT INTO orders(id,store_id,number,idempotency_key,request_hash,customer,items,currency,total_minor,ip_hash) VALUES(?,?,(SELECT COALESCE(MAX(number),0)+1 FROM orders WHERE store_id=?),?,?,?,?,?,?,?)',
      id,
      s.id,
      s.id,
      key,
      hash,
      JSON.stringify(customer),
      JSON.stringify(items),
      currency,
      total,
      ipHash,
    ).run();
  } catch (e) {
    const row = await stmt(
      env,
      'SELECT * FROM orders WHERE store_id=? AND idempotency_key=?',
      s.id,
      key,
    ).first<OrderRow>();
    if (row) {
      requireThat(row.request_hash === hash, 'Этот ключ уже использован для другого заказа', 409);
      return receipt(row);
    }
    const msg = String(e);
    if (msg.includes('RATE_LIMIT'))
      throw new HttpError(429, 'Слишком много заказов. Попробуйте позже.');
    if (msg.includes('CATALOG_CHANGED') || msg.includes('STORE_NOT_ACTIVE'))
      throw new HttpError(409, 'Каталог изменился. Обновите страницу и корзину.');
    throw e;
  }
  const saved = await stmt(
    env,
    'SELECT * FROM orders WHERE id=? AND store_id=?',
    id,
    s.id,
  ).first<OrderRow>();
  requireThat(saved, 'Не удалось сохранить заказ', 500);
  return receipt(saved);
}
function receipt(o: OrderRow) {
  return {
    id: o.id,
    number: o.number,
    currency: o.currency,
    totalMinor: o.total_minor,
    status: o.status,
  };
}
export function orderView(o: OrderRow, products: { id: string; photos: string[] }[] = []) {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    currency: o.currency,
    totalMinor: o.total_minor,
    createdAt: o.created_at,
    customer: JSON.parse(o.customer),
    items: (JSON.parse(o.items) as OrderItem[]).map((item) => ({
      ...item,
      photo: item.photo ?? products.find((p) => p.id === item.productId)?.photos[0] ?? '',
    })),
  };
}
export async function changeStatus(
  env: Env,
  storeId: string,
  id: string,
  next: string,
  access: StoreRow,
) {
  const old = await stmt(
    env,
    'SELECT * FROM orders WHERE store_id=? AND id=?',
    storeId,
    id,
  ).first<OrderRow>();
  requireThat(old, 'Заказ не найден', 404);
  const allowed: Record<string, string[]> = {
    new: ['processing', 'completed', 'cancelled'],
    processing: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };
  if (old.status === next) return;
  requireThat(allowed[old.status]?.includes(next), 'Недопустимый переход статуса', 409);
  const result = await stmt(
    env,
    'UPDATE orders SET status=? WHERE id=? AND store_id=? AND status=? AND EXISTS(SELECT 1 FROM stores WHERE id=? AND owner_id IS ? AND version=?) RETURNING id',
    next,
    id,
    storeId,
    old.status,
    access.id,
    access.owner_id,
    access.version,
  ).first<{ id: string }>();
  requireThat(result, 'Статус уже изменён. Обновите заказ.', 409);
}
