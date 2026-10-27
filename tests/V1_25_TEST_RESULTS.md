# EWP Management Portal V1.25 WEB — Local Test Results

**Date:** 2026-10-27. **Baseline:** complete V1.24 WEB ZIP. **Scope:** new EWP Tools → Steel Beam Width and release-wide credits/cache references. No production Supabase or GitHub Pages changes.

| Check | Outcome | Method and limitations |
|---|---|---|
| Varsteel W-section extraction | PASS — 196 unique sections, 5 PDF pages | Coordinate-aware extraction from supplied Varsteel PDF pp. 10–14, printed 4–8; 41/42/35/43/35 entries by page |
| Imperial ↔ metric exact mapping | PASS — all 196 both directions | Local JSON dataset, exact lookups; includes duplicate checks |
| Published dimensions | PASS — 12 crosschecks including W12×14 | Manual-selected source values across all five reference pages; two outputs use table values, not inferred conversion |
| Invalid/empty/unknown beam | PASS | Unlisted input clears outputs; no fabricated dimensions |
| V1.25 Node assertions | PASS — 33 assertions | `node tests/v1_25_smoke.mjs` |
| V1.25 browser interaction/layout | PASS — 5 scenarios | Offline in-memory Chromium with actual lookup JS/HTML/CSS; light/dark at 1350 px and 390 px plus 3-tool hub check. NOT an HTTP/GitHub Pages/auth integration test. |
| Previous V1.21 smoke | PASS — 31 assertions | `node tests/v1_21_smoke.mjs` |
| Previous V1.22 PDF regression | PASS — 23 assertions | `node tests/v1_22_smoke.mjs`; Sherman Road all-level HUC610=50 and page-break totals preserved |
| Previous V1.24 converter regression | PASS — 30 assertions | `node tests/v1_24_smoke.mjs`; updated version-string expectation only |
| JavaScript syntax | PASS — 29 application JS/MJS files | `node --check` |
| Local assets/imports | PASS — 221 references | Verified 10 HTML pages and static JS import references; zero missing references |
| Portal/page version credits | PASS — 10 HTML pages | `V1.25 WEB · Developed by Samuel Chung` everywhere |
| Existing SQL files | UNCHANGED | Compared byte-for-byte with V1.24 ZIP |
| Supabase / RLS / Edge Functions / Resend | UNCHANGED / NOT LIVE TESTED | Not accessed or modified in this release |
| Live Github Pages `/ewp/` and source JSON loading | NOT LIVE TESTED | Requires deployment and real browser check after upload |
| Live material PDF, NRCan, Outlook | NOT LIVE TESTED | Previously tested logic preserved, not retested against live services |

## Deployment check

1. Extract full `EWP_Management_Portal_V1_25_WEB_FULL.zip` to repository root, replacing files. Keep folder structure and `w-sections.json` under `ewp-tools/steel-beam-width/`.
2. Commit/push to GitHub Pages, hard refresh. Open Portal → EWP Tools → Steel Beam Width.
3. Enter Imperial 12 and 14 → verify Metric 310 and 21, flange width 3.97″ and depth 11.91″. Clear; enter Metric 310 and 21 → reverse lookup; enter unlisted designation → warning and blank dimensions.
4. Check the other two tools, navigation back to `?view=ewp`, 10-page credits, mobile and both themes. Verify Supabase sign-in and existing data views without modifying production records.
5. No SQL migrations, Supabase functions, Resend changes or EWP Connect iOS steps needed.

**Dataset scope caveat:** 196 sections are all **rolled W entries in the supplied Varsteel reference**, not every possible historical/newer W shape. The full existing Snow Load Calculator BCBC 2024 city-data audit remains outstanding from previous releases.
