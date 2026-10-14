CREATE TABLE platform_invoices (
 id TEXT PRIMARY KEY,
 store_id TEXT NOT NULL REFERENCES stores(id),
 owner_id TEXT NOT NULL,
 amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 currency TEXT NOT NULL CHECK(currency IN ('eur','usd','rub')),
 title TEXT NOT NULL, description TEXT NOT NULL,
 tribute_shop_id TEXT NOT NULL,
 remote_uuid TEXT UNIQUE, payment_url TEXT,
 status TEXT NOT NULL DEFAULT 'creating' CHECK(status IN ('creating','review','pending','paid','refund_reported')),
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 paid_at INTEGER
);
CREATE INDEX platform_invoice_owner ON platform_invoices(owner_id,created_at);
CREATE INDEX platform_invoice_store ON platform_invoices(store_id,created_at);
CREATE TABLE platform_payment_events (
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES platform_invoices(id),
 name TEXT NOT NULL, received_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE platform_payment_outbox (
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES platform_invoices(id),
 kind TEXT NOT NULL, sent_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX platform_payment_pending ON platform_payment_outbox(sent_at,next_attempt);
