# EWP Management Portal WEB V1.36 — Test Results

**Release date:** November 3, 2026. **Canonical input:** full V1.35 WEB source ZIP. **Scope:** New EWP Requests external SharePoint File Request handoff with an authenticated-only Supabase setting and no publicly embedded upload token. No production Supabase data or SharePoint files accessed.

| Verification | Result | Scope / limitations |
|---|---|---|
| `python tests/browser_smoke_v1_36.py` | **PASS — 5 offline Chromium scenarios** | Sales page with mock Supabase Auth/REST at desktop 1320px light, mobile 390px dark, tablet 768px light, mobile 390px light, desktop 1320px dark; valid/missing/failed/malicious SharePoint config. Correct HTTPS-only link, safe new tab, correct Auth token, project label copy, optional confirmation recorded in `instructions`, request submission stays functional. **No real Supabase, Microsoft Graph or SharePoint file upload.** |
| `node tests/v1_36_smoke.mjs` | **PASS — 54 assertions** | V1.35 Javelin/Spruce PDF Checker parser/cut comparison and session-only excludes unchanged; FreeText notes retained, no strikeout/Highlight automation, Unit 201 LSL match fixture. Mock PDF.js, not live PDF.js. |
| `node tests/v1_36_beam_regression.mjs` | **PASS — 29 assertions** | Steel Beam Lookup unchanged and all page version/cache credits updated. |
| `node tests/v1_36_snow_regression.mjs` | **PASS — 40 assertions** | Snow Load Calculator unchanged and all page version/cache credits updated. Full BCBC table audit remains outstanding from earlier releases. |
| `node tests/v1_29_smoke.mjs` | **PASS — 32 assertions** | Material Consolidator regression. |
| `node tests/v1_22_smoke.mjs` | **PASS — 23 assertions** | Connector/length parser regression. |
| `python tests/v1_36_release_verify.py <V1.35-ZIP>` | **PASS** | 11 HTML version credits, 70 JS/ESM syntax checks, 199 local HTML paths, 100 relative imports, all 14 existing SQL files and protected backend hashes retained, approved source diff only, no customer PDFs and no full SharePoint upload token in the public source. |
| Incremental SQL review | **PASS — static only** | New `v1_36_sharepoint_file_request.sql` creates a dedicated authenticated SELECT-only table; no existing DB schema/data modified by the script. Separate private SQL file seeds the supplied URL; it is **not** in the source ZIP. **No live SQL execution/RLS test.** |

## Regression findings and operational boundaries

- Upload from the SharePoint external link is manual and goes to the configured user's company OneDrive/SharePoint folder; the portal cannot verify Microsoft upload success or associate documents with requests. The optional checkbox is only the sales user's attestation; it uses the existing Instructions column and notification behavior.
- Existing optional Supabase file attachments remain 10 MB per file, 30 MB combined. The new link does not use Supabase Storage, but the existing attachments still do.
- Link is retrieved using Supabase Auth from a table with RLS and no browser write access. This prevents accidental publication of the upload-token string in the public repository. It does **not** prevent someone with authenticated portal access from sharing the upload URL; handle it as a bearer token.
- The exact user-supplied SharePoint URL was not opened through a connected Microsoft account, and upload-only mode, permissions, cross-org file request behavior, folder ownership, and tenant restrictions remain **unverified**. Test with a harmless file in a browser not signed into the owner's account, then confirm it arrives in the owner's folder. Never interpret offline mocks as proof of Microsoft behavior.
- No production Supabase permissions, data, Auth, Edge Functions, Resend, PDF.js CDN, or EWP Connect iOS were accessed or changed. No existing migrations were rerun.

## Production deployment acceptance checklist

1. Run `v1_36_sharepoint_file_request.sql` in production Supabase SQL Editor only after owner approval and backup.
2. Run separate private `EWP_V1_36_PRIVATE_SHAREPOINT_LINK_SETUP.sql` in SQL Editor, **not** as a GitHub file. Validate that anonymous credentials cannot read config and an authenticated Sales account can read it.
3. Deploy the complete V1.36 ZIP; hard-refresh and inspect all 11 developer credits.
4. New EWP Requests: confirm the SharePoint upload button becomes available after sign-in, opens the expected Microsoft File Request page, and permits a harmless upload by a suitable test user; check the received file in the account owner’s OneDrive.
5. Confirm project-labelled filename, optional upload attestation in Submission History/email, unchanged legacy Supabase small attachments, request submission when link unavailable, navigation and light/dark responsiveness. Spot-check all other workspaces.
