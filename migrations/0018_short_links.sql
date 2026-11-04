CREATE TABLE catalog_short_links (
 store_id TEXT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
 target TEXT NOT NULL,
 url TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0
);
