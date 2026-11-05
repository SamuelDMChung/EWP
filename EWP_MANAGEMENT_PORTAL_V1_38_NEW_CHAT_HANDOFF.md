# EWP Management Portal — V1.38 WEB New Chat Handoff

**Date:** November 4, 2026. **Base:** V1.37 WEB full source ZIP (234 files). **Next planned:** V1.39 WEB. **Status:** Staged 2FA implementation, **NOT mandatory-MFA production rollout**. Treat V1.38 full ZIP as the complete source candidate only; do not call mandatory MFA live or enforced.

## Scope

- Portal adds an optional native Supabase TOTP authenticator setup and 6-digit verification flow. Recommended app Microsoft Authenticator but any standard TOTP app works. Staff can submit their verified factor for administrator identity review. When enforcement is later enabled, the Portal will not show the workspace unless the server returns access allowed.
- Existing Settings dialog adds a *2FA Management* section accessible only when `mfa_status()` says the user is an admin with an approved, uniquely verified authenticator and current token `aal2`. Admin can approve/reject pending factor requests, review approved users, or revoke approval after independent identity verification. The frontend alone does **not** provide security; the new RPCs perform verified admin approval checks server-side.
- Admin reset is deliberately two-step: revoke app authorization, then delete the native Supabase MFA factor via the authenticated Supabase administrative method/dashboard. This release does not allow bypass or self-approval. No TOTP secrets/service role in JS; no email/SMS provider needed.
- Full original project intact. Only auth/Portal/Settings components and version/cache imports have changed, plus docs/tests and one additive SQL migration. Other workspaces, PDF Checker logic, forecast, project/sales tracking, orders, purchasing, Resend and iOS remain unchanged.

## Production Supabase actions already taken, November 4, 2026

- Confirmed connection to project `dmlodguzwgsbbirptajw` (EWP Material Forecast). Two existing Auth users and zero verified factors at the time checked.
- Applied `v1_38_mfa_staging` through Supabase connector. New private tables in `ewp_private` and six tightly guarded public RPC functions exist. Verified `enforcement_enabled=false`, admin count `0`, enrollment count `0`, 3 private RLS-enabled tables, authenticated-only RPC execute permission.
- **No administrator assignment**, **no MFA factor enrollment**, **no mandatory 2FA activation**, **no existing application table RLS changes**, **no storage or Resend/Edge Function modifications**, and **no user/session or business-data changes**.
- Only likely account found by login: a matching login (actual email and UUID withheld from public source). **Owner must confirm this exact portal login before any admin grant.** Never assign by matching email/name alone or commit the UUID as a hidden client-side admin flag.
- Supabase advisors report existing mutable-search-path and function-permission warnings; 6 newly created SECURITY DEFINER functions are intentionally authenticated-executable with explicit authorization checks. They should be audited during final security rollout.

## Safe deployment sequence

1. Backup current WEB source. Deploy V1.38 complete ZIP to GitHub Pages, hard-refresh, confirm all 11 pages show `V1.38 WEB · Developed by Samuel Chung`.
2. Use your **normal** Portal login. Until enforcement, legacy access continues. Click `Set up / Verify 2FA` to scan a QR in Microsoft Authenticator and verify a code. An enrollment record will become **pending**.
3. Independently verify the owner account, then through a private admin SQL session (not public GitHub source) add only that exact user UUID to `ewp_private.mfa_admins` and approve its verified factor. This initial bootstrap must be done outside the browser since no admin can self-approve. **Do not do this before account identity is confirmed.** A validated private script should require `auth.users.email` matches the confirmed login and exactly one verified TOTP factor for that UUID. After bootstrap and AAL2 login, the admin Settings panel appears. No other user can self-approve.
4. Have a test staff member register and prove identity in person. Verify that only the admin can approve/reject and the employee receives the expected updated status. Test in fresh incognito session, mobile, reload, sign-out/sign-in and loss-of-device scenario. No shared accounts.
5. **Do not enable mandatory MFA yet.** This version stages the management workflow only. Before activation, audit/guard existing 21 public tables, `storage.objects` bucket policies, and 11 pre-existing SECURITY DEFINER functions/RPCs; confirm Edge Function entrypoints enforce the same authorization, especially old auth-only requests. Apply restrictive RLS and rollout gates only in a dedicated reviewed activation release, AFTER admin/employee enrollment and tested recovery. Also verify live Supabase Auth endpoints; mocked tests do not prove live TOTP.
6. No special new Edge Function/Resend deployment required for this staged release. Supabase stage migration already applied to the connected project; include it for repeatable deployment to other projects, but **do not run twice without reviewing**. There is no new public URL containing private credentials.

## Known limitations

- The existing EWP Portal continues to allow traditional logins until enforcement is intentionally enabled (this is deliberate to avoid lockouts); a pending factor is not yet an access barrier outside the new MFA UI. This is **not** a completed enterprise-wide MFA security boundary.
- True trust-this-browser-for-30-days after signing out is NOT implemented. Existing Supabase persistent signed-in session remains. Never use a localStorage boolean to bypass MFA.
- Current Admin recovery requires authenticated Supabase owner access to delete factors after revocation. If owner loses their sole authenticator, recover via Supabase project-owner process; consider a verified backup admin or backup factors with a redesigned single-factor rule before mandatory rollout.
- Live Supabase Auth TOTP enroll/challenge/verify, email delivery/password recovery, real Edge Function operations and production browser regression are not verified. Offline browser tests use stubbed Auth API calls.
- Existing PDF Checker uses staged V1.35 no-strikeout behavior; original hosted PDF.js extraction remains unverified. BCBC 2024 snow city data audit remains incomplete.

## QA

See `tests/V1_38_TEST_RESULTS.md`. Source preflight: 11 HTML credits, 77 JS syntax files, 199 HTML local references and 112 module import paths. Existing regression suites: 54 PDF checker, 29 beam, 40 snow, 32 material consolidation, 23 older parser assertions. Offline mocked Chromium TOTP enrollment/pending approval at 1280 and 390 pixels. SQL connection and privilege checks verified live in staging mode. Full ZIP CRC integrity checked after packaging. No customer PDFs in source.
