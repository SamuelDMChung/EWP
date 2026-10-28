# EWP Management Portal — V1.27 WEB release tests (October 27, 2026)

## Scope

Full source is based on V1.26 WEB, with only Steel Beam Lookup UI/controller, visible page version/cache labels, and release docs/test files updated. No production services or data modified.

## Verified locally

- `node tests/v1_27_smoke.mjs`: **29 assertions passed**, preserving 196 W shapes, 196 two-way imperial/metric mappings, exact W12×14 and W12×50 dimensions, sortable four-column table, dynamic SVG labels, filtering, row selection, old URL, and all page version labels.
- `python tests/browser_smoke_v1_27.py`: **6 Chromium scenarios passed** at viewport widths 1400, 900, 390, each in light and dark. Exercises the real source module and CSS injected into an offline browser with the 196-row local JSON fixture. Verifies diagram and table share a row at desktop/tablet widths and stack on mobile, no dimension-label/arrow overlap, horizontal page overflow, both input systems, dimension updates, row selection, sorting, Clear and invalid-input state. Screenshots in `tests/steel_beam_lookup_v1_27_{light,dark}_{1400,390}.png`.
- `node tests/v1_21_smoke.mjs`: **31 assertions passed** for earlier material/tools behavior.
- `node tests/v1_22_smoke.mjs`: **23 assertions passed** for geometric Qty/Product extraction and page-break regressions; Sherman Road HUC610 remains **50 pcs**.
- `node tests/v1_27_pressure_regression.mjs`: **30 assertions passed**, same V1.24 converter suite but updated only the expected cache URL suffix to 1.27. The historical source test stays unchanged.
- All **38** `.js`/`.mjs` files passed `node --check`; all **10 HTML pages** have V1.27 developer credits and local asset references; **181** relative HTML references and **58** relative module imports exist.
- All **14 SQL files** byte-identical to V1.26; local W catalog JSON **byte-identical** (196 records); material-list PDF parser and Sales Tracking JS unchanged.
- Full source ZIP integrity verified by `ZipFile.testzip()` with no duplicate entries or missing/unsafe paths.

## Not tested / boundaries

- Live GitHub Pages HTTP load, full module JSON network fetch, actual Supabase authentication/project reads, Edge Functions/Resend, Outlook clipboard, NRCan and iOS were not tested; those require deployed access and user environment checks.
- Existing BCBC snow-load city dataset was not fully audited against BCBC 2024; this limitation is unrelated to the V1.27 changes.

## Deployment and smoke test

1. Replace the full GitHub Pages repository root with all files from `EWP_Management_Portal_V1_27_WEB_FULL.zip`, commit/push, and hard-refresh. Support either `/ewp/` or `/EWP-Forecast/` based on the repository name.
2. Sign in and open **EWP Tools → Steel Beam Lookup**. Confirm 196 rows initially, filter W12×14 ↔ W310×21 → bf 3.97 in / d 11.91 in; W12×50 ↔ W310×74 → bf 8.08 in / d 12.19 in. Confirm table left, I diagram right on desktop; four columns, no reference footnotes; on mobile the illustration stacks above the scrollable table.
3. Check sort, row click, Clear, light/dark. Spot-check Consolidate Material List, snow calculator/converter, Sales Project Tracking All Sales, Project Tracking / Forecast sync and purchasing read/write transaction flows.
4. No SQL migration or Supabase Edge Function deployment is required. EWP Connect iOS is not changed.
