# V1.26 WEB verification — Steel Beam Lookup

Date: October 27, 2026. Baseline: full V1.25 WEB ZIP. Changed feature: renamed Steel Beam Lookup, expanded 196-row Varsteel W reference, first-digit filters, selectable/sortable table, dimensioned diagram. **No production deployment performed.**

## Passed

| Test | Scope | Result |
|---|---|---|
| `node tests/v1_26_smoke.mjs` | 196 pairs both ways; 7 column properties; W12×14 and other source spot checks; partial nominal/weight filters; sorting; menu/title; SVG labels; page credits | **47/47** |
| `python tests/browser_smoke_v1_26.py` | Actual V1.26 HTML/CSS/lookup logic in offline Chromium; two-way inputs, 196→30→1 filtered rows, table sort/selection, live diagram labels, Clear, no JS exceptions/horizontal page overflow | **4/4**: light/dark × 1350/390 px |
| `node tests/v1_21_smoke.mjs` | Existing V1.21 smoke checks | **31 checks executed** |
| `node tests/v1_22_smoke.mjs` | Sherman Road 12-page sample parser and PDF page-break/quantity behavior | **23/23**, including HUC610 **50 pcs** |
| `node tests/v1_26_pressure_regression.mjs` | V1.24 converter; only cache-version expectation updated to V1.26 | **30/30** |
| `node tests/v1_26_prior_beam_regression.mjs` | Original V1.25 bidirectional lookup; only page-credit expectation updated to V1.26 | **33/33** |
| Data audit | All original 196 designation pairs, flange widths, depths, source page numbers preserved; all 196 tf/tw; 195 Sx plus 1 source blank | **Passed** |
| 10-page release credits | All 10 HTML pages include `V1.26 WEB · Developed by Samuel Chung` and updated cache-bust | **Passed** |
| Relative JS/CSS/asset references | File presence/static import references across source | **Passed** |
| JavaScript parse | Node syntax checks on all project JS/mjs | **Passed** |
| Existing SQL files | No differences from V1.25 source ZIP | **Unchanged** |
| ZIP archive | No corrupted members, missing entries, unsafe names or unintentional duplicates | **Passed** |

## Not verified (not counted as passing)

- Real GitHub Pages, live Supabase sign-in, shared projects/Forecast/Purchasing, Resend/Edge Functions, and NRCan not exercised. No migrations or database calls were made.
- Live HTTP fetching of `w-sections.json` by the module could not be browser-tested because the environment blocked loopback and intercepted-domain navigations (`ERR_BLOCKED_BY_ADMINISTRATOR`); **local in-memory browser tests of the real lookup module and static URL/path checks passed**.
- The original owner-supplied Varsteel source PDF was used for local data extraction and checking; the PDF itself is not bundled in the release.
- The separate Snow Load Calculator's BCBC-2024 value audit remains open, unchanged.

## Live deployment smoke (recommended)

1. Extract complete ZIP into GitHub Pages repository root (`ewp` or legacy `EWP-Forecast`) and push. Hard refresh.
2. Sign in. Open Portal All / EWP → EWP Tools → **Steel Beam Lookup**; confirm 196 rows load (tests JSON/module loading).
3. Enter only imperial depth `12`: expect 30 rows (all W12). Then weight `14`: expect one W12×14, W310×21, flange **3.97 in**, actual depth **11.91 in** and the graphic showing both.
4. Clear and enter metric depth `310`: expect 30 rows. Enter mass `21`: expect one row and reverse imperial fill. Try another size and an unlisted pair.
5. Clear, click any table row to select it, sort several numeric columns ascending/descending and verify missing W30×90 section modulus prints `—`. Check table on phone width (horizontal scroll), dark theme, EWP Portal return.
6. Smoke-test other two EWP Tools, Sales Project Tracking All Sales filters, Project Tracking ↔ Forecast, Purchasing historical integrity and regular auth. No SQL, RLS, Edge Functions or iOS changes required.
