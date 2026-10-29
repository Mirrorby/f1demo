# Multilingual sites and manual demos

The Mini App can create a demo without Instagram. The name is required; description,
logo URL and merchant contacts are optional. Sample products and illustrative prices
remain marked as test content. Manual demos share the three-demo quota and seven-day
retention policy. A request UUID prevents accidental duplicate creation on retry.

Store settings contain the main language, enabled languages and optional translations.
The public site and API select only an enabled `?lang=` value and fall back to the main
language. Standard controls and known template copy are translated. Merchant copy,
product details, variant labels and attributes can be translated in the editor; empty
translation fields retain main-language content. Prices, IDs, inventory and orders are
shared across languages. Delivery translations must preserve the original order.

New stores default to USD. Any three-letter uppercase currency code is supported;
prices are entered explicitly, with no exchange-rate conversion. Sample prices are
illustrative. Imported products without a price in the selected currency use price on
request until the merchant enters a price. Existing stores retain their currencies.

## Deployment and rollback

Staging migration 0016 adds a language list to demo jobs and extends language
preferences. It does not alter existing stores or product content.

The shared production bot is patched from its pinned live bundle rather than deploying
the staging service over it. Run `production-romanian-preferences.sql` once against the
production bot database. The old preference table is preserved. Before reverting the
bot to a version without Romanian support, map any new `ro` preferences to `en` in the
current preference table, then restore the previous Worker version. Do not remove
storefront languages, content or orders during a code rollback.
