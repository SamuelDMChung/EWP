# Continue EWP Management Portal — V1.33 WEB (November 3, 2026)

## Canonical source and next version

Use `EWP_Management_Portal_V1_33_WEB_FULL.zip` as the complete canonical source baseline for V1.34 WEB. Read `PORTAL_HANDOFF.md`, `README.md`, `forecast/EWP_FORECAST_HANDOFF.md`, `ewp-tools/README.md`, `ewp-tools/javelin-spruce-checker/README.md` and `tests/V1_33_TEST_RESULTS.md` before editing. Do not recode until explicitly requested.

## V1.33 completed behavior (PDF Checker ONLY)

Reverted V1.32's annotation-agnostic behavior. Structured FreeText grade instruction `All joists 230, TYP. this level` again changes TJI grade for only the relevant Javelin level. Confident whole-row StrikeOut geometry excludes exactly the struck material row, with a strict single-target overlap and PDF.js height/baseline-aware rectangles. Unassigned/multiple-row strikeouts never delete anything and generate a targeted uncertainty warning. Ordinary highlights/underlines and all other decorative markups are fully ignored: no manual-review badges, no reason strings, no markup-only warnings. Session correction/restore retained. Fine-grained missing/extra cut visual highlighting and HTML report retained.

Original Aria L3 East source PDFs: Unit 200 PSL P5 2×7ft is crossed out, leaving 21 LF Javelin and 21 LF Spruce (MATCH). Unit 201 LSL TS3 1×11ft remains on Javelin and matches Spruce (MATCH), even though a neighboring PSL P5 row is struck. Genuine Rim/Blockings 809 LF vs 576 LF shortage stays mismatch; other stock-cut configurations need review. L3 offline totals: 30 match, 1 mismatch, 1 review. L4 annotated offline totals: 24 match, 0 mismatch, 1 review, applying level-wide TJI 230 and six P6 exclusions.

## Verification and caveats

46 Node regression assertions; 4 offline Chromium responsive scenarios; 29 beam, 40 snow, 32 consolidator and 23 historical parser assertions. Browser harness uses **fake PDF.js**. Original source PDFs independently rechecked with PyMuPDF span geometry and annotation rectangles. **Do not claim actual browser PDF.js has been tested**: verify real CDN, PDF.js text height/rectangles, correct row association, page links, grade-note handling, PDF export and all issue filters after deploying. Flattened/handwritten annotations not guaranteed; no OCR. The BCBC 2024 snow location-table full audit remains incomplete.

## Release rules and deployment

Preserve all WEB workspaces, navigation, themes, Supabase auth/DB/RLS, Resend Edge Functions, SQL history and EWP Connect iOS separately. No production Supabase connection was attempted during V1.33, no production data modified, and no SQL migration required. For V1.34 or later, each release must contain the entire ZIP, refreshed handoff/README/test results/deployment instructions, version/credits on all pages, incremental SQL only if needed. Deploy all V1.33 WEB files to repository root, commit/push, hard-refresh; use real original PDFs in hosted browser to confirm the results; inspect other workspaces read-only.
