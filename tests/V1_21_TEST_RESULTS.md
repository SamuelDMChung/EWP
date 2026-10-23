# V1.21 WEB — Verification report

## Automated local tests

- Run `node tests/v1_21_smoke.mjs` from release root: 31 source-level assertions: S/psf calculation, Part 9 minimum, invalid numbers, NRCan result normalization, 113-city lookup sample, nearby reference search, six Sales Tracking filters, cross-page material parsing, INVERTED hanger normalization, HTML/TSV output, PDF column groups and mock PDF export/save.
- Run `node --check` over all `.js` and `.mjs` (must pass).
- All local relative HTML and JS module references checked; all 9 page credits updated; archive migration SQL untouched.
- ZIP integrity, duplicates, asset paths and source-to-release inclusion confirmed before delivery.

## Tests NOT performed, must check on published GitHub Pages

- Real Supabase sign-in, RLS and every workspace's live navigation; existing live records and transaction ledgers were not changed. This is static regression review only, not a production database test.
- Browser PDF rendering and jsPDF CDN access. PDF generator's table paging logic was tested with a mock document; native jsPDF output must be opened and visually reviewed (including >4 level columns and enough rows to span pages).
- Upload/parse the real Weyerhaeuser material report and paste the rich HTML into Outlook desktop/web. Original code retained but not tested against a live Outlook installation.
- NRCan live API (GitHub Pages CORS / result categories / regional accuracy and remote availability); code uses the documented endpoint and response fields but not a live integration response here.
- Independent audit of all 113 BCBC 2024 city Ss/Sr values. The starter values were transcribed from the owner's BCBC 2018 reference and cross-checked selectively with indexed BCBC 2024 excerpts; **must check each row with BCBC 2024 before engineering use.**
- Actual light/dark appearance in a user browser; CSS was reviewed but no production screenshot QA.

## Deployment

Copy/extract the full `EWP_Management_Portal_V1_21_WEB_FULL.zip` into the GitHub Pages repository *root*, replacing prior web files while retaining `.nojekyll`, and commit/push. No SQL migration or Supabase/Edge Function deploy required. Do not update EWP Connect iOS. Hard-refresh after GitHub Pages publishes and run the live QA checklist.
