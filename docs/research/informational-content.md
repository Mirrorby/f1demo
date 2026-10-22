# Informational content in retail templates

Reviewed 2026-10-22. Reference examples:

- https://beautysalon-ru.bot2site.com/
- https://photographer-ru.bot2site.com/
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content

Bot2Site examples combine business descriptions, services, pricing, galleries, team information, FAQ and contact details. Delokay adapts these information needs to retail: what the store sells, how to compare options, how to place an order, delivery/payment, exchanges/returns, niche-specific questions and genuine merchant contacts. Team biographies, reviews, certifications and delivery promises have no invented defaults.

Google's guidance applies ordinary SEO fundamentals to AI Overviews and AI Mode. Important information should be visible as text, crawlable and useful to shoppers. Structured data must agree with visible information. No special AI file, special schema or guaranteed inclusion is claimed.

## Implementation

- `template-content.ts` contains original RU/EN guidance for all four current niches. Other storefront languages currently fall back to English for the new editorial defaults.
- Store description and a short information navigation appear before the catalog. Selection help, ordering, shipping and returns appear after it. FAQ uses accessible native details/summary elements; answers are present in the initial HTML. Contact links use only validated, configured merchant accounts.
- Organization JSON-LD includes the same store name, description and social profiles shown to visitors. It contains no invented address, reviews, ratings, shipping or return policy. FAQ rich-result eligibility is not claimed.
- All text is editable in Settings → Information for customers. Explicitly blank information fields suppress sections/questions. Title/body or question/answer pairs need both values to appear. Existing 500-character field limits apply.
- Preview and demo pages receive missing content defaults without rewriting saved merchant copy. Live stores with no such fields do not acquire sample policies at render time. Newly created template stores persist their editable defaults.
- Demo and template pages keep `noindex, follow`; they are previews, not pages intended to compete in search. Real merchant content needs merchant-specific facts before publication. Templates do not automatically turn Instagram data into verified facts.

## Editorial rules for future generation

Use the merchant's actual name, product categories, materials, sizes and confirmed service area. Answer one concrete buyer question per paragraph. Prefer checkable specifics over superlatives or repeated keywords. Ask for missing delivery fees, lead times, payment methods, return terms, seller identity and contact details instead of inventing them. Product care instructions must match the item or manufacturer; avoid unverified health claims. Merchant edits take priority over regenerated copy.

This change creates the content foundation; it does not provide automatic indexing, product-page server rendering, Search Console registration or a guarantee of citation by an AI answer engine.
