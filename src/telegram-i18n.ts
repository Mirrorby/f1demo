import locales from './telegram-locales.json';
import { stmt } from './catalog';
export const botLanguages = ['ru', 'en', 'es', 'pt', 'fr', 'it', 'tr', 'pl', 'ja', 'de'] as const;
export type BotLanguage = (typeof botLanguages)[number];
export function detectLanguage(code: unknown): BotLanguage {
  const base = typeof code === 'string' ? code.toLowerCase().split(/[-_]/)[0] : '';
  return botLanguages.includes(base as BotLanguage) ? (base as BotLanguage) : 'en';
}
export async function userLanguage(
  env: Env,
  user: string,
  telegramCode?: unknown,
): Promise<BotLanguage> {
  const previous = await stmt(
    env,
    'SELECT language,manual FROM telegram_preferences WHERE user_id=?',
    user,
  ).first<{ language: BotLanguage; manual: number }>();
  if (previous?.manual) return previous.language;
  if (typeof telegramCode !== 'string') return previous?.language ?? 'en';
  const language = detectLanguage(telegramCode);
  if (previous?.language !== language)
    await stmt(
      env,
      'INSERT INTO telegram_preferences(user_id,language,manual) VALUES(?,?,0) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language WHERE manual=0',
      user,
      language,
    ).run();
  return language;
}
export async function setLanguage(env: Env, user: string, language: BotLanguage) {
  await stmt(
    env,
    'INSERT INTO telegram_preferences(user_id,language,manual) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language,manual=1',
    user,
    language,
  ).run();
}
export async function notificationLanguage(env: Env, user: string): Promise<BotLanguage> {
  const row = await stmt(
    env,
    'SELECT language FROM telegram_preferences WHERE user_id=?',
    user,
  ).first<{ language: BotLanguage }>();
  return row ? detectLanguage(row.language) : 'ru';
}
export const copy = {
  ...locales,
  ru: {
    welcome:
      '👋 Привет! Добро пожаловать в Delokay.\n\nМеньше рутины. Больше дела. ✨\n\nМы создаём простые инструменты для управления бизнесом. 🛍 Каталоги — наш первый инструмент: товары, заказы и магазин в Telegram.',
    returning: '👋 С возвращением в Delokay!\nВаши магазины:',
    noStore:
      '\n\nСоздайте свой магазин: откройте Delokay, добавьте Instagram и выберите оформление. Пока доступно тестовое демо с примерными товарами.',
    telegramId: 'Ваш Telegram ID: ',
    dashboard: '🚀 Открыть Delokay',
    store: '🛍 Управлять магазином',
    payments: '💳 Оплата',
    helpButton: '❓ Помощь',
    language: '🌐 Язык / Language',
    chooseLanguage: 'Выберите язык интерфейса:',
    languageSaved: '✅ Язык изменён на русский.',
    help: '❓ Помощь Delokay\n\n/start — главное меню\n/shop — панель управления\n/pay — оплата и покупки\n/language — выбор языка\n/help — эта справка\n\nЧтобы создать магазин, откройте Delokay и нажмите «Создать магазин». Приглашения для подключения существующих магазинов также работают. Для открытия Mini App используйте кнопку «Delokay» рядом с полем ввода.',
    connected: '✅ Магазин «',
    connectedEnd: '» подключён. Теперь им можно управлять в Delokay.',
    claimError: 'Не удалось подключить магазин.',
    statusSaved: '✅ Статус заказа обновлён',
    orderNotFound: 'Заказ не найден',
    newOrder: '📦 Новый заказ №',
    phone: 'Телефон: ',
    total: 'Итого: ',
    accept: 'Принять',
    complete: 'Выполнен',
    cancel: 'Отменить',
    openOrder: 'Открыть заказ',
  },
  en: {
    welcome:
      '👋 Hey! Welcome to Delokay.\n\nLess busywork. More business. ✨\n\nWe create simple tools to manage your business. 🛍 Catalogs is our first tool: products, orders and your store right in Telegram.',
    returning: '👋 Welcome back to Delokay!\nYour stores:',
    noStore:
      '\n\nCreate your store: open Delokay, add your Instagram and choose a template. A test demo with sample products is currently available.',
    telegramId: 'Your Telegram ID: ',
    dashboard: '🚀 Open Delokay',
    store: '🛍 Manage store',
    payments: '💳 Payments',
    helpButton: '❓ Help',
    language: '🌐 Language / Язык',
    chooseLanguage: 'Choose your interface language:',
    languageSaved: '✅ Language changed to English.',
    help: '❓ Delokay help\n\n/start — main menu\n/shop — dashboard\n/pay — payments and purchases\n/language — choose language\n/help — this guide\n\nTo create a store, open Delokay and choose Create store. Invitations for existing stores still work. Open the Mini App with the “Delokay” button near the message field.',
    connected: '✅ Store “',
    connectedEnd: '” connected. You can now manage it in Delokay.',
    claimError: 'Could not connect the store.',
    statusSaved: '✅ Order status updated',
    orderNotFound: 'Order not found',
    newOrder: '📦 New order #',
    phone: 'Phone: ',
    total: 'Total: ',
    accept: 'Accept',
    complete: 'Completed',
    cancel: 'Cancel',
    openOrder: 'Open order',
  },
} as const;
