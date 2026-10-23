CREATE TABLE demo_retention (
 job_id TEXT PRIMARY KEY REFERENCES demo_build_jobs(id),
 expires_at INTEGER NOT NULL
);
CREATE INDEX demo_retention_expiry ON demo_retention(expires_at);
CREATE TABLE demo_statistics (
 job_id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 template_id TEXT NOT NULL,
 reference_id TEXT,
 period_days INTEGER NOT NULL,
 outcome TEXT NOT NULL,
 products INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 expired_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX demo_statistics_owner ON demo_statistics(owner_id,expired_at);
CREATE TABLE maintenance_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
