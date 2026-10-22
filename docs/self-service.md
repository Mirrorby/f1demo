# Self-service demo creation

The Telegram Mini App supports Instagram profile input, a built-in template, an optional website reference, storefront language and currency. A new owner sees Create store; existing owners can create another store from Home. Each job creates an owned, editable demo with sample template products. Instagram is recorded in settings; it is not scraped. A website reference is saved, not fetched or converted into a design.

Apply migration `0011_self_service.sql` before releasing this code. Existing stores are unaffected. No Railway or Apify calls are made. This change does not activate subscriptions or enable orders after payments.

## API

- `GET /api/admin/demo-jobs`: current Telegram user's jobs.
- `POST /api/admin/demo-jobs`: `{instagram, templateId, referenceUrl?, language, currency}`. Requires Telegram initData. Does not accept owner IDs, payment flags, arbitrary products or activation status.
- `GET /api/platform/references`: platform-key protected shared reference list, up to 200 newest entries. Available from the platform panel.

The owner and normalized Instagram handle identify a job. Repeating the same selection returns the saved job without replacing merchant edits. A different template/reference for an existing handle returns 409; the existing store can be edited directly. At most three jobs per owner; the quota is enforced by a database trigger, including concurrent requests. References are deduplicated by HTTPS URL after removing query parameters and fragments. Query-based/private reference URLs are not supported.

## State and recovery

`preparing` creates a sample catalog. Store creation, owner assignment, disabling orders and the transition to `awaiting_import` commit in one D1 batch. The job exists before store creation; it is not exposed to another owner. Failed preparations can be retried using the same input. Interrupted preparations can be retried after a two-minute lease. `awaiting_import` means the sample demo is editable, not that a worker is processing it. `sample_content=1` is displayed in the owner's dashboard.

`running` and `ready` are reserved for future import integration. There is no import consumer or automatic retry loop yet. A future worker must not overwrite owner-edited products without explicit confirmation. Payment-to-store activation and subscription expiry remain separate work.

## Verification

Run TypeScript checking and the regular Node test suite. `tests/onboarding.test.js` covers ownership, persisted references, repeat submissions, validation, quota, concurrent creation and disabled ordering. `tests/browser-onboarding.js` exercises the mobile form and editor in Playwright with signed test Telegram data. It needs a runnable Chromium (`CHROMIUM_EXECUTABLE` can specify one).
