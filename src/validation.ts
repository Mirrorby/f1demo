import { supportedLanguages, translate, type Language } from './language';
import type { Settings, ProductData, Variant } from './types';
import { informationKeys } from './template-content';
import { backgroundTargets } from './backgrounds';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireThat(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export function object(v: unknown): Record<string, unknown> {
  requireThat(v !== null && typeof v === 'object' && !Array.isArray(v), 'Ожидается объект');
  return v as Record<string, unknown>;
}
export function text(v: unknown, max = 200, required = false): string {
  requireThat(v === undefined || v === null || typeof v === 'string', 'Ожидается текст');
  const s = String(v ?? '').trim();
  requireThat(s.length <= max && (!required || s.length > 0), 'Недопустимая длина текста');
  return s;
}
export function int(v: unknown, min: number, max: number): number {
  requireThat(
    typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max,
    'Недопустимое число',
  );
  return v;
}
export function strings(v: unknown, max = 20, length = 100): string[] {
  requireThat(Array.isArray(v) && v.length <= max, 'Недопустимый список');
  return v.map((x) => text(x, length, true));
}
export function imageUrl(v: unknown, storeId?: string): string {
  const s = text(v, 1000);
  if (!s) return '';
  if (/^\/template-assets\/[a-z0-9-]+\.svg$/.test(s)) return s;
  if (s.startsWith('/media/')) {
    requireThat(
      !s.includes('..') &&
        /^\/media\/[a-f0-9-]+\/[a-f0-9-]+\.(png|jpg|webp)$/.test(s) &&
        (!storeId || s.startsWith(`/media/${storeId}/`)),
      'Изображение другого магазина',
    );
    return s;
  }
  requireThat(/^https:\/\//.test(s), 'Требуется HTTPS-ссылка на изображение');
  try {
    const u = new URL(s);
    requireThat(!u.username && !u.password, 'Недопустимая ссылка');
  } catch {
    throw new HttpError(400, 'Недопустимая ссылка');
  }
  return s;
}
export const currencies = ['USD', 'EUR', 'BYN', 'RUB', 'KZT', 'MDL', 'RON'];
export function currencyCode(value: unknown): string {
  const code = text(value, 3, true).toUpperCase();
  requireThat(/^[A-Z]{3}$/.test(code), 'Укажите трёхбуквенный код валюты, например USD или MDL');
  return code;
}
export function siteLanguages(value: unknown, primary: Language): Language[] {
  const list = value === undefined ? [primary] : strings(value, 11, 5);
  if (!list.includes(primary)) list.unshift(primary);
  requireThat(
    list.length > 0 &&
      list.includes(primary) &&
      new Set(list).size === list.length &&
      list.every((l) => supportedLanguages.includes(l as Language)),
    'Выберите языки сайта и включите основной язык',
  );
  return list as Language[];
}
const textKeys = [
  ...informationKeys,
  'about_title',
  'about_body',
  'sizing_title',
  'sizing_body',
  'ordering_title',
  'ordering_body',
  'shipping_title',
  'shipping_body',

  'btn_cart',
  'btn_add',
  'btn_add_size',
  'btn_clear',
  'label_size',
  'label_qty',
  'label_year',
  'label_color',
  'label_number',
  'label_total',
  'label_pick',
  'filter_all',
  'msg_empty_cart',
  'msg_added',
  'wa_msg_header',
  'wa_msg_footer',
  'tg_msg_header',
  'tg_msg_footer',
  'support_label',
];
export function settings(input: unknown, storeId?: string): Settings {
  const d = object(input ?? {});
  const language = (d.language ?? 'ru') as Language;
  requireThat(supportedLanguages.includes(language), 'Неподдерживаемый язык');
  const languages = siteLanguages(d.languages, language);
  const codes = d.currencies === undefined ? ['USD'] : strings(d.currencies, 2).map(currencyCode);
  requireThat(
    codes.length > 0 &&
      new Set(codes).size === codes.length &&
      codes.every((c) => /^[A-Z]{3}$/.test(c)),
    'Неподдерживаемая валюта',
  );
  const methods =
    d.deliveryMethods === undefined
      ? ['Доставка', 'Самовывоз'].map((v) => translate(v, language))
      : strings(d.deliveryMethods, 6);
  requireThat(
    methods.length > 0 && new Set(methods).size === methods.length,
    'Укажите способы доставки',
  );
  const translations = storeTranslations(d.translations, languages);
  for (const tr of Object.values(translations))
    if (tr?.deliveryMethods)
      requireThat(
        tr.deliveryMethods.length === methods.length &&
          new Set(tr.deliveryMethods).size === methods.length,
        'Переведите каждый способ доставки в исходном порядке',
      );
  const theme = text(d.theme) || 'minimal';
  requireThat(['minimal', 'fashion', 'home', 'beauty'].includes(theme), 'Неизвестный шаблон');
  const accent = text(d.accentColor, 7) || '#354f46';
  requireThat(/^#[0-9a-f]{6}$/i.test(accent), 'Недопустимый цвет');
  const tg = text(d.telegram, 64).replace(/^@/, '');
  const ig = text(d.instagram, 64).replace(/^@/, '');
  const wa = text(d.whatsapp, 20);
  requireThat(!tg || /^[a-z0-9_]{5,32}$/i.test(tg), 'Недопустимый Telegram username');
  requireThat(!ig || /^[a-z0-9_.]{1,30}$/i.test(ig), 'Недопустимый Instagram username');
  requireThat(!wa || /^\d{7,15}$/.test(wa), 'Номер WhatsApp: только цифры');
  const texts: Record<string, string> = {};
  for (const [k, v] of Object.entries(object(d.texts ?? {}))) {
    requireThat(textKeys.includes(k), 'Неизвестный текст витрины');
    texts[k] = text(v, 500);
  }
  const backgrounds: NonNullable<Settings['backgrounds']> = {};
  for (const [key, raw] of Object.entries(object(d.backgrounds ?? {}))) {
    requireThat(
      backgroundTargets.some((target) => target === key),
      'Неизвестный блок фона',
    );
    const bg = object(raw);
    const mode = text(bg.mode) || 'template';
    requireThat(['template', 'color', 'image'].includes(mode), 'Недопустимый режим фона');
    const color = text(bg.color, 7) || '#f7f8fc';
    requireThat(/^#[a-f0-9]{6}$/i.test(color), 'Недопустимый цвет фона');
    const image = imageUrl(bg.image, storeId);
    requireThat(mode !== 'image' || image, 'Добавьте фото для фона');
    const tone = text(bg.tone) || 'auto';
    requireThat(['auto', 'light', 'dark'].includes(tone), 'Недопустимый цвет текста');
    backgrounds[key as keyof typeof backgrounds] = {
      mode: mode as 'template' | 'color' | 'image',
      color,
      image: image.startsWith('https:') ? new URL(image).href : image,
      tone: tone as 'auto' | 'light' | 'dark',
      overlay: bg.overlay === undefined ? 60 : int(bg.overlay, 0, 80),
    };
  }
  return {
    ...(d.backgrounds === undefined ? {} : { backgrounds }),
    language,
    languages,
    translations,
    theme: theme as Settings['theme'],
    description: text(d.description, 2000),
    accentColor: accent,
    logo: imageUrl(d.logo, storeId),
    whatsapp: wa,
    telegram: tg,
    instagram: ig,
    currencies: codes,
    deliveryMethods: methods,
    deliveryHint: text(d.deliveryHint, 1000),
    heroTitle: text(d.heroTitle, 200),
    footerText: text(d.footerText, 500),
    texts,
  };
}
export function product(
  input: unknown,
  store: Settings,
  storeId: string,
  allowVariantIds = false,
): { data: ProductData; variants: Variant[] } {
  const d = object(input);
  const prices: Record<string, number> = {};
  requireThat(
    d.priceOnRequest === undefined || typeof d.priceOnRequest === 'boolean',
    'Недопустимый режим цены',
  );
  const rawPrices =
    d.prices ??
    (d.price !== undefined
      ? { [text(d.currency) || store.currencies[0]]: Math.round(Number(d.price) * 100) }
      : undefined);
  for (const [k, v] of Object.entries(object(rawPrices))) {
    requireThat(currencyCode(k) === k, 'Код валюты должен быть в верхнем регистре');
    prices[k] = int(v, 0, 100000000);
  }
  requireThat(
    store.currencies.every((c) => prices[c] !== undefined),
    'Укажите цену в каждой валюте магазина',
  );
  const photos =
    d.photos === undefined
      ? d.image
        ? [imageUrl(d.image, storeId)]
        : []
      : strings(d.photos, 8, 1000).map((x) => imageUrl(x, storeId));
  const availability = text(d.availability) || 'available';
  requireThat(
    ['available', 'preorder', 'unavailable'].includes(availability),
    'Недопустимое наличие',
  );
  const vs = d.variants ?? [{ label: 'Без вариантов', stock: null }];
  requireThat(Array.isArray(vs) && vs.length > 0 && vs.length <= 30, 'От 1 до 30 вариантов');
  const variants = vs.map((x) => {
    const v = object(x);
    requireThat(allowVariantIds || v.id === undefined, 'ID нового варианта создаётся сервером');
    const id = v.id ? text(v.id, 36, true) : crypto.randomUUID();
    requireThat(/^[a-f0-9-]{36}$/.test(id), 'Недопустимый ID варианта');
    return {
      id,
      label: text(v.label, 80, true),
      stock: v.stock === null || v.stock === undefined ? null : int(v.stock, 0, 1000000),
    };
  });
  const attrs = d.attributes ?? [];
  requireThat(Array.isArray(attrs) && attrs.length <= 12, 'Максимум 12 характеристик');
  const attributes = attrs.map((x) => {
    const a = object(x);
    return { label: text(a.label, 80, true), value: text(a.value, 300, true) };
  });
  requireThat(
    new Set(attributes.map((a) => a.label)).size === attributes.length,
    'Повторяющаяся характеристика',
  );
  requireThat(
    new Set(variants.map((v) => v.id)).size === variants.length &&
      new Set(variants.map((v) => v.label)).size === variants.length,
    'Повторяющийся вариант',
  );
  return {
    data: {
      translations: productTranslations(d.translations, variants),
      name: text(d.name, 200, true),
      category: text(d.category, 100) || 'Прочее',
      description: text(d.description, 5000),
      prices,
      priceOnRequest: d.priceOnRequest === true,
      discountPercent: d.discountPercent === undefined ? 0 : int(d.discountPercent, 0, 99),
      availability: availability as ProductData['availability'],
      photos,
      brand: text(d.brand ?? d.team, 100),
      collection: text(d.collection ?? d.year, 100),
      sku: text(d.sku ?? d.number, 80),
      attributes,
      color: text(d.color, 100),
    },
    variants,
  };
}
export async function jsonBody(request: Request, max = 512000): Promise<unknown> {
  requireThat(
    request.headers.get('content-type')?.includes('application/json'),
    'Ожидается JSON',
    415,
  );
  const body = await limitedBytes(request, max);
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new HttpError(400, 'Некорректный JSON');
  }
}
export async function limitedBytes(request: Request | Response, max: number): Promise<Uint8Array> {
  requireThat(
    Number(request.headers.get('content-length') || 0) <= max,
    'Слишком большой запрос',
    413,
  );
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, 'Слишком большой запрос');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return bytes;
}

function storeTranslations(
  input: unknown,
  languages: Language[],
): NonNullable<Settings['translations']> {
  const result: NonNullable<Settings['translations']> = {};
  for (const [code, value] of Object.entries(object(input ?? {}))) {
    requireThat(supportedLanguages.includes(code as Language), 'Неподдерживаемый язык перевода');
    const d = object(value),
      out: import('./types').StoreTranslation = {};
    for (const [key, max] of [
      ['name', 200],
      ['description', 2000],
      ['heroTitle', 200],
      ['footerText', 500],
      ['deliveryHint', 1000],
    ] as const)
      if (d[key] !== undefined) out[key] = text(d[key], max);
    if (d.deliveryMethods !== undefined) out.deliveryMethods = strings(d.deliveryMethods, 6);
    if (d.texts !== undefined) {
      out.texts = {};
      for (const [key, value] of Object.entries(object(d.texts))) {
        requireThat(textKeys.includes(key), 'Неизвестный текст витрины');
        out.texts[key] = text(value, 500);
      }
    }
    result[code as Language] = out;
  }
  return result;
}
function productTranslations(
  input: unknown,
  variants: Variant[],
): NonNullable<ProductData['translations']> {
  const result: NonNullable<ProductData['translations']> = {};
  for (const [code, value] of Object.entries(object(input ?? {}))) {
    requireThat(supportedLanguages.includes(code as Language), 'Неподдерживаемый язык перевода');
    const d = object(value),
      out: NonNullable<ProductData['translations']>[Language] = {};
    for (const [key, max] of [
      ['name', 200],
      ['category', 100],
      ['description', 5000],
      ['brand', 100],
      ['collection', 100],
      ['color', 100],
    ] as const)
      if (d[key] !== undefined) out[key] = text(d[key], max);
    if (d.variantLabels !== undefined) {
      out.variantLabels = {};
      for (const [id, label] of Object.entries(object(d.variantLabels))) {
        requireThat(
          variants.some((v) => v.id === id),
          'Вариант перевода не найден',
        );
        out.variantLabels[id] = text(label, 80, true);
      }
    }
    if (d.attributes !== undefined) {
      requireThat(
        Array.isArray(d.attributes) && d.attributes.length <= 12,
        'Максимум 12 характеристик',
      );
      out.attributes = d.attributes.map((a) => {
        const v = object(a);
        return { label: text(v.label, 80, true), value: text(v.value, 300, true) };
      });
    }
    result[code as Language] = out;
  }
  return result;
}
