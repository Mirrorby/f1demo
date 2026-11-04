import { WorkerEntrypoint } from 'cloudflare:workers';
import { equalSecret } from './auth';
// This entrypoint is reachable only through the existing worker's service binding.
// It preserves its developer key and collector token without exposing either secret.
export class LegacyDeveloperServices extends WorkerEntrypoint<Env> {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (
      url.hostname === 'legacy.internal' &&
      ['/__developer-auth', '/__collector-auth'].includes(url.pathname)
    ) {
      const key =
        url.pathname === '/__collector-auth'
          ? this.env.IMPORT_API_TOKEN
          : this.env.PLATFORM_API_KEY;
      const valid =
        !!key &&
        key.length >= 16 &&
        (await equalSecret(request.headers.get('authorization') || '', `Bearer ${key}`));
      return new Response(null, { status: valid ? 204 : 401 });
    }
    if (!this.env.IMPORT_API_ORIGIN || !this.env.IMPORT_API_TOKEN)
      return new Response('Collector not configured', { status: 503 });
    const origin = new URL(this.env.IMPORT_API_ORIGIN);
    if (
      url.origin !== origin.origin ||
      !url.pathname.startsWith('/v1/') ||
      !['GET', 'POST'].includes(request.method)
    )
      return new Response('Not found', { status: 404 });
    const headers = new Headers(request.headers);
    headers.set('Authorization', 'Bearer ' + this.env.IMPORT_API_TOKEN);
    return fetch(new Request(request, { headers, redirect: 'manual' }));
  }
}
