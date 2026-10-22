# Working and test versions

## Environments

|          | Production                                                                               | Staging                                                                                |
| -------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Worker   | catalog-factory                                                                          | catalog-factory-staging                                                                |
| D1       | catalog-factory                                                                          | catalog-factory-staging                                                                |
| R2       | catalog-factory-images                                                                   | catalog-factory-staging-images                                                         |
| Source   | stable/pre-self-service-2026-10-22 checkpoint; current cloud version recorded separately | develop                                                                                |
| Telegram | @delokay_bot owns webhook and notifications                                              | Same bot identity; signed login checked through a read-only service call to production |
| Tribute  | Existing configuration                                                                   | Disabled                                                                               |
| Cron     | Existing schedule                                                                        | Disabled, including a runtime guard                                                    |

The staging D1 database and R2 bucket were created on 2026-10-22. The staging Worker is configured in source but has not been deployed. Its planned URL is `https://catalog-factory-staging.nikita-karpof.workers.dev/admin`.

No production secrets are copied into staging. `AUTH_VERIFIER` calls only production's `/api/admin/preferences` to validate the exact Telegram initData. User/store changes are then stored in staging D1. This service binding requires production to remain available. It does not forward product changes or payments. Staging blocks bot setup, Telegram sends, webhook handling, Tribute HTTP events and payment bridge events, even if someone accidentally adds a production token.

One bot can have only one webhook/menu URL at a time. The current bot configuration is unchanged. A test Mini App needs a Web App button/link configured in Telegram that points to staging; opening `/admin` in a normal browser does not provide Telegram authorization. Configure that entry after staging is published. Do not run `telegram:setup` against staging.

## Saved versions

- `stable/pre-self-service-2026-10-22`: source state before local self-service work.
- `checkpoint/self-service-2026-10-22`: completed local implementation checkpoint.
- `develop`: new development and environment separation.
- `releases/production-baseline-2026-10-22.json`: exact Cloudflare version currently serving production. This is the rollback reference; the source checkpoint is not asserted to match the deployed bundle byte for byte.

These refs currently exist locally. Publishing them to GitHub requires resolving the automatic approval rejection reported in the session. The existing production Cloudflare Build trigger watches only `feat/catalog-factory-mvp`, so pushing develop does not publish to production. Do not switch that trigger to develop.

## Commands

```sh
npm run release:list
npm run dev:staging
npm run build:staging
npm run deploy:staging
npm run release:backup
npm run release:rollback -- production-baseline-2026-10-22
```

Deployment requires authorized Cloudflare credentials. `deploy:staging` also requires a separate staging `PLATFORM_API_KEY` of at least 32 characters. It ignores production DATABASE_ID, Telegram and Tribute secrets, applies migrations only to staging D1 and publishes only the staging Worker. Regular `deploy:cloudflare` keeps the existing production path. Both commands select a complete environment configuration before running migrations.

`release:backup` writes an SQL export to ignored `.backups/`. Copy a backup to durable private storage before production migrations; never commit customer data. This command is not an R2 backup. The current environment separation does not mutate production D1 or R2.

## Rollback

The rollback command restores Cloudflare Worker version `25d5273b-8668-4271-a6df-653cad6b20a4` at 100% traffic. It does not run migrations, switch Git branches, delete orders, or restore D1/R2. It needs Cloudflare authorization; the command was checked but an actual production rollback was intentionally not performed.

For every subsequent production release, save a new immutable JSON manifest with its Cloudflare version ID. Check compatibility with existing database schemas before rollback. Keep database changes additive (new tables/optional columns) while an older version remains a rollback target. Do not drop or rename data required by that version. Database restore is a separate recovery operation because it can remove orders received since a backup.
