import {stmt,storeMutationGuard} from './catalog';
import {telegram,notificationToken} from './telegram';
import {notificationLanguage} from './telegram-i18n';
import {int,object,requireThat,HttpError} from './validation';
import type {StoreRow} from './types';

interface Subscription {store_id:string;started_at:number;expires_at:number;reminder_sent_at:number|null}
export function monthFrom(seconds:number,months:number) {
  const d=new Date(seconds*1000),day=d.getUTCDate();
  d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,last));
  return Math.floor(d.getTime()/1000);
}
export async function subscriptionFor(env:Env,storeId:string) {
  const s=await stmt(env,'SELECT store_id,started_at,expires_at,reminder_sent_at FROM subscriptions WHERE store_id=?',storeId).first<Subscription>();
  return s ? {...s,status:s.expires_at>Math.floor(Date.now()/1000)?'active':'expired'} : null;
}
export async function manualSubscription(env:Env,s:StoreRow,input:unknown) {
  requireThat(s.owner_id,'Сначала подключите владельца',409);
  const d=object(input),months=int(d.months ?? 1,1,12);
  const existing=await subscriptionFor(env,s.id);
  const now=Math.floor(Date.now()/1000);
  const start=existing?.expires_at && existing.expires_at>now ? existing.expires_at : now;
  const expiry=monthFrom(start,months);
  try {
    await env.DB.batch([
      storeMutationGuard(env,s),
      stmt(env,"UPDATE stores SET status='active',orders_enabled=CASE WHEN status='demo' THEN 1 ELSE orders_enabled END,version=version+1 WHERE id=? AND version=? AND owner_id IS ?",s.id,s.version,s.owner_id),
      stmt(env,`INSERT INTO subscriptions(store_id,started_at,expires_at) VALUES(?,?,?)
        ON CONFLICT(store_id) DO UPDATE SET expires_at=excluded.expires_at,started_at=CASE WHEN subscriptions.expires_at>? THEN subscriptions.started_at ELSE excluded.started_at END,
        reminder_sent_at=NULL,reminder_attempts=0,reminder_next_at=0,reminder_lease_until=0,updated_at=unixepoch()`,s.id,now,expiry,now),
      stmt(env,'DELETE FROM mutation_guards'),
    ]);
  } catch(e) {
    if(String(e).includes('CHECK constraint'))throw new HttpError(409,'Магазин изменился. Обновите страницу.');
    throw e;
  }
  return {subscription:await subscriptionFor(env,s.id),notificationsAvailable:!!notificationToken(env)};
}
export async function sendSubscriptionReminders(env:Env) {
  if(!notificationToken(env))return;
  const pending=await stmt(env,`SELECT b.store_id,b.expires_at,s.owner_id,s.name FROM subscriptions b JOIN stores s ON s.id=b.store_id
    WHERE s.status='active' AND s.owner_id IS NOT NULL AND b.expires_at>unixepoch() AND b.expires_at<=unixepoch()+259200
    AND b.reminder_sent_at IS NULL AND b.reminder_next_at<=unixepoch() AND b.reminder_lease_until<unixepoch()
    ORDER BY b.expires_at LIMIT 5`).all<{store_id:string;expires_at:number;owner_id:string;name:string}>();
  for(const s of pending.results) {
    const lease=await stmt(env,`UPDATE subscriptions SET reminder_lease_until=unixepoch()+60
      WHERE store_id=? AND expires_at=? AND reminder_sent_at IS NULL AND reminder_lease_until<unixepoch() RETURNING reminder_attempts`,s.store_id,s.expires_at).first<{reminder_attempts:number}>();
    if(!lease)continue;
    try {
      const current=await stmt(env,'SELECT expires_at FROM subscriptions WHERE store_id=?',s.store_id).first<{expires_at:number}>();
      if(current?.expires_at!==s.expires_at)continue;
      const language=await notificationLanguage(env,s.owner_id);
      const date=new Intl.DateTimeFormat(language==='ru'?'ru-RU':'en-GB',{dateStyle:'long',timeZone:'UTC'}).format(new Date(s.expires_at*1000));
      const message=language==='ru'
        ? `Напоминание Delokay: срок подписки магазина «${s.name}» заканчивается ${date}. Для продления свяжитесь с Delokay.`
        : `Delokay reminder: the subscription for “${s.name}” expires on ${date}. Contact Delokay to renew.`;
      await telegram(env,'sendMessage',{chat_id:s.owner_id,text:message});
      await stmt(env,'UPDATE subscriptions SET reminder_sent_at=unixepoch(),reminder_lease_until=0 WHERE store_id=? AND expires_at=?',s.store_id,s.expires_at).run();
    } catch {
      const delay=Math.min(86400,60*2**Math.min(lease.reminder_attempts,10));
      await stmt(env,'UPDATE subscriptions SET reminder_attempts=reminder_attempts+1,reminder_next_at=unixepoch()+?,reminder_lease_until=0 WHERE store_id=? AND expires_at=?',delay,s.store_id,s.expires_at).run();
      console.warn(JSON.stringify({event:'subscription_reminder_retry',storeId:s.store_id}));
    }
  }
}
