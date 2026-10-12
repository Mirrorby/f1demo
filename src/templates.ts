import type { Settings } from './types';

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
    samples: [],
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
export function templateSettings(t: Template) {
  return {
    theme: t.id,
    description: t.description,
    accentColor: t.accentColor,
    texts: { label_size: t.variantLabel, btn_add_size: 'Выберите ' + t.variantLabel.toLowerCase() },
  };
}
export function templateProducts(t: Template, codes: string[]) {
  return t.samples.map((s, i) => ({
    name: s.name,
    category: s.category,
    description:
      'Пример товара для демонстрации шаблона. Замените описание, иллюстрацию, цены и остатки перед активацией магазина.',
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
