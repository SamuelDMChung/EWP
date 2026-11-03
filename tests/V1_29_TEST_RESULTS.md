# V1.29 WEB — Release testing and deployment notes (2026-10-30)

**Canonical:** V1.28 complete ZIP. **Scope:** EWP Tools → Consolidate Material List frontend only. **No database, SQL, Supabase, Edge Function, Purchasing or iOS changes.**

## Performed tests

| Test | Outcome | Boundaries |
|---|---|---|
| `node tests/v1_29_smoke.mjs` | 32 passed | Split 12-page Sherman Road positioned-text fixture, 4-file sum/removal, HUC610=50, level totals, warnings, exports, cancellation boundary |
| `python tests/browser_smoke_v1_29.py` | 4 Chromium combinations passed | Desktop/light detailed upload flow; desktop/dark and mobile light/dark. Real UI/logic, **mock PDF.js** and deterministic digest in insecure offline harness |
| Browser workflow | Passed | Bulk chooser, subsequent drag/drop, automatic live totals, remove single file, Clear All, exact content duplicate excluded, same-project overlapping-level review/Include anyway, failure isolation, expandable per-file breakdown |
| Clipboard/PDF path | Passed under mocks | Rich HTML/plain TSV generated from live totals; jsPDF export called with combined rows. **Not a native Outlook, clipboard permissions, jsPDF CDN or actual rendered-PDF test** |
| `node tests/v1_21_smoke.mjs` | 32 passed | Existing parser/email/export regressions |
| `node tests/v1_22_smoke.mjs` | 23 passed | Qty/Product actual PDF column extraction and HUC610 no `Not Required` |
| `node tests/v1_29_beam_regression.mjs` | 29 passed | Version checks adapted from V1.28; W-beam lookup preserved |
| `node tests/v1_29_snow_regression.mjs` | 40 passed | Version checks adapted from V1.28; kPa/psf calculator preserved |

## Required manual production QA after deployment

1. Sign in to `/ewp/` and visit EWP Tools → Consolidate Material List. Confirm Add PDFs accepts multiple real PDF files and immediately processes them; add another PDF later with drag/drop, check new totals and progress.
2. Test duplicate uploads with identical content but a different name, overlapping project/level revisions, user override, source removal, and Clear All. The tool must not silently double-count the same exact bytes or unapproved overlapping revisions.
3. Verify combined Email/Excel copy, browser PDF download and optional per-level columns with long real reports. Confirm no missing rows across report pages. Compare HUC610 L3/L4/L5 to the original 12-page source.
4. Test invalid/scanned/non-PDF, 200 MB per-file limit, and browser behavior with many large PDFs; performance and native PDF.js CDN access need a deployed-browser test.
5. Check all Portal workspaces, All/EWP/Sales navigation, light/dark, login, Sales Tracking, Purchase/Inventory after deploying. Existing backend is intentionally untouched.
6. Existing BCBC location dataset was originally transcribed from 2018 and still needs full 2024 audit.

## Deployment

Copy **all source files** from `EWP_Management_Portal_V1_29_WEB_FULL.zip` into the existing GitHub Pages repository root; retain `.nojekyll`, subfolders, and existing asset/SQL files. Commit/push and hard-refresh. **No SQL migration; no Supabase or Resend deployment; no EWP Connect rebuild.** Relative paths support both `/ewp/` and `/EWP-Forecast/` repo names.
