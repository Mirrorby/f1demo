// Run domain logic against real SQLite without binding a local TCP listener.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { build } from 'esbuild';
let sql, env, app;
const originalFetch = globalThis.fetch;
class Statement {
  constructor(query, values = []) {
    this.query = query;
    this.values = values;
  }
  bind(...v) {
    return new Statement(this.query, v);
  }
  async first(column) {
    const v = sql.prepare(this.query).get(...this.values);
    return column ? v?.[column] : v || null;
  }
  async all() {
    return { results: sql.prepare(this.query).all(...this.values) };
  }
  async run() {
    const r = sql.prepare(this.query).run(...this.values);
    return { meta: { changes: Number(r.changes) }, success: true };
  }
}
const row = (id) => sql.prepare('SELECT * FROM stores WHERE id=?').get(id);
const fresh = (owner, changes = {}) =>
  app.createDemo(
    env,
    owner,
    { name: 'My catalog', templateId: 'minimal', currency: 'USD', seedProducts: false, ...changes },
    'https://store.example',
  );
before(async () => {
  sql = new DatabaseSync(':memory:');
  for (const file of (await readdir('migrations')).filter((f) => f.endsWith('.sql')).sort())
    sql.exec(await readFile('migrations/' + file, 'utf8'));
  env = {
    PUBLIC_ORIGIN: 'https://store.example',
    TRIBUTE_PRODUCT_URL: 'https://web.tribute.tg/p/NEW',
    TRIBUTE_API_KEY: 'test',
    DB: {
      prepare: (q) => new Statement(q),
      batch: async (statements) => {
        sql.exec('BEGIN');
        try {
          const r = [];
          for (const statement of statements) r.push(await statement.run());
          sql.exec('COMMIT');
          return r;
        } catch (e) {
          sql.exec('ROLLBACK');
          throw e;
        }
      },
    },
    IMAGES: {},
  };
  const built = await build({
    stdin: {
      contents: `export {productTemplateCSV,templateDownload,sendProductTemplate} from './src/product-template'; export {createDemo} from './src/onboarding'; export {activateTrial,trialStatus} from './src/trial'; export {manualSubscription,sendSubscriptionReminders} from './src/subscriptions'; export {notificationCopy} from './src/subscription-notifications'; export {parseCSV,importProducts} from './src/product-import'; export {shortLink} from './src/short-links'; export {applyCatalogPurchase,catalogPlanConfig} from './src/catalog-plan'; export {templates,templateProducts,templateSettings} from './src/templates';`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });
  app = await import(
    'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
  );
});
after(() => {
  globalThis.fetch = originalFetch;
  sql?.close();
});
test('manual demos: empty or seeded, 3-demo cap, active sites do not consume demo slots', async () => {
  const a = await fresh('10001'),
    b = await fresh('10001'),
    c = await fresh('10001');
  assert.equal(
    sql.prepare('SELECT count(*) n FROM products WHERE store_id=?').get(a.job.store_id).n,
    0,
  );
  assert.equal(
    sql.prepare('SELECT sample_content FROM demo_build_jobs WHERE id=?').get(a.job.id)
      .sample_content,
    0,
  );
  await assert.rejects(fresh('10001'), /тр[её]х|DEMO_LIMIT|3/);
  sql.prepare("UPDATE stores SET status='active' WHERE id=?").run(a.job.store_id);
  assert.ok((await fresh('10001')).job.store_id);
  assert.equal(
    sql
      .prepare(
        'SELECT expires_at-created_at seconds FROM demo_retention JOIN demo_build_jobs ON job_id=id WHERE job_id=?',
      )
      .get(b.job.id).seconds,
    604800,
  );
});
test('CSV: quotes, Cyrillic, BOM, multiline fields, invalid cells cause zero writes, retry is idempotent', async () => {
  assert.deepEqual(app.parseCSV('\uFEFFНазвание;Описание\r\n"Товар; A";"две\nстроки"'), [
    ['Название', 'Описание'],
    ['Товар; A', 'две\nстроки'],
  ]);
  const created = await fresh('10002'),
    id = created.job.store_id,
    requestId = crypto.randomUUID();
  const csv =
    'Название;Категория;Описание;Артикул;Фото;Варианты;Наличие;Цена USD\r\nТовар;Одежда;Описание;SKU-1;https://example.com/photo.jpg;S:5|M:0;available;24,99';
  const preview = await app.importProducts(env, row(id), { csv, requestId, preview: true });
  assert.equal(preview.valid, true);
  assert.equal(preview.count, 1);
  const invalid = await app.importProducts(env, row(id), {
    csv: csv.replace('24,99', '-1'),
    requestId: crypto.randomUUID(),
    preview: false,
  });
  assert.equal(invalid.valid, false);
  assert.equal(sql.prepare('SELECT count(*) n FROM products WHERE store_id=?').get(id).n, 0);
  const result = await app.importProducts(env, row(id), { csv, requestId, preview: false });
  assert.equal(result.imported, 1);
  assert.equal(
    (await app.importProducts(env, row(id), { csv, requestId, preview: false })).duplicate,
    true,
  );
  const p = sql.prepare('SELECT data FROM products WHERE store_id=?').get(id);
  assert.equal(JSON.parse(p.data).prices.USD, 2499);
  assert.equal(sql.prepare('SELECT sum(stock) n FROM variants WHERE store_id=?').get(id).n, 5);
  await assert.rejects(
    app.importProducts(env, row(id), {
      csv: csv.replace('Цена USD', 'Цена EUR'),
      requestId: crypto.randomUUID(),
    }),
    /заголовки|валюте/,
  );
  await assert.rejects(
    app.importProducts(env, row(id), {
      csv: 'Название;Цена USD\n"Товар;2',
      requestId: crypto.randomUUID(),
    }),
    /кавычки/,
  );
});
test('shortener persists links, targets our route and throttles failed calls', async () => {
  const created = await fresh('10003'),
    store = row(created.job.store_id);
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://is.gd/create.php');
    assert.ok(new URLSearchParams(options.body).get('url').startsWith('https://store.example/c/'));
    return Response.json({ shorturl: 'https://is.gd/Abc123' });
  };
  assert.equal((await app.shortLink(env, store)).url, 'https://is.gd/Abc123');
  await app.shortLink(env, store);
  assert.equal(calls, 1);
  const second = await fresh('10004');
  await assert.rejects(app.shortLink(env, row(second.job.store_id)), /занят/);
  assert.equal(calls, 1);
});
test('payments: exact product and amount, one purchase for one month of one site, refund stops orders', async () => {
  globalThis.fetch = async () =>
    Response.json({
      rows: [
        {
          id: 456,
          webLink: env.TRIBUTE_PRODUCT_URL,
          type: 'digital',
          status: 'approved',
          amount: 2499,
          currency: 'USD',
          name: 'Monthly catalog',
        },
      ],
    });
  assert.equal((await app.catalogPlanConfig(env)).configured, true);
  const a = await fresh('10005'),
    b = await fresh('10005'),
    id = a.job.store_id;
  sql
    .prepare(
      "INSERT INTO tribute_digital_purchases(purchase_id,owner_id,product_id,title,amount_minor,currency,status) VALUES('900','10005',456,'Monthly catalog',2499,'usd','paid')",
    )
    .run();
  const activated = await app.applyCatalogPurchase(env, row(id), { purchaseId: '900' });
  assert.equal(row(id).status, 'active');
  assert.equal(row(id).orders_enabled, 1);
  assert.ok(activated.subscription.expires_at > Date.now() / 1000);
  assert.equal(
    (await app.applyCatalogPurchase(env, row(id), { purchaseId: '900' })).duplicate,
    true,
  );
  await assert.rejects(
    app.applyCatalogPurchase(env, row(b.job.store_id), { purchaseId: '900' }),
    /другого сайта/,
  );
  sql
    .prepare(
      "UPDATE tribute_digital_purchases SET status='refund_reported' WHERE purchase_id='900'",
    )
    .run();
  assert.equal(row(id).orders_enabled, 0);
});
test('all seven templates have valid product data, editorial settings and illustrations', () => {
  assert.equal(app.templates.length, 7);
  for (const t of app.templates) {
    const cfg = app.templateSettings(t, 'ru');
    assert.equal(cfg.theme, t.id);
    const products = app.templateProducts(t, ['USD']);
    assert.equal(products.length, 6);
    assert.ok(products.every((p) => p.description && p.photos[0]));
  }
});

