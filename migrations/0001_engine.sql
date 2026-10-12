PRAGMA foreign_keys = ON;
CREATE TABLE stores (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'demo' CHECK(status IN ('demo','active')),
 settings TEXT NOT NULL CHECK(json_valid(settings)),
 owner_id TEXT, version INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX stores_owner ON stores(owner_id);
CREATE TABLE products (
 id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id),
 data TEXT NOT NULL CHECK(json_valid(data)), version INTEGER NOT NULL DEFAULT 1,
 deleted_at INTEGER, created_at INTEGER NOT NULL DEFAULT(unixepoch()), UNIQUE(store_id,id)
);
CREATE INDEX products_store ON products(store_id,deleted_at);
CREATE TABLE variants (
 id TEXT PRIMARY KEY, store_id TEXT NOT NULL, product_id TEXT NOT NULL,
 label TEXT NOT NULL, stock INTEGER CHECK(stock IS NULL OR stock >= 0),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 FOREIGN KEY(store_id,product_id) REFERENCES products(store_id,id), UNIQUE(store_id,id)
);
CREATE INDEX variants_product ON variants(store_id,product_id);
CREATE TABLE orders (
 id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id),
 number INTEGER NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL,
 customer TEXT NOT NULL CHECK(json_valid(customer)), items TEXT NOT NULL CHECK(json_valid(items)),
 currency TEXT NOT NULL, total_minor INTEGER NOT NULL CHECK(total_minor >= 0),
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','processing','completed','cancelled')),
 ip_hash TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(store_id,idempotency_key), UNIQUE(store_id,number)
);
CREATE INDEX orders_store ON orders(store_id,created_at DESC);
CREATE INDEX orders_rate ON orders(store_id,ip_hash,created_at);
CREATE TABLE owner_invites (
 token_hash TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id),
 expected_owner_id TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER
);
CREATE INDEX invites_expiry ON owner_invites(expires_at);
CREATE TABLE notification_outbox (
 order_id TEXT PRIMARY KEY REFERENCES orders(id), attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT(unixepoch()), sent_at INTEGER, lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX outbox_pending ON notification_outbox(sent_at,next_attempt);
-- The order insert and inventory reservation execute as ONE SQLite transaction.
-- Guards recheck status, product revision and stock after any competing request.
CREATE TRIGGER order_guard BEFORE INSERT ON orders BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM stores WHERE id=NEW.store_id AND status='active' AND owner_id IS NOT NULL)
  THEN RAISE(ABORT,'STORE_NOT_ACTIVE') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM stores s,json_each(s.settings,'$.currencies') c WHERE s.id=NEW.store_id AND c.value=NEW.currency)
  OR NOT EXISTS(SELECT 1 FROM stores s,json_each(s.settings,'$.deliveryMethods') d WHERE s.id=NEW.store_id AND d.value=json_extract(NEW.customer,'$.deliveryMethod'))
  THEN RAISE(ABORT,'CATALOG_CHANGED') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM orders WHERE store_id=NEW.store_id AND ip_hash=NEW.ip_hash AND created_at>unixepoch()-3600)>=10
  THEN RAISE(ABORT,'RATE_LIMIT') END;
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM json_each(NEW.items) j
  LEFT JOIN products p ON p.id=json_extract(j.value,'$.productId') AND p.store_id=NEW.store_id
  LEFT JOIN variants v ON v.id=json_extract(j.value,'$.variantId') AND v.product_id=p.id AND v.store_id=NEW.store_id
  WHERE p.id IS NULL OR p.deleted_at IS NOT NULL OR v.id IS NULL OR v.archived=1
   OR p.version!=json_extract(j.value,'$.version') OR json_extract(p.data,'$.availability')='unavailable'
   OR (json_extract(p.data,'$.availability')!='preorder' AND v.stock IS NOT NULL AND v.stock<json_extract(j.value,'$.quantity'))
 ) THEN RAISE(ABORT,'CATALOG_CHANGED') END;
END;
CREATE TRIGGER order_reserve AFTER INSERT ON orders BEGIN
 UPDATE variants SET stock=stock-(SELECT json_extract(j.value,'$.quantity') FROM json_each(NEW.items) j WHERE json_extract(j.value,'$.variantId')=variants.id)
 WHERE store_id=NEW.store_id AND stock IS NOT NULL
 AND id IN (SELECT json_extract(value,'$.variantId') FROM json_each(NEW.items))
 AND product_id IN (SELECT id FROM products WHERE json_extract(data,'$.availability')!='preorder');
 UPDATE products SET version=version+1 WHERE store_id=NEW.store_id AND id IN (SELECT json_extract(value,'$.productId') FROM json_each(NEW.items));
 INSERT INTO notification_outbox(order_id) VALUES(NEW.id);
END;
-- A cancellation is terminal. Restore stock once, and only for stocked lines.
CREATE TRIGGER order_cancel AFTER UPDATE OF status ON orders WHEN OLD.status!='cancelled' AND NEW.status='cancelled' BEGIN
 UPDATE variants SET stock=stock+(SELECT json_extract(j.value,'$.quantity') FROM json_each(OLD.items) j WHERE json_extract(j.value,'$.variantId')=variants.id AND json_extract(j.value,'$.reserved')=1)
 WHERE store_id=OLD.store_id AND stock IS NOT NULL
 AND id IN (SELECT json_extract(value,'$.variantId') FROM json_each(OLD.items) WHERE json_extract(value,'$.reserved')=1);
 UPDATE products SET version=version+1 WHERE store_id=OLD.store_id AND id IN (SELECT json_extract(value,'$.productId') FROM json_each(OLD.items));
END;
-- Optimistic edits use a transactional assertion to avoid partial batch writes.
CREATE TABLE mutation_guards(ok INTEGER NOT NULL CHECK(ok=1));
CREATE TRIGGER product_limit BEFORE INSERT ON products BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM products WHERE store_id=NEW.store_id AND deleted_at IS NULL)>=500
  THEN RAISE(ABORT,'PRODUCT_LIMIT') END;
END;
CREATE TRIGGER product_currency_insert BEFORE INSERT ON products BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM stores s,json_each(s.settings,'$.currencies') c WHERE s.id=NEW.store_id AND json_extract(NEW.data,'$.prices.'||c.value) IS NULL)
  THEN RAISE(ABORT,'CATALOG_CHANGED') END;
END;
CREATE TRIGGER product_currency_update BEFORE UPDATE OF data ON products BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM stores s,json_each(s.settings,'$.currencies') c WHERE s.id=NEW.store_id AND json_extract(NEW.data,'$.prices.'||c.value) IS NULL)
  THEN RAISE(ABORT,'CATALOG_CHANGED') END;
END;
CREATE TRIGGER store_currency_update BEFORE UPDATE OF settings ON stores BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM products p,json_each(NEW.settings,'$.currencies') c WHERE p.store_id=NEW.id AND p.deleted_at IS NULL AND json_extract(p.data,'$.prices.'||c.value) IS NULL)
  THEN RAISE(ABORT,'CATALOG_CHANGED') END;
END;
