CREATE TABLE product_imports (
 store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL,
 count INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(store_id,request_id)
);
DROP TRIGGER demo_jobs_limit;
CREATE TRIGGER demo_jobs_limit BEFORE INSERT ON demo_build_jobs
WHEN (SELECT COUNT(*) FROM demo_build_jobs j JOIN stores s ON s.id=j.store_id WHERE j.owner_id=NEW.owner_id AND s.status='demo')>=3
BEGIN SELECT RAISE(ABORT,'DEMO_LIMIT'); END;
