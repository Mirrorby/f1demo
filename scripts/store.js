#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
const [command, ...args] = process.argv.slice(2);
const origin = process.env.STORE_API_ORIGIN || 'http://localhost:8787';
const key = process.env.PLATFORM_API_KEY;
if (!key || key.length < 32) {
  console.error('Set PLATFORM_API_KEY in your environment (at least 32 characters).');
  process.exit(1);
}
async function request(path, method = 'GET', data) {
  const r = await fetch(origin + '/api/platform/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + key,
      ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || 'Request failed');
  return result;
}
try {
  let result;
  if (command === 'create' && args[0]) {
    const input = JSON.parse(await readFile(args[0], 'utf8'));
    // Import an export into a NEW demo; never import the owner, orders or old object IDs.
    if (input.schemaVersion === 1) {
      delete input.id;
      delete input.version;
      input.status = 'demo';
      for (const p of input.products) {
        delete p.id;
        delete p.version;
        for (const v of p.variants) delete v.id;
      }
    }
    result = await request('stores', 'POST', input);
  } else if (command === 'invite' && args.length === 2)
    result = await request(`stores/${args[0]}/invite`, 'POST', { telegramUserId: args[1] });
  else if (command === 'activate' && args.length === 1)
    result = await request(`stores/${args[0]}/activate`, 'POST', {});
  else if (command === 'export' && args.length === 2) {
    result = await request(`stores/${args[0]}/export`);
    await writeFile(args[1], JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    console.log('Export written to ' + args[1]);
    process.exit(0);
  } else
    throw new Error(
      'Usage: npm run store -- create file.json | invite STORE_ID TELEGRAM_ID | activate STORE_ID | export STORE_ID output.json',
    );
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
