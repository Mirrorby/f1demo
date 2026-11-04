import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, req, mf, notifications } from './harness.js';
before(() => start({ TRIBUTE_PRODUCT_URL: '', DEPLOYMENT_ENV: 'staging' }));
after(stop);
test('staging cannot change shared bot or process payment events', async () => {
  for (const path of [
    '/api/telegram/webhook',
    '/api/tribute/webhook',
    '/api/platform/telegram/setup',
  ])
    assert.equal((await req(path, 'POST', {})).status, 403, path);
  const config = await req('/api/admin/payments/config');
  assert.equal(config.body.configured, false);
  const before = notifications.length;
  const worker = await mf.getWorker();
  await worker.scheduled({ scheduledTime: Date.now(), cron: '*/10 * * * *' });
  assert.equal(notifications.length, before);
  const { TEST_BRIDGE: bridge } = await mf.getBindings();
  await assert.rejects(async () => await bridge.receiveEvent('{}'));
});
