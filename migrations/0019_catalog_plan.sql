CREATE TABLE catalog_purchase_activations (
 purchase_id TEXT PRIMARY KEY REFERENCES tribute_digital_purchases(purchase_id),
 store_id TEXT NOT NULL REFERENCES stores(id),
 expires_at INTEGER NOT NULL,
 applied_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TRIGGER catalog_purchase_refund AFTER UPDATE OF status ON tribute_digital_purchases
WHEN NEW.status='refund_reported' AND OLD.status!='refund_reported'
BEGIN
 UPDATE stores SET orders_enabled=0,version=version+1
 WHERE id IN (SELECT store_id FROM catalog_purchase_activations WHERE purchase_id=NEW.purchase_id)
 AND NOT EXISTS(SELECT 1 FROM catalog_purchase_activations a JOIN tribute_digital_purchases p ON p.purchase_id=a.purchase_id WHERE a.store_id=stores.id AND p.status='paid' AND a.expires_at>unixepoch());
END;
