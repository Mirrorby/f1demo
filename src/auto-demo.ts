import { createStore, stmt } from './catalog';
import { archivePhoto, remote, type ImportJob, syncCollector } from './collector';
import { digest } from './auth';
import { object, requireThat, text, HttpError } from './validation';

interface Checkpoint {
  name:string; settings:Record<string,unknown>; products:Record<string,unknown>[];
  images:{url:string;product:number}[]; cursor:number;
}
export async function advanceAutoDemo(env:Env, job:ImportJob) {
  const task=await stmt(env,"SELECT remote_id,status FROM collector_tasks WHERE job_id=? AND kind='instagram'",job.id).first<{remote_id:string;status:string}>();
  if (!task) return;
  if (['restricted','failed','interrupted'].includes(task.status)) {
    await stmt(env,"UPDATE demo_build_jobs SET status='failed',import_error=?,lease_until=0 WHERE id=? AND sample_content=1",task.status==='restricted'?'Instagram ограничил доступ. Демо пока не создано.':'Не удалось полностью собрать данные за период. Повторите создание.',job.id).run();
    return;
  }
  if (!['ready','needs_review'].includes(task.status)) return;
  const lease=await stmt(env,"UPDATE demo_build_jobs SET lease_until=unixepoch()+120 WHERE id=? AND auto_build=1 AND sample_content=1 AND status<>'failed' AND lease_until<unixepoch()",job.id).run();
  if (!lease.meta.changes) return;
  const key='_imports/'+job.id+'.json';
  try {
    const saved=await env.IMAGES.get(key);
    let state:Checkpoint;
    if (saved) state=await saved.json<Checkpoint>();
    else {
      const bundle=await remote(env,'/v1/jobs/'+task.remote_id+'/bundle');
      const source=object(bundle.source), store=object(bundle.store);
      requireThat(bundle.username===job.instagram && object(source.period).complete===true,'Сбор периода не завершён',409);
      const name=text(store.name,200,true);
      requireThat(Array.isArray(store.products) && store.products.length<=500 && Array.isArray(source.photo_posts),'Некорректные данные магазина',502);
      requireThat(store.products.length>0,'За последние 30 дней не найдены фотопубликации для каталога.',409);
      const posts=source.photo_posts.map(object).filter(p=>p.date && Array.isArray(p.assets) && p.assets.length);
      requireThat(posts.length===store.products.length,'Неполные данные товаров',502);
      const cfg={...object(store.settings),theme:job.template_id,language:job.language,currencies:[job.currency],instagram:job.instagram,logo:''};
      state={name,settings:cfg,products:store.products.map(p=>({...object(p),photos:[]})),images:[],cursor:0};
      if(source.logo_url) state.images.push({url:text(source.logo_url,3000,true),product:-1});
      posts.forEach((p,i)=>{
        requireThat(Array.isArray(p.images) && p.images.length,'Нет фотографий товара',502);
        for(const url of p.images.slice(0,8)) state.images.push({url:text(url,3000,true),product:i});
      });
    }
    // Small resumable batches keep large monthly imports within Worker invocation limits.
    const stop=Math.min(state.cursor+16,state.images.length);
    while(state.cursor<stop) {
      const offset=state.cursor;
      const group=state.images.slice(offset,Math.min(offset+4,stop));
      const results=await Promise.allSettled(group.map(async(image,i)=>({
        image,
        url:await archivePhoto(env,image.url,job.store_id,[],await digest(task.remote_id+'-'+(offset+i))),
      })));
      for(const result of results) {
        if(result.status==='rejected')throw result.reason;
        const {image,url}=result.value;
        if(image.product<0)state.settings.logo=url;
        else (state.products[image.product].photos as string[]).push(url);
      }
      state.cursor+=group.length;
    }
    await env.IMAGES.put(key,JSON.stringify(state));
    if(state.cursor<state.images.length) {
      await stmt(env,"UPDATE demo_build_jobs SET status='running',progress=?,lease_until=0,updated_at=unixepoch() WHERE id=?",Math.floor(20+75*state.cursor/state.images.length),job.id).run();
      return;
    }
    requireThat(JSON.stringify(state.products).length<1_500_000,'Каталог слишком большой для автоматической сборки',413);
    await createStore(env,{name:state.name,templateId:job.template_id,settings:state.settings,products:state.products},env.PUBLIC_ORIGIN,job.store_id,[
      stmt(env,'UPDATE stores SET owner_id=?,orders_enabled=0 WHERE id=?',job.owner_id,job.store_id),
      stmt(env,"UPDATE demo_build_jobs SET sample_content=0,status='ready',progress=100,import_error=NULL,lease_until=0,updated_at=unixepoch() WHERE id=?",job.id),
    ]);
    await env.IMAGES.delete(key);
  } catch (error) {
    // Keep the private checkpoint and already copied photos; never expose a half-filled store.
    await stmt(env,"UPDATE demo_build_jobs SET status='failed',import_error=?,lease_until=0,updated_at=unixepoch() WHERE id=? AND sample_content=1",error instanceof HttpError ? error.message.slice(0,200) : 'Не удалось завершить демо. Повторите создание.',job.id).run();
  }
}
export async function processAutoDemos(env:Env) {
  const pending=await stmt(env,"SELECT id,owner_id FROM demo_build_jobs WHERE auto_build=1 AND ((sample_content=1 AND status IN ('preparing','running','awaiting_import')) OR EXISTS(SELECT 1 FROM collector_tasks t WHERE t.job_id=demo_build_jobs.id AND t.kind='website' AND t.status IN ('pending','queued','running'))) AND lease_until<unixepoch() ORDER BY updated_at LIMIT 1").all<{id:string;owner_id:string}>();
  for(const job of pending.results) await syncCollector(env,job.owner_id,job.id);
}
