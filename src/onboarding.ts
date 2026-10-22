import { createStore, stmt } from './catalog';
import { findTemplate } from './templates';
import { currencies, object, requireThat, text, HttpError } from './validation';
import { supportedLanguages, type Language } from './language';
interface Job {
  id: string;
  owner_id: string;
  instagram: string;
  template_id: string;
  reference_id: string | null;
  store_id: string;
  language: Language;
  currency: string;
  status: string;
  sample_content: number;
  lease_until: number;
}
export function instagramUsername(input: unknown) {
  let value = text(input, 500, true);
  if (/^(https?:\/\/|www\.|instagram\.com\/)/i.test(value)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value);
    } catch {
      throw new HttpError(400, 'Укажите ссылку на профиль Instagram');
    }
    requireThat(
      ['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase()) &&
        !url.username &&
        !url.password &&
        !url.port,
      'Укажите ссылку на профиль Instagram',
    );
    requireThat(
      /^\/[a-z0-9_.]+\/?$/i.test(url.pathname),
      'Нужна ссылка на профиль, а не публикацию',
    );
    value = url.pathname.replace(/^\/|\/$/g, '');
  }
  value = value.replace(/^@/, '').toLowerCase();
  requireThat(
    /^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(value) &&
      !value.includes('..') &&
      !['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct'].includes(value),
    'Укажите корректный Instagram username',
  );
  return value;
}
function referenceUrl(input: unknown) {
  const raw = text(input, 2000);
  if (!raw) return '';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, 'Укажите HTTPS-ссылку на сайт');
  }
  requireThat(
    url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname.includes('.') &&
      !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
        url.hostname,
      ) &&
      !/\.(local|localhost|internal)$/.test(url.hostname),
    'Укажите публичный сайт с HTTPS',
  );
  url.hash = '';
  url.search = '';
  return url.href;
}
export async function listDemoJobs(env: Env, owner: string) {
  return (
    await stmt(
      env,
      'SELECT j.id,j.instagram,j.template_id,j.store_id,j.status,j.sample_content,j.created_at,s.slug,r.url reference_url FROM demo_build_jobs j LEFT JOIN stores s ON s.id=j.store_id LEFT JOIN site_references r ON r.id=j.reference_id WHERE j.owner_id=? ORDER BY j.created_at DESC LIMIT 3',
      owner,
    ).all()
  ).results;
}
export async function createDemo(env: Env, owner: string, input: unknown, origin: string) {
  const data = object(input);
  const instagram = instagramUsername(data.instagram);
  const templateId = text(data.templateId, 30, true);
  requireThat(findTemplate(templateId), 'Выберите готовый шаблон');
  const reference = referenceUrl(data.referenceUrl);
  const language = text(data.language || 'ru', 5) as Language;
  requireThat(supportedLanguages.includes(language), 'Неподдерживаемый язык');
  const currency = text(data.currency || 'BYN', 3);
  requireThat(currencies.includes(currency), 'Неподдерживаемая валюта');
  let job = await stmt(
    env,
    'SELECT * FROM demo_build_jobs WHERE owner_id=? AND instagram=?',
    owner,
    instagram,
  ).first<Job>();
  if (job) {
    const ref = job.reference_id
      ? await stmt(env, 'SELECT url FROM site_references WHERE id=?', job.reference_id).first<{
          url: string;
        }>()
      : null;
    requireThat(
      job.template_id === templateId && (ref?.url || '') === reference,
      'Демо этого аккаунта уже существует. Откройте его в списке магазинов.',
      409,
    );
    if (
      job.status !== 'failed' &&
      !(job.status === 'preparing' && job.lease_until < Date.now() / 1000)
    )
      return { job: (await listDemoJobs(env, owner)).find((j) => j.id === job!.id) };
    const lease = await stmt(
      env,
      "UPDATE demo_build_jobs SET status='preparing',lease_until=unixepoch()+120 WHERE id=? AND (status='failed' OR (status='preparing' AND lease_until<unixepoch()))",
      job.id,
    ).run();
    if (!lease.meta.changes)
      return { job: (await listDemoJobs(env, owner)).find((j) => j.id === job!.id) };
  } else {
    const id = crypto.randomUUID(),
      storeId = crypto.randomUUID(),
      refId = crypto.randomUUID();
    try {
      await env.DB.batch([
        ...(reference
          ? [
              stmt(
                env,
                'INSERT INTO site_references(id,url) VALUES(?,?) ON CONFLICT(url) DO NOTHING',
                refId,
                reference,
              ),
            ]
          : []),
        stmt(
          env,
          'INSERT INTO demo_build_jobs(id,owner_id,instagram,template_id,reference_id,store_id,language,currency,lease_until) VALUES(?,?,?,?,(SELECT id FROM site_references WHERE url=?),?,?,?,unixepoch()+120)',
          id,
          owner,
          instagram,
          templateId,
          reference,
          storeId,
          language,
          currency,
        ),
      ]);
    } catch (error) {
      const existing = await stmt(
        env,
        'SELECT id FROM demo_build_jobs WHERE owner_id=? AND instagram=?',
        owner,
        instagram,
      ).first();
      if (existing)
        return { job: (await listDemoJobs(env, owner)).find((j) => j.id === existing.id) };
      if (String(error).includes('DEMO_LIMIT'))
        throw new HttpError(429, 'Доступно до трёх бесплатных демо на аккаунт');
      throw error;
    }
    job = (await stmt(env, 'SELECT * FROM demo_build_jobs WHERE id=?', id).first<Job>())!;
  }
  try {
    await createStore(
      env,
      {
        name: '@' + job.instagram,
        templateId: job.template_id,
        seedProducts: true,
        settings: { instagram: job.instagram, language: job.language, currencies: [job.currency] },
      },
      origin,
      job.store_id,
      [
        stmt(env, 'UPDATE stores SET owner_id=?,orders_enabled=0 WHERE id=?', owner, job.store_id),
        stmt(
          env,
          "UPDATE demo_build_jobs SET status='awaiting_import',lease_until=0,updated_at=unixepoch() WHERE id=?",
          job.id,
        ),
      ],
    );
  } catch (error) {
    await stmt(
      env,
      "UPDATE demo_build_jobs SET status='failed',lease_until=0,updated_at=unixepoch() WHERE id=? AND status='preparing'",
      job.id,
    ).run();
    throw error;
  }
  return { job: (await listDemoJobs(env, owner)).find((j) => j.id === job!.id) };
}
