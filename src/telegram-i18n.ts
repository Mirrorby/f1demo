import { stmt } from './catalog';
export type BotLanguage = 'ru' | 'en';
export function detectLanguage(code: unknown): BotLanguage {
  return typeof code === 'string' && /^ru(?:[-_]|$)/i.test(code) ? 'ru' : 'en';
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
  return row?.language === 'en' ? 'en' : 'ru';
}
export const copy = {
  ru: {
    welcome:
      '👋 Привет! Добро пожаловать в Delokay.\n\nМеньше рутины. Больше дела. ✨\n\nМы создаём простые инструменты для управления бизнесом. 🛍 Каталоги — наш первый инструмент: товары, заказы и магазин в Telegram.',
    returning: '👋 С возвращением в Delokay!\nВаши магазины:',
    noStore:
      '\n\nПока у вас нет подключённых магазинов. Передайте ваш Telegram ID специалисту, чтобы получить ссылку подключения.',
    telegramId: 'Ваш Telegram ID: ',
    dashboard: '🚀 Открыть Delokay',
    store: '🛍 Управлять магазином',
    payments: '💳 Оплата',
    helpButton: '❓ Помощь',
    language: '🌐 Язык / Language',
    chooseLanguage: 'Выберите язык интерфейса:',
    languageSaved: '✅ Язык изменён на русский.',
    help: '❓ Помощь Delokay\n\n/start — главное меню\n/shop — панель управления\n/pay — оплата и покупки\n/language — выбор языка\n/help — эта справка\n\nЧтобы подключить магазин, откройте ссылку приглашения от специалиста. Для открытия Mini App используйте кнопку «Delokay» рядом с полем ввода.',
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
      '\n\nNo stores are connected yet. Share your Telegram ID with your specialist to receive an invitation link.',
    telegramId: 'Your Telegram ID: ',
    dashboard: '🚀 Open Delokay',
    store: '🛍 Manage store',
    payments: '💳 Payments',
    helpButton: '❓ Help',
    language: '🌐 Language / Язык',
    chooseLanguage: 'Choose your interface language:',
    languageSaved: '✅ Language changed to English.',
    help: '❓ Delokay help\n\n/start — main menu\n/shop — dashboard\n/pay — payments and purchases\n/language — choose language\n/help — this guide\n\nTo connect a store, follow the invitation link from your specialist. Open the Mini App with the “Delokay” button near the message field.',
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
