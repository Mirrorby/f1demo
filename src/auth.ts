import { HttpError, requireThat } from './validation';
const enc = new TextEncoder();
export async function digest(s: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}
function hex(b: ArrayBuffer): string {
  return Array.from(new Uint8Array(b), (v) => v.toString(16).padStart(2, '0')).join('');
}
async function hmac(key: Uint8Array, message: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return crypto.subtle.sign('HMAC', k, enc.encode(message));
}
export async function equalSecret(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
export async function platformAuth(request: Request, env: Env) {
  requireThat(
    env.PLATFORM_API_KEY && env.PLATFORM_API_KEY.length >= 32,
    'Ключ платформы не настроен',
    503,
  );
  requireThat(
    await equalSecret(request.headers.get('authorization') ?? '', `Bearer ${env.PLATFORM_API_KEY}`),
    'Нет доступа',
    401,
  );
}
export async function telegramAuth(request: Request, env: Env): Promise<string> {
  if (env.DEPLOYMENT_ENV === 'staging') {
    requireThat(
      env.AUTH_VERIFIER && env.AUTH_VERIFIER_ORIGIN,
      'Проверка Telegram не настроена',
      503,
    );
    const checked = await env.AUTH_VERIFIER.fetch(
      new Request(new URL('/api/admin/preferences', env.AUTH_VERIFIER_ORIGIN), {
        headers: { Authorization: request.headers.get('authorization') || '' },
        signal: AbortSignal.timeout(8000),
      }),
    );
    await checked.body?.cancel();
    requireThat(
      checked.status === 200,
      'Откройте панель заново через Telegram',
      checked.status === 401 ? 401 : 503,
    );
    // The production verifier validates the exact signed payload, its age and user ID.
    const params = new URLSearchParams((request.headers.get('authorization') || '').slice(4));
    const user = JSON.parse(params.get('user') || '{}');
    requireThat(
      Number.isSafeInteger(user.id) && user.id > 0 && !user.is_bot,
      'Нет пользователя',
      401,
    );
    return String(user.id);
  }

  requireThat(env.TELEGRAM_BOT_TOKEN, 'Telegram не настроен', 503);
  const raw = request.headers.get('authorization') ?? '';
  requireThat(raw.startsWith('tma ') && raw.length <= 16000, 'Откройте панель через Telegram', 401);
  const params = new URLSearchParams(raw.slice(4));
  const seen = new Set<string>();
  for (const k of params.keys()) {
    requireThat(!seen.has(k), 'Повторяющийся параметр авторизации', 401);
    seen.add(k);
  }
  const hash = params.get('hash') ?? '';
  requireThat(/^[a-f0-9]{64}$/.test(hash), 'Недопустимая подпись', 401);
  params.delete('hash');
  const check = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = await hmac(enc.encode('WebAppData'), env.TELEGRAM_BOT_TOKEN);
  requireThat(
    await equalSecret(hex(await hmac(new Uint8Array(secret), check)), hash),
    'Недопустимая подпись',
    401,
  );
  const date = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  requireThat(
    Number.isSafeInteger(date) && date > 0 && date <= now + 30 && now - date <= 3600,
    'Откройте панель заново: сессия истекла',
    401,
  );
  try {
    const user = JSON.parse(params.get('user') ?? '{}');
    requireThat(
      Number.isSafeInteger(user.id) && user.id > 0 && !user.is_bot,
      'Нет пользователя',
      401,
    );
    return String(user.id);
  } catch {
    throw new HttpError(401, 'Некорректные данные пользователя');
  }
}
