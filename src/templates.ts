import type { Settings } from './types';
import { requireThat, imageUrl, object, int } from './validation';

// Illustrative prices are specified separately for each currency, not exchange rates.
const priceSets = [
  { BYN: 4900, RUB: 149000, KZT: 890000, USD: 1500, EUR: 1400 },
  { BYN: 8900, RUB: 279000, KZT: 1690000, USD: 2800, EUR: 2600 },
  { BYN: 12900, RUB: 399000, KZT: 2490000, USD: 4000, EUR: 3800 },
];
interface Sample {
  name: string;
  category: string;
  asset: string;
  price: number;
  variants: string[];
  detail: [string, string];
}
interface Template {
  id: Settings['theme'];
  title: string;
  name: string;
  description: string;
  accentColor: string;
  variantLabel: string;
  samples: Sample[];
}
export const templates: readonly Template[] = [
  {
    id: 'minimal',
    title: 'Универсальный',
    name: 'Мой магазин',
    description: 'Любимые вещи, удобный выбор и забота о каждой покупке.',
    accentColor: '#354f46',
    variantLabel: 'Вариант',
    samples: [
      {
        name: 'Хлопковый шоппер',
        category: 'Аксессуары',
        asset: 'fashion-bag',
        price: 0,
        variants: ['Натуральный', 'Чёрный'],
        detail: ['Материал', 'Хлопковая ткань'],
      },
      {
        name: 'Кружка на каждый день',
        category: 'Для дома',
        asset: 'home-cup',
        price: 0,
        variants: ['Молочный'],
        detail: ['Объём', '300 мл'],
      },
      {
        name: 'Базовая футболка',
        category: 'Одежда',
        asset: 'fashion-shirt',
        price: 1,
        variants: ['S', 'M', 'L'],
        detail: ['Состав', '100% хлопок'],
      },
      {
        name: 'Ваза для цветов',
        category: 'Для дома',
        asset: 'home-vase',
        price: 1,
        variants: ['Песочный'],
        detail: ['Высота', '24 см'],
      },
      {
        name: 'Мягкая подушка',
        category: 'Для дома',
        asset: 'home-pillow',
        price: 2,
        variants: ['45 × 45 см'],
        detail: ['Чехол', 'Льняная ткань'],
      },
      {
        name: 'Крем для рук',
        category: 'Уход',
        asset: 'beauty-tube',
        price: 0,
        variants: ['50 мл'],
        detail: ['Аромат', 'Мягкий цветочный'],
      },
    ],
  },
  {
    id: 'fashion',
    title: 'Одежда и аксессуары',
    name: 'FORMA',
    description:
      'Продуманный гардероб на каждый день. Чистые линии, приятные ткани и свобода сочетаний.',
    accentColor: '#252525',
    variantLabel: 'Размер',
    samples: [
      {
        name: 'Футболка свободного кроя',
        category: 'Одежда',
        asset: 'fashion-shirt',
        price: 0,
        variants: ['S', 'M', 'L'],
        detail: ['Состав', '100% хлопок'],
      },
      {
        name: 'Льняная рубашка',
        category: 'Одежда',
        asset: 'fashion-shirt-sand',
        price: 1,
        variants: ['S', 'M', 'L'],
        detail: ['Состав', '100% лён'],
      },
      {
        name: 'Сумка на каждый день',
        category: 'Аксессуары',
        asset: 'fashion-bag',
        price: 2,
        variants: ['Стандарт'],
        detail: ['Материал', 'Плотная хлопковая ткань'],
      },
      {
        name: 'Шоппер из хлопка',
        category: 'Аксессуары',
        asset: 'fashion-bag-sand',
        price: 0,
        variants: ['Стандарт'],
        detail: ['Размер', '38 × 42 см'],
      },
      {
        name: 'Свитшот базовый',
        category: 'Одежда',
        asset: 'fashion-shirt-sand',
        price: 2,
        variants: ['M', 'L', 'XL'],
        detail: ['Состав', 'Хлопок и полиэстер'],
      },
      {
        name: 'Футболка с длинным рукавом',
        category: 'Одежда',
        asset: 'fashion-shirt',
        price: 1,
        variants: ['S', 'M', 'L'],
        detail: ['Посадка', 'Свободная'],
      },
    ],
  },
  {
    id: 'home',
    title: 'Дом и декор',
    name: 'Тихий дом',
    description:
      'Маленькие детали для большого чувства дома. Керамика, текстиль и вещи с характером.',
    accentColor: '#8b513c',
    variantLabel: 'Вариант',
    samples: [
      {
        name: 'Керамическая ваза',
        category: 'Декор',
        asset: 'home-vase',
        price: 1,
        variants: ['Песочный', 'Терракота'],
        detail: ['Высота', '24 см'],
      },
      {
        name: 'Кружка с мягкой глазурью',
        category: 'Керамика',
        asset: 'home-cup',
        price: 0,
        variants: ['Молочный'],
        detail: ['Объём', '300 мл'],
      },
      {
        name: 'Льняная наволочка',
        category: 'Текстиль',
        asset: 'home-pillow',
        price: 0,
        variants: ['40 × 40 см', '50 × 50 см'],
        detail: ['Состав', '100% лён'],
      },
      {
        name: 'Ваза для сухоцветов',
        category: 'Декор',
        asset: 'home-vase-clay',
        price: 2,
        variants: ['Терракота'],
        detail: ['Материал', 'Керамика'],
      },
      {
        name: 'Чашка для утреннего кофе',
        category: 'Керамика',
        asset: 'home-cup',
        price: 0,
        variants: ['Молочный'],
        detail: ['Объём', '200 мл'],
      },
      {
        name: 'Декоративная подушка',
        category: 'Текстиль',
        asset: 'home-pillow',
        price: 1,
        variants: ['45 × 45 см'],
        detail: ['Наполнитель', 'Полиэфирное волокно'],
      },
    ],
  },
  {
    id: 'beauty',
    title: 'Косметика и уход',
    name: 'LUNA care',
    description:
      'Простой ритуал заботы о себе. Найдите любимую текстуру и соберите свой ежедневный уход.',
    accentColor: '#6b455d',
    variantLabel: 'Объём',
    samples: [
      {
        name: 'Крем для рук',
        category: 'Для тела',
        asset: 'beauty-tube',
        price: 0,
        variants: ['50 мл', '100 мл'],
        detail: ['Аромат', 'Мягкий цветочный'],
      },
      {
        name: 'Очищающий гель',
        category: 'Для лица',
        asset: 'beauty-bottle',
        price: 1,
        variants: ['150 мл'],
        detail: ['Текстура', 'Гелевая'],
      },
      {
        name: 'Крем для лица',
        category: 'Для лица',
        asset: 'beauty-jar',
        price: 2,
        variants: ['50 мл'],
        detail: ['Текстура', 'Лёгкий крем'],
      },
      {
        name: 'Лосьон для тела',
        category: 'Для тела',
        asset: 'beauty-bottle-rose',
        price: 1,
        variants: ['200 мл'],
        detail: ['Аромат', 'Нейтральный'],
      },
      {
        name: 'Бальзам для губ',
        category: 'Для лица',
        asset: 'beauty-jar',
        price: 0,
        variants: ['15 мл'],
        detail: ['Финиш', 'Без цвета'],
      },
      {
        name: 'Крем для ног',
        category: 'Для тела',
        asset: 'beauty-tube',
        price: 0,
        variants: ['75 мл'],
        detail: ['Текстура', 'Плотный крем'],
      },
    ],
  },
];
export function findTemplate(id: string) {
  return templates.find((t) => t.id === id);
}
export function templateList() {
  return templates.map(({ samples, ...meta }) => ({ ...meta, productCount: samples.length }));
}
const themeCopy = {
  minimal: {
    hero: 'Полезные находки на каждый день',
    delivery:
      'Выберите доставку или самовывоз. После оформления мы свяжемся с вами, уточним наличие, стоимость и удобное время получения.',
    footer: 'Спасибо, что выбираете нас. Поможем с выбором и ответим на ваши вопросы.',
    pick: 'Выберите подходящий вариант',
    support: 'Поможем выбрать товар и оформить заказ',
  },
  fashion: {
    hero: 'Ваш стиль начинается с деталей',
    delivery:
      'Доставим ваш заказ или подготовим его к самовывозу. Перед отправкой уточним размер, наличие и условия получения.',
    footer: 'Одежда и аксессуары для ваших повседневных историй.',
    pick: 'Подберите размер и количество',
    support: 'Поможем подобрать размер и собрать образ',
  },
  home: {
    hero: 'Вещи, с которыми дома уютнее',
    delivery:
      'Бережно упакуем керамику и текстиль. Стоимость и сроки доставки подтвердим после оформления; также доступен самовывоз.',
    footer: 'Наполняйте дом теплом, фактурами и любимыми деталями.',
    pick: 'Подберите вариант для вашего дома',
    support: 'Подскажем размеры, материалы и сочетания',
  },
  beauty: {
    hero: 'Время позаботиться о себе',
    delivery:
      'Соберём ваш уход для доставки или самовывоза. Наличие, сроки и стоимость получения подтвердим после оформления заказа.',
    footer: 'Ваш ежедневный ритуал заботы о себе.',
    pick: 'Выберите объём и количество',
    support: 'Расскажем о текстурах и поможем с выбором ухода',
  },
};
export function templateSettings(t: Template) {
  const copy = themeCopy[t.id];
  return {
    theme: t.id,
    description: t.description,
    heroTitle: copy.hero,
    footerText: copy.footer,
    deliveryMethods: ['Доставка', 'Самовывоз'],
    deliveryHint: copy.delivery,
    accentColor: t.accentColor,
    texts: {
      btn_cart: 'Корзина',
      btn_add: 'В корзину',
      btn_add_size: 'Выберите ' + t.variantLabel.toLowerCase(),
      btn_clear: 'Очистить корзину',
      label_size: t.variantLabel,
      label_qty: 'Количество',
      label_year: 'Коллекция',
      label_color: 'Цвет',
      label_number: 'Артикул',
      label_total: 'Итого',
      label_pick: copy.pick,
      filter_all: 'Все товары',
      msg_empty_cart: 'Ваша корзина пока пуста. Выберите то, что вам нравится.',
      msg_added: 'Добавлено в корзину ✓',
      wa_msg_header: 'Здравствуйте! Хочу оформить заказ:',
      wa_msg_footer: 'Подтвердите, пожалуйста, наличие и условия получения. Спасибо!',
      tg_msg_header: 'Здравствуйте! Хочу оформить заказ:',
      tg_msg_footer: 'Подтвердите, пожалуйста, наличие и условия получения. Спасибо!',
      support_label: copy.support,
    },
  };
}
const descriptions: Record<string, string> = {
  'Хлопковый шоппер':
    'Вместительный шоппер для покупок, прогулок и повседневных дел. Удобные ручки позволяют носить его на плече; ткань легко складывается и занимает мало места.',
  'Кружка на каждый день':
    'Кружка с удобной ручкой для чая, кофе и неспешных домашних завтраков. Спокойный молочный оттенок легко сочетается с любимой посудой.',
  'Базовая футболка':
    'Мягкая хлопковая футболка для повседневного гардероба. Простой силуэт сочетается с джинсами, брюками и многослойными образами.',
  'Ваза для цветов':
    'Лаконичная керамическая ваза для букета или самостоятельного акцента в интерьере. Песочный оттенок подчёркивает естественную красоту цветов.',
  'Мягкая подушка':
    'Подушка с фактурным чехлом добавит уюта дивану, креслу или спальне. Нейтральный оттенок удобно сочетать с другим домашним текстилем.',
  'Футболка свободного кроя':
    'Свободная хлопковая футболка с мягкой фактурой и лаконичным силуэтом. Носите самостоятельно или сочетайте с рубашкой и любимыми аксессуарами.',
  'Льняная рубашка':
    'Лёгкая рубашка из льна для расслабленных повседневных образов. Свободный крой позволяет носить её навыпуск или поверх базовой футболки.',
  'Сумка на каждый день':
    'Практичная сумка из плотной ткани для необходимых мелочей, покупок и прогулок. Универсальная форма легко впишется в повседневный гардероб.',
  'Шоппер из хлопка':
    'Лаконичный хлопковый шоппер для города и поездок. Вместительный основной отдел и длинные ручки помогают держать нужные вещи под рукой.',
  'Свитшот базовый':
    'Мягкий свитшот свободного силуэта для прогулок и отдыха. Сочетайте с джинсами или спортивными брюками и создавайте удобные многослойные образы.',
  'Футболка с длинным рукавом':
    'Хлопковая футболка с длинным рукавом для прохладных дней. Свободная посадка даёт комфорт и позволяет легко сочетать её с другими слоями.',
  'Керамическая ваза':
    'Ваза с мягкими линиями и выразительной керамической фактурой. Украсьте её свежими цветами или используйте как самостоятельную деталь интерьера.',
  'Кружка с мягкой глазурью':
    'Керамическая кружка с приятной глазурью для ваших любимых напитков. Мягкий оттенок и удобная форма дополнят ежедневные домашние ритуалы.',
  'Льняная наволочка':
    'Фактурная льняная наволочка для декоративной подушки. Естественная ткань и спокойный цвет добавляют тепла спальне или гостиной.',
  'Ваза для сухоцветов':
    'Терракотовая ваза для сухоцветов, ветвей и декоративных композиций. Тёплый оттенок станет выразительным акцентом на полке или столе.',
  'Чашка для утреннего кофе':
    'Небольшая керамическая чашка для любимого утреннего кофе. Удобная форма и спокойная глазурь помогают начать день без спешки.',
  'Декоративная подушка':
    'Мягкая декоративная подушка для дивана, кресла или кровати. Сочетайте её с пледами и другими фактурами, чтобы обновить настроение комнаты.',
  'Крем для рук':
    'Крем для ежедневного ухода за руками с мягким цветочным ароматом. Наносите небольшое количество на чистую кожу и распределяйте массажными движениями.',
  'Очищающий гель':
    'Гель для ежедневного очищения кожи лица. Вспеньте небольшое количество во влажных ладонях, мягко распределите по коже и смойте водой.',
  'Крем для лица':
    'Крем с лёгкой текстурой для ежедневного ухода за лицом. Наносите на очищенную кожу после привычных этапов ухода, избегая области вокруг глаз.',
  'Лосьон для тела':
    'Лосьон с мягкой текстурой для ухода за телом после душа. Распределяйте по чистой коже лёгкими массажными движениями до впитывания.',
  'Бальзам для губ':
    'Бесцветный бальзам для повседневного ухода за губами. Наносите тонким слоем по мере необходимости; компактный формат удобно брать с собой.',
  'Крем для ног':
    'Крем с плотной текстурой для вечернего ухода за кожей стоп. Наносите на чистую сухую кожу и распределяйте массажными движениями.',
};
export function templateProducts(t: Template, codes: string[]) {
  return t.samples.map((s, i) => ({
    name: s.name,
    category: s.category,
    description: descriptions[s.name],
    color: t.id === 'beauty' ? 'Нейтральный' : 'Натуральный',
    brand: t.name,
    collection: 'Базовая коллекция',
    sku: t.id.toUpperCase() + '-' + String(i + 1).padStart(3, '0'),
    attributes: [{ label: s.detail[0], value: s.detail[1] }],
    photos: ['/template-assets/' + s.asset + '.svg'],
    prices: Object.fromEntries(
      codes.map((code) => [code, priceSets[s.price][code as keyof (typeof priceSets)[0]]]),
    ),
    variants: s.variants.map((label) => ({ label, stock: 10 })),
  }));
}

