# Continue EWP Management Portal — V1.32 WEB (November 3, 2026)

## Canonical baseline

`EWP_Management_Portal_V1_32_WEB_FULL.zip` is the complete canonical source; **next version V1.33 WEB**. Do not return to V1.31 code. **Read `PORTAL_HANDOFF.md` first**, then `README.md`, `forecast/EWP_FORECAST_HANDOFF.md`, `ewp-tools/README.md`, `ewp-tools/javelin-spruce-checker/README.md`, and `tests/V1_32_TEST_RESULTS.md`.

## Completed V1.32 change

Javelin vs. Spruce PDF Checker now reads **only base PDF text** to form material expected/ordered rows. PDF annotations of all kinds—including FreeText grade instructions and crossed-out P6—are **never applied** as material edits. They serve **only** to locate manual review warnings by type/rectangle/page; if a base row is marked, the match remains manual review. Unlike V1.31, marked original rows are never silently excluded. The existing session-only correction UI remains available for authorized human revisions.

Exact cut discrepancy highlighting generalizes across all products and units: red short / amber extra piece counts with LF summary and HTML export. Unit 200 PSL 2.2E 3½×9½ missing **2×7′ (14 LF)**; Unit 201 original Javelin TS3 LSL 1.55E 1¾×9½ **1×11′** vs Spruce **1×11′**; base equal but marked/highlighted so manual review, not erroneous extra material. Adjacent P5 strikeout is preserved as original base content.

## Testing boundaries

Node regression: **45 assertions**; browser fixture regression: **4 scenarios**; beam **29**, snow **40**, multi-PDF consolidator **32**, material parser **23**. Preflight verifies all **11** HTML pages, JS syntax, links, unchanged SQL/backend source, no PDFs in public release. The actual original uploaded PDFs were also inspected with PyMuPDF geometric extraction (different library). **The real browser PDF.js CDN/source documents were NOT tested together.** Do not call this live PDF.js QA. See full limitations in `tests/V1_32_TEST_RESULTS.md`.

## Release rules

For each subsequent WEB release provide a complete ZIP, current handoff, all-page version credits, tests, deployment steps, and incremental SQL **only if schema changes are approved**. Preserve every existing workspace and settings/auth/RLS/Resend/Edge Functions and light/dark theme. Do not access or change production Supabase without checking connection/permissions and obtaining authorization. EWP Connect iOS stays separate and untouched. Do not recode without explicit user request.

## Deploy V1.32

Back up live GitHub Pages repository; extract entire ZIP at repo root; commit/push; hard-refresh; upload the two real documents to the PDF Checker in live browser, review Unit 200/201 and all marked areas; validate print/export/page links, Portal and all workspaces, with read-only Supabase session. **No new SQL migration or Edge Function redeployment.**
