import { syncCollector, collectorEnabled } from './collector';
import { stmt, createStore } from './catalog';
import { findTemplate } from './templates';
import { currencyCode, siteLanguages, object, requireThat, text, HttpError } from './validation';
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
  languages: string;
  status: string;
  sample_content: number;
  lease_until: number;
  auto_build: number;
  period_days: number;
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
      `SELECT j.id,CASE WHEN j.auto_build=0 THEN '' ELSE j.instagram END instagram,j.template_id,j.store_id,j.status,j.sample_content,j.created_at,j.auto_build,j.period_days,j.import_error,j.progress,(SELECT expires_at FROM demo_retention WHERE job_id=j.id) expires_at,s.slug,r.url reference_url, (SELECT json_group_array(json_object('kind',t.kind,'status',t.status,'summary',json(t.summary))) FROM collector_tasks t WHERE t.job_id=j.id) collector_tasks FROM demo_build_jobs j LEFT JOIN stores s ON s.id=j.store_id LEFT JOIN site_references r ON r.id=j.reference_id WHERE j.owner_id=? ORDER BY j.created_at DESC LIMIT 3`,
      owner,
    ).all()
  ).results;
}
export async function createDemo(env: Env, owner: string, input: unknown, origin: string) {
  const data = object(input);
  const instagram = text(data.instagram, 500) ? instagramUsername(data.instagram) : '';
  if (instagram)
    requireThat(collectorEnabled(env), 'Сборщик временно недоступен. Попробуйте позже.', 503);
  const templateId = text(data.templateId, 30, true);
  requireThat(findTemplate(templateId), 'Выберите готовый шаблон');
  const reference = referenceUrl(data.referenceUrl);
  const periodDays = data.periodDays ?? 30;
  requireThat(
    typeof periodDays === 'number' && [7, 30, 90].includes(periodDays),
    'Выберите период: 7, 30 или 90 дней',
  );
  const language = text(data.language || 'ru', 5) as Language;
  requireThat(supportedLanguages.includes(language), 'Неподдерживаемый язык');
  const currency = currencyCode(data.currency || 'USD');
  const languages = siteLanguages(data.languages, language);
  if (!instagram)
    return createManualDemo(
      env,
      owner,
      data,
      { templateId, reference, language, languages, currency },
      origin,
    );
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
      job.template_id === templateId &&
        (ref?.url || '') === reference &&
        job.period_days === periodDays &&
        job.language === language &&
        job.currency === currency &&
        JSON.stringify(
          JSON.parse(job.languages || '[]').length ? JSON.parse(job.languages) : [job.language],
        ) === JSON.stringify(languages),
      'Демо этого аккаунта уже существует. Откройте его в списке магазинов.',
      409,
    );
    if (job.status === 'failed' && job.auto_build) {
      await env.DB.batch([
        stmt(env, 'DELETE FROM demo_retention WHERE job_id=?', job.id),
        stmt(
          env,
          "UPDATE demo_build_jobs SET status='preparing',import_error=NULL,lease_until=0 WHERE id=? AND status='failed'",
          job.id,
        ),
        stmt(
          env,
          "UPDATE collector_tasks SET attempt=attempt+1,remote_id=NULL,status='pending',checked_at=0,lease_until=0 WHERE job_id=? AND kind='instagram'",
          job.id,
        ),
      ]);
    }
    await syncCollector(env, owner, job.id);
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
          'INSERT INTO demo_build_jobs(id,owner_id,instagram,template_id,reference_id,store_id,language,currency,period_days,languages,lease_until,auto_build) VALUES(?,?,?,?,(SELECT id FROM site_references WHERE url=?),?,?,?,?,?,0,1)',
          id,
          owner,
          instagram,
          templateId,
          reference,
          storeId,
          language,
          currency,
          periodDays,
          JSON.stringify(languages),
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
  await syncCollector(env, owner, job.id);
  return { job: (await listDemoJobs(env, owner)).find((j) => j.id === job!.id) };
}

async function createManualDemo(
  env: Env,
  owner: string,
  data: Record<string, unknown>,
  cfg: {
    templateId: string;
    reference: string;
    language: Language;
    languages: Language[];
    currency: string;
  },
  origin: string,
) {
  const requestId = text(data.requestId || crypto.randomUUID(), 36, true);
  requireThat(/^[a-f0-9-]{36}$/.test(requestId), 'Некорректный идентификатор запроса');
  const handle = 'manual:' + requestId;
  const existing = await stmt(
    env,
    'SELECT id FROM demo_build_jobs WHERE owner_id=? AND instagram=?',
    owner,
    handle,
  ).first<{ id: string }>();
  if (existing) return { job: (await listDemoJobs(env, owner)).find((j) => j.id === existing.id) };
  const name = text(data.name, 200, true),
    description = text(data.description, 2000);
  const id = crypto.randomUUID(),
    storeId = crypto.randomUUID();
  try {
    await createStore(
      env,
      {
        name,
        templateId: cfg.templateId,
        seedProducts: true,
        settings: {
          language: cfg.language,
          languages: cfg.languages,
          currencies: [cfg.currency],
          ...(description ? { description } : {}),
          heroTitle: text(data.heroTitle, 200) || name,
          logo: text(data.logo, 1000),
          telegram: text(data.telegram, 64),
          whatsapp: text(data.whatsapp, 20),
        },
      },
      origin,
      storeId,
      [
        ...(cfg.reference
          ? [
              stmt(
                env,
                'INSERT INTO site_references(id,url) VALUES(?,?) ON CONFLICT(url) DO NOTHING',
                crypto.randomUUID(),
                cfg.reference,
              ),
            ]
          : []),
        stmt(
          env,
          `INSERT INTO demo_build_jobs(id,owner_id,instagram,template_id,reference_id,store_id,language,currency,status,sample_content,auto_build,progress) VALUES(?,?,?,?,(SELECT id FROM site_references WHERE url=?),?,?,?,'ready',1,0,100)`,
          id,
          owner,
          handle,
          cfg.templateId,
          cfg.reference,
          storeId,
          cfg.language,
          cfg.currency,
        ),
        stmt(env, 'UPDATE stores SET owner_id=?,orders_enabled=0 WHERE id=?', owner, storeId),
        stmt(env, 'INSERT INTO demo_retention(job_id,expires_at) VALUES(?,unixepoch()+604800)', id),
      ],
    );
  } catch (error) {
    const concurrent = await stmt(
      env,
      'SELECT id FROM demo_build_jobs WHERE owner_id=? AND instagram=?',
      owner,
      handle,
    ).first<{ id: string }>();
    if (concurrent)
      return { job: (await listDemoJobs(env, owner)).find((j) => j.id === concurrent.id) };
    if (String(error).includes('DEMO_LIMIT'))
      throw new HttpError(429, 'Доступно до трёх бесплатных демо на аккаунт');
    throw error;
  }
  return { job: (await listDemoJobs(env, owner)).find((j) => j.id === id) };
}