test('trial: one 14-day activation per account, repeat protection and paid renewal preserve remaining trial days', async () => {
  const created = await fresh('10006'),
    other = await fresh('10006'),
    id = created.job.store_id;
  assert.equal((await app.trialStatus(env, '10006')).available, true);
  const result = await app.activateTrial(env, row(id));
  assert.equal(result.trial.expires_at - result.trial.started_at, 14 * 86400);
  assert.equal(row(id).orders_enabled, 1);
  assert.equal(row(id).status, 'active');
  assert.equal((await app.activateTrial(env, row(id))).duplicate, true);
  await assert.rejects(app.activateTrial(env, row(other.job.store_id)), /уже использован/);
  globalThis.fetch = async () =>
    Response.json({
      rows: [
        {
          id: 456,
          webLink: env.TRIBUTE_PRODUCT_URL,
          type: 'digital',
          status: 'approved',
          amount: 2499,
          currency: 'USD',
          name: 'Monthly catalog',
        },
      ],
    });
  sql
    .prepare(
      "INSERT INTO tribute_digital_purchases(purchase_id,owner_id,product_id,title,amount_minor,currency,status) VALUES('901','10006',456,'Monthly catalog',2499,'usd','paid')",
    )
    .run();
  const paid = await app.applyCatalogPurchase(env, row(id), { purchaseId: '901' });
  assert.ok(paid.subscription.expires_at > result.trial.expires_at + 27 * 86400);
  assert.equal((await app.trialStatus(env, '10006')).active, false);
});
test('expired trial cannot be restarted, even on another new site', async () => {
  const created = await fresh('10007'),
    id = created.job.store_id;
  await app.activateTrial(env, row(id));
  sql.prepare('UPDATE trial_activations SET expires_at=unixepoch()-1 WHERE store_id=?').run(id);
  sql.prepare('UPDATE subscriptions SET expires_at=unixepoch()-1 WHERE store_id=?').run(id);
  sql.prepare('UPDATE stores SET orders_enabled=0 WHERE id=?').run(id);
  const repeat = await app.activateTrial(env, row(id));
  assert.equal(repeat.subscription.status, 'expired');
  assert.equal(row(id).orders_enabled, 0);
  const other = await fresh('10007');
  await assert.rejects(app.activateTrial(env, row(other.job.store_id)), /уже использован/);
});

