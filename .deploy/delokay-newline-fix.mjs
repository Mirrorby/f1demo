import{WorkerEntrypoint as vt}from"cloudflare:workers";var Re=`'use strict';
const main = document.getElementById('main'),
  noticeBox = document.getElementById('notice');
let apiKey = '',
  config = null,
  templates = [],
  stores = [],
  invoices = [],
  paymentConfig = null;
let editorStoreId = null,
  copyTimer = null;
const escapeText = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function notice(message) {
  noticeBox.textContent = message;
  noticeBox.hidden = !message;
}
async function request(path, method = 'GET', body) {
  const r = await fetch('/api/platform/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + apiKey,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441');
  return data;
}
async function refresh() {
  [stores, invoices] = await Promise.all([request('stores'), request('payments')]);
  try {
    paymentConfig = await request('payments/config');
  } catch (e) {
    paymentConfig = { configured: false, error: e.message };
  }
  if (!editorStoreId) render();
  await updateCopies();
}
async function updateCopies() {
  clearTimeout(copyTimer);
  const copies = await request('copies');
  const pending = copies.filter((job) => job.status === 'pending');
  if (
    !editorStoreId &&
    copies.some((job) => job.status === 'completed' && !stores.some((s) => s.id === job.targetId))
  ) {
    stores = await request('stores');
    render();
  }
  const box = document.getElementById('copy-status');
  if (box)
    box.innerHTML = copies
      .slice(0, 5)
      .map(
        (job) =>
          \`<p>\${escapeText(job.name)}: \${job.status === 'completed' ? '\u041A\u043E\u043F\u0438\u044F \u0433\u043E\u0442\u043E\u0432\u0430' : job.status === 'failed' ? escapeText(job.error) : \`\u041A\u043E\u043F\u0438\u0440\u0443\u0435\u043C \u0444\u043E\u0442\u043E \${job.copied} / \${job.total}\`}</p>\`,
      )
      .join('');
  if (pending.length)
    copyTimer = setTimeout(async () => {
      try {
        await request('copies/' + pending[0].id + '/continue', 'POST', {});
        await updateCopies();
        const latest = await request('copies');
        if (!latest.some((job) => job.status === 'pending')) await refresh();
      } catch (e) {
        notice(e.message);
      }
    }, 2500);
}
window.addEventListener('message', (event) => {
  const frame = document.getElementById('store-editor');
  if (
    apiKey &&
    event.origin === location.origin &&
    event.source === frame?.contentWindow &&
    event.data?.type === 'catalog-editor-ready'
  )
    frame.contentWindow.postMessage({ type: 'catalog-platform-key', key: apiKey }, location.origin);
});

function digitalPaymentPanel() {
  if (paymentConfig?.mode !== 'digital') return '';
  const purchases = invoices.filter((p) => p.type === 'digital');
  return \`<section class="card"><h2>\u041E\u043F\u043B\u0430\u0442\u0430 \u0447\u0435\u0440\u0435\u0437 Tribute</h2>
    <p>\${escapeText(paymentConfig.name || '\u0422\u043E\u0432\u0430\u0440 \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B \u0443\u0441\u043B\u0443\u0433')}</p>
    <p>\${paymentConfig.configured ? (paymentConfig.active ? '\u0422\u043E\u0432\u0430\u0440 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B' : paymentConfig.orderLinkAvailable ? '\u0422\u043E\u0432\u0430\u0440 \u043D\u0430 \u0437\u0430\u043A\u0430\u0437: \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u044C \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u0438 \u043E\u043F\u043B\u0430\u0442\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u0442\u0441\u044F \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 Tribute.' : '\u0422\u043E\u0432\u0430\u0440 \u043F\u043E\u043A\u0430 \u043D\u0435 \u043E\u0434\u043E\u0431\u0440\u0435\u043D Tribute') : '\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 TRIBUTE_API_KEY \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0442\u043E\u0432\u0430\u0440\u0430 \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u043E\u043F\u043B\u0430\u0442.'}</p>
    \${paymentConfig.configured ? \`<p>\u041E\u043F\u043B\u0430\u0442\u0430 \u043A\u0430\u0440\u0442\u0430\u043C\u0438: \${paymentConfig.cardsEnabled ? '\u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430' : '\u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0442\u043E\u0432\u0430\u0440\u0430'}</p>\` : ''}
    <p><a href="\${escapeText(paymentConfig.paymentUrl)}" target="_blank" rel="noopener">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0442\u043E\u0432\u0430\u0440 Tribute \u2197</a></p>
    <p>\u041A\u043B\u0438\u0435\u043D\u0442 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0442\u043E\u0432\u0430\u0440 \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u0439 /pay. \u041F\u043E\u043A\u0443\u043F\u043A\u0438 \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u043F\u043E \u0435\u0433\u043E Telegram ID \u043F\u0440\u0438 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F Tribute.</p>
    \${paymentConfig.fulfillmentRequired ? '<p>\u0422\u043E\u0432\u0430\u0440 \u043D\u0430 \u0437\u0430\u043A\u0430\u0437: \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0437\u0430\u043A\u0430\u0437 \u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044E \u0447\u0435\u0440\u0435\u0437 @Tribute \u2192 \xAB\u041E\u0442\u0432\u0435\u0442\u0438\u0442\u044C\xBB \u2192 \xAB\u041F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u044C\xBB \u2192 \xAB\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440\xBB. Tribute \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0435\u0440\u0435\u0434 \u0432\u044B\u0434\u0430\u0447\u0435\u0439 \u0438 \u0432\u044B\u043F\u043B\u0430\u0442\u043E\u0439. \u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043F\u043E\u043A\u0443\u043F\u043A\u0438 \u043D\u0435 \u043E\u0437\u043D\u0430\u0447\u0430\u0435\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u0437\u0430\u043A\u0430\u0437\u0430 \u0438\u043B\u0438 \u0432\u044B\u043F\u043B\u0430\u0442\u0443 \u043F\u0440\u043E\u0434\u0430\u0432\u0446\u0443.</p>' : ''}
    \${purchases.map((p) => \`<p>\${escapeText(p.title)} \xB7 \${(p.amountMinor / 100).toFixed(2)} \${p.currency.toUpperCase()} \xB7 Telegram ID: \${escapeText(p.ownerId)} \xB7 \${p.status === 'paid' ? '\u041E\u043F\u043B\u0430\u0447\u0435\u043D\u043E' : '\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442'}</p>\`).join('') || '<p>\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0445 \u043F\u043E\u043A\u0443\u043F\u043E\u043A \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.</p>'}
  </section>\`;
}

function invoicePanel(s, i) {
  if (paymentConfig?.mode === 'digital')
    return '<p>\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0441\u043B\u0443\u0433 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u043A\u043B\u0438\u0435\u043D\u0442\u0443 \u0432 \u0431\u043E\u0442\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u0439 /pay.</p>';
  const rows = invoices.filter((x) => x.storeId === s.id);
  const labels = {
    creating: '\u0421\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F',
    review: '\u041D\u0443\u0436\u043D\u0430 \u0441\u0432\u0435\u0440\u043A\u0430 \u0432 Tribute',
    pending: '\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B',
    paid: '\u041E\u043F\u043B\u0430\u0447\u0435\u043D\u043E',
    refund_reported: '\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442',
  };
  return \`<details><summary>\u041E\u043F\u043B\u0430\u0442\u0430 Tribute</summary>
    <p>\${escapeText(paymentConfig?.error || (paymentConfig?.configured && paymentConfig?.active && paymentConfig?.cardsEnabled && paymentConfig?.callbackMatches ? 'Tribute \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D' : '\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 Tribute API-\u043A\u043B\u044E\u0447, Shop ID \u0438 webhook \u043F\u0435\u0440\u0435\u0434 \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u0435\u043C \u0441\u0447\u0435\u0442\u043E\u0432.'))}</p>
    <p>Webhook: \${escapeText(paymentConfig?.webhookUrl || config.publicOrigin + '/api/tribute/webhook')}</p>
    <p>\u041A\u043B\u0438\u0435\u043D\u0442 \u043D\u0430\u0439\u0434\u0451\u0442 \u0441\u0447\u0451\u0442 \u0432 \u0431\u043E\u0442\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u0439 /pay.</p>
    \${
      rows
        .map(
          (
            x,
          ) => \`<p>\${escapeText(x.title)} \xB7 \${(x.amountMinor / 100).toFixed(2)} \${x.currency.toUpperCase()} \xB7 \${labels[x.status] || escapeText(x.status)}
      \${x.paymentUrl && x.status === 'pending' ? \`<a href="\${escapeText(x.paymentUrl)}" target="_blank" rel="noopener">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443 \u2197</a>\` : ''}
      <button data-reconcile="\${x.id}">\u0421\u0432\u0435\u0440\u0438\u0442\u044C \u0441 Tribute</button></p>\`,
        )
        .join('') || '<p>\u0421\u0447\u0435\u0442\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.</p>'
    }
    <form id="invoice-form-\${i}" data-invoice-store="\${s.id}" class="card">
      <input type="hidden" name="invoiceId" value="\${crypto.randomUUID()}">
      <label for="invoice-title-\${i}">\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0443\u0441\u043B\u0443\u0433\u0438 \u0434\u043B\u044F \u043A\u043B\u0438\u0435\u043D\u0442\u0430</label><input id="invoice-title-\${i}" name="title" required maxlength="100" value="Online store setup">
      <label for="invoice-description-\${i}">\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0434\u043B\u044F \u043A\u043B\u0438\u0435\u043D\u0442\u0430</label><textarea id="invoice-description-\${i}" name="description" required maxlength="300">Setup of your online store with Telegram management.</textarea>
      <label for="invoice-amount-\${i}">\u0421\u0443\u043C\u043C\u0430</label><input id="invoice-amount-\${i}" name="amount" required inputmode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="100.00">
      <label for="invoice-currency-\${i}">\u0412\u0430\u043B\u044E\u0442\u0430</label><select id="invoice-currency-\${i}" name="currency"><option>EUR</option><option>USD</option><option>RUB</option></select>
      <button type="submit" \${s.ownerLinked ? '' : 'disabled'}>\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0441\u0447\u0451\u0442</button>
    </form></details>\`;
}

function render() {
  document.getElementById('logout').hidden = false;
  main.innerHTML = \`\${digitalPaymentPanel()}<div class="card"><h2>1. \u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C Telegram</h2><p>\u0411\u043E\u0442: @\${escapeText(config.botUsername)}<br>\u0410\u0434\u0440\u0435\u0441: \${escapeText(config.publicOrigin)}</p><p>\u041A\u043D\u043E\u043F\u043A\u0430 \u0443\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442 webhook, \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0438 \u043C\u0435\u043D\u044E \u0432\u0430\u0448\u0435\u0433\u043E \u0431\u043E\u0442\u0430. \u0414\u043B\u044F \u043D\u043E\u0432\u043E\u0439 \u0444\u0430\u0431\u0440\u0438\u043A\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0431\u043E\u0442\u0430.</p><button class="primary" data-action="telegram">\u041D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C Telegram-\u0431\u043E\u0442\u0430</button></div>
 <form id="create-form" class="card"><h2>2. \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D</h2><label for="new-template">\u0428\u0430\u0431\u043B\u043E\u043D \u0432\u0438\u0442\u0440\u0438\u043D\u044B</label><select id="new-template">\${templates.map((t) => \`<option value="\${t.id}">\${escapeText(t.title)}</option>\`).join('')}</select><p id="template-description"></p><a id="template-preview" href="/templates/minimal" target="_blank" rel="noopener">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0448\u0430\u0431\u043B\u043E\u043D\u0430 \u2197</a><label class="seed-choice"><input id="seed-products" type="checkbox" disabled> \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u044B\u0435 \u0442\u043E\u0432\u0430\u0440\u044B</label><p>\u041F\u0440\u0438\u043C\u0435\u0440\u043D\u044B\u0435 \u0446\u0435\u043D\u044B, \u043E\u0441\u0442\u0430\u0442\u043A\u0438 \u0438 \u0438\u043B\u043B\u044E\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0437\u0430\u043C\u0435\u043D\u0438\u0442\u0435 \u043F\u0435\u0440\u0435\u0434 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0435\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430.</p><label for="new-name">\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435</label><input id="new-name" required maxlength="200" placeholder="\u041C\u043E\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D"><label for="new-slug">Slug \u0434\u043B\u044F \u0441\u0441\u044B\u043B\u043A\u0438</label><input id="new-slug" required maxlength="80" pattern="[a-z0-9][a-z0-9-]*" placeholder="my-store"><label for="new-description">\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435</label><textarea id="new-description" maxlength="2000"></textarea><label for="new-currency">\u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u0432\u0430\u043B\u044E\u0442\u0430</label><select id="new-currency">\${['BYN', 'RUB', 'KZT', 'USD', 'EUR'].map((c) => \`<option>\${c}</option>\`).join('')}</select><label for="new-accent">\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0446\u0432\u0435\u0442</label><input id="new-accent" type="color" value="#354f46"><button class="primary" type="submit" style="margin-top:16px">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0434\u0435\u043C\u043E</button><details><summary>\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0438\u0437 \u0433\u043E\u0442\u043E\u0432\u043E\u0433\u043E JSON</summary><p>\u0415\u0441\u043B\u0438 \u043F\u043E\u043B\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F JSON \u0432\u043C\u0435\u0441\u0442\u043E \u043F\u043E\u043B\u0435\u0439 \u0432\u044B\u0448\u0435. \u0424\u043E\u0440\u043C\u0430\u0442 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 API \u0444\u0430\u0431\u0440\u0438\u043A\u0438.</p><textarea id="new-json" aria-label="JSON \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430" placeholder="\u0412\u0441\u0442\u0430\u0432\u044C\u0442\u0435 JSON \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430"></textarea></details></form>
 <div id="copy-status" role="status"></div><h2>3. \u041C\u0430\u0433\u0430\u0437\u0438\u043D\u044B</h2><div id="store-list">\${stores.map((s, i) => \`<section class="card" data-store-id="\${s.id}"><h3>\${escapeText(s.name)}</h3><p>\${s.status === 'demo' ? '\u0414\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u044F' : s.acceptingOrders ? '\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D' : '\u041F\u0440\u0438\u0451\u043C \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D'} \xB7 \${s.ownerLinked ? '\u0412\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D' : '\u0412\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D'}</p><p><a href="/\${s.status === 'demo' ? 'demo' : 'shop'}/\${escapeText(s.slug)}" target="_blank" rel="noopener">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u0430\u0439\u0442</a></p><label for="owner-\${i}">\${s.ownerLinked ? 'Telegram ID \u043D\u043E\u0432\u043E\u0433\u043E \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430' : '\u0427\u0438\u0441\u043B\u043E\u0432\u043E\u0439 Telegram ID \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430'}</label><input id="owner-\${i}" inputmode="numeric" placeholder="ID, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043F\u043E\u043A\u0430\u0437\u0430\u043B \u0431\u043E\u0442 \u043F\u043E\u0441\u043B\u0435 /start"><button data-invite="\${i}" style="margin-top:12px">\${s.ownerLinked ? '\u041F\u0435\u0440\u0435\u0434\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D' : '\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435'}</button><div id="invite-\${i}"></div><div class="actions" style="margin-top:16px"><button class="primary" data-edit="\${i}">\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D</button><button data-copy="\${i}">\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D</button>\${s.status === 'demo' ? \`<button class="primary" data-activate="\${i}" \${s.ownerLinked ? '' : 'disabled'}>\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D</button>\` : ''}\${s.status === 'active' ? \`<button data-intake="\${i}">\${s.acceptingOrders ? '\u041F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0437\u0430\u043A\u0430\u0437\u044B' : '\u0412\u043E\u0437\u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0437\u0430\u043A\u0430\u0437\u044B'}</button>\` : \`<button class="danger" data-delete-demo="\${i}">\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u0435\u043C\u043E</button>\`}<button data-export="\${i}">\u042D\u043A\u0441\u043F\u043E\u0440\u0442 JSON</button></div>\${invoicePanel(s, i)}</section>\`).join('') || '<p>\u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043F\u0435\u0440\u0432\u044B\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D.</p>'}</div><button data-action="refresh">\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A</button>\`;
}
document.getElementById('logout').addEventListener('click', () => {
  apiKey = '';
  location.reload();
});
document.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target,
    button = form.querySelector('[type="submit"]');
  button.disabled = true;
  notice('');
  try {
    if (form.id === 'login-form') {
      apiKey = document.getElementById('platform-key').value.trim();
      config = await request('config');
      const templateResponse = await fetch('/api/templates');
      if (!templateResponse.ok) throw new Error('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0448\u0430\u0431\u043B\u043E\u043D\u044B');
      templates = await templateResponse.json();
      document.getElementById('platform-key').value = '';
      await refresh();
    } else if (form.dataset.invoiceStore) {
      const rawAmount = form.elements.amount.value.trim().replace(',', '.');
      if (!/^\\d+(\\.\\d{1,2})?$/.test(rawAmount))
        throw new Error('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u0443\u043C\u043C\u0443 \u0441 \u0442\u043E\u0447\u043D\u043E\u0441\u0442\u044C\u044E \u0434\u043E \u0434\u0432\u0443\u0445 \u0437\u043D\u0430\u043A\u043E\u0432');
      const [whole, fraction = ''] = rawAmount.split('.');
      const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
      if (!Number.isSafeInteger(amountMinor)) throw new Error('\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0441\u0443\u043C\u043C\u0430');
      const result = await request('stores/' + form.dataset.invoiceStore + '/invoices', 'POST', {
        id: form.elements.invoiceId.value,
        amountMinor,
        currency: form.elements.currency.value,
        title: form.elements.title.value,
        description: form.elements.description.value,
      });
      await refresh();
      notice('\u0421\u0447\u0451\u0442 \u0441\u043E\u0437\u0434\u0430\u043D. \u041A\u043B\u0438\u0435\u043D\u0442 \u043C\u043E\u0436\u0435\u0442 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0435\u0433\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u0439 /pay. \u041D\u043E\u043C\u0435\u0440: ' + result.id);
    } else if (form.id === 'create-form') {
      const raw = document.getElementById('new-json').value.trim();
      const input = raw
        ? JSON.parse(raw)
        : {
            templateId: document.getElementById('new-template').value,
            seedProducts: document.getElementById('seed-products').checked,
            name: document.getElementById('new-name').value.trim(),
            slug: document.getElementById('new-slug').value.trim(),
            description: document.getElementById('new-description').value.trim(),
            accentColor: document.getElementById('new-accent').value,
            settings: { currencies: [document.getElementById('new-currency').value] },
          };
      const result = await request('stores', 'POST', input);
      await refresh();
      notice('\u0414\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u044F \u0441\u043E\u0437\u0434\u0430\u043D\u0430: ' + result.url);
    }
  } catch (e) {
    if (form.id === 'login-form') apiKey = '';
    notice(e.message);
  } finally {
    button.disabled = false;
  }
});
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (
    !button.dataset.action &&
    button.dataset.invite === undefined &&
    button.dataset.activate === undefined &&
    button.dataset.export === undefined &&
    button.dataset.edit === undefined &&
    button.dataset.copy === undefined &&
    button.dataset.intake === undefined &&
    button.dataset.reconcile === undefined &&
    button.dataset.deleteDemo === undefined
  )
    return;
  button.disabled = true;
  notice('');
  try {
    if (button.dataset.reconcile !== undefined) {
      const invoice = invoices.find((x) => x.id === button.dataset.reconcile);
      if (!invoice) throw new Error('\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A \u0441\u0447\u0435\u0442\u043E\u0432');
      const remoteUuid = prompt(
        'UUID \u0441\u0447\u0451\u0442\u0430 \u0438\u0437 \u043A\u0430\u0431\u0438\u043D\u0435\u0442\u0430 Tribute (\u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043F\u043E\u0441\u043B\u0435 \u043E\u0431\u0440\u044B\u0432\u0430 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F):',
      );
      if (!remoteUuid) return;
      await request('invoices/' + invoice.id + '/reconcile', 'POST', {
        remoteUuid: remoteUuid.trim(),
      });
      await refresh();
      notice('\u0421\u0442\u0430\u0442\u0443\u0441 \u0441\u0447\u0451\u0442\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0451\u043D.');
    }
    if (button.dataset.action === 'telegram') {
      await request('telegram/setup', 'POST', {});
      notice('\u0411\u043E\u0442 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D. \u041E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0435\u043C\u0443 /start, \u0447\u0442\u043E\u0431\u044B \u0443\u0437\u043D\u0430\u0442\u044C Telegram ID.');
    }
    if (button.dataset.action === 'refresh') await refresh();
    if (button.dataset.invite !== undefined) {
      const i = Number(button.dataset.invite),
        s = stores[i],
        id = document.getElementById('owner-' + i).value.trim();
      if (!/^[1-9]\\d{0,15}$/.test(id)) throw new Error('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0447\u0438\u0441\u043B\u043E\u0432\u043E\u0439 Telegram ID');
      if (
        s.ownerLinked &&
        !confirm(
          '\u041F\u0435\u0440\u0435\u0434\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u043E\u0432\u043E\u043C\u0443 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0443? \u041E\u043D \u043F\u043E\u043B\u0443\u0447\u0438\u0442 \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0443 \u0438 \u0432\u0441\u0435\u0439 \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u044F \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F. \u041F\u0440\u0435\u0436\u043D\u0438\u0439 \u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u043F\u043E\u0442\u0435\u0440\u044F\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F.',
        )
      )
        return;
      const result = await request(\`stores/\${s.id}/invite\`, 'POST', {
        telegramUserId: id,
        transfer: s.ownerLinked,
      });
      const box = document.getElementById('invite-' + i);
      box.replaceChildren();
      const p = document.createElement('p');
      p.textContent = '\u0421\u0441\u044B\u043B\u043A\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 24 \u0447\u0430\u0441\u0430. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0435\u0451 \u0432 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0433\u043E \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430:';
      const a = document.createElement('a');
      a.href = result.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = result.url;
      box.append(p, a);
    }
    if (button.dataset.activate !== undefined) {
      const s = stores[Number(button.dataset.activate)];
      if (!confirm('\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u044B \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435 \xAB' + s.name + '\xBB?')) return;
      const result = await request(\`stores/\${s.id}/activate\`, 'POST', {});
      await refresh();
      notice('\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D: ' + result.url);
    }
    if (button.dataset.edit !== undefined) {
      const s = stores[Number(button.dataset.edit)];
      editorStoreId = s.id;
      main.innerHTML = \`<button data-action="back">\u2190 \u0412\u0441\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u044B</button><iframe id="store-editor" title="\u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430" src="/platform/editor?store=\${s.id}" style="display:block;width:100%;height:1000px;border:0;margin-top:16px;border-radius:16px"></iframe>\`;
    }
    if (button.dataset.action === 'back') {
      editorStoreId = null;
      await refresh();
    }
    if (button.dataset.copy !== undefined) {
      const s = stores[Number(button.dataset.copy)];
      const name = prompt('\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043D\u043E\u0432\u043E\u0433\u043E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430', s.name + ' \u2014 \u043A\u043E\u043F\u0438\u044F');
      if (!name) return;
      const slug = prompt(
        'Slug \u043D\u043E\u0432\u043E\u0433\u043E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430: \u043B\u0430\u0442\u0438\u043D\u0438\u0446\u0430, \u0446\u0438\u0444\u0440\u044B \u0438 \u0434\u0435\u0444\u0438\u0441\u044B',
        s.slug.slice(0, 65) + '-copy',
      );
      if (!slug) return;
      await request(\`stores/\${s.id}/copy\`, 'POST', { name, slug });
      await refresh();
      notice('\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043D\u0430\u0447\u0430\u043B\u043E\u0441\u044C. \u041D\u043E\u0432\u044B\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u043A\u0430\u043A \u0434\u0435\u043C\u043E \u0431\u0435\u0437 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u0438 \u0437\u0430\u043A\u0430\u0437\u043E\u0432.');
    }
    if (button.dataset.intake !== undefined) {
      const s = stores[Number(button.dataset.intake)];
      if (
        !confirm(
          s.acceptingOrders
            ? '\u041F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043D\u043E\u0432\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u044B? \u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0438 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0437\u0430\u043A\u0430\u0437\u044B \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B.'
            : '\u0412\u043E\u0437\u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u0440\u0438\u0451\u043C \u0437\u0430\u043A\u0430\u0437\u043E\u0432?',
        )
      )
        return;
      await request(\`stores/\${s.id}/intake\`, 'POST', {
        enabled: !s.acceptingOrders,
        version: s.version,
      });
      await refresh();
      notice('\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u0440\u0438\u0451\u043C\u0430 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E');
    }
    if (button.dataset.deleteDemo !== undefined) {
      const s = stores[Number(button.dataset.deleteDemo)];
      const confirmSlug = prompt(
        '\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u0435\u043C\u043E \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u0442\u043E\u0432\u0430\u0440\u0430\u043C\u0438 \u0438 \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u044F\u043C\u0438? \u0414\u043B\u044F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u0432\u0432\u0435\u0434\u0438\u0442\u0435: ' + s.slug,
      );
      if (confirmSlug === null) return;
      await request(\`stores/\${s.id}/delete-demo\`, 'POST', { confirmSlug, version: s.version });
      await refresh();
      notice('\u0414\u0435\u043C\u043E \u0443\u0434\u0430\u043B\u0435\u043D\u043E');
    }
    if (button.dataset.export !== undefined) {
      const s = stores[Number(button.dataset.export)],
        data = await request(\`stores/\${s.id}/export\`);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = s.slug + '-export.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    notice(e.message);
  } finally {
    button.disabled = false;
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'new-json') {
    const useJson = !!event.target.value.trim();
    document.getElementById('new-name').required = !useJson;
    document.getElementById('new-slug').required = !useJson;
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id !== 'new-template') return;
  const t = templates.find((t) => t.id === event.target.value);
  document.getElementById('new-description').value = t.description;
  document.getElementById('new-accent').value = t.accentColor;
  document.getElementById('template-description').textContent =
    t.title +
    (t.productCount ? ' \xB7 ' + t.productCount + ' \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u044B\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432' : ' \xB7 \u043F\u0443\u0441\u0442\u043E\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433');
  document.getElementById('template-preview').href = '/templates/' + t.id;
  document.getElementById('seed-products').checked = t.productCount > 0;
  document.getElementById('seed-products').disabled = !t.productCount;
});
`;var Oe=`'use strict';
const tg = window.Telegram?.WebApp;
const platformMode = document.body.dataset.mode === 'platform';
if (document.body.classList.contains('delokay-app')) {
  const applyTheme = () => {
    document.body.dataset.theme =
      tg?.colorScheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  };
  applyTheme();
  tg?.onEvent?.('themeChanged', applyTheme);
}
let platformKey = '';
function emptyStore() {
  document.getElementById('store-name').textContent = '\u0412\u0430\u0448\u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B';
  main.innerHTML = \`<section class="card hero-card"><span class="home-eyebrow">\u0414\u041E\u0411\u0420\u041E \u041F\u041E\u0416\u0410\u041B\u041E\u0412\u0410\u0422\u042C \u0412 DELOKAY</span><h2>\u041D\u0430\u0447\u043D\u0451\u043C \u0441 \u0432\u0430\u0448\u0435\u0433\u043E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430</h2><p>\u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043E\u043D\u043B\u0430\u0439\u043D-\u043A\u0430\u0442\u0430\u043B\u043E\u0433, \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0442\u043E\u0432\u0430\u0440\u044B \u0438 \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0439\u0442\u0435 \u0437\u0430\u043A\u0430\u0437\u044B \u043F\u0440\u044F\u043C\u043E \u0432 Telegram.</p><div class="actions"><button class="primary" data-tab="payments">\u041D\u0430\u0447\u0430\u0442\u044C \u0441 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430 \u2192</button></div></section>
    <div class="section-label">\u0412\u0430\u0448\u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B</div>
    <section class="card"><div class="tool-row"><div class="empty-visual">\u25A6</div><div class="tool-copy"><h3>\u041A\u0430\u0442\u0430\u043B\u043E\u0433\u0438</h3><p>\u041F\u0435\u0440\u0432\u044B\u0439 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 Delokay</p></div><span class="badge">\u0414\u043E\u0441\u0442\u0443\u043F\u0435\u043D</span></div></section>
    <p class="section-caption">\u041F\u043E\u0441\u043B\u0435 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u0430 \u043C\u044B \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043C \u0432\u0430\u043C \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0434\u043B\u044F \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430.</p>\`;
}
function paymentButton(url, label) {
  return \`<button class="primary" data-payment-url="\${esc(url)}">\${esc(label)}</button>\`;
}
async function showPayments(seq) {
  main.innerHTML = '<h2>\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0441\u043B\u0443\u0433</h2><div class="card"><p>\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0434\u0430\u043D\u043D\u044B\u0435 Tribute\u2026</p></div>';
  const [config, purchases] = await Promise.all([api('payments/config'), api('payments')]);
  if (seq !== generation) return;
  const canOrder = config.configured && (config.orderLinkAvailable || config.active);
  const labels = {
    paid: '\u041F\u043E\u043A\u0443\u043F\u043A\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430',
    refund_reported: '\u0412\u043E\u0437\u0432\u0440\u0430\u0442 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D',
    pending: '\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B',
    review: '\u041D\u0443\u0436\u043D\u0430 \u0441\u0432\u0435\u0440\u043A\u0430',
    creating: '\u0421\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F',
  };
  main.innerHTML = \`<div class="row between page-heading"><div><h2>\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0441\u043B\u0443\u0433</h2><p class="section-caption">\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0439\u0442\u0435 \u0443\u0441\u043B\u0443\u0433\u0438 \u0438 \u0441\u043B\u0435\u0434\u0438\u0442\u0435 \u0437\u0430 \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u043C \u043F\u043E\u043A\u0443\u043F\u043E\u043A \u0432 \u043E\u0434\u043D\u043E\u043C \u043C\u0435\u0441\u0442\u0435.</p></div></div><div class="card payment-intro"><h3>\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0441\u0430\u0439\u0442\u0430-\u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430.</h3>
    </div>\${
      config.mode === 'digital'
        ? \`<div class="card payment-offer"><h3>\${esc(config.name || '\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0441\u0430\u0439\u0442\u0430')}</h3>\${config.configured ? \`<p>\${(config.amountMinor / 100).toFixed(2)} \${esc(String(config.currency).toUpperCase())}</p>\` : ''}
    \${config.fulfillmentRequired ? '<p>\u0422\u043E\u0432\u0430\u0440 \u043D\u0430 \u0437\u0430\u043A\u0430\u0437. \u041F\u0440\u043E\u0434\u0430\u0432\u0435\u0446 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0447\u0435\u0440\u0435\u0437 Tribute \u043F\u043E\u0441\u043B\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u0430 \u0438 \u043C\u043E\u0434\u0435\u0440\u0430\u0446\u0438\u0438.</p>' : ''}
    \${canOrder && config.paymentUrl ? paymentButton(config.paymentUrl, config.fulfillmentRequired ? '\u0417\u0430\u043A\u0430\u0437\u0430\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute' : '\u041E\u043F\u043B\u0430\u0442\u0438\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute') : '<p>\u0422\u043E\u0432\u0430\u0440 \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0434\u043B\u044F \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u0430.</p>'}</div>\`
        : ''
    }
    <h3 class="section-label">\u041C\u043E\u0438 \u043F\u043E\u043A\u0443\u043F\u043A\u0438 \u0438 \u0441\u0447\u0435\u0442\u0430</h3>\${purchases.map((p) => \`<div class="card payment-item"><h3 data-no-i18n>\${esc(p.title)}</h3><p>\${(p.amountMinor / 100).toFixed(2)} \${esc(p.currency.toUpperCase())}</p><span class="badge payment-badge">\${esc(labels[p.status] || p.status)}</span>\${p.paymentUrl && p.status === 'pending' ? paymentButton(p.paymentUrl, '\u041E\u043F\u043B\u0430\u0442\u0438\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute') : ''}</div>\`).join('') || '<div class="card empty-panel"><p>\u041F\u043E\u043A\u0443\u043F\u043E\u043A \u0438 \u0441\u0447\u0435\u0442\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.</p></div>'}
    <button data-tab="payments">\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443</button>\`;
}
function moreScreen() {
  main.innerHTML = \`<div class="section-label">\u0412\u0430\u0448\u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B</div><div class="more-list">
    \${store ? '<button class="more-link" data-tab="site" aria-label="\u041C\u043E\u0439 \u0441\u0430\u0439\u0442"><span class="more-icon mint">\u2197</span><span class="more-copy"><strong>\u041C\u043E\u0439 \u0441\u0430\u0439\u0442</strong><small>\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0432\u0430\u0448\u0443 \u0432\u0438\u0442\u0440\u0438\u043D\u0443 \u0438 \u0435\u0451 \u0441\u0442\u0430\u0442\u0443\u0441</small></span><span class="more-chevron">\u203A</span></button>' : ''}
    \${store ? '<button class="more-link" data-tab="settings" aria-label="\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438"><span class="more-icon">\u2699</span><span class="more-copy"><strong>\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</strong><small>\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430, \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u044B \u0438 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0430</small></span><span class="more-chevron">\u203A</span></button>' : ''}
    \${!platformMode ? '<button class="more-link" data-tab="payments" aria-label="\u041E\u043F\u043B\u0430\u0442\u0430"><span class="more-icon mint">\u25A3</span><span class="more-copy"><strong>\u041E\u043F\u043B\u0430\u0442\u0430</strong><small>\u0423\u0441\u043B\u0443\u0433\u0438 Delokay, \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u043E\u043A\u0443\u043F\u043E\u043A \u0438 Tribute</small></span><span class="more-chevron">\u203A</span></button>' : ''}
    </div>
    <div class="section-label">Delokay</div><div class="hint-strip">\u041C\u0435\u043D\u044C\u0448\u0435 \u0440\u0443\u0442\u0438\u043D\u044B. \u0411\u043E\u043B\u044C\u0448\u0435 \u0434\u0435\u043B\u0430. \u2728<br>\u041D\u043E\u0432\u044B\u0435 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0431\u0443\u0434\u0443\u0442 \u043F\u043E\u044F\u0432\u043B\u044F\u0442\u044C\u0441\u044F \u0437\u0434\u0435\u0441\u044C \u043F\u043E \u043C\u0435\u0440\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430.</div>\`;
}
function storeState() {
  return store.status === 'demo'
    ? '\u0414\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u044F'
    : store.acceptingOrders
      ? '\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0430\u043A\u0442\u0438\u0432\u0435\u043D'
      : '\u041F\u0440\u0438\u0451\u043C \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D';
}
const main = document.getElementById('main');
let stores = [],
  store = null,
  products = [],
  orders = [],
  tab = 'home',
  edited = null,
  photos = [],
  orderOffset = 0,
  orderFilter = '',
  generation = 0,
  productQuery = '',
  productCategory = '';
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const statusNames = {
  new: '\u041D\u043E\u0432\u044B\u0439',
  processing: '\u0412 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0435',
  completed: '\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D',
  cancelled: '\u041E\u0442\u043C\u0435\u043D\u0451\u043D',
};
function notice(msg) {
  const el = document.getElementById('notice');
  el.textContent = msg;
  el.hidden = !msg;
}
async function api(path, method = 'GET', data, contentType = 'application/json') {
  const r = await fetch('/api/' + (platformMode ? 'platform' : 'admin') + '/' + path, {
    method,
    headers: {
      Authorization: platformMode ? 'Bearer ' + platformKey : 'tma ' + tg.initData,
      ...(data !== undefined ? { 'Content-Type': contentType } : {}),
    },
    body:
      data === undefined
        ? undefined
        : contentType === 'application/json'
          ? JSON.stringify(data)
          : data,
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441');
  return result;
}
const base = () => \`stores/\${store.id}\`;
const siteUrl = () =>
  location.origin + \`/\${store.status === 'demo' ? 'demo' : 'shop'}/\${store.slug}\`;
function money(p) {
  return Object.entries(p.prices)
    .filter(([c]) => store.settings.currencies.includes(c))
    .map(([c, v]) => (v / 100).toLocaleString(window.DelokayI18n?.locale() || 'ru-RU') + ' ' + c)
    .join(' / ');
}
function stockSummary(p) {
  return \`<span class="stock-summary" role="list" aria-label="\u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u043F\u043E \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430\u043C">\${p.variants
    .map(
      (v) =>
        \`<span class="stock-item\${v.stock === 0 ? ' stock-empty' : ''}" role="listitem"><span>\${esc(v.label)}</span><strong>\${v.stock === null ? '\u0411\u0435\u0437 \u043B\u0438\u043C\u0438\u0442\u0430' : v.stock + ' \u0448\u0442.'}</strong></span>\`,
    )
    .join('')}</span>\`;
}

function drawProductRows() {
  const target = document.getElementById('product-results');
  if (!target) return;
  const query = productQuery.trim().toLocaleLowerCase();
  const visible = products
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        (!productCategory || p.category === productCategory) &&
        (!query ||
          [p.name, p.category, p.brand, p.sku].some((x) =>
            String(x || '')
              .toLocaleLowerCase()
              .includes(query),
          )),
    );
  target.innerHTML =
    visible
      .map(
        ({ p, i }) => \`<button class="card product product-row" data-edit="\${i}">
    \${p.photos[0] ? \`<img src="\${esc(p.photos[0])}" alt="" loading="lazy">\` : '<span class="product-placeholder" aria-hidden="true">\u25A6</span>'}
    <span class="info"><h3 class="product-title" data-no-i18n>\${esc(p.name)}</h3>
    <span class="product-meta" data-no-i18n>\${esc(p.category)} \xB7 \${esc(money(p))}</span>
    <span class="badge availability-\${esc(p.availability)}">\${{ available: '\u0412 \u043D\u0430\u043B\u0438\u0447\u0438\u0438', preorder: '\u041D\u0430 \u0437\u0430\u043A\u0430\u0437', unavailable: '\u041D\u0435\u0442 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438' }[p.availability]}</span>
    \${stockSummary(p)}</span><span class="product-chevron" aria-hidden="true">\u203A</span></button>\`,
      )
      .join('') ||
    \`<div class="card empty-panel"><div class="empty-visual">\u2315</div><h3>\${products.length ? '\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E' : '\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0442\u043E\u0432\u0430\u0440\u043E\u0432'}</h3>
    <p>\${products.length ? '\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0438\u043B\u0438 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E.' : '\u0412\u0430\u0448 \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u043D\u0430\u0447\u043D\u0451\u0442\u0441\u044F \u0441 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0442\u043E\u0432\u0430\u0440\u0430. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0444\u043E\u0442\u043E, \u0446\u0435\u043D\u0443 \u0438 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435.'}</p>
    \${products.length ? '<button data-action="clear-search">\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u043F\u043E\u0438\u0441\u043A</button>' : '<button class="primary" data-action="add">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440</button>'}</div>\`;
}
function renderProductsList() {
  const categories = [...new Set(products.map((p) => p.category))].sort((a, b) =>
    a.localeCompare(b),
  );
  main.innerHTML = \`<div class="row between page-heading"><div><h2>\u0422\u043E\u0432\u0430\u0440\u044B \xB7 \${products.length}</h2>
    <p class="section-caption">\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u043C</p></div><button class="primary" data-action="add">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C</button></div>
    <div class="product-toolbar"><label class="visually-hidden" for="product-search">\u041F\u043E\u0438\u0441\u043A \u0442\u043E\u0432\u0430\u0440\u043E\u0432</label>
      <input id="product-search" type="search" autocomplete="off" placeholder="\u041D\u0430\u0439\u0442\u0438 \u0442\u043E\u0432\u0430\u0440\u2026" value="\${esc(productQuery)}">
      <label class="visually-hidden" for="product-category">\u0412\u0441\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u0442\u043E\u0432\u0430\u0440\u043E\u0432</label>
      <select id="product-category" aria-label="\u0412\u0441\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u0442\u043E\u0432\u0430\u0440\u043E\u0432"><option value="">\u0412\u0441\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438</option>
      \${categories.map((c) => \`<option value="\${esc(c)}" \${c === productCategory ? 'selected' : ''}>\${esc(c)}</option>\`).join('')}</select></div>
    <div id="product-results" class="stack"></div>\`;
  drawProductRows();
}
function renderOrdersList() {
  main.innerHTML = \`<div class="row between page-heading"><div><h2>\u0417\u0430\u043A\u0430\u0437\u044B</h2><p class="section-caption">\u0417\u0430\u043A\u0430\u0437\u044B \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432</p></div></div>
    <div class="order-filter-row"><label for="order-filter">\u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043A\u0430\u0437\u043E\u0432</label>
      <select id="order-filter"><option value="">\u0412\u0441\u0435</option>
      \${Object.entries(statusNames)
        .map(
          ([k, v]) => \`<option value="\${k}" \${k === orderFilter ? 'selected' : ''}>\${v}</option>\`,
        )
        .join('')}</select></div>
    <div class="stack">\${
      orders
        .map(
          (o, i) => \`<button class="card product order-row" data-order="\${i}">
      <span class="order-symbol">\u25A4</span><span class="info">
      <h3 class="product-title">\u2116\${o.number} \xB7 <span data-no-i18n>\${esc(o.customer.name)}</span></h3>
      <span class="product-meta">\${(o.totalMinor / 100).toLocaleString(window.DelokayI18n?.locale() || 'ru-RU')} \${esc(o.currency)} \xB7 \${new Date(o.createdAt * 1000).toLocaleDateString(window.DelokayI18n?.locale() || 'ru-RU')}</span>
      <span class="badge order-\${esc(o.status)}">\${statusNames[o.status]}</span></span>
      <span class="product-chevron">\u203A</span></button>\`,
        )
        .join('') ||
      \`<div class="card empty-panel"><div class="empty-visual">\u25A4</div>
      <h3>\${orderFilter ? '\u041D\u0435\u0442 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u043E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C\u0443 \u0441\u0442\u0430\u0442\u0443\u0441\u0443' : '\u0417\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.'}</h3>
      <p>\${orderFilter ? '\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0434\u0440\u0443\u0433\u043E\u0439 \u0441\u0442\u0430\u0442\u0443\u0441.' : '\u041D\u043E\u0432\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u044B \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C \u0438 \u0432 Telegram.'}</p></div>\`
    }</div>
    <div class="actions pagination"><button data-page="prev" \${orderOffset === 0 ? 'disabled' : ''}>\u041D\u0430\u0437\u0430\u0434</button>
    <button data-page="next" \${orders.length < 50 ? 'disabled' : ''}>\u0414\u0430\u043B\u0435\u0435</button></div>\`;
}

async function reload() {
  const id = store.id;
  const [next, ps] = await Promise.all([api(\`stores/\${id}\`), api(\`stores/\${id}/products\`)]);
  if (store.id !== id) return;
  store = next;
  products = ps;
  document.getElementById('store-name').textContent = store.name;
}
async function show(next = tab) {
  tab = next;
  edited = null;
  notice('');
  const selectedNav = ['settings', 'site', 'payments'].includes(tab) ? 'more' : tab;
  document
    .querySelectorAll('#nav [data-tab]')
    .forEach((b) => b.classList.toggle('active', b.dataset.tab === selectedNav));
  const seq = ++generation;
  try {
    if (tab === 'payments' && !platformMode) {
      await showPayments(seq);
    } else if (tab === 'more') {
      moreScreen();
    } else if (!store) {
      emptyStore();
    } else if (tab === 'home') {
      await reload();
      if (seq !== generation) return;
      main.innerHTML = \`<section class="card hero-card">
      <span class="home-eyebrow">DELOKAY \xB7 \u041A\u0410\u0422\u0410\u041B\u041E\u0413\u0418</span>
      <h2>\u0412\u0441\u0451 \u043F\u043E\u0434 \u0440\u0443\u043A\u043E\u0439</h2>
      <p>\u0422\u043E\u0432\u0430\u0440\u044B, \u0437\u0430\u043A\u0430\u0437\u044B \u0438 \u0432\u0430\u0448 \u0441\u0430\u0439\u0442 \u0432 \u043E\u0434\u043D\u043E\u043C \u0443\u0434\u043E\u0431\u043D\u043E\u043C \u043C\u0435\u0441\u0442\u0435. \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u043E\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043D\u0430 \u0432\u0438\u0442\u0440\u0438\u043D\u0435 \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.</p>
      <div class="actions"><button class="primary" data-action="add">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440</button></div>
    </section>
    <div class="section-label">\u041E\u0431\u0437\u043E\u0440 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430</div>
    <div class="stats">
      <div class="card"><div class="stat-symbol">\u25A6</div><div class="stat">\${store.stats.productCount}</div><p>\u0422\u043E\u0432\u0430\u0440\u043E\u0432</p></div>
      <div class="card"><div class="stat-symbol mint">\u25A4</div><div class="stat">\${store.stats.newOrderCount}</div><p>\u041D\u043E\u0432\u044B\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432</p></div>
    </div>
    <div class="section-label">\u0411\u044B\u0441\u0442\u0440\u044B\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F</div>
    <div class="quick-grid">
      <button class="quick-action" data-tab="products"><span class="quick-icon">\u25A6</span><span>\u0412\u0441\u0435 \u0442\u043E\u0432\u0430\u0440\u044B \u2192</span></button>
      <button class="quick-action" data-tab="orders"><span class="quick-icon mint">\u25A4</span><span>\u041F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0437\u0430\u043A\u0430\u0437\u044B \u2192</span></button>
    </div>
    <div class="section-label">\u0412\u0430\u0448 \u0441\u0430\u0439\u0442</div>
    <div class="card"><div class="status-row"><span class="status-indicator"></span><div><h3>\${storeState()}</h3><p class="muted">\${store.status === 'demo' ? '\u0417\u0430\u043A\u0430\u0437\u044B \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B \u0432 \u0434\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435.' : '\u041D\u043E\u0432\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u044B \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C \u0438 \u0432 Telegram.'}</p><a href="\${esc(siteUrl())}" target="_blank" rel="noopener">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432\u0438\u0442\u0440\u0438\u043D\u0443 \u2197</a></div></div></div>\`;
    } else if (tab === 'products') {
      await reload();
      if (seq !== generation) return;
      renderProductsList();
    } else if (tab === 'orders') {
      orders = await api(base() + \`/orders?offset=\${orderOffset}&status=\${orderFilter}\`);
      if (seq !== generation) return;
      renderOrdersList();
    } else if (tab === 'settings') renderSettings();
    else if (tab === 'site')
      main.innerHTML = \`<div class="row between page-heading"><div><h2>\u041C\u043E\u0439 \u0441\u0430\u0439\u0442</h2><p class="section-caption">\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0432\u0438\u0442\u0440\u0438\u043D\u0443</p></div></div>
        <div class="card site-overview"><div class="row between"><h3 data-no-i18n>\${esc(store.name)}</h3><span class="badge">\${storeState()}</span></div>
        <p class="section-caption">\${store.status === 'demo' ? '\u0417\u0430\u043A\u0430\u0437\u044B \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B \u0432 \u0434\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435.' : '\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0433\u043E\u0442\u043E\u0432 \u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F \u0441 \u043A\u043B\u0438\u0435\u043D\u0442\u0430\u043C\u0438.'}</p>
        <div class="site-link" data-no-i18n>\${esc(siteUrl())}</div>
        <div class="actions"><button class="primary" data-action="copy">\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443</button><a class="site-open-link" href="\${esc(siteUrl())}" target="_blank" rel="noopener">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432\u0438\u0442\u0440\u0438\u043D\u0443 \u2197</a></div></div>\`;
  } catch (e) {
    if (seq !== generation) return;
    notice(e.message);
    if (tab === 'payments')
      main.innerHTML =
        '<h2>\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0441\u043B\u0443\u0433</h2><p>\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.</p><button data-tab="payments">\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443</button>';
  }
}
function field(key, label, value = '', type = 'text', required = false) {
  return \`<label for="\${key}">\${label}</label><input id="\${key}" name="\${key}" type="\${type}" value="\${esc(value)}" \${required ? 'required' : ''}>\`;
}
function variantRow(v = { label: '', stock: null }) {
  return \`<div class="variant" \${v.id ? \`data-id="\${v.id}"\` : ''}><input class="variant-label" aria-label="\u0420\u0430\u0437\u043C\u0435\u0440, \u0446\u0432\u0435\u0442 \u0438\u043B\u0438 \u0432\u0430\u0440\u0438\u0430\u043D\u0442" placeholder="\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: M / \u041A\u0440\u0430\u0441\u043D\u044B\u0439" value="\${esc(v.label)}" required maxlength="80"><input class="variant-stock" aria-label="\u041E\u0441\u0442\u0430\u0442\u043E\u043A" type="number" min="0" max="1000000" step="1" placeholder="\u221E" value="\${v.stock ?? ''}"><button type="button" data-remove-variant aria-label="\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0430\u0440\u0438\u0430\u043D\u0442">\xD7</button></div>\`;
}
function renderPhotos() {
  document.getElementById('photos').innerHTML = photos
    .map(
      (url, i) =>
        \`<button type="button" data-remove-photo="\${i}" aria-label="\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0444\u043E\u0442\u043E"><img class="thumb" src="\${esc(url)}" alt="\u0424\u043E\u0442\u043E \${i + 1}"> \xD7</button>\`,
    )
    .join('');
}
function editProduct(index) {
  edited = index === undefined ? null : products[index];
  photos = [...(edited?.photos || [])];
  const p = edited || {};
  main.innerHTML = \`<div class="row between page-heading"><div><h2>\${edited ? '\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0442\u043E\u0432\u0430\u0440' : '\u041D\u043E\u0432\u044B\u0439 \u0442\u043E\u0432\u0430\u0440'}</h2><p class="section-caption">\u0426\u0435\u043D\u044B, \u0444\u043E\u0442\u043E \u0438 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u0442\u043E\u0432\u0430\u0440\u0430</p></div><button data-tab="products">\u0417\u0430\u043A\u0440\u044B\u0442\u044C</button></div><form id="product-form"><div class="card"><h3 class="form-section-heading">\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F</h3><div id="photos" class="photo-row"></div><label for="photo-upload">\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438 (\u0434\u043E 8)</label><input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple>\${field('name', '\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435', p.name, 'text', true)}\${field('category', '\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F', p.category || '\u041F\u0440\u043E\u0447\u0435\u0435', 'text', true)}<datalist id="categories">\${[...new Set(products.map((p) => p.category))].map((c) => \`<option value="\${esc(c)}">\`).join('')}</datalist><label for="description">\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435</label><textarea id="description">\${esc(p.description || '')}</textarea></div><div class="card"><h3 class="form-section-heading">\u0426\u0435\u043D\u044B \u0438 \u043E\u0441\u0442\u0430\u0442\u043A\u0438</h3>
 \${store.settings.currencies.map((c) => field('price-' + c, '\u0426\u0435\u043D\u0430, ' + c, (p.prices?.[c] ?? 0) / 100, 'number', true)).join('')}
 <details><summary>\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0432\u0430\u043B\u044E\u0442\u044B \u0438 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438</summary>\${[
   'BYN',
   'RUB',
   'KZT',
   'USD',
   'EUR',
 ]
   .filter((c) => !store.settings.currencies.includes(c))
   .map((c) =>
     field(
       'price-' + c,
       '\u0426\u0435\u043D\u0430, ' + c,
       p.prices?.[c] === undefined ? '' : p.prices[c] / 100,
       'number',
     ),
   )
   .join(
     '',
   )}\${field('brand', '\u0411\u0440\u0435\u043D\u0434', p.brand ?? p.team)}\${field('color', '\u0426\u0432\u0435\u0442', p.color)}\${field('collection', '\u041A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F', p.collection ?? p.year)}\${field('sku', '\u0410\u0440\u0442\u0438\u043A\u0443\u043B', p.sku ?? p.number)}<label for="attributes">\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 (\u0434\u043E 12, \u043F\u043E \u043E\u0434\u043D\u043E\u0439 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0435)</label><textarea id="attributes" placeholder="\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B: \u0445\u043B\u043E\u043F\u043E\u043A&#10;\u041E\u0431\u044A\u0451\u043C: 100 \u043C\u043B">\${esc((p.attributes || []).map((a) => a.label + ': ' + a.value).join('\\n'))}</textarea></details>
 \${field('discount', '\u0421\u043A\u0438\u0434\u043A\u0430, %', p.discountPercent || 0, 'number')}<label for="availability">\u041D\u0430\u043B\u0438\u0447\u0438\u0435</label><select id="availability">\${[
   ['available', '\u0412 \u043D\u0430\u043B\u0438\u0447\u0438\u0438'],
   ['preorder', '\u041D\u0430 \u0437\u0430\u043A\u0430\u0437'],
   ['unavailable', '\u041D\u0435\u0442 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438'],
 ]
   .map(([k, v]) => \`<option value="\${k}" \${k === p.availability ? 'selected' : ''}>\${v}</option>\`)
   .join(
     '',
   )}</select></div><div class="card"><h3>\u0412\u0430\u0440\u0438\u0430\u043D\u0442\u044B</h3><p>\u0420\u0430\u0437\u043C\u0435\u0440, \u0446\u0432\u0435\u0442 \u0438\u043B\u0438 \u043C\u043E\u0434\u0435\u043B\u044C. \u0415\u0441\u043B\u0438 \u0432\u044B\u0431\u043E\u0440\u0430 \u043D\u0435\u0442, \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \xAB\u0411\u0435\u0437 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432\xBB. \u041F\u0443\u0441\u0442\u043E\u0439 \u043E\u0441\u0442\u0430\u0442\u043E\u043A \u043E\u0437\u043D\u0430\u0447\u0430\u0435\u0442 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F.</p><div id="variants">\${(p.variants || [{ label: '\u0411\u0435\u0437 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432', stock: null }]).map(variantRow).join('')}</div><button type="button" data-action="variant">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u0430\u0440\u0438\u0430\u043D\u0442</button></div><div class="actions form-actions"><button class="primary" type="submit">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440</button>\${edited ? '<button type="button" class="danger" data-action="delete">\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440</button>' : ''}</div></form>\`;
  document.getElementById('category').setAttribute('list', 'categories');
  document.querySelectorAll('[id^="price-"]').forEach((el) => {
    el.min = '0';
    el.max = '1000000';
    el.step = '.01';
  });
  document.getElementById('discount').min = '0';
  document.getElementById('discount').max = '99';
  document.getElementById('discount').step = '1';
  renderPhotos();
}
function renderSettings() {
  const s = store.settings;
  main.innerHTML = \`<h2>\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</h2><p class="section-caption">\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u043C</p><form id="settings-form"><div class="card"><h3 class="form-section-heading">\u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435</h3>\${field('store-title', '\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430', store.name, 'text', true)}\${field('hero-title', '\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0432\u0438\u0442\u0440\u0438\u043D\u044B', s.heroTitle)}<label for="store-description">\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430</label><textarea id="store-description">\${esc(s.description)}</textarea></div><div class="card"><h3 class="form-section-heading">\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435</h3><label for="theme">\u0428\u0430\u0431\u043B\u043E\u043D \u0432\u0438\u0442\u0440\u0438\u043D\u044B</label><select id="theme">\${[
    ['minimal', '\u0423\u043D\u0438\u0432\u0435\u0440\u0441\u0430\u043B\u044C\u043D\u044B\u0439'],
    ['fashion', '\u041E\u0434\u0435\u0436\u0434\u0430 \u0438 \u0430\u043A\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044B'],
    ['home', '\u0414\u043E\u043C \u0438 \u0434\u0435\u043A\u043E\u0440'],
    ['beauty', '\u041A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0430 \u0438 \u0443\u0445\u043E\u0434'],
  ]
    .map(
      ([k, label]) =>
        \`<option value="\${k}" \${k === (s.theme || 'minimal') ? 'selected' : ''}>\${label}</option>\`,
    )
    .join(
      '',
    )}</select><p>\u041C\u0435\u043D\u044F\u0435\u0442 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435. \u0422\u043E\u0432\u0430\u0440\u044B \u0438 \u0446\u0435\u043D\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F; \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0446\u0432\u0435\u0442 \u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432 \u043C\u043E\u0436\u043D\u043E \u043D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u043D\u0438\u0436\u0435.</p>\${field('accent', '\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0446\u0432\u0435\u0442', s.accentColor, 'color')}\${field('logo', '\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u043B\u043E\u0433\u043E\u0442\u0438\u043F', s.logo)}<label for="logo-upload">\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043B\u043E\u0433\u043E\u0442\u0438\u043F</label><input id="logo-upload" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="card"><h3 class="form-section-heading">\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B</h3>\${field('whatsapp', 'WhatsApp: \u043D\u043E\u043C\u0435\u0440 \u0441 \u043A\u043E\u0434\u043E\u043C \u0441\u0442\u0440\u0430\u043D\u044B, \u0442\u043E\u043B\u044C\u043A\u043E \u0446\u0438\u0444\u0440\u044B', s.whatsapp)}\${field('telegram', 'Telegram username \u0431\u0435\u0437 @', s.telegram)}\${field('instagram', 'Instagram username \u0431\u0435\u0437 @', s.instagram)}</div><div class="card"><h3 class="form-section-heading">\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430 \u0438 \u043E\u043F\u043B\u0430\u0442\u0430</h3><label for="currencies">\u0412\u0430\u043B\u044E\u0442\u044B (1 \u0438\u043B\u0438 2, \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E)</label><input id="currencies" value="\${esc(s.currencies.join(', '))}" required><p>BYN, RUB, KZT, USD, EUR. \u041F\u0435\u0440\u0435\u0434 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C \u043D\u043E\u0432\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u044B \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0446\u0435\u043D\u044B \u0432 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432.</p><label for="delivery">\u0421\u043F\u043E\u0441\u043E\u0431\u044B \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438 (\u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0435)</label><textarea id="delivery" required>\${esc(s.deliveryMethods.join('\\n'))}</textarea><label for="delivery-hint">\u0423\u0441\u043B\u043E\u0432\u0438\u044F \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438</label><textarea id="delivery-hint">\${esc(s.deliveryHint)}</textarea>\${field('footer', '\u0422\u0435\u043A\u0441\u0442 \u0432\u043D\u0438\u0437\u0443 \u0441\u0430\u0439\u0442\u0430', s.footerText)}<details><summary>\u0422\u0435\u043A\u0441\u0442\u044B \u043A\u043D\u043E\u043F\u043E\u043A \u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u0435\u0439</summary>\${[
    ['btn_cart', '\u041A\u043D\u043E\u043F\u043A\u0430 \u043A\u043E\u0440\u0437\u0438\u043D\u044B'],
    ['btn_add', '\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443'],
    ['label_size', '\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432'],
    ['filter_all', '\u0412\u0441\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438'],
    ['support_label', '\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u043A \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0430\u043C'],
  ]
    .map(([k, label]) => field('text-' + k, label, s.texts[k] || ''))
    .join(
      '',
    )}</details></div><div class="actions form-actions"><button class="primary" type="submit">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</button></div></form>\`;
}
function showOrder(o) {
  const c = o.customer;
  const buttons = {
    new: [
      ['processing', '\u041F\u0440\u0438\u043D\u044F\u0442\u044C'],
      ['completed', '\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D'],
      ['cancelled', '\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C'],
    ],
    processing: [
      ['completed', '\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D'],
      ['cancelled', '\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C'],
    ],
    completed: [],
    cancelled: [],
  };
  const locale = window.DelokayI18n?.locale() || 'ru-RU';
  main.innerHTML = \`<div class="row between page-heading"><div><h2>\u0417\u0430\u043A\u0430\u0437 \u2116\${o.number}</h2><p class="section-caption">\u0418\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F \u043E \u0437\u0430\u043A\u0430\u0437\u0435</p></div><button data-tab="orders">\u041D\u0430\u0437\u0430\u0434</button></div>
    <section class="card"><div class="row between"><h3>\u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043A\u0430\u0437\u043E\u0432</h3><span class="badge order-\${esc(o.status)}">\${statusNames[o.status]}</span></div>
      <div class="order-total">\${(o.totalMinor / 100).toLocaleString(locale)} \${esc(o.currency)}</div>
      <p class="section-caption">\${new Date(o.createdAt * 1000).toLocaleString(locale)}</p></section>
    <section class="card"><h3 class="form-section-heading">\u041A\u043B\u0438\u0435\u043D\u0442</h3>
      <div class="order-customer" data-no-i18n><strong>\${esc(c.name)}</strong><p>\${esc(c.phone)}</p>
      <p>\${esc(c.deliveryMethod)}<br>\${esc(c.address)}<br>\${esc([c.city, c.region, c.index].filter(Boolean).join(', '))}</p>
      \${c.comment ? \`<p>\${esc(c.comment)}</p>\` : ''}</div></section>
    <section class="card"><h3 class="form-section-heading">\u0421\u043E\u0441\u0442\u0430\u0432 \u0437\u0430\u043A\u0430\u0437\u0430</h3>
      <ul class="order-lines">\${o.items.map((i) => \`<li><strong data-no-i18n>\${esc(i.name)}</strong><span class="muted" data-no-i18n>\${esc(i.variant)}</span><span>\${i.quantity} \xD7 \${(i.unitMinor / 100).toLocaleString(locale)} \${esc(o.currency)}</span></li>\`).join('')}</ul>
      <div class="row between order-summary"><strong>\u0418\u0442\u043E\u0433\u043E</strong><strong>\${(o.totalMinor / 100).toLocaleString(locale)} \${esc(o.currency)}</strong></div></section>
    \${buttons[o.status].length ? \`<div class="actions order-actions">\${buttons[o.status].map(([status, label]) => \`<button data-status="\${status}" data-order-id="\${o.id}" class="\${status === 'cancelled' ? 'danger' : 'primary'}">\${label}</button>\`).join('')}</div>\` : ''}\`;
}
async function uploadImage(file) {
  if (
    !file ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error('\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 JPEG, PNG \u0438\u043B\u0438 WebP \u0434\u043E 20 \u041C\u0411');
  // Resize before upload to keep R2 storage and mobile traffic small.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob || blob.size > 3 * 1024 * 1024) throw new Error('\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0435');
  // WebKit can fall back to PNG when its canvas encoder does not support WebP.
  // Use the actual Blob type so the server's signature validation still matches.
  return (await api(base() + '/images', 'POST', blob, blob.type)).url;
}
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  try {
    if (button.dataset.paymentUrl) {
      const url = new URL(button.dataset.paymentUrl);
      if (
        url.protocol !== 'https:' ||
        !(
          url.hostname === 't.me' ||
          url.hostname === 'tribute.tg' ||
          url.hostname.endsWith('.tribute.tg')
        )
      )
        throw new Error('\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430 \u043E\u043F\u043B\u0430\u0442\u044B');
      if (url.hostname === 't.me' && tg?.openTelegramLink) tg.openTelegramLink(url.href);
      else if (tg?.openLink) tg.openLink(url.href);
      else window.open(url.href, '_blank', 'noopener');
      return;
    }
    if (button.dataset.tab) {
      orderOffset = 0;
      await show(button.dataset.tab);
      return;
    }
    if (button.dataset.edit !== undefined) {
      editProduct(Number(button.dataset.edit));
      return;
    }
    if (button.dataset.order !== undefined) {
      showOrder(orders[Number(button.dataset.order)]);
      return;
    }
    if (button.dataset.removePhoto !== undefined) {
      photos.splice(Number(button.dataset.removePhoto), 1);
      renderPhotos();
      return;
    }
    if (button.hasAttribute('data-remove-variant')) {
      if (document.querySelectorAll('.variant').length > 1) button.closest('.variant').remove();
      else notice('\u041E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u0438\u043D \u0432\u0430\u0440\u0438\u0430\u043D\u0442');
      return;
    }
    if (button.dataset.page) {
      orderOffset = Math.max(0, orderOffset + (button.dataset.page === 'next' ? 50 : -50));
      await show('orders');
      return;
    }
    if (button.dataset.status) {
      button.disabled = true;
      await api(base() + '/orders/' + button.dataset.orderId, 'PATCH', {
        status: button.dataset.status,
      });
      showOrder(await api(base() + '/orders/' + button.dataset.orderId));
      notice('\u0421\u0442\u0430\u0442\u0443\u0441 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D');
      return;
    }
    if (button.dataset.action === 'add') editProduct();
    if (button.dataset.action === 'clear-search') {
      productQuery = '';
      productCategory = '';
      renderProductsList();
    }
    if (button.dataset.action === 'variant') {
      if (document.querySelectorAll('.variant').length >= 30)
        throw new Error('\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 30 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432');
      document.getElementById('variants').insertAdjacentHTML('beforeend', variantRow());
    }
    if (button.dataset.action === 'copy') {
      await navigator.clipboard.writeText(siteUrl());
      notice('\u0421\u0441\u044B\u043B\u043A\u0430 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0430');
    }
    if (button.dataset.action === 'delete') {
      const ok = tg?.showConfirm
        ? await new Promise((resolve) => tg.showConfirm('\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440 \u0438\u0437 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430?', resolve))
        : confirm('\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440?');
      if (!ok) return;
      button.disabled = true;
      await api(base() + '/products/' + edited.id, 'DELETE', { version: edited.version });
      await show('products');
      notice('\u0422\u043E\u0432\u0430\u0440 \u0443\u0434\u0430\u043B\u0451\u043D');
    }
  } catch (e) {
    button.disabled = false;
    notice(e.message);
  }
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'product-search') {
    productQuery = event.target.value;
    drawProductRows();
  }
});
document.addEventListener('change', async (event) => {
  const el = event.target;
  try {
    if (el.id === 'store-picker') {
      store = stores.find((s) => s.id === el.value);
      generation++;
      orderOffset = 0;
      await show('home');
    }
    if (el.id === 'product-category') {
      productCategory = el.value;
      drawProductRows();
    }
    if (el.id === 'order-filter') {
      orderFilter = el.value;
      orderOffset = 0;
      await show('orders');
    }
    if (el.id === 'photo-upload') {
      if (photos.length + el.files.length > 8) throw new Error('\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 8 \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0439');
      const save = document.querySelector('#product-form [type=submit]');
      save.disabled = true;
      notice('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438\u2026');
      try {
        for (const file of el.files) photos.push(await uploadImage(file));
        renderPhotos();
        notice('\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u044B');
      } finally {
        save.disabled = false;
      }
    }
    if (el.id === 'logo-upload') {
      const save = document.querySelector('#settings-form [type=submit]');
      save.disabled = true;
      notice('\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043B\u043E\u0433\u043E\u0442\u0438\u043F\u2026');
      try {
        document.getElementById('logo').value = await uploadImage(el.files[0]);
        notice('\u041B\u043E\u0433\u043E\u0442\u0438\u043F \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438.');
      } finally {
        save.disabled = false;
      }
    }
  } catch (e) {
    notice(e.message);
  }
});
document.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target,
    button = form.querySelector('[type=submit]');
  button.disabled = true;
  notice('');
  const val = (id) => document.getElementById(id).value.trim();
  try {
    if (form.id === 'product-form') {
      const prices = {};
      for (const c of ['BYN', 'RUB', 'KZT', 'USD', 'EUR']) {
        const raw = val('price-' + c);
        if (raw !== '') prices[c] = Math.round(Number(raw) * 100);
      }
      const data = {
        name: val('name'),
        category: val('category'),
        description: val('description'),
        brand: val('brand'),
        collection: val('collection'),
        sku: val('sku'),
        attributes: val('attributes')
          .split('\\n')
          .filter((line) => line.trim())
          .map((line) => {
            const separator = line.indexOf(':');
            if (separator < 1 || !line.slice(separator + 1).trim())
              throw new Error('\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438: \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0444\u043E\u0440\u043C\u0430\u0442 \xAB\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435: \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\xBB');
            return {
              label: line.slice(0, separator).trim(),
              value: line.slice(separator + 1).trim(),
            };
          }),
        color: val('color'),
        availability: val('availability'),
        discountPercent: Number(val('discount')),
        photos,
        prices,
        variants: [...document.querySelectorAll('.variant')].map((row) => ({
          ...(row.dataset.id ? { id: row.dataset.id } : {}),
          label: row.querySelector('.variant-label').value.trim(),
          stock:
            row.querySelector('.variant-stock').value === ''
              ? null
              : Number(row.querySelector('.variant-stock').value),
        })),
      };
      if (edited) data.version = edited.version;
      await api(
        base() + '/products' + (edited ? '/' + edited.id : ''),
        edited ? 'PUT' : 'POST',
        data,
      );
      await show('products');
      notice('\u0422\u043E\u0432\u0430\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D');
    } else if (form.id === 'settings-form') {
      const s = {
        ...store.settings,
        heroTitle: val('hero-title'),
        description: val('store-description'),
        theme: val('theme'),
        accentColor: val('accent'),
        logo: val('logo'),
        whatsapp: val('whatsapp'),
        telegram: val('telegram'),
        instagram: val('instagram'),
        currencies: val('currencies')
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
        deliveryMethods: val('delivery')
          .split('\\n')
          .map((s) => s.trim())
          .filter(Boolean),
        deliveryHint: val('delivery-hint'),
        footerText: val('footer'),
        texts: { ...store.settings.texts },
      };
      for (const el of document.querySelectorAll('[id^=text-]')) {
        if (el.value.trim()) s.texts[el.id.slice(5)] = el.value.trim();
        else delete s.texts[el.id.slice(5)];
      }
      await api(base() + '/settings', 'PUT', {
        name: val('store-title'),
        settings: s,
        version: store.version,
      });
      await reload();
      await show('settings');
      notice('\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B');
    }
  } catch (e) {
    notice(e.message);
  } finally {
    button.disabled = false;
  }
});
(async () => {
  if (platformMode) {
    if (window.parent === window) {
      main.innerHTML = '<p>\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u0438\u0437 <a href="/platform">\u043F\u0430\u043D\u0435\u043B\u0438 \u0444\u0430\u0431\u0440\u0438\u043A\u0438</a>.</p>';
      document.getElementById('nav').hidden = true;
      return;
    }
    platformKey = await new Promise((resolve) => {
      const listener = (event) => {
        if (
          event.origin !== location.origin ||
          event.source !== window.parent ||
          event.data?.type !== 'catalog-platform-key'
        )
          return;
        window.removeEventListener('message', listener);
        resolve(event.data.key);
      };
      window.addEventListener('message', listener);
      window.parent.postMessage({ type: 'catalog-editor-ready' }, location.origin);
    });
  }
  if (!platformMode && !tg?.initData) {
    document.getElementById('store-name').textContent = '\u041C\u043E\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D';
    main.innerHTML =
      '<div class="card"><h2>\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C \u0432 Telegram</h2><p>\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u0423\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u043C\xBB \u0432 \u043B\u0438\u0447\u043D\u043E\u043C \u0447\u0430\u0442\u0435 \u0441 \u0431\u043E\u0442\u043E\u043C.</p></div>';
    document.getElementById('nav').hidden = true;
    return;
  }
  if (!platformMode) {
    tg.ready();
    tg.expand();
  }
  try {
    stores = await api('stores');
    const params = new URLSearchParams(location.search);
    if (!platformMode && params.get('tab') === 'payments') tab = 'payments';
    if (!stores.length) {
      document.getElementById('store-name').textContent = '\u041C\u043E\u0439 \u043A\u0430\u0431\u0438\u043D\u0435\u0442';
      document.querySelectorAll('#nav [data-tab]').forEach((button) => {
        button.disabled = !['home', 'more'].includes(button.dataset.tab);
      });
      await show(tab);
      return;
    }
    store = stores.find((s) => s.id === params.get('store')) || stores[0];
    const picker = document.getElementById('store-picker');
    picker.hidden = platformMode || stores.length < 2;
    picker.innerHTML = stores
      .map(
        (s) =>
          \`<option value="\${s.id}" \${s.id === store.id ? 'selected' : ''}>\${esc(s.name)}</option>\`,
      )
      .join('');
    await show(tab);
    if (params.get('order'))
      showOrder(await api(base() + '/orders/' + encodeURIComponent(params.get('order'))));
  } catch (e) {
    if (!store) document.getElementById('store-name').textContent = '\u041C\u043E\u0439 \u043A\u0430\u0431\u0438\u043D\u0435\u0442';
    if (tab === 'payments') {
      await show('payments');
      return;
    }
    notice(e.message);
    main.innerHTML =
      '<p>\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0438\u043B\u0438 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C \u0437\u0430\u043D\u043E\u0432\u043E.</p>';
  }
})();
`;var ie=`/* Delokay UI translations. Customer/store data and API payloads are never translated. */
(() => {
  'use strict';
  const en = {
    '\u0412\u0410\u0428\u0415 \u0420\u0410\u0411\u041E\u0427\u0415\u0415 \u041F\u0420\u041E\u0421\u0422\u0420\u0410\u041D\u0421\u0422\u0412\u041E': 'YOUR WORKSPACE',
    '\u0420\u0415\u0414\u0410\u041A\u0422\u041E\u0420 \u041C\u0410\u0413\u0410\u0417\u0418\u041D\u0410': 'STORE EDITOR',
    '\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u043C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u2026': 'Connecting your store\u2026',
    '\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026': 'Loading\u2026',
    \u0413\u043B\u0430\u0432\u043D\u0430\u044F: 'Home',
    \u0422\u043E\u0432\u0430\u0440\u044B: 'Products',
    \u0417\u0430\u043A\u0430\u0437\u044B: 'Orders',
    \u0415\u0449\u0451: 'More',
    '\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u044B': 'Main sections',
    '\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D': 'Select a store',
    \u0420\u0443\u0441\u0441\u043A\u0438\u0439: 'Russian',
    \u0410\u043D\u0433\u043B\u0438\u0439\u0441\u043A\u0438\u0439: 'English',
    '\u042F\u0437\u044B\u043A \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430': 'Interface language',
    '\u041C\u043E\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D': 'My store',
    '\u041C\u043E\u0439 \u043A\u0430\u0431\u0438\u043D\u0435\u0442': 'My dashboard',
    '\u0412\u0430\u0448\u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B': 'Your tools',
    '\u0414\u041E\u0411\u0420\u041E \u041F\u041E\u0416\u0410\u041B\u041E\u0412\u0410\u0422\u042C \u0412 DELOKAY': 'WELCOME TO DELOKAY',
    '\u041D\u0430\u0447\u043D\u0451\u043C \u0441 \u0432\u0430\u0448\u0435\u0433\u043E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430': "Let's start with your store",
    '\u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043E\u043D\u043B\u0430\u0439\u043D-\u043A\u0430\u0442\u0430\u043B\u043E\u0433, \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0442\u043E\u0432\u0430\u0440\u044B \u0438 \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0439\u0442\u0435 \u0437\u0430\u043A\u0430\u0437\u044B \u043F\u0440\u044F\u043C\u043E \u0432 Telegram.':
      'Create a catalog, add products, and receive orders right in Telegram.',
    '\u041D\u0430\u0447\u0430\u0442\u044C \u0441 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430 \u2192': 'Start with catalogs \u2192',
    \u041A\u0430\u0442\u0430\u043B\u043E\u0433\u0438: 'Catalogs',
    '\u041F\u0435\u0440\u0432\u044B\u0439 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 Delokay': "Delokay's first tool",
    \u0414\u043E\u0441\u0442\u0443\u043F\u0435\u043D: 'Available',
    '\u041F\u043E\u0441\u043B\u0435 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u0430 \u043C\u044B \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043C \u0432\u0430\u043C \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0434\u043B\u044F \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430.':
      "After you place an order, we'll send you a link to connect your store.",
    '\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0441\u043B\u0443\u0433': 'Service payments',
    '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0434\u0430\u043D\u043D\u044B\u0435 Tribute\u2026': 'Loading Tribute details\u2026',
    '\u041F\u043E\u043A\u0443\u043F\u043A\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430': 'Purchase confirmed',
    '\u0412\u043E\u0437\u0432\u0440\u0430\u0442 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D': 'Refund reported',
    '\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B': 'Awaiting payment',
    '\u041D\u0443\u0436\u043D\u0430 \u0441\u0432\u0435\u0440\u043A\u0430': 'Needs review',
    \u0421\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F: 'Creating',
    '\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0441\u0430\u0439\u0442\u0430-\u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430.': 'Catalog website creation and setup.',
    '\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0441\u0430\u0439\u0442\u0430': 'Website setup',
    '\u0422\u043E\u0432\u0430\u0440 \u043D\u0430 \u0437\u0430\u043A\u0430\u0437. \u041F\u0440\u043E\u0434\u0430\u0432\u0435\u0446 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0447\u0435\u0440\u0435\u0437 Tribute \u043F\u043E\u0441\u043B\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u0430 \u0438 \u043C\u043E\u0434\u0435\u0440\u0430\u0446\u0438\u0438.':
      'Custom order. Your completed project will be delivered through Tribute after review.',
    '\u0417\u0430\u043A\u0430\u0437\u0430\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute': 'Order via Tribute',
    '\u041E\u043F\u043B\u0430\u0442\u0438\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute': 'Pay via Tribute',
    '\u0422\u043E\u0432\u0430\u0440 \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0434\u043B\u044F \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u0430.': 'This service is not available to order yet.',
    '\u041C\u043E\u0438 \u043F\u043E\u043A\u0443\u043F\u043A\u0438 \u0438 \u0441\u0447\u0435\u0442\u0430': 'My purchases and invoices',
    '\u041F\u043E\u043A\u0443\u043F\u043E\u043A \u0438 \u0441\u0447\u0435\u0442\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.': 'No purchases or invoices yet.',
    '\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443': 'Refresh payments',
    '\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0432\u0430\u0448\u0443 \u0432\u0438\u0442\u0440\u0438\u043D\u0443 \u0438 \u0435\u0451 \u0441\u0442\u0430\u0442\u0443\u0441': 'Your storefront link and status',
    \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438: 'Settings',
    '\u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430, \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u044B \u0438 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0430': 'Store design, contacts, and delivery',
    \u041E\u043F\u043B\u0430\u0442\u0430: 'Payments',
    '\u0423\u0441\u043B\u0443\u0433\u0438 Delokay, \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u043E\u043A\u0443\u043F\u043E\u043A \u0438 Tribute': 'Delokay services, purchases, and Tribute',
    '\u041C\u0435\u043D\u044C\u0448\u0435 \u0440\u0443\u0442\u0438\u043D\u044B. \u0411\u043E\u043B\u044C\u0448\u0435 \u0434\u0435\u043B\u0430. \u2728': 'Less busywork. More business. \u2728',
    '\u041D\u043E\u0432\u044B\u0435 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0431\u0443\u0434\u0443\u0442 \u043F\u043E\u044F\u0432\u043B\u044F\u0442\u044C\u0441\u044F \u0437\u0434\u0435\u0441\u044C \u043F\u043E \u043C\u0435\u0440\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430.':
      'More tools will appear here as they launch.',
    \u0414\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u044F: 'Demo mode',
    '\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0430\u043A\u0442\u0438\u0432\u0435\u043D': 'Store is active',
    '\u041F\u0440\u0438\u0451\u043C \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D': 'Orders are paused',
    \u041D\u043E\u0432\u044B\u0439: 'New',
    '\u0412 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0435': 'Processing',
    \u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D: 'Completed',
    \u041E\u0442\u043C\u0435\u043D\u0451\u043D: 'Cancelled',
    '\u0411\u0435\u0437 \u043B\u0438\u043C\u0438\u0442\u0430': 'Unlimited',
    '\u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u043F\u043E \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430\u043C': 'Stock by variant',
    'DELOKAY \xB7 \u041A\u0410\u0422\u0410\u041B\u041E\u0413\u0418': 'DELOKAY \xB7 CATALOGS',
    '\u0412\u0441\u0451 \u043F\u043E\u0434 \u0440\u0443\u043A\u043E\u0439': 'Everything in one place',
    '\u0422\u043E\u0432\u0430\u0440\u044B, \u0437\u0430\u043A\u0430\u0437\u044B \u0438 \u0432\u0430\u0448 \u0441\u0430\u0439\u0442 \u0432 \u043E\u0434\u043D\u043E\u043C \u0443\u0434\u043E\u0431\u043D\u043E\u043C \u043C\u0435\u0441\u0442\u0435. \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u043E\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043D\u0430 \u0432\u0438\u0442\u0440\u0438\u043D\u0435 \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.':
      'Products, orders, and your website in one workspace. Changes appear on your storefront as soon as you save.',
    '\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440': 'Add product',
    '\u041E\u0431\u0437\u043E\u0440 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430': 'Store overview',
    \u0422\u043E\u0432\u0430\u0440\u043E\u0432: 'Catalog items',
    '\u041D\u043E\u0432\u044B\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432': 'New orders',
    '\u0411\u044B\u0441\u0442\u0440\u044B\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F': 'Quick actions',
    '\u0412\u0441\u0435 \u0442\u043E\u0432\u0430\u0440\u044B \u2192': 'All products \u2192',
    '\u041F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0437\u0430\u043A\u0430\u0437\u044B \u2192': 'View orders \u2192',
    '\u0412\u0430\u0448 \u0441\u0430\u0439\u0442': 'Your website',
    '\u0417\u0430\u043A\u0430\u0437\u044B \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B \u0432 \u0434\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435.': 'Orders are disabled in demo mode.',
    '\u041D\u043E\u0432\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u044B \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C \u0438 \u0432 Telegram.': 'New orders will appear here and in Telegram.',
    '\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432\u0438\u0442\u0440\u0438\u043D\u0443 \u2197': 'Open storefront \u2197',
    \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C: 'Add',
    '\u0412 \u043D\u0430\u043B\u0438\u0447\u0438\u0438': 'In stock',
    '\u041D\u0430 \u0437\u0430\u043A\u0430\u0437': 'Made to order',
    '\u041D\u0435\u0442 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438': 'Out of stock',
    '\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043F\u0435\u0440\u0432\u044B\u0439 \u0442\u043E\u0432\u0430\u0440.': 'Add your first product.',
    '\u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043A\u0430\u0437\u043E\u0432': 'Order status',
    \u0412\u0441\u0435: 'All',
    '\u0417\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.': 'No orders yet.',
    \u041D\u0430\u0437\u0430\u0434: 'Back',
    \u0414\u0430\u043B\u0435\u0435: 'Next',
    '\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443': 'Copy link',
    '\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0442\u043E\u0432\u0430\u0440': 'Edit product',
    '\u041D\u043E\u0432\u044B\u0439 \u0442\u043E\u0432\u0430\u0440': 'New product',
    \u0417\u0430\u043A\u0440\u044B\u0442\u044C: 'Close',
    '\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438 (\u0434\u043E 8)': 'Photos (up to 8)',
    \u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435: 'Name',
    \u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F: 'Category',
    \u041F\u0440\u043E\u0447\u0435\u0435: 'Other',
    \u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435: 'Description',
    '\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0432\u0430\u043B\u044E\u0442\u044B \u0438 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438': 'Additional currencies and attributes',
    \u0411\u0440\u0435\u043D\u0434: 'Brand',
    \u0426\u0432\u0435\u0442: 'Color',
    \u041A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F: 'Collection',
    \u0410\u0440\u0442\u0438\u043A\u0443\u043B: 'SKU',
    '\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 (\u0434\u043E 12, \u043F\u043E \u043E\u0434\u043D\u043E\u0439 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0435)': 'Attributes (up to 12, one per line)',
    '\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B: \u0445\u043B\u043E\u043F\u043E\u043A\\\\n\u041E\u0431\u044A\u0451\u043C: 100 \u043C\u043B': 'Material: cotton\\\\nVolume: 100 ml',
    '\u0421\u043A\u0438\u0434\u043A\u0430, %': 'Discount, %',
    \u041D\u0430\u043B\u0438\u0447\u0438\u0435: 'Availability',
    \u0412\u0430\u0440\u0438\u0430\u043D\u0442\u044B: 'Variants',
    '\u0420\u0430\u0437\u043C\u0435\u0440, \u0446\u0432\u0435\u0442 \u0438\u043B\u0438 \u043C\u043E\u0434\u0435\u043B\u044C. \u0415\u0441\u043B\u0438 \u0432\u044B\u0431\u043E\u0440\u0430 \u043D\u0435\u0442, \u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \xAB\u0411\u0435\u0437 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432\xBB. \u041F\u0443\u0441\u0442\u043E\u0439 \u043E\u0441\u0442\u0430\u0442\u043E\u043A \u043E\u0437\u043D\u0430\u0447\u0430\u0435\u0442 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F.':
      'Size, color, or model. If no choice is needed, keep \u201CNo variants\u201D. An empty stock field means unlimited.',
    '\u0411\u0435\u0437 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432': 'No variants',
    '\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u0430\u0440\u0438\u0430\u043D\u0442': 'Add variant',
    '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440': 'Save product',
    '\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440': 'Delete product',
    '\u0420\u0430\u0437\u043C\u0435\u0440, \u0446\u0432\u0435\u0442 \u0438\u043B\u0438 \u0432\u0430\u0440\u0438\u0430\u043D\u0442': 'Size, color, or variant',
    '\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: M / \u041A\u0440\u0430\u0441\u043D\u044B\u0439': 'For example: M / Red',
    \u041E\u0441\u0442\u0430\u0442\u043E\u043A: 'Stock',
    '\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0430\u0440\u0438\u0430\u043D\u0442': 'Remove variant',
    '\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0444\u043E\u0442\u043E': 'Remove photo',
    '\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430': 'Store name',
    '\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0432\u0438\u0442\u0440\u0438\u043D\u044B': 'Storefront title',
    '\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430': 'Store description',
    '\u0428\u0430\u0431\u043B\u043E\u043D \u0432\u0438\u0442\u0440\u0438\u043D\u044B': 'Storefront template',
    \u0423\u043D\u0438\u0432\u0435\u0440\u0441\u0430\u043B\u044C\u043D\u044B\u0439: 'General',
    '\u041E\u0434\u0435\u0436\u0434\u0430 \u0438 \u0430\u043A\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044B': 'Clothing & accessories',
    '\u0414\u043E\u043C \u0438 \u0434\u0435\u043A\u043E\u0440': 'Home & decor',
    '\u041A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0430 \u0438 \u0443\u0445\u043E\u0434': 'Beauty & care',
    '\u041C\u0435\u043D\u044F\u0435\u0442 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435. \u0422\u043E\u0432\u0430\u0440\u044B \u0438 \u0446\u0435\u043D\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F; \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0446\u0432\u0435\u0442 \u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432 \u043C\u043E\u0436\u043D\u043E \u043D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u043D\u0438\u0436\u0435.':
      'Changes the appearance without affecting products or prices. Configure colors and variant labels below.',
    '\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0446\u0432\u0435\u0442': 'Accent color',
    '\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u043B\u043E\u0433\u043E\u0442\u0438\u043F': 'Logo URL',
    '\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043B\u043E\u0433\u043E\u0442\u0438\u043F': 'Upload logo',
    'WhatsApp: \u043D\u043E\u043C\u0435\u0440 \u0441 \u043A\u043E\u0434\u043E\u043C \u0441\u0442\u0440\u0430\u043D\u044B, \u0442\u043E\u043B\u044C\u043A\u043E \u0446\u0438\u0444\u0440\u044B':
      'WhatsApp: full number with country code, digits only',
    'Telegram username \u0431\u0435\u0437 @': 'Telegram username without @',
    'Instagram username \u0431\u0435\u0437 @': 'Instagram username without @',
    '\u0412\u0430\u043B\u044E\u0442\u044B (1 \u0438\u043B\u0438 2, \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E)': 'Currencies (1 or 2, comma-separated)',
    'BYN, RUB, KZT, USD, EUR. \u041F\u0435\u0440\u0435\u0434 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C \u043D\u043E\u0432\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u044B \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0446\u0435\u043D\u044B \u0432 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432.':
      'BYN, RUB, KZT, USD, EUR. Add product prices before enabling a new currency.',
    '\u0421\u043F\u043E\u0441\u043E\u0431\u044B \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438 (\u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0435)': 'Delivery methods (one per line)',
    '\u0423\u0441\u043B\u043E\u0432\u0438\u044F \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438': 'Delivery details',
    '\u0422\u0435\u043A\u0441\u0442 \u0432\u043D\u0438\u0437\u0443 \u0441\u0430\u0439\u0442\u0430': 'Website footer text',
    '\u0422\u0435\u043A\u0441\u0442\u044B \u043A\u043D\u043E\u043F\u043E\u043A \u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u0435\u0439': 'Buttons and labels',
    '\u041A\u043D\u043E\u043F\u043A\u0430 \u043A\u043E\u0440\u0437\u0438\u043D\u044B': 'Cart button',
    '\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443': 'Add to cart',
    '\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432': 'Variant label',
    '\u0412\u0441\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438': 'All categories',
    '\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u043A \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0430\u043C': 'Contact label',
    '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438': 'Save settings',
    \u041F\u0440\u0438\u043D\u044F\u0442\u044C: 'Accept',
    \u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C: 'Cancel',
    \u0418\u0442\u043E\u0433\u043E: 'Total',
    '\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 JPEG, PNG \u0438\u043B\u0438 WebP \u0434\u043E 20 \u041C\u0411': 'Choose a JPEG, PNG, or WebP under 20 MB',
    '\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0435': 'Image is too large',
    '\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430 \u043E\u043F\u043B\u0430\u0442\u044B': 'Invalid payment link',
    '\u041E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u0438\u043D \u0432\u0430\u0440\u0438\u0430\u043D\u0442': 'Keep at least one variant',
    '\u0421\u0442\u0430\u0442\u0443\u0441 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D': 'Status updated',
    '\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 30 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432': 'Maximum 30 variants',
    '\u0421\u0441\u044B\u043B\u043A\u0430 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0430': 'Link copied',
    '\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440 \u0438\u0437 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430?': 'Delete this product from the catalog?',
    '\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440?': 'Delete product?',
    '\u0422\u043E\u0432\u0430\u0440 \u0443\u0434\u0430\u043B\u0451\u043D': 'Product deleted',
    '\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 8 \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0439': 'Maximum 8 photos',
    '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438\u2026': 'Uploading photos\u2026',
    '\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u044B': 'Photos uploaded',
    '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043B\u043E\u0433\u043E\u0442\u0438\u043F\u2026': 'Uploading logo\u2026',
    '\u041B\u043E\u0433\u043E\u0442\u0438\u043F \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438.': 'Logo uploaded. Save your settings.',
    '\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438: \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0444\u043E\u0440\u043C\u0430\u0442 \xAB\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435: \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\xBB':
      'Attributes: use the format \u201CName: value\u201D',
    '\u0422\u043E\u0432\u0430\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D': 'Product saved',
    '\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B': 'Settings saved',
    '\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u0438\u0437': 'Open the editor from',
    '\u043F\u0430\u043D\u0435\u043B\u0438 \u0444\u0430\u0431\u0440\u0438\u043A\u0438': 'the platform dashboard',
    '\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C \u0432 Telegram': 'Open the dashboard in Telegram',
    '\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u0423\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u043C\xBB \u0432 \u043B\u0438\u0447\u043D\u043E\u043C \u0447\u0430\u0442\u0435 \u0441 \u0431\u043E\u0442\u043E\u043C.':
      'Tap \u201CManage store\u201D in your chat with the bot.',
    '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0438\u043B\u0438 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C \u0437\u0430\u043D\u043E\u0432\u043E.':
      'Unable to connect. Refresh the page or open the dashboard again.',
    '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.':
      'Could not load payments. Please try again.',
    '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441': 'Request failed',
    '\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F': 'Basic information',
    '\u0426\u0435\u043D\u044B \u0438 \u043E\u0441\u0442\u0430\u0442\u043A\u0438': 'Prices and stock',
    \u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435: 'Appearance',
    \u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B: 'Contacts',
    '\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430 \u0438 \u043E\u043F\u043B\u0430\u0442\u0430': 'Delivery and payments',
    \u041A\u043B\u0438\u0435\u043D\u0442: 'Customer',
    '\u0421\u043E\u0441\u0442\u0430\u0432 \u0437\u0430\u043A\u0430\u0437\u0430': 'Order items',
    '\u0418\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F \u043E \u0437\u0430\u043A\u0430\u0437\u0435': 'Order details',
    '\u0417\u0430\u043A\u0430\u0437\u044B \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432': 'Customer orders',
    '\u041D\u0430\u0439\u0442\u0438 \u0442\u043E\u0432\u0430\u0440\u2026': 'Search products\u2026',
    '\u041F\u043E\u0438\u0441\u043A \u0442\u043E\u0432\u0430\u0440\u043E\u0432': 'Search products',
    '\u0412\u0441\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u0442\u043E\u0432\u0430\u0440\u043E\u0432': 'All product categories',
    '\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u043F\u043E\u0438\u0441\u043A': 'Clear search',
    '\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0442\u043E\u0432\u0430\u0440\u043E\u0432': 'No products yet',
    '\u0412\u0430\u0448 \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u043D\u0430\u0447\u043D\u0451\u0442\u0441\u044F \u0441 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0442\u043E\u0432\u0430\u0440\u0430. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0444\u043E\u0442\u043E, \u0446\u0435\u043D\u0443 \u0438 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435.':
      'Your catalog starts with your first product. Add a photo, price, and description.',
    '\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E': 'No matches',
    '\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0438\u043B\u0438 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E.': 'Try another search or category.',
    '\u041D\u0435\u0442 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u043E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C\u0443 \u0441\u0442\u0430\u0442\u0443\u0441\u0443': 'No orders with this status',
    '\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0434\u0440\u0443\u0433\u043E\u0439 \u0441\u0442\u0430\u0442\u0443\u0441.': 'Try another status.',
    '\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u043C': 'Store management',
    '\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0439\u0442\u0435 \u0443\u0441\u043B\u0443\u0433\u0438 \u0438 \u0441\u043B\u0435\u0434\u0438\u0442\u0435 \u0437\u0430 \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u043C \u043F\u043E\u043A\u0443\u043F\u043E\u043A \u0432 \u043E\u0434\u043D\u043E\u043C \u043C\u0435\u0441\u0442\u0435.':
      'Pay for services and track your purchases in one place.',
    '\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u043E\u043A\u0443\u043F\u043E\u043A': 'Purchase history',
    '\u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435': 'Store information',
    '\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0432\u0438\u0442\u0440\u0438\u043D\u0443': 'Storefront link',
    '\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0433\u043E\u0442\u043E\u0432 \u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F \u0441 \u043A\u043B\u0438\u0435\u043D\u0442\u0430\u043C\u0438.': 'Your store is ready to share.',
    '\u041D\u0430\u0437\u0430\u0434 \u043A \u043C\u0435\u043D\u044E': 'Back to menu',
    '\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435': 'Choose an action',
    '\u0414\u043E\u0441\u0442\u0443\u043F \u043A Delokay': 'Delokay access',
    '\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u044B \u043F\u0440\u043E\u0434\u0430\u0436\u0438': 'Accepting orders',
    '\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D': 'Edit store',
  };
  const reverse = Object.fromEntries(
    Object.entries(en)
      .reverse()
      .map(([ru, english]) => [english, ru]),
  );
  const patterns = [
    [/^\u0422\u043E\u0432\u0430\u0440\u044B \xB7 (\\d+)$/, (_, n) => 'Products \xB7 ' + n],
    [/^Products \xB7 (\\d+)$/, (_, n) => '\u0422\u043E\u0432\u0430\u0440\u044B \xB7 ' + n],
    [/^\u0417\u0430\u043A\u0430\u0437 \u2116(\\d+)$/, (_, n) => 'Order #' + n],
    [/^Order #(\\d+)$/, (_, n) => '\u0417\u0430\u043A\u0430\u0437 \u2116' + n],
    [/^\u0426\u0435\u043D\u0430, ([A-Z]{3})$/, (_, c) => 'Price, ' + c],
    [/^Price, ([A-Z]{3})$/, (_, c) => '\u0426\u0435\u043D\u0430, ' + c],
    [/^(\\d+) \u0448\u0442\\.$/, (_, n) => n + ' pcs'],
    [/^(\\d+) pcs$/, (_, n) => n + ' \u0448\u0442.'],
    [/^\u0418\u0442\u043E\u0433\u043E: (.*)$/, (_, n) => 'Total: ' + n],
    [/^Total: (.*)$/, (_, n) => '\u0418\u0442\u043E\u0433\u043E: ' + n],
    [/^\u0424\u043E\u0442\u043E (\\d+)$/, (_, n) => 'Photo ' + n],
    [/^Photo (\\d+)$/, (_, n) => '\u0424\u043E\u0442\u043E ' + n],
  ];
  const keys = ['aria-label', 'placeholder', 'title'];
  const app = document.body.classList.contains('delokay-app');
  if (!app) return;
  const platformMode = document.body.dataset.mode === 'platform';
  const manual = !platformMode && localStorage.getItem('delokay_locale');
  const telegram = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  let language = platformMode
    ? 'ru'
    : manual === 'ru' || manual === 'en'
      ? manual
      : telegram
        ? /^ru(?:[-_]|$)/i.test(telegram)
          ? 'ru'
          : 'en'
        : 'ru';
  let observed = false;
  const observer = new MutationObserver((records) => {
    if (!observed) return;
    const parents = new Set();
    for (const record of records) {
      if (record.type === 'characterData') parents.add(record.target.parentElement);
      else
        for (const node of record.addedNodes)
          parents.add(node.nodeType === 1 ? node : node.parentElement);
    }
    for (const parent of parents) if (parent) translate(parent);
  });
  function translateValue(input, destination) {
    const value = String(input ?? '');
    const match = value.match(/^(\\s*)(.*?)(\\s*)$/s);
    if (!match || !match[2]) return value;
    let core = match[2];
    const direct = destination === 'en' ? en : reverse;
    const alternate = destination === 'en' ? reverse : en;
    // Exact UI strings only: do not translate arbitrary user-created titles.
    if (Object.hasOwn(direct, core)) core = direct[core];
    else if (!Object.hasOwn(alternate, core)) {
      for (const [i, pattern] of patterns.entries()) {
        if ((destination === 'en' && i % 2 !== 0) || (destination === 'ru' && i % 2 === 0))
          continue;
        if (pattern[0].test(core)) {
          core = core.replace(pattern[0], pattern[1]);
          break;
        }
      }
    }
    return match[1] + core + match[3];
  }
  function translate(root) {
    if (!root) return;
    const elements = [];
    if (root.nodeType === 1) elements.push(root);
    if (root.querySelectorAll) elements.push(...root.querySelectorAll('*'));
    for (const element of elements) {
      if (element.closest('[data-no-i18n]')) continue;
      for (const key of keys) {
        if (!element.hasAttribute(key)) continue;
        const before = element.getAttribute(key);
        const after = translateValue(before, language);
        if (after !== before) element.setAttribute(key, after);
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent || parent.closest('[data-no-i18n],script,style,textarea,option[data-no-i18n]'))
        continue;
      const old = node.nodeValue;
      const newer = translateValue(old, language);
      if (old !== newer) node.nodeValue = newer;
    }
  }
  function set(languageCode) {
    if (!['ru', 'en'].includes(languageCode)) return;
    language = languageCode;
    document.documentElement.lang = language;
    if (!platformMode) localStorage.setItem('delokay_locale', language);
    translate(document.body);
    refreshSwitch();
  }
  function refreshSwitch() {
    const btn = document.getElementById('locale-switch');
    if (btn) {
      btn.textContent = language === 'ru' ? '\u{1F1F7}\u{1F1FA} RU' : '\u{1F1EC}\u{1F1E7} EN';
      btn.title = language === 'ru' ? 'Switch to English' : '\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u0438\u0439';
      btn.setAttribute(
        'aria-label',
        language === 'ru' ? 'Switch to English' : '\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u0438\u0439',
      );
    }
  }
  document.documentElement.lang = language;
  document.addEventListener('click', (event) => {
    if (event.target.closest('#locale-switch')) {
      event.preventDefault();
      set(language === 'ru' ? 'en' : 'ru');
    }
  });
  observed = true;
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  translate(document.body);
  refreshSwitch();
  window.DelokayI18n = {
    get language() {
      return language;
    },
    set,
    translate,
    t: (v) => translateValue(v, language),
    locale: () => (language === 'ru' ? 'ru-RU' : 'en-US'),
  };
})();
`;var se=`:root {
  color-scheme: light dark;
  --bg: var(--tg-theme-bg-color, #101114);
  --card: var(--tg-theme-secondary-bg-color, #1b1d22);
  --text: var(--tg-theme-text-color, #f3f4f7);
  --muted: var(--tg-theme-hint-color, #9ca3af);
  --accent: var(--tg-theme-button-color, #467b67);
  --button-text: var(--tg-theme-button-text-color, #fff);
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px system-ui;
}
header,
main,
#notice {
  max-width: 720px;
  margin: auto;
  padding: 20px;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding-top: calc(20px + env(safe-area-inset-top));
}
h1 {
  font-size: 25px;
  margin: 4px 0;
  letter-spacing: -0.6px;
  overflow-wrap: anywhere;
}
header > div {
  min-width: 0;
  flex: 1;
}
h2 {
  font-size: 20px;
  margin: 0 0 16px;
}
h3 {
  font-size: 16px;
  margin: 0 0 8px;
}
.eyebrow,
p,
.muted {
  color: var(--muted);
}
.eyebrow {
  font-size: 12px;
}
p {
  line-height: 1.5;
}
main {
  padding-bottom: calc(110px + env(safe-area-inset-bottom));
}
button,
input,
select,
textarea {
  font: inherit;
  border-radius: 10px;
}
button {
  min-height: 44px;
  padding: 10px 14px;
  background: var(--card);
  color: var(--text);
  border: 1px solid #8884;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.primary {
  background: var(--accent);
  color: var(--button-text);
  border: 0;
}
.danger {
  color: #ff6464;
}
input,
select,
textarea {
  width: 100%;
  min-height: 44px;
  padding: 11px 12px;
  border: 1px solid #8885;
  background: var(--bg);
  color: var(--text);
}
input[type='color'] {
  padding: 5px;
}
input[type='checkbox'] {
  width: auto;
  min-height: 0;
}
textarea {
  min-height: 90px;
  resize: vertical;
}
label {
  display: block;
  font-size: 13px;
  color: var(--muted);
  margin: 16px 0 7px;
}
.card {
  background: var(--card);
  border-radius: 15px;
  padding: 18px;
  margin-bottom: 12px;
  border: 1px solid #8882;
}
.card > :first-child {
  margin-top: 0;
}
.card > :last-child {
  margin-bottom: 0;
}
.row {
  display: flex;
  gap: 10px;
  align-items: center;
}
.row > * {
  min-width: 0;
}
.between {
  justify-content: space-between;
}
.page-heading {
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.page-heading h2 {
  margin: 0;
}
.page-heading button {
  flex-shrink: 0;
}
.stack {
  display: grid;
  gap: 10px;
}
.stack > .card {
  margin-bottom: 0;
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.stat {
  font-size: 30px;
  font-weight: 700;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.product {
  display: flex;
  gap: 12px;
  align-items: center;
  text-align: left;
  width: 100%;
}
.product img,
.thumb {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 10px;
  flex-shrink: 0;
}
.product .info {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.product-chevron {
  flex-shrink: 0;
}
.stock-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.4;
}
.stock-item {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 8px;
  max-width: 100%;
  padding: 5px 8px;
  border: 1px solid #8883;
  border-radius: 8px;
  color: var(--muted);
}
.stock-item strong {
  color: var(--text);
  white-space: nowrap;
}
.stock-empty {
  border-color: #ef646480;
  background: #ef646412;
}
.product p {
  margin: 4px 0;
  font-size: 13px;
}
#notice {
  padding: 12px 20px;
  color: var(--text);
  background: #d6932020;
}
nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 6px calc(10px + env(safe-area-inset-bottom));
  display: flex;
  justify-content: center;
  border-top: 1px solid #8883;
  background: var(--bg);
  z-index: 5;
}
nav button {
  font-size: 11px;
  min-width: 0;
  max-width: 144px;
  flex: 1;
  background: transparent;
  border: 0;
  padding: 12px 3px;
  color: var(--muted);
}
nav button.active {
  color: var(--accent);
  font-weight: 700;
}
.variant {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 86px 44px;
  gap: 8px;
  margin-bottom: 10px;
}
.variant > input {
  min-width: 0;
}
.form-actions {
  margin-top: 22px;
}
.photo-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.photo-row button {
  position: relative;
  padding: 5px;
}
.badge {
  display: inline-flex;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  background: #8882;
  margin-top: 4px;
}
.order-lines {
  padding: 0;
  list-style: none;
}
.order-lines li {
  padding: 8px 0;
  border-bottom: 1px solid #8882;
}
a {
  color: var(--accent);
  overflow-wrap: anywhere;
}
details {
  margin-top: 16px;
}
summary {
  color: var(--muted);
  cursor: pointer;
}
#store-picker {
  max-width: 155px;
  font-size: 13px;
}
@media (max-width: 380px) {
  header,
  main {
    padding-left: 14px;
    padding-right: 14px;
  }
  .variant {
    grid-template-columns: minmax(0, 1fr) 74px 44px;
  }
  .stats {
    gap: 8px;
  }
  nav button {
    font-size: 10px;
  }
}

[hidden] {
  display: none !important;
}

.seed-choice {
  display: flex;
  align-items: center;
  gap: 10px;
}
.seed-choice input {
  width: auto;
  margin: 0;
}

/* Delokay mobile workspace. Scoped so the operator console keeps its legacy layout. */
body.delokay-app {
  color-scheme: light;
  --bg: #f7f8fc;
  --card: #ffffff;
  --text: #253047;
  --muted: #718096;
  --accent: #5865e8;
  --button-text: #ffffff;
  --border: #e5e9f2;
  --soft: #edefff;
  --mint: #ddf4ec;
  --shadow: 0 8px 28px rgb(38 50 88 / 5%);
  background: var(--bg);
  color: var(--text);
  font-family:
    Manrope,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  font-size: 14px;
  min-height: 100dvh;
  -webkit-font-smoothing: antialiased;
}
body.delokay-app .app-header,
body.delokay-app main,
body.delokay-app #notice {
  width: 100%;
  max-width: 720px;
  margin-inline: auto;
  padding-inline: 20px;
}
body.delokay-app .app-header {
  display: flex;
  align-items: end;
  gap: 14px;
  padding-top: calc(22px + env(safe-area-inset-top));
  padding-bottom: 16px;
}
body.delokay-app .app-header-main {
  flex: 1;
  min-width: 0;
}
body.delokay-app .brand-line {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 22px;
  letter-spacing: -0.04em;
}
body.delokay-app .brand-symbol {
  display: inline-grid;
  place-items: center;
  width: 35px;
  height: 35px;
  flex: none;
  border-radius: 12px;
  color: #fff;
  background: var(--accent);
}
body.delokay-app .brand-symbol svg {
  width: 25px;
  height: 25px;
}
body.delokay-app .brand-wordmark {
  color: var(--text);
  font-weight: 800;
  font-size: 22px;
  line-height: 1;
}
body.delokay-app .store-title-block {
  display: grid;
  gap: 3px;
}
body.delokay-app .eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.11em;
  color: #8893ab;
}
body.delokay-app h1 {
  font-size: clamp(22px, 5.3vw, 29px);
  font-weight: 800;
  letter-spacing: -0.045em;
  line-height: 1.22;
  margin: 0;
}
body.delokay-app h2 {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.045em;
  line-height: 1.3;
  margin: 0 0 14px;
}
body.delokay-app h3 {
  font-size: 15px;
  font-weight: 750;
  line-height: 1.4;
}
body.delokay-app p {
  color: var(--muted);
  line-height: 1.65;
}
body.delokay-app main {
  padding-top: 5px;
  padding-bottom: calc(112px + env(safe-area-inset-bottom));
}
body.delokay-app .card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 20px;
  box-shadow: var(--shadow);
  margin-bottom: 13px;
}
body.delokay-app button,
body.delokay-app select,
body.delokay-app input,
body.delokay-app textarea {
  border-radius: 13px;
}
body.delokay-app button {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-weight: 650;
}
body.delokay-app button:focus-visible,
body.delokay-app input:focus-visible,
body.delokay-app select:focus-visible,
body.delokay-app textarea:focus-visible {
  outline: 3px solid #5865e855;
  outline-offset: 2px;
}
body.delokay-app button.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  box-shadow: 0 8px 20px #5865e82b;
}
body.delokay-app input,
body.delokay-app select,
body.delokay-app textarea {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
}
body.delokay-app .page-heading {
  margin-bottom: 16px;
}
body.delokay-app .page-heading h2 {
  margin: 0;
}
body.delokay-app .stat {
  color: var(--text);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.06em;
}
body.delokay-app .stats .card {
  border-radius: 18px;
}
body.delokay-app .stats p {
  margin-bottom: 0;
  font-size: 12px;
}
body.delokay-app .badge {
  padding: 6px 10px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 700;
  color: #316b5a;
  background: var(--mint);
}
body.delokay-app .product {
  gap: 14px;
  min-height: 86px;
}
body.delokay-app .product .info h3 {
  margin-bottom: 4px;
}
body.delokay-app .product img,
body.delokay-app .thumb {
  width: 66px;
  height: 66px;
  border-radius: 13px;
  background: #f1f2f8;
}
body.delokay-app .product-chevron {
  color: var(--muted);
  font-size: 24px;
}
body.delokay-app .stock-item {
  border: 1px solid var(--border);
  border-radius: 9px;
}
body.delokay-app #notice {
  background: #fff5e7;
  color: #875327;
  border: 1px solid #ffe4b9;
  border-radius: 12px;
  margin: 6px auto 12px;
  font-weight: 600;
}
body.delokay-app #store-picker {
  width: min(42%, 190px);
  max-width: 190px;
  min-height: 38px;
  font-size: 11px;
  padding: 8px 10px;
  margin-bottom: 5px;
}
body.delokay-app nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: color-mix(in srgb, var(--card) 96%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-top: 1px solid var(--border);
  padding: 7px max(14px, env(safe-area-inset-left)) calc(7px + env(safe-area-inset-bottom))
    max(14px, env(safe-area-inset-right));
  box-shadow: 0 -5px 25px rgb(28 37 72 / 4%);
}
body.delokay-app nav button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  max-width: 142px;
  min-width: 0;
  min-height: 57px;
  padding: 7px 4px 5px;
  background: transparent;
  color: var(--muted);
  border: 0;
  border-radius: 13px;
  font-size: 11px;
  font-weight: 650;
}
body.delokay-app nav button.active {
  color: var(--accent);
  background: var(--soft);
  font-weight: 800;
}
body.delokay-app nav svg {
  width: 22px;
  height: 22px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}
body.delokay-app .hero-card {
  position: relative;
  background: linear-gradient(125deg, #ecedff, #f4f4ff 70%, #e4f4f4);
  padding: 23px 22px;
  overflow: hidden;
}
body.delokay-app .hero-card::after {
  content: '';
  position: absolute;
  right: -38px;
  top: -48px;
  height: 160px;
  width: 160px;
  border: 23px solid #5865e811;
  border-radius: 46px;
  transform: rotate(28deg);
  pointer-events: none;
}
body.delokay-app .hero-card h2 {
  position: relative;
  margin-bottom: 6px;
  z-index: 1;
}
body.delokay-app .hero-card p,
body.delokay-app .hero-card .actions {
  position: relative;
  z-index: 1;
}
body.delokay-app .hero-card p {
  color: #606b85;
  max-width: 340px;
}
body.delokay-app .hero-card .primary {
  padding-inline: 17px;
}
body.delokay-app .section-label {
  font-weight: 800;
  font-size: 14px;
  letter-spacing: -0.015em;
  margin: 21px 0 10px;
}
body.delokay-app .home-eyebrow {
  display: inline-flex;
  color: #5865e8;
  letter-spacing: 0.07em;
  font-size: 10px;
  font-weight: 800;
  margin-bottom: 10px;
}
body.delokay-app .stat-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  border-radius: 12px;
  margin-bottom: 14px;
  background: var(--soft);
  color: var(--accent);
}
body.delokay-app .stat-symbol.mint {
  background: var(--mint);
  color: #258d7e;
}
body.delokay-app .quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 15px;
}
body.delokay-app .quick-action {
  display: flex;
  gap: 10px;
  align-items: center;
  text-align: left;
  min-height: 76px;
  border-radius: 17px;
  padding: 14px;
  font-size: 12px;
  box-shadow: var(--shadow);
}
body.delokay-app .quick-icon,
body.delokay-app .more-icon {
  flex: none;
  display: grid;
  place-items: center;
  background: var(--soft);
  color: var(--accent);
  border-radius: 12px;
  height: 36px;
  width: 36px;
  font-size: 17px;
}
body.delokay-app .quick-icon.mint,
body.delokay-app .more-icon.mint {
  background: var(--mint);
  color: #258d7e;
}
body.delokay-app .status-row {
  display: flex;
  gap: 13px;
  align-items: start;
}
body.delokay-app .status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
  background: #28ac84;
  margin-top: 5px;
  box-shadow: 0 0 0 5px #ddf4ec;
}
body.delokay-app .status-row .muted {
  margin: 3px 0 6px;
}
body.delokay-app .tool-row {
  display: flex;
  align-items: center;
  gap: 13px;
}
body.delokay-app .tool-row .tool-copy {
  flex: 1;
  min-width: 0;
}
body.delokay-app .tool-row h3 {
  margin: 0;
}
body.delokay-app .tool-row p {
  margin: 3px 0 0;
  font-size: 12px;
}
body.delokay-app .more-list {
  display: grid;
  gap: 11px;
}
body.delokay-app .more-link {
  display: flex;
  align-items: center;
  text-align: left;
  min-height: 73px;
  gap: 15px;
  border-radius: 18px;
  padding: 15px;
  width: 100%;
}
body.delokay-app .more-link .more-copy {
  min-width: 0;
  flex: 1;
}
body.delokay-app .more-link strong {
  display: block;
  font-size: 14px;
}
body.delokay-app .more-link small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.5;
}
body.delokay-app .more-chevron {
  font-size: 21px;
  font-weight: 400;
  color: var(--muted);
}
body.delokay-app .empty-visual {
  display: grid;
  place-items: center;
  background: var(--mint);
  color: #268b7b;
  border-radius: 16px;
  width: 55px;
  height: 55px;
  font-size: 25px;
  margin-bottom: 14px;
}
body.delokay-app .section-caption {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}
body.delokay-app .hint-strip {
  border-radius: 15px;
  border: 1px solid #dfe4fb;
  background: #f0f2ff;
  color: #596783;
  padding: 14px 16px;
  line-height: 1.6;
  font-size: 12px;
}
@media (max-width: 380px) {
  body.delokay-app .app-header,
  body.delokay-app main,
  body.delokay-app #notice {
    padding-inline: 16px;
  }
  body.delokay-app .brand-line {
    margin-bottom: 16px;
  }
  body.delokay-app .quick-action {
    padding: 11px;
    gap: 7px;
  }
  body.delokay-app .quick-icon {
    height: 31px;
    width: 31px;
  }
}
@media (prefers-reduced-motion: no-preference) {
  body.delokay-app button {
    transition:
      background 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }
  body.delokay-app button:active {
    transform: scale(0.975);
  }
}
body.delokay-app[data-theme='dark'] {
  color-scheme: dark;
  --bg: #131824;
  --card: #202738;
  --text: #f4f6fc;
  --muted: #a4aec3;
  --accent: #8992ff;
  --border: #344056;
  --soft: #2a3058;
  --mint: #224b48;
  --shadow: 0 8px 28px rgb(0 0 0 / 10%);
}
body.delokay-app[data-theme='dark'] .brand-symbol,
body.delokay-app[data-theme='dark'] button.primary {
  background: #5865e8;
  color: #fff;
}
body.delokay-app[data-theme='dark'] .hero-card {
  background: linear-gradient(120deg, #272c58, #232e44);
}
body.delokay-app[data-theme='dark'] .hero-card p {
  color: #c0c7df;
}
body.delokay-app[data-theme='dark'] .hint-strip {
  color: #c2c9e1;
  background: #292e4c;
  border-color: #39416a;
}
body.delokay-app[data-theme='dark'] .home-eyebrow {
  color: #aab0ff;
}

/* Delokay secondary workspace screens */
body.delokay-app .header-controls {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 8px;
  padding-bottom: 2px;
}
body.delokay-app #locale-switch {
  min-height: 36px;
  height: 36px;
  min-width: 70px;
  padding: 6px 10px;
  border-radius: 12px;
  background: var(--card);
  color: var(--text);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  font-size: 12px;
  font-weight: 800;
}
body.delokay-app #store-picker {
  width: 145px;
  max-width: 145px;
  margin: 0;
}
body.delokay-app .product-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 135px;
  gap: 9px;
  margin-bottom: 15px;
}
body.delokay-app .product-toolbar input,
body.delokay-app .product-toolbar select {
  min-width: 0;
  height: 46px;
  margin: 0;
  border-radius: 13px;
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}
body.delokay-app .product-toolbar select {
  font-size: 12px;
}
body.delokay-app .visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
body.delokay-app .page-heading .section-caption {
  margin: 4px 0 0;
}
body.delokay-app .product-row {
  min-height: 103px;
}
body.delokay-app .product-row .info,
body.delokay-app .order-row .info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  overflow: hidden;
  align-items: flex-start;
}
body.delokay-app .product-title {
  display: block;
  font-size: 14px;
  line-height: 1.38;
  font-weight: 800;
  overflow-wrap: anywhere;
  color: var(--text);
}
body.delokay-app .product-meta {
  display: block;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
body.delokay-app .product-placeholder,
body.delokay-app .order-symbol {
  height: 66px;
  width: 66px;
  flex: none;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: var(--soft);
  color: var(--accent);
  font-size: 26px;
}
body.delokay-app .order-symbol {
  background: var(--mint);
  color: #228978;
}
body.delokay-app .stock-summary {
  margin-top: 5px;
}
body.delokay-app .availability-unavailable,
body.delokay-app .order-cancelled {
  background: #fff0f1;
  color: #b5475a;
}
body.delokay-app .availability-preorder,
body.delokay-app .order-processing {
  background: #fff4e6;
  color: #a46c24;
}
body.delokay-app .order-new {
  background: var(--soft);
  color: var(--accent);
}
body.delokay-app .order-completed {
  background: var(--mint);
  color: #227b65;
}
body.delokay-app .empty-panel {
  text-align: center;
  padding: 34px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
body.delokay-app .empty-panel .empty-visual {
  margin: 0 0 16px;
  display: grid;
  place-items: center;
}
body.delokay-app .empty-panel h3 {
  margin: 0 0 5px;
}
body.delokay-app .empty-panel p {
  margin: 0 0 16px;
  max-width: 320px;
}
body.delokay-app .order-filter-row {
  margin-bottom: 15px;
  display: grid;
  gap: 6px;
}
body.delokay-app .order-filter-row label {
  margin: 0;
  color: var(--muted);
  font-weight: 750;
}
body.delokay-app .order-filter-row select {
  max-width: 260px;
  background: var(--card);
  border: 1px solid var(--border);
}
body.delokay-app .pagination {
  justify-content: center;
  margin-top: 10px;
}
body.delokay-app form .card {
  margin-bottom: 13px;
}
body.delokay-app .form-section-heading {
  color: var(--text);
  font-size: 16px;
  margin: 0 0 18px;
  font-weight: 800;
}
body.delokay-app .form-actions {
  position: relative;
  display: flex;
  gap: 10px;
}
body.delokay-app .form-actions button.primary {
  flex: 1;
}
body.delokay-app .order-total {
  font-size: 29px;
  font-weight: 800;
  letter-spacing: -0.06em;
  margin: 14px 0 0;
  color: var(--text);
}
body.delokay-app .order-customer p {
  margin: 4px 0;
  line-height: 1.7;
}
body.delokay-app .order-summary {
  margin-top: 15px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}
body.delokay-app .order-lines {
  padding: 0;
}
body.delokay-app .order-lines li {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px 0;
  border-color: var(--border);
}
body.delokay-app .order-lines li strong {
  font-size: 13px;
}
body.delokay-app .order-lines li span {
  font-size: 12px;
}
body.delokay-app .order-actions button {
  flex: 1;
  min-width: 104px;
}
body.delokay-app .payment-intro {
  background: linear-gradient(135deg, var(--soft), var(--card));
}
body.delokay-app .payment-intro h3 {
  margin: 0;
}
body.delokay-app .payment-offer {
  border-color: #5865e83d;
}
body.delokay-app .payment-offer .primary {
  width: 100%;
}
body.delokay-app .payment-item {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
body.delokay-app .payment-item > * {
  margin: 0;
}
body.delokay-app .payment-badge {
  align-self: flex-start;
}
body.delokay-app .payment-item .primary {
  align-self: flex-start;
  margin-top: 8px;
}
body.delokay-app[data-theme='dark'] .availability-unavailable,
body.delokay-app[data-theme='dark'] .order-cancelled {
  background: #4d2839;
  color: #ffb4bc;
}
body.delokay-app[data-theme='dark'] .availability-preorder,
body.delokay-app[data-theme='dark'] .order-processing {
  background: #4f3a29;
  color: #f7c98e;
}
@media (max-width: 380px) {
  body.delokay-app .product-toolbar {
    grid-template-columns: minmax(0, 1fr) 115px;
    gap: 7px;
  }
  body.delokay-app .header-controls #store-picker {
    max-width: 115px;
  }
  body.delokay-app .app-header {
    gap: 8px;
  }
}

body.delokay-app .site-overview > .row {
  align-items: flex-start;
}
body.delokay-app .site-overview h3 {
  overflow-wrap: anywhere;
  margin: 0;
}
body.delokay-app .site-link {
  padding: 15px;
  margin: 16px 0;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 13px;
  color: var(--muted);
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.6;
}
body.delokay-app .site-overview .actions {
  align-items: center;
}
body.delokay-app .site-open-link {
  font-weight: 750;
  text-decoration: none;
  font-size: 12px;
  padding: 11px 7px;
}
`;var Ie=`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <meta name="theme-color" content="#F7F8FC" />
    <title>Delokay \u2014 \u041F\u0430\u043D\u0435\u043B\u044C \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F</title>
    <script src="https://telegram.org/js/telegram-web-app.js"><\/script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/admin.css" />
    <script defer src="/admin-i18n.js?v=20261014-delokay-i18n-1"><\/script>
    <script defer src="/admin/app.js?v=20261014-delokay-ui-1"><\/script>
  </head>
  <body class="delokay-app">
    <header class="app-header">
      <div class="app-header-main">
        <div class="brand-line">
          <span class="brand-symbol" aria-hidden="true">
            <svg viewBox="0 0 50 50" fill="none">
              <path
                d="M30 9v21c0 8-5 13-13 13S4 38 4 31s6-13 13-13c4 0 7 1 9 4"
                stroke="currentColor"
                stroke-width="6"
                stroke-linecap="round"
              />
              <rect x="28" y="24" width="17" height="19" rx="7" fill="#DDF4EC" />
              <circle cx="40" cy="9" r="5" fill="#FFD5A5" />
            </svg>
          </span>
          <span class="brand-wordmark">delokay</span>
        </div>
        <div class="store-title-block">
          <span class="eyebrow">\u0412\u0410\u0428\u0415 \u0420\u0410\u0411\u041E\u0427\u0415\u0415 \u041F\u0420\u041E\u0421\u0422\u0420\u0410\u041D\u0421\u0422\u0412\u041E</span>
          <h1 id="store-name">\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u043C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u2026</h1>
        </div>
      </div>
      <div class="header-controls">
        <button id="locale-switch" type="button" aria-label="Switch to English">\u{1F1F7}\u{1F1FA} RU</button
        ><select id="store-picker" aria-label="\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D" hidden></select>
      </div>
    </header>
    <div id="notice" role="status" hidden></div>
    <main id="main"><p>\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u043C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u2026</p></main>
    <nav id="nav" aria-label="\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u044B">
      <button data-tab="home" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />
        </svg>
        <span>\u0413\u043B\u0430\u0432\u043D\u0430\u044F</span>
      </button>
      <button data-tab="products" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="7" width="18" height="14" rx="2" />
          <path d="M8 7V5a4 4 0 0 1 8 0v2" />
        </svg>
        <span>\u0422\u043E\u0432\u0430\u0440\u044B</span>
      </button>
      <button data-tab="orders" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
        <span>\u0417\u0430\u043A\u0430\u0437\u044B</span>
      </button>
      <button data-tab="more" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="19" cy="12" r="1.4" />
        </svg>
        <span>\u0415\u0449\u0451</span>
      </button>
    </nav>
  </body>
</html>
`;var Ne=`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0444\u0430\u0431\u0440\u0438\u043A\u0438 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u043E\u0432</title>
    <link rel="stylesheet" href="/admin.css" />
    <script defer src="/platform/app.js?v=20261014-payments-2"><\/script>
  </head>
  <body>
    <header>
      <div>
        <span class="eyebrow">\u041F\u0430\u043D\u0435\u043B\u044C \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u0430</span>
        <h1>\u0424\u0430\u0431\u0440\u0438\u043A\u0430 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u043E\u0432</h1>
      </div>
      <button id="logout" hidden>\u0412\u044B\u0439\u0442\u0438</button>
    </header>
    <div id="notice" role="status" hidden></div>
    <main id="main">
      <form id="login-form" class="card">
        <h2>\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F</h2>
        <p>
          \u0412\u0432\u0435\u0434\u0438\u0442\u0435 PLATFORM_API_KEY, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u0432\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u043B\u0438 \u043F\u0440\u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0435 Cloudflare. \u042D\u0442\u043E\u0442 \u043A\u043B\u044E\u0447
          \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442 \u0432\u0441\u0435\u043C\u0438 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430\u043C\u0438. \u0412\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430\u043C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u0432 \u043F\u0435\u0440\u0435\u0434\u0430\u0432\u0430\u0439\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F.
        </p>
        <label for="platform-key">\u041A\u043B\u044E\u0447 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u044B</label
        ><input
          id="platform-key"
          type="password"
          autocomplete="off"
          minlength="32"
          required
        /><button class="primary" type="submit" style="margin-top: 16px">\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F</button>
      </form>
    </main>
  </body>
</html>
`;var Ae=`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <meta name="theme-color" content="#F7F8FC" />
    <title>Delokay \u2014 \u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/admin.css" />
    <script defer src="/admin-i18n.js?v=20261014-delokay-i18n-1"><\/script>
    <script defer src="/admin/app.js?v=20261014-delokay-ui-1"><\/script>
  </head>
  <body class="delokay-app" data-mode="platform">
    <header class="app-header">
      <div class="app-header-main">
        <div class="brand-line">
          <span class="brand-symbol" aria-hidden="true">
            <svg viewBox="0 0 50 50" fill="none">
              <path
                d="M30 9v21c0 8-5 13-13 13S4 38 4 31s6-13 13-13c4 0 7 1 9 4"
                stroke="currentColor"
                stroke-width="6"
                stroke-linecap="round"
              />
              <rect x="28" y="24" width="17" height="19" rx="7" fill="#DDF4EC" />
              <circle cx="40" cy="9" r="5" fill="#FFD5A5" />
            </svg>
          </span>
          <span class="brand-wordmark">delokay</span>
        </div>
        <div class="store-title-block">
          <span class="eyebrow">\u0420\u0415\u0414\u0410\u041A\u0422\u041E\u0420 \u041C\u0410\u0413\u0410\u0417\u0418\u041D\u0410</span>
          <h1 id="store-name">\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u043C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u2026</h1>
        </div>
      </div>
      <div class="header-controls">
        <button id="locale-switch" type="button" aria-label="Switch to English">\u{1F1F7}\u{1F1FA} RU</button
        ><select id="store-picker" aria-label="\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D" hidden></select>
      </div>
    </header>
    <div id="notice" role="status" hidden></div>
    <main id="main"><p>\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u043C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u2026</p></main>
    <nav id="nav" aria-label="\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u044B">
      <button data-tab="home" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />
        </svg>
        <span>\u0413\u043B\u0430\u0432\u043D\u0430\u044F</span>
      </button>
      <button data-tab="products" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="7" width="18" height="14" rx="2" />
          <path d="M8 7V5a4 4 0 0 1 8 0v2" />
        </svg>
        <span>\u0422\u043E\u0432\u0430\u0440\u044B</span>
      </button>
      <button data-tab="orders" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
        <span>\u0417\u0430\u043A\u0430\u0437\u044B</span>
      </button>
      <button data-tab="more" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="19" cy="12" r="1.4" />
        </svg>
        <span>\u0415\u0449\u0451</span>
      </button>
    </nav>
  </body>
</html>
`;var O=class extends Error{constructor(o,r){super(r);this.status=o}status};function i(e,t,o=400){if(!e)throw new O(o,t)}function b(e){return i(e!==null&&typeof e=="object"&&!Array.isArray(e),"\u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u043E\u0431\u044A\u0435\u043A\u0442"),e}function u(e,t=200,o=!1){i(e==null||typeof e=="string","\u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u0442\u0435\u043A\u0441\u0442");let r=String(e??"").trim();return i(r.length<=t&&(!o||r.length>0),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0434\u043B\u0438\u043D\u0430 \u0442\u0435\u043A\u0441\u0442\u0430"),r}function I(e,t,o){return i(typeof e=="number"&&Number.isSafeInteger(e)&&e>=t&&e<=o,"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u0435 \u0447\u0438\u0441\u043B\u043E"),e}function de(e,t=20,o=100){return i(Array.isArray(e)&&e.length<=t,"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A"),e.map(r=>u(r,o,!0))}function ce(e,t){let o=u(e,1e3);if(!o)return"";if(/^\/template-assets\/[a-z0-9-]+\.svg$/.test(o))return o;if(o.startsWith("/media/"))return i(!o.includes("..")&&/^\/media\/[a-f0-9-]+\/[a-f0-9-]+\.(png|jpg|webp)$/.test(o)&&(!t||o.startsWith(`/media/${t}/`)),"\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430"),o;i(/^https:\/\//.test(o),"\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F HTTPS-\u0441\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435");try{let r=new URL(o);i(!r.username&&!r.password,"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430")}catch{throw new O(400,"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430")}return o}var Le=["BYN","RUB","KZT","USD","EUR"],mt=["btn_cart","btn_add","btn_add_size","btn_clear","label_size","label_qty","label_year","label_color","label_number","label_total","label_pick","filter_all","msg_empty_cart","msg_added","wa_msg_header","wa_msg_footer","tg_msg_header","tg_msg_footer","support_label"];function B(e,t){let o=b(e??{}),r=o.currencies===void 0?["BYN"]:de(o.currencies,2);i(r.length>0&&new Set(r).size===r.length&&r.every(w=>Le.includes(w)),"\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u0430\u044F \u0432\u0430\u043B\u044E\u0442\u0430");let a=o.deliveryMethods===void 0?["\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430","\u0421\u0430\u043C\u043E\u0432\u044B\u0432\u043E\u0437"]:de(o.deliveryMethods,6);i(a.length>0&&new Set(a).size===a.length,"\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0441\u043F\u043E\u0441\u043E\u0431\u044B \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438");let n=u(o.theme)||"minimal";i(["minimal","fashion","home","beauty"].includes(n),"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0448\u0430\u0431\u043B\u043E\u043D");let s=u(o.accentColor,7)||"#354f46";i(/^#[0-9a-f]{6}$/i.test(s),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0446\u0432\u0435\u0442");let l=u(o.telegram,64).replace(/^@/,""),c=u(o.instagram,64).replace(/^@/,""),p=u(o.whatsapp,20);i(!l||/^[a-z0-9_]{5,32}$/i.test(l),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 Telegram username"),i(!c||/^[a-z0-9_.]{1,30}$/i.test(c),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 Instagram username"),i(!p||/^\d{7,15}$/.test(p),"\u041D\u043E\u043C\u0435\u0440 WhatsApp: \u0442\u043E\u043B\u044C\u043A\u043E \u0446\u0438\u0444\u0440\u044B");let m={};for(let[w,v]of Object.entries(b(o.texts??{})))i(mt.includes(w),"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u0432\u0438\u0442\u0440\u0438\u043D\u044B"),m[w]=u(v,500);return{theme:n,description:u(o.description,2e3),accentColor:s,logo:ce(o.logo,t),whatsapp:p,telegram:l,instagram:c,currencies:r,deliveryMethods:a,deliveryHint:u(o.deliveryHint,1e3),heroTitle:u(o.heroTitle,200),footerText:u(o.footerText,500),texts:m}}function H(e,t,o,r=!1){let a=b(e),n={},s=a.prices??(a.price!==void 0?{[u(a.currency)||t.currencies[0]]:Math.round(Number(a.price)*100)}:void 0);for(let[f,g]of Object.entries(b(s)))i(Le.includes(f),"\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u0430\u044F \u0432\u0430\u043B\u044E\u0442\u0430"),n[f]=I(g,0,1e8);i(t.currencies.every(f=>n[f]!==void 0),"\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0446\u0435\u043D\u0443 \u0432 \u043A\u0430\u0436\u0434\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430");let l=a.photos===void 0?a.image?[ce(a.image,o)]:[]:de(a.photos,8,1e3).map(f=>ce(f,o)),c=u(a.availability)||"available";i(["available","preorder","unavailable"].includes(c),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u0435 \u043D\u0430\u043B\u0438\u0447\u0438\u0435");let p=a.variants??[{label:"\u0411\u0435\u0437 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432",stock:null}];i(Array.isArray(p)&&p.length>0&&p.length<=30,"\u041E\u0442 1 \u0434\u043E 30 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432");let m=p.map(f=>{let g=b(f);i(r||g.id===void 0,"ID \u043D\u043E\u0432\u043E\u0433\u043E \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430 \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C");let E=g.id?u(g.id,36,!0):crypto.randomUUID();return i(/^[a-f0-9-]{36}$/.test(E),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 ID \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430"),{id:E,label:u(g.label,80,!0),stock:g.stock===null||g.stock===void 0?null:I(g.stock,0,1e6)}}),w=a.attributes??[];i(Array.isArray(w)&&w.length<=12,"\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 12 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A");let v=w.map(f=>{let g=b(f);return{label:u(g.label,80,!0),value:u(g.value,300,!0)}});return i(new Set(v.map(f=>f.label)).size===v.length,"\u041F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0430\u044F\u0441\u044F \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430"),i(new Set(m.map(f=>f.id)).size===m.length&&new Set(m.map(f=>f.label)).size===m.length,"\u041F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0438\u0439\u0441\u044F \u0432\u0430\u0440\u0438\u0430\u043D\u0442"),{data:{name:u(a.name,200,!0),category:u(a.category,100)||"\u041F\u0440\u043E\u0447\u0435\u0435",description:u(a.description,5e3),prices:n,discountPercent:a.discountPercent===void 0?0:I(a.discountPercent,0,99),availability:c,photos:l,brand:u(a.brand??a.team,100),collection:u(a.collection??a.year,100),sku:u(a.sku??a.number,80),attributes:v,color:u(a.color,100)},variants:m}}async function A(e,t=512e3){i(e.headers.get("content-type")?.includes("application/json"),"\u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F JSON",415);let o=await W(e,t);try{return JSON.parse(new TextDecoder().decode(o))}catch{throw new O(400,"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 JSON")}}async function W(e,t){i(Number(e.headers.get("content-length")||0)<=t,"\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0437\u0430\u043F\u0440\u043E\u0441",413);let o=e.body?.getReader();if(!o)return new Uint8Array;let r=[],a=0;for(;;){let{value:l,done:c}=await o.read();if(c)break;if(a+=l.byteLength,a>t)throw await o.cancel(),new O(413,"\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0437\u0430\u043F\u0440\u043E\u0441");r.push(l)}let n=new Uint8Array(a),s=0;for(let l of r)n.set(l,s),s+=l.length;return n}var gt=[{BYN:4900,RUB:149e3,KZT:89e4,USD:1500,EUR:1400},{BYN:8900,RUB:279e3,KZT:169e4,USD:2800,EUR:2600},{BYN:12900,RUB:399e3,KZT:249e4,USD:4e3,EUR:3800}],Ce=[{id:"minimal",title:"\u0423\u043D\u0438\u0432\u0435\u0440\u0441\u0430\u043B\u044C\u043D\u044B\u0439",name:"\u041C\u043E\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D",description:"\u041B\u044E\u0431\u0438\u043C\u044B\u0435 \u0432\u0435\u0449\u0438, \u0443\u0434\u043E\u0431\u043D\u044B\u0439 \u0432\u044B\u0431\u043E\u0440 \u0438 \u0437\u0430\u0431\u043E\u0442\u0430 \u043E \u043A\u0430\u0436\u0434\u043E\u0439 \u043F\u043E\u043A\u0443\u043F\u043A\u0435.",accentColor:"#354f46",variantLabel:"\u0412\u0430\u0440\u0438\u0430\u043D\u0442",samples:[]},{id:"fashion",title:"\u041E\u0434\u0435\u0436\u0434\u0430 \u0438 \u0430\u043A\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044B",name:"FORMA",description:"\u041F\u0440\u043E\u0434\u0443\u043C\u0430\u043D\u043D\u044B\u0439 \u0433\u0430\u0440\u0434\u0435\u0440\u043E\u0431 \u043D\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C. \u0427\u0438\u0441\u0442\u044B\u0435 \u043B\u0438\u043D\u0438\u0438, \u043F\u0440\u0438\u044F\u0442\u043D\u044B\u0435 \u0442\u043A\u0430\u043D\u0438 \u0438 \u0441\u0432\u043E\u0431\u043E\u0434\u0430 \u0441\u043E\u0447\u0435\u0442\u0430\u043D\u0438\u0439.",accentColor:"#252525",variantLabel:"\u0420\u0430\u0437\u043C\u0435\u0440",samples:[{name:"\u0424\u0443\u0442\u0431\u043E\u043B\u043A\u0430 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043A\u0440\u043E\u044F",category:"\u041E\u0434\u0435\u0436\u0434\u0430",asset:"fashion-shirt",price:0,variants:["S","M","L"],detail:["\u0421\u043E\u0441\u0442\u0430\u0432","100% \u0445\u043B\u043E\u043F\u043E\u043A"]},{name:"\u041B\u044C\u043D\u044F\u043D\u0430\u044F \u0440\u0443\u0431\u0430\u0448\u043A\u0430",category:"\u041E\u0434\u0435\u0436\u0434\u0430",asset:"fashion-shirt-sand",price:1,variants:["S","M","L"],detail:["\u0421\u043E\u0441\u0442\u0430\u0432","100% \u043B\u0451\u043D"]},{name:"\u0421\u0443\u043C\u043A\u0430 \u043D\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C",category:"\u0410\u043A\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044B",asset:"fashion-bag",price:2,variants:["\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442"],detail:["\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B","\u041F\u043B\u043E\u0442\u043D\u0430\u044F \u0445\u043B\u043E\u043F\u043A\u043E\u0432\u0430\u044F \u0442\u043A\u0430\u043D\u044C"]},{name:"\u0428\u043E\u043F\u043F\u0435\u0440 \u0438\u0437 \u0445\u043B\u043E\u043F\u043A\u0430",category:"\u0410\u043A\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044B",asset:"fashion-bag-sand",price:0,variants:["\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442"],detail:["\u0420\u0430\u0437\u043C\u0435\u0440","38 \xD7 42 \u0441\u043C"]},{name:"\u0421\u0432\u0438\u0442\u0448\u043E\u0442 \u0431\u0430\u0437\u043E\u0432\u044B\u0439",category:"\u041E\u0434\u0435\u0436\u0434\u0430",asset:"fashion-shirt-sand",price:2,variants:["M","L","XL"],detail:["\u0421\u043E\u0441\u0442\u0430\u0432","\u0425\u043B\u043E\u043F\u043E\u043A \u0438 \u043F\u043E\u043B\u0438\u044D\u0441\u0442\u0435\u0440"]},{name:"\u0424\u0443\u0442\u0431\u043E\u043B\u043A\u0430 \u0441 \u0434\u043B\u0438\u043D\u043D\u044B\u043C \u0440\u0443\u043A\u0430\u0432\u043E\u043C",category:"\u041E\u0434\u0435\u0436\u0434\u0430",asset:"fashion-shirt",price:1,variants:["S","M","L"],detail:["\u041F\u043E\u0441\u0430\u0434\u043A\u0430","\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u0430\u044F"]}]},{id:"home",title:"\u0414\u043E\u043C \u0438 \u0434\u0435\u043A\u043E\u0440",name:"\u0422\u0438\u0445\u0438\u0439 \u0434\u043E\u043C",description:"\u041C\u0430\u043B\u0435\u043D\u044C\u043A\u0438\u0435 \u0434\u0435\u0442\u0430\u043B\u0438 \u0434\u043B\u044F \u0431\u043E\u043B\u044C\u0448\u043E\u0433\u043E \u0447\u0443\u0432\u0441\u0442\u0432\u0430 \u0434\u043E\u043C\u0430. \u041A\u0435\u0440\u0430\u043C\u0438\u043A\u0430, \u0442\u0435\u043A\u0441\u0442\u0438\u043B\u044C \u0438 \u0432\u0435\u0449\u0438 \u0441 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u043E\u043C.",accentColor:"#8b513c",variantLabel:"\u0412\u0430\u0440\u0438\u0430\u043D\u0442",samples:[{name:"\u041A\u0435\u0440\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0432\u0430\u0437\u0430",category:"\u0414\u0435\u043A\u043E\u0440",asset:"home-vase",price:1,variants:["\u041F\u0435\u0441\u043E\u0447\u043D\u044B\u0439","\u0422\u0435\u0440\u0440\u0430\u043A\u043E\u0442\u0430"],detail:["\u0412\u044B\u0441\u043E\u0442\u0430","24 \u0441\u043C"]},{name:"\u041A\u0440\u0443\u0436\u043A\u0430 \u0441 \u043C\u044F\u0433\u043A\u043E\u0439 \u0433\u043B\u0430\u0437\u0443\u0440\u044C\u044E",category:"\u041A\u0435\u0440\u0430\u043C\u0438\u043A\u0430",asset:"home-cup",price:0,variants:["\u041C\u043E\u043B\u043E\u0447\u043D\u044B\u0439"],detail:["\u041E\u0431\u044A\u0451\u043C","300 \u043C\u043B"]},{name:"\u041B\u044C\u043D\u044F\u043D\u0430\u044F \u043D\u0430\u0432\u043E\u043B\u043E\u0447\u043A\u0430",category:"\u0422\u0435\u043A\u0441\u0442\u0438\u043B\u044C",asset:"home-pillow",price:0,variants:["40 \xD7 40 \u0441\u043C","50 \xD7 50 \u0441\u043C"],detail:["\u0421\u043E\u0441\u0442\u0430\u0432","100% \u043B\u0451\u043D"]},{name:"\u0412\u0430\u0437\u0430 \u0434\u043B\u044F \u0441\u0443\u0445\u043E\u0446\u0432\u0435\u0442\u043E\u0432",category:"\u0414\u0435\u043A\u043E\u0440",asset:"home-vase-clay",price:2,variants:["\u0422\u0435\u0440\u0440\u0430\u043A\u043E\u0442\u0430"],detail:["\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B","\u041A\u0435\u0440\u0430\u043C\u0438\u043A\u0430"]},{name:"\u0427\u0430\u0448\u043A\u0430 \u0434\u043B\u044F \u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0433\u043E \u043A\u043E\u0444\u0435",category:"\u041A\u0435\u0440\u0430\u043C\u0438\u043A\u0430",asset:"home-cup",price:0,variants:["\u041C\u043E\u043B\u043E\u0447\u043D\u044B\u0439"],detail:["\u041E\u0431\u044A\u0451\u043C","200 \u043C\u043B"]},{name:"\u0414\u0435\u043A\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u0430\u044F \u043F\u043E\u0434\u0443\u0448\u043A\u0430",category:"\u0422\u0435\u043A\u0441\u0442\u0438\u043B\u044C",asset:"home-pillow",price:1,variants:["45 \xD7 45 \u0441\u043C"],detail:["\u041D\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C","\u041F\u043E\u043B\u0438\u044D\u0444\u0438\u0440\u043D\u043E\u0435 \u0432\u043E\u043B\u043E\u043A\u043D\u043E"]}]},{id:"beauty",title:"\u041A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0430 \u0438 \u0443\u0445\u043E\u0434",name:"LUNA care",description:"\u041F\u0440\u043E\u0441\u0442\u043E\u0439 \u0440\u0438\u0442\u0443\u0430\u043B \u0437\u0430\u0431\u043E\u0442\u044B \u043E \u0441\u0435\u0431\u0435. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043B\u044E\u0431\u0438\u043C\u0443\u044E \u0442\u0435\u043A\u0441\u0442\u0443\u0440\u0443 \u0438 \u0441\u043E\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0432\u043E\u0439 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0439 \u0443\u0445\u043E\u0434.",accentColor:"#6b455d",variantLabel:"\u041E\u0431\u044A\u0451\u043C",samples:[{name:"\u041A\u0440\u0435\u043C \u0434\u043B\u044F \u0440\u0443\u043A",category:"\u0414\u043B\u044F \u0442\u0435\u043B\u0430",asset:"beauty-tube",price:0,variants:["50 \u043C\u043B","100 \u043C\u043B"],detail:["\u0410\u0440\u043E\u043C\u0430\u0442","\u041C\u044F\u0433\u043A\u0438\u0439 \u0446\u0432\u0435\u0442\u043E\u0447\u043D\u044B\u0439"]},{name:"\u041E\u0447\u0438\u0449\u0430\u044E\u0449\u0438\u0439 \u0433\u0435\u043B\u044C",category:"\u0414\u043B\u044F \u043B\u0438\u0446\u0430",asset:"beauty-bottle",price:1,variants:["150 \u043C\u043B"],detail:["\u0422\u0435\u043A\u0441\u0442\u0443\u0440\u0430","\u0413\u0435\u043B\u0435\u0432\u0430\u044F"]},{name:"\u041A\u0440\u0435\u043C \u0434\u043B\u044F \u043B\u0438\u0446\u0430",category:"\u0414\u043B\u044F \u043B\u0438\u0446\u0430",asset:"beauty-jar",price:2,variants:["50 \u043C\u043B"],detail:["\u0422\u0435\u043A\u0441\u0442\u0443\u0440\u0430","\u041B\u0451\u0433\u043A\u0438\u0439 \u043A\u0440\u0435\u043C"]},{name:"\u041B\u043E\u0441\u044C\u043E\u043D \u0434\u043B\u044F \u0442\u0435\u043B\u0430",category:"\u0414\u043B\u044F \u0442\u0435\u043B\u0430",asset:"beauty-bottle-rose",price:1,variants:["200 \u043C\u043B"],detail:["\u0410\u0440\u043E\u043C\u0430\u0442","\u041D\u0435\u0439\u0442\u0440\u0430\u043B\u044C\u043D\u044B\u0439"]},{name:"\u0411\u0430\u043B\u044C\u0437\u0430\u043C \u0434\u043B\u044F \u0433\u0443\u0431",category:"\u0414\u043B\u044F \u043B\u0438\u0446\u0430",asset:"beauty-jar",price:0,variants:["15 \u043C\u043B"],detail:["\u0424\u0438\u043D\u0438\u0448","\u0411\u0435\u0437 \u0446\u0432\u0435\u0442\u0430"]},{name:"\u041A\u0440\u0435\u043C \u0434\u043B\u044F \u043D\u043E\u0433",category:"\u0414\u043B\u044F \u0442\u0435\u043B\u0430",asset:"beauty-tube",price:0,variants:["75 \u043C\u043B"],detail:["\u0422\u0435\u043A\u0441\u0442\u0443\u0440\u0430","\u041F\u043B\u043E\u0442\u043D\u044B\u0439 \u043A\u0440\u0435\u043C"]}]}];function j(e){return Ce.find(t=>t.id===e)}function Ue(){return Ce.map(({samples:e,...t})=>({...t,productCount:e.length}))}function q(e){return{theme:e.id,description:e.description,accentColor:e.accentColor,texts:{label_size:e.variantLabel,btn_add_size:"\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 "+e.variantLabel.toLowerCase()}}}function K(e,t){return e.samples.map((o,r)=>({name:o.name,category:o.category,description:"\u041F\u0440\u0438\u043C\u0435\u0440 \u0442\u043E\u0432\u0430\u0440\u0430 \u0434\u043B\u044F \u0434\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0448\u0430\u0431\u043B\u043E\u043D\u0430. \u0417\u0430\u043C\u0435\u043D\u0438\u0442\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435, \u0438\u043B\u043B\u044E\u0441\u0442\u0440\u0430\u0446\u0438\u044E, \u0446\u0435\u043D\u044B \u0438 \u043E\u0441\u0442\u0430\u0442\u043A\u0438 \u043F\u0435\u0440\u0435\u0434 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0435\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430.",brand:e.name,collection:"\u0411\u0430\u0437\u043E\u0432\u0430\u044F \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F",sku:e.id.toUpperCase()+"-"+String(r+1).padStart(3,"0"),attributes:[{label:o.detail[0],value:o.detail[1]}],photos:["/template-assets/"+o.asset+".svg"],prices:Object.fromEntries(t.map(a=>[a,gt[o.price][a]])),variants:o.variants.map(a=>({label:a,stock:10}))}))}var d=(e,t,...o)=>e.DB.prepare(t).bind(...o);async function le(e,t){let o=await d(e,"SELECT * FROM stores WHERE slug=?",t).first();return i(o,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),o}async function J(e,t,o){let r=await d(e,"SELECT * FROM stores WHERE id=? AND owner_id=?",t,o).first();return i(r,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),r}function M(e){return{id:e.id,slug:e.slug,name:e.name,status:e.status,version:e.version,acceptingOrders:e.orders_enabled===1,settings:JSON.parse(e.settings)}}async function $(e,t){let[o,r]=await e.DB.batch([d(e,"SELECT * FROM products WHERE store_id=? AND deleted_at IS NULL ORDER BY created_at,id LIMIT 501",t),d(e,"SELECT v.* FROM variants v JOIN products p ON p.id=v.product_id WHERE v.store_id=? AND p.deleted_at IS NULL AND v.archived=0",t)]);i(o.results.length<=500,"\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 \u043B\u0438\u043C\u0438\u0442 MVP",409);let a=o.results,n=r.results;return a.map(s=>({...JSON.parse(s.data),id:s.id,version:s.version,variants:n.filter(l=>l.product_id===s.id).map(l=>({id:String(l.id),label:String(l.label),stock:l.stock===null?null:Number(l.stock)}))}))}function ft(e,t,o,r){return r.map(a=>d(e,"INSERT INTO variants(id,store_id,product_id,label,stock) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,stock=excluded.stock,archived=0 WHERE variants.store_id=excluded.store_id AND variants.product_id=excluded.product_id",a.id,t,o,a.label,a.stock))}async function Y(e,t,o,r){let a=b(t);i(a.status===void 0||a.status==="demo","\u041D\u043E\u0432\u044B\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F \u043A\u0430\u043A \u0434\u0435\u043C\u043E");let n=u(a.name,200,!0),s=r??crypto.randomUUID(),l=u(a.templateId),c=l?j(l):void 0;i(!l||c,"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0448\u0430\u0431\u043B\u043E\u043D"),i(a.seedProducts===void 0||typeof a.seedProducts=="boolean","\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0432\u044B\u0431\u043E\u0440 \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u044B\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432"),i(!a.seedProducts||c,"\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0448\u0430\u0431\u043B\u043E\u043D \u0434\u043B\u044F \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u044B\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432");let p=c?q(c):{},m=b(a.settings??{}),w=B({...p,...m,texts:{...p.texts,...b(m.texts??{})},description:a.description??m.description??p.description,accentColor:a.accentColor??m.accentColor??p.accentColor},s),v=u(a.slug,80)||n.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"store";i(/^[a-z0-9][a-z0-9-]{0,79}$/.test(v),"Slug: \u043B\u0430\u0442\u0438\u043D\u0438\u0446\u0430, \u0446\u0438\u0444\u0440\u044B \u0438 \u0434\u0435\u0444\u0438\u0441"),await d(e,"SELECT id FROM stores WHERE slug=?",v).first()&&(v=v.slice(0,65)+"-"+crypto.randomUUID().slice(0,8));let f=a.products??(a.seedProducts&&c?K(c,w.currencies):[]);i(Array.isArray(f)&&f.length<=(r?500:200),"\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u0442\u043E\u0432\u0430\u0440\u043E\u0432");let g=f.map(y=>({id:crypto.randomUUID(),...H(y,w,s)})),E=g.map(y=>({id:y.id,data:JSON.stringify(y.data)})),T=g.flatMap(y=>y.variants.map(x=>({...x,productId:y.id})));return await e.DB.batch([d(e,"INSERT INTO stores(id,slug,name,settings) VALUES(?,?,?,?)",s,v,n,JSON.stringify(w)),d(e,"INSERT INTO products(id,store_id,data) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.data') FROM json_each(?)",s,JSON.stringify(E)),d(e,"INSERT INTO variants(id,store_id,product_id,label,stock) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.productId'),json_extract(value,'$.label'),json_extract(value,'$.stock') FROM json_each(?)",s,JSON.stringify(T))]),{id:s,slug:v,status:"demo",url:`${o}/demo/${v}`}}async function pe(e,t,o,r){let a=b(o),n=JSON.parse(t.settings),s=H(a,n,t.id,!!r),l=r??crypto.randomUUID(),c=[F(e,t)];if(r){let p=await d(e,"SELECT * FROM products WHERE store_id=? AND id=? AND deleted_at IS NULL",t.id,r).first();i(p,"\u0422\u043E\u0432\u0430\u0440 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404);let m=I(a.version,1,Number.MAX_SAFE_INTEGER);i(m===p.version,"\u0422\u043E\u0432\u0430\u0440 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A.",409);let w=await d(e,"SELECT id FROM variants WHERE store_id=? AND product_id=?",t.id,r).all();i(s.variants.every(f=>!a.variants||!a.variants.some(g=>g.id===f.id)||w.results.some(g=>g.id===f.id)),"\u0412\u0430\u0440\u0438\u0430\u043D\u0442 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0438\u0442 \u0434\u0440\u0443\u0433\u043E\u043C\u0443 \u0442\u043E\u0432\u0430\u0440\u0443"),c.push(d(e,"INSERT INTO mutation_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM products WHERE id=? AND store_id=? AND version=? AND deleted_at IS NULL) THEN 1 ELSE 0 END",r,t.id,m)),c.push(d(e,"UPDATE products SET data=?,version=version+1 WHERE store_id=? AND id=?",JSON.stringify(s.data),t.id,r));let v=s.variants.map(f=>f.id);c.push(d(e,`UPDATE variants SET archived=1 WHERE store_id=? AND product_id=? AND id NOT IN (${v.map(()=>"?").join(",")})`,t.id,r,...v))}else{let p=await d(e,"SELECT COUNT(*) n FROM products WHERE store_id=? AND deleted_at IS NULL",t.id).first();i((p?.n??0)<500,"\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 500 \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u0432 MVP",409),c.push(d(e,"INSERT INTO products(id,store_id,data) VALUES(?,?,?)",l,t.id,JSON.stringify(s.data)))}c.push(...ft(e,t.id,l,s.variants)),c.push(d(e,"DELETE FROM mutation_guards"));try{await e.DB.batch(c)}catch(p){throw String(p).includes("CHECK constraint")||String(p).includes("CATALOG_CHANGED")||String(p).includes("PRODUCT_LIMIT")?new O(409,"\u0422\u043E\u0432\u0430\u0440 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A."):p}return{id:l}}async function $e(e,t,o){let r=b(o),a=u(r.name,200,!0),n=B(r.settings,t.id),s=I(r.version,1,Number.MAX_SAFE_INTEGER),l=await $(e,t.id);i(l.every(p=>n.currencies.every(m=>p.prices[m]!==void 0)),"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0446\u0435\u043D\u044B \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u0432 \u043D\u043E\u0432\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u0435");let c;try{c=await d(e,"UPDATE stores SET name=?,settings=?,version=version+1 WHERE id=? AND owner_id IS ? AND version=?",a,JSON.stringify(n),t.id,t.owner_id,s).run()}catch(p){throw String(p).includes("CATALOG_CHANGED")?new O(409,"\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0446\u0435\u043D\u044B \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u0432 \u043D\u043E\u0432\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u0435."):p}i(c.meta.changes===1,"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u044B. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C.",409)}function F(e,t){return d(e,"INSERT INTO mutation_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM stores WHERE id=? AND owner_id IS ? AND version=?) THEN 1 ELSE 0 END",t.id,t.owner_id,t.version)}function bt(e){return typeof e=="string"&&/^ru(?:[-_]|$)/i.test(e)?"ru":"en"}async function V(e,t,o){let r=await d(e,"SELECT language,manual FROM telegram_preferences WHERE user_id=?",t).first();if(r?.manual)return r.language;if(typeof o!="string")return r?.language??"en";let a=bt(o);return r?.language!==a&&await d(e,"INSERT INTO telegram_preferences(user_id,language,manual) VALUES(?,?,0) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language WHERE manual=0",t,a).run(),a}async function De(e,t,o){await d(e,"INSERT INTO telegram_preferences(user_id,language,manual) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language,manual=1",t,o).run()}async function P(e,t){return(await d(e,"SELECT language FROM telegram_preferences WHERE user_id=?",t).first())?.language==="en"?"en":"ru"}var C={ru:{welcome:`\u{1F44B} \u041F\u0440\u0438\u0432\u0435\u0442! \u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0432 Delokay.

\u041C\u0435\u043D\u044C\u0448\u0435 \u0440\u0443\u0442\u0438\u043D\u044B. \u0411\u043E\u043B\u044C\u0448\u0435 \u0434\u0435\u043B\u0430. \u2728

\u041C\u044B \u0441\u043E\u0437\u0434\u0430\u0451\u043C \u043F\u0440\u043E\u0441\u0442\u044B\u0435 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0434\u043B\u044F \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0431\u0438\u0437\u043D\u0435\u0441\u043E\u043C. \u{1F6CD} \u041A\u0430\u0442\u0430\u043B\u043E\u0433\u0438 \u2014 \u043D\u0430\u0448 \u043F\u0435\u0440\u0432\u044B\u0439 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442: \u0442\u043E\u0432\u0430\u0440\u044B, \u0437\u0430\u043A\u0430\u0437\u044B \u0438 \u043C\u0430\u0433\u0430\u0437\u0438\u043D \u0432 Telegram.`,returning:`\u{1F44B} \u0421 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0435\u043C \u0432 Delokay!
\u0412\u0430\u0448\u0438 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u044B:`,noStore:`

\u041F\u043E\u043A\u0430 \u0443 \u0432\u0430\u0441 \u043D\u0435\u0442 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0445 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u0432. \u041F\u0435\u0440\u0435\u0434\u0430\u0439\u0442\u0435 \u0432\u0430\u0448 Telegram ID \u0441\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0441\u0442\u0443, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F.`,telegramId:"\u0412\u0430\u0448 Telegram ID: ",dashboard:"\u{1F680} \u041E\u0442\u043A\u0440\u044B\u0442\u044C Delokay",store:"\u{1F6CD} \u0423\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u043C",payments:"\u{1F4B3} \u041E\u043F\u043B\u0430\u0442\u0430",helpButton:"\u2753 \u041F\u043E\u043C\u043E\u0449\u044C",language:"\u{1F310} \u042F\u0437\u044B\u043A / Language",chooseLanguage:"\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u044F\u0437\u044B\u043A \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430:",languageSaved:"\u2705 \u042F\u0437\u044B\u043A \u0438\u0437\u043C\u0435\u043D\u0451\u043D \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u0438\u0439.",help:`\u2753 \u041F\u043E\u043C\u043E\u0449\u044C Delokay

/start \u2014 \u0433\u043B\u0430\u0432\u043D\u043E\u0435 \u043C\u0435\u043D\u044E
/shop \u2014 \u043F\u0430\u043D\u0435\u043B\u044C \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F
/pay \u2014 \u043E\u043F\u043B\u0430\u0442\u0430 \u0438 \u043F\u043E\u043A\u0443\u043F\u043A\u0438
/language \u2014 \u0432\u044B\u0431\u043E\u0440 \u044F\u0437\u044B\u043A\u0430
/help \u2014 \u044D\u0442\u0430 \u0441\u043F\u0440\u0430\u0432\u043A\u0430

\u0427\u0442\u043E\u0431\u044B \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D, \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0441\u0441\u044B\u043B\u043A\u0443 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F \u043E\u0442 \u0441\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0441\u0442\u0430. \u0414\u043B\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F Mini App \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043A\u043D\u043E\u043F\u043A\u0443 \xABDelokay\xBB \u0440\u044F\u0434\u043E\u043C \u0441 \u043F\u043E\u043B\u0435\u043C \u0432\u0432\u043E\u0434\u0430.`,connected:"\u2705 \u041C\u0430\u0433\u0430\u0437\u0438\u043D \xAB",connectedEnd:"\xBB \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D. \u0422\u0435\u043F\u0435\u0440\u044C \u0438\u043C \u043C\u043E\u0436\u043D\u043E \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u0432 Delokay.",claimError:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D.",statusSaved:"\u2705 \u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043A\u0430\u0437\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0451\u043D",orderNotFound:"\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",newOrder:"\u{1F4E6} \u041D\u043E\u0432\u044B\u0439 \u0437\u0430\u043A\u0430\u0437 \u2116",phone:"\u0422\u0435\u043B\u0435\u0444\u043E\u043D: ",total:"\u0418\u0442\u043E\u0433\u043E: ",accept:"\u041F\u0440\u0438\u043D\u044F\u0442\u044C",complete:"\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D",cancel:"\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C",openOrder:"\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0437\u0430\u043A\u0430\u0437"},en:{welcome:`\u{1F44B} Hey! Welcome to Delokay.

Less busywork. More business. \u2728

We create simple tools to manage your business. \u{1F6CD} Catalogs is our first tool: products, orders and your store right in Telegram.`,returning:`\u{1F44B} Welcome back to Delokay!
Your stores:`,noStore:`

No stores are connected yet. Share your Telegram ID with your specialist to receive an invitation link.`,telegramId:"Your Telegram ID: ",dashboard:"\u{1F680} Open Delokay",store:"\u{1F6CD} Manage store",payments:"\u{1F4B3} Payments",helpButton:"\u2753 Help",language:"\u{1F310} Language / \u042F\u0437\u044B\u043A",chooseLanguage:"Choose your interface language:",languageSaved:"\u2705 Language changed to English.",help:`\u2753 Delokay help

/start \u2014 main menu
/shop \u2014 dashboard
/pay \u2014 payments and purchases
/language \u2014 choose language
/help \u2014 this guide

To connect a store, follow the invitation link from your specialist. Open the Mini App with the \u201CDelokay\u201D button near the message field.`,connected:"\u2705 Store \u201C",connectedEnd:"\u201D connected. You can now manage it in Delokay.",claimError:"Could not connect the store.",statusSaved:"\u2705 Order status updated",orderNotFound:"Order not found",newOrder:"\u{1F4E6} New order #",phone:"Phone: ",total:"Total: ",accept:"Accept",complete:"Completed",cancel:"Cancel",openOrder:"Open order"}};var ue=new TextEncoder;async function U(e){return Pe(await crypto.subtle.digest("SHA-256",ue.encode(e)))}function Pe(e){return Array.from(new Uint8Array(e),t=>t.toString(16).padStart(2,"0")).join("")}async function Me(e,t){let o=await crypto.subtle.importKey("raw",e,{name:"HMAC",hash:"SHA-256"},!1,["sign"]);return crypto.subtle.sign("HMAC",o,ue.encode(t))}async function X(e,t){let[o,r]=await Promise.all([U(e),U(t)]),a=0;for(let n=0;n<o.length;n++)a|=o.charCodeAt(n)^r.charCodeAt(n);return a===0}async function Be(e,t){i(t.PLATFORM_API_KEY&&t.PLATFORM_API_KEY.length>=32,"\u041A\u043B\u044E\u0447 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u044B \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D",503),i(await X(e.headers.get("authorization")??"",`Bearer ${t.PLATFORM_API_KEY}`),"\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430",401)}async function He(e,t){i(t.TELEGRAM_BOT_TOKEN,"Telegram \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D",503);let o=e.headers.get("authorization")??"";i(o.startsWith("tma ")&&o.length<=16e3,"\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C \u0447\u0435\u0440\u0435\u0437 Telegram",401);let r=new URLSearchParams(o.slice(4)),a=new Set;for(let m of r.keys())i(!a.has(m),"\u041F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0438\u0439\u0441\u044F \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438",401),a.add(m);let n=r.get("hash")??"";i(/^[a-f0-9]{64}$/.test(n),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C",401),r.delete("hash");let s=[...r.entries()].sort(([m],[w])=>m.localeCompare(w)).map(([m,w])=>`${m}=${w}`).join(`
`),l=await Me(ue.encode("WebAppData"),t.TELEGRAM_BOT_TOKEN);i(await X(Pe(await Me(new Uint8Array(l),s)),n),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C",401);let c=Number(r.get("auth_date")),p=Math.floor(Date.now()/1e3);i(Number.isSafeInteger(c)&&c>0&&c<=p+30&&p-c<=3600,"\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C \u0437\u0430\u043D\u043E\u0432\u043E: \u0441\u0435\u0441\u0441\u0438\u044F \u0438\u0441\u0442\u0435\u043A\u043B\u0430",401);try{let m=JSON.parse(r.get("user")??"{}");return i(Number.isSafeInteger(m.id)&&m.id>0&&!m.is_bot,"\u041D\u0435\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F",401),String(m.id)}catch{throw new O(401,"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F")}}var Z=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;function me(e){i(e.TRIBUTE_API_KEY&&/^[1-9]\d{0,15}$/.test(e.TRIBUTE_SHOP_ID)&&Number.isSafeInteger(Number(e.TRIBUTE_SHOP_ID)),"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 TRIBUTE_API_KEY \u0438 TRIBUTE_SHOP_ID",503)}async function Q(e,t,o){me(e);let r=await fetch("https://tribute.tg/api/v1"+t,{method:o===void 0?"GET":"POST",headers:{"Api-Key":e.TRIBUTE_API_KEY,"Content-Type":"application/json"},body:o===void 0?void 0:JSON.stringify(o),signal:AbortSignal.timeout(1e4)});return i(r.ok,"Tribute \u043D\u0435 \u0441\u043C\u043E\u0433 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430.",502),r.json()}function ee(e){return{id:e.id,storeId:e.store_id,ownerId:e.owner_id,amountMinor:e.amount_minor,currency:e.currency,title:e.title,description:e.description,status:e.status,paymentUrl:e.payment_url,createdAt:e.created_at,paidAt:e.paid_at}}async function te(e){let t=N(e)+"/api/tribute/webhook";if(e.TRIBUTE_PRODUCT_URL){if(!e.TRIBUTE_API_KEY)return{configured:!1,webhookUrl:t,mode:"digital",paymentUrl:e.TRIBUTE_PRODUCT_URL};let r=await be(e);return{configured:!0,mode:"digital",webhookUrl:t,paymentUrl:he(r,e),productId:r.id,productType:r.type,productStatus:r.status,fulfillmentRequired:r.type==="custom",name:r.name,active:r.status==="approved",orderLinkAvailable:ye(r),cardsEnabled:r.acceptCards===!0,amountMinor:r.amount,currency:r.currency}}if(!e.TRIBUTE_API_KEY||!e.TRIBUTE_SHOP_ID)return{configured:!1,webhookUrl:t};me(e);let o=b(await Q(e,"/shop?shopId="+e.TRIBUTE_SHOP_ID));return{configured:!0,webhookUrl:t,shopId:o.id,name:o.name,active:o.status===1,cardsEnabled:o.onlyStars===!1,callbackMatches:o.callbackUrl===t}}async function z(e,t,o){return[...(await d(e,"SELECT * FROM platform_invoices WHERE (? IS NULL OR store_id=?) AND (? IS NULL OR owner_id=?) ORDER BY created_at DESC,id DESC LIMIT 50",t??null,t??null,o??null,o??null).all()).results.map(ee),...t?[]:await we(e,o)]}async function We(e,t,o){me(e),i(t.owner_id,"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430",409);let r=b(o),a=u(r.id,36,!0);i(Z.test(a),"\u0423\u043A\u0430\u0436\u0438\u0442\u0435 UUID \u0441\u0447\u0451\u0442\u0430 \u0434\u043B\u044F \u0437\u0430\u0449\u0438\u0442\u044B \u043E\u0442 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F");let n=I(r.amountMinor,100,3e7),s=u(r.currency,3,!0).toLowerCase();i(["eur","usd","rub"].includes(s),"Tribute: EUR, USD \u0438\u043B\u0438 RUB"),i(n>=(s==="rub"?1e4:100)&&n<=(s==="rub"?3e7:3e5),"\u0421\u0443\u043C\u043C\u0430 \u0432\u043D\u0435 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 Tribute");let l=u(r.title,100,!0),c=u(r.description,300,!0),p=await d(e,"SELECT * FROM platform_invoices WHERE id=?",a).first();if(p)return i(p.store_id===t.id&&p.owner_id===t.owner_id&&p.amount_minor===n&&p.currency===s&&p.title===l&&p.description===c,"UUID \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D \u0434\u043B\u044F \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0441\u0447\u0451\u0442\u0430",409),i(p.payment_url,"\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u044D\u0442\u043E\u0433\u043E \u0441\u0447\u0451\u0442\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0432 Tribute. \u041D\u0435 \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u0439\u0442\u0435 \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442.",409),ee(p);let m=b(await Q(e,"/shop?shopId="+e.TRIBUTE_SHOP_ID));i(m.id===Number(e.TRIBUTE_SHOP_ID)&&m.status===1&&m.onlyStars===!1,"\u041D\u0443\u0436\u0435\u043D \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0439 Tribute Shop \u0441 \u043E\u043F\u043B\u0430\u0442\u043E\u0439 \u043A\u0430\u0440\u0442\u0430\u043C\u0438",503),i(m.callbackUrl===N(e)+"/api/tribute/webhook","\u0423\u043A\u0430\u0436\u0438\u0442\u0435 webhook \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 Tribute Shop",503);let w=await d(e,"INSERT OR IGNORE INTO platform_invoices(id,store_id,owner_id,amount_minor,currency,title,description,tribute_shop_id) SELECT ?,id,owner_id,?,?,?,?,? FROM stores WHERE id=? AND owner_id=?",a,n,s,l,c,e.TRIBUTE_SHOP_ID,t.id,t.owner_id).run();i(w.meta.changes===1,"\u0421\u0447\u0451\u0442 \u0443\u0436\u0435 \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F \u0438\u043B\u0438 \u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F",409);try{let f=b(await Q(e,"/shop/orders",{shopId:Number(e.TRIBUTE_SHOP_ID),amount:n,currency:s,title:l,description:c,customerId:a,comment:"Catalog Factory "+a,period:"onetime",successUrl:"https://t.me/"+e.BOT_USERNAME+"?start=payments",failUrl:"https://t.me/"+e.BOT_USERNAME+"?start=payments",preferredPaymentMethods:[{type:"card"}]})),g=u(f.uuid,36,!0),E=u(f.paymentUrl,2e3,!0);i(Z.test(g)&&f.shopId===Number(e.TRIBUTE_SHOP_ID)&&f.amount===n&&f.currency===s&&f.period==="onetime"&&f.onlyStars!==!0,"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0441\u0447\u0451\u0442 Tribute",502);let T=new URL(E);i(T.protocol==="https:"&&!T.username&&!T.password&&(T.hostname==="tribute.tg"||T.hostname.endsWith(".tribute.tg")),"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430 Tribute",502),await d(e,"UPDATE platform_invoices SET remote_uuid=?,payment_url=?,status=CASE WHEN status IN ('creating','review') THEN 'pending' ELSE status END WHERE id=? AND (remote_uuid IS NULL OR remote_uuid=?)",g,E,a,g).run()}catch{throw await d(e,"UPDATE platform_invoices SET status='review' WHERE id=? AND status='creating'",a).run(),new O(502,"Tribute \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0441\u0447\u0451\u0442\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0433\u043E \u0432 \u043A\u0430\u0431\u0438\u043D\u0435\u0442\u0435; \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0441 \u044D\u0442\u0438\u043C UUID \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0441\u0442 \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442.")}let v=await d(e,"SELECT * FROM platform_invoices WHERE id=?",a).first();return i(v,"\u0421\u0447\u0451\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",500),ee(v)}async function je(e,t){i(t.TRIBUTE_API_KEY,"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 TRIBUTE_API_KEY",503);let o=new TextDecoder().decode(await W(e,64e3));i(await fe(o,e.headers.get("trbt-signature")??"",t.TRIBUTE_API_KEY),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C Tribute",401);let r;try{r=b(JSON.parse(o))}catch{throw new O(400,"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 webhook")}let a=u(r.name,100,!0);if(t.TRIBUTE_PRODUCT_URL&&["new_digital_product","digital_product_refunded"].includes(a))return ae(t,a,r.payload);if(!["shop_order","shop_order_refunded"].includes(a))return{status:"ignored"};let n=b(r.payload);if(String(n.shopId)!==t.TRIBUTE_SHOP_ID)return{status:"ignored"};let s=u(n.uuid,36,!0);i(Z.test(s),"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 UUID \u043F\u043B\u0430\u0442\u0435\u0436\u0430");let l=u(n.customerId,256),c=await d(t,"SELECT * FROM platform_invoices WHERE remote_uuid=? OR id=?",s,l).first();i(c,"\u0421\u0447\u0451\u0442 \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D",404),i(c.tribute_shop_id===t.TRIBUTE_SHOP_ID&&(!c.remote_uuid||c.remote_uuid===s)&&(!l||l===c.id),"\u041F\u043B\u0430\u0442\u0451\u0436 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u0447\u0451\u0442\u0443",409),i(n.currency===c.currency,"\u0412\u0430\u043B\u044E\u0442\u0430 \u043F\u043B\u0430\u0442\u0435\u0436\u0430 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u0447\u0451\u0442\u0443",409),a==="shop_order"&&i(n.status==="paid"&&n.amount===c.amount_minor&&n.isRecurrent===!1&&!n.isTrial,"\u041E\u043F\u043B\u0430\u0442\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430 \u0438\u043B\u0438 \u0441\u0443\u043C\u043C\u0430 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u0447\u0451\u0442\u0443",409);let p=await U(JSON.stringify([a,r.created_at,n])),m=a==="shop_order"?"paid":"refund_reported";return await t.DB.batch([d(t,"INSERT OR IGNORE INTO platform_payment_events(id,invoice_id,name) VALUES(?,?,?)",p,c.id,a),d(t,"UPDATE platform_invoices SET remote_uuid=COALESCE(remote_uuid,?),status=CASE WHEN status='refund_reported' THEN status ELSE ? END,paid_at=CASE WHEN ?='paid' THEN COALESCE(paid_at,unixepoch()) ELSE paid_at END WHERE id=?",s,m,m,c.id),d(t,"INSERT OR IGNORE INTO platform_payment_outbox(id,invoice_id,kind) VALUES(?,?,?)",m==="paid"?"paid:"+c.id:p,c.id,m)]),{status:"ok"}}async function Fe(e,t,o){let r=await d(e,"SELECT * FROM platform_invoices WHERE id=?",t).first();i(r,"\u0421\u0447\u0451\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404);let a=b(o),n=u(a.remoteUuid??r.remote_uuid,36,!0);i(Z.test(n)&&(!r.remote_uuid||r.remote_uuid===n),"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 UUID Tribute",409);let s=b(await Q(e,"/shop/orders/"+n));i(String(s.shopId)===r.tribute_shop_id&&s.amount===r.amount_minor&&s.currency===r.currency&&s.comment==="Catalog Factory "+r.id&&s.period==="onetime"&&!s.onlyStars,"\u0421\u0447\u0451\u0442 Tribute \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u044D\u0442\u043E\u043C\u0443 \u0441\u0447\u0451\u0442\u0443",409);let l=u(s.paymentUrl,2e3,!0),c=new URL(l);i(c.protocol==="https:"&&!c.username&&!c.password&&(c.hostname==="tribute.tg"||c.hostname.endsWith(".tribute.tg")),"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430 Tribute",502),await d(e,"UPDATE platform_invoices SET remote_uuid=?,payment_url=?,status=CASE WHEN status IN ('paid','refund_reported') THEN status WHEN ?='paid' THEN 'paid' ELSE 'pending' END,paid_at=CASE WHEN ?='paid' THEN COALESCE(paid_at,unixepoch()) ELSE paid_at END WHERE id=?",n,l,s.status==="paid"?"paid":"pending",s.status==="paid"?"paid":"pending",r.id).run(),s.status==="paid"&&await d(e,"INSERT OR IGNORE INTO platform_payment_outbox(id,invoice_id,kind) VALUES(?,?,'paid')","paid:"+r.id,r.id).run();let p=await d(e,"SELECT * FROM platform_invoices WHERE id=?",t).first();return i(p,"\u0421\u0447\u0451\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",500),ee(p)}async function ge(e,t,o){if(e.TRIBUTE_PRODUCT_URL){await ze(e,t,o);return}let r=o.startsWith("ru"),a=await z(e,void 0,t);if(!a.length){await R(e,"sendMessage",{chat_id:t,text:r?"\u0414\u043B\u044F \u0432\u0430\u0441 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u0447\u0435\u0442\u043E\u0432 \u043D\u0430 \u043E\u043F\u043B\u0430\u0442\u0443.":"You have no invoices yet."});return}for(let n of a.slice(0,10)){let s=n.status==="paid"?r?"\u041E\u043F\u043B\u0430\u0447\u0435\u043D\u043E":"Paid":n.status==="refund_reported"?r?"\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442":"Refund reported":r?"\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B":"Awaiting payment";await R(e,"sendMessage",{chat_id:t,text:n.title+`
`+n.description+`
`+(n.amountMinor/100).toFixed(2)+" "+n.currency.toUpperCase()+`
`+s,...n.paymentUrl&&n.status==="pending"?{reply_markup:{inline_keyboard:[[{text:r?"\u041E\u043F\u043B\u0430\u0442\u0438\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute":"Pay with Tribute",url:n.paymentUrl}]]}}:{}})}}async function G(e){if(await Ge(e),!e.TELEGRAM_BOT_TOKEN)return;let t=await d(e,"SELECT n.id,n.kind,i.owner_id,i.title,i.amount_minor,i.currency,i.status FROM platform_payment_outbox n JOIN platform_invoices i ON i.id=n.invoice_id WHERE n.sent_at IS NULL AND n.next_attempt<=unixepoch() AND n.lease_until<unixepoch() ORDER BY n.next_attempt LIMIT 5").all();for(let o of t.results){let r=await d(e,"UPDATE platform_payment_outbox SET lease_until=unixepoch()+60 WHERE id=? AND sent_at IS NULL AND lease_until<unixepoch() RETURNING attempts",o.id).first();if(r)try{let a=await P(e,o.owner_id);o.kind==="paid"&&o.status==="refund_reported"||await R(e,"sendMessage",{chat_id:o.owner_id,text:(o.kind==="paid"?a==="ru"?"\u2705 \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430":"\u2705 Payment confirmed":a==="ru"?"\u21A9\uFE0F \u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442":"\u21A9\uFE0F Refund reported")+`
`+o.title+`
`+(o.amount_minor/100).toFixed(2)+" "+o.currency.toUpperCase()}),await d(e,"UPDATE platform_payment_outbox SET sent_at=unixepoch(),lease_until=0 WHERE id=?",o.id).run()}catch{await d(e,"UPDATE platform_payment_outbox SET attempts=attempts+1,next_attempt=unixepoch()+?,lease_until=0 WHERE id=?",Math.min(86400,60*2**Math.min(r.attempts,10)),o.id).run(),console.warn(JSON.stringify({event:"payment_notification_retry"}))}}}async function fe(e,t,o){if(!o||!/^[a-f0-9]{64}$/i.test(t)||new TextEncoder().encode(e).length>64e3)return!1;let r=await crypto.subtle.importKey("raw",new TextEncoder().encode(o),{name:"HMAC",hash:"SHA-256"},!1,["verify"]),a=new Uint8Array(t.match(/.{2}/g).map(n=>parseInt(n,16)));return crypto.subtle.verify("HMAC",r,a,new TextEncoder().encode(e))}var Ee={ru:[{command:"start",description:"\u0413\u043B\u0430\u0432\u043D\u043E\u0435 \u043C\u0435\u043D\u044E"},{command:"shop",description:"\u041E\u0442\u043A\u0440\u044B\u0442\u044C Delokay"},{command:"pay",description:"\u041E\u043F\u043B\u0430\u0442\u0430 \u0438 \u043F\u043E\u043A\u0443\u043F\u043A\u0438"},{command:"help",description:"\u041F\u043E\u043C\u043E\u0449\u044C \u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438"},{command:"language",description:"\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u044F\u0437\u044B\u043A"}],en:[{command:"start",description:"Main menu"},{command:"shop",description:"Open Delokay"},{command:"pay",description:"Payments and purchases"},{command:"help",description:"Help and instructions"},{command:"language",description:"Choose language"}]};var qe={default:{name:"Delokay",short_description:"Simple business tools. Create catalogs and manage orders in Telegram.",description:`Less busywork. More business. \u2728

Delokay helps you run your business with simple digital tools.

\u{1F6CD} Create online product catalogs
\u{1F4E6} Manage products and orders
\u{1F310} Share your store with customers
\u26A1 Work right in Telegram

Open the dashboard to get started.`},ru:{name:"Delokay",short_description:"\u041F\u0440\u043E\u0441\u0442\u044B\u0435 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0434\u043B\u044F \u0431\u0438\u0437\u043D\u0435\u0441\u0430. \u041A\u0430\u0442\u0430\u043B\u043E\u0433\u0438 \u0438 \u0437\u0430\u043A\u0430\u0437\u044B \u0432 Telegram.",description:`\u041C\u0435\u043D\u044C\u0448\u0435 \u0440\u0443\u0442\u0438\u043D\u044B. \u0411\u043E\u043B\u044C\u0448\u0435 \u0434\u0435\u043B\u0430. \u2728

Delokay \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0442 \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u0431\u0438\u0437\u043D\u0435\u0441\u043E\u043C \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E \u043F\u0440\u043E\u0441\u0442\u044B\u0445 \u0446\u0438\u0444\u0440\u043E\u0432\u044B\u0445 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u043E\u0432.

\u{1F6CD} \u0421\u043E\u0437\u0434\u0430\u0432\u0430\u0439\u0442\u0435 \u043E\u043D\u043B\u0430\u0439\u043D-\u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0438
\u{1F4E6} \u0423\u043F\u0440\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0442\u043E\u0432\u0430\u0440\u0430\u043C\u0438 \u0438 \u0437\u0430\u043A\u0430\u0437\u0430\u043C\u0438
\u{1F310} \u0414\u0435\u043B\u0438\u0442\u0435\u0441\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u043C \u0441 \u043A\u043B\u0438\u0435\u043D\u0442\u0430\u043C\u0438
\u26A1 \u0420\u0430\u0431\u043E\u0442\u0430\u0439\u0442\u0435 \u043F\u0440\u044F\u043C\u043E \u0432 Telegram

\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F, \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C.`},en:{name:"Delokay",short_description:"Simple business tools. Create catalogs and manage orders in Telegram.",description:`Less busywork. More business. \u2728

Delokay helps you run your business with simple digital tools.

\u{1F6CD} Create online product catalogs
\u{1F4E6} Manage products and orders
\u{1F310} Share your store with customers
\u26A1 Work right in Telegram

Open the dashboard to get started.`}};async function Ke(e,t,o,r,a){i(t.status==="active","\u042D\u0442\u043E \u0434\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u044F. \u0420\u0435\u0430\u043B\u044C\u043D\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u044B \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B.",409),i(t.owner_id,"\u0412\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430 \u0435\u0449\u0451 \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D",409),i(/^[a-zA-Z0-9_-]{16,80}$/.test(r),"\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043A\u043B\u044E\u0447 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0430");let n=b(o),s=JSON.parse(t.settings),l=u(n.currency,3,!0);i(s.currencies.includes(l),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0432\u0430\u043B\u044E\u0442\u0430");let c=b(n.customer),p={name:u(c.name,100,!0),phone:u(c.phone,30,!0),address:u(c.address,500,!0),city:u(c.city,100),region:u(c.region,100),index:u(c.index,20),comment:u(c.comment,1e3),deliveryMethod:u(c.deliveryMethod,100,!0)};i(/^[+\d\s()-]{7,30}$/.test(p.phone),"\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043D\u043E\u043C\u0435\u0440 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430"),i(s.deliveryMethods.includes(p.deliveryMethod),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0441\u043F\u043E\u0441\u043E\u0431 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438");let m=n.items;i(Array.isArray(m)&&m.length>0&&m.length<=20,"\u041E\u0442 1 \u0434\u043E 20 \u043F\u043E\u0437\u0438\u0446\u0438\u0439 \u0432 \u0437\u0430\u043A\u0430\u0437\u0435");let w=m.map(k=>{let _=b(k);return{productId:u(_.productId,36,!0),variantId:u(_.variantId,36,!0),quantity:I(_.quantity,1,99),expectedUnitMinor:I(_.expectedUnitMinor,0,1e8)}}).sort((k,_)=>k.variantId.localeCompare(_.variantId));i(new Set(w.map(k=>k.variantId)).size===w.length,"\u041E\u0431\u044A\u0435\u0434\u0438\u043D\u0438\u0442\u0435 \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B");let v=await U(JSON.stringify({customer:p,currency:l,items:w})),f=await d(e,"SELECT * FROM orders WHERE store_id=? AND idempotency_key=?",t.id,r).first();if(f)return i(f.request_hash===v,"\u042D\u0442\u043E\u0442 \u043A\u043B\u044E\u0447 \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D \u0434\u043B\u044F \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0437\u0430\u043A\u0430\u0437\u0430",409),xe(f);i(t.orders_enabled===1,"\u041F\u0440\u0438\u0451\u043C \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D",409);let g=await $(e,t.id),E=w.map(k=>{let _=g.find(ne=>ne.id===k.productId),L=_?.variants.find(ne=>ne.id===k.variantId);i(_&&L,"\u0422\u043E\u0432\u0430\u0440 \u0438\u043B\u0438 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",409),i(_.availability!=="unavailable","\u0422\u043E\u0432\u0430\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D",409),i(_.availability==="preorder"||L.stock===null||L.stock>=k.quantity,"\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0442\u043E\u0432\u0430\u0440\u0430 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438",409);let D=Math.round(_.prices[l]*(100-_.discountPercent)/100);return i(Number.isSafeInteger(D),"\u0426\u0435\u043D\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430",409),i(k.expectedUnitMinor===D,"\u0426\u0435\u043D\u0430 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0438 \u043A\u043E\u0440\u0437\u0438\u043D\u0443.",409),{...k,name:_.name,variant:L.label,unitMinor:D,version:_.version,reserved:_.availability!=="preorder"&&L.stock!==null}}),T=E.reduce((k,_)=>k+_.unitMinor*_.quantity,0);i(Number.isSafeInteger(T)&&T<=1e9,"\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u0437\u0430\u043A\u0430\u0437\u0430");let y=crypto.randomUUID(),x=await U(t.id+":"+a);try{await d(e,"INSERT INTO orders(id,store_id,number,idempotency_key,request_hash,customer,items,currency,total_minor,ip_hash) VALUES(?,?,(SELECT COALESCE(MAX(number),0)+1 FROM orders WHERE store_id=?),?,?,?,?,?,?,?)",y,t.id,t.id,r,v,JSON.stringify(p),JSON.stringify(E),l,T,x).run()}catch(k){let _=await d(e,"SELECT * FROM orders WHERE store_id=? AND idempotency_key=?",t.id,r).first();if(_)return i(_.request_hash===v,"\u042D\u0442\u043E\u0442 \u043A\u043B\u044E\u0447 \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D \u0434\u043B\u044F \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0437\u0430\u043A\u0430\u0437\u0430",409),xe(_);let L=String(k);throw L.includes("RATE_LIMIT")?new O(429,"\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u0430\u0437\u043E\u0432. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435."):L.includes("CATALOG_CHANGED")||L.includes("STORE_NOT_ACTIVE")?new O(409,"\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0438 \u043A\u043E\u0440\u0437\u0438\u043D\u0443."):k}let S=await d(e,"SELECT * FROM orders WHERE id=? AND store_id=?",y,t.id).first();return i(S,"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0437\u0430\u043A\u0430\u0437",500),xe(S)}function xe(e){return{id:e.id,number:e.number,currency:e.currency,totalMinor:e.total_minor,status:e.status}}function ve(e){return{id:e.id,number:e.number,status:e.status,currency:e.currency,totalMinor:e.total_minor,createdAt:e.created_at,customer:JSON.parse(e.customer),items:JSON.parse(e.items)}}async function oe(e,t,o,r,a){let n=await d(e,"SELECT * FROM orders WHERE store_id=? AND id=?",t,o).first();i(n,"\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404);let s={new:["processing","completed","cancelled"],processing:["completed","cancelled"],completed:[],cancelled:[]};if(n.status===r)return;i(s[n.status]?.includes(r),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u0441\u0442\u0430\u0442\u0443\u0441\u0430",409);let l=await d(e,"UPDATE orders SET status=? WHERE id=? AND store_id=? AND status=? AND EXISTS(SELECT 1 FROM stores WHERE id=? AND owner_id IS ? AND version=?) RETURNING id",r,o,t,n.status,a.id,a.owner_id,a.version).first();i(l,"\u0421\u0442\u0430\u0442\u0443\u0441 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0437\u0430\u043A\u0430\u0437.",409)}async function R(e,t,o){i(e.TELEGRAM_BOT_TOKEN,"Telegram \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D",503);let r=await fetch(`https://api.telegram.org/bot${e.TELEGRAM_BOT_TOKEN}/${t}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o),signal:AbortSignal.timeout(8e3)}),a=await r.json();return i(r.ok&&a.ok,"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441 Telegram",502),a}function N(e){let t=new URL(e.PUBLIC_ORIGIN);return i(t.protocol==="https:"||t.hostname==="localhost"||t.hostname==="127.0.0.1","\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 PUBLIC_ORIGIN",503),t.origin}async function Xe(e,t,o){let r=b(o);i(!t.owner_id||r.transfer===!0,"\u0414\u043B\u044F \u0441\u043C\u0435\u043D\u044B \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0443",409);let a=u(r.telegramUserId,20,!0);i(/^[1-9]\d{0,15}$/.test(a),"\u0423\u043A\u0430\u0436\u0438\u0442\u0435 Telegram ID \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430"),i(a!==t.owner_id,"\u042D\u0442\u043E\u0442 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0443\u0436\u0435 \u0432\u043B\u0430\u0434\u0435\u0435\u0442 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u043C",409),i(/^[a-z0-9_]{5,32}$/i.test(e.BOT_USERNAME),"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 BOT_USERNAME",503);let n=crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"").slice(0,16),s=await U(n);return await e.DB.batch([F(e,t),d(e,"DELETE FROM owner_invites WHERE store_id=? AND used_at IS NULL",t.id),d(e,"INSERT INTO owner_invites(token_hash,store_id,expected_owner_id,source_owner_id,store_version,expires_at) SELECT ?,id,?,owner_id,version,unixepoch()+86400 FROM stores WHERE id=? AND version=?",s,a,t.id,t.version),d(e,"DELETE FROM mutation_guards")]),{url:`https://t.me/${e.BOT_USERNAME}?start=claim_${n}`,expiresIn:86400}}async function wt(e,t,o){let r=await U(t),a=await d(e,"UPDATE stores SET owner_id=?,version=version+1 WHERE EXISTS(SELECT 1 FROM owner_invites i WHERE i.store_id=stores.id AND i.token_hash=? AND i.expected_owner_id=? AND i.expires_at>unixepoch() AND i.used_at IS NULL AND stores.owner_id IS i.source_owner_id AND (i.store_version IS NULL OR stores.version=i.store_version)) RETURNING *",o,r,o).first();return i(a,"\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u043D\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E, \u0438\u0441\u0442\u0435\u043A\u043B\u043E \u0438\u043B\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u043E \u0434\u043B\u044F \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430",403),await d(e,"UPDATE owner_invites SET used_at=unixepoch() WHERE token_hash=?",r).run(),a}async function Je(e,t,o,r=!0){let a=C[o],n=await d(e,"SELECT * FROM stores WHERE owner_id=? ORDER BY created_at LIMIT 20",t).all();r&&await R(e,"sendMessage",{chat_id:t,text:n.results.length?a.returning:a.welcome+a.noStore+`

`+a.telegramId+t,reply_markup:{inline_keyboard:[[{text:a.dashboard,web_app:{url:N(e)+"/admin"}}],[{text:a.payments,callback_data:"menu:pay"},{text:a.helpButton,callback_data:"menu:help"}],[{text:a.language,callback_data:"menu:language"}]]}});for(let s of n.results)await R(e,"sendMessage",{chat_id:t,text:s.name+`
`+N(e)+`/${s.status==="demo"?"demo":"shop"}/${s.slug}`,reply_markup:{inline_keyboard:[[{text:a.store,web_app:{url:N(e)+`/admin?store=${s.id}`}}],[{text:a.payments,callback_data:"menu:pay"}]]}})}async function Ye(e,t,o){await R(e,"sendMessage",{chat_id:t,text:C[o].help,reply_markup:{inline_keyboard:[[{text:C[o].dashboard,web_app:{url:N(e)+"/admin"}}]]}})}async function Ve(e,t,o){await R(e,"sendMessage",{chat_id:t,text:C[o].chooseLanguage,reply_markup:{inline_keyboard:[[{text:"\u{1F1F7}\u{1F1FA} \u0420\u0443\u0441\u0441\u043A\u0438\u0439",callback_data:"lang:ru"},{text:"\u{1F1EC}\u{1F1E7} English",callback_data:"lang:en"}]]}})}async function Ze(e,t,o){i(t.TELEGRAM_WEBHOOK_SECRET&&await X(e.headers.get("X-Telegram-Bot-Api-Secret-Token")??"",t.TELEGRAM_WEBHOOK_SECRET),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 webhook",401);let r=b(o);if(r.callback_query){let a=b(r.callback_query),n=b(a.from),s=b(a.message??{}),l=b(s.chat??{});i(l.type==="private"&&String(l.id)===String(n.id),"\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0432 \u043B\u0438\u0447\u043D\u043E\u043C \u0447\u0430\u0442\u0435",403);let c=u(a.data,64),p=String(n.id);if(c.startsWith("lang:")&&["lang:ru","lang:en"].includes(c)){let f=c.slice(5);await De(t,p,f),await R(t,"answerCallbackQuery",{callback_query_id:u(a.id,200,!0),text:C[f].languageSaved}),await Je(t,p,f);return}if(["menu:pay","menu:help","menu:language"].includes(c)){let f=await V(t,p,n.language_code);await R(t,"answerCallbackQuery",{callback_query_id:u(a.id,200,!0)}),c==="menu:pay"&&await ge(t,p,f),c==="menu:help"&&await Ye(t,p,f),c==="menu:language"&&await Ve(t,p,f);return}let m=c.split(":");i(m.length===2&&["a","c","x"].includes(m[0]),"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430");let w=await V(t,p,n.language_code),v=C[w].statusSaved;try{let f=await d(t,"SELECT * FROM orders WHERE id=?",m[1]).first();i(f,"\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404);let g=await J(t,f.store_id,String(n.id));await oe(t,f.store_id,f.id,{a:"processing",c:"completed",x:"cancelled"}[m[0]],g)}catch(f){v=f instanceof Error?f.message:"\u041E\u0448\u0438\u0431\u043A\u0430"}await R(t,"answerCallbackQuery",{callback_query_id:u(a.id,200,!0),text:v});return}if(r.message){let a=b(r.message),n=b(a.chat),s=b(a.from??{});i(n.type==="private"&&String(n.id)===String(s.id),"\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043B\u0438\u0447\u043D\u044B\u0439 \u0447\u0430\u0442 \u0441 \u0431\u043E\u0442\u043E\u043C",403);let l=String(s.id);i(/^[1-9]\d{0,15}$/.test(l),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C");let c=u(a.text,4096),p=await V(t,l,s.language_code);if(c.startsWith("/start claim_"))try{let m=await wt(t,c.slice(13),l);await R(t,"sendMessage",{chat_id:l,text:C[p].connected+m.name+C[p].connectedEnd})}catch{await R(t,"sendMessage",{chat_id:l,text:C[p].claimError});return}if(/^\/(pay)(\s|$|@)/.test(c)||c==="/start payments"){await ge(t,l,p);return}if(/^\/(help)(\s|$|@)/.test(c)){await Ye(t,l,p);return}if(/^\/(language)(\s|$|@)/.test(c)){await Ve(t,l,p);return}/^\/(start|admin|shop)(\s|$|@)/.test(c)&&await Je(t,l,p)}}async function _e(e,t){if(!e.TELEGRAM_BOT_TOKEN)return;let o=await d(e,`SELECT o.*,s.owner_id,s.name AS store_name FROM notification_outbox n JOIN orders o ON o.id=n.order_id JOIN stores s ON s.id=o.store_id WHERE n.sent_at IS NULL AND n.next_attempt<=unixepoch() AND n.lease_until<unixepoch() ${t?"AND n.order_id=?":""} ORDER BY n.next_attempt LIMIT 10`,...t?[t]:[]).all();for(let r of o.results){let a=await d(e,"UPDATE notification_outbox SET lease_until=unixepoch()+60 WHERE order_id=? AND sent_at IS NULL AND lease_until<unixepoch() RETURNING attempts",r.id).first();if(a)try{let n=await P(e,r.owner_id),s=C[n],l=JSON.parse(r.customer),c=JSON.parse(r.items),p=`${r.store_name}
${s.newOrder}${r.number}
${l.name}
${s.phone}${l.phone}
${l.deliveryMethod}: ${l.address}
${l.city} ${l.region} ${l.index}
${c.map(m=>`${m.name} (${m.variant}) \xD7 ${m.quantity}`).join(`
`)}
${s.total}${(r.total_minor/100).toFixed(2)} ${r.currency}${l.comment?`
`+l.comment:""}`;await R(e,"sendMessage",{chat_id:r.owner_id,text:p.slice(0,4e3),reply_markup:{inline_keyboard:[[{text:s.accept,callback_data:"a:"+r.id},{text:s.complete,callback_data:"c:"+r.id}],[{text:s.openOrder,web_app:{url:N(e)+`/admin?store=${r.store_id}&order=${r.id}`}},{text:s.cancel,callback_data:"x:"+r.id}]]}}),await d(e,"UPDATE notification_outbox SET sent_at=unixepoch(),lease_until=0 WHERE order_id=?",r.id).run()}catch{let n=Math.min(86400,60*2**Math.min(a.attempts,10));await d(e,"UPDATE notification_outbox SET attempts=attempts+1,next_attempt=unixepoch()+?,lease_until=0 WHERE order_id=?",n,r.id).run(),console.warn(JSON.stringify({event:"telegram_notification_retry",orderId:r.id}))}}}async function Et(e){for(let t of["","ru","en"]){let o=qe[t==="ru"?"ru":"en"];for(let[r,a,n]of[["setMyName","name",o.name],["setMyShortDescription","short_description",o.short_description],["setMyDescription","description",o.description]])await R(e,r,{language_code:t,[a]:n})}}async function xt(e){for(let t of["default","all_private_chats"])for(let o of["","ru","en"])await R(e,"setMyCommands",{scope:{type:t},language_code:o,commands:o==="ru"?Ee.ru:Ee.en})}async function Te(e){let t=N(e);i(t.startsWith("https://"),"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 HTTPS PUBLIC_ORIGIN",503),i(/^[a-z0-9_]{5,32}$/i.test(e.BOT_USERNAME),"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 BOT_USERNAME",503),i(e.TELEGRAM_WEBHOOK_SECRET,"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 TELEGRAM_WEBHOOK_SECRET",503);let o=b((await R(e,"getMe",{})).result);return i(String(o.username).toLowerCase()===String(e.BOT_USERNAME).toLowerCase(),"BOT_USERNAME \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441 \u0431\u043E\u0442\u043E\u043C, \u043A\u043E\u0442\u043E\u0440\u043E\u043C\u0443 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0438\u0442 \u0442\u043E\u043A\u0435\u043D",409),await R(e,"setWebhook",{url:t+"/api/telegram/webhook",secret_token:e.TELEGRAM_WEBHOOK_SECRET,allowed_updates:["message","callback_query"]}),await xt(e),await Et(e),await R(e,"setChatMenuButton",{menu_button:{type:"web_app",text:"Delokay",web_app:{url:t+"/admin"}}}),{ok:!0,botUsername:e.BOT_USERNAME,webhookUrl:t+"/api/telegram/webhook"}}function ke(e){let t=e.TRIBUTE_PRODUCT_URL;return i(/^https:\/\/web\.tribute\.tg\/p\/[a-zA-Z0-9]+$/.test(t),"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 \u0441\u0441\u044B\u043B\u043A\u0443 \u0442\u043E\u0432\u0430\u0440\u0430 Tribute",503),t}async function Qe(e,t){i(e.TRIBUTE_API_KEY,"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 TRIBUTE_API_KEY",503);let o=await fetch("https://tribute.tg/api/v1"+t,{headers:{"Api-Key":e.TRIBUTE_API_KEY},signal:AbortSignal.timeout(1e4)});return i(o.ok,"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440 Tribute",502),b(await o.json())}async function be(e){let t=ke(e);for(let o=1;o<=10;o++){let r=await Qe(e,"/products?size=100&page="+o);i(Array.isArray(r.rows),"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0442\u043E\u0432\u0430\u0440\u043E\u0432 Tribute",502);let a=r.rows.map(b).find(n=>n.webLink===t);if(a)return i(["digital","custom"].includes(String(a.type)),"\u041D\u0443\u0436\u0435\u043D \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u0439 \u0442\u043E\u0432\u0430\u0440 \u0438\u043B\u0438 \u0442\u043E\u0432\u0430\u0440 \u043D\u0430 \u0437\u0430\u043A\u0430\u0437 Tribute",503),a;if(r.rows.length<100)break}i(!1,"\u0422\u043E\u0432\u0430\u0440 \u043F\u043E \u044D\u0442\u043E\u0439 \u0441\u0441\u044B\u043B\u043A\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0432\u0430\u0448\u0435\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0435 Tribute",503)}function ye(e){return e.status==="approved"||e.type==="custom"&&e.status==="new"}function he(e,t){let o=ke(t);return e.type==="custom"?"https://t.me/tribute/app?startapp=p"+o.split("/").at(-1):o}async function we(e,t){return(await d(e,"SELECT * FROM tribute_digital_purchases WHERE (? IS NULL OR owner_id=?) ORDER BY created_at DESC,purchase_id DESC LIMIT 50",t??null,t??null).all()).results.map(r=>({id:"digital:"+r.purchase_id,type:"digital",storeId:null,ownerId:r.owner_id,title:r.title,description:"",amountMinor:r.amount_minor,currency:r.currency,status:r.status,paymentUrl:null,createdAt:r.created_at,paidAt:null}))}async function ae(e,t,o){let r=b(o),a=I(r.product_id,1,Number.MAX_SAFE_INTEGER),n=await Qe(e,"/products/"+a);if(n.webLink!==ke(e)||!["digital","custom"].includes(String(n.type)))return{status:"ignored"};let s=String(I(r.purchase_id,1,Number.MAX_SAFE_INTEGER)),l=String(I(r.telegram_user_id,1,Number.MAX_SAFE_INTEGER)),c=I(r.amount,0,Number.MAX_SAFE_INTEGER),p=u(r.currency,3,!0).toLowerCase();i(["usd","eur","rub"].includes(p),"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0432\u0430\u043B\u044E\u0442\u0430 \u043E\u043F\u043B\u0430\u0442\u044B",400);let m=await d(e,"SELECT * FROM tribute_digital_purchases WHERE purchase_id=?",s).first();i(!m||m.owner_id===l&&m.product_id===a&&m.currency===p&&m.amount_minor===c,"\u041F\u043E\u043A\u0443\u043F\u043A\u0430 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u043E\u0439 \u043E\u043F\u043B\u0430\u0442\u0435",409);let w=t==="new_digital_product"?"paid":"refund_reported",v=u(r.product_name??n.name,300,!0);return await e.DB.batch([d(e,"INSERT INTO tribute_digital_purchases(purchase_id,owner_id,product_id,title,amount_minor,currency,status) VALUES(?,?,?,?,?,?,?) ON CONFLICT(purchase_id) DO UPDATE SET status=CASE WHEN tribute_digital_purchases.status='refund_reported' THEN tribute_digital_purchases.status ELSE excluded.status END",s,l,a,v,c,p,w),d(e,"INSERT OR IGNORE INTO tribute_digital_outbox(id,purchase_id,kind) VALUES(?,?,?)",w+":"+s,s,w)]),{status:"ok"}}async function ze(e,t,o){let r=o.startsWith("ru"),a=await be(e),n=await we(e,t);for(let s of n.slice(0,10))await R(e,"sendMessage",{chat_id:t,text:s.title+`
`+(s.amountMinor/100).toFixed(2)+" "+s.currency.toUpperCase()+`
`+(s.status==="paid"?r?"\u041E\u043F\u043B\u0430\u0447\u0435\u043D\u043E":"Paid":r?"\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442":"Refund reported")});if(!ye(a)){await R(e,"sendMessage",{chat_id:t,text:r?"\u0422\u043E\u0432\u0430\u0440 \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B.":"This product is not available for payment yet."});return}await R(e,"sendMessage",{chat_id:t,text:u(a.name,300,!0)+`
`+(I(a.amount,0,Number.MAX_SAFE_INTEGER)/100).toFixed(2)+" "+u(a.currency,3,!0).toUpperCase()+(a.type==="custom"?r?`
\u0422\u043E\u0432\u0430\u0440 \u043D\u0430 \u0437\u0430\u043A\u0430\u0437. \u041F\u0440\u043E\u0434\u0430\u0432\u0435\u0446 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0447\u0435\u0440\u0435\u0437 Tribute \u043F\u043E\u0441\u043B\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u0430 \u0438 \u043C\u043E\u0434\u0435\u0440\u0430\u0446\u0438\u0438.`:`
Made to order. The seller will send the result through Tribute after fulfillment and moderation.`:""),reply_markup:{inline_keyboard:[[{text:a.type==="custom"?r?"\u0417\u0430\u043A\u0430\u0437\u0430\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute":"Order with Tribute":r?"\u041E\u043F\u043B\u0430\u0442\u0438\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute":"Pay with Tribute",url:he(a,e)}]]}})}async function Ge(e){if(!e.TELEGRAM_BOT_TOKEN)return;let t=await d(e,"SELECT n.id,n.kind,p.owner_id,p.title,p.amount_minor,p.currency,p.status FROM tribute_digital_outbox n JOIN tribute_digital_purchases p ON p.purchase_id=n.purchase_id WHERE n.sent_at IS NULL AND n.next_attempt<=unixepoch() AND n.lease_until<unixepoch() ORDER BY n.next_attempt LIMIT 5").all();for(let o of t.results){let r=await d(e,"UPDATE tribute_digital_outbox SET lease_until=unixepoch()+60 WHERE id=? AND sent_at IS NULL AND lease_until<unixepoch() RETURNING attempts",o.id).first();if(r)try{let a=await P(e,o.owner_id);o.kind==="paid"&&o.status==="refund_reported"||await R(e,"sendMessage",{chat_id:o.owner_id,text:(o.kind==="paid"?a==="ru"?"\u2705 \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430":"\u2705 Payment confirmed":a==="ru"?"\u21A9\uFE0F \u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442":"\u21A9\uFE0F Refund reported")+`
`+o.title+`
`+(o.amount_minor/100).toFixed(2)+" "+o.currency.toUpperCase()}),await d(e,"UPDATE tribute_digital_outbox SET sent_at=unixepoch(),lease_until=0 WHERE id=?",o.id).run()}catch{await d(e,"UPDATE tribute_digital_outbox SET attempts=attempts+1,next_attempt=unixepoch()+?,lease_until=0 WHERE id=?",Math.min(86400,60*2**Math.min(r.attempts,10)),o.id).run()}}}async function et(e,t,o){let r=b(o);i(t.status==="active","\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0439\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D",409),i(typeof r.enabled=="boolean","\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u0440\u0438\u0451\u043C\u0430 \u0437\u0430\u043A\u0430\u0437\u043E\u0432");let a=await d(e,"UPDATE stores SET orders_enabled=?,version=version+1 WHERE id=? AND version=?",r.enabled?1:0,t.id,I(r.version,1,Number.MAX_SAFE_INTEGER)).run();return i(a.meta.changes===1,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0438\u0437\u043C\u0435\u043D\u0451\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A.",409),{ok:!0}}async function tt(e,t,o){let r=b(o);i(t.status==="demo","\u041C\u043E\u0436\u043D\u043E \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u0435\u043C\u043E",409),i(r.confirmSlug===t.slug,"\u0414\u043B\u044F \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F \u0432\u0432\u0435\u0434\u0438\u0442\u0435 slug \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430"),i(I(r.version,1,Number.MAX_SAFE_INTEGER)===t.version,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0438\u0437\u043C\u0435\u043D\u0451\u043D",409),i(!await d(e,"SELECT id FROM platform_invoices WHERE store_id=? LIMIT 1",t.id).first(),"\u0414\u0435\u043C\u043E \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0441\u0447\u0435\u0442\u0430 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u0434\u043B\u044F \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439",409);try{await e.DB.batch([F(e,t),d(e,"INSERT INTO mutation_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM stores WHERE id=? AND status='demo') AND NOT EXISTS(SELECT 1 FROM orders WHERE store_id=?) THEN 1 ELSE 0 END",t.id,t.id),d(e,"INSERT OR IGNORE INTO media_cleanup(store_id) VALUES(?)",t.id),d(e,"DELETE FROM owner_invites WHERE store_id=?",t.id),d(e,"DELETE FROM variants WHERE store_id=?",t.id),d(e,"DELETE FROM products WHERE store_id=?",t.id),d(e,"DELETE FROM stores WHERE id=?",t.id),d(e,"DELETE FROM mutation_guards")])}catch(a){throw String(a).includes("CHECK constraint")?new O(409,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0438\u0437\u043C\u0435\u043D\u0451\u043D \u0438\u043B\u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0437\u0430\u043A\u0430\u0437\u044B. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A."):a}}async function Se(e){let t=await d(e,"SELECT store_id FROM media_cleanup LIMIT 1").first();if(t)try{let o=await e.IMAGES.list({prefix:t.store_id+"/",limit:200});o.objects.length&&await e.IMAGES.delete(o.objects.map(r=>r.key)),o.truncated||await d(e,"DELETE FROM media_cleanup WHERE store_id=?",t.store_id).run()}catch{console.error(JSON.stringify({event:"media_cleanup_retry"}))}}async function at(e,t,o){let r=b(o),a=crypto.randomUUID(),n=crypto.randomUUID(),s=[],l=new Map;function c(g){if(!g.startsWith("/media/"))return g;if(i(g.startsWith("/media/"+t.id+"/"),"\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430"),!l.has(g)){let E=g.slice(g.lastIndexOf(".")),T=a+"/"+crypto.randomUUID()+E;s.push({source:g.slice(7),target:T}),l.set(g,"/media/"+T)}return l.get(g)}let p=JSON.parse(t.settings);p.logo=c(p.logo);let m=(await $(e,t.id)).map(g=>({...g,id:void 0,version:void 0,photos:g.photos.map(c),variants:g.variants.map(E=>({label:E.label,stock:E.stock}))})),w=u(r.name,200,!0),v=u(r.slug,80,!0);i(/^[a-z0-9][a-z0-9-]{0,79}$/.test(v),"Slug: \u043B\u0430\u0442\u0438\u043D\u0438\u0446\u0430, \u0446\u0438\u0444\u0440\u044B \u0438 \u0434\u0435\u0444\u0438\u0441");let f=JSON.stringify({name:w,slug:v,settings:p,products:m});return i(new TextEncoder().encode(f+JSON.stringify(s)).length<18e5,"\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0434\u043B\u044F \u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F"),await d(e,"INSERT INTO store_copy_jobs(id,target_id,name,payload,files) VALUES(?,?,?,?,?)",n,a,w,f,JSON.stringify(s)).run(),{id:n,status:"pending"}}async function ot(e){return(await d(e,"SELECT id,target_id AS targetId,name,status,error,cursor AS copied,json_array_length(files) AS total FROM store_copy_jobs ORDER BY created_at DESC LIMIT 50").all()).results}async function re(e,t,o,r=4){let a=await d(e,"UPDATE store_copy_jobs SET lease_until=unixepoch()+300 WHERE id=(SELECT id FROM store_copy_jobs WHERE status='pending' AND lease_until<unixepoch() AND (? IS NULL OR id=?) ORDER BY created_at LIMIT 1) RETURNING *",o??null,o??null).first();if(a)try{let n=JSON.parse(a.files),s=Math.min(n.length,a.cursor+r);for(let l=a.cursor;l<s;l++){let c=await e.IMAGES.get(n[l].source);i(c,"\u0418\u0441\u0445\u043E\u0434\u043D\u043E\u0435 \u0444\u043E\u0442\u043E \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E",409),await e.IMAGES.put(n[l].target,c.body,{httpMetadata:c.httpMetadata,customMetadata:c.customMetadata})}s===n.length?(await d(e,"SELECT id FROM stores WHERE id=?",a.target_id).first()||await Y(e,JSON.parse(a.payload),t,a.target_id),await d(e,"UPDATE store_copy_jobs SET status='completed',cursor=?,lease_until=0 WHERE id=?",s,a.id).run()):await d(e,"UPDATE store_copy_jobs SET cursor=?,lease_until=0 WHERE id=?",s,a.id).run()}catch{await d(e,"SELECT id FROM stores WHERE id=?",a.target_id).first()?await d(e,"UPDATE store_copy_jobs SET status='completed',lease_until=0 WHERE id=?",a.id).run():await e.DB.batch([d(e,"UPDATE store_copy_jobs SET status='failed',error=?,lease_until=0 WHERE id=?","\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438 \u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435.",a.id),d(e,"INSERT OR IGNORE INTO media_cleanup(store_id) VALUES(?)",a.target_id)])}}var rt=e=>e.replace(/<script defer src="\/admin-i18n\.js[^"]*"><\/script>/,"").replace("</head>",`<style id="delokay-theme-inline">${se}</style></head>`).replace("</body>",`<script id="delokay-language-inline">${ie}<\/script></body>`);function h(e,t=200){return new Response(JSON.stringify(e),{status:t,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}async function _t(e,t,o){let r=o.id,a=await W(e,3*1024*1024);i(a.length>=12,"\u041F\u0443\u0441\u0442\u043E\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435");let n="",s="";a[0]===255&&a[1]===216&&a[2]===255?(n="jpg",s="image/jpeg"):[137,80,78,71,13,10,26,10].every((p,m)=>a[m]===p)?(n="png",s="image/png"):new TextDecoder().decode(a.slice(0,4))==="RIFF"&&new TextDecoder().decode(a.slice(8,12))==="WEBP"&&(n="webp",s="image/webp"),i(n&&e.headers.get("content-type")===s,"\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E JPEG, PNG \u0438 WebP",415);let l=r+"/"+crypto.randomUUID()+"."+n;await t.IMAGES.put(l,a,{httpMetadata:{contentType:s,cacheControl:"public, max-age=31536000, immutable"}});let c=await d(t,"SELECT version,owner_id FROM stores WHERE id=?",r).first();if(!c||c.owner_id!==o.owner_id||c.version!==o.version)throw await t.IMAGES.delete(l),new O(409,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0438\u0437\u043C\u0435\u043D\u0451\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C.");return{url:"/media/"+l}}async function Tt(e,t,o){let r=new URL(e.url),a=r.pathname,n=e.method;if(a==="/api/tribute/webhook"&&n==="POST"){let g=await je(e,t);return o.waitUntil(G(t)),h(g)}if(["/platform.js","/platform/app.js"].includes(a)&&(n==="GET"||n==="HEAD"))return new Response(n==="HEAD"?null:Re,{headers:{"Content-Type":"application/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"}});if(["/admin-i18n.js","/admin.css"].includes(a)&&(n==="GET"||n==="HEAD"))return new Response(n==="HEAD"?null:a.endsWith(".css")?se:ie,{headers:{"Content-Type":a.endsWith(".css")?"text/css; charset=utf-8":"application/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"}});if(["/admin","/admin/","/admin.html","/admin.js","/admin/app.js"].includes(a)&&(n==="GET"||n==="HEAD"))return new Response(n==="HEAD"?null:a.endsWith(".js")?Oe:rt(Ie),{headers:{"Content-Type":a.endsWith(".js")?"application/javascript; charset=utf-8":"text/html; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"}});if(["/platform","/platform/","/platform.html","/platform/editor","/platform-editor.html"].includes(a)&&(n==="GET"||n==="HEAD")){let g=a==="/platform/editor"||a==="/platform-editor.html";return new Response(n==="HEAD"?null:g?rt(Ae):Ne,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","Content-Security-Policy":g?"frame-ancestors 'self'":"frame-ancestors 'none'"}})}if(a==="/api/health"&&n==="GET")return h({ok:!0});if(a==="/api/templates"&&n==="GET")return h(Ue());let s=a.match(/^\/api\/templates\/([a-z]+)$/);if(s&&n==="GET"){let g=j(s[1]);i(g,"\u0428\u0430\u0431\u043B\u043E\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404);let E="00000000-0000-0000-0000-000000000000",T=B(q(g));return h({store:{id:E,slug:g.id,name:g.name,status:"demo",version:1,acceptingOrders:!1,settings:T},products:K(g,T.currencies).map((y,x)=>{let S=H(y,T,E);return{...S.data,variants:S.variants,id:"preview-"+x,version:1}})})}if(a==="/api/telegram/webhook"&&n==="POST")return await Ze(e,t,await A(e,64e3)),h({ok:!0});if(a.startsWith("/api/platform/")){if(await Be(e,t),a==="/api/platform/payments/config"&&n==="GET")return h(await te(t));if(a==="/api/platform/payments"&&n==="GET")return h(await z(t));let g=a.match(/^\/api\/platform\/stores\/([a-f0-9-]{36})\/invoices$/);if(g){if(n==="GET")return h(await z(t,g[1]));if(n==="POST"){let x=await d(t,"SELECT * FROM stores WHERE id=?",g[1]).first();return i(x,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),h(await We(t,x,await A(e)),201)}}let E=a.match(/^\/api\/platform\/invoices\/([a-f0-9-]{36})\/reconcile$/);if(E&&n==="POST"){let x=await Fe(t,E[1],await A(e));return o.waitUntil(G(t)),h(x)}if(a==="/api/platform/telegram/setup"&&n==="POST")return h(await Te(t));if(a==="/api/platform/config"&&n==="GET")return h({publicOrigin:N(t),botUsername:t.BOT_USERNAME});if(a==="/api/platform/stores"&&n==="GET"){let x=await d(t,"SELECT * FROM stores ORDER BY created_at DESC,id LIMIT 200").all();return h(x.results.map(S=>({...M(S),ownerLinked:!!S.owner_id})))}if(a==="/api/platform/stores"&&n==="POST")return h(await Y(t,await A(e),N(t)),201);if(a==="/api/platform/copies"&&n==="GET")return h(await ot(t));let T=a.match(/^\/api\/platform\/copies\/([a-f0-9-]{36})\/continue$/);if(T&&n==="POST")return await re(t,N(t),T[1]),h({ok:!0});let y=a.match(/^\/api\/platform\/stores\/([a-f0-9-]{36})\/(invite|activate|export|intake|copy|delete-demo)$/);if(y){let x=await d(t,"SELECT * FROM stores WHERE id=?",y[1]).first();if(i(x,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),y[2]==="intake"&&n==="POST")return h(await et(t,x,await A(e)));if(y[2]==="copy"&&n==="POST"){let S=await at(t,x,await A(e));return o.waitUntil(re(t,N(t),S.id)),h(S,202)}if(y[2]==="delete-demo"&&n==="POST")return await tt(t,x,await A(e)),o.waitUntil(Se(t)),h({ok:!0});if(y[2]==="invite"&&n==="POST")return h(await Xe(t,x,await A(e)));if(y[2]==="activate"&&n==="POST")return i(x.owner_id,"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430",409),i(t.TELEGRAM_BOT_TOKEN&&t.TELEGRAM_WEBHOOK_SECRET,"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 Telegram",503),await d(t,"UPDATE stores SET status='active',version=version+1 WHERE id=? AND version=? AND owner_id IS ?",x.id,x.version,x.owner_id).run(),h({url:N(t)+"/shop/"+x.slug});if(y[2]==="export"&&n==="GET")return h({schemaVersion:1,...M(x),products:await $(t,x.id)})}}if(a.startsWith("/api/admin/")||a.startsWith("/api/platform/")){let g=a.startsWith("/api/platform/"),E=g?null:await He(e,t);if(a==="/api/admin/payments/config"&&n==="GET")return h(await te(t));if(a==="/api/admin/payments"&&n==="GET")return h(await z(t,void 0,E));if(a==="/api/admin/stores"&&n==="GET"){let y=await d(t,"SELECT * FROM stores WHERE owner_id=? ORDER BY created_at LIMIT 50",E).all();return h(y.results.map(M))}let T=a.match(/^\/api\/(?:admin|platform)\/stores\/([a-f0-9-]{36})(?:\/(products|orders|settings|images)(?:\/([a-f0-9-]{36}))?)?$/);if(T){let y=g?await d(t,"SELECT * FROM stores WHERE id=?",T[1]).first():await J(t,T[1],E),x=T[2],S=T[3];if(i(y,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),!x&&n==="GET"){let k=await d(t,"SELECT (SELECT COUNT(*) FROM products WHERE store_id=? AND deleted_at IS NULL) productCount,(SELECT COUNT(*) FROM orders WHERE store_id=? AND status='new') newOrderCount",y.id,y.id).first();return h({...M(y),stats:k})}if(x==="products"&&!S&&n==="GET")return h(await $(t,y.id));if(x==="products"&&!S&&n==="POST")return h(await pe(t,y,await A(e)),201);if(x==="products"&&S&&n==="PUT")return h(await pe(t,y,await A(e),S));if(x==="products"&&S&&n==="DELETE"){let k=b(await A(e)),_=I(k.version,1,Number.MAX_SAFE_INTEGER),L=await d(t,"UPDATE products SET deleted_at=unixepoch(),version=version+1 WHERE store_id=? AND id=? AND deleted_at IS NULL AND version=? AND EXISTS(SELECT 1 FROM stores WHERE id=? AND owner_id IS ? AND version=?)",y.id,S,_,y.id,y.owner_id,y.version).run();return i(L.meta.changes===1,"\u0422\u043E\u0432\u0430\u0440 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D \u0438\u043B\u0438 \u0443\u0434\u0430\u043B\u0451\u043D",409),h({ok:!0})}if(x==="orders"&&n==="GET"){if(S){let D=await d(t,"SELECT * FROM orders WHERE store_id=? AND id=?",y.id,S).first();return i(D,"\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),h(ve(D))}let k=Number(r.searchParams.get("offset")??0);i(Number.isInteger(k)&&k>=0&&k<=1e5,"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430");let _=r.searchParams.get("status")??"";i(!_||["new","processing","completed","cancelled"].includes(_),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441");let L=await d(t,`SELECT * FROM orders WHERE store_id=? ${_?"AND status=?":""} ORDER BY created_at DESC,number DESC LIMIT 50 OFFSET ?`,y.id,..._?[_]:[],k).all();return h(L.results.map(ve))}if(x==="orders"&&S&&n==="PATCH")return await oe(t,y.id,S,u(b(await A(e)).status,20,!0),y),h({ok:!0});if(x==="settings"&&!S&&n==="PUT")return await $e(t,y,await A(e)),h({ok:!0});if(x==="images"&&!S&&n==="POST")return h(await _t(e,t,y),201)}}let l=a.match(/^\/api\/stores\/([a-z0-9-]{1,80})(?:\/(orders))?$/);if(l){let g=await le(t,l[1]);if(n==="GET"&&!l[2])return h({store:M(g),products:await $(t,g.id)});if(n==="POST"&&l[2]){let E=await Ke(t,g,await A(e,32e3),e.headers.get("Idempotency-Key")??"",e.headers.get("CF-Connecting-IP")??"local");return o.waitUntil(_e(t,E.id)),h(E,201)}}if(a.startsWith("/api/"))throw new O(404,"API \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D");if(a.startsWith("/media/")&&(n==="GET"||n==="HEAD")){i(/^\/media\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(a),"\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",404);let g=await t.IMAGES.get(a.slice(7));i(g,"\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",404);let E=new Headers;return g.writeHttpMetadata(E),E.set("ETag",g.httpEtag),E.set("X-Content-Type-Options","nosniff"),E.set("Content-Security-Policy","default-src 'none'"),new Response(n==="HEAD"?null:g.body,{headers:E})}let c=a;a==="/"&&(c="/welcome.html"),(a==="/admin"||a==="/admin/")&&(c="/admin.html"),(a==="/platform"||a==="/platform/")&&(c="/platform.html"),a==="/platform/editor"&&(c="/platform-editor.html");let p=a.match(/^\/templates\/([a-z]+)\/?$/);p&&(i(j(p[1]),"\u0428\u0430\u0431\u043B\u043E\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),c="/storefront.html");let m=a.match(/^\/(demo|shop)\/([a-z0-9-]{1,80})\/?$/);if(m){let g=await le(t,m[2]),E=g.status==="demo"?"demo":"shop";if(m[1]!==E)return Response.redirect(r.origin+"/"+E+"/"+g.slug,302);c="/storefront.html"}let w=new URL(e.url);w.pathname=c;let v=await t.ASSETS.fetch(new Request(w.toString(),{method:n,headers:e.headers})),f=new Response(v.body,v);return f.headers.set("X-Content-Type-Options","nosniff"),f.headers.set("Referrer-Policy","strict-origin-when-cross-origin"),(a==="/platform"||a==="/platform/"||a==="/platform.html")&&f.headers.set("Content-Security-Policy","frame-ancestors 'none'"),(a==="/platform/editor"||a==="/platform-editor.html")&&f.headers.set("Content-Security-Policy","frame-ancestors 'self'"),f}var Da={async fetch(e,t,o){try{return await Tt(e,t,o)}catch(r){return r instanceof O?h({error:r.message},r.status):(console.error(JSON.stringify({event:"request_failed",path:new URL(e.url).pathname})),h({error:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435."},500))}},async scheduled(e,t,o){o.waitUntil((async()=>{(await d(t,"SELECT username FROM telegram_bot_setup WHERE id=1").first())?.username!==t.BOT_USERNAME&&(await Te(t),await d(t,"INSERT INTO telegram_bot_setup(id,username,configured_at) VALUES(1,?,unixepoch()) ON CONFLICT(id) DO UPDATE SET username=excluded.username,configured_at=excluded.configured_at",t.BOT_USERNAME).run())})().catch(()=>console.error(JSON.stringify({event:"telegram_setup_retry",username:t.BOT_USERNAME})))),o.waitUntil(_e(t)),o.waitUntil(G(t)),await re(t,N(t),void 0,2),await Se(t),await d(t,"DELETE FROM owner_invites WHERE expires_at<unixepoch()-86400").run()}},nt=class extends vt{async verifySignature(t,o){return fe(t,o,this.env.TRIBUTE_API_KEY)}async inspect(){return te(this.env)}async gatewayProbe(){let t=JSON.stringify({name:"integration_probe",payload:{}}),o=await crypto.subtle.importKey("raw",new TextEncoder().encode(this.env.TRIBUTE_API_KEY),{name:"HMAC",hash:"SHA-256"},!1,["sign"]),r=await crypto.subtle.sign("HMAC",o,new TextEncoder().encode(t)),a=Array.from(new Uint8Array(r),s=>s.toString(16).padStart(2,"0")).join(""),n=await this.env.LEELA_PAYMENTS.fetch(new Request("https://internal/tribute/webhook",{method:"POST",headers:{"Content-Type":"application/json","trbt-signature":a},body:t}));return{status:n.status,result:await n.json()}}async receiveEvent(t){i(typeof t=="string"&&new TextEncoder().encode(t).length<=64e3,"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435");let o=b(JSON.parse(t)),r=u(o.name,100,!0);if(!["new_digital_product","digital_product_refunded"].includes(r))return{status:"ignored"};let a=await ae(this.env,r,o.payload);return this.ctx.waitUntil(G(this.env)),a}};export{nt as CatalogTributeBridge,Da as default};
