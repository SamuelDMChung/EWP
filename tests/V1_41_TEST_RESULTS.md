# EWP Management Portal V1.41 WEB — MFA repair QA

Release date: 2026-11-13. Canonical input: complete V1.40 WEB archive.

## Root cause

V1.40 `mfaList()` called `GET /auth/v1/factors`, which returned HTTP 405 Method Not Allowed on the hosted Supabase Auth server. The supported `GET /auth/v1/user` response contains `factors`, and the official Supabase JavaScript `mfa.listFactors()` derives verified factors from user information. Auth service logs recorded the matching 405 at the user's screenshot time.

## Tests and boundaries

- **MFA source regression:** `node tests/v1_41_mfa_client_regression.mjs` — validates actual (not substituted) `mfa-client.mjs` request paths and verbs, GET user factors, factor filtering, enrollment POST, challenge/verify, session handoff, approval RPC, 405 error guidance and no unsupported GET; **PASS (23 assertions)**.
- **Browser MFA sequence:** `python tests/browser_mfa_v1_41.py` — actual `mfa-client.mjs` and `portal-auth.mjs` logic in Chromium at 1280px/390px, intercepted Supabase REST replies, verify QR display and pending-approval state, assert network request shapes and no JavaScript errors; **PASS (2 viewports)**.
- The previous V1.38 UI-only mock remains available for regression but does not exercise real REST requests and is not evidence of production MFA.
- **Complete-source preflight:** `python tests/v1_41_release_verify.py` — **PASS**: 274 files before packaging, 90 valid JavaScript modules, 11 version-credit HTML pages, 199 valid local references, 127 local imports; 16 historical source files changed and all changes in scope; all 16 SQL files and protected backend source byte-for-byte unchanged versus V1.40.
- **PDF Checker** — 24 no-unit/floor assertions; 24 Framing 209 vs 109 assertions; 54 earlier original-material/markup regression assertions, all **PASS**.
- **Steel Beam** — 29 assertions, **PASS**; **Snow Load** — 40 assertions, **PASS**; **Material Consolidator** — 32 assertions, **PASS**.
- **PDF Checker browser** — 1320px light/dark, 768px light and 390px dark, **PASS** (controlled synthetic PDF.js fixtures, NOT the live PDF.js CDN).
- Legacy `tests/v1_40_checker_synthetic.png` was restored to its original V1.40 ZIP bytes after the browser test regenerated it, preserving canonical old test assets. Version-aware current tests are new files; historical test scripts were not overwritten.

**Not yet verified**: a real employee signing in and scanning an actual QR with Google Authenticator against live Supabase Auth. This requires an authenticated human test after deployment; no credential or TOTP secret should be sent to ChatGPT. The first administrator has NOT been assigned; mandatory enforcement remains OFF; production data and MFA records were not modified.

## Security limitations and rollout gate

- Current V1.38 backend staging is only an enrollment/approval workflow. `ewp_private.mfa_control.enforcement_enabled=false`. Changing this field alone is NOT a full application security deployment; existing storage/RLS/Edge Functions and legacy workspaces must be reviewed before requiring `aal2` for access.
- Database admin bootstrap requires out-of-band account ownership confirmation and a verified TOTP factor; the unfilled SQL template is in `docs/V1_41_ADMIN_BOOTSTRAP_TEMPLATE.sql.template`. Never commit an edited template with private email/UUID to GitHub.
- Google Authenticator is a standard TOTP client, not a Google identity integration. No SMTP, Resend, SMS, Microsoft 365, or Google OAuth configuration is required for TOTP.
