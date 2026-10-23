# V1.22 WEB — test and deployment report

## Implemented source

- `portal-views.mjs`: independent All/EWP/Sales group visibility, deep-link parsing, URL history support. Hooked into the existing `portal-auth.mjs` without changing shared sign-in or connection checks.
- `index.html` / `portal.css`: EWP and Sales headings, three matching cards per row on desktop with olive/teal accents, responsive tablet/mobile layouts.
- `ewp-tools/consolidate-material-list/parser.mjs`: position-derived connector column boundaries; only Qty/Product become output data. Protects against L5 HUC610 Not Required metadata leakage.
- Updated nine `.html` headers/footers and active resource version tags to V1.22. No SQL or iOS edits.

## Reproducible checks

1. Run `node tests/v1_21_smoke.mjs` — **31 passed** (legacy calculations, filters, clipboard and PDF export mocks).
2. Run `node tests/v1_22_smoke.mjs` — **23 passed** (real Sherman Road extracted 12-page PDF text-and-coordinates fixture, column-only parse, 50-pc HUC610, levels 17/18/15, other hanger types, Total Lengths continuation, clean HTML/TSV, headerless connector continuation, local view parsing).
3. Run `python tests/browser_smoke_v1_22.py` — **passed** in offline Chromium (the actual Portal HTML + CSS and Portal view controller are exercised with auth/network omitted). All: 3 EWP + 3 Sales cards; EWP: 3 + 0; Sales: 0 + 3. Verified dark styling, 390px mobile width, zero browser JS errors. The script generates screenshot PNGs for local review but screenshots need not be shipped.
4. Every JavaScript `.js`/`.mjs` `node --check` syntax test, every HTML module/script/style/image local asset link resolution, all nine HTML credit lines and archive CRC validation must pass before packaging. See release verification console output for counts.

PDF fixture provenance: `tests/sherman_12pages_fixture.json` extracted with original selectable text spans and coordinates from the user-supplied 12-page PDF via `tests/pdf_fixture_from_upload.py` (PyMuPDF); JavaScript reader `extractPdfPages` used a stub PDF.js getDocument/getTextContent interface. **No OCR. Not a real browser PDF.js verification.** The test PDF itself is not repackaged.

## Remaining live QA (not claimed passed)

- Upload the original Sherman Road PDF through real PDF.js in Chrome/Edge on deployed GitHub Pages; confirm HUC610 50 pcs, by-level L5 15 pcs, no bogus Not Required products; check a PDF with different header positions or split notes.
- Test browser history and `?view=ewp` / `?view=sales` deep links with real Supabase login and Settings in light/dark; check that all workspace links work and access rules are unchanged.
- Check TC26268 known totals, INVERTED consolidation, optional level breakdown, native Outlook HTML clipboard, Download PDF with jsPDF CDN, printing/Excel paste, Snow Load Calculator and NRCan live lookup, Sales Project Tracking filters.
- Audit all BCBC 2024 snow load city values independently; legacy V1.21 113-city dataset is still provisional as described in `ewp-tools/snow-load/README.md`. No production engineering value verification is claimed.
- Project Tracking/Forecast shared records, purchasing and inventory transaction integrity and Resend delivery were not exercised in production; those source modules and Supabase backend were not modified.

## Deployment steps

1. Back up the current published WEB files, then extract the **complete** `EWP_Management_Portal_V1_22_WEB_FULL.zip` into the GitHub Pages repository root. Ensure hidden `.nojekyll` remains present.
2. Commit/push and allow GitHub Pages to publish. Force refresh browsers to load `?v=1.22` assets.
3. Open `https://samueldmchung.github.io/EWP-Forecast/`, `?view=ewp`, and `?view=sales`, sign in and perform the live QA above.
4. **No SQL migration, Supabase Edge Function redeploy or EWP Connect iOS change is required.** Do not run archived SQL migrations or modify production records.
