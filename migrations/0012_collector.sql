CREATE TABLE collector_tasks (
 job_id TEXT NOT NULL REFERENCES demo_build_jobs(id),
 kind TEXT NOT NULL CHECK(kind IN ('instagram','website')),
 remote_id TEXT,
 status TEXT NOT NULL DEFAULT 'pending',
 summary TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(summary)),
 checked_at INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(job_id,kind)
);
ALTER TABLE site_references ADD COLUMN analysis TEXT CHECK(analysis IS NULL OR json_valid(analysis));
