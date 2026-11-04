CREATE TABLE platform_plan_settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 product_url TEXT NOT NULL,
 updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
