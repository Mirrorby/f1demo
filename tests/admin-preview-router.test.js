import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewRouter } from '../scripts/admin-preview-router.js';
test('only the production Mini App entry redirects to staging; APIs, stable access and other stores remain on production', async () => {
  const env = {
    PUBLIC_ORIGIN: 'https://production.example',
    ADMIN_PREVIEW_ORIGIN: 'https://staging.example',
  };
  const route = previewRouter(() => new Response('production'));
  const redirected = route(new Request('https://production.example/admin?lang=ru'), env, {});
  assert.equal(redirected.status, 302);
  assert.equal(redirected.headers.get('Location'), 'https://staging.example/admin?lang=ru');
  for (const path of [
    '/admin?version=stable',
    '/api/admin/preferences',
    '/api/telegram/webhook',
    '/s/my-shop',
    '/platform',
  ])
    assert.equal(
      await route(new Request('https://production.example' + path), env, {}).text(),
      'production',
    );
  assert.equal(
    await route(new Request('https://client.example/admin'), env, {}).text(),
    'production',
  );
  assert.equal(
    await route(
      new Request('https://production.example/admin'),
      { PUBLIC_ORIGIN: env.PUBLIC_ORIGIN },
      {},
    ).text(),
    'production',
  );
});
