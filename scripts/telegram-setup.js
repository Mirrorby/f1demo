#!/usr/bin/env node
// Reads secrets from environment. Never prints a token or embeds it in arguments.
import botCommands from '../src/telegram-commands.json' with { type: 'json' };
const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, PUBLIC_ORIGIN } = process.env;
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !PUBLIC_ORIGIN?.startsWith('https://')) {
  console.error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and HTTPS PUBLIC_ORIGIN.');
  process.exit(1);
}
async function call(method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await r.json();
  if (!r.ok || !result.ok) throw new Error('Telegram setup failed: ' + method);
}
try {
  await call('setWebhook', {
    url: new URL('/api/telegram/webhook', PUBLIC_ORIGIN).toString(),
    secret_token: TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'callback_query'],
  });
  for (const type of ['default', 'all_private_chats'])
    for (const language of ['', 'ru', 'en'])
      await call('setMyCommands', {
        scope: { type },
        language_code: language,
        commands: language === 'ru' ? botCommands.ru : botCommands.en,
      });
  await call('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Мой магазин',
      web_app: { url: new URL('/admin', PUBLIC_ORIGIN).toString() },
    },
  });
  console.log('Webhook, commands and menu button configured.');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
