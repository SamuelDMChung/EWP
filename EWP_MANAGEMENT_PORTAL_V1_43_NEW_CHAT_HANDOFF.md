# EWP Management Portal — V1.43 WEB New Chat Handoff

## Canonical source and release
- Complete source: `EWP_Management_Portal_V1_43_WEB_FULL.zip`; built from the complete, CRC-verified V1.42 WEB source.
- Release date: November 17, 2026; version/developer credit `V1.43 WEB · Developed by Samuel Chung` on all eleven HTML pages. Next release version: **V1.44 WEB**.
- The V1.42 historical archive and handoffs are preserved. Do not recode until user explicitly authorizes new changes.

## What changed
- **PDF Checker only:** `productSpec()` now maps explicit Microllam grades `LVL 2`, `LVL 2.0`, `LVL 2.0E` to one canonical 2.0E identity. It continues preserving exact width, depth, product family and all cut quantities. An explicitly different grade (e.g., 1.9E) cannot silently match 2.0E; missing grade remains unverified and contradictory grade text is treated as ambiguous.
- Fixed original Goat Ridge Main Floor example: Javelin p.1 1¾″ × 7¼″, 2.0E LVL, 11×9′ (99 LF) vs Spruce p.3 LVL714, `MICROLLAM LVL 2`, 11×9′ (99 LF) now **MATCH**, replacing false extra/missing alerts.
- V1.42 Spruce page-boundary logic, prior Framing 209 group matching, numbered and no-unit floor parsing, material cut highlighting, stock/manual-review safeguards and all unrelated workspaces retained without logic changes.
- **Not implemented in this release:** removal of session-only Javelin manual correction controls or new show-matches toggle discussed earlier. Current checker already allows `Show → Matches` or `Show → All items`; a redesign requires separate explicit authorization.

## Verification and known limits
- `tests/v1_43_lvl_grade_regression.mjs` 26 assertions. V1.42 page-break regression 24. Prior checker regression 54. Beam 29, snow 40, plus former no-unit/framing/consolidator/MFA regression when available. Offline Chromium exercises four synthetic plus four private-PDF-position replay scenarios (not bundled).
- Local PDF geometry replay: 11 matches / 1 mismatch / 1 manual review, including LVL 99 LF **MATCH**. The separate 1¼″ × 9½″ LSL blocking mismatch and rim-stock review have not been resolved as part of this version.
- **Actual CDN PDF.js extraction in the live deployed site is not verified**; source PDFs are NOT included in ZIP. Test in production after deployment before trusting decisions.

## Deployment and operations
- Deploy complete ZIP to GitHub Pages and hard refresh; no SQL migrations, Supabase Auth or Edge Function deployments necessary.
- No production Supabase data accessed or changed. Existing verified Google Authenticator admin bootstrap from November 13 remains separate; mandatory MFA remains disabled pending full security enforcement review. Do not enable it as part of this release.
- Preserve all workspaces, themes, authentication, database/RLS, Resend email integration and EWP Connect iOS isolation.
- See `docs/V1_43_DEPLOYMENT.md` and `tests/V1_43_TEST_RESULTS.md`.
