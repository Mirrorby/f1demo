import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { deploymentConfig } from '../scripts/cloudflare-deploy.js';
import { rollbackArgs } from '../scripts/release.js';
import { initData } from './harness.js';
const source = await readFile('wrangler.jsonc', 'utf8');
test('staging config isolates database, images, secrets, cron and payment services', () => {
  const { config, secrets } = deploymentConfig(source, {
    DEPLOY_TARGET: 'staging',
    PLATFORM_API_KEY: 'staging-key-separate-with-at-least-32-characters',
    DATABASE_ID: 'production-id-must-not-be-used',
    TELEGRAM_BOT_TOKEN: 'production-token-must-not-be-used',
    TRIBUTE_API_KEY: 'production-payment-key',
  });
  assert.equal(config.name, 'catalog-factory-staging');
  assert.equal(config.d1_databases[0].database_name, 'catalog-factory-staging');
  assert.equal(config.r2_buckets[0].bucket_name, 'catalog-factory-staging-images');
  assert.deepEqual(config.triggers.crons, []);
  assert.deepEqual(config.services, [{ binding: 'AUTH_VERIFIER', service: 'catalog-factory' }]);
  assert.equal(config.vars.DEPLOYMENT_ENV, 'staging');
  assert.equal(config.vars.TRIBUTE_PRODUCT_URL, '');
  assert.deepEqual(Object.keys(secrets), ['PLATFORM_API_KEY']);
  assert.ok(!JSON.stringify({ config, secrets }).includes('production-token-must-not-be-used'));
  assert.throws(() => deploymentConfig(source, { DEPLOY_TARGET: 'unknown' }));
  assert.throws(() => deploymentConfig(source, { DEPLOY_TARGET: 'staging' }));
});
test('rollback pins the recorded production version without migrations or deletion', async () => {
  const release = JSON.parse(
    await readFile('releases/production-baseline-2026-10-22.json', 'utf8'),
  );
  const args = rollbackArgs(release);
  assert.ok(args.includes(release.versionId));
  assert.equal(args[1], 'rollback');
  assert.equal(args[args.indexOf('--name') + 1], 'catalog-factory');
  assert.ok(!args.some((a) => /migrations|restore|delete/.test(a)));
  assert.throws(() => rollbackArgs({ ...release, worker: 'other-worker' }));
});
test('shared-bot staging auth forwards the signed payload to production and fails closed', async () => {
  const result = await build({
    entryPoints: ['src/auth.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const { telegramAuth } = await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
  );
  const production = { TELEGRAM_BOT_TOKEN: '123456:local-test-bot-token' };
  const staging = {
    DEPLOYMENT_ENV: 'staging',
    AUTH_VERIFIER_ORIGIN: 'https://store.example',
    AUTH_VERIFIER: {
      async fetch(request) {
        assert.equal(new URL(request.url).pathname, '/api/admin/preferences');
        try {
          await telegramAuth(request, production);
          return new Response('{}');
        } catch {
          return new Response('{}', { status: 401 });
        }
      },
    },
  };
  const valid = new Request('https://staging.example/api/admin/demo-jobs', {
    headers: { Authorization: 'tma ' + initData(123) },
  });
  assert.equal(await telegramAuth(valid, staging), '123');
  await assert.rejects(() =>
    telegramAuth(
      new Request('https://staging.example', {
        headers: { Authorization: 'tma ' + initData(123, 1) },
      }),
      staging,
    ),
  );
  await assert.rejects(() => telegramAuth(valid, { DEPLOYMENT_ENV: 'staging' }));
  await assert.rejects(() =>
    telegramAuth(valid, {
      DEPLOYMENT_ENV: 'staging',
      AUTH_VERIFIER: { fetch: async () => new Response('', { status: 503 }) },
    }),
  );
});
