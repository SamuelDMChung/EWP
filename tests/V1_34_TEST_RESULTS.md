# EWP Management Portal — V1.34 WEB QA Results

Date: 2026-11-03. Baseline: full V1.33 WEB ZIP. Scope: PDF Checker annotation orientation and removing technical diagnostic results section; 11 HTML version/cache stamps. Read-only tests; no production Supabase access or changes.

| Suite | Result | Coverage |
|---|---|---|
| `node tests/v1_34_smoke.mjs` | **70 assertions PASSED** | Both PDF annotation coordinate orientations; six P5 strikeouts, neighboring Unit 201 TS3 retained, exact match, FreeText grades, L4, highlight ignored, red/amber cut differences, no diagnostics UI/export, ambiguity safeguards |
| `python tests/browser_smoke_v1_34.py` | **4 responsive scenarios PASSED** | Desktop 1320px light/dark, 768px light, 390px dark; full UI and comparison JS; fake PDF.js with **deliberately inverted** Javelin annotation coordinates; uploads, PDF replacement, filters, HTML export, no UI/console exceptions |
| `node tests/v1_34_beam_regression.mjs` | **29 assertions PASSED** | Steel Beam Lookup unaffected |
| `node tests/v1_34_snow_regression.mjs` | **40 assertions PASSED** | Snow Calculator unaffected |
| `node tests/v1_29_smoke.mjs` | **32 assertions PASSED** | Multi-PDF Material Consolidation unaffected |
| `node tests/v1_22_smoke.mjs` | **23 assertions PASSED** | Prior connector parser unaffected |
| `python tests/v1_34_release_verify.py <V1.33 ZIP>` | **PASSED** | JS syntax, HTML credits/paths, imports, SQL/auth/backend preserved, no customer PDFs shipped, allowed scope |

## Real source pair and coordinate reproduction

Using the **user-uploaded** Aria L3 East Javelin/Spruce PDFs through local PyMuPDF text spans and pypdf raw annotation `/Rect`, not the live PDF.js browser API:

- Top-left geometry and raw PDF rectangles have different Y coordinate frames. Reversing the frame reproduces V1.33's false **Unit 201 TS3 LSL deletion** and retention of PSL P5. Across all three Javelin pages, one orientation aligns all six strikeouts with P5 and the other hits only four rows, including unrelated neighboring rows. With V1.34 document-wide orientation detection, **either incoming orientation** selects the six intended P5 rows and retains Unit 201 TS3.
- **Unit 200 PSL:** crossed-out P5 2 × 7′ excluded, 21 LF expected vs 21 LF ordered, MATCH. **Unit 201 LSL:** original TS3 1 × 11′ vs Spruce 1 × 11′, MATCH.
- Rim LSL 1¼ × 9½: 809 LF Javelin vs 576 LF Spruce, **233 LF definite shortage**, MISMATCH. Rim alternate stock length remains separate MANUAL REVIEW. Offline total: **30 match / 1 mismatch / 1 review**. Older L4 fixture: **24 match / 0 mismatch / 1 review**.
- No ordinary highlight flags; the statistics line and yellow technical warning/review panel removed; downloaded HTML report omits parse diagnostics. Remaining red/amber cut mismatches and genuine stock feasibility reviews preserved.

## Remaining limitations and required deployment verification

**Not yet verified:** actual `pdfjs-dist@6.3.289` (CDN) output from the uploaded original PDFs in the deployed GitHub Pages browser, live Supabase auth, Edge Functions, Resend email, Outlook interactions, or OS PDF print dialogue. Browser QA injects fixtures in place of external PDF.js; independent original-PDF extraction uses PyMuPDF/pypdf. Do not equate these tests with live PDF.js success.

After deploying the entire V1.34 ZIP and hard-refreshing, upload the original **Javelin and Spruce** PDF pair to the hosted checker. Check six intended P5 strikeouts (using session-only row viewer), Unit 201 LSL MATCH, Unit 200 PSL MATCH, correct rim shortage, one stock review, absence of the yellow diagnostic section, match/mismatch filters, manual restore and HTML report. Try an annotated L4 PDF with level-wide FreeText grade instructions, and verify highlighted rows alone do not cause review. Do not commit original PDFs to public GitHub Pages. No SQL migration/Edge redeployment required; EWP Connect iOS untouched.
