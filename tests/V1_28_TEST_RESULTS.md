# EWP Management Portal — V1.28 WEB test results (October 28, 2026)

## Change under test

Source: complete V1.27 WEB package; WEB only. Snow Load Calculator now provides two synchronized inputs each for Ss and Sr (kPa / psf) in one shared block in both Custom and BC Location modes. The standalone Quick Unit Converter card and script tag were removed. Existing Cb options, result formula, local BC list, remote NRCan suggestions and warnings remain intact. All ten page credits and entrypoint cache strings updated to V1.28.

## Local test outcomes

- `node tests/v1_28_smoke.mjs`: **40 assertions passed**. Covers accurate unit conversion, nonnegative/zero/blank/invalid handling, original-unit preservation, no loss of numerical precision in S, removal of old converter DOM/script/CSS, both modes, BC location source preservation and version labels.
- `python tests/browser_smoke_v1_28.py`: **6 offline Chromium scenarios passed**, 1350px/800px/390px in light and dark. Uses source HTML, CSS and flattened JS modules in memory; network/geocoding is stubbed. Tests editing Ss or Sr from either unit, exact result behavior, invalid/blank/zero values, read-only auto-filled BC reference values, 0.55 Part 9 setting, Custom values retained when toggling modes, removal of separate converter and no horizontal overflow. Screenshots: `tests/snow_load_v1_28_{light,dark}_{1350,390}.png`.
- `node tests/v1_21_smoke.mjs`: **31 assertions passed** (older material/tool coverage).
- `node tests/v1_22_smoke.mjs`: **23 assertions passed** (PDF Qty/Product geometry and Sherman Road HUC610 = 50 pcs, across page breaks).
- `node tests/v1_28_beam_regression.mjs`: **29 assertions passed** (V1.27 Steel Beam Lookup checks with only V1.28 version-string expectations adapted). All 196 sections remain unchanged.
- The historical V1.24 standalone converter DOM checks have been intentionally superseded by V1.28 tests; the legacy `pressure-converter.mjs` helper is retained in source for historical reference and is **not loaded or displayed** on the page.
- Full JavaScript syntax check, local HTML/CSS/JS import resolution, ten-page credit/version check, SQL byte comparison and ZIP CRC/integrity verified separately.

## Not tested / limits

The offline Chromium harness does not test production authentication, Supabase reads/writes, GitHub Pages deployment or real NRCan/Outlook traffic. The static BC city Ss/Sr list predates V1.28 and **still lacks a complete BCBC 2024 row-by-row validation**. This release changes unit-entry UI, not code-design assumptions or code-table values.

## Deployment and post-deployment checklist

1. Replace the repository root files with the **complete** `EWP_Management_Portal_V1_28_WEB_FULL.zip` contents. Keep `.nojekyll`, the entire `ewp-tools/snow-load/` directory including `load-units.mjs`, `ewp-tools/steel-beam-width/w-sections.json` and other existing assets. Commit and push to GitHub Pages; hard refresh and confirm `V1.28 WEB` on all ten pages.
2. Open **EWP Tools → Snow Load Calculator → Custom**: enter Ss=2.6 kPa / Sr=0.3 kPa, confirm paired 54.3 psf / 6.27 psf and S=2.38 kPa / 49.7 psf for Cb=.8. Enter 50 psf directly in Ss and confirm kPa updates. Empty/invalid values should not produce a numeric S.
3. Switch to **BC Location**, select 100 Mile House: Ss=2.6 kPa / 54.3 psf, Sr=0.3 kPa / 6.27 psf; fields are read-only. Toggle back to Custom and verify the earlier user-entered values persist. Test Cb=.55 and custom Cb, light/dark, mobile, and NRCan suggestions online.
4. Confirm the separate Quick Unit Converter card is gone. Spot-test Consolidate Material List with Sherman Road PDF, Steel Beam Lookup W12×14, All Sales filtering, Forecast/Tracker project sync, Purchasing transaction integrity, Sales forms and Portal group navigation with the real project.
5. **No SQL migration, Supabase/Edge Function deployment or EWP Connect iOS work is required.**
