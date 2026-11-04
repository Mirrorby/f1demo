import { currencyCode, requireThat } from './validation';
import { stmt } from './catalog';
import { telegram } from './telegram';
import { notificationLanguage } from './telegram-i18n';
import type { StoreRow, Settings } from './types';
export const templateFilename = 'delokay-products.csv';
export function templateCurrencies(input: string) {
  const raw = input.split(',');
  requireThat(raw.length >= 1 && raw.length <= 2, 'Укажите одну или две валюты');
  const currencies = raw.map(currencyCode);
  requireThat(new Set(currencies).size === currencies.length, 'Валюты не должны повторяться');
  return currencies;
}
export function productTemplateCSV(currencies: string[]) {
  const codes = templateCurrencies(currencies.join(','));
  const header = [
    'Название',
    'Категория',
    'Описание',
    'Артикул',
    'Фото',
    'Варианты',
    'Наличие',
    ...codes.map((c) => 'Цена ' + c),
  ];
  const example = [
    'Замените своим товаром',
    'Категория',
    'Описание',
    'SKU-001',
    '',
    'Стандарт:10',
    'available',
    ...codes.map(() => '24.99'),
  ];
  const encode = (row: string[]) => row.map((v) => '"' + v.replaceAll('"', '""') + '"').join(';');
  return '\uFEFF' + [header, example].map(encode).join('\r\n') + '\r\n';
}
export function templateDownload(request: Request) {
  const headers = {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${templateFilename}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': 'https://web.telegram.org',
    'Access-Control-Expose-Headers': 'Content-Disposition, Content-Type',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  requireThat(['GET', 'HEAD'].includes(request.method), 'Метод не поддерживается', 405);
  const codes = templateCurrencies(new URL(request.url).searchParams.get('currencies') || 'USD');
  return new Response(request.method === 'HEAD' ? null : productTemplateCSV(codes), { headers });
}
export async function sendProductTemplate(env: Env, store: StoreRow) {
  requireThat(store.owner_id, 'Владелец не подключён', 409);
  const lease = await stmt(
    env,
    `INSERT INTO maintenance_state(key,value) VALUES(?,CAST(unixepoch()+10 AS TEXT)) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(maintenance_state.value AS INTEGER)<unixepoch() RETURNING key`,
    'csv_template:' + store.owner_id,
  ).first();
  requireThat(lease, 'Файл уже отправляется. Повторите через несколько секунд.', 429);
  const settings = JSON.parse(store.settings) as Settings;
  const language = await notificationLanguage(env, store.owner_id);
  const caption =
    language === 'ru'
      ? 'Шаблон товаров Delokay. Заполните его в Excel, Numbers или Google Таблицах, сохраните как CSV UTF-8 и загрузите в разделе «Товары».'
      : language === 'ro'
        ? 'Șablonul de produse Delokay. Completează-l în Excel, Numbers sau Google Sheets, salvează ca CSV UTF-8 și încarcă-l în secțiunea Produse.'
        : 'Delokay product template. Fill it in Excel, Numbers or Google Sheets, save as CSV UTF-8 and upload it in Products.';
  const form = new FormData();
  form.set('chat_id', store.owner_id);
  form.set('caption', caption);
  form.set(
    'document',
    new File([productTemplateCSV(settings.currencies)], templateFilename, {
      type: 'text/csv;charset=utf-8',
    }),
  );
  await telegram(env, 'sendDocument', form);
  return { sent: true };
}
