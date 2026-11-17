# Mobile storefront fixes

The mobile audit repairs retain the existing storefront and WooCommerce contract. The delivery section and all backend files are unchanged.

- Catalog hash navigation enters the fully revealed first album, including direct links and repeat clicks.
- A mobile navigation disclosure exposes every section; Escape restores focus to the menu button. The opaque header keeps links readable on light content.
- Mobile steps scroll to their heading below the header and tabs. The preview stays in document flow; only the tabs stick. Desktop wizard scrolling resets when switching steps.
- The first screen has an explicit mobile album-building button.
- Cart controls have larger touch areas and readable fields. Its heading and primary action stay available while scrolling. Demo actions remain hidden in WooCommerce mode; the server-provided checkout URL and safeguards are preserved.
- The tablet order-guide scene no longer extends outside the viewport.

## Verification

Run `npm test` and `VITE_COMMERCE_MODE=woocommerce npm run build`.

With a demo dev server on localhost:5174, run `npm run test:mobile:ux`. `WB_MOBILE_ORIGIN` overrides the local origin. This browser regression covers catalog entry, mobile menu, step visibility and cart controls at 320, 390 and 430 px. It saves screenshots under `work/mobile-fixes/`.

With a WooCommerce-mode dev server on localhost:5173, run `npm run test:mobile:commerce`. `WB_COMMERCE_ORIGIN` overrides the local origin. This test uses **local API fixtures**, checks personalization, quantity, removal and checkout visibility, and creates no real orders. It does not establish backend or live checkout health.

The existing constructor checks can be run with `WB_UX_CASE='tabs and controls' npm run test:constructor:ux`. Their widths include 320, 375, 390, 768 and 1440 px. Generated screenshots now go to `work/constructor-ux/` instead of overwriting the checked-in audit images.

Public-site verification requires network access to woodbase-lazer.ru; the development environment's proxy returned HTTP 403 during this task. Real iOS/Safari and software-keyboard verification remain separate device checks.
