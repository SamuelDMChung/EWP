# EWP Management Portal — V1.42 WEB New Chat Handoff

**Released:** November 17, 2026. **Canonical complete WEB source baseline:** `EWP_Management_Portal_V1_42_WEB_FULL.zip` (full source, not a patch). **Next version:** V1.43 WEB. **Developer:** Samuel Chung.

## Read order before next edit

`PORTAL_HANDOFF.md` → `README.md` → `forecast/EWP_FORECAST_HANDOFF.md` → `ewp-tools/README.md` → `ewp-tools/javelin-spruce-checker/README.md` → `tests/V1_42_TEST_RESULTS.md`. Treat the V1.42 complete ZIP as canonical. Preserve all modules, workspaces, navigation, themes, Supabase Auth/RLS/DB, Edge Functions, Resend, and staged Google Authenticator MFA. EWP Connect iOS is separate and untouched. Do not recode without explicit user request.

## V1.42 task and fix

The original main-floor Javelin PDF (one page) and Spruce sales order (two pages) showed a false material discrepancy. Spruce `PSL3912 — 3½″ × 9½″ Parallam PSL` appears with **28 LF** at the bottom of page 1; grade `2.2E` and **4 × 7′** cut schedule are at the top of page 2. Some PDF.js token layouts separate these lines, producing a bogus `2.2E 4 - 7′` material (extra 28 LF) and an incomplete PSL record (missing 28 LF). A buyer/footer word could also contaminate the incomplete description.

`ewp-tools/javelin-spruce-checker/logic.mjs` now:

- Keeps a material pending across PDF page boundaries; safely associates grade-only and cut-only continuation lines with an *incomplete* prior material.
- Skips footer/payment/buyer text and rejects unsupported item-code rows without falsely closing an active material, unless a genuine ordered quantity/UM is present.
- Handles PDF.js layouts that *repeat* the prior item code on the next page, requiring same code, section, Ordered and unit, and a preceding incomplete cut list; no duplicated 28 LF.
- Suppresses exact completed duplicate rows reprinted across a page boundary; does **not** merge different cut schedules with the same product code.
- Does not fabricate cuts if the continuation is absent/ambiguous. The existing cut-total vs Ordered validation and conservative manual-review behavior remain.
- Preserves provenance for **both** source pages in the comparison UI/downloaded HTML report.
- Recognizes the `Main Floor` label in Javelin `Level: Main Floor` and Spruce `COMMENT TRIPLEX - MAIN FLOOR`, instead of `Unspecified section` (also accepts Ground/Basement Floor).

Only checker `logic.mjs`, checker `app.mjs` (module cache import), the 11 HTML page version/cache references, documentation and tests changed. All existing 16 SQL files and backend/Edge/Resend/MFA source are byte-for-byte unchanged. There are no new migrations and no V1.42 production Supabase changes. Ignore Javelin strikeouts/highlights as established in V1.35; retain explicit level-wide TJI FreeText notes and user-initiated session corrections.

## Corrected comparison, supplied Triplex PDFs

- Javelin and Spruce PSL 2.2E 3½″ × 9½″: **4 × 7′ = 28 LF on each side → MATCH**. Spruce source pages 1 & 2.
- LSL 1.55E 3½″ × 9½″: **1 × 8′ = 8 LF → MATCH**.
- LSL rim 1.3E 1¼″ × 11⅞″: Javelin finished lengths **1,042 LF**; Spruce 16′ stock **1,056 LF** → **MANUAL REVIEW**, not automatically approved for cutting feasibility.
- Other product groups: **7 MATCH / 0 MISMATCH / 1 MANUAL REVIEW** total; section labeled `Main Floor`.

Evidence: checked original PDF textual content and page geometry using PyMuPDF; replayed the positioned text through the actual portal parser and a controlled PDF.js mock in Chromium at 1320/768/390 widths. **This is not real hosted PDF.js CDN extraction**, which remains a required post-deployment check.

## Testing and deployment

Run `node tests/v1_42_checker_pagebreak_regression.mjs`, `node tests/v1_40_checker_no_unit_regression.mjs`, `node tests/v1_40_checker_section_regression.mjs`, `node tests/v1_42_prior_checker_regression.mjs`, `node tests/v1_42_beam_regression.mjs`, `node tests/v1_42_snow_regression.mjs`, `node tests/v1_41_mfa_client_regression.mjs`, `node tests/v1_29_smoke.mjs`, `python tests/browser_checker_v1_42.py`, and `python tests/v1_42_release_verify.py`. For a private original-PDF replay, extract external positioned-text JSON with PyMuPDF (do not bundle customer data) and run `python tests/browser_checker_v1_42.py --fixture /path/to/private.json`.

Deploy COMPLETE V1.42 ZIP at the GitHub Pages repository root, preserving `.nojekyll`, commit/push, hard-refresh. Verify V1.42 credits on all 11 HTML pages. Upload both original PDFs to the hosted EWP Tools PDF Checker and confirm exactly 7 matches, 0 mismatches, 1 review and the 28 LF PSL across both Spruce pages. The checker is a review aid, not an order approval.

## Staged MFA note

The initial administrator was confirmed, successfully enrolled and approved through the connected live Supabase project **after the historical V1.41 handoff was written**. Mandatory MFA still must remain disabled until protected legacy DB/RLS/storage/functions are audited and recovery tested; V1.42 does not alter auth policy or enrollment records. Do not use the historical unfilled bootstrap template now that the admin exists. Never put TOTP secrets, customer PDFs, production identifiers or SQL credentials in the public GitHub repository.
