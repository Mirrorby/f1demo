CREATE TABLE tribute_digital_purchases (
 purchase_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, product_id INTEGER NOT NULL,
 title TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor>=0), currency TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('paid','refund_reported')),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX tribute_digital_owner ON tribute_digital_purchases(owner_id,created_at);
CREATE TABLE tribute_digital_outbox (
 id TEXT PRIMARY KEY, purchase_id TEXT NOT NULL REFERENCES tribute_digital_purchases(purchase_id),
 kind TEXT NOT NULL, sent_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX tribute_digital_pending ON tribute_digital_outbox(sent_at,next_attempt);
