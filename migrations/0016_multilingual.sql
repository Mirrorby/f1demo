ALTER TABLE demo_build_jobs ADD COLUMN languages TEXT NOT NULL DEFAULT '[]';
CREATE TABLE telegram_preferences_next (
 user_id TEXT PRIMARY KEY,
 language TEXT NOT NULL CHECK(language IN ('ru','en','es','pt','fr','it','tr','pl','ja','de','ro')),
 manual INTEGER NOT NULL DEFAULT 0 CHECK(manual IN (0,1))
);
INSERT INTO telegram_preferences_next SELECT user_id,language,manual FROM telegram_preferences;
DROP TABLE telegram_preferences;
ALTER TABLE telegram_preferences_next RENAME TO telegram_preferences;
