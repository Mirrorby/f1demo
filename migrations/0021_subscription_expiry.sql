CREATE TRIGGER order_subscription_guard BEFORE INSERT ON orders
WHEN EXISTS(SELECT 1 FROM subscriptions WHERE store_id=NEW.store_id AND expires_at<=unixepoch())
BEGIN SELECT RAISE(ABORT,'SUBSCRIPTION_EXPIRED'); END;
