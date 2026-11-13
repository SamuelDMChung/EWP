# EWP Management Portal — V1.41 WEB: Google Authenticator / MFA HTTP 405 repair

**Release date:** November 13, 2026. **Canonical source:** complete V1.40 WEB ZIP. **Next version:** V1.42 WEB. Developed by Samuel Chung.

## Fix

V1.40 called an invalid `GET /auth/v1/factors` to list a user's TOTP devices. Supabase Auth replied 405, blocking setup. V1.41 calls **authenticated `GET /auth/v1/user`**, derives the list of verified TOTP devices from `user.factors`, and preserves `POST /auth/v1/factors` enrollment and challenge/verify APIs. The UI now recommends **Google Authenticator** (standard TOTP; no Google OAuth integration). Adds an error describing invalid Auth HTTP methods and a guard against enrolling another device when the server reports a verified factor but does not list it.

## MFA staging and administrator bootstrap

- **MFA stays optional for existing access.** Live `ewp_private.mfa_control.enforcement_enabled` remains `false` and no administrator is assigned. We deliberately did **not** modify production SQL, user accounts, factors, authorizations or records.
- Before assigning the first administrator, independently confirm exact EWP Portal login account UUID/email and perform an actual authenticated Google Authenticator scan + six-digit challenge/verify. The login identity in previous context is **not yet independently confirmed**; do not assign admin rights from a guessed identity.
- The first administrator cannot approve themselves in the ordinary UI. An **unfilled, guarded initial-bootstrap SQL template** is included as `docs/V1_41_ADMIN_BOOTSTRAP_TEMPLATE.sql.template`. It must be completed and executed only by an authorized Supabase project owner *after* out-of-band identity confirmation and a single verified TOTP device. The template aborts if placeholders are not replaced, if an administrator already exists, if account identifiers do not match, or if the expected verified factor count is not exactly one. **Do not deploy/bootstrap automatically.**
- After approval, the user should sign in and verify `aal2` and access to Settings → 2FA Management before approving other employees. Recovery requires an administrator-mediated factor reset. Do not enable mandatory MFA until all RLS/Storage/Edge Function routes and legacy workspaces enforce the intended policy; the current staging frontend alone does NOT provide an enterprise-wide security boundary.

## Deployment and verification

1. Back up the GitHub Pages repository. Replace with the COMPLETE V1.41 WEB ZIP, including `.nojekyll`. Commit/push, hard-refresh, confirm `V1.41 WEB · Developed by Samuel Chung` on all eleven HTML pages.
2. Log in with an existing authorized user, open `Set up / Verify 2FA` and `Start authenticator setup`. Expect a QR code, not HTTP 405. Scan with Google Authenticator on your phone and enter the six-digit code. **Never share a QR image or TOTP code in chat.**
3. Confirm the resulting message is `Waiting for administrator identity approval`, the new factor is verified in Supabase Authentication, and the user can still use the portal during the staging period.
4. Confirm identity and bootstrap the first administrator using the secured procedure above, then approve a second test user; do not enable enforcement. Revalidate other workspaces, light/dark themes and the PDF Checker.
5. If the live challenge fails, collect the browser Network *path/method/status* (redact Authorization headers, passwords, QR codes, tokens) and Supabase Auth logs. This release's offline browser mock is NOT proof of end-to-end live Supabase authentication.

## Scope / preservation

Only `mfa-client.mjs`, `portal-auth.mjs`, MFA import cache in `shared-settings.mjs`, Google Authenticator label in Portal UI, and V1.41 version/cache credits on 11 HTML pages changed. Historical SQL and protected backend/Edge/Resend/Auth source remain unchanged. EWP Connect iOS untouched. No new Supabase migration required for this API fix. Source ZIP includes updated handoffs, tests and unfilled bootstrap template.

**Do not recode again without explicit authorization.**

---

## Canonical handoff checkpoint

Treat the verified V1.41 complete WEB ZIP as the canonical code baseline for V1.42. The SUPABASE staging tables/functions from V1.38 are already deployed and remain unenforced. No live bootstrap has been executed; account owner email/UUID verification and actual Google Authenticator enrollment are unresolved prerequisites. Regression evidence is documented in `tests/V1_41_TEST_RESULTS.md`. Keep full source, all workspaces, version/developer credits, original SQL history and the 2FA staging protections.
