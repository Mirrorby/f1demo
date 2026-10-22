import extraLocales from './storefront-locales.json';
export const supportedLanguages = [
  'ru',
  'en',
  'es',
  'pt',
  'fr',
  'it',
  'tr',
  'pl',
  'ja',
  'de',
] as const;
export type Language = (typeof supportedLanguages)[number];
export function normalizeLanguage(value: string): Language {
  return supportedLanguages.includes(value as Language) ? (value as Language) : 'ru';
}
export const english: Record<string, string> = {
  'Одежда и аксессуары на каждый день': 'Everyday clothing and accessories',
  'Футболки, льняные рубашки, свитшоты и сумки. Выберите модель, изучите состав и подберите размер в каталоге.':
    'T-shirts, linen shirts, sweatshirts and bags. Explore styles, check materials and choose your size in the catalog.',
  'О магазине': 'About the store',
  'Как выбрать размер?': 'How do I choose a size?',
  'Как оформить заказ?': 'How do I place an order?',
  'Доставка и оплата': 'Delivery and payment',
  'Одежда и аксессуары для повседневного гардероба: футболки, рубашки, свитшоты и сумки. Сравните модели, состав и доступные размеры в каталоге.':
    'Everyday clothing and accessories: T-shirts, shirts, sweatshirts and bags. Compare styles, materials and available sizes in the catalog.',
  'Откройте карточку товара и проверьте доступные размеры и характеристики. Если нужных мерок нет, уточните их у продавца до оформления заказа.':
    'Open a product to check available sizes and details. If measurements are missing, ask the seller before placing an order.',
  'Выберите товар, размер и количество, затем добавьте его в корзину. Проверьте состав заказа и заполните контактные данные.':
    'Choose a product, size and quantity, then add it to your cart. Review your selection and enter your contact details.',
  'Доступные способы получения указаны при оформлении заказа. Географию доставки, стоимость, сроки и способы оплаты уточняйте у продавца до подтверждения покупки.':
    'Available delivery methods are shown at checkout. Confirm delivery areas, costs, timing and payment methods with the seller before confirming your purchase.',

  'Демонстрация магазина. Реальные заказы отключены.': 'Demo store. Real orders are disabled.',
  'Контакт будет добавлен': 'Contact will be added',
  Подробнее: 'Details',
  'Цена по запросу': 'Price on request',
  Высота: 'Height',
  'Демонстрация магазина. Заказы и сообщения продавцу отключены.':
    'Demo store. Ordering and seller messages are disabled.',
  'Загрузка…': 'Loading…',
  Логотип: 'Logo',
  'Ваш магазин': 'Your store',
  'Выберите то, что вам нравится.': 'Choose something you love.',
  Каталог: 'Catalog',
  '© Магазин': '© Store',
  Корзина: 'Cart',
  Заказать: 'Order',
  'Написать в Instagram': 'Message on Instagram',
  'В корзину': 'Add to cart',
  'Выберите вариант': 'Select an option',
  'Очистить корзину': 'Clear cart',
  Вариант: 'Option',
  Количество: 'Quantity',
  Год: 'Year',
  Коллекция: 'Collection',
  Цвет: 'Color',
  Номер: 'Number',
  Артикул: 'SKU',
  Итого: 'Total',
  'Выбрать параметры': 'Choose options',
  Все: 'All',
  'Все товары': 'All products',
  'Корзина пуста': 'Your cart is empty',
  'Ваша корзина пока пуста. Выберите то, что вам нравится.':
    'Your cart is empty. Choose something you love.',
  'Добавлено в корзину ✓': 'Added to cart ✓',
  'Привет! Хочу сделать заказ:': 'Hi! I would like to place an order:',
  'Здравствуйте! Хочу оформить заказ:': 'Hello! I would like to place an order:',
  'Подтвердите, пожалуйста, наличие и условия получения. Спасибо!':
    'Please confirm availability and delivery details. Thank you!',
  'ПОД ЗАКАЗ': 'PREORDER',
  'Позиции «ПОД ЗАКАЗ» требуют времени на доставку, уточним сроки.':
    'Preorder items require extra delivery time. We will confirm the details.',
  'По всем вопросам пишите нам': 'Contact us with any questions',
  Доставка: 'Delivery',
  Самовывоз: 'Pickup',
  'Не удалось загрузить магазин': 'Unable to load the store',
  'В наличии': 'In stock',
  'На заказ': 'Preorder',
  'Нет в наличии': 'Out of stock',
  'Предпросмотр шаблона · товары и цены приведены для примера · заказы отключены':
    'Template preview · sample products and prices · ordering disabled',
  'Приём заказов временно приостановлен': 'Orders are temporarily paused',
  'Демо магазина': 'Demo store',
  'Нет товаров в этой категории': 'No products in this category',
  'Уточнить вариант': 'Confirm option',
  'Вариант будет уточнён менеджером при подтверждении заказа':
    'We will confirm the option when processing your order',
  '⚠️ Вариант: уточнить у менеджера': '⚠️ Option: confirm with the seller',
  'Способ доставки': 'Delivery method',
  'Имя получателя *': 'Recipient name *',
  'Телефон *': 'Phone *',
  'Адрес или пункт самовывоза *': 'Address or pickup point *',
  Город: 'City',
  Область: 'Region',
  Индекс: 'Postal code',
  Комментарий: 'Comment',
  'Сохранить данные доставки': 'Save delivery details',
  'Данные доставки сохранены': 'Delivery details saved',
  'Это демонстрация магазина': 'This is a demo store',
  'Приём заказов приостановлен': 'Orders are paused',
  'Сначала заполните адрес доставки': 'Enter your delivery address first',
  'Заказы отключены в демо': 'Ordering is disabled in this demo',
  'Оформить заказ': 'Place order',
  'Заполните обязательные поля': 'Fill in the required fields',
  'Это демонстрация. Реальные заказы отключены.': 'This is a demo. Ordering is disabled.',
  'Сохраните данные доставки': 'Save your delivery details',
  'Оформление…': 'Placing order…',
  'Не удалось сохранить заказ': 'Unable to save the order',
  'Сервер не подтвердил сохранение заказа': 'The server did not confirm your order',
  'Заказ сохранён. Итого: ': 'Order saved. Total: ',
  '. Продавец свяжется с вами для подтверждения.':
    '. The seller will contact you to confirm your order.',
  'Заказ #': 'Order #',
  'Ошибка сети. Заказ не подтверждён. Попробуйте снова.':
    'Network error. Your order is not confirmed. Please try again.',
  'Заказ принят': 'Order received',
  'Написать в WhatsApp': 'Message on WhatsApp',
  'Написать в Telegram': 'Message on Telegram',
  Закрыть: 'Close',
  'Предыдущее фото': 'Previous photo',
  'Следующее фото': 'Next photo',
  'Демонстрационная версия. Реальные заказы отключены.': 'Demo version. Ordering is disabled.',
  'Полезные находки на каждый день': 'Everyday finds you will love',
  'Выберите доставку или самовывоз. После оформления мы свяжемся с вами, уточним наличие, стоимость и удобное время получения.':
    'Choose delivery or pickup. After checkout, we will contact you to confirm availability, cost and a convenient time.',
  'Спасибо, что выбираете нас. Поможем с выбором и ответим на ваши вопросы.':
    'Thank you for choosing us. We are happy to help you choose and answer your questions.',
  'Выберите подходящий вариант': 'Choose the right option for you',
  'Поможем выбрать товар и оформить заказ': 'We can help you choose and place your order',
  'Ваш стиль начинается с деталей': 'Your style starts with the details',
  'Доставим ваш заказ или подготовим его к самовывозу. Перед отправкой уточним размер, наличие и условия получения.':
    'We will deliver your order or prepare it for pickup. Before dispatch, we will confirm the size, availability and delivery details.',
  'Одежда и аксессуары для ваших повседневных историй.':
    'Clothing and accessories for your everyday stories.',
  'Подберите размер и количество': 'Choose your size and quantity',
  'Поможем подобрать размер и собрать образ':
    'We can help you find your size and complete your look',
  'Вещи, с которыми дома уютнее': 'Little things that make a house a home',
  'Бережно упакуем керамику и текстиль. Стоимость и сроки доставки подтвердим после оформления; также доступен самовывоз.':
    'We carefully pack ceramics and textiles. We will confirm delivery costs and timing after checkout. Pickup is also available.',
  'Наполняйте дом теплом, фактурами и любимыми деталями.':
    'Fill your home with warmth, texture and your favorite details.',
  'Подберите вариант для вашего дома': 'Choose an option for your home',
  'Подскажем размеры, материалы и сочетания':
    'Ask us about dimensions, materials and matching pieces',
  'Время позаботиться о себе': 'Time to take care of yourself',
  'Соберём ваш уход для доставки или самовывоза. Наличие, сроки и стоимость получения подтвердим после оформления заказа.':
    'We will prepare your skincare for delivery or pickup. Availability, timing and costs will be confirmed after checkout.',
  'Ваш ежедневный ритуал заботы о себе.': 'Your daily self-care ritual.',
  'Выберите объём и количество': 'Choose your volume and quantity',
  'Расскажем о текстурах и поможем с выбором ухода':
    'Ask us about textures and finding your skincare routine',
  'Любимые вещи, удобный выбор и забота о каждой покупке.':
    'Favorite things, easy choices and care with every purchase.',
  'Продуманный гардероб на каждый день. Чистые линии, приятные ткани и свобода сочетаний.':
    'A thoughtful everyday wardrobe. Clean lines, comfortable fabrics and endless combinations.',
  'Маленькие детали для большого чувства дома. Керамика, текстиль и вещи с характером.':
    'Small details that make a home. Ceramics, textiles and pieces with character.',
  'Простой ритуал заботы о себе. Найдите любимую текстуру и соберите свой ежедневный уход.':
    'A simple self-care ritual. Find your favorite textures and build your daily routine.',
  Размер: 'Size',
  Объём: 'Volume',
  'Выберите размер': 'Select a size',
  'Выберите объём': 'Select a volume',
  'Владелец магазина ещё не подключён': 'The store owner has not connected yet',
  'Требуется ключ повторного запроса': 'A request key is required. Please try again.',
  'Недопустимая валюта': 'Unsupported currency',
  'Проверьте номер телефона': 'Check your phone number',
  'Недопустимый способ доставки': 'Choose a valid delivery method',
  'От 1 до 20 позиций в заказе': 'Your order must contain between 1 and 20 items',
  'Объедините одинаковые варианты': 'Combine identical options in your cart',
  'Этот ключ уже использован для другого заказа':
    'This request key was used for another order. Refresh and try again.',
  'Товар или вариант не найден': 'Product or option not found. Refresh your cart.',
  'Товар недоступен': 'This product is unavailable',
  'Недостаточно товара в наличии': 'Not enough items in stock',
  'Цена недоступна': 'Price unavailable',
  'Цена изменилась. Обновите страницу и корзину.':
    'The price has changed. Refresh the page and your cart.',
  'Слишком большая сумма заказа': 'The order total is too large',
  'Слишком много заказов. Попробуйте позже.': 'Too many orders. Please try again later.',
  'Каталог изменился. Обновите страницу и корзину.':
    'The catalog has changed. Refresh the page and your cart.',
  'Failed to fetch': 'Network error. Your order is not confirmed. Please try again.',
  'Хлопковый шоппер': 'Cotton tote bag',
  'Кружка на каждый день': 'Everyday mug',
  'Базовая футболка': 'Essential T-shirt',
  'Ваза для цветов': 'Flower vase',
  'Мягкая подушка': 'Soft cushion',
  'Футболка свободного кроя': 'Relaxed T-shirt',
  'Льняная рубашка': 'Linen shirt',
  'Сумка на каждый день': 'Everyday bag',
  'Шоппер из хлопка': 'Cotton shopper',
  'Свитшот базовый': 'Essential sweatshirt',
  'Футболка с длинным рукавом': 'Long-sleeve T-shirt',
  'Керамическая ваза': 'Ceramic vase',
  'Кружка с мягкой глазурью': 'Soft-glazed mug',
  'Льняная наволочка': 'Linen cushion cover',
  'Ваза для сухоцветов': 'Dried flower vase',
  'Чашка для утреннего кофе': 'Morning coffee cup',
  'Декоративная подушка': 'Decorative cushion',
  'Крем для рук': 'Hand cream',
  'Очищающий гель': 'Cleansing gel',
  'Крем для лица': 'Face cream',
  'Лосьон для тела': 'Body lotion',
  'Бальзам для губ': 'Lip balm',
  'Крем для ног': 'Foot cream',
  Аксессуары: 'Accessories',
  'Для дома': 'Home',
  Одежда: 'Clothing',
  Натуральный: 'Natural',
  Чёрный: 'Black',
  Молочный: 'Ivory',
  Песочный: 'Sand',
  Нейтральный: 'Neutral',
  Материал: 'Material',
  'Хлопковая ткань': 'Cotton fabric',
  Состав: 'Composition',
  '100% хлопок': '100% cotton',
  '100% лён': '100% linen',
  Наполнитель: 'Filling',
  'Полиэфирное волокно': 'Polyester fiber',
  Посадка: 'Fit',
  Свободная: 'Relaxed',
  'Плотная хлопковая ткань': 'Heavyweight cotton fabric',
  'Хлопок и полиэстер': 'Cotton and polyester',
  Керамика: 'Ceramic',
  Декор: 'Decor',
  Текстиль: 'Textiles',
  'Льняная ткань': 'Linen fabric',
  Терракота: 'Terracotta',
  Чехол: 'Cover',
  'Для лица': 'Face',
  'Для тела': 'Body',
  Уход: 'Care',
  Аромат: 'Scent',
  'Мягкий цветочный': 'Soft floral',
  Текстура: 'Texture',
  Гелевая: 'Gel',
  'Лёгкий крем': 'Light cream',
  'Плотный крем': 'Rich cream',
  Финиш: 'Finish',
  'Без цвета': 'Clear',
  Стандарт: 'Standard',
  'Мой магазин': 'My store',
  'Тихий дом': 'Quiet home',
  'Базовая коллекция': 'Essential collection',
  'Вместительный шоппер для покупок, прогулок и повседневных дел. Удобные ручки позволяют носить его на плече; ткань легко складывается и занимает мало места.':
    'A roomy tote for shopping, walks and everyday errands. Comfortable handles let you carry it on your shoulder, and the fabric folds away easily.',
  'Кружка с удобной ручкой для чая, кофе и неспешных домашних завтраков. Спокойный молочный оттенок легко сочетается с любимой посудой.':
    'A comfortable mug for tea, coffee and slow breakfasts at home. The calm ivory shade pairs easily with your favorite tableware.',
  'Мягкая хлопковая футболка для повседневного гардероба. Простой силуэт сочетается с джинсами, брюками и многослойными образами.':
    'A soft cotton T-shirt for your everyday wardrobe. The simple silhouette pairs with jeans, trousers and layered outfits.',
  'Лаконичная керамическая ваза для букета или самостоятельного акцента в интерьере. Песочный оттенок подчёркивает естественную красоту цветов.':
    'A simple ceramic vase for a bouquet or a standalone accent. Its sandy shade brings out the natural beauty of fresh flowers.',
  'Подушка с фактурным чехлом добавит уюта дивану, креслу или спальне. Нейтральный оттенок удобно сочетать с другим домашним текстилем.':
    'A cushion with a textured cover to bring comfort to your sofa, armchair or bedroom. The neutral shade pairs easily with other textiles.',
  'Свободная хлопковая футболка с мягкой фактурой и лаконичным силуэтом. Носите самостоятельно или сочетайте с рубашкой и любимыми аксессуарами.':
    'A relaxed cotton T-shirt with a soft feel and a simple silhouette. Wear it on its own or layer it with a shirt and your favorite accessories.',
  'Лёгкая рубашка из льна для расслабленных повседневных образов. Свободный крой позволяет носить её навыпуск или поверх базовой футболки.':
    'A lightweight linen shirt for relaxed everyday outfits. Wear the loose cut untucked or open over an essential T-shirt.',
  'Практичная сумка из плотной ткани для необходимых мелочей, покупок и прогулок. Универсальная форма легко впишется в повседневный гардероб.':
    'A practical heavy-fabric bag for your essentials, shopping and walks. The versatile shape fits easily into an everyday wardrobe.',
  'Лаконичный хлопковый шоппер для города и поездок. Вместительный основной отдел и длинные ручки помогают держать нужные вещи под рукой.':
    'A simple cotton shopper for city days and trips. A roomy main compartment and long handles keep your essentials close at hand.',
  'Мягкий свитшот свободного силуэта для прогулок и отдыха. Сочетайте с джинсами или спортивными брюками и создавайте удобные многослойные образы.':
    'A soft, relaxed sweatshirt for walks and downtime. Pair it with jeans or joggers to create comfortable layered outfits.',
  'Хлопковая футболка с длинным рукавом для прохладных дней. Свободная посадка даёт комфорт и позволяет легко сочетать её с другими слоями.':
    'A long-sleeve cotton T-shirt for cooler days. The relaxed fit keeps you comfortable and makes layering effortless.',
  'Ваза с мягкими линиями и выразительной керамической фактурой. Украсьте её свежими цветами или используйте как самостоятельную деталь интерьера.':
    'A vase with soft lines and a distinctive ceramic texture. Add fresh flowers or let it stand alone as a decorative accent.',
  'Керамическая кружка с приятной глазурью для ваших любимых напитков. Мягкий оттенок и удобная форма дополнят ежедневные домашние ритуалы.':
    'A ceramic mug with a pleasant glaze for your favorite drinks. A gentle shade and comfortable shape complement daily rituals at home.',
  'Фактурная льняная наволочка для декоративной подушки. Естественная ткань и спокойный цвет добавляют тепла спальне или гостиной.':
    'A textured linen cover for a decorative cushion. Natural fabric and a calm color add warmth to a bedroom or living room.',
  'Терракотовая ваза для сухоцветов, ветвей и декоративных композиций. Тёплый оттенок станет выразительным акцентом на полке или столе.':
    'A terracotta vase for dried flowers, branches and decorative arrangements. Its warm shade makes a distinctive shelf or table accent.',
  'Небольшая керамическая чашка для любимого утреннего кофе. Удобная форма и спокойная глазурь помогают начать день без спешки.':
    'A small ceramic cup for your favorite morning coffee. A comfortable shape and calm glaze help you start the day at your own pace.',
  'Мягкая декоративная подушка для дивана, кресла или кровати. Сочетайте её с пледами и другими фактурами, чтобы обновить настроение комнаты.':
    'A soft decorative cushion for a sofa, armchair or bed. Pair it with throws and different textures to refresh the feel of your room.',
  'Крем для ежедневного ухода за руками с мягким цветочным ароматом. Наносите небольшое количество на чистую кожу и распределяйте массажными движениями.':
    'A daily hand cream with a soft floral scent. Apply a small amount to clean skin and gently massage it in.',
  'Гель для ежедневного очищения кожи лица. Вспеньте небольшое количество во влажных ладонях, мягко распределите по коже и смойте водой.':
    'A gel for everyday facial cleansing. Lather a small amount in wet hands, gently apply to the skin and rinse with water.',
  'Крем с лёгкой текстурой для ежедневного ухода за лицом. Наносите на очищенную кожу после привычных этапов ухода, избегая области вокруг глаз.':
    'A lightweight cream for daily facial care. Apply to cleansed skin after your usual skincare steps, avoiding the eye area.',
  'Лосьон с мягкой текстурой для ухода за телом после душа. Распределяйте по чистой коже лёгкими массажными движениями до впитывания.':
    'A soft-textured lotion for body care after a shower. Massage gently over clean skin until absorbed.',
  'Бесцветный бальзам для повседневного ухода за губами. Наносите тонким слоем по мере необходимости; компактный формат удобно брать с собой.':
    'A clear balm for everyday lip care. Apply a thin layer as needed. The compact size is convenient to carry with you.',
  'Крем с плотной текстурой для вечернего ухода за кожей стоп. Наносите на чистую сухую кожу и распределяйте массажными движениями.':
    'A rich cream for evening foot care. Apply to clean, dry skin and gently massage it in.',
};
export function translate(value: string, language: Language): string {
  if (language === 'ru') return value;
  const text = english[value] ?? value;
  return language === 'en'
    ? text
    : (extraLocales[language][text as keyof (typeof extraLocales)[typeof language]] ?? text);
}

export const storefrontDictionaries = Object.fromEntries(
  supportedLanguages
    .filter((l) => l !== 'ru')
    .map((l) => [
      l,
      Object.fromEntries(Object.keys(english).map((key) => [key, translate(key, l)])),
    ]),
);
