# Unified Delokay release — 2026-11-02

One application serves `/admin` (customer Mini App) and `/platform` (developer tools). `/platform/editor` retains the complete editor. The previous staging URL becomes a compatibility redirect to the production application. Its existing developer key remains accepted through a service binding; no key is exposed in JavaScript.

Customer flow: details → template → empty demo (optional sample products) → manual products or CSV import → short link → monthly activation. Instagram collection, website references and domain management remain in developer tools and backend APIs, hidden from the customer UI.

Seven layouts: universal, fashion, home, beauty, bakery, flowers, electronics. New niches include six illustrative products; illustrations are placeholders to replace with merchant photos.

CSV template uses UTF-8 with BOM and semicolon-separated Russian headers, including prices for each enabled currency. Photo URLs and variants use `|`; variant format is `Label:stock`. File validation precedes confirmation. Imports append up to the 500-product catalog limit, use one atomic transaction and an idempotency key, and do not replace existing products.

Three unactivated demos per owner. Each expires seven days after creation; paid active sites do not use demo slots. Retention protects activated stores and stores with transactional records.

Short links use the free is.gd API. Links are cached by store with provider throttling and retry cooldown. Their target is our stable `/c/:slug` route, so redirect behavior can later change when a common domain is connected. The browser ultimately displays the Cloudflare address until then.

Fixed plan: USD 24.99 for one calendar month of one site. Tribute digital/custom purchases are applied to a chosen owned site exactly once; repeated application does not extend the subscription twice. Renewals extend the existing expiry. Refund events stop orders if no other paid entitlement remains. Recurring automatic charging is not enabled.

In the developer panel, paste the new Tribute product URL in “Клиентский тариф Delokay”. The server verifies that the product exists in the connected Tribute account and has exactly the required USD price before saving it. The old custom product is not presented to clients as the monthly plan. Actual product creation/moderation remains in Tribute.

Canonical data: the database and image bucket previously used by the new panel retain the existing active catalog. Original bot language preferences and original template-photo mappings are copied without overwriting the new database. The original image bucket is retained as a read-only fallback. Existing bot/payment secrets and Leela payment bridge remain unchanged.

Validation: TypeScript check, syntax checks, domain tests against SQLite, and a temporary Cloudflare release-check worker verifying seven previews, CSV import, repeat protection and storefront rendering. Local Miniflare integration tests cannot bind their TCP listener in the current sandbox. The temporary verification worker is removed after release.

## Trial activation — 2026-11-04
One free activation per Telegram account for one chosen demo site, for exactly 14 days with orders enabled. A permanent owner-level claim prevents reuse through deleting/recreating catalogs. No card and no automatic charge. Expiry pauses new orders; catalog data is retained. Paying before the trial ends adds one calendar month after the remaining trial period. Trial and payment mutations are atomic and version guarded.

## Subscription notifications
Trial and paid subscriptions have distinct reminders within the last three days, an expiry notice, and activation/renewal confirmations. Buttons open the appropriate site in the Mini App: payments for renewal/activation, subscription details after success. Dates include time and UTC. Notices use RU/EN/RO copy with English fallback.

Subscription writes atomically enqueue confirmations through database triggers. Outbox rows use unique site/owner/expiry/event keys and a delivery lease. Temporary Telegram errors are retried with backoff; stale expiry or previous-owner messages are cancelled before sending. Cron runs every ten minutes and user activation/renewal also requests a background flush. Historical expiries from before the rollout do not send retrospective messages. Expiry pauses orders; renewing an expired subscription restores intake. A manually paused, unexpired subscription stays paused on renewal.
