CREATE TABLE subscriptions (
 store_id TEXT PRIMARY KEY REFERENCES stores(id),
 started_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 reminder_sent_at INTEGER,
 reminder_attempts INTEGER NOT NULL DEFAULT 0,
 reminder_next_at INTEGER NOT NULL DEFAULT 0,
 reminder_lease_until INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX subscriptions_due ON subscriptions(expires_at,reminder_sent_at,reminder_next_at);
