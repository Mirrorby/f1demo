ALTER TABLE demo_build_jobs ADD COLUMN auto_build INTEGER NOT NULL DEFAULT 0;
ALTER TABLE demo_build_jobs ADD COLUMN period_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE demo_build_jobs ADD COLUMN import_error TEXT;
ALTER TABLE demo_build_jobs ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN position INTEGER NOT NULL DEFAULT 2147483647;
UPDATE products SET position=(SELECT n FROM (SELECT id,row_number() OVER(PARTITION BY store_id ORDER BY created_at,id)-1 n FROM products) ranked WHERE ranked.id=products.id);
CREATE INDEX products_position ON products(store_id,deleted_at,position);
CREATE TABLE lead_events (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, event TEXT NOT NULL, screen TEXT NOT NULL,
 target TEXT NOT NULL, details TEXT NOT NULL CHECK(json_valid(details)),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX lead_events_owner ON lead_events(owner_id,created_at DESC,id);
ALTER TABLE collector_tasks ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0;
CREATE TABLE lead_profiles(owner_id TEXT PRIMARY KEY, first_name TEXT NOT NULL DEFAULT '',username TEXT NOT NULL DEFAULT '',language TEXT NOT NULL DEFAULT '',last_seen INTEGER NOT NULL DEFAULT(unixepoch()));
