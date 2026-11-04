import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, req, platform, mf, PLATFORM } from './harness.js';
before(start);
after(stop);
const bg = (mode, extra = {}) => ({
  mode,
  color: '#102030',
  image: '',
  tone: 'auto',
  overlay: 60,
  ...extra,
});
async function create(name) {
  const r = await platform('stores', 'POST', { name, templateId: 'home' });
  assert.equal(r.status, 201);
  return { ...r.body, settings: (await req('/api/stores/' + r.body.slug)).body.store.settings };
}
async function save(store, backgrounds, version = 1, theme = 'home') {
  return platform(`stores/${store.id}/settings`, 'PUT', {
    name: store.name || 'Backgrounds',
    version,
    settings: { ...store.settings, theme, backgrounds },
  });
}
test('background modes persist independently, survive theme changes and reset to the template', async () => {
  const s = await create('Background settings');
  const backgrounds = {
    page: bg('color'),
    hero: bg('image', { image: 'https://images.example/background.jpg' }),
    cards: bg('color', { color: '#f1e3cc', tone: 'dark' }),
    catalog: bg('template'),
    information: bg('color'),
    footer: bg('color'),
  };
  assert.equal((await save(s, backgrounds)).status, 200);
  let data = (await req('/api/stores/' + s.slug)).body;
  assert.deepEqual(data.store.settings.backgrounds, backgrounds);
  const page = await req('/s/' + s.slug);
  assert.match(page.body, /id="store-backgrounds"/);
  assert.match(page.body, /background.jpg/);
  assert.match(page.body, /rgba\(0,0,0,0.6\)/);
  assert.equal((await save(s, backgrounds, 2, 'beauty')).status, 200);
  data = (await req('/api/stores/' + s.slug)).body;
  assert.deepEqual(data.store.settings.backgrounds, backgrounds);
  assert.equal(
    (await save(s, { hero: bg('template', { image: backgrounds.hero.image }) }, 3)).status,
    200,
  );
  const reset = (await req('/s/' + s.slug)).body.match(
    /<style id="store-backgrounds">([^<]*)<\/style>/,
  )[1];
  assert.equal(reset, '');
});
test('rejects invalid modes, colours, overlays and foreign media; URLs cannot escape CSS or HTML', async () => {
  const s = await create('Background validation');
  for (const backgrounds of [
    { unknown: bg('color') },
    { hero: bg('script') },
    { hero: bg('color', { color: 'red;display:none' }) },
    { hero: bg('image') },
    { hero: bg('image', { image: 'javascript:alert(1)' }) },
    { hero: bg('image', { image: 'http://example.com/a.jpg' }) },
    {
      hero: bg('image', {
        image:
          '/media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png',
      }),
    },
    { hero: bg('color', { overlay: 81 }) },
    { hero: bg('color', { overlay: 1.5 }) },
  ])
    assert.equal((await save(s, backgrounds)).status, 400);
  const url = 'https://images.example/bg.jpg?x=</style><script>alert(1)</script>&y=";color:red';
  assert.equal((await save(s, { hero: bg('image', { image: url }) })).status, 200);
  const page = (await req('/s/' + s.slug)).body;
  assert.doesNotMatch(page, /<script>alert\(1\)<\/script>/);
  assert.match(page, /%3C\/style%3E/);
});
test('uploaded backgrounds are copied to independent media owned by the copied store', async () => {
  const s = await create('Background original');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGN8yMbAwMDAxMDAwMDAAAAL3wDrtkO4LAAAAABJRU5ErkJggg==',
    'base64',
  );
  const uploaded = await mf.dispatchFetch(`http://localhost/api/platform/stores/${s.id}/images`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + PLATFORM, 'Content-Type': 'image/png' },
    body: png,
  });
  assert.equal(uploaded.status, 201);
  const { url } = await uploaded.json();
  assert.equal(
    (await save(s, { hero: bg('image', { image: url }), page: bg('image', { image: url }) }))
      .status,
    200,
  );
  const copy = await platform(`stores/${s.id}/copy`, 'POST', {
    name: 'Copied background',
    slug: 'background-copy',
  });
  assert.equal(copy.status, 202);
  await platform(`copies/${copy.body.id}/continue`, 'POST', {});
  const copied = (await req('/api/stores/background-copy')).body.store.settings.backgrounds;
  assert.notEqual(copied.hero.image, url);
  assert.equal(copied.page.image, copied.hero.image);
  assert.equal((await req(copied.hero.image)).status, 200);
});
