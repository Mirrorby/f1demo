// Apply only to the pinned live bundle. Fail closed if the original markers differ.
export function patchProductionBot(bundle, supportUrl = 'https://t.me/Mirrorby') {
  if (supportUrl !== 'https://t.me/Mirrorby') throw new Error('Unexpected support contact');
  const start = 'async function paymentMenu(env, user, language) {';
  const next = '\nasync function flushPaymentNotifications(env) {';
  const at = bundle.indexOf(start), end = bundle.indexOf(next, at);
  if (at < 0 || end < 0 || bundle.indexOf(start, at + start.length) !== -1 ||
      !bundle.slice(at, end).includes('await digitalMenu(env, user, language)')) {
    throw new Error('Production payment menu does not match the expected version');
  }
  const welcome = 't.welcome + t.noStore + "\\n\\n" + t.telegramId + user';
  if (bundle.split(welcome).length !== 2) throw new Error('Production welcome does not match the expected version');
  const manual = `async function paymentMenu(env, user, language) {
  const lang = detectLanguage(language);
  const ru = lang === "ru";
  await telegram(env, "sendMessage", {
    chat_id: user,
    text: ru ? "Для запуска сайта или продления подписки напишите нам в Telegram. Стоимость и способ оплаты обсудим лично." : "Contact us on Telegram to launch your site or renew your subscription. We will discuss pricing and payment with you.",
    reply_markup: { inline_keyboard: [
      [{ text: ru ? "Написать в Delokay" : "Contact Delokay", url: ${JSON.stringify(supportUrl)} }],
      [{ text: ru ? "Открыть подписку" : "Open subscription", web_app: { url: origin(env) + "/admin?tab=payments&lang=" + lang } }]
    ] }
  });
}`;
  const noStore = 't.welcome + (lang === "ru" ? "\\n\\nОткройте Delokay, добавьте Instagram и выберите оформление. Готовое демо можно редактировать до запуска." : "\\n\\nOpen Delokay, add your Instagram and choose a design. You can edit your demo before launch.") + "\\n\\n" + t.telegramId + user';
  return bundle.slice(0, at) + manual + bundle.slice(end).replace(welcome, noStore);
}