interface TemplatePhotos {
  template_id: string;
  media_id: string;
  photos: string;
  version: number;
}
export async function photoRecord(env: Env, id: string, create = false) {
  requireThat(findTemplate(id), 'Шаблон не найден', 404);
  if (create)
    await env.DB.prepare('INSERT OR IGNORE INTO template_photos(template_id,media_id) VALUES(?,?)')
      .bind(id, crypto.randomUUID())
      .run();
  return env.DB.prepare('SELECT * FROM template_photos WHERE template_id=?')
    .bind(id)
    .first<TemplatePhotos>();
}
export async function resolvedTemplateProducts(env: Env, t: Template, codes: string[]) {
  const record = await photoRecord(env, t.id);
  const photos = JSON.parse(record?.photos || '{}') as Record<string, string>;
  return {
    mediaId: record?.media_id,
    version: record?.version || 1,
    photos,
    products: templateProducts(t, codes).map((p, i) => ({
      ...p,
      defaultPhoto: p.photos[0],
      photos: photos[i] ? [photos[i]] : p.photos,
    })),
  };
}
export async function saveTemplatePhotos(env: Env, id: string, input: unknown) {
  const record = await photoRecord(env, id, true);
  requireThat(record, 'Шаблон не найден', 404);
  const t = findTemplate(id)!;
  const d = object(input);
  const version = int(d.version, 1, Number.MAX_SAFE_INTEGER);
  const photos: Record<string, string> = {};
  for (const [key, value] of Object.entries(object(d.photos))) {
    requireThat(
      /^(0|[1-9]\d*)$/.test(key) && Number(key) < t.samples.length,
      'Неизвестный пример товара',
    );
    const url = imageUrl(value, record.media_id);
    if (url) photos[key] = url;
  }
  const result = await env.DB.prepare(
    'UPDATE template_photos SET photos=?,version=version+1 WHERE template_id=? AND version=?',
  )
    .bind(JSON.stringify(photos), id, version)
    .run();
  requireThat(result.meta.changes === 1, 'Шаблон изменён. Обновите страницу.', 409);
  return { ok: true, version: version + 1 };
}
