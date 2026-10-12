import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deploymentConfig } from '../scripts/cloudflare-deploy.js';
const source = await readFile('wrangler.jsonc', 'utf8');
const values = {
  CLOUDFLARE_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  DATABASE_ID: '12345678-1234-1234-1234-123456789abc',
  BOT_USERNAME: 'catalog_test_bot',
  PUBLIC_ORIGIN: 'https://factory.example',
  PLATFORM_API_KEY: 'test-platform-key-that-is-at-least-32-chars',
  TELEGRAM_BOT_TOKEN: '123456:test-token',
  TELEGRAM_WEBHOOK_SECRET: 'test_webhook_key_with_32_characters_or_more',
};
test('cloud build transfers public config and uploads only required secrets', () => {
  const { config, secrets } = deploymentConfig(source, values);
  assert.equal(config.vars.PUBLIC_ORIGIN, values.PUBLIC_ORIGIN);
  assert.equal(config.vars.BOT_USERNAME, values.BOT_USERNAME);
  assert.equal(config.d1_databases[0].database_id, values.DATABASE_ID);
  assert.deepEqual(Object.keys(secrets).sort(), [
    'PLATFORM_API_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
  ]);
  assert.ok(!JSON.stringify(config).includes(values.TELEGRAM_BOT_TOKEN));
});
test('cloud build rejects missing settings and invalid secret shape before deployment', () => {
  for (const key of Object.keys(values))
    assert.throws(() => deploymentConfig(source, { ...values, [key]: '' }));
  assert.throws(() =>
    deploymentConfig(source, { ...values, PUBLIC_ORIGIN: 'http://localhost:8787' }),
  );
  assert.throws(() => deploymentConfig(source, { ...values, TELEGRAM_WEBHOOK_SECRET: 'bad/key' }));
});
