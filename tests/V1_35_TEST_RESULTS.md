# EWP Management Portal — V1.35 WEB Test Results

**Date:** 2026-11-03. **Input source:** complete V1.34 WEB ZIP. **Scope:** Javelin/Spruce PDF Checker no-auto-strikeout behavior, user correction UI and all-page version/cache stamps. No production DB/Edge/Resend access or changes.

| Validation | Result | What it actually tests |
|---|---|---|
| `node tests/v1_35_smoke.mjs` | **54 assertions PASS** | Retains every original Javelin row; StrikeOut/Highlight ignored; FreeText level TJI grade preserved; Unit 201 LSL matches; Unit 200/201 PSL mismatches; manual exclude/restore; rim stock and cut differences |
| `python tests/browser_smoke_v1_35.py` | **4 scenarios PASS** | Actual checker HTML, CSS and JS at 1320px light/dark, 768px light, 390px dark, with **mock PDF.js**; uploads/replacement, filters, Unit 201 LSL match, PSL manual exclusion without touching LSL, HTML export, no UI exceptions |
| `node tests/v1_35_beam_regression.mjs` | **29 assertions PASS** | Steel Beam Lookup retained; 11 credits reflect V1.35 |
| `node tests/v1_35_snow_regression.mjs` | **40 assertions PASS** | Snow Load Calculator retained; 11 credits reflect V1.35 |
| `node tests/v1_29_smoke.mjs` | **32 assertions PASS** | Multi-PDF Material Consolidation retained |
| `node tests/v1_22_smoke.mjs` | **23 assertions PASS** | Legacy Qty/Product connector extraction retained |
| `python tests/v1_35_release_verify.py <V1.34 ZIP>` | **PASS** | All 11 WEB page credits/cache, 67 JavaScript syntax, 199 local HTML references, 96 local module imports, 14 SQL, protected backend hashes and diff scope; no source PDFs in ZIP |
| Independent original-PDF cross-engine check | **PASS (not PDF.js)** | PyMuPDF extracted positioned text from both original uploaded PDFs, fed it to unchanged PDF-line parser; Javelin 81 records, zero auto exclusions, Unit 201 TS3 1×11′ recognized and matched to Spruce, PSL P5 discrepancies surfaced |
| Original-file-position browser replay | **4 scenarios PASS (not PDF.js)** | App UI and parser executed in Chromium with original-file text geometry replayed through a controlled reader; Unit 201 match and manual PSL exclusion confirmed at four viewports. Original files and temporary replay script NOT shipped. |

## Representative comparison outcomes

| Unit/product | Javelin original | Spruce | Expected checker status |
|---|---|---|---|
| 201 LSL 1.55E 1¾ × 9½ TS3 | 1 × 11′ (11 LF) | 1 × 11′ (11 LF) | **MATCH** |
| 201 PSL 2.2E 3½ × 9½ P5 | 2 × 7′ (14 LF; visibly struck) | 0 | **MISMATCH**, missing 2 × 7′ (14 LF) until manual exclude |
| 200 PSL 2.2E 3½ × 9½ P5 | Additional 2 × 7′ (14 LF; visibly struck), total 35 LF | 21 LF | **MISMATCH**, missing 14 LF until manual exclude |
| Rim/blocking LSL 1¼ × 9½ | 809 LF | 576 LF | **MISMATCH**, shortage 233 LF |

**Full controlled L3 fixture:** 27 MATCH, 7 MISMATCH, 1 stock REVIEW. Six struck P5 rows remain included. After manual exclude on Unit 201 P5, mismatch count drops to six, Unit 201 LSL still MATCH. **Historical L4 fixture:** FreeText TJI 230 note applied, struck P6 rows retained; 21 MATCH, 6 MISMATCH, 1 stock REVIEW.

## Important boundaries

- The offline browser tests use a deterministic mock PDF.js API. The original uploaded PDFs were checked through PyMuPDF cross-engine extraction and visual text geometry, **not real `pdfjs-dist@6.3.289`**. Downloading/running the external CDN module was unavailable in this environment. **Do not equate this with live PDF.js success.** Test original documents after GitHub Pages deployment; if TS3 is still absent, the separate live `getTextContent()`/line-grouping stage needs diagnosis, not annotation logic.
- The report compares selectable-text PDFs, not OCR/scanned material lists. Markup flattened into page graphics is not interpreted; FreeText grade-note recognition depends on extractable annotation metadata. No production auth/RLS, hosted CDN, live Edge Function/Resend, or native print-dialog tests were run. The Snow Load Calculator BCBC 2024 location table remains subject to its earlier full-source audit limitation.
- No original PDFs, customer identifiers or sensitive page contents are bundled in the public source ZIP. Existing backend/SQL histories and EWP Connect iOS are not modified.

## Post-deployment acceptance steps

Deploy the full V1.35 ZIP, hard-refresh, verify all-page credits. In hosted checker, load original uploaded Javelin & Spruce PDFs and confirm Unit 201 LSL 1×11′ MATCH, Unit 200/201 PSL missing 2×7′ chip, manual P5 exclusion resolves only the corresponding mismatch, rim 233 LF shortage and appropriate stock review stay visible. Confirm highlight has no effect, former technical stats/yellow diagnostic panel is absent, HTML/print support existing comparison detail, navigation and light/dark themes behave normally. No SQL or Edge Function deployment needed.
