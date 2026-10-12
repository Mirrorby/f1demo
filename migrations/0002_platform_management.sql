ALTER TABLE stores ADD COLUMN orders_enabled INTEGER NOT NULL DEFAULT 1 CHECK(orders_enabled IN (0,1));
ALTER TABLE owner_invites ADD COLUMN source_owner_id TEXT;
ALTER TABLE owner_invites ADD COLUMN store_version INTEGER;
CREATE TRIGGER order_pause_guard BEFORE INSERT ON orders BEGIN
 SELECT RAISE(ABORT,'STORE_NOT_ACTIVE') WHERE NOT EXISTS(SELECT 1 FROM stores WHERE id=NEW.store_id AND orders_enabled=1);
END;
CREATE TABLE media_cleanup (store_id TEXT PRIMARY KEY);
CREATE TABLE store_copy_jobs (
 id TEXT PRIMARY KEY, target_id TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
 files TEXT NOT NULL CHECK(json_valid(files)), cursor INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed')),
 error TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX copy_jobs_status ON store_copy_jobs(status,created_at);