function notificationSetup() {
  sql.exec('DELETE FROM subscription_notifications;DELETE FROM subscriptions;');
  sql
    .prepare("UPDATE maintenance_state SET value='0' WHERE key='subscription_notifications_since'")
    .run();
  env.TELEGRAM_BOT_TOKEN = 'test-notifications-token';
  env.BOT_USERNAME = 'test_bot';
  const messages = [];
  let fail = false;
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).startsWith('https://api.telegram.org/'));
    messages.push(JSON.parse(options.body));
    return Response.json(
      fail
        ? { ok: false, description: 'Temporary failure' }
        : { ok: true, result: { message_id: messages.length } },
      { status: fail ? 500 : 200 },
    );
  };
  return {
    messages,
    setFailure(value) {
      fail = value;
    },
  };
}
test('trial reminder names the trial, opens the correct payment screen and is not repeated', async () => {
  const { messages } = notificationSetup();
  const created = await fresh('20001'),
    id = created.job.store_id;
  await app.activateTrial(env, row(id));
  await app.sendSubscriptionReminders(env);
  assert.equal(messages.length, 1);
  assert.match(messages[0].text, /Пробный период.*активирован/);
  const until = Math.floor(Date.now() / 1000) + 2 * 86400;
  sql.prepare('UPDATE trial_activations SET expires_at=? WHERE store_id=?').run(until, id);
  sql
    .prepare('UPDATE subscriptions SET expires_at=?,reminder_sent_at=NULL WHERE store_id=?')
    .run(until, id);
  await app.sendSubscriptionReminders(env);
  assert.equal(messages.length, 2);
  assert.match(messages[1].text, /Пробный период.*заканчивается/);
  const button = messages[1].reply_markup.inline_keyboard[0][0];
  assert.equal(button.text, 'Активировать подписку');
  const url = new URL(button.web_app.url);
  assert.equal(url.origin, env.PUBLIC_ORIGIN);
  assert.equal(url.pathname, '/admin');
  assert.equal(url.searchParams.get('store'), id);
  assert.equal(url.searchParams.get('tab'), 'payments');
  await Promise.all([app.sendSubscriptionReminders(env), app.sendSubscriptionReminders(env)]);
  assert.equal(messages.length, 2);
});
test('paid reminder and expiry are distinct; expiry pauses orders and sends once', async () => {
  const { messages } = notificationSetup();
  const created = await fresh('20002'),
    id = created.job.store_id;
  await app.manualSubscription(env, row(id), {});
  await app.sendSubscriptionReminders(env);
  assert.equal(messages.length, 1);
  assert.match(messages[0].text, /Подписка.*активирована/);
  sql
    .prepare(
      'UPDATE subscriptions SET expires_at=unixepoch()+172800,reminder_sent_at=NULL WHERE store_id=?',
    )
    .run(id);
  await app.sendSubscriptionReminders(env);
  assert.equal(messages.length, 2);
  assert.match(messages[1].text, /Подписка.*заканчивается/);
  assert.doesNotMatch(messages[1].text, /Пробный/);
  assert.equal(messages[1].reply_markup.inline_keyboard[0][0].text, 'Продлить подписку');
  sql.prepare('UPDATE subscriptions SET expires_at=unixepoch()-1 WHERE store_id=?').run(id);
  await app.sendSubscriptionReminders(env);
  assert.equal(messages.length, 3);
  assert.match(messages[2].text, /Срок подписки.*истёк/);
  assert.equal(row(id).orders_enabled, 0);
  await app.sendSubscriptionReminders(env);
  assert.equal(messages.length, 3);
});
test('expired trial tells the owner that saved products remain and offers paid activation', async () => {
  const { messages } = notificationSetup();
  const created = await fresh('20003'),
    id = created.job.store_id;
  await app.activateTrial(env, row(id));
  await app.sendSubscriptionReminders(env);
  const expiry = Math.floor(Date.now() / 1000) - 1;
  sql.prepare('UPDATE trial_activations SET expires_at=? WHERE store_id=?').run(expiry, id);
  sql.prepare('UPDATE subscriptions SET expires_at=? WHERE store_id=?').run(expiry, id);
  await app.sendSubscriptionReminders(env);
  assert.equal(messages.length, 2);
  assert.match(messages[1].text, /Пробный период.*завершился/);
  assert.match(messages[1].text, /товары сохранены/);
  assert.equal(row(id).orders_enabled, 0);
});
test('manual renewal resumes an expired store and queues a confirmation with the new expiry', async () => {
  const { messages } = notificationSetup();
  const created = await fresh('20004'),
    id = created.job.store_id;
  await app.manualSubscription(env, row(id), {});
  await app.sendSubscriptionReminders(env);
  sql.prepare('UPDATE subscriptions SET expires_at=unixepoch()-1 WHERE store_id=?').run(id);
  await app.sendSubscriptionReminders(env);
  assert.equal(row(id).orders_enabled, 0);
  const renewed = await app.manualSubscription(env, row(id), { months: 1 });
  assert.equal(row(id).orders_enabled, 1);
  await app.sendSubscriptionReminders(env);
  assert.equal(messages.length, 3);
  assert.match(messages[2].text, /Подписка.*продлена до/);
  assert.ok(renewed.subscription.expires_at > Date.now() / 1000);
  await app.sendSubscriptionReminders(env);
  assert.equal(messages.length, 3);
});
test('notification failure retries from the outbox without extending the subscription again', async () => {
  const test = notificationSetup(),
    created = await fresh('20005'),
    id = created.job.store_id;
  await app.manualSubscription(env, row(id), {});
  const expiry = sql
    .prepare('SELECT expires_at FROM subscriptions WHERE store_id=?')
    .get(id).expires_at;
  test.setFailure(true);
  await app.sendSubscriptionReminders(env);
  let notice = sql.prepare('SELECT * FROM subscription_notifications WHERE store_id=?').get(id);
  assert.equal(notice.sent_at, null);
  assert.equal(notice.attempts, 1);
  await app.sendSubscriptionReminders(env);
  assert.equal(test.messages.length, 1);
  sql.prepare('UPDATE subscription_notifications SET next_attempt=0 WHERE store_id=?').run(id);
  test.setFailure(false);
  await app.sendSubscriptionReminders(env);
  notice = sql.prepare('SELECT * FROM subscription_notifications WHERE store_id=?').get(id);
  assert.ok(notice.sent_at);
  assert.equal(test.messages.length, 2);
  assert.equal(
    sql.prepare('SELECT expires_at FROM subscriptions WHERE store_id=?').get(id).expires_at,
    expiry,
  );
});
test('superseded expiry and old-owner notices are cancelled before delivery', async () => {
  const { messages } = notificationSetup(),
    created = await fresh('20006'),
    id = created.job.store_id;
  await app.manualSubscription(env, row(id), {});
  const old = sql
    .prepare('SELECT expires_at FROM subscriptions WHERE store_id=?')
    .get(id).expires_at;
  sql
    .prepare(
      "INSERT INTO subscription_notifications(id,store_id,owner_id,kind,plan_type,expires_at) VALUES('stale-expiry',?,'20006','expired','paid',?)",
    )
    .run(id, old - 1);
  await app.manualSubscription(env, row(id), {});
  await app.sendSubscriptionReminders(env);
  assert.equal(messages.length, 1);
  assert.match(messages[0].text, /продлена/);
  assert.ok(
    sql.prepare("SELECT cancelled_at FROM subscription_notifications WHERE id='stale-expiry'").get()
      .cancelled_at,
  );
  await app.manualSubscription(env, row(id), {});
  sql.prepare("UPDATE stores SET owner_id='20007' WHERE id=?").run(id);
  await app.sendSubscriptionReminders(env);
  assert.equal(messages.length, 1);
});
test('Romanian and English notices distinguish trial expiry from paid renewal', () => {
  assert.match(
    app.notificationCopy('expired', 'trial', 'ro', 'Test', 1900000000).text,
    /Perioada de probă/,
  );
  assert.match(
    app.notificationCopy('renewed', 'paid', 'en', 'Test', 1900000000).text,
    /extended until/,
  );
});

