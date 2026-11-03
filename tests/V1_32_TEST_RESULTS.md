# EWP Management Portal — V1.32 WEB QA Results

**Date:** November 3, 2026. **Input:** full 178-file V1.31 WEB ZIP. **Output:** complete V1.32 WEB source archive. No production Supabase/Resend/Edge Function access or modification.

## Automated checks — all passed for V1.32 current behavior

| Test | Result | Coverage |
| --- | --- | --- |
| `node tests/v1_32_smoke.mjs` | **45 assertions passed** | Base-only comparison, numeric PDF.js annotation-type mapping, no FreeText/StrikeOut material edits, accurate red/amber cut deltas, adjacent P5/TS3 separation, Unit 200/201, source markup review, safe annotation-error warnings, dimensions and UI wiring |
| `python tests/browser_smoke_v1_32.py` | **4 browser scenarios passed** | 1320px light/dark, 768px light, 390px dark; real V1.32 app/parser JS, offline fake PDF.js fixtures; two-file upload, duplicate, removal/replacement, type detection, issue filtering, markup flags, 14-LF shortage, 11′ LSL, downloadable HTML, no page JS errors / horizontal overflow |
| `node tests/v1_32_beam_regression.mjs` | **29 assertions passed** | Steel beam data/UI retained, current 11-page version stamps |
| `node tests/v1_32_snow_regression.mjs` | **40 assertions passed** | Snow design + unit converter calculations and page versions |
| `node tests/v1_29_smoke.mjs` | **32 assertions passed** | Unchanged multi-PDF material consolidator |
| `node tests/v1_22_smoke.mjs` | **23 assertions passed** | Original connector PDF parser quantity/product and page-break regression |
| `python tests/v1_32_release_verify.py` | **Passed** | 11 HTML credit/cache stamps, JavaScript syntax, local links/imports, protected SQL/backend hash consistency, no customer PDFs, scope check against V1.31 ZIP when available |

### Unit 200/201 test pair

**Sanitized positioned-text fixtures:** Unit 200 PSL 2.2E (3½×9½) = Javelin 1×10′ + 2×7′ + 1×6′ + 1×5′ = **35 LF**; Spruce = 1×10′ + 1×6′ + 1×5′ = **21 LF**. Detailed diff: **Missing 2 × 7′ (14 LF)**. Unit 201 LSL 1.55E (1¾×9½) = **1×11′, 11 LF** on both sides; base comparison is equal but the highlighted source row is **MANUAL REVIEW**.

**Separate real-document local geometry inspection:** Both actual supplied PDFs were inspected with **PyMuPDF**, extracting PDF text spans and annotation bounding boxes. The same Unit 200/201 evidence was reproduced from the original PDF bytes. The Javelin Unit 201 `TS3` original base row sits at p.2 beside a crossed `P5` row, with its own highlight. TS3 was retained. This is an independent local geometry check, **not live PDF.js**.

### Important: new expected totals on heavily annotated PDFs

V1.32 deliberately treats all original base rows as present, regardless of how annotated, and flags marked rows. Hence compared with V1.31, substantially more reviewed groups and some additional mismatches are expected. In sanitized fixture comparison, Aria Level 3 produces 7 base mismatches / 28 reviewed groups / 35 markup-affected groups; Level 4 produces 17 / 17 / 34. Those are not direct stock-order approval counts: they reflect **unapplied markups** and must be reviewed manually. V1.31 historic tests asserting automatic grade overrides and P6 exclusions are superseded, not reused as V1.32 acceptance tests.

### Verification boundary — **not tested live**

- Offline Chromium runs actual UI and comparison JavaScript but **mocks the external PDF.js reader** with positioned-text fixtures. It does **not** verify live PDF.js CDN, real browser annotation rectangles/text-item positions, or PDF viewer page-anchoring.
- The real-PDF extraction check uses **PyMuPDF**, not PDF.js. After deployment, reupload both original Javelin/Spruce files in the hosted browser and confirm Unit 200/201 and other marked rows. Annotations flattened into native page content, scans, handwritten marks or unrecognized document forms may evade detection. Do not claim automatic approval of orders.
- Browser print/Save PDF and GitHub Pages hosting, Supabase session/RLS, Resend/Edge Functions, multi-user/concurrent state and other end-to-end production paths were not exercised against production.
- Snow Load Calculator's BCBC 2024 location table still lacks full row-by-row validation, as previously documented.

## Deployment

1. Back up the current deployed GitHub Pages WEB source, including `.nojekyll` and Supabase config.
2. Extract **all** contents of `EWP_Management_Portal_V1_32_WEB_FULL.zip` into the repository **root** (`/ewp/` Pages site). Commit and push. Hard-refresh to clear `?v=1.31` module caches.
3. Open EWP Tools → Javelin vs. Spruce PDF Checker with both supplied real PDFs. Confirm **Unit 200: missing 2×7′ PSL** (red) and **Unit 201: TS3 1×11′ LSL expected and ordered** (marked area review, not extra material). Confirm P5 remains included in base comparison despite strikeout, manually adjust session-only if appropriate.
4. Verify downloadable HTML contains both difference summaries and review flags; verify browser Print/Save PDF preserves appearance and mark links point at relevant PDF page. Inspect enough marked areas to establish correct geometry on the actual browser/PDF.js version.
5. Check EWP/Sales/Portal navigation, themes, login, Forecast, Tracking, Sales, Purchasing/Inventory, Snow, Steel and Consolidator in a read-only workflow.

**SQL changes: none.** **Backend/Resend/Edge Function changes: none.** **EWP Connect iOS changes: none.**
