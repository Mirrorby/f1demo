import {stmt} from './catalog';

// Payment/order/domain records take precedence over storage expiry.
const protectedStore = `EXISTS(SELECT 1 FROM stores s WHERE s.id=j.store_id AND s.status='active')
 OR EXISTS(SELECT 1 FROM tribute_digital_purchases WHERE owner_id=j.owner_id AND status='paid')
 OR EXISTS(SELECT 1 FROM orders WHERE store_id=j.store_id)
 OR EXISTS(SELECT 1 FROM platform_invoices WHERE store_id=j.store_id)
 OR EXISTS(SELECT 1 FROM store_domains WHERE store_id=j.store_id)
 OR EXISTS(SELECT 1 FROM owner_invites WHERE store_id=j.store_id AND used_at IS NULL AND expires_at>unixepoch())
 OR EXISTS(SELECT 1 FROM store_copy_jobs WHERE status='pending' AND (target_id=j.store_id OR files LIKE '%'||j.store_id||'/%'))`;

export async function cleanupUnusedDemos(env:Env) {
  // Old demos get a fresh grace period when this policy is first enabled.
  await stmt(env,`INSERT OR IGNORE INTO demo_retention(job_id,expires_at)
    SELECT id,unixepoch()+604800 FROM demo_build_jobs
    WHERE status IN ('ready','failed','awaiting_import') AND lease_until<unixepoch()`).run();
  const expired=await stmt(env,`SELECT j.id,j.store_id FROM demo_build_jobs j
    JOIN demo_retention r ON r.job_id=j.id WHERE r.expires_at<unixepoch()
    AND j.status IN ('ready','failed','awaiting_import') AND j.lease_until<unixepoch()
    AND NOT (${protectedStore}) LIMIT 1`).first<{id:string;store_id:string}>();
  if(!expired)return;
  try {
    await env.DB.batch([
      stmt(env,`INSERT INTO mutation_guards(ok) SELECT CASE WHEN EXISTS(
        SELECT 1 FROM demo_build_jobs j JOIN demo_retention r ON r.job_id=j.id
        WHERE j.id=? AND r.expires_at<unixepoch() AND j.lease_until<unixepoch()
        AND j.status IN ('ready','failed','awaiting_import') AND NOT (${protectedStore})
      ) THEN 1 ELSE 0 END`,expired.id),
      stmt(env,`INSERT OR IGNORE INTO demo_statistics(job_id,owner_id,template_id,reference_id,period_days,outcome,products,created_at)
        SELECT j.id,j.owner_id,j.template_id,j.reference_id,j.period_days,'expired_'||j.status,
        (SELECT COUNT(*) FROM products WHERE store_id=j.store_id AND deleted_at IS NULL),j.created_at
        FROM demo_build_jobs j WHERE j.id=?`,expired.id),
      stmt(env,'INSERT OR IGNORE INTO media_cleanup(store_id) VALUES(?)',expired.store_id),
      stmt(env,'DELETE FROM owner_invites WHERE store_id=?',expired.store_id),
      stmt(env,'DELETE FROM variants WHERE store_id=?',expired.store_id),
      stmt(env,'DELETE FROM products WHERE store_id=?',expired.store_id),
      stmt(env,'DELETE FROM collector_tasks WHERE job_id=?',expired.id),
      stmt(env,'DELETE FROM demo_retention WHERE job_id=?',expired.id),
      stmt(env,'DELETE FROM demo_build_jobs WHERE id=?',expired.id),
      stmt(env,'DELETE FROM stores WHERE id=?',expired.store_id),
      stmt(env,'DELETE FROM mutation_guards'),
    ]);
  } catch(error) {
    if(!String(error).includes('CHECK constraint'))throw error;
  }
}

export async function cleanupImportCheckpoints(env:Env) {
  const cursorRow=await stmt(env,"SELECT value FROM maintenance_state WHERE key='checkpoint_cursor'").first<{value:string}>();
  const page=await env.IMAGES.list({prefix:'_imports/',limit:50,...(cursorRow?.value?{cursor:cursorRow.value}:{})});
  for(const item of page.objects) {
    if(item.uploaded.getTime()>Date.now()-7*86400000)continue;
    const jobId=item.key.slice('_imports/'.length,'_imports/'.length+36);
    const busy=await stmt(env,"SELECT id FROM demo_build_jobs WHERE id=? AND status IN ('preparing','running')",jobId).first();
    if(!busy)await env.IMAGES.delete(item.key);
  }
  await stmt(env,"INSERT INTO maintenance_state(key,value) VALUES('checkpoint_cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",page.truncated?page.cursor:'').run();
}

export async function runRetention(env:Env) {
  const lease=await stmt(env,"INSERT INTO maintenance_state(key,value) VALUES('retention_next',CAST(unixepoch()+600 AS TEXT)) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(maintenance_state.value AS INTEGER)<unixepoch()").run();
  if(!lease.meta.changes)return;
  try {
    await cleanupUnusedDemos(env);
    await cleanupImportCheckpoints(env);
  } catch(error) {
    await stmt(env,"DELETE FROM maintenance_state WHERE key='retention_next'").run();
    throw error;
  }
}
