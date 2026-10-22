import type { Settings } from './types';
export const backgroundTargets = [
  'page',
  'hero',
  'catalog',
  'cards',
  'information',
  'footer',
] as const;
const selectors = {
  page: 'body',
  hero: '.hero',
  catalog: '.container',
  cards: '#grid>.card',
  information: '.store-intro section,.store-content>section,.store-faq,.store-contacts',
  footer: '.footer',
};
// Quote URLs as CSS strings and prevent closing the surrounding HTML style element.
const cssUrl = (url: string) =>
  JSON.stringify(url).replace(/</g, '\\3c ').replace(/>/g, '\\3e ').replace(/&/g, '\\26 ');
export function backgroundStyles(settings: Partial<Settings>): string {
  return backgroundTargets
    .map((target) => {
      const bg = settings.backgrounds?.[target];
      if (!bg || bg.mode === 'template') return '';
      const root = selectors[target].split(',').map((s) => 'html[data-theme] ' + s);
      const light =
        bg.tone === 'light' ||
        (bg.tone === 'auto' &&
          (bg.mode === 'image' ||
            [1, 3, 5].reduce(
              (sum, offset, i) =>
                sum + parseInt(bg.color.slice(offset, offset + 2), 16) * [0.299, 0.587, 0.114][i],
              0,
            ) < 145));
      const foreground = light ? '#ffffff' : '#202820';
      const overlay = bg.overlay / 100;
      const surface =
        bg.mode === 'image' && bg.image
          ? `linear-gradient(rgba(${light ? '0,0,0' : '255,255,255'},${overlay}),rgba(${light ? '0,0,0' : '255,255,255'},${overlay})),url(${cssUrl(bg.image)}) center/cover no-repeat ${bg.color}`
          : bg.color;
      let rules = `${root.join(',')}{background:${surface}!important;}`;
      if (target === 'page')
        rules +=
          'html[data-theme] .container,html[data-theme] .store-intro,html[data-theme] .store-content>section,html[data-theme] .store-contacts{background:var(--page);border-radius:var(--radius);}';
      const textRoots =
        target === 'page'
          ? [
              'html[data-theme] .shop-masthead',
              ...(!settings.backgrounds?.footer || settings.backgrounds.footer.mode === 'template'
                ? ['html[data-theme] .footer']
                : []),
            ]
          : target === 'catalog'
            ? ['html[data-theme] .container .collection-heading']
            : root;
      const textSelectors = textRoots.flatMap((s) => [
        s,
        ...[
          'h1',
          'h2',
          'h3',
          'p',
          'summary',
          '.card-name',
          '.card-team',
          '.card-meta',
          '.card-sizes',
          '.price',
          '.price-old',
          '.collection-count',
          '.section-kicker',
          '.hero-badge',
          '.information-nav a',
          '.store-contacts a',
        ].map((child) => s + ' ' + child),
      ]);
      if (target === 'page') textSelectors.push('html[data-theme] .shop-masthead a');
      if (target === 'information') textSelectors.push(...root.map((s) => s + ' a'));
      rules += `${textSelectors.join(',')}{color:${foreground}!important;}`;
      if (target === 'catalog')
        rules += `${root.map((s) => s + ' .card').join(',')}{color:var(--text)!important;}`;
      // Buttons retain their own contrasting surface, rather than inheriting a white image label.
      if (target === 'hero')
        rules +=
          'html[data-theme] .hero-visual figcaption{background:#202820!important;color:#fff!important;}';
      return rules;
    })
    .join('');
}
