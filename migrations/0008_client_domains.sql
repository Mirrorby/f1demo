CREATE TABLE platform_domain_config (
  id INTEGER PRIMARY KEY CHECK(id=1),
  zone_id TEXT NOT NULL,
  cname_target TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE store_domains (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  hostname TEXT NOT NULL UNIQUE COLLATE NOCASE,
  verification_token TEXT NOT NULL,
  cloudflare_id TEXT UNIQUE,
  provision_started INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  hostname_status TEXT NOT NULL DEFAULT '',
  ssl_status TEXT NOT NULL DEFAULT '',
  validation_records TEXT NOT NULL DEFAULT '[]',
  error TEXT NOT NULL DEFAULT '',
  checked_at INTEGER,
  lease_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX store_domains_store ON store_domains(store_id);
