CREATE TABLE telegram_preferences (
  user_id TEXT PRIMARY KEY,
  language TEXT NOT NULL CHECK(language IN ('ru','en')),
  manual INTEGER NOT NULL DEFAULT 0 CHECK(manual IN (0,1))
);
