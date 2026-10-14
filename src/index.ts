import { WorkerEntrypoint } from 'cloudflare:workers';
import platformScript from '../public/platform.js';
import adminScript from '../public/admin.js';
import adminI18nScript from '../public/admin-i18n.js';
import adminStyle from '../public/admin.css';
import adminPage from '../public/admin.html';
import platformPage from '../public/platform.html';
import platformEditorPage from '../public/platform-editor.html';
const brandedPanel = (html: string) =>
  html
    .replace(/<script defer src="\/admin-i18n\.js[^"]*"><\/script>/, '')
    .replace('</head>', `<style id="delokay-theme-inline">${adminStyle}</style></head>`)
    .replace('</body>', `<script id="delokay-language-inline">${adminI18nScript}</script></body>`);
import { digitalWebhook } from './tribute-digital';
import {
  createInvoice,
  listInvoices,
  tributeConfig,
  tributeWebhook,
  verifyTributeSignature,
  reconcileInvoice,
  flushPaymentNotifications,
} from './tribute';
import { platformAuth, telegramAuth } from './auth';
import {
  catalog,
  createStore,
  ownedStore,
  publicStore,
  saveProduct,
  stmt,
  storeBySlug,
  updateSettings,
} from './catalog';
import { placeOrder, changeStatus, orderView } from './orders';
import { flushNotifications, inviteOwner, origin, webhook, setupTelegram } from './telegram';
import {
  cleanupMedia,
  deleteDemo,
  listCopies,
  processCopy,
  setOrderIntake,
  startCopy,
} from './factory';
import { HttpError, object, requireThat, text, jsonBody, limitedBytes, int } from './validation';
import type { OrderRow, ProductRow, StoreRow } from './types';
import { findTemplate, templateList, templateProducts, templateSettings } from './templates';
import { settings, product } from './validation';
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
async function upload(request: Request, env: Env, access: StoreRow) {
  const storeId = access.id;
  const bytes = await limitedBytes(request, 3 * 1024 * 1024);
  requireThat(bytes.length >= 12, 'Пустое изображение');
  let ext = '',
    mime = '';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    ext = 'jpg';
    mime = 'image/jpeg';
  } else if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) {
    ext = 'png';
    mime = 'image/png';
  } else if (
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  ) {
    ext = 'webp';
    mime = 'image/webp';
  }
  requireThat(
    ext && request.headers.get('content-type') === mime,
    'Разрешены только JPEG, PNG и WebP',
    415,
  );
  const key = storeId + '/' + crypto.randomUUID() + '.' + ext;
  await env.IMAGES.put(key, bytes, {
    httpMetadata: { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' },
  });
  const current = await stmt(
    env,
    'SELECT version,owner_id FROM stores WHERE id=?',
    storeId,
  ).first<StoreRow>();
  if (!current || current.owner_id !== access.owner_id || current.version !== access.version) {
    await env.IMAGES.delete(key);
    throw new HttpError(409, 'Магазин изменён. Обновите панель.');
  }
  return { url: '/media/' + key };
}
async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  if (path === '/api/tribute/webhook' && method === 'POST') {
    const result = await tributeWebhook(request, env);
    ctx.waitUntil(flushPaymentNotifications(env));
    return json(result);
  }
  if (
    ['/platform.js', '/platform/app.js'].includes(path) &&
    (method === 'GET' || method === 'HEAD')
  )
    return new Response(method === 'HEAD' ? null : platformScript, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  if (['/admin-i18n.js', '/admin.css'].includes(path) && (method === 'GET' || method === 'HEAD'))
    return new Response(method === 'HEAD' ? null : path.endsWith('.css') ? adminStyle : adminI18nScript, {
      headers: {
        'Content-Type': path.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  if (
    ['/admin', '/admin/', '/admin.html', '/admin.js', '/admin/app.js'].includes(path) &&
    (method === 'GET' || method === 'HEAD')
  )
    return new Response(method === 'HEAD' ? null : path.endsWith('.js') ? adminScript : brandedPanel(adminPage), {
      headers: {
        'Content-Type': path.endsWith('.js')
          ? 'application/javascript; charset=utf-8'
          : 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
  if (
    [
      '/platform',
      '/platform/',
      '/platform.html',
      '/platform/editor',
      '/platform-editor.html',
    ].includes(path) &&
    (method === 'GET' || method === 'HEAD')
  ) {
    const editor = path === '/platform/editor' || path === '/platform-editor.html';
    return new Response(method === 'HEAD' ? null : editor ? brandedPanel(platformEditorPage) : platformPage, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': editor ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
      },
    });
  }
  if (path === '/api/health' && method === 'GET') return json({ ok: true });
  if (path === '/api/templates' && method === 'GET') return json(templateList());
  const previewApi = path.match(/^\/api\/templates\/([a-z]+)$/);
  if (previewApi && method === 'GET') {
    const t = findTemplate(previewApi[1]);
    requireThat(t, 'Шаблон не найден', 404);
    const id = '00000000-0000-0000-0000-000000000000';
    const cfg = settings(templateSettings(t));
    return json({
      store: {
        id,
        slug: t.id,
        name: t.name,
        status: 'demo',
        version: 1,
        acceptingOrders: false,
        settings: cfg,
      },
      products: templateProducts(t, cfg.currencies).map((p, i) => {
        const normalized = product(p, cfg, id);
        return {
          ...normalized.data,
          variants: normalized.variants,
          id: 'preview-' + i,
          version: 1,
        };
      }),
    });
  }
  if (path === '/api/telegram/webhook' && method === 'POST') {
    await webhook(request, env, await jsonBody(request, 64000));
    return json({ ok: true });
  }
  if (path.startsWith('/api/platform/')) {
    await platformAuth(request, env);
    if (path === '/api/platform/payments/config' && method === 'GET')
      return json(await tributeConfig(env));
    if (path === '/api/platform/payments' && method === 'GET') return json(await listInvoices(env));
    const invoiceStore = path.match(/^\/api\/platform\/stores\/([a-f0-9-]{36})\/invoices$/);
    if (invoiceStore) {
      if (method === 'GET') return json(await listInvoices(env, invoiceStore[1]));
      if (method === 'POST') {
        const s = await stmt(
          env,
          'SELECT * FROM stores WHERE id=?',
          invoiceStore[1],
        ).first<StoreRow>();
        requireThat(s, 'Магазин не найден', 404);
        return json(await createInvoice(env, s, await jsonBody(request)), 201);
      }
    }
    const reconcile = path.match(/^\/api\/platform\/invoices\/([a-f0-9-]{36})\/reconcile$/);
    if (reconcile && method === 'POST') {
      const result = await reconcileInvoice(env, reconcile[1], await jsonBody(request));
      ctx.waitUntil(flushPaymentNotifications(env));
      return json(result);
    }
    if (path === '/api/platform/telegram/setup' && method === 'POST')
      return json(await setupTelegram(env));
    if (path === '/api/platform/config' && method === 'GET')
      return json({ publicOrigin: origin(env), botUsername: env.BOT_USERNAME });
    if (path === '/api/platform/stores' && method === 'GET') {
      const stores = await stmt(
        env,
        'SELECT * FROM stores ORDER BY created_at DESC,id LIMIT 200',
      ).all<StoreRow>();
      return json(stores.results.map((s) => ({ ...publicStore(s), ownerLinked: !!s.owner_id })));
    }
    if (path === '/api/platform/stores' && method === 'POST')
      return json(await createStore(env, await jsonBody(request), origin(env)), 201);
    if (path === '/api/platform/copies' && method === 'GET') return json(await listCopies(env));
    const copyStep = path.match(/^\/api\/platform\/copies\/([a-f0-9-]{36})\/continue$/);
    if (copyStep && method === 'POST') {
      await processCopy(env, origin(env), copyStep[1]);
      return json({ ok: true });
    }
    const match = path.match(
      /^\/api\/platform\/stores\/([a-f0-9-]{36})\/(invite|activate|export|intake|copy|delete-demo)$/,
    );
    if (match) {
      const s = await stmt(env, 'SELECT * FROM stores WHERE id=?', match[1]).first<StoreRow>();
      requireThat(s, 'Магазин не найден', 404);
      if (match[2] === 'intake' && method === 'POST')
        return json(await setOrderIntake(env, s, await jsonBody(request)));
      if (match[2] === 'copy' && method === 'POST') {
        const job = await startCopy(env, s, await jsonBody(request));
        ctx.waitUntil(processCopy(env, origin(env), job.id));
        return json(job, 202);
      }
      if (match[2] === 'delete-demo' && method === 'POST') {
        await deleteDemo(env, s, await jsonBody(request));
        ctx.waitUntil(cleanupMedia(env));
        return json({ ok: true });
      }
      if (match[2] === 'invite' && method === 'POST')
        return json(await inviteOwner(env, s, await jsonBody(request)));
      if (match[2] === 'activate' && method === 'POST') {
        requireThat(s.owner_id, 'Сначала подключите владельца', 409);
        requireThat(
          env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET,
          'Сначала настройте Telegram',
          503,
        );
        await stmt(
          env,
          "UPDATE stores SET status='active',version=version+1 WHERE id=? AND version=? AND owner_id IS ?",
          s.id,
          s.version,
          s.owner_id,
        ).run();
        return json({ url: origin(env) + '/shop/' + s.slug });
      }
      if (match[2] === 'export' && method === 'GET')
        return json({ schemaVersion: 1, ...publicStore(s), products: await catalog(env, s.id) });
    }
  }
  if (path.startsWith('/api/admin/') || path.startsWith('/api/platform/')) {
    const isPlatform = path.startsWith('/api/platform/');
    const owner = isPlatform ? null : await telegramAuth(request, env);
    if (path === '/api/admin/payments/config' && method === 'GET')
      return json(await tributeConfig(env));
    if (path === '/api/admin/payments' && method === 'GET')
      return json(await listInvoices(env, undefined, owner!));
    if (path === '/api/admin/stores' && method === 'GET') {
      const stores = await stmt(
        env,
        'SELECT * FROM stores WHERE owner_id=? ORDER BY created_at LIMIT 50',
        owner,
      ).all<StoreRow>();
      return json(stores.results.map(publicStore));
    }
    const match = path.match(
      /^\/api\/(?:admin|platform)\/stores\/([a-f0-9-]{36})(?:\/(products|orders|settings|images)(?:\/([a-f0-9-]{36}))?)?$/,
    );
    if (match) {
      const s = isPlatform
          ? await stmt(env, 'SELECT * FROM stores WHERE id=?', match[1]).first<StoreRow>()
          : await ownedStore(env, match[1], owner!),
        section = match[2],
        id = match[3];
      requireThat(s, 'Магазин не найден', 404);
      if (!section && method === 'GET') {
        const stats = await stmt(
          env,
          "SELECT (SELECT COUNT(*) FROM products WHERE store_id=? AND deleted_at IS NULL) productCount,(SELECT COUNT(*) FROM orders WHERE store_id=? AND status='new') newOrderCount",
          s.id,
          s.id,
        ).first();
        return json({ ...publicStore(s), stats });
      }
      if (section === 'products' && !id && method === 'GET') return json(await catalog(env, s.id));
      if (section === 'products' && !id && method === 'POST')
        return json(await saveProduct(env, s, await jsonBody(request)), 201);
      if (section === 'products' && id && method === 'PUT')
        return json(await saveProduct(env, s, await jsonBody(request), id));
      if (section === 'products' && id && method === 'DELETE') {
        const d = object(await jsonBody(request)),
          version = int(d.version, 1, Number.MAX_SAFE_INTEGER);
        const result = await stmt(
          env,
          'UPDATE products SET deleted_at=unixepoch(),version=version+1 WHERE store_id=? AND id=? AND deleted_at IS NULL AND version=? AND EXISTS(SELECT 1 FROM stores WHERE id=? AND owner_id IS ? AND version=?)',
          s.id,
          id,
          version,
          s.id,
          s.owner_id,
          s.version,
        ).run();
        requireThat(result.meta.changes === 1, 'Товар уже изменён или удалён', 409);
        return json({ ok: true });
      }
      if (section === 'orders' && method === 'GET') {
        if (id) {
          const o = await stmt(
            env,
            'SELECT * FROM orders WHERE store_id=? AND id=?',
            s.id,
            id,
          ).first<OrderRow>();
          requireThat(o, 'Заказ не найден', 404);
          return json(orderView(o));
        }
        const offset = Number(url.searchParams.get('offset') ?? 0);
        requireThat(
          Number.isInteger(offset) && offset >= 0 && offset <= 100000,
          'Недопустимая страница',
        );
        const status = url.searchParams.get('status') ?? '';
        requireThat(
          !status || ['new', 'processing', 'completed', 'cancelled'].includes(status),
          'Недопустимый статус',
        );
        const orders = await stmt(
          env,
          `SELECT * FROM orders WHERE store_id=? ${status ? 'AND status=?' : ''} ORDER BY created_at DESC,number DESC LIMIT 50 OFFSET ?`,
          s.id,
          ...(status ? [status] : []),
          offset,
        ).all<OrderRow>();
        return json(orders.results.map(orderView));
      }
      if (section === 'orders' && id && method === 'PATCH') {
        await changeStatus(
          env,
          s.id,
          id,
          text(object(await jsonBody(request)).status, 20, true),
          s,
        );
        return json({ ok: true });
      }
      if (section === 'settings' && !id && method === 'PUT') {
        await updateSettings(env, s, await jsonBody(request));
        return json({ ok: true });
      }
      if (section === 'images' && !id && method === 'POST')
        return json(await upload(request, env, s), 201);
    }
  }
  const publicMatch = path.match(/^\/api\/stores\/([a-z0-9-]{1,80})(?:\/(orders))?$/);
  if (publicMatch) {
    const s = await storeBySlug(env, publicMatch[1]);
    if (method === 'GET' && !publicMatch[2])
      return json({ store: publicStore(s), products: await catalog(env, s.id) });
    if (method === 'POST' && publicMatch[2]) {
      const result = await placeOrder(
        env,
        s,
        await jsonBody(request, 32000),
        request.headers.get('Idempotency-Key') ?? '',
        request.headers.get('CF-Connecting-IP') ?? 'local',
      );
      ctx.waitUntil(flushNotifications(env, result.id));
      return json(result, 201);
    }
  }
  if (path.startsWith('/api/')) throw new HttpError(404, 'API не найден');
  if (path.startsWith('/media/') && (method === 'GET' || method === 'HEAD')) {
    requireThat(
      /^\/media\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(path),
      'Изображение не найдено',
      404,
    );
    const o = await env.IMAGES.get(path.slice(7));
    requireThat(o, 'Изображение не найдено', 404);
    const headers = new Headers();
    o.writeHttpMetadata(headers);
    headers.set('ETag', o.httpEtag);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', "default-src 'none'");
    return new Response(method === 'HEAD' ? null : o.body, { headers });
  }
  let assetPath = path;
  if (path === '/') assetPath = '/welcome.html';
  if (path === '/admin' || path === '/admin/') assetPath = '/admin.html';
  if (path === '/platform' || path === '/platform/') assetPath = '/platform.html';
  if (path === '/platform/editor') assetPath = '/platform-editor.html';
  const preview = path.match(/^\/templates\/([a-z]+)\/?$/);
  if (preview) {
    requireThat(findTemplate(preview[1]), 'Шаблон не найден', 404);
    assetPath = '/storefront.html';
  }
  const storefront = path.match(/^\/(demo|shop)\/([a-z0-9-]{1,80})\/?$/);
  if (storefront) {
    const s = await storeBySlug(env, storefront[2]);
    const kind = s.status === 'demo' ? 'demo' : 'shop';
    if (storefront[1] !== kind)
      return Response.redirect(url.origin + '/' + kind + '/' + s.slug, 302);
    assetPath = '/storefront.html';
  }
  const assetUrl = new URL(request.url);
  assetUrl.pathname = assetPath;
  const response = await env.ASSETS.fetch(
    new Request(assetUrl.toString(), { method, headers: request.headers }),
  );
  const secured = new Response(response.body, response);
  secured.headers.set('X-Content-Type-Options', 'nosniff');
  secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (path === '/platform' || path === '/platform/' || path === '/platform.html')
    secured.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  if (path === '/platform/editor' || path === '/platform-editor.html')
    secured.headers.set('Content-Security-Policy', "frame-ancestors 'self'");
  return secured;
}
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      return await route(request, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(
        JSON.stringify({ event: 'request_failed', path: new URL(request.url).pathname }),
      );
      return json({ error: 'Не удалось выполнить запрос. Попробуйте позже.' }, 500);
    }
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const configured = await stmt(
          env,
          'SELECT username FROM telegram_bot_setup WHERE id=1',
        ).first<{ username: string }>();
        if (configured?.username === env.BOT_USERNAME) return;
        await setupTelegram(env);
        await stmt(
          env,
          'INSERT INTO telegram_bot_setup(id,username,configured_at) VALUES(1,?,unixepoch()) ON CONFLICT(id) DO UPDATE SET username=excluded.username,configured_at=excluded.configured_at',
          env.BOT_USERNAME,
        ).run();
      })().catch(() =>
        console.error(
          JSON.stringify({ event: 'telegram_setup_retry', username: env.BOT_USERNAME }),
        ),
      ),
    );
    ctx.waitUntil(flushNotifications(env));
    ctx.waitUntil(flushPaymentNotifications(env));
    await processCopy(env, origin(env), undefined, 2);
    await cleanupMedia(env);
    await stmt(env, 'DELETE FROM owner_invites WHERE expires_at<unixepoch()-86400').run();
  },
} satisfies ExportedHandler<Env>;

