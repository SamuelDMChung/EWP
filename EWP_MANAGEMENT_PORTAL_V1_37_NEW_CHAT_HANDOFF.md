# Continue EWP Management Portal WEB — V1.37 Canonical Source (November 4, 2026)

**Canonical full ZIP:** `EWP_Management_Portal_V1_37_WEB_FULL.zip`. **Next:** V1.38 WEB.

Read `PORTAL_HANDOFF.md`, `README.md`, `forecast/EWP_FORECAST_HANDOFF.md`, Sales and EWP Tools READMEs, and `tests/V1_37_TEST_RESULTS.md`. Verify ZIP CRC and source inventory before development. Preserve all workspaces, settings, Supabase Auth/DB/RLS, Edge Functions, Resend, navigation, themes and the independently developed EWP Connect iOS app. **Do not recode until explicitly requested.**

V1.37 changes only New EWP Requests form and the universal WEB credits/cache: `Full Takeoff` hidden in New EWP Requests task choices via frontend filtering of shared Tracker Tasks (Tracker and saved history unchanged); all SharePoint File Request UI, its authenticated config fetch and confirmation behavior removed. Existing Supabase PDF/JPG/PNG attachments (10 MB/file; 30 MB total), new request saving, emails, history and auth unchanged. No new SQL, production operations, Edge redeploy, or SharePoint integration. V1.36's `public.ewp_sales_file_request` table is **left unused**, not dropped. Historical V1.36 SQL retained only for migration provenance. No private upload-token URL stored in WEB source.

Check `tests/browser_smoke_v1_37.py` and `tests/V1_37_TEST_RESULTS.md` for actual checks. Browser tests mock Supabase. Existing PDF Checker remains V1.35 logic (no automatic strikeout exclusions, explicit FreeText TJI notes, highlights ignored); fixture tests do **not** verify live PDF.js; BCBC 2024 snow table row-by-row audit still open. No customer PDF sources in ZIP.

For any future version, include complete WEB source ZIP, updated handoff, credits on each page, full regression/testing notes, deployment instructions and incremental SQL only when schema changes are approved. Never change production data without authorization or touch EWP Connect iOS.
