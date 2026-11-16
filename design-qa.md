# Order guide design QA — 2026-11-16

final result: passed

## Visual truth and evidence
- Desktop approved target: `/workspace/scratch/357417e03347/generated_images/exec-87b96187-0c90-4279-90f9-be0c47da08c1.png` (1487 × 1058).
- Mobile approved revision: `/workspace/scratch/357417e03347/generated_images/exec-aa3eae22-00a7-4215-83d6-5b119b5fdc57.png` (1135 × 1386); normalized to its central content column, not treated as a literal 1135px phone viewport.
- Deployed preview under review: commit `6c7cc6305b5b610147467ce403f3f114f7dd58aa`.
- Desktop browser CSS viewport: 1363 × 936; screenshot 1348 × 926 excludes scrollbar/capture chrome. Upper and lower viewport captures cover the complete section; surrounding site header is retained.
- Mobile: actual application in same-origin 390px-wide iframe, 1600px high, desktop host viewport 1363 × 936. This exercises the app's real media queries and image source selection; it is not a device screenshot or touch-device test.
- Browser captures: `/workspace/shared/order-guide-qa/desktop-final-top.jpg`, `desktop-final-faq.jpg`, `mobile-final-top.jpg`, `mobile-final-faq.jpg`.
- Combined comparisons: `/workspace/shared/order-guide-qa/desktop-comparison-final.jpg` and `mobile-comparison-final.jpg`. Reference and actual upper/lower regions opened together; viewport crops are not represented as a single full-section capture.
- Focused comparison: mobile heading, album crop, timeline, CTA and expanded FAQ are readable in the mobile comparison. Desktop title/image hierarchy and lower caption/FAQ regions checked in desktop comparison.

## Comparison history
- Initial P2: desktop title and CTA were too small against the selected composition; photo occupied too much vertical space. Increased title from 4.3vw to 5.4vw, CTA to 20px with 310px minimum width, body to responsive 16–20px, reduced image ratio from 3:1 to 3.5:1 and section padding. Final captures show corrected hierarchy.
- Final: no actionable P0/P1/P2 findings.

## Required fidelity surfaces
- Typography: bold sans-serif two-line main heading, contrasting serif captions/numerals and readable body text. Mobile `ваша история` is a single 34.11px-high line at font-size 31.59px. Existing site font stack retained; exact raster glyph matching is not claimed.
- Layout: wide album, three-column desktop timeline, vertical mobile timeline; CTA follows steps on mobile. FAQ remains a separate subordinate area. Mobile root scrollWidth does not exceed innerWidth (390px).
- Color: ivory/espresso/brass palette retained; accent darkened for readable live text. P3: generated photographic background is slightly warmer than the base section.
- Images: separate optimized desktop and mobile WebP photos, not rasterized UI; wooden engraved cover, leather spine and black pages preserved. Freshly generated photography varies slightly from the mock's exact album angle (P3).
- Content: all three agreed stages and FAQ questions preserved, no invented payment/delivery promises. Package answer uses the confirmed included materials.

## Interactions and checks
- Desktop CTA clicked: navigated to `#constructor`.
- FAQ opened/closed with click; individual order FAQ closed with Enter.
- Mobile 390px app: correct mobile WebP selected, no horizontal overflow, one-line accent title, FAQ expanded with visible answer; full-width CTA follows stage three.
- Native details elements retain keyboard and expanded/collapsed semantics; visible focus styling is present.
- Browser console checked: no application errors observed; unrelated browser-extension metadata errors present.
- `npm run build` passed; existing `node --test tests/woodbaser-source.test.mjs` passed (3 tests); JavaScript syntax checks passed.
- Local preview couldn't connect across executor/browser networking; real deployed preview browser evidence used instead. Physical iOS/Android testing not performed.

## Implementation checklist
- [x] Approved desktop composition and mobile heading revision
- [x] Real responsive image sources and editable HTML content
- [x] CTA and FAQ interactions
- [x] Browser comparison and code/build checks
- [x] Remove temporary responsive harness before production
