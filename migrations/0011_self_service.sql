CREATE TABLE site_references (
 id TEXT PRIMARY KEY,
 url TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'reference' CHECK(status IN ('reference','preparing','available')),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE demo_build_jobs (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 instagram TEXT NOT NULL,
 template_id TEXT NOT NULL,
 reference_id TEXT REFERENCES site_references(id),
 store_id TEXT NOT NULL UNIQUE,
 language TEXT NOT NULL,
 currency TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','awaiting_import','running','ready','failed')),
 sample_content INTEGER NOT NULL DEFAULT 1 CHECK(sample_content IN (0,1)),
 lease_until INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 updated_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(owner_id,instagram)
);
CREATE INDEX demo_jobs_owner ON demo_build_jobs(owner_id,created_at);
CREATE INDEX demo_jobs_status ON demo_build_jobs(status,created_at);
CREATE TRIGGER demo_jobs_limit BEFORE INSERT ON demo_build_jobs
WHEN (SELECT COUNT(*) FROM demo_build_jobs WHERE owner_id=NEW.owner_id)>=3
BEGIN SELECT RAISE(ABORT,'DEMO_LIMIT'); END;
