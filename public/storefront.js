/* ════ DEFAULTS ════ */
const DEFAULTS = {
  hero_title: 'Ваш магазин',
  hero_subtitle: 'Выберите то, что вам нравится.',
  site_title: 'Каталог',
  footer_text: '© Магазин',
  whatsapp: '',
  telegram: '',
  instagram: '',
  accent_color: '#354f46',
  btn_cart: 'Корзина',
  btn_order_wa: 'Заказать',
  btn_order_ig: 'Написать в Instagram',
  btn_add: 'В корзину',
  btn_add_size: 'Выберите вариант',
  btn_clear: 'Очистить корзину',
  label_size: 'Вариант',
  label_qty: 'Количество',
  label_year: 'Год',
  label_color: 'Цвет',
  label_number: 'Номер',
  label_total: 'Итого',
  label_pick: 'Выбрать параметры',
  filter_all: 'Все',
  msg_empty_cart: 'Корзина пуста',
  msg_added: 'Добавлено в корзину ✓',
  wa_msg_header: 'Привет! Хочу сделать заказ:',
  wa_msg_footer: '',
  tg_msg_header: 'Привет! Хочу сделать заказ:',
  tg_msg_footer: '',
  wa_preorder_tag: 'ПОД ЗАКАЗ',
  wa_preorder_note: 'Позиции «ПОД ЗАКАЗ» требуют времени на доставку, уточним сроки.',
  support_label: 'По всем вопросам пишите нам',
  currency_primary_symbol: '₸',
  currency_primary_code: 'KZT',
  currency_secondary_symbol: '₽',
  currency_secondary_code: 'RUB',
};
const STATUS_COLORS = {
  'в наличии': 'var(--red)',
  'на заказ': '#555',
  нет: 'rgba(255,255,255,.08)',
};
let S = { ...DEFAULTS },
  products = [],
  cart = [],
  activeCat = '',
  currency = 'primary';
let deliveryData = null; // null = не заполнено
let activeDelivery = 'Доставка';

