#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export function rollbackArgs(release) {
  if (release.worker !== 'catalog-factory' || !/^[a-f0-9-]{36}$/.test(release.versionId))
    throw new Error('Invalid production release record');
  return [
    'node_modules/wrangler/bin/wrangler.js',
    'rollback',
    release.versionId,
    '--name',
    release.worker,
    '--yes',
    '--message',
    'Restore ' + release.label,
  ];
}
async function run() {
  const command = process.argv[2] || 'list';
  if (!['list', 'rollback', 'backup'].includes(command))
    throw new Error('Use list, rollback or backup');
  const label = process.argv[3] || 'production-baseline-2026-10-22';
  if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid release label');
  if (command === 'list') {
    for (const file of (await readdir('releases')).filter((f) => f.endsWith('.json')).sort()) {
      const r = JSON.parse(await readFile('releases/' + file, 'utf8'));
      console.log(`${r.label}: ${r.worker}, Cloudflare version ${r.versionId}`);
    }
    return;
  }
  const release = JSON.parse(await readFile(`releases/${label}.json`, 'utf8'));
  const args =
    command === 'rollback'
      ? rollbackArgs(release)
      : [
          'node_modules/wrangler/bin/wrangler.js',
          'd1',
          'export',
          release.databaseId,
          '--remote',
          '--output',
          `.backups/production-${Date.now()}.sql`,
        ];
  if (command === 'backup') {
    const { mkdir } = await import('node:fs/promises');
    await mkdir('.backups', { recursive: true, mode: 0o700 });
  }
  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: release.accountId },
  });
  if (result.error || result.status !== 0)
    throw new Error('Cloudflare action failed; check authorization and output above');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  run().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
