# NEW CHAT HANDOFF — EWP Management Portal V1.36 WEB

**Canonical full source:** `EWP_Management_Portal_V1_36_WEB_FULL.zip` (Nov 3, 2026), next V1.37. Read `PORTAL_HANDOFF.md`, `README.md`, `forecast/EWP_FORECAST_HANDOFF.md`, `sales/README.md`, and `tests/V1_36_TEST_RESULTS.md` first. Always deliver complete WEB ZIP/updated handoff/credits/tests/incremental SQL when needed. No recode without explicit request. No production database changes without permission. EWP Connect iOS separate.

## V1.36 scope

- New EWP Requests supports **external SharePoint File Request** for large plans via a button and project filename label. No direct SharePoint integration, no Graph, no auto attachment in Supabase and no Supabase file-storage use for these uploads.
- The company file-request link is kept OUT of the public GitHub Pages ZIP. After login, the Sales page fetches `public.ewp_sales_file_request.upload_url` through authenticated REST and validates HTTPS + `.sharepoint.com/:f:/` before revealing the external link. New SQL migration `v1_36_sharepoint_file_request.sql` (one new RLS-protected table, authenticated read-only, no existing data touched). **Private seed file**, supplied separately, must be run by user inside Supabase SQL Editor and NEVER published. If missing, existing New Requests functionality remains available.
- Optional confirmation checkbox in Sales form writes a plain attestation to existing `instructions` field, which shows in History/Resend notification. No Microsoft confirmation or automatic association. Existing optional 10 MB/file, 30 MB/total Supabase attachment workflow remains.
- Other workspaces/auth/settings/theme/Edge Functions/Resend/backend unchanged except all 11 HTML pages stamped V1.36 with cache parameters.
- V1.35 Javelin/Spruce PDF Checker unchanged: no auto strikeouts, highlights ignored, explicit level-wide FreeText TJI grade instructions retained, manual exclusions, red/amber discrepancies. Unit 201 LSL TS3 1×11′ matches offline; **live PDF.js remains unverified**.

## Deployment

1. Back up the DB and run `v1_36_sharepoint_file_request.sql` in Supabase SQL Editor.
2. Run separate private `EWP_V1_36_PRIVATE_SHAREPOINT_LINK_SETUP.sql` in SQL Editor, **never add it to GitHub/ZIP**. No Supabase production access was performed by ChatGPT.
3. Deploy whole V1.36 ZIP to GitHub Pages, preserving `.nojekyll` and settings. Hard refresh.
4. In Sales → New EWP Requests, confirm SharePoint button appears only when signed in, upload a harmless sample through the link and check the owner folder. Check naming, saved request/history/email, optional small Supabase attachments, desktop/mobile & themes. **SharePoint upload URL was user-provided and not independently verified.**
5. No Edge Function or Resend redeploy; no existing table migration. EWP Connect iOS untouched.

## Tests

See `tests/V1_36_TEST_RESULTS.md` and offline browser test. No live Supabase RLS or Microsoft tenant testing; do not imply an uploaded file was received without checking owner's OneDrive.
