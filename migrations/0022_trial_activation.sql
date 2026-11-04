-- Owner-level history survives catalog deletion, preventing repeated trial claims.
CREATE TABLE trial_activations (
 owner_id TEXT PRIMARY KEY,
 store_id TEXT NOT NULL UNIQUE,
 started_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
