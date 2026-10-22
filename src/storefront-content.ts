import type { Settings } from './types';
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
  const texts = cfg.texts || {};
  const sections = ['about', 'sizing', 'ordering', 'shipping']
    .map((key) => {
      const title = texts[key + '_title'];
      const body = texts[key + '_body'];
      return title && body
        ? `<section><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></section>`
        : '';
    })
    .join('');
  return html
    .replace('<title>Каталог</title>', `<title>${escapeHtml(name)}</title>`)
    .replace(/<title>Catalog<\/title>/, `<title>${escapeHtml(name)}</title>`)
    .replace(
      '</head>',
      `<meta name="description" content="${escapeHtml(cfg.description || '')}">${demo ? '<meta name="robots" content="noindex, follow">' : ''}</head>`,
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
      '<!-- STORE_CONTENT -->',
      sections ? `<div class="store-content">${sections}</div>` : '',
    );
}
