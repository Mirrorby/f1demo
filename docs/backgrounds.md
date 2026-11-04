# Store backgrounds

Settings → Page and section backgrounds supports six independent areas: page canvas, hero, catalog, product cards, information sections and footer. Each area can retain the template background, use a hex colour, or use an image. Merchants can upload a JPEG/PNG/WebP or supply an HTTPS image URL. Uploads use the existing resize, signature validation, store ownership and R2 storage flow.

The page canvas is visible behind the sections. Catalog and information surfaces retain a readable template surface until configured separately. Image backgrounds use cover/centre positioning without fixed attachment on mobile. The overlay is configurable from 0–80%; its default is 60%. Text can be automatic, light or dark. Automatic colour contrast uses the selected solid colour; image backgrounds default to light text with a dark overlay. Merchants should check readability for the chosen photo.

Changes become public only after saving settings. Selecting “Use template” removes that area's override and retains the previously selected colour/photo in the editor for reuse. Uploaded images are not deleted when changing modes. Image cleanup follows the existing store deletion lifecycle. External URLs are loaded by visitors' browsers, not fetched or copied by the backend; they must remain publicly accessible. Protected links, expiring URLs and hotlink restrictions can prevent display.

Backgrounds are additive settings JSON, requiring no database migration. Settings validation rejects unknown targets, invalid modes/colours/overlays, missing photos in image mode, insecure protocols and another store's media. CSS strings are escaped before embedding in HTML. Server-rendered styles apply on shared URLs and custom domains. Store copies remap uploaded background media alongside logos and product photos; external URLs remain shared.

`tests/backgrounds.test.js` covers validation, persistence, template reset, theme changes, escaping and independent copied files. Browser smoke includes solid page colour, an uploaded hero and a linked footer background.
