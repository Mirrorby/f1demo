import { stmt } from './catalog';
import { object, requireThat, text } from './validation';
const sensitive=/password|passwd|secret|token|session|cookie|authorization|platform.?key|wallet|private.?key/i;
export async function recordActivity(env:Env,owner:string,input:unknown,profile:Record<string,unknown>={}){
  const data=object(input);
  requireThat(Array.isArray(data.events)&&data.events.length<=20,'Слишком много событий');
  const count=await stmt(env,'SELECT COUNT(*) n FROM lead_events WHERE owner_id=? AND created_at>unixepoch()-3600',owner).first<{n:number}>();
  requireThat((count?.n||0)<3000,'Слишком много событий',429);
  await stmt(env,"INSERT INTO lead_profiles(owner_id,first_name,username,language) VALUES(?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET first_name=excluded.first_name,username=excluded.username,language=excluded.language,last_seen=unixepoch()",owner,text(profile.first_name,100),text(profile.username,100),text(profile.language_code,20)).run();
  const events=data.events.map(value=>{
    const e=object(value),event=text(e.event,40,true),screen=text(e.screen,40),target=text(e.target,120);
    requireThat(['screen','click','change','submit','error','demo_ready'].includes(event),'Неизвестное событие');
    const details=object(e.details||{}),clean:Record<string,string>={};
    if(!sensitive.test(target))for(const [key,value] of Object.entries(details).slice(0,10)){
      if(!sensitive.test(key)&&typeof value==='string')clean[key]=value.replace(/https?:\/\/[^\s]+/g,raw=>{try{const u=new URL(raw);u.search='';u.hash='';return u.href;}catch{return '';}}).slice(0,5000);
    }
    return stmt(env,'INSERT INTO lead_events(id,owner_id,event,screen,target,details) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',typeof e.id==='string'&&/^[a-f0-9-]{36}$/.test(e.id)?e.id:crypto.randomUUID(),owner,event,screen,sensitive.test(target)?'private-field':target,JSON.stringify(clean));
  });
  if(events.length)await env.DB.batch(events);
  return {ok:true};
}
export async function listLeads(env:Env){
  return (await stmt(env,"SELECT owner_id,COUNT(*) event_count,MIN(created_at) first_seen,MAX(created_at) last_seen,(SELECT first_name FROM lead_profiles p WHERE p.owner_id=e.owner_id) first_name,(SELECT username FROM lead_profiles p WHERE p.owner_id=e.owner_id) username,(SELECT COUNT(*) FROM stores s WHERE s.owner_id=e.owner_id) stores,(SELECT instagram FROM demo_build_jobs j WHERE j.owner_id=e.owner_id ORDER BY created_at DESC LIMIT 1) instagram FROM lead_events e GROUP BY owner_id ORDER BY last_seen DESC LIMIT 200").all()).results;
}
export async function leadPassport(env:Env,owner:string,offset=0){
  requireThat(/^[0-9]{1,20}$/.test(owner),'Некорректный ID');
  const events=(await stmt(env,'SELECT id,event,screen,target,details,created_at FROM lead_events WHERE owner_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100 OFFSET ?',owner,offset).all()).results;
  const demos=(await stmt(env,'SELECT instagram,template_id,status,period_days,created_at,import_error FROM demo_build_jobs WHERE owner_id=? ORDER BY created_at DESC',owner).all()).results;
  const stores=(await stmt(env,'SELECT id,name,slug,status FROM stores WHERE owner_id=?',owner).all()).results;
  const profile=await stmt(env,'SELECT first_name,username,language,last_seen FROM lead_profiles WHERE owner_id=?',owner).first();
  const expiredDemos=(await stmt(env,'SELECT template_id,period_days,outcome,products,created_at,expired_at FROM demo_statistics WHERE owner_id=? ORDER BY expired_at DESC',owner).all()).results;
  return {ownerId:owner,profile,events,demos,stores,expiredDemos,offset,nextOffset:events.length===100?offset+100:null};
}
