-- Run once against the production bot database, not the staging storefront database.
-- Preserve a copy of the old three-column preference table for rollback review.
ALTER TABLE telegram_preferences RENAME TO telegram_preferences_before_ro_20261029;
CREATE TABLE telegram_preferences (
 user_id TEXT PRIMARY KEY,
 language TEXT NOT NULL CHECK(language IN ('ru','en','es','pt','fr','it','tr','pl','ja','de','ro')),
 manual INTEGER NOT NULL DEFAULT 0 CHECK(manual IN (0,1))
);
INSERT INTO telegram_preferences SELECT user_id,language,manual FROM telegram_preferences_before_ro_20261029;
