import type { Settings } from './types';

// Editorial defaults describe how to choose products, never unverified merchant policies.
export function templateContent(theme: Settings['theme'], language = 'ru'): Record<string, string> {
  const en = language !== 'ru';
  const pick = (ru: string, english: string) => (en ? english : ru);
  const niches = {
    minimal: [
      'В каталоге собраны товары для повседневных задач и подарков. Сравните назначение, характеристики и варианты перед покупкой.',
      'Explore everyday essentials and gift ideas. Compare their purpose, specifications and options before buying.',
      'Начните с назначения товара. Проверьте размеры, материал, комплектацию и доступные варианты в карточке. Если данных недостаточно, задайте вопрос продавцу до заказа.',
      'Start with what you need the product for. Check dimensions, materials, included items and available options. Ask the seller for missing details before ordering.',
      'Как сравнить похожие товары?',
      'How can I compare similar products?',
      'Сравнивайте характеристики для одной задачи: размер, материал, комплектацию и условия использования. Разница в цене сама по себе не объясняет различия между товарами.',
      'Compare specifications for the same purpose: size, material, included items and conditions of use. Price alone does not explain the differences between products.',
    ],
    fashion: [
      'Одежда и аксессуары для повседневного гардероба: футболки, рубашки, свитшоты и сумки. Сравните модели, состав и доступные размеры в каталоге.',
      'Everyday clothing and accessories: T-shirts, shirts, sweatshirts and bags. Compare styles, materials and available sizes in the catalog.',
      'Сопоставьте мерки изделия с одеждой, которая вам подходит: ширину, длину и посадку. Буквенные размеры разных брендов могут отличаться. Недостающие замеры уточняйте у продавца.',
      'Compare garment measurements with clothing that fits you: width, length and cut. Letter sizes can differ between brands. Ask the seller for any missing measurements.',
      'Как ухаживать за одеждой и аксессуарами?',
      'How should I care for clothing and accessories?',
      'Проверьте состав и рекомендации на ярлыке изделия. Температура стирки, сушка и уход за фурнитурой зависят от материала; универсальный режим подходит не всем вещам.',
      'Check the fabric composition and care label. Washing temperature, drying and hardware care depend on the material; one care routine will not suit every item.',
    ],
    home: [
      'Керамика, текстиль и предметы декора для дома. Подбирайте вещи по размерам, материалам и назначению, чтобы они подходили вашему пространству.',
      'Ceramics, textiles and decorative objects for your home. Choose by dimensions, materials and purpose so each piece fits your space.',
      'Измерьте место для предмета и проверьте его высоту, ширину и глубину. Для текстиля уточните размер и состав. Оттенок на экране может отличаться от цвета при вашем освещении.',
      'Measure the intended space and check the item’s height, width and depth. For textiles, confirm size and fabric composition. Screen colours may differ from colours in your lighting.',
      'Как ухаживать за керамикой и домашним текстилем?',
      'How should I care for ceramics and home textiles?',
      'Используйте рекомендации для конкретного материала. Возможность мытья в посудомоечной машине, контакта с пищей и машинной стирки уточняйте в описании товара или у продавца.',
      'Follow the instructions for the specific material. Check the product description or ask the seller about dishwasher use, food contact and machine washing.',
    ],
    beauty: [
      'Средства для ежедневного ухода за лицом, телом и руками. Сравните назначение, состав, объём и способ применения перед выбором.',
      'Everyday care for the face, body and hands. Compare each product’s purpose, ingredients, volume and directions before choosing.',
      'Учитывайте назначение средства, состав и рекомендации производителя. Проверьте способ применения и ограничения на упаковке. При известных реакциях на компоненты уточните полный состав до покупки.',
      'Consider the product’s purpose, ingredients and manufacturer’s instructions. Check directions and restrictions on the packaging. If you have known ingredient sensitivities, confirm the full ingredient list before buying.',
      'Где найти состав и способ применения?',
      'Where can I find ingredients and directions?',
      'Проверьте описание товара и маркировку на упаковке. Если полного состава, срока годности или рекомендаций по хранению нет в каталоге, запросите эти сведения у продавца.',
      'Check the product description and packaging. If the catalog does not show full ingredients, expiry information or storage instructions, ask the seller for these details.',
    ],
  };
  const n = niches[theme] || niches.minimal;
  return {
    about_title: pick('О магазине', 'About the store'),
    about_body: pick(n[0], n[1]),
    sizing_title:
      theme === 'fashion'
        ? pick('Как выбрать размер?', 'How do I choose a size?')
        : pick('Как выбрать товар', 'How to choose a product'),
    sizing_body: pick(n[2], n[3]),
    ordering_title: pick('Как оформить заказ?', 'How do I place an order?'),
    ordering_body: pick(
      'Откройте товар, выберите вариант и количество, затем добавьте его в корзину. Проверьте заказ и контактные данные.',
      'Open a product, choose an option and quantity, then add it to your cart. Review your order and contact details.',
    ),
    shipping_title: pick('Доставка и оплата', 'Delivery and payment'),
    shipping_body: pick(
      'Способы получения указаны при оформлении заказа. До оплаты уточните у продавца географию доставки, стоимость, сроки и доступные способы оплаты. Условия зависят от конкретного магазина.',
      'Delivery options are shown at checkout. Before paying, confirm delivery areas, costs, timing and payment methods with the seller. Terms depend on the individual store.',
    ),
    returns_title: pick('Обмен и возврат', 'Exchanges and returns'),
    returns_body: pick(
      'До покупки уточните условия обмена и возврата для выбранного товара, порядок обращения и необходимые документы. Сохраните подтверждение заказа и согласованные с продавцом условия покупки.',
      'Before buying, confirm the exchange and return terms for the item, how to contact the seller and any documents needed. Keep your order confirmation and the purchase terms agreed with the seller.',
    ),
    faq_title: pick('Вопросы перед покупкой', 'Before you buy'),
    faq_1_question: pick(n[4], n[5]),
    faq_1_answer: pick(n[6], n[7]),
    faq_2_question: pick(
      'Как узнать наличие нужного варианта?',
      'How can I check whether an option is available?',
    ),
    faq_2_answer: pick(
      'Откройте карточку и выберите нужный размер, цвет или объём. Если варианта нет в списке или стоит отметка «На заказ», уточните возможность покупки и срок у продавца.',
      'Open the product and select a size, colour or volume. If the option is not listed or is marked as a preorder, ask the seller about availability and timing.',
    ),
    faq_3_question: pick(
      'Как задать вопрос до оформления заказа?',
      'How can I ask a question before ordering?',
    ),
    faq_3_answer: pick(
      'Используйте контакты магазина на этой странице. Укажите название или артикул товара и нужный вариант — так продавцу будет проще ответить на ваш вопрос.',
      'Use the store contacts on this page. Include the product name or SKU and the option you need so the seller can answer your question more precisely.',
    ),
  };
}

export const informationKeys = [
  'about_title',
  'about_body',
  'sizing_title',
  'sizing_body',
  'ordering_title',
  'ordering_body',
  'shipping_title',
  'shipping_body',
  'returns_title',
  'returns_body',
  'faq_title',
  'faq_1_question',
  'faq_1_answer',
  'faq_2_question',
  'faq_2_answer',
  'faq_3_question',
  'faq_3_answer',
];
