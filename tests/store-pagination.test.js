import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, db, platform } from './harness.js';
before(start);
after(stop);
test('platform listing reaches stores beyond the first 200', async () => {
  const inserted = Array.from({length:205}, (_, i) => ({id:crypto.randomUUID(), slug:'pagination-'+i}));
  await db.batch(inserted.map(s => db.prepare('INSERT INTO stores(id,slug,name,settings) VALUES(?,?,?,?)').bind(s.id,s.slug,s.slug,JSON.stringify({instagram:s.slug}))));
  const all=[];
  for(let offset=0;;offset+=200) {
    const page=await platform('stores?offset='+offset);
    assert.equal(page.status,200);
    all.push(...page.body);
    if(page.body.length<200)break;
  }
  assert.equal(new Set(all.map(s=>s.id)).size,all.length);
  assert.ok(inserted.every(s=>all.some(actual=>actual.id===s.id && actual.settings.instagram===s.slug)));
  assert.equal((await platform('stores?offset=-1')).status,400);
});