// Callable only through a configured Cloudflare service binding.
// The Leela entrypoint verifies Tribute's signature before calling this method.
export class CatalogTributeBridge extends WorkerEntrypoint<Env> {
  async verifySignature(body: string, signature: string) {
    return verifyTributeSignature(body, signature, this.env.TRIBUTE_API_KEY);
  }
  async inspect() {
    return tributeConfig(this.env);
  }
  async gatewayProbe() {
    const body = JSON.stringify({ name: 'integration_probe', payload: {} });
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.env.TRIBUTE_API_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const signature = Array.from(new Uint8Array(signed), (v) =>
      v.toString(16).padStart(2, '0'),
    ).join('');
    const r = await this.env.LEELA_PAYMENTS.fetch(
      new Request('https://internal/tribute/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'trbt-signature': signature },
        body,
      }),
    );
    return { status: r.status, result: await r.json() };
  }
  async receiveEvent(body: string) {
    requireThat(
      typeof body === 'string' && new TextEncoder().encode(body).length <= 64000,
      'Некорректное уведомление',
    );
    const event = object(JSON.parse(body));
    const name = text(event.name, 100, true);
    if (!['new_digital_product', 'digital_product_refunded'].includes(name))
      return { status: 'ignored' };
    const result = await digitalWebhook(this.env, name, event.payload);
    this.ctx.waitUntil(flushPaymentNotifications(this.env));
    return result;
  }
}
