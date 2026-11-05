# EWP Management Portal V1.37 WEB — Test Results

**Date:** November 4, 2026. **Source:** V1.36 canonical full WEB ZIP. **Scope:** Remove `Full Takeoff` from New EWP Requests task choices only, remove all SharePoint File Request frontend options and requests. Preserve small Supabase attachments, all other workspaces, private backend/RLS, Edge Functions, Resend and historical source migrations.

| Test | Result | Scope |
|---|---|---|
| `python tests/browser_smoke_v1_37.py` | **PASS — 4 Chromium browser flows** | Desktop 1366px light, tablet 768px dark, mobile 390px light/dark; tasks display ATS, Dimensional Takeoff, EWP Layout and EWP Takeoff, not Full Takeoff despite the globally configured setting; SharePoint panel and handlers absent, **zero** `ewp_sales_file_request` fetches, mock request submission and email notification, optional small PDF attachment upload and same original instructions value. |
| `node tests/v1_37_checker_regression.mjs` | **PASS — 54 assertions** | PDF Checker V1.35 behavior unchanged; no strikeout autodeletion, FreeText grade note retained, Unit 201 1×11′ LSL from offline fixtures matches. **Not live PDF.js.** |
| `node tests/v1_37_beam_regression.mjs` | **PASS — 29 assertions** | Steel Beam Lookup unchanged and version credit checks. |
| `node tests/v1_37_snow_regression.mjs` | **PASS — 40 assertions** | Snow Load Calculator and version credit checks. BCBC 2024 city row-by-row dataset audit remains outstanding. |
| `node tests/v1_29_smoke.mjs` | **PASS — 32 assertions** | Material Consolidator and parser regression unchanged. |
| `node tests/v1_22_smoke.mjs` | **PASS — 23 assertions** | Earlier material connector and total-length regression unchanged. |
| `python tests/v1_37_release_verify.py /mnt/data/EWP_Management_Portal_V1_36_WEB_FULL.zip` | **PASS** | ZIP canonical input CRC, 11 HTML version credits, 73 JS/ESM syntax files, 199 local HTML references, 104 relative imports, 15 unchanged pre-existing SQL files, protected backend hashes, 17 in-scope modified files, all previous files retained; no customer PDFs or private SharePoint token in public source. |

## Verification limitations and deployment

- Browser request/attachment tests simulate Supabase authentication, API, Storage and email. **No production Supabase, Resend, GitHub Pages, or Microsoft service was accessed as part of this release**, and no real request, file upload or email was created.
- The historical V1.36 `public.ewp_sales_file_request` database table **still exists** from the prior authorized SQL update but is **not queried by V1.37**. No new SQL migration, drop-table statement, or production data cleanup is included; the existing 15 SQL files are kept for migration history.
- Existing Submission History is deliberately not modified. Previously saved `Full Takeoff` tasks or SharePoint-confirmation instructions may still appear on historical requests, but are not available for a new request.
- The shared Tracker Task list is not modified; `Full Takeoff` remains available to Tracker where previously configured. The filter is confined to the New EWP Requests UI and its client-side form validation.
- Upload size remains 10 MB per file / 30 MB total. Supabase Free storage limits remain; disabling the SharePoint handoff does not increase available storage.
- Deploy the complete V1.37 WEB ZIP to existing GitHub Pages root, commit/push and hard refresh. Sign in and confirm New EWP Requests, submission, email, optional attachments and History. Smoke-test other workspaces and mobile/dark theme. No SQL, Edge Function, Resend or EWP Connect iOS deployment needed.
