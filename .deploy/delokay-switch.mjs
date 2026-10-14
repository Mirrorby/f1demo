import{WorkerEntrypoint as he}from"cloudflare:workers";var vt=`'use strict';
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
`;var It=`'use strict';
const tg = window.Telegram?.WebApp;
const platformMode = document.body.dataset.mode === 'platform';
let platformKey = '';
function emptyStore() {
  document.getElementById('store-name').textContent = '\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D';
  main.innerHTML =
    '<div class="card"><h2>\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D</h2><p>\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u0443\u044E \u0441\u0441\u044B\u043B\u043A\u0443 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F \u043E\u0442 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u0430 \u0438 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0435\u0451 \u0432 Telegram.</p><p>\u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u0437\u0430\u043A\u0430\u0437 \u043D\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0441\u0430\u0439\u0442\u0430 \u043C\u043E\u0436\u043D\u043E \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u041E\u043F\u043B\u0430\u0442\u0430\xBB.</p><button class="primary" data-tab="payments">\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043A \u043E\u043F\u043B\u0430\u0442\u0435</button></div>';
}
function paymentButton(url, label) {
  return \`<button class="primary" data-payment-url="\${esc(url)}">\${esc(label)}</button>\`;
}
async function showPayments(seq) {
  main.innerHTML = '<h2>\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0441\u043B\u0443\u0433</h2><p>\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0434\u0430\u043D\u043D\u044B\u0435 Tribute\u2026</p>';
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
  main.innerHTML = \`<h2>\u041E\u043F\u043B\u0430\u0442\u0430 \u0443\u0441\u043B\u0443\u0433</h2><p>\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0441\u0430\u0439\u0442\u0430-\u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430.</p>
    \${
      config.mode === 'digital'
        ? \`<div class="card"><h3>\${esc(config.name || '\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0441\u0430\u0439\u0442\u0430')}</h3>\${config.configured ? \`<p>\${(config.amountMinor / 100).toFixed(2)} \${esc(String(config.currency).toUpperCase())}</p>\` : ''}
    \${config.fulfillmentRequired ? '<p>\u0422\u043E\u0432\u0430\u0440 \u043D\u0430 \u0437\u0430\u043A\u0430\u0437. \u041F\u0440\u043E\u0434\u0430\u0432\u0435\u0446 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0447\u0435\u0440\u0435\u0437 Tribute \u043F\u043E\u0441\u043B\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u0430 \u0438 \u043C\u043E\u0434\u0435\u0440\u0430\u0446\u0438\u0438.</p>' : ''}
    \${canOrder && config.paymentUrl ? paymentButton(config.paymentUrl, config.fulfillmentRequired ? '\u0417\u0430\u043A\u0430\u0437\u0430\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute' : '\u041E\u043F\u043B\u0430\u0442\u0438\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute') : '<p>\u0422\u043E\u0432\u0430\u0440 \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0434\u043B\u044F \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u0430.</p>'}</div>\`
        : ''
    }
    <h3>\u041C\u043E\u0438 \u043F\u043E\u043A\u0443\u043F\u043A\u0438 \u0438 \u0441\u0447\u0435\u0442\u0430</h3>\${purchases.map((p) => \`<div class="card"><h3>\${esc(p.title)}</h3><p>\${(p.amountMinor / 100).toFixed(2)} \${esc(p.currency.toUpperCase())}</p><p>\${esc(labels[p.status] || p.status)}</p>\${p.paymentUrl && p.status === 'pending' ? paymentButton(p.paymentUrl, '\u041E\u043F\u043B\u0430\u0442\u0438\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute') : ''}</div>\`).join('') || '<p>\u041F\u043E\u043A\u0443\u043F\u043E\u043A \u0438 \u0441\u0447\u0435\u0442\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.</p>'}
    <button data-tab="payments">\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443</button>\`;
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
  generation = 0;
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
    .map(([c, v]) => (v / 100).toLocaleString('ru-RU') + ' ' + c)
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
  document
    .querySelectorAll('[data-tab]')
    .forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const seq = ++generation;
  try {
    if (tab === 'payments' && !platformMode) {
      await showPayments(seq);
    } else if (!store) {
      emptyStore();
    } else if (tab === 'home') {
      await reload();
      if (seq !== generation) return;
      main.innerHTML = \`<div class="stats"><div class="card"><div class="stat">\${store.stats.productCount}</div><p>\u0422\u043E\u0432\u0430\u0440\u043E\u0432</p></div><div class="card"><div class="stat">\${store.stats.newOrderCount}</div><p>\u041D\u043E\u0432\u044B\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432</p></div></div><div class="card"><h2>\u0412\u0441\u0451 \u043F\u043E\u0434 \u0440\u0443\u043A\u043E\u0439</h2><p>\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0438 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043D\u0430 \u0441\u0430\u0439\u0442\u0435 \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.</p><div class="actions"><button class="primary" data-action="add">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440</button><button data-tab="orders">\u041F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0437\u0430\u043A\u0430\u0437\u044B</button></div></div><div class="card"><h3>\${storeState()}</h3><p>\${store.status === 'demo' ? '\u0417\u0430\u043A\u0430\u0437\u044B \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B. \u041F\u043E\u0441\u043B\u0435 \u043F\u0440\u043E\u0434\u0430\u0436\u0438 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0435\u0442 \u043C\u0430\u0433\u0430\u0437\u0438\u043D.' : '\u041D\u043E\u0432\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u044B \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0432 Telegram \u0438 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u0417\u0430\u043A\u0430\u0437\u044B\xBB.'}</p><a href="\${esc(siteUrl())}" target="_blank" rel="noopener">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043C\u043E\u0439 \u0441\u0430\u0439\u0442</a></div>\`;
    } else if (tab === 'products') {
      await reload();
      if (seq !== generation) return;
      main.innerHTML = \`<div class="row between page-heading"><h2>\u0422\u043E\u0432\u0430\u0440\u044B \xB7 \${products.length}</h2><button class="primary" data-action="add">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C</button></div><div class="stack">\${products.map((p, i) => \`<button class="card product" data-edit="\${i}">\${p.photos[0] ? \`<img src="\${esc(p.photos[0])}" alt="" loading="lazy">\` : ''}<div class="info"><h3>\${esc(p.name)}</h3><p>\${esc(p.category)} \xB7 \${esc(money(p))}</p><span class="badge">\${{ available: '\u0412 \u043D\u0430\u043B\u0438\u0447\u0438\u0438', preorder: '\u041D\u0430 \u0437\u0430\u043A\u0430\u0437', unavailable: '\u041D\u0435\u0442 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438' }[p.availability]}</span>\${stockSummary(p)}</div><span class="product-chevron" aria-hidden="true">\u203A</span></button>\`).join('') || '<p>\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043F\u0435\u0440\u0432\u044B\u0439 \u0442\u043E\u0432\u0430\u0440.</p>'}</div>\`;
    } else if (tab === 'orders') {
      orders = await api(base() + \`/orders?offset=\${orderOffset}&status=\${orderFilter}\`);
      if (seq !== generation) return;
      main.innerHTML = \`<h2>\u0417\u0430\u043A\u0430\u0437\u044B</h2><select id="order-filter" aria-label="\u0421\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043A\u0430\u0437\u043E\u0432"><option value="">\u0412\u0441\u0435</option>\${Object.entries(
        statusNames,
      )
        .map(
          ([k, v]) => \`<option value="\${k}" \${k === orderFilter ? 'selected' : ''}>\${v}</option>\`,
        )
        .join(
          '',
        )}</select><div style="margin-top:16px">\${orders.map((o, i) => \`<button class="card product" data-order="\${i}"><div class="info"><h3>\u2116\${o.number} \xB7 \${esc(o.customer.name)}</h3><p>\${esc(statusNames[o.status])} \xB7 \${(o.totalMinor / 100).toLocaleString('ru-RU')} \${o.currency}</p><p>\${new Date(o.createdAt * 1000).toLocaleString('ru-RU')}</p></div><span>\u203A</span></button>\`).join('') || '<p>\u0417\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.</p>'}</div><div class="actions"><button data-page="prev" \${orderOffset === 0 ? 'disabled' : ''}>\u041D\u0430\u0437\u0430\u0434</button><button data-page="next" \${orders.length < 50 ? 'disabled' : ''}>\u0414\u0430\u043B\u0435\u0435</button></div>\`;
    } else if (tab === 'settings') renderSettings();
    else if (tab === 'site')
      main.innerHTML = \`<h2>\u041C\u043E\u0439 \u0441\u0430\u0439\u0442</h2><div class="card"><h3>\${esc(store.name)}</h3><p>\${storeState()}</p><p><a href="\${esc(siteUrl())}" target="_blank" rel="noopener">\${esc(siteUrl())}</a></p><button class="primary" data-action="copy">\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443</button></div>\`;
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
  main.innerHTML = \`<div class="row between page-heading"><h2>\${edited ? '\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0442\u043E\u0432\u0430\u0440' : '\u041D\u043E\u0432\u044B\u0439 \u0442\u043E\u0432\u0430\u0440'}</h2><button data-tab="products">\u0417\u0430\u043A\u0440\u044B\u0442\u044C</button></div><form id="product-form"><div class="card"><div id="photos" class="photo-row"></div><label for="photo-upload">\u0424\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438 (\u0434\u043E 8)</label><input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple>\${field('name', '\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435', p.name, 'text', true)}\${field('category', '\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F', p.category || '\u041F\u0440\u043E\u0447\u0435\u0435', 'text', true)}<datalist id="categories">\${[...new Set(products.map((p) => p.category))].map((c) => \`<option value="\${esc(c)}">\`).join('')}</datalist><label for="description">\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435</label><textarea id="description">\${esc(p.description || '')}</textarea>
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
  main.innerHTML = \`<h2>\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</h2><form id="settings-form"><div class="card">\${field('store-title', '\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430', store.name, 'text', true)}\${field('hero-title', '\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0432\u0438\u0442\u0440\u0438\u043D\u044B', s.heroTitle)}<label for="store-description">\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430</label><textarea id="store-description">\${esc(s.description)}</textarea><label for="theme">\u0428\u0430\u0431\u043B\u043E\u043D \u0432\u0438\u0442\u0440\u0438\u043D\u044B</label><select id="theme">\${[
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
    )}</select><p>\u041C\u0435\u043D\u044F\u0435\u0442 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435. \u0422\u043E\u0432\u0430\u0440\u044B \u0438 \u0446\u0435\u043D\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F; \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0446\u0432\u0435\u0442 \u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432 \u043C\u043E\u0436\u043D\u043E \u043D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u043D\u0438\u0436\u0435.</p>\${field('accent', '\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0446\u0432\u0435\u0442', s.accentColor, 'color')}\${field('logo', '\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u043B\u043E\u0433\u043E\u0442\u0438\u043F', s.logo)}<label for="logo-upload">\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043B\u043E\u0433\u043E\u0442\u0438\u043F</label><input id="logo-upload" type="file" accept="image/jpeg,image/png,image/webp">\${field('whatsapp', 'WhatsApp: \u043D\u043E\u043C\u0435\u0440 \u0441 \u043A\u043E\u0434\u043E\u043C \u0441\u0442\u0440\u0430\u043D\u044B, \u0442\u043E\u043B\u044C\u043A\u043E \u0446\u0438\u0444\u0440\u044B', s.whatsapp)}\${field('telegram', 'Telegram username \u0431\u0435\u0437 @', s.telegram)}\${field('instagram', 'Instagram username \u0431\u0435\u0437 @', s.instagram)}<label for="currencies">\u0412\u0430\u043B\u044E\u0442\u044B (1 \u0438\u043B\u0438 2, \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E)</label><input id="currencies" value="\${esc(s.currencies.join(', '))}" required><p>BYN, RUB, KZT, USD, EUR. \u041F\u0435\u0440\u0435\u0434 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C \u043D\u043E\u0432\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u044B \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0446\u0435\u043D\u044B \u0432 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432.</p><label for="delivery">\u0421\u043F\u043E\u0441\u043E\u0431\u044B \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438 (\u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0435)</label><textarea id="delivery" required>\${esc(s.deliveryMethods.join('\\n'))}</textarea><label for="delivery-hint">\u0423\u0441\u043B\u043E\u0432\u0438\u044F \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438</label><textarea id="delivery-hint">\${esc(s.deliveryHint)}</textarea>\${field('footer', '\u0422\u0435\u043A\u0441\u0442 \u0432\u043D\u0438\u0437\u0443 \u0441\u0430\u0439\u0442\u0430', s.footerText)}<details><summary>\u0422\u0435\u043A\u0441\u0442\u044B \u043A\u043D\u043E\u043F\u043E\u043A \u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u0435\u0439</summary>\${[
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
  main.innerHTML = \`<div class="row between page-heading"><h2>\u0417\u0430\u043A\u0430\u0437 \u2116\${o.number}</h2><button data-tab="orders">\u041D\u0430\u0437\u0430\u0434</button></div><div class="card"><span class="badge">\${statusNames[o.status]}</span><h3 style="margin-top:16px">\${esc(c.name)}</h3><p>\${esc(c.phone)}</p><p>\${esc(c.deliveryMethod)}<br>\${esc(c.address)}<br>\${esc([c.city, c.region, c.index].filter(Boolean).join(', '))}</p>\${c.comment ? \`<p>\${esc(c.comment)}</p>\` : ''}<ul class="order-lines">\${o.items.map((i) => \`<li>\${esc(i.name)} \xB7 \${esc(i.variant)}<br>\${i.quantity} \xD7 \${(i.unitMinor / 100).toLocaleString('ru-RU')} \${o.currency}</li>\`).join('')}</ul><h3>\u0418\u0442\u043E\u0433\u043E: \${(o.totalMinor / 100).toLocaleString('ru-RU')} \${o.currency}</h3><div class="actions">\${buttons[o.status].map(([s, label]) => \`<button data-status="\${s}" data-order-id="\${o.id}" class="\${s === 'cancelled' ? 'danger' : 'primary'}">\${label}</button>\`).join('')}</div></div>\`;
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
document.addEventListener('change', async (event) => {
  const el = event.target;
  try {
    if (el.id === 'store-picker') {
      store = stores.find((s) => s.id === el.value);
      generation++;
      orderOffset = 0;
      await show('home');
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
        button.disabled = !['home', 'payments'].includes(button.dataset.tab);
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
`;var Ot=`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>\u041C\u043E\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D</title>
    <script src="https://telegram.org/js/telegram-web-app.js"><\/script>
    <link rel="stylesheet" href="/admin.css" />
    <script defer src="/admin/app.js?v=20261014-payments-2"><\/script>
  </head>
  <body>
    <header>
      <div>
        <span class="eyebrow">\u041C\u043E\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D</span>
        <h1 id="store-name">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</h1>
      </div>
      <select id="store-picker" aria-label="\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D" hidden></select>
    </header>
    <div id="notice" role="status" hidden></div>
    <main id="main"><p>\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u043C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u2026</p></main>
    <nav id="nav" aria-label="\u0420\u0430\u0437\u0434\u0435\u043B\u044B">
      <button data-tab="home">\u0413\u043B\u0430\u0432\u043D\u0430\u044F</button><button data-tab="products">\u0422\u043E\u0432\u0430\u0440\u044B</button
      ><button data-tab="orders">\u0417\u0430\u043A\u0430\u0437\u044B</button><button data-tab="settings">\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</button
      ><button data-tab="site">\u041C\u043E\u0439 \u0441\u0430\u0439\u0442</button><button data-tab="payments">\u041E\u043F\u043B\u0430\u0442\u0430</button>
    </nav>
  </body>
</html>
`;var Nt=`<!doctype html>
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
`;var xt=`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>\u041C\u043E\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D</title>
    <link rel="stylesheet" href="/admin.css" />
    <script defer src="/admin/app.js?v=20261014-payments-2"><\/script>
  </head>
  <body data-mode="platform">
    <header>
      <div>
        <span class="eyebrow">\u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430</span>
        <h1 id="store-name">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</h1>
      </div>
      <select id="store-picker" aria-label="\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D" hidden></select>
    </header>
    <div id="notice" role="status" hidden></div>
    <main id="main"><p>\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u043C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u2026</p></main>
    <nav id="nav" aria-label="\u0420\u0430\u0437\u0434\u0435\u043B\u044B">
      <button data-tab="home">\u0413\u043B\u0430\u0432\u043D\u0430\u044F</button><button data-tab="products">\u0422\u043E\u0432\u0430\u0440\u044B</button
      ><button data-tab="orders">\u0417\u0430\u043A\u0430\u0437\u044B</button><button data-tab="settings">\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</button
      ><button data-tab="site">\u041C\u043E\u0439 \u0441\u0430\u0439\u0442</button>
    </nav>
  </body>
</html>
`;var N=class extends Error{constructor(r,n){super(n);this.status=r}status};function o(t,e,r=400){if(!t)throw new N(r,e)}function E(t){return o(t!==null&&typeof t=="object"&&!Array.isArray(t),"\u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u043E\u0431\u044A\u0435\u043A\u0442"),t}function p(t,e=200,r=!1){o(t==null||typeof t=="string","\u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u0442\u0435\u043A\u0441\u0442");let n=String(t??"").trim();return o(n.length<=e&&(!r||n.length>0),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0434\u043B\u0438\u043D\u0430 \u0442\u0435\u043A\u0441\u0442\u0430"),n}function x(t,e,r){return o(typeof t=="number"&&Number.isSafeInteger(t)&&t>=e&&t<=r,"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u0435 \u0447\u0438\u0441\u043B\u043E"),t}function ot(t,e=20,r=100){return o(Array.isArray(t)&&t.length<=e,"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A"),t.map(n=>p(n,r,!0))}function st(t,e){let r=p(t,1e3);if(!r)return"";if(/^\/template-assets\/[a-z0-9-]+\.svg$/.test(r))return r;if(r.startsWith("/media/"))return o(!r.includes("..")&&/^\/media\/[a-f0-9-]+\/[a-f0-9-]+\.(png|jpg|webp)$/.test(r)&&(!e||r.startsWith(`/media/${e}/`)),"\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430"),r;o(/^https:\/\//.test(r),"\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F HTTPS-\u0441\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435");try{let n=new URL(r);o(!n.username&&!n.password,"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430")}catch{throw new N(400,"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430")}return r}var At=["BYN","RUB","KZT","USD","EUR"],de=["btn_cart","btn_add","btn_add_size","btn_clear","label_size","label_qty","label_year","label_color","label_number","label_total","label_pick","filter_all","msg_empty_cart","msg_added","wa_msg_header","wa_msg_footer","tg_msg_header","tg_msg_footer","support_label"];function H(t,e){let r=E(t??{}),n=r.currencies===void 0?["BYN"]:ot(r.currencies,2);o(n.length>0&&new Set(n).size===n.length&&n.every(y=>At.includes(y)),"\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u0430\u044F \u0432\u0430\u043B\u044E\u0442\u0430");let a=r.deliveryMethods===void 0?["\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430","\u0421\u0430\u043C\u043E\u0432\u044B\u0432\u043E\u0437"]:ot(r.deliveryMethods,6);o(a.length>0&&new Set(a).size===a.length,"\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0441\u043F\u043E\u0441\u043E\u0431\u044B \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438");let i=p(r.theme)||"minimal";o(["minimal","fashion","home","beauty"].includes(i),"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0448\u0430\u0431\u043B\u043E\u043D");let s=p(r.accentColor,7)||"#354f46";o(/^#[0-9a-f]{6}$/i.test(s),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0446\u0432\u0435\u0442");let l=p(r.telegram,64).replace(/^@/,""),c=p(r.instagram,64).replace(/^@/,""),u=p(r.whatsapp,20);o(!l||/^[a-z0-9_]{5,32}$/i.test(l),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 Telegram username"),o(!c||/^[a-z0-9_.]{1,30}$/i.test(c),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 Instagram username"),o(!u||/^\d{7,15}$/.test(u),"\u041D\u043E\u043C\u0435\u0440 WhatsApp: \u0442\u043E\u043B\u044C\u043A\u043E \u0446\u0438\u0444\u0440\u044B");let m={};for(let[y,T]of Object.entries(E(r.texts??{})))o(de.includes(y),"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u0432\u0438\u0442\u0440\u0438\u043D\u044B"),m[y]=p(T,500);return{theme:i,description:p(r.description,2e3),accentColor:s,logo:st(r.logo,e),whatsapp:u,telegram:l,instagram:c,currencies:n,deliveryMethods:a,deliveryHint:p(r.deliveryHint,1e3),heroTitle:p(r.heroTitle,200),footerText:p(r.footerText,500),texts:m}}function B(t,e,r,n=!1){let a=E(t),i={},s=a.prices??(a.price!==void 0?{[p(a.currency)||e.currencies[0]]:Math.round(Number(a.price)*100)}:void 0);for(let[f,g]of Object.entries(E(s)))o(At.includes(f),"\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u0430\u044F \u0432\u0430\u043B\u044E\u0442\u0430"),i[f]=x(g,0,1e8);o(e.currencies.every(f=>i[f]!==void 0),"\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0446\u0435\u043D\u0443 \u0432 \u043A\u0430\u0436\u0434\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430");let l=a.photos===void 0?a.image?[st(a.image,r)]:[]:ot(a.photos,8,1e3).map(f=>st(f,r)),c=p(a.availability)||"available";o(["available","preorder","unavailable"].includes(c),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u0435 \u043D\u0430\u043B\u0438\u0447\u0438\u0435");let u=a.variants??[{label:"\u0411\u0435\u0437 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432",stock:null}];o(Array.isArray(u)&&u.length>0&&u.length<=30,"\u041E\u0442 1 \u0434\u043E 30 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432");let m=u.map(f=>{let g=E(f);o(n||g.id===void 0,"ID \u043D\u043E\u0432\u043E\u0433\u043E \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430 \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C");let w=g.id?p(g.id,36,!0):crypto.randomUUID();return o(/^[a-f0-9-]{36}$/.test(w),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 ID \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430"),{id:w,label:p(g.label,80,!0),stock:g.stock===null||g.stock===void 0?null:x(g.stock,0,1e6)}}),y=a.attributes??[];o(Array.isArray(y)&&y.length<=12,"\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 12 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A");let T=y.map(f=>{let g=E(f);return{label:p(g.label,80,!0),value:p(g.value,300,!0)}});return o(new Set(T.map(f=>f.label)).size===T.length,"\u041F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0430\u044F\u0441\u044F \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430"),o(new Set(m.map(f=>f.id)).size===m.length&&new Set(m.map(f=>f.label)).size===m.length,"\u041F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0438\u0439\u0441\u044F \u0432\u0430\u0440\u0438\u0430\u043D\u0442"),{data:{name:p(a.name,200,!0),category:p(a.category,100)||"\u041F\u0440\u043E\u0447\u0435\u0435",description:p(a.description,5e3),prices:i,discountPercent:a.discountPercent===void 0?0:x(a.discountPercent,0,99),availability:c,photos:l,brand:p(a.brand??a.team,100),collection:p(a.collection??a.year,100),sku:p(a.sku??a.number,80),attributes:T,color:p(a.color,100)},variants:m}}async function L(t,e=512e3){o(t.headers.get("content-type")?.includes("application/json"),"\u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F JSON",415);let r=await W(t,e);try{return JSON.parse(new TextDecoder().decode(r))}catch{throw new N(400,"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 JSON")}}async function W(t,e){o(Number(t.headers.get("content-length")||0)<=e,"\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0437\u0430\u043F\u0440\u043E\u0441",413);let r=t.body?.getReader();if(!r)return new Uint8Array;let n=[],a=0;for(;;){let{value:l,done:c}=await r.read();if(c)break;if(a+=l.byteLength,a>e)throw await r.cancel(),new N(413,"\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0437\u0430\u043F\u0440\u043E\u0441");n.push(l)}let i=new Uint8Array(a),s=0;for(let l of n)i.set(l,s),s+=l.length;return i}var ce=[{BYN:4900,RUB:149e3,KZT:89e4,USD:1500,EUR:1400},{BYN:8900,RUB:279e3,KZT:169e4,USD:2800,EUR:2600},{BYN:12900,RUB:399e3,KZT:249e4,USD:4e3,EUR:3800}],Lt=[{id:"minimal",title:"\u0423\u043D\u0438\u0432\u0435\u0440\u0441\u0430\u043B\u044C\u043D\u044B\u0439",name:"\u041C\u043E\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D",description:"\u041B\u044E\u0431\u0438\u043C\u044B\u0435 \u0432\u0435\u0449\u0438, \u0443\u0434\u043E\u0431\u043D\u044B\u0439 \u0432\u044B\u0431\u043E\u0440 \u0438 \u0437\u0430\u0431\u043E\u0442\u0430 \u043E \u043A\u0430\u0436\u0434\u043E\u0439 \u043F\u043E\u043A\u0443\u043F\u043A\u0435.",accentColor:"#354f46",variantLabel:"\u0412\u0430\u0440\u0438\u0430\u043D\u0442",samples:[]},{id:"fashion",title:"\u041E\u0434\u0435\u0436\u0434\u0430 \u0438 \u0430\u043A\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044B",name:"FORMA",description:"\u041F\u0440\u043E\u0434\u0443\u043C\u0430\u043D\u043D\u044B\u0439 \u0433\u0430\u0440\u0434\u0435\u0440\u043E\u0431 \u043D\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C. \u0427\u0438\u0441\u0442\u044B\u0435 \u043B\u0438\u043D\u0438\u0438, \u043F\u0440\u0438\u044F\u0442\u043D\u044B\u0435 \u0442\u043A\u0430\u043D\u0438 \u0438 \u0441\u0432\u043E\u0431\u043E\u0434\u0430 \u0441\u043E\u0447\u0435\u0442\u0430\u043D\u0438\u0439.",accentColor:"#252525",variantLabel:"\u0420\u0430\u0437\u043C\u0435\u0440",samples:[{name:"\u0424\u0443\u0442\u0431\u043E\u043B\u043A\u0430 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u043A\u0440\u043E\u044F",category:"\u041E\u0434\u0435\u0436\u0434\u0430",asset:"fashion-shirt",price:0,variants:["S","M","L"],detail:["\u0421\u043E\u0441\u0442\u0430\u0432","100% \u0445\u043B\u043E\u043F\u043E\u043A"]},{name:"\u041B\u044C\u043D\u044F\u043D\u0430\u044F \u0440\u0443\u0431\u0430\u0448\u043A\u0430",category:"\u041E\u0434\u0435\u0436\u0434\u0430",asset:"fashion-shirt-sand",price:1,variants:["S","M","L"],detail:["\u0421\u043E\u0441\u0442\u0430\u0432","100% \u043B\u0451\u043D"]},{name:"\u0421\u0443\u043C\u043A\u0430 \u043D\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C",category:"\u0410\u043A\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044B",asset:"fashion-bag",price:2,variants:["\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442"],detail:["\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B","\u041F\u043B\u043E\u0442\u043D\u0430\u044F \u0445\u043B\u043E\u043F\u043A\u043E\u0432\u0430\u044F \u0442\u043A\u0430\u043D\u044C"]},{name:"\u0428\u043E\u043F\u043F\u0435\u0440 \u0438\u0437 \u0445\u043B\u043E\u043F\u043A\u0430",category:"\u0410\u043A\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044B",asset:"fashion-bag-sand",price:0,variants:["\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442"],detail:["\u0420\u0430\u0437\u043C\u0435\u0440","38 \xD7 42 \u0441\u043C"]},{name:"\u0421\u0432\u0438\u0442\u0448\u043E\u0442 \u0431\u0430\u0437\u043E\u0432\u044B\u0439",category:"\u041E\u0434\u0435\u0436\u0434\u0430",asset:"fashion-shirt-sand",price:2,variants:["M","L","XL"],detail:["\u0421\u043E\u0441\u0442\u0430\u0432","\u0425\u043B\u043E\u043F\u043E\u043A \u0438 \u043F\u043E\u043B\u0438\u044D\u0441\u0442\u0435\u0440"]},{name:"\u0424\u0443\u0442\u0431\u043E\u043B\u043A\u0430 \u0441 \u0434\u043B\u0438\u043D\u043D\u044B\u043C \u0440\u0443\u043A\u0430\u0432\u043E\u043C",category:"\u041E\u0434\u0435\u0436\u0434\u0430",asset:"fashion-shirt",price:1,variants:["S","M","L"],detail:["\u041F\u043E\u0441\u0430\u0434\u043A\u0430","\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u0430\u044F"]}]},{id:"home",title:"\u0414\u043E\u043C \u0438 \u0434\u0435\u043A\u043E\u0440",name:"\u0422\u0438\u0445\u0438\u0439 \u0434\u043E\u043C",description:"\u041C\u0430\u043B\u0435\u043D\u044C\u043A\u0438\u0435 \u0434\u0435\u0442\u0430\u043B\u0438 \u0434\u043B\u044F \u0431\u043E\u043B\u044C\u0448\u043E\u0433\u043E \u0447\u0443\u0432\u0441\u0442\u0432\u0430 \u0434\u043E\u043C\u0430. \u041A\u0435\u0440\u0430\u043C\u0438\u043A\u0430, \u0442\u0435\u043A\u0441\u0442\u0438\u043B\u044C \u0438 \u0432\u0435\u0449\u0438 \u0441 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u043E\u043C.",accentColor:"#8b513c",variantLabel:"\u0412\u0430\u0440\u0438\u0430\u043D\u0442",samples:[{name:"\u041A\u0435\u0440\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0432\u0430\u0437\u0430",category:"\u0414\u0435\u043A\u043E\u0440",asset:"home-vase",price:1,variants:["\u041F\u0435\u0441\u043E\u0447\u043D\u044B\u0439","\u0422\u0435\u0440\u0440\u0430\u043A\u043E\u0442\u0430"],detail:["\u0412\u044B\u0441\u043E\u0442\u0430","24 \u0441\u043C"]},{name:"\u041A\u0440\u0443\u0436\u043A\u0430 \u0441 \u043C\u044F\u0433\u043A\u043E\u0439 \u0433\u043B\u0430\u0437\u0443\u0440\u044C\u044E",category:"\u041A\u0435\u0440\u0430\u043C\u0438\u043A\u0430",asset:"home-cup",price:0,variants:["\u041C\u043E\u043B\u043E\u0447\u043D\u044B\u0439"],detail:["\u041E\u0431\u044A\u0451\u043C","300 \u043C\u043B"]},{name:"\u041B\u044C\u043D\u044F\u043D\u0430\u044F \u043D\u0430\u0432\u043E\u043B\u043E\u0447\u043A\u0430",category:"\u0422\u0435\u043A\u0441\u0442\u0438\u043B\u044C",asset:"home-pillow",price:0,variants:["40 \xD7 40 \u0441\u043C","50 \xD7 50 \u0441\u043C"],detail:["\u0421\u043E\u0441\u0442\u0430\u0432","100% \u043B\u0451\u043D"]},{name:"\u0412\u0430\u0437\u0430 \u0434\u043B\u044F \u0441\u0443\u0445\u043E\u0446\u0432\u0435\u0442\u043E\u0432",category:"\u0414\u0435\u043A\u043E\u0440",asset:"home-vase-clay",price:2,variants:["\u0422\u0435\u0440\u0440\u0430\u043A\u043E\u0442\u0430"],detail:["\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B","\u041A\u0435\u0440\u0430\u043C\u0438\u043A\u0430"]},{name:"\u0427\u0430\u0448\u043A\u0430 \u0434\u043B\u044F \u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0433\u043E \u043A\u043E\u0444\u0435",category:"\u041A\u0435\u0440\u0430\u043C\u0438\u043A\u0430",asset:"home-cup",price:0,variants:["\u041C\u043E\u043B\u043E\u0447\u043D\u044B\u0439"],detail:["\u041E\u0431\u044A\u0451\u043C","200 \u043C\u043B"]},{name:"\u0414\u0435\u043A\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u0430\u044F \u043F\u043E\u0434\u0443\u0448\u043A\u0430",category:"\u0422\u0435\u043A\u0441\u0442\u0438\u043B\u044C",asset:"home-pillow",price:1,variants:["45 \xD7 45 \u0441\u043C"],detail:["\u041D\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C","\u041F\u043E\u043B\u0438\u044D\u0444\u0438\u0440\u043D\u043E\u0435 \u0432\u043E\u043B\u043E\u043A\u043D\u043E"]}]},{id:"beauty",title:"\u041A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0430 \u0438 \u0443\u0445\u043E\u0434",name:"LUNA care",description:"\u041F\u0440\u043E\u0441\u0442\u043E\u0439 \u0440\u0438\u0442\u0443\u0430\u043B \u0437\u0430\u0431\u043E\u0442\u044B \u043E \u0441\u0435\u0431\u0435. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043B\u044E\u0431\u0438\u043C\u0443\u044E \u0442\u0435\u043A\u0441\u0442\u0443\u0440\u0443 \u0438 \u0441\u043E\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0432\u043E\u0439 \u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0439 \u0443\u0445\u043E\u0434.",accentColor:"#6b455d",variantLabel:"\u041E\u0431\u044A\u0451\u043C",samples:[{name:"\u041A\u0440\u0435\u043C \u0434\u043B\u044F \u0440\u0443\u043A",category:"\u0414\u043B\u044F \u0442\u0435\u043B\u0430",asset:"beauty-tube",price:0,variants:["50 \u043C\u043B","100 \u043C\u043B"],detail:["\u0410\u0440\u043E\u043C\u0430\u0442","\u041C\u044F\u0433\u043A\u0438\u0439 \u0446\u0432\u0435\u0442\u043E\u0447\u043D\u044B\u0439"]},{name:"\u041E\u0447\u0438\u0449\u0430\u044E\u0449\u0438\u0439 \u0433\u0435\u043B\u044C",category:"\u0414\u043B\u044F \u043B\u0438\u0446\u0430",asset:"beauty-bottle",price:1,variants:["150 \u043C\u043B"],detail:["\u0422\u0435\u043A\u0441\u0442\u0443\u0440\u0430","\u0413\u0435\u043B\u0435\u0432\u0430\u044F"]},{name:"\u041A\u0440\u0435\u043C \u0434\u043B\u044F \u043B\u0438\u0446\u0430",category:"\u0414\u043B\u044F \u043B\u0438\u0446\u0430",asset:"beauty-jar",price:2,variants:["50 \u043C\u043B"],detail:["\u0422\u0435\u043A\u0441\u0442\u0443\u0440\u0430","\u041B\u0451\u0433\u043A\u0438\u0439 \u043A\u0440\u0435\u043C"]},{name:"\u041B\u043E\u0441\u044C\u043E\u043D \u0434\u043B\u044F \u0442\u0435\u043B\u0430",category:"\u0414\u043B\u044F \u0442\u0435\u043B\u0430",asset:"beauty-bottle-rose",price:1,variants:["200 \u043C\u043B"],detail:["\u0410\u0440\u043E\u043C\u0430\u0442","\u041D\u0435\u0439\u0442\u0440\u0430\u043B\u044C\u043D\u044B\u0439"]},{name:"\u0411\u0430\u043B\u044C\u0437\u0430\u043C \u0434\u043B\u044F \u0433\u0443\u0431",category:"\u0414\u043B\u044F \u043B\u0438\u0446\u0430",asset:"beauty-jar",price:0,variants:["15 \u043C\u043B"],detail:["\u0424\u0438\u043D\u0438\u0448","\u0411\u0435\u0437 \u0446\u0432\u0435\u0442\u0430"]},{name:"\u041A\u0440\u0435\u043C \u0434\u043B\u044F \u043D\u043E\u0433",category:"\u0414\u043B\u044F \u0442\u0435\u043B\u0430",asset:"beauty-tube",price:0,variants:["75 \u043C\u043B"],detail:["\u0422\u0435\u043A\u0441\u0442\u0443\u0440\u0430","\u041F\u043B\u043E\u0442\u043D\u044B\u0439 \u043A\u0440\u0435\u043C"]}]}];function j(t){return Lt.find(e=>e.id===t)}function kt(){return Lt.map(({samples:t,...e})=>({...e,productCount:t.length}))}function J(t){return{theme:t.id,description:t.description,accentColor:t.accentColor,texts:{label_size:t.variantLabel,btn_add_size:"\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 "+t.variantLabel.toLowerCase()}}}function K(t,e){return t.samples.map((r,n)=>({name:r.name,category:r.category,description:"\u041F\u0440\u0438\u043C\u0435\u0440 \u0442\u043E\u0432\u0430\u0440\u0430 \u0434\u043B\u044F \u0434\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0448\u0430\u0431\u043B\u043E\u043D\u0430. \u0417\u0430\u043C\u0435\u043D\u0438\u0442\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435, \u0438\u043B\u043B\u044E\u0441\u0442\u0440\u0430\u0446\u0438\u044E, \u0446\u0435\u043D\u044B \u0438 \u043E\u0441\u0442\u0430\u0442\u043A\u0438 \u043F\u0435\u0440\u0435\u0434 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0435\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430.",brand:t.name,collection:"\u0411\u0430\u0437\u043E\u0432\u0430\u044F \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F",sku:t.id.toUpperCase()+"-"+String(n+1).padStart(3,"0"),attributes:[{label:r.detail[0],value:r.detail[1]}],photos:["/template-assets/"+r.asset+".svg"],prices:Object.fromEntries(e.map(a=>[a,ce[r.price][a]])),variants:r.variants.map(a=>({label:a,stock:10}))}))}var d=(t,e,...r)=>t.DB.prepare(e).bind(...r);async function dt(t,e){let r=await d(t,"SELECT * FROM stores WHERE slug=?",e).first();return o(r,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),r}async function Y(t,e,r){let n=await d(t,"SELECT * FROM stores WHERE id=? AND owner_id=?",e,r).first();return o(n,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),n}function D(t){return{id:t.id,slug:t.slug,name:t.name,status:t.status,version:t.version,acceptingOrders:t.orders_enabled===1,settings:JSON.parse(t.settings)}}async function C(t,e){let[r,n]=await t.DB.batch([d(t,"SELECT * FROM products WHERE store_id=? AND deleted_at IS NULL ORDER BY created_at,id LIMIT 501",e),d(t,"SELECT v.* FROM variants v JOIN products p ON p.id=v.product_id WHERE v.store_id=? AND p.deleted_at IS NULL AND v.archived=0",e)]);o(r.results.length<=500,"\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 \u043B\u0438\u043C\u0438\u0442 MVP",409);let a=r.results,i=n.results;return a.map(s=>({...JSON.parse(s.data),id:s.id,version:s.version,variants:i.filter(l=>l.product_id===s.id).map(l=>({id:String(l.id),label:String(l.label),stock:l.stock===null?null:Number(l.stock)}))}))}function le(t,e,r,n){return n.map(a=>d(t,"INSERT INTO variants(id,store_id,product_id,label,stock) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,stock=excluded.stock,archived=0 WHERE variants.store_id=excluded.store_id AND variants.product_id=excluded.product_id",a.id,e,r,a.label,a.stock))}async function z(t,e,r,n){let a=E(e);o(a.status===void 0||a.status==="demo","\u041D\u043E\u0432\u044B\u0439 \u043C\u0430\u0433\u0430\u0437\u0438\u043D \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F \u043A\u0430\u043A \u0434\u0435\u043C\u043E");let i=p(a.name,200,!0),s=n??crypto.randomUUID(),l=p(a.templateId),c=l?j(l):void 0;o(!l||c,"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0448\u0430\u0431\u043B\u043E\u043D"),o(a.seedProducts===void 0||typeof a.seedProducts=="boolean","\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0432\u044B\u0431\u043E\u0440 \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u044B\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432"),o(!a.seedProducts||c,"\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0448\u0430\u0431\u043B\u043E\u043D \u0434\u043B\u044F \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u044B\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432");let u=c?J(c):{},m=E(a.settings??{}),y=H({...u,...m,texts:{...u.texts,...E(m.texts??{})},description:a.description??m.description??u.description,accentColor:a.accentColor??m.accentColor??u.accentColor},s),T=p(a.slug,80)||i.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"store";o(/^[a-z0-9][a-z0-9-]{0,79}$/.test(T),"Slug: \u043B\u0430\u0442\u0438\u043D\u0438\u0446\u0430, \u0446\u0438\u0444\u0440\u044B \u0438 \u0434\u0435\u0444\u0438\u0441"),await d(t,"SELECT id FROM stores WHERE slug=?",T).first()&&(T=T.slice(0,65)+"-"+crypto.randomUUID().slice(0,8));let f=a.products??(a.seedProducts&&c?K(c,y.currencies):[]);o(Array.isArray(f)&&f.length<=(n?500:200),"\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u0442\u043E\u0432\u0430\u0440\u043E\u0432");let g=f.map(h=>({id:crypto.randomUUID(),...B(h,y,s)})),w=g.map(h=>({id:h.id,data:JSON.stringify(h.data)})),R=g.flatMap(h=>h.variants.map(_=>({..._,productId:h.id})));return await t.DB.batch([d(t,"INSERT INTO stores(id,slug,name,settings) VALUES(?,?,?,?)",s,T,i,JSON.stringify(y)),d(t,"INSERT INTO products(id,store_id,data) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.data') FROM json_each(?)",s,JSON.stringify(w)),d(t,"INSERT INTO variants(id,store_id,product_id,label,stock) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.productId'),json_extract(value,'$.label'),json_extract(value,'$.stock') FROM json_each(?)",s,JSON.stringify(R))]),{id:s,slug:T,status:"demo",url:`${r}/demo/${T}`}}async function ct(t,e,r,n){let a=E(r),i=JSON.parse(e.settings),s=B(a,i,e.id,!!n),l=n??crypto.randomUUID(),c=[F(t,e)];if(n){let u=await d(t,"SELECT * FROM products WHERE store_id=? AND id=? AND deleted_at IS NULL",e.id,n).first();o(u,"\u0422\u043E\u0432\u0430\u0440 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404);let m=x(a.version,1,Number.MAX_SAFE_INTEGER);o(m===u.version,"\u0422\u043E\u0432\u0430\u0440 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A.",409);let y=await d(t,"SELECT id FROM variants WHERE store_id=? AND product_id=?",e.id,n).all();o(s.variants.every(f=>!a.variants||!a.variants.some(g=>g.id===f.id)||y.results.some(g=>g.id===f.id)),"\u0412\u0430\u0440\u0438\u0430\u043D\u0442 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0438\u0442 \u0434\u0440\u0443\u0433\u043E\u043C\u0443 \u0442\u043E\u0432\u0430\u0440\u0443"),c.push(d(t,"INSERT INTO mutation_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM products WHERE id=? AND store_id=? AND version=? AND deleted_at IS NULL) THEN 1 ELSE 0 END",n,e.id,m)),c.push(d(t,"UPDATE products SET data=?,version=version+1 WHERE store_id=? AND id=?",JSON.stringify(s.data),e.id,n));let T=s.variants.map(f=>f.id);c.push(d(t,`UPDATE variants SET archived=1 WHERE store_id=? AND product_id=? AND id NOT IN (${T.map(()=>"?").join(",")})`,e.id,n,...T))}else{let u=await d(t,"SELECT COUNT(*) n FROM products WHERE store_id=? AND deleted_at IS NULL",e.id).first();o((u?.n??0)<500,"\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 500 \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u0432 MVP",409),c.push(d(t,"INSERT INTO products(id,store_id,data) VALUES(?,?,?)",l,e.id,JSON.stringify(s.data)))}c.push(...le(t,e.id,l,s.variants)),c.push(d(t,"DELETE FROM mutation_guards"));try{await t.DB.batch(c)}catch(u){throw String(u).includes("CHECK constraint")||String(u).includes("CATALOG_CHANGED")||String(u).includes("PRODUCT_LIMIT")?new N(409,"\u0422\u043E\u0432\u0430\u0440 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A."):u}return{id:l}}async function Ut(t,e,r){let n=E(r),a=p(n.name,200,!0),i=H(n.settings,e.id),s=x(n.version,1,Number.MAX_SAFE_INTEGER),l=await C(t,e.id);o(l.every(u=>i.currencies.every(m=>u.prices[m]!==void 0)),"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0446\u0435\u043D\u044B \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u0432 \u043D\u043E\u0432\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u0435");let c;try{c=await d(t,"UPDATE stores SET name=?,settings=?,version=version+1 WHERE id=? AND owner_id IS ? AND version=?",a,JSON.stringify(i),e.id,e.owner_id,s).run()}catch(u){throw String(u).includes("CATALOG_CHANGED")?new N(409,"\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0446\u0435\u043D\u044B \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u0432 \u043D\u043E\u0432\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u0435."):u}o(c.meta.changes===1,"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u044B. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C.",409)}function F(t,e){return d(t,"INSERT INTO mutation_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM stores WHERE id=? AND owner_id IS ? AND version=?) THEN 1 ELSE 0 END",e.id,e.owner_id,e.version)}function ue(t){return typeof t=="string"&&/^ru(?:[-_]|$)/i.test(t)?"ru":"en"}async function V(t,e,r){let n=await d(t,"SELECT language,manual FROM telegram_preferences WHERE user_id=?",e).first();if(n?.manual)return n.language;if(typeof r!="string")return n?.language??"en";let a=ue(r);return n?.language!==a&&await d(t,"INSERT INTO telegram_preferences(user_id,language,manual) VALUES(?,?,0) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language WHERE manual=0",e,a).run(),a}async function $t(t,e,r){await d(t,"INSERT INTO telegram_preferences(user_id,language,manual) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language,manual=1",e,r).run()}async function P(t,e){return(await d(t,"SELECT language FROM telegram_preferences WHERE user_id=?",e).first())?.language==="en"?"en":"ru"}var U={ru:{welcome:`\u{1F44B} \u041F\u0440\u0438\u0432\u0435\u0442! \u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0432 Delokay.

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

To connect a store, follow the invitation link from your specialist. Open the Mini App with the \u201CDelokay\u201D button near the message field.`,connected:"\u2705 Store \u201C",connectedEnd:"\u201D connected. You can now manage it in Delokay.",claimError:"Could not connect the store.",statusSaved:"\u2705 Order status updated",orderNotFound:"Order not found",newOrder:"\u{1F4E6} New order #",phone:"Phone: ",total:"Total: ",accept:"Accept",complete:"Completed",cancel:"Cancel",openOrder:"Open order"}};var lt=new TextEncoder;async function $(t){return Mt(await crypto.subtle.digest("SHA-256",lt.encode(t)))}function Mt(t){return Array.from(new Uint8Array(t),e=>e.toString(16).padStart(2,"0")).join("")}async function Ct(t,e){let r=await crypto.subtle.importKey("raw",t,{name:"HMAC",hash:"SHA-256"},!1,["sign"]);return crypto.subtle.sign("HMAC",r,lt.encode(e))}async function X(t,e){let[r,n]=await Promise.all([$(t),$(e)]),a=0;for(let i=0;i<r.length;i++)a|=r.charCodeAt(i)^n.charCodeAt(i);return a===0}async function Dt(t,e){o(e.PLATFORM_API_KEY&&e.PLATFORM_API_KEY.length>=32,"\u041A\u043B\u044E\u0447 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u044B \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D",503),o(await X(t.headers.get("authorization")??"",`Bearer ${e.PLATFORM_API_KEY}`),"\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430",401)}async function Pt(t,e){o(e.TELEGRAM_BOT_TOKEN,"Telegram \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D",503);let r=t.headers.get("authorization")??"";o(r.startsWith("tma ")&&r.length<=16e3,"\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C \u0447\u0435\u0440\u0435\u0437 Telegram",401);let n=new URLSearchParams(r.slice(4)),a=new Set;for(let m of n.keys())o(!a.has(m),"\u041F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0438\u0439\u0441\u044F \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438",401),a.add(m);let i=n.get("hash")??"";o(/^[a-f0-9]{64}$/.test(i),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C",401),n.delete("hash");let s=[...n.entries()].sort(([m],[y])=>m.localeCompare(y)).map(([m,y])=>`${m}=${y}`).join(`
`),l=await Ct(lt.encode("WebAppData"),e.TELEGRAM_BOT_TOKEN);o(await X(Mt(await Ct(new Uint8Array(l),s)),i),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C",401);let c=Number(n.get("auth_date")),u=Math.floor(Date.now()/1e3);o(Number.isSafeInteger(c)&&c>0&&c<=u+30&&u-c<=3600,"\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C \u0437\u0430\u043D\u043E\u0432\u043E: \u0441\u0435\u0441\u0441\u0438\u044F \u0438\u0441\u0442\u0435\u043A\u043B\u0430",401);try{let m=JSON.parse(n.get("user")??"{}");return o(Number.isSafeInteger(m.id)&&m.id>0&&!m.is_bot,"\u041D\u0435\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F",401),String(m.id)}catch{throw new N(401,"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F")}}var Z=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;function ut(t){o(t.TRIBUTE_API_KEY&&/^[1-9]\d{0,15}$/.test(t.TRIBUTE_SHOP_ID)&&Number.isSafeInteger(Number(t.TRIBUTE_SHOP_ID)),"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 TRIBUTE_API_KEY \u0438 TRIBUTE_SHOP_ID",503)}async function Q(t,e,r){ut(t);let n=await fetch("https://tribute.tg/api/v1"+e,{method:r===void 0?"GET":"POST",headers:{"Api-Key":t.TRIBUTE_API_KEY,"Content-Type":"application/json"},body:r===void 0?void 0:JSON.stringify(r),signal:AbortSignal.timeout(1e4)});return o(n.ok,"Tribute \u043D\u0435 \u0441\u043C\u043E\u0433 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430.",502),n.json()}function tt(t){return{id:t.id,storeId:t.store_id,ownerId:t.owner_id,amountMinor:t.amount_minor,currency:t.currency,title:t.title,description:t.description,status:t.status,paymentUrl:t.payment_url,createdAt:t.created_at,paidAt:t.paid_at}}async function et(t){let e=A(t)+"/api/tribute/webhook";if(t.TRIBUTE_PRODUCT_URL){if(!t.TRIBUTE_API_KEY)return{configured:!1,webhookUrl:e,mode:"digital",paymentUrl:t.TRIBUTE_PRODUCT_URL};let n=await gt(t);return{configured:!0,mode:"digital",webhookUrl:e,paymentUrl:Et(n,t),productId:n.id,productType:n.type,productStatus:n.status,fulfillmentRequired:n.type==="custom",name:n.name,active:n.status==="approved",orderLinkAvailable:ft(n),cardsEnabled:n.acceptCards===!0,amountMinor:n.amount,currency:n.currency}}if(!t.TRIBUTE_API_KEY||!t.TRIBUTE_SHOP_ID)return{configured:!1,webhookUrl:e};ut(t);let r=E(await Q(t,"/shop?shopId="+t.TRIBUTE_SHOP_ID));return{configured:!0,webhookUrl:e,shopId:r.id,name:r.name,active:r.status===1,cardsEnabled:r.onlyStars===!1,callbackMatches:r.callbackUrl===e}}async function G(t,e,r){return[...(await d(t,"SELECT * FROM platform_invoices WHERE (? IS NULL OR store_id=?) AND (? IS NULL OR owner_id=?) ORDER BY created_at DESC,id DESC LIMIT 50",e??null,e??null,r??null,r??null).all()).results.map(tt),...e?[]:await ht(t,r)]}async function Ht(t,e,r){ut(t),o(e.owner_id,"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430",409);let n=E(r),a=p(n.id,36,!0);o(Z.test(a),"\u0423\u043A\u0430\u0436\u0438\u0442\u0435 UUID \u0441\u0447\u0451\u0442\u0430 \u0434\u043B\u044F \u0437\u0430\u0449\u0438\u0442\u044B \u043E\u0442 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F");let i=x(n.amountMinor,100,3e7),s=p(n.currency,3,!0).toLowerCase();o(["eur","usd","rub"].includes(s),"Tribute: EUR, USD \u0438\u043B\u0438 RUB"),o(i>=(s==="rub"?1e4:100)&&i<=(s==="rub"?3e7:3e5),"\u0421\u0443\u043C\u043C\u0430 \u0432\u043D\u0435 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 Tribute");let l=p(n.title,100,!0),c=p(n.description,300,!0),u=await d(t,"SELECT * FROM platform_invoices WHERE id=?",a).first();if(u)return o(u.store_id===e.id&&u.owner_id===e.owner_id&&u.amount_minor===i&&u.currency===s&&u.title===l&&u.description===c,"UUID \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D \u0434\u043B\u044F \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0441\u0447\u0451\u0442\u0430",409),o(u.payment_url,"\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u044D\u0442\u043E\u0433\u043E \u0441\u0447\u0451\u0442\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0432 Tribute. \u041D\u0435 \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u0439\u0442\u0435 \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442.",409),tt(u);let m=E(await Q(t,"/shop?shopId="+t.TRIBUTE_SHOP_ID));o(m.id===Number(t.TRIBUTE_SHOP_ID)&&m.status===1&&m.onlyStars===!1,"\u041D\u0443\u0436\u0435\u043D \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0439 Tribute Shop \u0441 \u043E\u043F\u043B\u0430\u0442\u043E\u0439 \u043A\u0430\u0440\u0442\u0430\u043C\u0438",503),o(m.callbackUrl===A(t)+"/api/tribute/webhook","\u0423\u043A\u0430\u0436\u0438\u0442\u0435 webhook \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 Tribute Shop",503);let y=await d(t,"INSERT OR IGNORE INTO platform_invoices(id,store_id,owner_id,amount_minor,currency,title,description,tribute_shop_id) SELECT ?,id,owner_id,?,?,?,?,? FROM stores WHERE id=? AND owner_id=?",a,i,s,l,c,t.TRIBUTE_SHOP_ID,e.id,e.owner_id).run();o(y.meta.changes===1,"\u0421\u0447\u0451\u0442 \u0443\u0436\u0435 \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F \u0438\u043B\u0438 \u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F",409);try{let f=E(await Q(t,"/shop/orders",{shopId:Number(t.TRIBUTE_SHOP_ID),amount:i,currency:s,title:l,description:c,customerId:a,comment:"Catalog Factory "+a,period:"onetime",successUrl:"https://t.me/"+t.BOT_USERNAME+"?start=payments",failUrl:"https://t.me/"+t.BOT_USERNAME+"?start=payments",preferredPaymentMethods:[{type:"card"}]})),g=p(f.uuid,36,!0),w=p(f.paymentUrl,2e3,!0);o(Z.test(g)&&f.shopId===Number(t.TRIBUTE_SHOP_ID)&&f.amount===i&&f.currency===s&&f.period==="onetime"&&f.onlyStars!==!0,"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0441\u0447\u0451\u0442 Tribute",502);let R=new URL(w);o(R.protocol==="https:"&&!R.username&&!R.password&&(R.hostname==="tribute.tg"||R.hostname.endsWith(".tribute.tg")),"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430 Tribute",502),await d(t,"UPDATE platform_invoices SET remote_uuid=?,payment_url=?,status=CASE WHEN status IN ('creating','review') THEN 'pending' ELSE status END WHERE id=? AND (remote_uuid IS NULL OR remote_uuid=?)",g,w,a,g).run()}catch{throw await d(t,"UPDATE platform_invoices SET status='review' WHERE id=? AND status='creating'",a).run(),new N(502,"Tribute \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0441\u0447\u0451\u0442\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0433\u043E \u0432 \u043A\u0430\u0431\u0438\u043D\u0435\u0442\u0435; \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u0441 \u044D\u0442\u0438\u043C UUID \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0441\u0442 \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442.")}let T=await d(t,"SELECT * FROM platform_invoices WHERE id=?",a).first();return o(T,"\u0421\u0447\u0451\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",500),tt(T)}async function Bt(t,e){o(e.TRIBUTE_API_KEY,"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 TRIBUTE_API_KEY",503);let r=new TextDecoder().decode(await W(t,64e3));o(await mt(r,t.headers.get("trbt-signature")??"",e.TRIBUTE_API_KEY),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C Tribute",401);let n;try{n=E(JSON.parse(r))}catch{throw new N(400,"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 webhook")}let a=p(n.name,100,!0);if(e.TRIBUTE_PRODUCT_URL&&["new_digital_product","digital_product_refunded"].includes(a))return at(e,a,n.payload);if(!["shop_order","shop_order_refunded"].includes(a))return{status:"ignored"};let i=E(n.payload);if(String(i.shopId)!==e.TRIBUTE_SHOP_ID)return{status:"ignored"};let s=p(i.uuid,36,!0);o(Z.test(s),"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 UUID \u043F\u043B\u0430\u0442\u0435\u0436\u0430");let l=p(i.customerId,256),c=await d(e,"SELECT * FROM platform_invoices WHERE remote_uuid=? OR id=?",s,l).first();o(c,"\u0421\u0447\u0451\u0442 \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D",404),o(c.tribute_shop_id===e.TRIBUTE_SHOP_ID&&(!c.remote_uuid||c.remote_uuid===s)&&(!l||l===c.id),"\u041F\u043B\u0430\u0442\u0451\u0436 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u0447\u0451\u0442\u0443",409),o(i.currency===c.currency,"\u0412\u0430\u043B\u044E\u0442\u0430 \u043F\u043B\u0430\u0442\u0435\u0436\u0430 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u0447\u0451\u0442\u0443",409),a==="shop_order"&&o(i.status==="paid"&&i.amount===c.amount_minor&&i.isRecurrent===!1&&!i.isTrial,"\u041E\u043F\u043B\u0430\u0442\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430 \u0438\u043B\u0438 \u0441\u0443\u043C\u043C\u0430 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u0447\u0451\u0442\u0443",409);let u=await $(JSON.stringify([a,n.created_at,i])),m=a==="shop_order"?"paid":"refund_reported";return await e.DB.batch([d(e,"INSERT OR IGNORE INTO platform_payment_events(id,invoice_id,name) VALUES(?,?,?)",u,c.id,a),d(e,"UPDATE platform_invoices SET remote_uuid=COALESCE(remote_uuid,?),status=CASE WHEN status='refund_reported' THEN status ELSE ? END,paid_at=CASE WHEN ?='paid' THEN COALESCE(paid_at,unixepoch()) ELSE paid_at END WHERE id=?",s,m,m,c.id),d(e,"INSERT OR IGNORE INTO platform_payment_outbox(id,invoice_id,kind) VALUES(?,?,?)",m==="paid"?"paid:"+c.id:u,c.id,m)]),{status:"ok"}}async function Wt(t,e,r){let n=await d(t,"SELECT * FROM platform_invoices WHERE id=?",e).first();o(n,"\u0421\u0447\u0451\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404);let a=E(r),i=p(a.remoteUuid??n.remote_uuid,36,!0);o(Z.test(i)&&(!n.remote_uuid||n.remote_uuid===i),"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 UUID Tribute",409);let s=E(await Q(t,"/shop/orders/"+i));o(String(s.shopId)===n.tribute_shop_id&&s.amount===n.amount_minor&&s.currency===n.currency&&s.comment==="Catalog Factory "+n.id&&s.period==="onetime"&&!s.onlyStars,"\u0421\u0447\u0451\u0442 Tribute \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u044D\u0442\u043E\u043C\u0443 \u0441\u0447\u0451\u0442\u0443",409);let l=p(s.paymentUrl,2e3,!0),c=new URL(l);o(c.protocol==="https:"&&!c.username&&!c.password&&(c.hostname==="tribute.tg"||c.hostname.endsWith(".tribute.tg")),"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430 Tribute",502),await d(t,"UPDATE platform_invoices SET remote_uuid=?,payment_url=?,status=CASE WHEN status IN ('paid','refund_reported') THEN status WHEN ?='paid' THEN 'paid' ELSE 'pending' END,paid_at=CASE WHEN ?='paid' THEN COALESCE(paid_at,unixepoch()) ELSE paid_at END WHERE id=?",i,l,s.status==="paid"?"paid":"pending",s.status==="paid"?"paid":"pending",n.id).run(),s.status==="paid"&&await d(t,"INSERT OR IGNORE INTO platform_payment_outbox(id,invoice_id,kind) VALUES(?,?,'paid')","paid:"+n.id,n.id).run();let u=await d(t,"SELECT * FROM platform_invoices WHERE id=?",e).first();return o(u,"\u0421\u0447\u0451\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",500),tt(u)}async function pt(t,e,r){if(t.TRIBUTE_PRODUCT_URL){await jt(t,e,r);return}let n=r.startsWith("ru"),a=await G(t,void 0,e);if(!a.length){await O(t,"sendMessage",{chat_id:e,text:n?"\u0414\u043B\u044F \u0432\u0430\u0441 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u0447\u0435\u0442\u043E\u0432 \u043D\u0430 \u043E\u043F\u043B\u0430\u0442\u0443.":"You have no invoices yet."});return}for(let i of a.slice(0,10)){let s=i.status==="paid"?n?"\u041E\u043F\u043B\u0430\u0447\u0435\u043D\u043E":"Paid":i.status==="refund_reported"?n?"\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442":"Refund reported":n?"\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B":"Awaiting payment";await O(t,"sendMessage",{chat_id:e,text:i.title+`
`+i.description+`
`+(i.amountMinor/100).toFixed(2)+" "+i.currency.toUpperCase()+`
`+s,...i.paymentUrl&&i.status==="pending"?{reply_markup:{inline_keyboard:[[{text:n?"\u041E\u043F\u043B\u0430\u0442\u0438\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute":"Pay with Tribute",url:i.paymentUrl}]]}}:{}})}}async function q(t){if(await Ft(t),!t.TELEGRAM_BOT_TOKEN)return;let e=await d(t,"SELECT n.id,n.kind,i.owner_id,i.title,i.amount_minor,i.currency,i.status FROM platform_payment_outbox n JOIN platform_invoices i ON i.id=n.invoice_id WHERE n.sent_at IS NULL AND n.next_attempt<=unixepoch() AND n.lease_until<unixepoch() ORDER BY n.next_attempt LIMIT 5").all();for(let r of e.results){let n=await d(t,"UPDATE platform_payment_outbox SET lease_until=unixepoch()+60 WHERE id=? AND sent_at IS NULL AND lease_until<unixepoch() RETURNING attempts",r.id).first();if(n)try{let a=await P(t,r.owner_id);r.kind==="paid"&&r.status==="refund_reported"||await O(t,"sendMessage",{chat_id:r.owner_id,text:(r.kind==="paid"?a==="ru"?"\u2705 \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430":"\u2705 Payment confirmed":a==="ru"?"\u21A9\uFE0F \u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442":"\u21A9\uFE0F Refund reported")+`
`+r.title+`
`+(r.amount_minor/100).toFixed(2)+" "+r.currency.toUpperCase()}),await d(t,"UPDATE platform_payment_outbox SET sent_at=unixepoch(),lease_until=0 WHERE id=?",r.id).run()}catch{await d(t,"UPDATE platform_payment_outbox SET attempts=attempts+1,next_attempt=unixepoch()+?,lease_until=0 WHERE id=?",Math.min(86400,60*2**Math.min(n.attempts,10)),r.id).run(),console.warn(JSON.stringify({event:"payment_notification_retry"}))}}}async function mt(t,e,r){if(!r||!/^[a-f0-9]{64}$/i.test(e)||new TextEncoder().encode(t).length>64e3)return!1;let n=await crypto.subtle.importKey("raw",new TextEncoder().encode(r),{name:"HMAC",hash:"SHA-256"},!1,["verify"]),a=new Uint8Array(e.match(/.{2}/g).map(i=>parseInt(i,16)));return crypto.subtle.verify("HMAC",n,a,new TextEncoder().encode(t))}var bt={ru:[{command:"start",description:"\u0413\u043B\u0430\u0432\u043D\u043E\u0435 \u043C\u0435\u043D\u044E"},{command:"shop",description:"\u041E\u0442\u043A\u0440\u044B\u0442\u044C Delokay"},{command:"pay",description:"\u041E\u043F\u043B\u0430\u0442\u0430 \u0438 \u043F\u043E\u043A\u0443\u043F\u043A\u0438"},{command:"help",description:"\u041F\u043E\u043C\u043E\u0449\u044C \u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438"},{command:"language",description:"\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u044F\u0437\u044B\u043A"}],en:[{command:"start",description:"Main menu"},{command:"shop",description:"Open Delokay"},{command:"pay",description:"Payments and purchases"},{command:"help",description:"Help and instructions"},{command:"language",description:"Choose language"}]};var Gt={default:{name:"Delokay",short_description:"Simple business tools. Create catalogs and manage orders in Telegram.",description:`Less busywork. More business. \u2728

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

Open the dashboard to get started.`}};async function qt(t,e,r,n,a){o(e.status==="active","\u042D\u0442\u043E \u0434\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u044F. \u0420\u0435\u0430\u043B\u044C\u043D\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u044B \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u044B.",409),o(e.owner_id,"\u0412\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430 \u0435\u0449\u0451 \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D",409),o(/^[a-zA-Z0-9_-]{16,80}$/.test(n),"\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043A\u043B\u044E\u0447 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0430");let i=E(r),s=JSON.parse(e.settings),l=p(i.currency,3,!0);o(s.currencies.includes(l),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0432\u0430\u043B\u044E\u0442\u0430");let c=E(i.customer),u={name:p(c.name,100,!0),phone:p(c.phone,30,!0),address:p(c.address,500,!0),city:p(c.city,100),region:p(c.region,100),index:p(c.index,20),comment:p(c.comment,1e3),deliveryMethod:p(c.deliveryMethod,100,!0)};o(/^[+\d\s()-]{7,30}$/.test(u.phone),"\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043D\u043E\u043C\u0435\u0440 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430"),o(s.deliveryMethods.includes(u.deliveryMethod),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0441\u043F\u043E\u0441\u043E\u0431 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438");let m=i.items;o(Array.isArray(m)&&m.length>0&&m.length<=20,"\u041E\u0442 1 \u0434\u043E 20 \u043F\u043E\u0437\u0438\u0446\u0438\u0439 \u0432 \u0437\u0430\u043A\u0430\u0437\u0435");let y=m.map(v=>{let S=E(v);return{productId:p(S.productId,36,!0),variantId:p(S.variantId,36,!0),quantity:x(S.quantity,1,99),expectedUnitMinor:x(S.expectedUnitMinor,0,1e8)}}).sort((v,S)=>v.variantId.localeCompare(S.variantId));o(new Set(y.map(v=>v.variantId)).size===y.length,"\u041E\u0431\u044A\u0435\u0434\u0438\u043D\u0438\u0442\u0435 \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B");let T=await $(JSON.stringify({customer:u,currency:l,items:y})),f=await d(t,"SELECT * FROM orders WHERE store_id=? AND idempotency_key=?",e.id,n).first();if(f)return o(f.request_hash===T,"\u042D\u0442\u043E\u0442 \u043A\u043B\u044E\u0447 \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D \u0434\u043B\u044F \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0437\u0430\u043A\u0430\u0437\u0430",409),yt(f);o(e.orders_enabled===1,"\u041F\u0440\u0438\u0451\u043C \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D",409);let g=await C(t,e.id),w=y.map(v=>{let S=g.find(it=>it.id===v.productId),k=S?.variants.find(it=>it.id===v.variantId);o(S&&k,"\u0422\u043E\u0432\u0430\u0440 \u0438\u043B\u0438 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",409),o(S.availability!=="unavailable","\u0422\u043E\u0432\u0430\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D",409),o(S.availability==="preorder"||k.stock===null||k.stock>=v.quantity,"\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0442\u043E\u0432\u0430\u0440\u0430 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438",409);let M=Math.round(S.prices[l]*(100-S.discountPercent)/100);return o(Number.isSafeInteger(M),"\u0426\u0435\u043D\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430",409),o(v.expectedUnitMinor===M,"\u0426\u0435\u043D\u0430 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0438 \u043A\u043E\u0440\u0437\u0438\u043D\u0443.",409),{...v,name:S.name,variant:k.label,unitMinor:M,version:S.version,reserved:S.availability!=="preorder"&&k.stock!==null}}),R=w.reduce((v,S)=>v+S.unitMinor*S.quantity,0);o(Number.isSafeInteger(R)&&R<=1e9,"\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u0437\u0430\u043A\u0430\u0437\u0430");let h=crypto.randomUUID(),_=await $(e.id+":"+a);try{await d(t,"INSERT INTO orders(id,store_id,number,idempotency_key,request_hash,customer,items,currency,total_minor,ip_hash) VALUES(?,?,(SELECT COALESCE(MAX(number),0)+1 FROM orders WHERE store_id=?),?,?,?,?,?,?,?)",h,e.id,e.id,n,T,JSON.stringify(u),JSON.stringify(w),l,R,_).run()}catch(v){let S=await d(t,"SELECT * FROM orders WHERE store_id=? AND idempotency_key=?",e.id,n).first();if(S)return o(S.request_hash===T,"\u042D\u0442\u043E\u0442 \u043A\u043B\u044E\u0447 \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D \u0434\u043B\u044F \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0437\u0430\u043A\u0430\u0437\u0430",409),yt(S);let k=String(v);throw k.includes("RATE_LIMIT")?new N(429,"\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u0430\u0437\u043E\u0432. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435."):k.includes("CATALOG_CHANGED")||k.includes("STORE_NOT_ACTIVE")?new N(409,"\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0438 \u043A\u043E\u0440\u0437\u0438\u043D\u0443."):v}let I=await d(t,"SELECT * FROM orders WHERE id=? AND store_id=?",h,e.id).first();return o(I,"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0437\u0430\u043A\u0430\u0437",500),yt(I)}function yt(t){return{id:t.id,number:t.number,currency:t.currency,totalMinor:t.total_minor,status:t.status}}function wt(t){return{id:t.id,number:t.number,status:t.status,currency:t.currency,totalMinor:t.total_minor,createdAt:t.created_at,customer:JSON.parse(t.customer),items:JSON.parse(t.items)}}async function rt(t,e,r,n,a){let i=await d(t,"SELECT * FROM orders WHERE store_id=? AND id=?",e,r).first();o(i,"\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404);let s={new:["processing","completed","cancelled"],processing:["completed","cancelled"],completed:[],cancelled:[]};if(i.status===n)return;o(s[i.status]?.includes(n),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u0441\u0442\u0430\u0442\u0443\u0441\u0430",409);let l=await d(t,"UPDATE orders SET status=? WHERE id=? AND store_id=? AND status=? AND EXISTS(SELECT 1 FROM stores WHERE id=? AND owner_id IS ? AND version=?) RETURNING id",n,r,e,i.status,a.id,a.owner_id,a.version).first();o(l,"\u0421\u0442\u0430\u0442\u0443\u0441 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0437\u0430\u043A\u0430\u0437.",409)}async function O(t,e,r){o(t.TELEGRAM_BOT_TOKEN,"Telegram \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D",503);let n=await fetch(`https://api.telegram.org/bot${t.TELEGRAM_BOT_TOKEN}/${e}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(r),signal:AbortSignal.timeout(8e3)}),a=await n.json();return o(n.ok&&a.ok,"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441 Telegram",502),a}function A(t){let e=new URL(t.PUBLIC_ORIGIN);return o(e.protocol==="https:"||e.hostname==="localhost"||e.hostname==="127.0.0.1","\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 PUBLIC_ORIGIN",503),e.origin}async function zt(t,e,r){let n=E(r);o(!e.owner_id||n.transfer===!0,"\u0414\u043B\u044F \u0441\u043C\u0435\u043D\u044B \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0443",409);let a=p(n.telegramUserId,20,!0);o(/^[1-9]\d{0,15}$/.test(a),"\u0423\u043A\u0430\u0436\u0438\u0442\u0435 Telegram ID \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430"),o(a!==e.owner_id,"\u042D\u0442\u043E\u0442 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0443\u0436\u0435 \u0432\u043B\u0430\u0434\u0435\u0435\u0442 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u043C",409),o(/^[a-z0-9_]{5,32}$/i.test(t.BOT_USERNAME),"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 BOT_USERNAME",503);let i=crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"").slice(0,16),s=await $(i);return await t.DB.batch([F(t,e),d(t,"DELETE FROM owner_invites WHERE store_id=? AND used_at IS NULL",e.id),d(t,"INSERT INTO owner_invites(token_hash,store_id,expected_owner_id,source_owner_id,store_version,expires_at) SELECT ?,id,?,owner_id,version,unixepoch()+86400 FROM stores WHERE id=? AND version=?",s,a,e.id,e.version),d(t,"DELETE FROM mutation_guards")]),{url:`https://t.me/${t.BOT_USERNAME}?start=claim_${i}`,expiresIn:86400}}async function ge(t,e,r){let n=await $(e),a=await d(t,"UPDATE stores SET owner_id=?,version=version+1 WHERE EXISTS(SELECT 1 FROM owner_invites i WHERE i.store_id=stores.id AND i.token_hash=? AND i.expected_owner_id=? AND i.expires_at>unixepoch() AND i.used_at IS NULL AND stores.owner_id IS i.source_owner_id AND (i.store_version IS NULL OR stores.version=i.store_version)) RETURNING *",r,n,r).first();return o(a,"\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u043D\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E, \u0438\u0441\u0442\u0435\u043A\u043B\u043E \u0438\u043B\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u043E \u0434\u043B\u044F \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430",403),await d(t,"UPDATE owner_invites SET used_at=unixepoch() WHERE token_hash=?",n).run(),a}async function Jt(t,e,r,n=!0){let a=U[r],i=await d(t,"SELECT * FROM stores WHERE owner_id=? ORDER BY created_at LIMIT 20",e).all();n&&await O(t,"sendMessage",{chat_id:e,text:i.results.length?a.returning:a.welcome+a.noStore+`

`+a.telegramId+e,reply_markup:{inline_keyboard:[[{text:a.dashboard,web_app:{url:A(t)+"/admin"}}],[{text:a.payments,callback_data:"menu:pay"},{text:a.helpButton,callback_data:"menu:help"}],[{text:a.language,callback_data:"menu:language"}]]}});for(let s of i.results)await O(t,"sendMessage",{chat_id:e,text:s.name+`
`+A(t)+`/${s.status==="demo"?"demo":"shop"}/${s.slug}`,reply_markup:{inline_keyboard:[[{text:a.store,web_app:{url:A(t)+`/admin?store=${s.id}`}}],[{text:a.payments,callback_data:"menu:pay"}]]}})}async function Kt(t,e,r){await O(t,"sendMessage",{chat_id:e,text:U[r].help,reply_markup:{inline_keyboard:[[{text:U[r].dashboard,web_app:{url:A(t)+"/admin"}}]]}})}async function Yt(t,e,r){await O(t,"sendMessage",{chat_id:e,text:U[r].chooseLanguage,reply_markup:{inline_keyboard:[[{text:"\u{1F1F7}\u{1F1FA} \u0420\u0443\u0441\u0441\u043A\u0438\u0439",callback_data:"lang:ru"},{text:"\u{1F1EC}\u{1F1E7} English",callback_data:"lang:en"}]]}})}async function Vt(t,e,r){o(e.TELEGRAM_WEBHOOK_SECRET&&await X(t.headers.get("X-Telegram-Bot-Api-Secret-Token")??"",e.TELEGRAM_WEBHOOK_SECRET),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 webhook",401);let n=E(r);if(n.callback_query){let a=E(n.callback_query),i=E(a.from),s=E(a.message??{}),l=E(s.chat??{});o(l.type==="private"&&String(l.id)===String(i.id),"\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0432 \u043B\u0438\u0447\u043D\u043E\u043C \u0447\u0430\u0442\u0435",403);let c=p(a.data,64),u=String(i.id);if(c.startsWith("lang:")&&["lang:ru","lang:en"].includes(c)){let f=c.slice(5);await $t(e,u,f),await O(e,"answerCallbackQuery",{callback_query_id:p(a.id,200,!0),text:U[f].languageSaved}),await Jt(e,u,f);return}if(["menu:pay","menu:help","menu:language"].includes(c)){let f=await V(e,u,i.language_code);await O(e,"answerCallbackQuery",{callback_query_id:p(a.id,200,!0)}),c==="menu:pay"&&await pt(e,u,f),c==="menu:help"&&await Kt(e,u,f),c==="menu:language"&&await Yt(e,u,f);return}let m=c.split(":");o(m.length===2&&["a","c","x"].includes(m[0]),"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430");let y=await V(e,u,i.language_code),T=U[y].statusSaved;try{let f=await d(e,"SELECT * FROM orders WHERE id=?",m[1]).first();o(f,"\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404);let g=await Y(e,f.store_id,String(i.id));await rt(e,f.store_id,f.id,{a:"processing",c:"completed",x:"cancelled"}[m[0]],g)}catch(f){T=f instanceof Error?f.message:"\u041E\u0448\u0438\u0431\u043A\u0430"}await O(e,"answerCallbackQuery",{callback_query_id:p(a.id,200,!0),text:T});return}if(n.message){let a=E(n.message),i=E(a.chat),s=E(a.from??{});o(i.type==="private"&&String(i.id)===String(s.id),"\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043B\u0438\u0447\u043D\u044B\u0439 \u0447\u0430\u0442 \u0441 \u0431\u043E\u0442\u043E\u043C",403);let l=String(s.id);o(/^[1-9]\d{0,15}$/.test(l),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C");let c=p(a.text,4096),u=await V(e,l,s.language_code);if(c.startsWith("/start claim_"))try{let m=await ge(e,c.slice(13),l);await O(e,"sendMessage",{chat_id:l,text:U[u].connected+m.name+U[u].connectedEnd})}catch{await O(e,"sendMessage",{chat_id:l,text:U[u].claimError});return}if(/^\/(pay)(\s|$|@)/.test(c)||c==="/start payments"){await pt(e,l,u);return}if(/^\/(help)(\s|$|@)/.test(c)){await Kt(e,l,u);return}if(/^\/(language)(\s|$|@)/.test(c)){await Yt(e,l,u);return}/^\/(start|admin|shop)(\s|$|@)/.test(c)&&await Jt(e,l,u)}}async function _t(t,e){if(!t.TELEGRAM_BOT_TOKEN)return;let r=await d(t,`SELECT o.*,s.owner_id,s.name AS store_name FROM notification_outbox n JOIN orders o ON o.id=n.order_id JOIN stores s ON s.id=o.store_id WHERE n.sent_at IS NULL AND n.next_attempt<=unixepoch() AND n.lease_until<unixepoch() ${e?"AND n.order_id=?":""} ORDER BY n.next_attempt LIMIT 10`,...e?[e]:[]).all();for(let n of r.results){let a=await d(t,"UPDATE notification_outbox SET lease_until=unixepoch()+60 WHERE order_id=? AND sent_at IS NULL AND lease_until<unixepoch() RETURNING attempts",n.id).first();if(a)try{let i=await P(t,n.owner_id),s=U[i],l=JSON.parse(n.customer),c=JSON.parse(n.items),u=`${n.store_name}
${s.newOrder}${n.number}
${l.name}
${s.phone}${l.phone}
${l.deliveryMethod}: ${l.address}
${l.city} ${l.region} ${l.index}
${c.map(m=>`${m.name} (${m.variant}) \xD7 ${m.quantity}`).join(`
`)}
${s.total}${(n.total_minor/100).toFixed(2)} ${n.currency}${l.comment?`
`+l.comment:""}`;await O(t,"sendMessage",{chat_id:n.owner_id,text:u.slice(0,4e3),reply_markup:{inline_keyboard:[[{text:s.accept,callback_data:"a:"+n.id},{text:s.complete,callback_data:"c:"+n.id}],[{text:s.openOrder,web_app:{url:A(t)+`/admin?store=${n.store_id}&order=${n.id}`}},{text:s.cancel,callback_data:"x:"+n.id}]]}}),await d(t,"UPDATE notification_outbox SET sent_at=unixepoch(),lease_until=0 WHERE order_id=?",n.id).run()}catch{let i=Math.min(86400,60*2**Math.min(a.attempts,10));await d(t,"UPDATE notification_outbox SET attempts=attempts+1,next_attempt=unixepoch()+?,lease_until=0 WHERE order_id=?",i,n.id).run(),console.warn(JSON.stringify({event:"telegram_notification_retry",orderId:n.id}))}}}async function fe(t){for(let e of["","ru","en"]){let r=Gt[e==="ru"?"ru":"en"];for(let[n,a,i]of[["setMyName","name",r.name],["setMyShortDescription","short_description",r.short_description],["setMyDescription","description",r.description]])await O(t,n,{language_code:e,[a]:i})}}async function Ee(t){for(let e of["default","all_private_chats"])for(let r of["","ru","en"])await O(t,"setMyCommands",{scope:{type:e},language_code:r,commands:r==="ru"?bt.ru:bt.en})}async function Tt(t){let e=A(t);o(e.startsWith("https://"),"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 HTTPS PUBLIC_ORIGIN",503),o(/^[a-z0-9_]{5,32}$/i.test(t.BOT_USERNAME),"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 BOT_USERNAME",503),o(t.TELEGRAM_WEBHOOK_SECRET,"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 TELEGRAM_WEBHOOK_SECRET",503);let r=E((await O(t,"getMe",{})).result);return o(String(r.username).toLowerCase()===String(t.BOT_USERNAME).toLowerCase(),"BOT_USERNAME \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441 \u0431\u043E\u0442\u043E\u043C, \u043A\u043E\u0442\u043E\u0440\u043E\u043C\u0443 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0438\u0442 \u0442\u043E\u043A\u0435\u043D",409),await O(t,"setWebhook",{url:e+"/api/telegram/webhook",secret_token:t.TELEGRAM_WEBHOOK_SECRET,allowed_updates:["message","callback_query"]}),await Ee(t),await fe(t),await O(t,"setChatMenuButton",{menu_button:{type:"web_app",text:"Delokay",web_app:{url:e+"/admin"}}}),{ok:!0,botUsername:t.BOT_USERNAME,webhookUrl:e+"/api/telegram/webhook"}}function St(t){let e=t.TRIBUTE_PRODUCT_URL;return o(/^https:\/\/web\.tribute\.tg\/p\/[a-zA-Z0-9]+$/.test(e),"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 \u0441\u0441\u044B\u043B\u043A\u0443 \u0442\u043E\u0432\u0430\u0440\u0430 Tribute",503),e}async function Xt(t,e){o(t.TRIBUTE_API_KEY,"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 TRIBUTE_API_KEY",503);let r=await fetch("https://tribute.tg/api/v1"+e,{headers:{"Api-Key":t.TRIBUTE_API_KEY},signal:AbortSignal.timeout(1e4)});return o(r.ok,"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0442\u043E\u0432\u0430\u0440 Tribute",502),E(await r.json())}async function gt(t){let e=St(t);for(let r=1;r<=10;r++){let n=await Xt(t,"/products?size=100&page="+r);o(Array.isArray(n.rows),"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0442\u043E\u0432\u0430\u0440\u043E\u0432 Tribute",502);let a=n.rows.map(E).find(i=>i.webLink===e);if(a)return o(["digital","custom"].includes(String(a.type)),"\u041D\u0443\u0436\u0435\u043D \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u0439 \u0442\u043E\u0432\u0430\u0440 \u0438\u043B\u0438 \u0442\u043E\u0432\u0430\u0440 \u043D\u0430 \u0437\u0430\u043A\u0430\u0437 Tribute",503),a;if(n.rows.length<100)break}o(!1,"\u0422\u043E\u0432\u0430\u0440 \u043F\u043E \u044D\u0442\u043E\u0439 \u0441\u0441\u044B\u043B\u043A\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0432\u0430\u0448\u0435\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0435 Tribute",503)}function ft(t){return t.status==="approved"||t.type==="custom"&&t.status==="new"}function Et(t,e){let r=St(e);return t.type==="custom"?"https://t.me/tribute/app?startapp=p"+r.split("/").at(-1):r}async function ht(t,e){return(await d(t,"SELECT * FROM tribute_digital_purchases WHERE (? IS NULL OR owner_id=?) ORDER BY created_at DESC,purchase_id DESC LIMIT 50",e??null,e??null).all()).results.map(n=>({id:"digital:"+n.purchase_id,type:"digital",storeId:null,ownerId:n.owner_id,title:n.title,description:"",amountMinor:n.amount_minor,currency:n.currency,status:n.status,paymentUrl:null,createdAt:n.created_at,paidAt:null}))}async function at(t,e,r){let n=E(r),a=x(n.product_id,1,Number.MAX_SAFE_INTEGER),i=await Xt(t,"/products/"+a);if(i.webLink!==St(t)||!["digital","custom"].includes(String(i.type)))return{status:"ignored"};let s=String(x(n.purchase_id,1,Number.MAX_SAFE_INTEGER)),l=String(x(n.telegram_user_id,1,Number.MAX_SAFE_INTEGER)),c=x(n.amount,0,Number.MAX_SAFE_INTEGER),u=p(n.currency,3,!0).toLowerCase();o(["usd","eur","rub"].includes(u),"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0432\u0430\u043B\u044E\u0442\u0430 \u043E\u043F\u043B\u0430\u0442\u044B",400);let m=await d(t,"SELECT * FROM tribute_digital_purchases WHERE purchase_id=?",s).first();o(!m||m.owner_id===l&&m.product_id===a&&m.currency===u&&m.amount_minor===c,"\u041F\u043E\u043A\u0443\u043F\u043A\u0430 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u043E\u0439 \u043E\u043F\u043B\u0430\u0442\u0435",409);let y=e==="new_digital_product"?"paid":"refund_reported",T=p(n.product_name??i.name,300,!0);return await t.DB.batch([d(t,"INSERT INTO tribute_digital_purchases(purchase_id,owner_id,product_id,title,amount_minor,currency,status) VALUES(?,?,?,?,?,?,?) ON CONFLICT(purchase_id) DO UPDATE SET status=CASE WHEN tribute_digital_purchases.status='refund_reported' THEN tribute_digital_purchases.status ELSE excluded.status END",s,l,a,T,c,u,y),d(t,"INSERT OR IGNORE INTO tribute_digital_outbox(id,purchase_id,kind) VALUES(?,?,?)",y+":"+s,s,y)]),{status:"ok"}}async function jt(t,e,r){let n=r.startsWith("ru"),a=await gt(t),i=await ht(t,e);for(let s of i.slice(0,10))await O(t,"sendMessage",{chat_id:e,text:s.title+`
`+(s.amountMinor/100).toFixed(2)+" "+s.currency.toUpperCase()+`
`+(s.status==="paid"?n?"\u041E\u043F\u043B\u0430\u0447\u0435\u043D\u043E":"Paid":n?"\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442":"Refund reported")});if(!ft(a)){await O(t,"sendMessage",{chat_id:e,text:n?"\u0422\u043E\u0432\u0430\u0440 \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B.":"This product is not available for payment yet."});return}await O(t,"sendMessage",{chat_id:e,text:p(a.name,300,!0)+`
`+(x(a.amount,0,Number.MAX_SAFE_INTEGER)/100).toFixed(2)+" "+p(a.currency,3,!0).toUpperCase()+(a.type==="custom"?n?`
\u0422\u043E\u0432\u0430\u0440 \u043D\u0430 \u0437\u0430\u043A\u0430\u0437. \u041F\u0440\u043E\u0434\u0430\u0432\u0435\u0446 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0447\u0435\u0440\u0435\u0437 Tribute \u043F\u043E\u0441\u043B\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u0430 \u0438 \u043C\u043E\u0434\u0435\u0440\u0430\u0446\u0438\u0438.`:`
Made to order. The seller will send the result through Tribute after fulfillment and moderation.`:""),reply_markup:{inline_keyboard:[[{text:a.type==="custom"?n?"\u0417\u0430\u043A\u0430\u0437\u0430\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute":"Order with Tribute":n?"\u041E\u043F\u043B\u0430\u0442\u0438\u0442\u044C \u0447\u0435\u0440\u0435\u0437 Tribute":"Pay with Tribute",url:Et(a,t)}]]}})}async function Ft(t){if(!t.TELEGRAM_BOT_TOKEN)return;let e=await d(t,"SELECT n.id,n.kind,p.owner_id,p.title,p.amount_minor,p.currency,p.status FROM tribute_digital_outbox n JOIN tribute_digital_purchases p ON p.purchase_id=n.purchase_id WHERE n.sent_at IS NULL AND n.next_attempt<=unixepoch() AND n.lease_until<unixepoch() ORDER BY n.next_attempt LIMIT 5").all();for(let r of e.results){let n=await d(t,"UPDATE tribute_digital_outbox SET lease_until=unixepoch()+60 WHERE id=? AND sent_at IS NULL AND lease_until<unixepoch() RETURNING attempts",r.id).first();if(n)try{let a=await P(t,r.owner_id);r.kind==="paid"&&r.status==="refund_reported"||await O(t,"sendMessage",{chat_id:r.owner_id,text:(r.kind==="paid"?a==="ru"?"\u2705 \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430":"\u2705 Payment confirmed":a==="ru"?"\u21A9\uFE0F \u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442":"\u21A9\uFE0F Refund reported")+`
`+r.title+`
`+(r.amount_minor/100).toFixed(2)+" "+r.currency.toUpperCase()}),await d(t,"UPDATE tribute_digital_outbox SET sent_at=unixepoch(),lease_until=0 WHERE id=?",r.id).run()}catch{await d(t,"UPDATE tribute_digital_outbox SET attempts=attempts+1,next_attempt=unixepoch()+?,lease_until=0 WHERE id=?",Math.min(86400,60*2**Math.min(n.attempts,10)),r.id).run()}}}async function Zt(t,e,r){let n=E(r);o(e.status==="active","\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u0443\u0439\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D",409),o(typeof n.enabled=="boolean","\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u0440\u0438\u0451\u043C\u0430 \u0437\u0430\u043A\u0430\u0437\u043E\u0432");let a=await d(t,"UPDATE stores SET orders_enabled=?,version=version+1 WHERE id=? AND version=?",n.enabled?1:0,e.id,x(n.version,1,Number.MAX_SAFE_INTEGER)).run();return o(a.meta.changes===1,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0438\u0437\u043C\u0435\u043D\u0451\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A.",409),{ok:!0}}async function Qt(t,e,r){let n=E(r);o(e.status==="demo","\u041C\u043E\u0436\u043D\u043E \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u0435\u043C\u043E",409),o(n.confirmSlug===e.slug,"\u0414\u043B\u044F \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F \u0432\u0432\u0435\u0434\u0438\u0442\u0435 slug \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430"),o(x(n.version,1,Number.MAX_SAFE_INTEGER)===e.version,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0438\u0437\u043C\u0435\u043D\u0451\u043D",409),o(!await d(t,"SELECT id FROM platform_invoices WHERE store_id=? LIMIT 1",e.id).first(),"\u0414\u0435\u043C\u043E \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0441\u0447\u0435\u0442\u0430 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u0434\u043B\u044F \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439",409);try{await t.DB.batch([F(t,e),d(t,"INSERT INTO mutation_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM stores WHERE id=? AND status='demo') AND NOT EXISTS(SELECT 1 FROM orders WHERE store_id=?) THEN 1 ELSE 0 END",e.id,e.id),d(t,"INSERT OR IGNORE INTO media_cleanup(store_id) VALUES(?)",e.id),d(t,"DELETE FROM owner_invites WHERE store_id=?",e.id),d(t,"DELETE FROM variants WHERE store_id=?",e.id),d(t,"DELETE FROM products WHERE store_id=?",e.id),d(t,"DELETE FROM stores WHERE id=?",e.id),d(t,"DELETE FROM mutation_guards")])}catch(a){throw String(a).includes("CHECK constraint")?new N(409,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0438\u0437\u043C\u0435\u043D\u0451\u043D \u0438\u043B\u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0437\u0430\u043A\u0430\u0437\u044B. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u043F\u0438\u0441\u043E\u043A."):a}}async function Rt(t){let e=await d(t,"SELECT store_id FROM media_cleanup LIMIT 1").first();if(e)try{let r=await t.IMAGES.list({prefix:e.store_id+"/",limit:200});r.objects.length&&await t.IMAGES.delete(r.objects.map(n=>n.key)),r.truncated||await d(t,"DELETE FROM media_cleanup WHERE store_id=?",e.store_id).run()}catch{console.error(JSON.stringify({event:"media_cleanup_retry"}))}}async function te(t,e,r){let n=E(r),a=crypto.randomUUID(),i=crypto.randomUUID(),s=[],l=new Map;function c(g){if(!g.startsWith("/media/"))return g;if(o(g.startsWith("/media/"+e.id+"/"),"\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430"),!l.has(g)){let w=g.slice(g.lastIndexOf(".")),R=a+"/"+crypto.randomUUID()+w;s.push({source:g.slice(7),target:R}),l.set(g,"/media/"+R)}return l.get(g)}let u=JSON.parse(e.settings);u.logo=c(u.logo);let m=(await C(t,e.id)).map(g=>({...g,id:void 0,version:void 0,photos:g.photos.map(c),variants:g.variants.map(w=>({label:w.label,stock:w.stock}))})),y=p(n.name,200,!0),T=p(n.slug,80,!0);o(/^[a-z0-9][a-z0-9-]{0,79}$/.test(T),"Slug: \u043B\u0430\u0442\u0438\u043D\u0438\u0446\u0430, \u0446\u0438\u0444\u0440\u044B \u0438 \u0434\u0435\u0444\u0438\u0441");let f=JSON.stringify({name:y,slug:T,settings:u,products:m});return o(new TextEncoder().encode(f+JSON.stringify(s)).length<18e5,"\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0434\u043B\u044F \u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F"),await d(t,"INSERT INTO store_copy_jobs(id,target_id,name,payload,files) VALUES(?,?,?,?,?)",i,a,y,f,JSON.stringify(s)).run(),{id:i,status:"pending"}}async function ee(t){return(await d(t,"SELECT id,target_id AS targetId,name,status,error,cursor AS copied,json_array_length(files) AS total FROM store_copy_jobs ORDER BY created_at DESC LIMIT 50").all()).results}async function nt(t,e,r,n=4){let a=await d(t,"UPDATE store_copy_jobs SET lease_until=unixepoch()+300 WHERE id=(SELECT id FROM store_copy_jobs WHERE status='pending' AND lease_until<unixepoch() AND (? IS NULL OR id=?) ORDER BY created_at LIMIT 1) RETURNING *",r??null,r??null).first();if(a)try{let i=JSON.parse(a.files),s=Math.min(i.length,a.cursor+n);for(let l=a.cursor;l<s;l++){let c=await t.IMAGES.get(i[l].source);o(c,"\u0418\u0441\u0445\u043E\u0434\u043D\u043E\u0435 \u0444\u043E\u0442\u043E \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E",409),await t.IMAGES.put(i[l].target,c.body,{httpMetadata:c.httpMetadata,customMetadata:c.customMetadata})}s===i.length?(await d(t,"SELECT id FROM stores WHERE id=?",a.target_id).first()||await z(t,JSON.parse(a.payload),e,a.target_id),await d(t,"UPDATE store_copy_jobs SET status='completed',cursor=?,lease_until=0 WHERE id=?",s,a.id).run()):await d(t,"UPDATE store_copy_jobs SET cursor=?,lease_until=0 WHERE id=?",s,a.id).run()}catch{await d(t,"SELECT id FROM stores WHERE id=?",a.target_id).first()?await d(t,"UPDATE store_copy_jobs SET status='completed',lease_until=0 WHERE id=?",a.id).run():await t.DB.batch([d(t,"UPDATE store_copy_jobs SET status='failed',error=?,lease_until=0 WHERE id=?","\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438 \u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435.",a.id),d(t,"INSERT OR IGNORE INTO media_cleanup(store_id) VALUES(?)",a.target_id)])}}function b(t,e=200){return new Response(JSON.stringify(t),{status:e,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}async function be(t,e,r){let n=r.id,a=await W(t,3*1024*1024);o(a.length>=12,"\u041F\u0443\u0441\u0442\u043E\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435");let i="",s="";a[0]===255&&a[1]===216&&a[2]===255?(i="jpg",s="image/jpeg"):[137,80,78,71,13,10,26,10].every((u,m)=>a[m]===u)?(i="png",s="image/png"):new TextDecoder().decode(a.slice(0,4))==="RIFF"&&new TextDecoder().decode(a.slice(8,12))==="WEBP"&&(i="webp",s="image/webp"),o(i&&t.headers.get("content-type")===s,"\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E JPEG, PNG \u0438 WebP",415);let l=n+"/"+crypto.randomUUID()+"."+i;await e.IMAGES.put(l,a,{httpMetadata:{contentType:s,cacheControl:"public, max-age=31536000, immutable"}});let c=await d(e,"SELECT version,owner_id FROM stores WHERE id=?",n).first();if(!c||c.owner_id!==r.owner_id||c.version!==r.version)throw await e.IMAGES.delete(l),new N(409,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u0438\u0437\u043C\u0435\u043D\u0451\u043D. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u043F\u0430\u043D\u0435\u043B\u044C.");return{url:"/media/"+l}}async function ye(t,e,r){let n=new URL(t.url),a=n.pathname,i=t.method;if(a==="/api/tribute/webhook"&&i==="POST"){let g=await Bt(t,e);return r.waitUntil(q(e)),b(g)}if(["/platform.js","/platform/app.js"].includes(a)&&(i==="GET"||i==="HEAD"))return new Response(i==="HEAD"?null:vt,{headers:{"Content-Type":"application/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"}});if(["/admin","/admin/","/admin.html","/admin.js","/admin/app.js"].includes(a)&&(i==="GET"||i==="HEAD"))return new Response(i==="HEAD"?null:a.endsWith(".js")?It:Ot,{headers:{"Content-Type":a.endsWith(".js")?"application/javascript; charset=utf-8":"text/html; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"}});if(["/platform","/platform/","/platform.html","/platform/editor","/platform-editor.html"].includes(a)&&(i==="GET"||i==="HEAD")){let g=a==="/platform/editor"||a==="/platform-editor.html";return new Response(i==="HEAD"?null:g?xt:Nt,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","Content-Security-Policy":g?"frame-ancestors 'self'":"frame-ancestors 'none'"}})}if(a==="/api/health"&&i==="GET")return b({ok:!0});if(a==="/api/templates"&&i==="GET")return b(kt());let s=a.match(/^\/api\/templates\/([a-z]+)$/);if(s&&i==="GET"){let g=j(s[1]);o(g,"\u0428\u0430\u0431\u043B\u043E\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404);let w="00000000-0000-0000-0000-000000000000",R=H(J(g));return b({store:{id:w,slug:g.id,name:g.name,status:"demo",version:1,acceptingOrders:!1,settings:R},products:K(g,R.currencies).map((h,_)=>{let I=B(h,R,w);return{...I.data,variants:I.variants,id:"preview-"+_,version:1}})})}if(a==="/api/telegram/webhook"&&i==="POST")return await Vt(t,e,await L(t,64e3)),b({ok:!0});if(a.startsWith("/api/platform/")){if(await Dt(t,e),a==="/api/platform/payments/config"&&i==="GET")return b(await et(e));if(a==="/api/platform/payments"&&i==="GET")return b(await G(e));let g=a.match(/^\/api\/platform\/stores\/([a-f0-9-]{36})\/invoices$/);if(g){if(i==="GET")return b(await G(e,g[1]));if(i==="POST"){let _=await d(e,"SELECT * FROM stores WHERE id=?",g[1]).first();return o(_,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),b(await Ht(e,_,await L(t)),201)}}let w=a.match(/^\/api\/platform\/invoices\/([a-f0-9-]{36})\/reconcile$/);if(w&&i==="POST"){let _=await Wt(e,w[1],await L(t));return r.waitUntil(q(e)),b(_)}if(a==="/api/platform/telegram/setup"&&i==="POST")return b(await Tt(e));if(a==="/api/platform/config"&&i==="GET")return b({publicOrigin:A(e),botUsername:e.BOT_USERNAME});if(a==="/api/platform/stores"&&i==="GET"){let _=await d(e,"SELECT * FROM stores ORDER BY created_at DESC,id LIMIT 200").all();return b(_.results.map(I=>({...D(I),ownerLinked:!!I.owner_id})))}if(a==="/api/platform/stores"&&i==="POST")return b(await z(e,await L(t),A(e)),201);if(a==="/api/platform/copies"&&i==="GET")return b(await ee(e));let R=a.match(/^\/api\/platform\/copies\/([a-f0-9-]{36})\/continue$/);if(R&&i==="POST")return await nt(e,A(e),R[1]),b({ok:!0});let h=a.match(/^\/api\/platform\/stores\/([a-f0-9-]{36})\/(invite|activate|export|intake|copy|delete-demo)$/);if(h){let _=await d(e,"SELECT * FROM stores WHERE id=?",h[1]).first();if(o(_,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),h[2]==="intake"&&i==="POST")return b(await Zt(e,_,await L(t)));if(h[2]==="copy"&&i==="POST"){let I=await te(e,_,await L(t));return r.waitUntil(nt(e,A(e),I.id)),b(I,202)}if(h[2]==="delete-demo"&&i==="POST")return await Qt(e,_,await L(t)),r.waitUntil(Rt(e)),b({ok:!0});if(h[2]==="invite"&&i==="POST")return b(await zt(e,_,await L(t)));if(h[2]==="activate"&&i==="POST")return o(_.owner_id,"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430",409),o(e.TELEGRAM_BOT_TOKEN&&e.TELEGRAM_WEBHOOK_SECRET,"\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 Telegram",503),await d(e,"UPDATE stores SET status='active',version=version+1 WHERE id=? AND version=? AND owner_id IS ?",_.id,_.version,_.owner_id).run(),b({url:A(e)+"/shop/"+_.slug});if(h[2]==="export"&&i==="GET")return b({schemaVersion:1,...D(_),products:await C(e,_.id)})}}if(a.startsWith("/api/admin/")||a.startsWith("/api/platform/")){let g=a.startsWith("/api/platform/"),w=g?null:await Pt(t,e);if(a==="/api/admin/payments/config"&&i==="GET")return b(await et(e));if(a==="/api/admin/payments"&&i==="GET")return b(await G(e,void 0,w));if(a==="/api/admin/stores"&&i==="GET"){let h=await d(e,"SELECT * FROM stores WHERE owner_id=? ORDER BY created_at LIMIT 50",w).all();return b(h.results.map(D))}let R=a.match(/^\/api\/(?:admin|platform)\/stores\/([a-f0-9-]{36})(?:\/(products|orders|settings|images)(?:\/([a-f0-9-]{36}))?)?$/);if(R){let h=g?await d(e,"SELECT * FROM stores WHERE id=?",R[1]).first():await Y(e,R[1],w),_=R[2],I=R[3];if(o(h,"\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),!_&&i==="GET"){let v=await d(e,"SELECT (SELECT COUNT(*) FROM products WHERE store_id=? AND deleted_at IS NULL) productCount,(SELECT COUNT(*) FROM orders WHERE store_id=? AND status='new') newOrderCount",h.id,h.id).first();return b({...D(h),stats:v})}if(_==="products"&&!I&&i==="GET")return b(await C(e,h.id));if(_==="products"&&!I&&i==="POST")return b(await ct(e,h,await L(t)),201);if(_==="products"&&I&&i==="PUT")return b(await ct(e,h,await L(t),I));if(_==="products"&&I&&i==="DELETE"){let v=E(await L(t)),S=x(v.version,1,Number.MAX_SAFE_INTEGER),k=await d(e,"UPDATE products SET deleted_at=unixepoch(),version=version+1 WHERE store_id=? AND id=? AND deleted_at IS NULL AND version=? AND EXISTS(SELECT 1 FROM stores WHERE id=? AND owner_id IS ? AND version=?)",h.id,I,S,h.id,h.owner_id,h.version).run();return o(k.meta.changes===1,"\u0422\u043E\u0432\u0430\u0440 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D \u0438\u043B\u0438 \u0443\u0434\u0430\u043B\u0451\u043D",409),b({ok:!0})}if(_==="orders"&&i==="GET"){if(I){let M=await d(e,"SELECT * FROM orders WHERE store_id=? AND id=?",h.id,I).first();return o(M,"\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),b(wt(M))}let v=Number(n.searchParams.get("offset")??0);o(Number.isInteger(v)&&v>=0&&v<=1e5,"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430");let S=n.searchParams.get("status")??"";o(!S||["new","processing","completed","cancelled"].includes(S),"\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441");let k=await d(e,`SELECT * FROM orders WHERE store_id=? ${S?"AND status=?":""} ORDER BY created_at DESC,number DESC LIMIT 50 OFFSET ?`,h.id,...S?[S]:[],v).all();return b(k.results.map(wt))}if(_==="orders"&&I&&i==="PATCH")return await rt(e,h.id,I,p(E(await L(t)).status,20,!0),h),b({ok:!0});if(_==="settings"&&!I&&i==="PUT")return await Ut(e,h,await L(t)),b({ok:!0});if(_==="images"&&!I&&i==="POST")return b(await be(t,e,h),201)}}let l=a.match(/^\/api\/stores\/([a-z0-9-]{1,80})(?:\/(orders))?$/);if(l){let g=await dt(e,l[1]);if(i==="GET"&&!l[2])return b({store:D(g),products:await C(e,g.id)});if(i==="POST"&&l[2]){let w=await qt(e,g,await L(t,32e3),t.headers.get("Idempotency-Key")??"",t.headers.get("CF-Connecting-IP")??"local");return r.waitUntil(_t(e,w.id)),b(w,201)}}if(a.startsWith("/api/"))throw new N(404,"API \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D");if(a.startsWith("/media/")&&(i==="GET"||i==="HEAD")){o(/^\/media\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(a),"\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",404);let g=await e.IMAGES.get(a.slice(7));o(g,"\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",404);let w=new Headers;return g.writeHttpMetadata(w),w.set("ETag",g.httpEtag),w.set("X-Content-Type-Options","nosniff"),w.set("Content-Security-Policy","default-src 'none'"),new Response(i==="HEAD"?null:g.body,{headers:w})}let c=a;a==="/"&&(c="/welcome.html"),(a==="/admin"||a==="/admin/")&&(c="/admin.html"),(a==="/platform"||a==="/platform/")&&(c="/platform.html"),a==="/platform/editor"&&(c="/platform-editor.html");let u=a.match(/^\/templates\/([a-z]+)\/?$/);u&&(o(j(u[1]),"\u0428\u0430\u0431\u043B\u043E\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",404),c="/storefront.html");let m=a.match(/^\/(demo|shop)\/([a-z0-9-]{1,80})\/?$/);if(m){let g=await dt(e,m[2]),w=g.status==="demo"?"demo":"shop";if(m[1]!==w)return Response.redirect(n.origin+"/"+w+"/"+g.slug,302);c="/storefront.html"}let y=new URL(t.url);y.pathname=c;let T=await e.ASSETS.fetch(new Request(y.toString(),{method:i,headers:t.headers})),f=new Response(T.body,T);return f.headers.set("X-Content-Type-Options","nosniff"),f.headers.set("Referrer-Policy","strict-origin-when-cross-origin"),(a==="/platform"||a==="/platform/"||a==="/platform.html")&&f.headers.set("Content-Security-Policy","frame-ancestors 'none'"),(a==="/platform/editor"||a==="/platform-editor.html")&&f.headers.set("Content-Security-Policy","frame-ancestors 'self'"),f}var Oa={async fetch(t,e,r){try{return await ye(t,e,r)}catch(n){return n instanceof N?b({error:n.message},n.status):(console.error(JSON.stringify({event:"request_failed",path:new URL(t.url).pathname})),b({error:"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435."},500))}},async scheduled(t,e,r){r.waitUntil((async()=>{(await d(e,"SELECT username FROM telegram_bot_setup WHERE id=1").first())?.username!==e.BOT_USERNAME&&(await Tt(e),await d(e,"INSERT INTO telegram_bot_setup(id,username,configured_at) VALUES(1,?,unixepoch()) ON CONFLICT(id) DO UPDATE SET username=excluded.username,configured_at=excluded.configured_at",e.BOT_USERNAME).run())})().catch(()=>console.error(JSON.stringify({event:"telegram_setup_retry",username:e.BOT_USERNAME})))),r.waitUntil(_t(e)),r.waitUntil(q(e)),await nt(e,A(e),void 0,2),await Rt(e),await d(e,"DELETE FROM owner_invites WHERE expires_at<unixepoch()-86400").run()}},ae=class extends he{async verifySignature(e,r){return mt(e,r,this.env.TRIBUTE_API_KEY)}async inspect(){return et(this.env)}async gatewayProbe(){let e=JSON.stringify({name:"integration_probe",payload:{}}),r=await crypto.subtle.importKey("raw",new TextEncoder().encode(this.env.TRIBUTE_API_KEY),{name:"HMAC",hash:"SHA-256"},!1,["sign"]),n=await crypto.subtle.sign("HMAC",r,new TextEncoder().encode(e)),a=Array.from(new Uint8Array(n),s=>s.toString(16).padStart(2,"0")).join(""),i=await this.env.LEELA_PAYMENTS.fetch(new Request("https://internal/tribute/webhook",{method:"POST",headers:{"Content-Type":"application/json","trbt-signature":a},body:e}));return{status:i.status,result:await i.json()}}async receiveEvent(e){o(typeof e=="string"&&new TextEncoder().encode(e).length<=64e3,"\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435");let r=E(JSON.parse(e)),n=p(r.name,100,!0);if(!["new_digital_product","digital_product_refunded"].includes(n))return{status:"ignored"};let a=await at(this.env,n,r.payload);return this.ctx.waitUntil(q(this.env)),a}};export{ae as CatalogTributeBridge,Oa as default};
