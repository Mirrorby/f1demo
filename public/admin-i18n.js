/* Delokay UI translations. Customer/store data and API payloads are never translated. */
(() => {
  'use strict';
  const en = {
    'ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО': 'YOUR WORKSPACE',
    'РЕДАКТОР МАГАЗИНА': 'STORE EDITOR',
    'Подключаем магазин…': 'Connecting your store…',
    'Загрузка…': 'Loading…',
    'Главная': 'Home',
    'Товары': 'Products',
    'Заказы': 'Orders',
    'Ещё': 'More',
    'Основные разделы': 'Main sections',
    'Выбрать магазин': 'Select a store',
    'Русский': 'Russian',
    'Английский': 'English',
    'Язык интерфейса': 'Interface language',
    'Мой магазин': 'My store',
    'Мой кабинет': 'My dashboard',
    'Ваши инструменты': 'Your tools',
    'ДОБРО ПОЖАЛОВАТЬ В DELOKAY': 'WELCOME TO DELOKAY',
    'Начнём с вашего магазина': "Let's start with your store",
    'Создайте онлайн-каталог, добавляйте товары и принимайте заказы прямо в Telegram.': 'Create a catalog, add products, and receive orders right in Telegram.',
    'Начать с каталога →': 'Start with catalogs →',
    'Каталоги': 'Catalogs',
    'Первый инструмент Delokay': "Delokay's first tool",
    'Доступен': 'Available',
    'После оформления заказа мы отправим вам приглашение для подключения магазина.': "After you place an order, we'll send you a link to connect your store.",
    'Оплата услуг': 'Service payments',
    'Загружаем данные Tribute…': 'Loading Tribute details…',
    'Покупка подтверждена': 'Purchase confirmed',
    'Возврат зарегистрирован': 'Refund reported',
    'Ожидает оплаты': 'Awaiting payment',
    'Нужна сверка': 'Needs review',
    'Создаётся': 'Creating',
    'Создание и настройка сайта-каталога.': 'Catalog website creation and setup.',
    'Создание сайта': 'Website setup',
    'Товар на заказ. Продавец отправит результат через Tribute после выполнения заказа и модерации.': 'Custom order. Your completed project will be delivered through Tribute after review.',
    'Заказать через Tribute': 'Order via Tribute',
    'Оплатить через Tribute': 'Pay via Tribute',
    'Товар пока недоступен для оформления заказа.': 'This service is not available to order yet.',
    'Мои покупки и счета': 'My purchases and invoices',
    'Покупок и счетов пока нет.': 'No purchases or invoices yet.',
    'Обновить оплату': 'Refresh payments',
    'Ссылка на вашу витрину и её статус': 'Your storefront link and status',
    'Настройки': 'Settings',
    'Оформление магазина, контакты и доставка': 'Store design, contacts, and delivery',
    'Оплата': 'Payments',
    'Услуги Delokay, история покупок и Tribute': 'Delokay services, purchases, and Tribute',
    'Меньше рутины. Больше дела. ✨': 'Less busywork. More business. ✨',
    'Новые инструменты будут появляться здесь по мере запуска.': 'More tools will appear here as they launch.',
    'Демонстрация': 'Demo mode',
    'Магазин активен': 'Store is active',
    'Приём заказов приостановлен': 'Orders are paused',
    'Новый': 'New',
    'В обработке': 'Processing',
    'Выполнен': 'Completed',
    'Отменён': 'Cancelled',
    'Без лимита': 'Unlimited',
    'Остатки по вариантам': 'Stock by variant',
    'DELOKAY · КАТАЛОГИ': 'DELOKAY · CATALOGS',
    'Всё под рукой': 'Everything in one place',
    'Товары, заказы и ваш сайт в одном удобном месте. Изменения появляются на витрине сразу после сохранения.': 'Products, orders, and your website in one workspace. Changes appear on your storefront as soon as you save.',
    'Добавить товар': 'Add product',
    'Обзор магазина': 'Store overview',
    'Товаров': 'Catalog items',
    'Новых заказов': 'New orders',
    'Быстрые действия': 'Quick actions',
    'Все товары →': 'All products →',
    'Посмотреть заказы →': 'View orders →',
    'Ваш сайт': 'Your website',
    'Заказы отключены в демонстрационном режиме.': 'Orders are disabled in demo mode.',
    'Новые заказы появятся здесь и в Telegram.': 'New orders will appear here and in Telegram.',
    'Открыть витрину ↗': 'Open storefront ↗',
    'Добавить': 'Add',
    'В наличии': 'In stock',
    'На заказ': 'Made to order',
    'Нет в наличии': 'Out of stock',
    'Добавьте первый товар.': 'Add your first product.',
    'Статус заказов': 'Order status',
    'Все': 'All',
    'Заказов пока нет.': 'No orders yet.',
    'Назад': 'Back',
    'Далее': 'Next',
    'Скопировать ссылку': 'Copy link',
    'Редактировать товар': 'Edit product',
    'Новый товар': 'New product',
    'Закрыть': 'Close',
    'Фотографии (до 8)': 'Photos (up to 8)',
    'Название': 'Name',
    'Категория': 'Category',
    'Прочее': 'Other',
    'Описание': 'Description',
    'Дополнительные валюты и характеристики': 'Additional currencies and attributes',
    'Бренд': 'Brand',
    'Цвет': 'Color',
    'Коллекция': 'Collection',
    'Артикул': 'SKU',
    'Характеристики (до 12, по одной на строке)': 'Attributes (up to 12, one per line)',
    'Материал: хлопок\\nОбъём: 100 мл': 'Material: cotton\\nVolume: 100 ml',
    'Скидка, %': 'Discount, %',
    'Наличие': 'Availability',
    'Варианты': 'Variants',
    'Размер, цвет или модель. Если выбора нет, оставьте «Без вариантов». Пустой остаток означает отсутствие ограничения.': 'Size, color, or model. If no choice is needed, keep “No variants”. An empty stock field means unlimited.',
    'Без вариантов': 'No variants',
    'Добавить вариант': 'Add variant',
    'Сохранить товар': 'Save product',
    'Удалить товар': 'Delete product',
    'Размер, цвет или вариант': 'Size, color, or variant',
    'Например: M / Красный': 'For example: M / Red',
    'Остаток': 'Stock',
    'Удалить вариант': 'Remove variant',
    'Удалить фото': 'Remove photo',
    'Название магазина': 'Store name',
    'Заголовок витрины': 'Storefront title',
    'Описание магазина': 'Store description',
    'Шаблон витрины': 'Storefront template',
    'Универсальный': 'General',
    'Одежда и аксессуары': 'Clothing & accessories',
    'Дом и декор': 'Home & decor',
    'Косметика и уход': 'Beauty & care',
    'Меняет оформление. Товары и цены сохраняются; основной цвет и название вариантов можно настроить ниже.': 'Changes the appearance without affecting products or prices. Configure colors and variant labels below.',
    'Основной цвет': 'Accent color',
    'Ссылка на логотип': 'Logo URL',
    'Загрузить логотип': 'Upload logo',
    'WhatsApp: номер с кодом страны, только цифры': 'WhatsApp: full number with country code, digits only',
    'Telegram username без @': 'Telegram username without @',
    'Instagram username без @': 'Instagram username without @',
    'Валюты (1 или 2, через запятую)': 'Currencies (1 or 2, comma-separated)',
    'BYN, RUB, KZT, USD, EUR. Перед включением новой валюты добавьте цены в карточках товаров.': 'BYN, RUB, KZT, USD, EUR. Add product prices before enabling a new currency.',
    'Способы доставки (по одному на строке)': 'Delivery methods (one per line)',
    'Условия доставки': 'Delivery details',
    'Текст внизу сайта': 'Website footer text',
    'Тексты кнопок и подписей': 'Buttons and labels',
    'Кнопка корзины': 'Cart button',
    'Добавить в корзину': 'Add to cart',
    'Название вариантов': 'Variant label',
    'Все категории': 'All categories',
    'Подпись к контактам': 'Contact label',
    'Сохранить настройки': 'Save settings',
    'Принять': 'Accept',
    'Отменить': 'Cancel',
    'Итого': 'Total',
    'Выберите JPEG, PNG или WebP до 20 МБ': 'Choose a JPEG, PNG, or WebP under 20 MB',
    'Изображение слишком большое': 'Image is too large',
    'Некорректная ссылка оплаты': 'Invalid payment link',
    'Оставьте хотя бы один вариант': 'Keep at least one variant',
    'Статус сохранён': 'Status updated',
    'Максимум 30 вариантов': 'Maximum 30 variants',
    'Ссылка скопирована': 'Link copied',
    'Удалить товар из каталога?': 'Delete this product from the catalog?',
    'Удалить товар?': 'Delete product?',
    'Товар удалён': 'Product deleted',
    'Максимум 8 фотографий': 'Maximum 8 photos',
    'Загружаем фотографии…': 'Uploading photos…',
    'Фотографии загружены': 'Photos uploaded',
    'Загружаем логотип…': 'Uploading logo…',
    'Логотип загружен. Сохраните настройки.': 'Logo uploaded. Save your settings.',
    'Характеристики: используйте формат «Название: значение»': 'Attributes: use the format “Name: value”',
    'Товар сохранён': 'Product saved',
    'Настройки сохранены': 'Settings saved',
    'Откройте редактор из': 'Open the editor from',
    'панели фабрики': 'the platform dashboard',
    'Откройте панель в Telegram': 'Open the dashboard in Telegram',
    'Нажмите «Управлять магазином» в личном чате с ботом.': 'Tap “Manage store” in your chat with the bot.',
    'Не удалось подключиться. Обновите страницу или откройте панель заново.': 'Unable to connect. Refresh the page or open the dashboard again.',
    'Не удалось загрузить оплату. Попробуйте ещё раз.': 'Could not load payments. Please try again.',
    'Не удалось выполнить запрос': 'Request failed',
    'Основные сведения': 'Basic information',
    'Цены и остатки': 'Prices and stock',
    'Оформление': 'Appearance',
    'Контакты': 'Contacts',
    'Доставка и оплата': 'Delivery and payments',
    'Клиент': 'Customer',
    'Состав заказа': 'Order items',
    'Информация о заказе': 'Order details',
    'Заказы клиентов': 'Customer orders',
    'Найти товар…': 'Search products…',
    'Поиск товаров': 'Search products',
    'Все категории товаров': 'All product categories',
    'Очистить поиск': 'Clear search',
    'Пока нет товаров': 'No products yet',
    'Ваш каталог начнётся с первого товара. Добавьте фото, цену и описание.': 'Your catalog starts with your first product. Add a photo, price, and description.',
    'Ничего не найдено': 'No matches',
    'Попробуйте другой запрос или категорию.': 'Try another search or category.',
    'Нет заказов по выбранному статусу': 'No orders with this status',
    'Попробуйте выбрать другой статус.': 'Try another status.',
    'Управление магазином': 'Store management',
    'Оплачивайте услуги и следите за статусом покупок в одном месте.': 'Pay for services and track your purchases in one place.',
    'История покупок': 'Purchase history',
    'Сведения о магазине': 'Store information',
    'Ссылка на витрину': 'Storefront link',
    'Магазин готов делиться с клиентами.': 'Your store is ready to share.',
    'Назад к меню': 'Back to menu',
    'Выберите действие': 'Choose an action',
    'Доступ к Delokay': 'Delokay access',
    'Включены продажи': 'Accepting orders',
    'Редактировать магазин': 'Edit store',
  };
  const reverse = Object.fromEntries(Object.entries(en).reverse().map(([ru, english]) => [english, ru]));
  const patterns = [
    [/^Товары · (\\d+)$/, (_, n) => 'Products · ' + n],
    [/^Products · (\\d+)$/, (_, n) => 'Товары · ' + n],
    [/^Заказ №(\\d+)$/, (_, n) => 'Order #' + n],
    [/^Order #(\\d+)$/, (_, n) => 'Заказ №' + n],
    [/^Цена, ([A-Z]{3})$/, (_, c) => 'Price, ' + c],
    [/^Price, ([A-Z]{3})$/, (_, c) => 'Цена, ' + c],
    [/^(\\d+) шт\\.$/, (_, n) => n + ' pcs'],
    [/^(\\d+) pcs$/, (_, n) => n + ' шт.'],
    [/^Итого: (.*)$/, (_, n) => 'Total: ' + n],
    [/^Total: (.*)$/, (_, n) => 'Итого: ' + n],
    [/^Фото (\\d+)$/, (_, n) => 'Photo ' + n],
    [/^Photo (\\d+)$/, (_, n) => 'Фото ' + n],
  ];
  const keys = ['aria-label','placeholder','title'];
  const app = document.body.classList.contains('delokay-app');
  if (!app) return;
  const platformMode = document.body.dataset.mode === 'platform';
  const manual = !platformMode && localStorage.getItem('delokay_locale');
  const telegram = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  let language = platformMode ? 'ru' : manual === 'ru' || manual === 'en'
    ? manual : telegram ? (/^ru(?:[-_]|$)/i.test(telegram) ? 'ru' : 'en') : 'ru';
  let observed = false;
  const observer = new MutationObserver((records) => {
    if (!observed) return;
    const parents = new Set();
    for (const record of records) {
      if (record.type === 'characterData') parents.add(record.target.parentElement);
      else for (const node of record.addedNodes) parents.add(node.nodeType === 1 ? node : node.parentElement);
    }
    for (const parent of parents) if (parent) translate(parent);
  });
  function translateValue(input, destination) {
    const value = String(input ?? '');
    const match = value.match(/^(\\s*)(.*?)(\\s*)$/s);
    if (!match || !match[2]) return value;
    let core = match[2];
    const direct = destination === 'en' ? en : reverse;
    const alternate = destination === 'en' ? reverse : en;
    // Exact UI strings only: do not translate arbitrary user-created titles.
    if (Object.hasOwn(direct, core)) core = direct[core];
    else if (!Object.hasOwn(alternate, core)) {
      for (const [i, pattern] of patterns.entries()) {
        if ((destination === 'en' && i % 2 !== 0) || (destination === 'ru' && i % 2 === 0)) continue;
        if (pattern[0].test(core)) { core = core.replace(pattern[0], pattern[1]); break; }
      }
    }
    return match[1] + core + match[3];
  }
  function translate(root) {
    if (!root) return;
    const elements = [];
    if (root.nodeType === 1) elements.push(root);
    if (root.querySelectorAll) elements.push(...root.querySelectorAll('*'));
    for (const element of elements) {
      if (element.closest('[data-no-i18n]')) continue;
      for (const key of keys) {
        if (!element.hasAttribute(key)) continue;
        const before = element.getAttribute(key);
        const after = translateValue(before, language);
        if (after !== before) element.setAttribute(key, after);
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent || parent.closest('[data-no-i18n],script,style,textarea,option[data-no-i18n]')) continue;
      const old = node.nodeValue;
      const newer = translateValue(old, language);
      if (old !== newer) node.nodeValue = newer;
    }
  }
  function set(languageCode) {
    if (!['ru','en'].includes(languageCode)) return;
    language = languageCode;
    document.documentElement.lang = language;
    if (!platformMode) localStorage.setItem('delokay_locale', language);
    translate(document.body);
    refreshSwitch();
  }
  function refreshSwitch() {
    const btn = document.getElementById('locale-switch');
    if (btn) {
      btn.textContent = language === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN';
      btn.title = language === 'ru' ? 'Switch to English' : 'Переключить на русский';
      btn.setAttribute('aria-label',language === 'ru' ? 'Switch to English' : 'Переключить на русский');
    }
  }
  document.documentElement.lang = language;
  document.addEventListener('click', (event) => {
    if (event.target.closest('#locale-switch')) {
      event.preventDefault();
      set(language === 'ru' ? 'en' : 'ru');
    }
  });
  observed = true;
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  translate(document.body);
  refreshSwitch();
  window.DelokayI18n = { get language() {return language;}, set, translate, t: (v) => translateValue(v,language), locale: () => language === 'ru' ? 'ru-RU' : 'en-US' };
})();
