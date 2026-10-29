import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchProductionRomanian } from '../scripts/production-bot-romanian.js';
const fixture = `const preservedBefore=true;
var botLanguages = ["ru", "en", "es", "pt", "fr", "it", "tr", "pl", "ja", "de"];
var telegram_locales_default={};
var copy = {
  ...telegram_locales_default,
};
var telegram_commands_default = {};
var telegram_payments_default = {};
const names={de: "Deutsch"};
const lang="ro";
const welcome=t.welcome + (lang === "ru" ? "\\n\\nОткройте Delokay, добавьте Instagram и выберите оформление. Готовое демо можно редактировать до запуска." : "\\n\\nOpen Delokay, add your Instagram and choose a design. You can edit your demo before launch.");
async function paymentMenu(env, user, language) {
 const lang = detectLanguage(language);
 const ru = lang === "ru";
 await telegram(env,"sendMessage",{chat_id:user,text:ru?"RU": "Contact us on Telegram to launch your site or renew your subscription. We will discuss pricing and payment with you.",reply_markup:{inline_keyboard:[[{text:ru?"RU": "Contact Delokay",url:"https://t.me/Mirrorby"}],[{text:ru?"RU": "Open subscription",web_app:{url:"https://app.example"}}]]}});
}
async function flushPaymentNotifications(env) {}
async function setup(){await telegram(env, method, { language_code: language, [field]: value });}
const preservedAfter=true;`;
test('production patch adds Romanian menus, commands and payment copy while retaining unrelated code', async () => {
  const patched = patchProductionRomanian(
    fixture,
    { noStore: 'Demo manual', welcome: 'Bun venit' },
    [{ command: 'start', description: 'Meniu' }],
    { paid: 'Plătit' },
  );
  const sent = [];
  const run = new Function(
    'telegram',
    't',
    'detectLanguage',
    patched + ';return {copy,botLanguages,paymentMenu,preservedBefore,preservedAfter};',
  );
  const result = run(
    async (env, method, payload) => sent.push(payload),
    { welcome: 'Hello' },
    (code) => code,
  );
  assert.ok(result.botLanguages.includes('ro'));
  assert.equal(result.copy.ro.welcome, 'Bun venit');
  assert.ok(result.preservedBefore && result.preservedAfter);
  await result.paymentMenu({}, 123, 'ro');
  assert.match(sent[0].text, /Contactați/);
  assert.equal(sent[0].reply_markup.inline_keyboard[0][0].url, 'https://t.me/Mirrorby');
  assert.throws(() => patchProductionRomanian('unexpected bundle', {}, [], {}), /marker changed/);
});
