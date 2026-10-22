import type { Settings } from './types';
import { templateContent } from './template-content';
import { backgroundStyles } from './backgrounds';
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function enrichStorefront(
  html: string,
  name: string,
  cfg: Partial<Settings>,
  demo: boolean,
) {
  // Only previews/demos receive missing editorial defaults; live merchant copy is explicit.
  const texts = {
    ...(demo ? templateContent(cfg.theme || 'minimal', cfg.language) : {}),
    ...cfg.texts,
  };
  const en = cfg.language !== 'ru' && !!cfg.language;
  const label = (ru: string, english: string) => (en ? english : ru);
  const section = (key: string) => {
    const title = texts[key + '_title'],
      body = texts[key + '_body'];
    return title && body
      ? `<section id="store-${key}"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></section>`
      : '';
  };
  const intro = section('about');
  const sections = ['sizing', 'ordering', 'shipping', 'returns']
    .map((key) => {
      const title = texts[key + '_title'];
      const body = texts[key + '_body'];
      return title && body ? section(key) : '';
    })
    .join('');
  const questions = [1, 2, 3]
    .map((i) => ({ question: texts[`faq_${i}_question`], answer: texts[`faq_${i}_answer`] }))
    .filter((item) => item.question && item.answer);
  const faq =
    questions.length && texts.faq_title
      ? `<section id="store-faq" class="store-faq"><h2>${escapeHtml(texts.faq_title)}</h2>${questions.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</section>`
      : '';
  const contacts: { title: string; url: string }[] = [];
  if (cfg.telegram && /^[a-z0-9_]{5,32}$/i.test(cfg.telegram))
    contacts.push({ title: 'Telegram', url: 'https://t.me/' + cfg.telegram });
  if (cfg.instagram && /^[a-z0-9_.]{1,30}$/i.test(cfg.instagram))
    contacts.push({ title: 'Instagram', url: 'https://www.instagram.com/' + cfg.instagram + '/' });
  if (cfg.whatsapp && /^\d{7,15}$/.test(cfg.whatsapp))
    contacts.push({ title: 'WhatsApp', url: 'https://wa.me/' + cfg.whatsapp });
  const contactSection = contacts.length
    ? `<section class="store-contacts" id="store-contacts"><h2>${label('Контакты магазина', 'Store contacts')}</h2><p>${escapeHtml(name)}</p><div>${contacts.map((c) => `<a href="${c.url}" target="_blank" rel="noopener noreferrer">${c.title} ↗</a>`).join('')}</div></section>`
    : '';
  const links = [
    intro ? ['about', label('О магазине', 'About')] : null,
    sections.includes('id="store-shipping"')
      ? ['shipping', label('Доставка и оплата', 'Delivery and payment')]
      : null,
    faq ? ['faq', label('Вопросы и ответы', 'Questions and answers')] : null,
    contactSection ? ['contacts', label('Контакты', 'Contacts')] : null,
  ].filter((item): item is string[] => !!item);
  const navigation = links.length
    ? `<nav class="information-nav" aria-label="${label('Информация о магазине', 'Store information')}">${links.map(([id, title]) => `<a href="#store-${id}">${title}</a>`).join('')}</nav>`
    : '';
  const structured = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    ...(cfg.description ? { description: cfg.description } : {}),
    ...(contacts.length
      ? { sameAs: contacts.filter((c) => c.title !== 'WhatsApp').map((c) => c.url) }
      : {}),
  })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return html
    .replace('<title>Каталог</title>', `<title>${escapeHtml(name)}</title>`)
    .replace(/<title>Catalog<\/title>/, `<title>${escapeHtml(name)}</title>`)
    .replace(
      '</head>',
      `<meta name="description" content="${escapeHtml(cfg.description || '')}"><script type="application/ld+json">${structured}</script><style id="store-backgrounds">${backgroundStyles(cfg)}</style>${demo ? '<meta name="robots" content="noindex, follow">' : ''}</head>`,
    )
    .replace(
      /(<h1[^>]*id="hero-title"[^>]*>)[^<]*(<\/h1>)/,
      (_, start, end) => start + escapeHtml(cfg.heroTitle || name) + end,
    )
    .replace(
      '<p class="hero-subtitle" id="hero-subtitle"></p>',
      `<p class="hero-subtitle" id="hero-subtitle">${escapeHtml(cfg.description || '')}</p>`,
    )
    .replace(
      '<!-- STORE_INTRO -->',
      intro || navigation ? `<div class="store-intro">${intro}${navigation}</div>` : '',
    )
    .replace(
      '<!-- STORE_CONTENT -->',
      `${sections ? `<div class="store-content">${sections}</div>` : ''}${faq}${contactSection}`,
    );
}
