CREATE TABLE subscription_notifications (
 id TEXT PRIMARY KEY,
 store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('trial_started','activated','renewed','reminder','expired')),
 plan_type TEXT NOT NULL CHECK(plan_type IN ('trial','paid')),
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 sent_at INTEGER,
 cancelled_at INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX subscription_notifications_due ON subscription_notifications(sent_at,cancelled_at,next_attempt,lease_until);
INSERT OR IGNORE INTO maintenance_state(key,value) VALUES('subscription_notifications_since',CAST(unixepoch() AS TEXT));
CREATE TRIGGER subscription_activation_notice AFTER INSERT ON subscriptions
WHEN NEW.expires_at>unixepoch()
BEGIN
 INSERT OR IGNORE INTO subscription_notifications(id,store_id,owner_id,kind,plan_type,expires_at)
 SELECT NEW.store_id||':'||NEW.expires_at||':activated:'||s.owner_id,NEW.store_id,s.owner_id,
  CASE WHEN EXISTS(SELECT 1 FROM trial_activations t WHERE t.store_id=NEW.store_id AND t.expires_at=NEW.expires_at) THEN 'trial_started' ELSE 'activated' END,
  CASE WHEN EXISTS(SELECT 1 FROM trial_activations t WHERE t.store_id=NEW.store_id AND t.expires_at=NEW.expires_at) THEN 'trial' ELSE 'paid' END,
  NEW.expires_at FROM stores s WHERE s.id=NEW.store_id AND s.owner_id IS NOT NULL;
END;
CREATE TRIGGER subscription_renewal_notice AFTER UPDATE OF expires_at ON subscriptions
WHEN NEW.expires_at>OLD.expires_at AND NEW.expires_at>unixepoch()
BEGIN
 INSERT OR IGNORE INTO subscription_notifications(id,store_id,owner_id,kind,plan_type,expires_at)
 SELECT NEW.store_id||':'||NEW.expires_at||':renewed:'||s.owner_id,NEW.store_id,s.owner_id,
  CASE WHEN EXISTS(SELECT 1 FROM trial_activations t WHERE t.store_id=NEW.store_id AND t.expires_at=OLD.expires_at) THEN 'activated' ELSE 'renewed' END,
  'paid',NEW.expires_at FROM stores s WHERE s.id=NEW.store_id AND s.owner_id IS NOT NULL;
END;
