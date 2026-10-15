CREATE TABLE IF NOT EXISTS template_photos (
  template_id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL UNIQUE,
  photos TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1
);
