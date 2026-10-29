// Patch the pinned production bundle without replacing storefronts, assets or bindings.
export function patchProductionRomanian(bundle, locale, commands, payments) {
  const replaceOnce = (source, needle, replacement) => {
    if (source.split(needle).length !== 2)
      throw new Error('Production marker changed: ' + needle.slice(0, 60));
    return source.replace(needle, replacement);
  };
  let out = replaceOnce(
    bundle,
    'var botLanguages = ["ru", "en", "es", "pt", "fr", "it", "tr", "pl", "ja", "de"];',
    'var botLanguages = ["ru", "en", "es", "pt", "fr", "it", "tr", "pl", "ja", "de", "ro"];',
  );
  out = replaceOnce(
    out,
    'var copy = {\n  ...telegram_locales_default,',
    'var copy = {\n  ...telegram_locales_default,\n  ro: ' + JSON.stringify(locale) + ',',
  );
  out = replaceOnce(
    out,
    'var telegram_commands_default = {',
    'var telegram_commands_default = {\n  ro: ' + JSON.stringify(commands) + ',',
  );
  out = replaceOnce(
    out,
    'var telegram_payments_default = {',
    'var telegram_payments_default = {\n  ro: ' + JSON.stringify(payments) + ',',
  );
  out = replaceOnce(out, 'de: "Deutsch"', 'de: "Deutsch", ro: "Română"');
  const welcome =
    't.welcome + (lang === "ru" ? "\\n\\nОткройте Delokay, добавьте Instagram и выберите оформление. Готовое демо можно редактировать до запуска." : "\\n\\nOpen Delokay, add your Instagram and choose a design. You can edit your demo before launch.")';
  out = replaceOnce(
    out,
    welcome,
    't.welcome + (lang === "ro" ? ' +
      JSON.stringify(locale.noStore) +
      ' : lang === "ru" ? "\\n\\nОткройте Delokay, выберите оформление и заполните данные вручную или через Instagram. Тестовое демо можно редактировать до запуска." : "\\n\\nOpen Delokay, choose a design, and enter your details manually or import from Instagram. Edit your test demo before launch.")',
  );
  const start = 'async function paymentMenu(env, user, language) {';
  const a = out.indexOf(start),
    b = out.indexOf('\nasync function flushPaymentNotifications(env) {', a);
  if (a < 0 || b < 0 || out.indexOf(start, a + start.length) !== -1)
    throw new Error('Unexpected payment menu');
  let menu = out.slice(a, b);
  menu = replaceOnce(
    menu,
    'const ru = lang === "ru";',
    'const ru = lang === "ru";\n  const ro = lang === "ro";',
  );
  menu = replaceOnce(
    menu,
    ': "Contact us on Telegram to launch your site or renew your subscription. We will discuss pricing and payment with you."',
    ': ro ? "Contactați-ne pe Telegram pentru lansarea site-ului sau prelungirea abonamentului. Discutăm personal prețul și metoda de plată." : "Contact us on Telegram to launch your site or renew your subscription. We will discuss pricing and payment with you."',
  );
  menu = replaceOnce(
    menu,
    ': "Contact Delokay"',
    ': ro ? "Contactează Delokay" : "Contact Delokay"',
  );
  menu = replaceOnce(
    menu,
    ': "Open subscription"',
    ': ro ? "Deschide abonamentul" : "Open subscription"',
  );
  out = out.slice(0, a) + menu + out.slice(b);
  // Localize descriptions for every language; short descriptions use core locales
  // so setup remains under the per-invocation request budget.
  out = replaceOnce(
    out,
    'await telegram(env, method, { language_code: language, [field]: value });',
    'if (method === "setMyDescription" || ["", "ru", "en", "ro"].includes(language)) await telegram(env, method, { language_code: language, [field]: value });',
  );
  return out;
}