test('CSV HTTPS download has Excel-compatible encoding, headers and matching columns', async () => {
  const csv = app.productTemplateCSV(['USD', 'EUR']);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes('\r\n'));
  const rows = app.parseCSV(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].length, 9);
  assert.equal(rows[1].length, 9);
  const response = app.templateDownload(
    new Request('https://store.example/downloads/products-template.csv?currencies=USD,EUR'),
  );
  assert.equal(
    response.headers.get('content-disposition'),
    'attachment; filename="delokay-products.csv"',
  );
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://web.telegram.org');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer()).slice(0, 3)], [239, 187, 191]);
  assert.equal(
    await app
      .templateDownload(
        new Request('https://store.example/downloads/products-template.csv', { method: 'HEAD' }),
      )
      .text(),
    '',
  );
  assert.throws(() => app.productTemplateCSV(['USD', 'USD']));
  assert.throws(() => app.productTemplateCSV(['USD', 'EUR', 'GBP']));
});
test('CSV chat fallback uploads an actual document only to the store owner', async () => {
  const demo = await fresh('99887766');
  env.TELEGRAM_BOT_TOKEN = 'test';
  let sent = 0;
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).endsWith('/sendDocument'));
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get('chat_id'), '99887766');
    const file = options.body.get('document');
    assert.equal(file.name, 'delokay-products.csv');
    assert.ok((await file.text()).includes('Цена USD'));
    sent++;
    return Response.json({ ok: true, result: { message_id: 123 } });
  };
  try {
    await app.sendProductTemplate(env, row(demo.job.store_id));
    await assert.rejects(() => app.sendProductTemplate(env, row(demo.job.store_id)));
    assert.equal(sent, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