function esc(v) {
  return String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
let currentStore = null,
  submitting = false;
const slug = location.pathname.split('/')[2];
const templatePreview = location.pathname.startsWith('/templates/');
async function loadStore() {
  const r = await fetch(
    (templatePreview ? '/api/templates/' : '/api/stores/') + encodeURIComponent(slug),
    { cache: 'no-store' },
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Не удалось загрузить магазин');
  currentStore = data.store;
  const cfg = currentStore.settings;
  document.documentElement.dataset.theme = cfg.theme || 'minimal';
  const codes = cfg.currencies,
    symbol = (c) => ({ BYN: 'Br', RUB: '₽', KZT: '₸', USD: '$', EUR: '€' })[c] || c;
  S = {
    ...DEFAULTS,
    ...cfg.texts,
    hero_title: cfg.heroTitle || currentStore.name,
    hero_subtitle: cfg.description,
    site_title: currentStore.name,
    footer_text: cfg.footerText || '© ' + currentStore.name,
    accent_color: cfg.accentColor,
    whatsapp: cfg.whatsapp,
    telegram: cfg.telegram,
    instagram: cfg.instagram,
    currency_primary_code: codes[0],
    currency_primary_symbol: symbol(codes[0]),
    currency_secondary_code: codes[1] || codes[0],
    currency_secondary_symbol: symbol(codes[1] || codes[0]),
  };
  products = data.products.map((p, i) => {
    const one = p.prices[codes[0]] / 100,
      two = p.prices[codes[1] || codes[0]] / 100;
    return {
      ...p,
      id: i + 1,
      backendId: p.id,
      brand: p.brand ?? p.team ?? '',
      collection: p.collection ?? p.year ?? '',
      sku: p.sku ?? p.number ?? '',
      attributes: p.attributes || [],
      cat: p.category,
      sizes: p.variants.map((v) => v.label).join(','),
      sizeStock: Object.fromEntries(p.variants.map((v) => [v.label, v.stock])),
      price_primary: Math.round((p.prices[codes[0]] * (100 - p.discountPercent)) / 100) / 100,
      price_secondary:
        Math.round((p.prices[codes[1] || codes[0]] * (100 - p.discountPercent)) / 100) / 100,
      price_primary_orig: one,
      price_secondary_orig: two,
      discount_percent: p.discountPercent,
      has_discount: p.discountPercent > 0,
      avail: { available: 'В наличии', preorder: 'На заказ', unavailable: 'Нет в наличии' }[
        p.availability
      ],
      photo: p.photos[0] || '',
      emoji: '◈',
    };
  });
  document.getElementById('cur-toggle').hidden = codes.length < 2;
  const banner = document.getElementById('demo-banner');
  banner.hidden = currentStore.status !== 'demo' && currentStore.acceptingOrders;
  if (templatePreview)
    banner.textContent =
      'Предпросмотр шаблона · товары и цены приведены для примера · заказы отключены';
  if (currentStore.status !== 'demo' && !currentStore.acceptingOrders)
    banner.textContent = 'Приём заказов временно приостановлен';
  document.getElementById('hero-badge').textContent =
    currentStore.status === 'demo' ? 'Демо магазина' : 'Каталог';
  const logo = document.getElementById('hero-logo');
  logo.hidden = !cfg.logo;
  if (cfg.logo) logo.src = cfg.logo;
  const favicon = document.getElementById('store-favicon');
  favicon.href = cfg.logo || '/s/favicon.svg';
  if (cfg.logo) favicon.removeAttribute('type');
  document.getElementById('store-touch-icon').href = cfg.logo || '/s/favicon.svg';
  activeDelivery = cfg.deliveryMethods[0];
}

/* ════ SETTINGS → DOM ════ */
function applySettings() {
  const ac = S.accent_color || '#354f46';
  document.documentElement.style.setProperty('--red', ac);
  document.documentElement.style.setProperty('--red-dark', shadeHex(ac, -30));
  document.title = S.site_title || 'Каталог';
  document.getElementById('hero-title').textContent = S.hero_title;
  document.getElementById('hero-subtitle').textContent = S.hero_subtitle;
  document.getElementById('footer-text').textContent = S.footer_text;
  document.getElementById('hero-wa').href = 'https://wa.me/' + S.whatsapp;
  document.getElementById('hero-tg').href = 'https://t.me/' + tgUsername(S.telegram);
  document.getElementById('hero-ig').href = 'https://instagram.com/' + S.instagram;
  const sl = document.getElementById('hero-support-label');
  if (sl) sl.textContent = S.support_label || 'По всем вопросам пишите нам';
  document.getElementById('lbl-cart').textContent = S.btn_cart;
  document.getElementById('lbl-cart-title').textContent = S.btn_cart;
  document.getElementById('lbl-pick').textContent = S.label_pick;
  document.getElementById('lbl-size-h').textContent = S.label_size;
  document.getElementById('lbl-qty-h').textContent = S.label_qty;
  updateCurBtn();
}
// Принимает в настройках username,
// так и @username или полную ссылку — на выходе всегда чистый username для t.me/
function tgUsername(v) {
  if (!v) return '';
  return String(v)
    .trim()
    .replace(/^https?:\/\/(www\.)?t\.me\//i, '')
    .replace(/^@/, '')
    .replace(/\/$/, '');
}
function shadeHex(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* ════ CURRENCY ════ */
function curSymbol() {
  return currency === 'primary' ? S.currency_primary_symbol : S.currency_secondary_symbol;
}
function curCode() {
  return currency === 'primary' ? S.currency_primary_code : S.currency_secondary_code;
}
function priceOf(p) {
  return currency === 'primary' ? p.price_primary : p.price_secondary;
}
function priceOfOrig(p) {
  return currency === 'primary' ? p.price_primary_orig : p.price_secondary_orig;
}
function updateCurBtn() {
  const b = document.getElementById('cur-toggle');
  if (b) b.textContent = curSymbol() + ' ' + curCode();
}
function toggleCurrency() {
  currency = currency === 'primary' ? 'secondary' : 'primary';
  updateCurBtn();
  renderGrid();
  if (document.getElementById('cart-ov').classList.contains('open')) renderCart();
  if (document.getElementById('pm-ov').classList.contains('open') && curP) renderModalPrice(curP);
}
function fmt(n) {
  return Number(n || 0).toLocaleString('ru-RU') + ' ' + curSymbol();
}

/* ════ RENDER ════ */
function getCats() {
  return [S.filter_all || 'Все', ...new Set(products.map((p) => p.cat))];
}
function renderFilters() {
  if (!activeCat) activeCat = S.filter_all || 'Все';
  document.getElementById('filters').innerHTML = getCats()
    .map(
      (c, i) =>
        `<button class="fbtn${c === activeCat ? ' active' : ''}" onclick="setF(getCats()[${i}])">${esc(c)}</button>`,
    )
    .join('');
}
function setF(c) {
  activeCat = c;
  renderFilters();
  renderGrid();
}

const STATUS_BLOCKED = ['нет', 'нет в наличии', 'no', '0', 'false', 'out of stock', 'недоступно'];
const STATUS_PREORDER = ['на заказ', 'под заказ', 'preorder', 'to order'];
function isAvail(p) {
  return !STATUS_BLOCKED.includes((p.avail || '').trim().toLowerCase());
}
function isPreorder(p) {
  return STATUS_PREORDER.includes((p.avail || '').trim().toLowerCase());
}
function statusColor(s) {
  const n = (s || '').trim().toLowerCase();
  return S['status_color_' + n.replace(/\s+/g, '_')] || STATUS_COLORS[n] || 'rgba(255,255,255,.08)';
}
function statusTextColor(s) {
  return S['status_text_color_' + (s || '').trim().toLowerCase().replace(/\s+/g, '_')] || '#fff';
}

function driveThumb(url) {
  return url || '';
}
function cardImgHTML(p) {
  if (p.photos && p.photos.length > 0) {
    const src = driveThumb(p.photos[0], 400);
    return `<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'"><div class="card-img-inner"></div>`;
  }
  return `<div class="card-img-inner">${p.emoji || '◈'}</div>`;
}

function renderGrid() {
  const all = S.filter_all || 'Все';
  const list = activeCat === all ? products : products.filter((p) => p.cat === activeCat);
  const grid = document.getElementById('grid');
  if (!list.length) {
    grid.innerHTML = `<div class="state-msg">Нет товаров в этой категории</div>`;
    return;
  }
  grid.innerHTML = list
    .map((p) => {
      const ok = isAvail(p);
      const meta = [
        p.collection ? `<span>${esc(p.collection)}</span>` : '',
        p.color ? `<span>${esc(p.color)}</span>` : '',
        p.sku ? `<span>${esc(p.sku)}</span>` : '',
      ].join('');
      // Показываем только размеры из колонки Размеры, без остатков
      const szLine = p.variants.map((v) => v.label).join(' · ');
      const priceBlock = p.has_discount
        ? `<div class="price-row"><span class="price-old">${fmt(priceOfOrig(p))}</span><span class="price">${fmt(priceOf(p))}</span></div>`
        : `<div class="price">${fmt(priceOf(p))}</div>`;
      return `
    <div class="card" onclick="openProduct(${p.id})">
      <div class="card-img">
        ${cardImgHTML(p)}
        <span class="avail-pill" style="background:${statusColor(p.avail)};color:${statusTextColor(p.avail)}">${esc(p.avail)}</span>
        ${p.has_discount ? `<span class="discount-pill">-${p.discount_percent}%</span>` : ''}
      </div>
      <div class="card-body">
        <div class="card-team">${esc(p.brand)}</div>
        <div class="card-name">${esc(p.name)}</div>
        ${meta ? `<div class="card-meta">${meta}</div>` : ''}
        <div class="card-sizes">${esc(szLine)}</div>
        <div class="card-foot">
          ${priceBlock}
          <button class="add-btn" ${!ok ? 'disabled' : ''} onclick="event.stopPropagation();openProduct(${p.id})">
            + ${esc(S.btn_add)}
          </button>
        </div>
      </div>
    </div>`;
    })
    .join('');
}

/* ════ CAROUSEL ════ */
let carouselIndex = 0,
  carouselSlides = [];
function buildCarousel(photos, emoji) {
  const track = document.getElementById('pm-carousel-track');
  const prev = document.getElementById('carousel-prev');
  const next = document.getElementById('carousel-next');
  const dots = document.getElementById('carousel-dots');
  carouselIndex = 0;
  if (!photos || photos.length === 0) {
    carouselSlides = [];
    track.innerHTML = `<div class="pm-carousel-slide">${emoji || '◈'}</div>`;
    prev.style.display = 'none';
    next.style.display = 'none';
    dots.innerHTML = '';
    return;
  }
  carouselSlides = photos;
  track.innerHTML = photos
    .map((url) => {
      const src = driveThumb(url, 600);
      return `<div class="pm-carousel-slide"><img src="${esc(src)}" alt="" onerror="this.style.display='none'"></div>`;
    })
    .join('');
  const show = photos.length > 1;
  prev.style.display = show ? 'flex' : 'none';
  next.style.display = show ? 'flex' : 'none';
  dots.innerHTML =
    photos.length > 1
      ? photos
          .map(
            (_, i) =>
              `<div class="carousel-dot${i === 0 ? ' active' : ''}" onclick="carouselGo(${i})"></div>`,
          )
          .join('')
      : '';
  carouselSetPos(0, false);
}
function carouselSetPos(idx, animate) {
  const track = document.getElementById('pm-carousel-track');
  if (!animate) track.style.transition = 'none';
  track.style.transform = `translateX(-${idx * 100}%)`;
  if (!animate)
    requestAnimationFrame(() => {
      track.style.transition = 'transform .3s ease';
    });
  document
    .querySelectorAll('.carousel-dot')
    .forEach((d, i) => d.classList.toggle('active', i === idx));
}
function carouselMove(dir) {
  if (carouselSlides.length < 2) return;
  carouselIndex = (carouselIndex + dir + carouselSlides.length) % carouselSlides.length;
  carouselSetPos(carouselIndex, true);
}
function carouselGo(idx) {
  carouselIndex = idx;
  carouselSetPos(idx, true);
}
let touchStartX = null;
document.getElementById('pm-carousel').addEventListener(
  'touchstart',
  (e) => {
    touchStartX = e.touches[0].clientX;
  },
  { passive: true },
);
document.getElementById('pm-carousel').addEventListener(
  'touchend',
  (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) carouselMove(dx < 0 ? 1 : -1);
    touchStartX = null;
  },
  { passive: true },
);
document.getElementById('pm-carousel').addEventListener('click', () => {
  if (carouselSlides.length > 0) lbOpen(carouselSlides, carouselIndex);
});

/* ════ PRODUCT MODAL ════ */
let curP = null,
  curSize = null,
  curQty = 1;
function renderModalPrice(p) {
  const row = document.getElementById('pm-price-row');
  if (p.has_discount) {
    row.innerHTML = `<span class="pm-price-old">${fmt(priceOfOrig(p))}</span><span class="pm-price">${fmt(priceOf(p))}</span><span class="pm-discount-badge">-${p.discount_percent}%</span>`;
  } else {
    row.innerHTML = `<span class="pm-price">${fmt(priceOf(p))}</span>`;
  }
}
function openProduct(id) {
  const p = products.find((x) => x.id === id);
  if (!isAvail(p)) return;
  curP = p;
  curQty = 1;
  const szArr = p.variants.map((v) => v.label);
  const isPre = isPreorder(p);
  // Для преордера без размеров — сразу ставим заглушку
  const noSizes = szArr.length === 0;
  curSize = szArr.length === 1 ? szArr[0] : isPre && noSizes ? 'Уточнить вариант' : null;
  buildCarousel(p.photos, p.emoji);
  document.getElementById('pm-team').textContent = p.brand;
  document.getElementById('pm-name').textContent = p.name;
  renderModalPrice(p);
  document.getElementById('pm-qty').textContent = '1';
  // Описание
  const descEl = document.getElementById('pm-desc');
  if (p.description) {
    descEl.textContent = p.description;
    descEl.style.display = 'block';
  } else {
    descEl.style.display = 'none';
  }
  const attrs = [
    p.collection ? `<span class="pm-attr"><b>Коллекция:</b> ${esc(p.collection)}</span>` : '',
    p.color ? `<span class="pm-attr"><b>${esc(S.label_color)}:</b> ${esc(p.color)}</span>` : '',
    p.sku ? `<span class="pm-attr"><b>Артикул:</b> ${esc(p.sku)}</span>` : '',
  ].join('');
  document.getElementById('pm-attrs').innerHTML =
    attrs +
    p.attributes
      .map((a) => `<span class="pm-attr"><b>${esc(a.label)}:</b> ${esc(a.value)}</span>`)
      .join('');

  const hasSizeStock = Object.keys(p.sizeStock).length > 0;

  if (noSizes && isPre) {
    // Нет ни одного размера — преордер, показываем информационную плашку
    document.getElementById('pm-sizes').innerHTML =
      `<div style="font-size:12px;color:var(--muted);background:var(--surface3);padding:8px 12px;border-radius:var(--rsm);width:100%">Вариант будет уточнён менеджером при подтверждении заказа</div>`;
  } else {
    document.getElementById('pm-sizes').innerHTML = szArr
      .map((s, i) => {
        const stockVal = p.sizeStock[s];
        // Размер заблокирован только если точно 0 и это НЕ преордер
        const isOut =
          !isPre && hasSizeStock && stockVal !== undefined && stockVal !== null && stockVal <= 0;
        return `<button class="size-btn${curSize === s ? ' sel' : ''}${isOut ? ' ' : ''}"
        ${isOut ? 'disabled' : ''}
        onclick="selSz(curP.variants[${i}].label)">${esc(s)}</button>`;
      })
      .join('');
  }

  updAddBtn();
  document.getElementById('pm-ov').classList.add('open');
}
function selSz(s) {
  curSize = s;
  document
    .querySelectorAll('.size-btn')
    .forEach((b) => b.classList.toggle('sel', b.textContent.trim() === s));
  updAddBtn();
}
function chQty(d) {
  curQty = Math.max(1, Math.min(99, curQty + d));
  document.getElementById('pm-qty').textContent = curQty;
}
function updAddBtn() {
  const btn = document.getElementById('pm-add');
  // Если товар на заказ и размер = "Уточнить вариант" (заглушка) — кнопка активна
  const ready = !!curSize;
  btn.disabled = !ready;
  btn.textContent = ready ? S.btn_add : S.btn_add_size || 'Выберите вариант';
}

/* ════ CART ════ */
function addToCart() {
  if (!curSize || !curP) return;
  const sizeNote = curSize === 'Уточнить вариант'; // флаг для пометки в заказе
  const key = curP.id + '|' + curSize;
  const ex = cart.find((x) => x.key === key);
  if (ex) {
    ex.qty = Math.min(99, ex.qty + curQty);
  } else {
    cart.push({
      key,
      id: curP.id,
      backendId: curP.backendId,
      variantId: curP.variants.find((v) => v.label === curSize).id,
      name: curP.name,
      brand: curP.brand,
      emoji: curP.emoji,
      photo: curP.photo,
      size: curSize,
      qty: curQty,
      sizeNote,
      // В корзину/заказ идёт уже цена с учётом скидки (если она есть)
      price_primary: curP.price_primary,
      price_secondary: curP.price_secondary,
      price_primary_orig: curP.price_primary_orig,
      price_secondary_orig: curP.price_secondary_orig,
      discount_percent: curP.discount_percent,
      has_discount: curP.has_discount,
      collection: curP.collection,
      color: curP.color,
      sku: curP.sku,
      avail: curP.avail,
      preorder: isPreorder(curP),
      cat: curP.cat,
    });
  }
  updCount();
  closeId('pm-ov');
  showToast(S.msg_added);
}
function updCount() {
  document.getElementById('cart-count').textContent = cart.reduce((s, x) => s + x.qty, 0);
}
function openCart() {
  renderCart();
  document.getElementById('cart-ov').classList.add('open');
}

function renderCart() {
  const body = document.getElementById('cart-body');
  if (!cart.length) {
    body.innerHTML = `<div class="cart-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg>
      ${esc(S.msg_empty_cart)}
    </div>`;
    return;
  }
  const itemPrice = (it) => (currency === 'primary' ? it.price_primary : it.price_secondary);
  const itemPriceOrig = (it) =>
    currency === 'primary' ? it.price_primary_orig : it.price_secondary_orig;
  const total = cart.reduce((s, x) => s + itemPrice(x) * x.qty, 0);

  const items = cart
    .map((it, i) => {
      const thumb = it.photo
        ? `<img class="ci-img" src="${esc(driveThumb(it.photo, 80))}" alt="" onerror="this.style.display='none'">`
        : `<div class="ci-emoji">${it.emoji}</div>`;
      const sub = [
        it.sizeNote ? `⚠️ Вариант: уточнить у менеджера` : `${esc(S.label_size)}: ${esc(it.size)}`,
        it.color ? `${esc(S.label_color)}: ${esc(it.color)}` : '',
        it.sku ? `Артикул: ${esc(it.sku)}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const preorderBadge = it.preorder ? `<span class="ci-preorder">${esc(it.avail)}</span>` : '';
      const discountBadge = it.has_discount
        ? `<span class="ci-discount">-${it.discount_percent}%</span>`
        : '';
      const priceHTML = it.has_discount
        ? `<span class="ci-price-old">${fmt(itemPriceOrig(it) * it.qty)}</span><span class="ci-price">${fmt(itemPrice(it) * it.qty)}</span>`
        : `<span class="ci-price">${fmt(itemPrice(it) * it.qty)}</span>`;
      return `
    <div class="ci">
      ${thumb}
      <div class="ci-info">
        <div class="ci-name">${esc(it.name)}${preorderBadge}${discountBadge}</div>
        <div class="ci-sub">${sub}</div>
        <div class="ci-qrow">
          <button class="ci-qbtn" onclick="ciQ(${i},-1)">−</button>
          <span class="ci-qval">${it.qty}</span>
          <button class="ci-qbtn" onclick="ciQ(${i},1)">+</button>
        </div>
      </div>
      <div class="ci-right">
        <button class="ci-del" onclick="ciDel(${i})">✕</button>
        ${priceHTML}
      </div>
    </div>`;
    })
    .join('');

  const filled = deliveryData;
  const deliveryBlock = `<div class="delivery-section"><div class="delivery-section-title">Доставка</div>
   <label class="d-label" for="delivery-method">Способ доставки</label>
   <select class="d-input" id="delivery-method">${currentStore.settings.deliveryMethods.map((m) => `<option ${m === (filled?.deliveryMethod || activeDelivery) ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
   ${[
     ['name', 'Имя получателя *', 'text'],
     ['phone', 'Телефон *', 'tel'],
     ['address', 'Адрес или пункт самовывоза *', 'text'],
     ['city', 'Город', 'text'],
     ['region', 'Область', 'text'],
     ['index', 'Индекс', 'text'],
     ['comment', 'Комментарий', 'text'],
   ]
     .map(
       ([k, label, type]) =>
         `<div class="d-field"><label class="d-label" for="delivery-${k}">${label}</label><input class="d-input" id="delivery-${k}" type="${type}" value="${esc(filled?.[k] || '')}" maxlength="${k === 'comment' ? 1000 : k === 'address' ? 500 : k === 'phone' ? 30 : 100}"></div>`,
     )
     .join('')}
   <p class="pvz-hint">${esc(currentStore.settings.deliveryHint)}</p>
   <button class="d-submit" onclick="saveDelivery()" style="padding:12px;background:var(--red);color:white;border:0;border-radius:6px">Сохранить данные доставки</button>
   ${filled ? '<p class="delivery-filled-badge">Данные доставки сохранены</p>' : ''}</div>`;
  const canOrder = !!filled && currentStore.status !== 'demo' && currentStore.acceptingOrders;
  const disabledAttr = canOrder ? '' : 'disabled';
  const hintText = canOrder
    ? ''
    : `<div class="delivery-required-hint">${currentStore.status === 'demo' ? 'Это демонстрация магазина' : !currentStore.acceptingOrders ? 'Приём заказов приостановлен' : 'Сначала заполните адрес доставки'}</div>`;

  body.innerHTML =
    items +
    `<div class="cart-total"><span>${esc(S.label_total)}</span><span>${fmt(total)}</span></div>` +
    deliveryBlock +
    `<div class="cart-actions">
      ${hintText}
      <button class="oa oa-place" ${disabledAttr} onclick="placeOrder()">
        ${currentStore.status === 'demo' ? 'Заказы отключены в демо' : !currentStore.acceptingOrders ? 'Приём заказов приостановлен' : 'Оформить заказ'}
      </button>
      <button class="oa oa-clear" onclick="clearCart()">${esc(S.btn_clear)}</button>
    </div>`;
  requestAnimationFrame(() => attachDeliveryWatchers());
}

function attachDeliveryWatchers() {
  document.querySelectorAll('.d-input').forEach((el) =>
    el.addEventListener('input', () => {
      if (deliveryData) {
        deliveryData = null;
        const b = document.querySelector('.oa-place');
        if (b) b.disabled = true;
      }
    }),
  );
}
function ciQ(i, d) {
  cart[i].qty = Math.min(99, Math.max(1, cart[i].qty + d));
  updCount();
  renderCart();
}
function ciDel(i) {
  cart.splice(i, 1);
  updCount();
  renderCart();
}
function clearCart() {
  cart = [];
  deliveryData = null;
  updCount();
  renderCart();
}

function saveDelivery() {
  const data = { deliveryMethod: document.getElementById('delivery-method').value };
  for (const k of ['name', 'phone', 'address', 'city', 'region', 'index', 'comment'])
    data[k] = document.getElementById('delivery-' + k).value.trim();
  if (!data.name || !data.phone || !data.address) {
    showToast('Заполните обязательные поля');
    return;
  }
  deliveryData = data;
  showToast('Данные доставки сохранены');
  renderCart();
}
async function placeOrder() {
  if (submitting || !cart.length) return;
  if (currentStore.status === 'demo') {
    showToast('Это демонстрация. Реальные заказы отключены.');
    return;
  }
  if (!currentStore.acceptingOrders) {
    showToast('Приём заказов приостановлен');
    return;
  }
  if (!deliveryData) {
    showToast('Сохраните данные доставки');
    return;
  }
  submitting = true;
  const button = document.querySelector('.oa-place');
  button.disabled = true;
  button.textContent = 'Оформление…';
  const storageKey = 'pending-order:' + currentStore.id;
  try {
    const payload = {
      currency: curCode(),
      customer: deliveryData,
      items: cart.map((it) => ({
        productId: it.backendId,
        variantId: it.variantId,
        quantity: it.qty,
        expectedUnitMinor: Math.round(
          (currency === 'primary' ? it.price_primary : it.price_secondary) * 100,
        ),
      })),
    };
    const serialized = JSON.stringify(payload);
    let previous = null;
    try {
      previous = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    } catch {}
    const key = previous?.payload === serialized ? previous.key : crypto.randomUUID();
    sessionStorage.setItem(storageKey, JSON.stringify({ key, payload: serialized }));
    const r = await fetch('/api/stores/' + encodeURIComponent(currentStore.slug) + '/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: serialized,
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || 'Не удалось сохранить заказ');
    if (!result.id || !result.number) throw new Error('Сервер не подтвердил сохранение заказа');
    document.getElementById('confirm-order-num').textContent = '#' + result.number;
    document.querySelector('.order-sub').textContent =
      'Заказ сохранён. Итого: ' +
      (result.totalMinor / 100).toLocaleString('ru-RU') +
      ' ' +
      result.currency +
      '. Продавец свяжется с вами для подтверждения.';
    const wa = document.getElementById('confirm-wa-btn'),
      tg = document.getElementById('confirm-tg-btn');
    wa.hidden = !S.whatsapp;
    tg.hidden = !S.telegram;
    wa.onclick = () =>
      window.open(
        'https://wa.me/' + S.whatsapp + '?text=' + encodeURIComponent('Заказ #' + result.number),
        '_blank',
        'noopener',
      );
    tg.onclick = () =>
      window.open(
        'https://t.me/' + S.telegram + '?text=' + encodeURIComponent('Заказ #' + result.number),
        '_blank',
        'noopener',
      );
    sessionStorage.removeItem(storageKey);
    closeId('cart-ov');
    document.getElementById('confirm-ov').classList.add('open');
    cart = [];
    deliveryData = null;
    updCount();
  } catch (e) {
    showToast(e.message || 'Ошибка сети. Заказ не подтверждён. Попробуйте снова.');
  } finally {
    submitting = false;
    button.disabled = false;
    button.textContent = 'Оформить заказ';
  }
}

/* ════ OVERLAYS ════ */ function closeOv(e, id) {
  if (e.target.id === id) document.getElementById(id).classList.remove('open');
}
function closeId(id) {
  document.getElementById(id).classList.remove('open');
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

/* ════ LIGHTBOX ════ */
let lbPhotos = [],
  lbIdx = 0;
function lbOpen(photos, startIdx) {
  lbPhotos = photos;
  lbIdx = startIdx || 0;
  lbRender();
  document.getElementById('lb').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function lbClose() {
  document.getElementById('lb').classList.remove('open');
  document.getElementById('lb-wrap').classList.remove('zoomed');
  document.body.style.overflow = '';
}
function lbRender() {
  const wrap = document.getElementById('lb-wrap');
  wrap.classList.remove('zoomed');
  document.getElementById('lb-img').src = driveThumb(lbPhotos[lbIdx], 1200);
  const multi = lbPhotos.length > 1;
  document.getElementById('lb-counter').textContent = multi
    ? `${lbIdx + 1} / ${lbPhotos.length}`
    : '';
  document.getElementById('lb-prev').style.display = multi ? 'flex' : 'none';
  document.getElementById('lb-next').style.display = multi ? 'flex' : 'none';
}
function lbMove(dir) {
  lbIdx = (lbIdx + dir + lbPhotos.length) % lbPhotos.length;
  lbRender();
}
function lbToggleZoom() {
  document.getElementById('lb-wrap').classList.toggle('zoomed');
}
function lbBgClick(e) {
  if (e.target === document.getElementById('lb')) lbClose();
}
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('lb').classList.contains('open')) return;
  if (e.key === 'Escape') lbClose();
  if (e.key === 'ArrowRight') lbMove(1);
  if (e.key === 'ArrowLeft') lbMove(-1);
});
let lbTouchX = null;
document.getElementById('lb').addEventListener(
  'touchstart',
  (e) => {
    lbTouchX = e.touches[0].clientX;
  },
  { passive: true },
);
document.getElementById('lb').addEventListener(
  'touchend',
  (e) => {
    if (lbTouchX === null) return;
    const dx = e.changedTouches[0].clientX - lbTouchX;
    if (Math.abs(dx) > 50) lbMove(dx < 0 ? 1 : -1);
    lbTouchX = null;
  },
  { passive: true },
);

/* ════ BOOT ════ */
async function init() {
  try {
    await loadStore();
    applySettings();
    for (const [key, value] of [
      ['hero-wa', S.whatsapp],
      ['hero-tg', S.telegram],
      ['hero-ig', S.instagram],
    ])
      document.getElementById(key).hidden = !value || currentStore.status === 'demo';
    document.querySelector('.hero-contacts').hidden =
      currentStore.status === 'demo' || (!S.whatsapp && !S.telegram && !S.instagram);
    activeCat = S.filter_all || 'Все';
    renderFilters();
    renderGrid();
  } catch (e) {
    document.getElementById('hero-title').textContent = 'Не удалось загрузить магазин';
    document.getElementById('grid').textContent = e.message;
  }
}
init();
