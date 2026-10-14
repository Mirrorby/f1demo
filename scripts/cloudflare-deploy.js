#!/usr/bin/env node
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parse } from 'jsonc-parser';

export function deploymentConfig(source, values) {
  const config = parse(source);
  const accountId = values.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId))
    throw new Error('Set CLOUDFLARE_ACCOUNT_ID in Cloudflare Build variables.');
  config.account_id = accountId;
  const databaseId = values.DATABASE_ID?.trim();
  if (!databaseId || !/^[a-f0-9-]{36}$/i.test(databaseId) || /^0{8}-/.test(databaseId))
    throw new Error('Set DATABASE_ID in Cloudflare Build variables to the D1 database UUID.');
  const bot = values.BOT_USERNAME?.trim().replace(/^@/, '');
  if (!bot || !/^[a-z0-9_]{5,32}$/i.test(bot))
    throw new Error('Set BOT_USERNAME in Build variables.');
  let origin;
  try {
    origin = new URL(values.PUBLIC_ORIGIN);
  } catch {
    throw new Error('Set PUBLIC_ORIGIN to the HTTPS Worker URL.');
  }
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('PUBLIC_ORIGIN must be an HTTPS origin, without a path or credentials.');
  const tributeShop = values.TRIBUTE_SHOP_ID?.trim();
  if (!tributeShop || !/^[1-9]\d{0,15}$/.test(tributeShop) || !Number.isSafeInteger(Number(tributeShop)))
    throw new Error('Set TRIBUTE_SHOP_ID to the active Tribute Shop ID in Build variables.');
  config.vars = { ...config.vars, BOT_USERNAME: bot, PUBLIC_ORIGIN: origin.origin, TRIBUTE_SHOP_ID: tributeShop };
  config.d1_databases[0].database_id = databaseId;
  const secrets = {};
  for (const key of config.secrets.required) {
    const value = values[key];
    if (!value || value.includes('\n') || value.includes('\r'))
      throw new Error(`Set ${key} in Cloudflare Build secrets.`);
    secrets[key] = value;
  }
  if (secrets.PLATFORM_API_KEY.length < 32)
    throw new Error('PLATFORM_API_KEY must be at least 32 characters.');
  if (!/^[a-z0-9_-]{32,256}$/i.test(secrets.TELEGRAM_WEBHOOK_SECRET))
    throw new Error('TELEGRAM_WEBHOOK_SECRET: use 32–256 letters, digits, underscores or hyphens.');
  return { config, secrets };
}
async function deploy() {
  const { config, secrets } = deploymentConfig(
    await readFile('wrangler.jsonc', 'utf8'),
    process.env,
  );
  const configPath = '.cloudflare-deploy.jsonc',
    secretsPath = '.cloudflare-deploy-secrets.json';
  try {
    await writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    await writeFile(secretsPath, JSON.stringify(secrets), { mode: 0o600 });
    const runner = (args) => {
      const result = spawnSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['wrangler', ...args, '--config', configPath],
        { stdio: 'inherit' },
      );
      if (result.error || result.status !== 0)
        throw new Error('Cloudflare command failed. See the build log above.');
    };
    runner(['d1', 'migrations', 'apply', 'catalog-factory', '--remote']);
    runner(['deploy', '--secrets-file', secretsPath]);
  } finally {
    await Promise.all([unlink(configPath).catch(() => {}), unlink(secretsPath).catch(() => {})]);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await deploy();
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
