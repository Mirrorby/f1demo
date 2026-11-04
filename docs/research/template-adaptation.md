# Product template expansion

Reviewed 2026-10-22. Public catalog: https://bot2site.com/ru/templates/.
The catalog advertises 50+ templates but exposes 39 distinct demo links. All are recorded in `bot2site-inventory.json`; this is a reference inventory, not 39 implemented Delokay templates. Eight linked demos were readable through the research tool. Other links could not be retrieved, which does not establish that those sites are down. No rendered visual audit was available.

## Observations

Readable demos consistently expose an introduction, about section, service cards, pricing, a gallery, team, FAQ and contacts. The catalog's many business names are not evidence of equally many distinct page layouts. Source code, images and complete text have not been copied.

## Delokay adaptation

Build original reusable layouts and niche presets separately. A niche changes products, category names, required attributes and useful help text; a layout changes composition. Every preset needs an actual working preview, RU/EN defaults, editable sample content, product variants and an ordering flow.

| First product family       | Composition to implement                                   | Data needed from merchant                     |
| -------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| Fashion and jewellery      | Collection cover, visual product grid, close-up gallery    | Sizes/materials, stock, care, shipping        |
| Beauty                     | Routine or concern categories, product grid, usage details | Ingredients, volume, application, warnings    |
| Home and handmade          | Editorial cover, room/collection gallery, maker story      | Dimensions, materials, care, production time  |
| Food and gifts             | Compact category menu, sets, delivery section              | Ingredients, allergens, weight, delivery area |
| Pet products               | Categories by pet and product purpose                      | Sizes, materials, composition, suitability    |
| Sport                      | Category grid and product specification comparison         | Sizes, weight, intended use, warranty         |
| Tools and home improvement | Searchable specification catalog                           | SKU, compatibility, dimensions, availability  |
| Custom furniture           | Project gallery and configurable product inquiry           | Materials, dimensions, lead time, quote terms |

Service cards become purchasable product cards; appointment calls become cart/order actions; service price lists become variants or bundles. Galleries show real product details and collections. Team blocks become optional maker/brand stories. FAQ addresses size selection, delivery, returns and care. Do not invent merchant guarantees, certificates, reviews, availability, medical benefits or shipping promises.

The inventory maps every public source niche to a proposed product niche. These mappings are our design hypotheses, especially for professional-service templates with no direct retail equivalent. They are not published options in the product yet.

## Visual selection shipped separately

The current four Delokay templates use lazy-loaded, noninteractive, scaled same-origin preview pages. The whole preview label selects its radio option; the adjacent link opens the full example. No third-party preview is embedded. Previews show sample content, not data imported from the user's Instagram. Live preview frames should be replaced by generated screenshots or virtualized as the catalog grows to avoid loading dozens of storefront applications.
