# V1.40 WEB — Whole-Floor (No Unit Number) PDF Checker

**Release:** November 5, 2026. **Baseline:** verified complete V1.39 ZIP. **Next:** V1.41 WEB. Developed by Samuel Chung.

## Requested correction

- The Javelin `Layout Material List Report` may have only `Level: Second Floor`, `Products`, and `Blocking` headings, with **no unit numbers**. In V1.39 all rows inherited `Unspecified section`; the new version uses the recognized floor as the comparison group. `Products`/`Blocking` remain combined at floor scope when Spruce has one floor-wide order.
- Spruce may state only an address and floor in `COMMENT`, e.g. `... - SECOND FLOOR` instead of `UNIT XXX`. Recognize a single floor heading and normalize ordinal variants (`SECOND FLOOR`, `2nd Floor`) and `Level 2` / `L2 EAST` for matching.
- Fix the `Ordered` LF column reader for comma-formatted four-digit quantities. A value such as `1,676` begins left of the previous x=320 threshold. Capture numeric tokens in the true right-aligned Ordered column, including adjacent split tokens; exclude Ordered tokens from the description. This change also supports other four-digit order quantities.
- Where one report has exactly one floor and the other has a single unlabeled section, match to that floor for comparison only. Never infer numeric unit labels or merge multiple distinct sections.
- Preserve the existing numeric unit, Framing 209/210/211, rim/blocking, material code/grade, Net Qty, cut-length, MFA staging, other tools and backend logic.

## Independent original-document verification (read-only, local)

Two source PDFs were supplied for a **Second Floor** project with no numbered units. Actual parser logic was replayed on PyMuPDF positional text (not live browser PDF.js).

| Material group | Javelin LF | Spruce LF | Local result |
|---|---:|---:|---|
| TJI 230, 11⅞″ | 1,676 | 1,676 | MATCH |
| TJI 560, 11⅞″ | 1,551 | 1,551 | MATCH |
| LSL 1.55E, 1¾″ × 11⅞″ (products + blocking) | 677 | 677 | MATCH |
| PSL 2.2E, 5¼″ × 9½″ | 18 (2 × 9′) | 0 | MISMATCH, missing in Spruce |
| PSL 1.8E, 5¼″ × 7″ | 20 (2 × 10′) | 0 | MISMATCH, missing in Spruce |

**Overall local results:** 39 Javelin material rows, 13 Spruce material lines, 14 product groups: **12 MATCH / 2 MISMATCH / 0 REVIEW**, with all groups under `Second Floor`. The two missing PSL products must be independently checked against actual order requirements before purchasing decisions; the tool does not change the PDF originals.

**Limit:** Source PDFs' text was extracted with PyMuPDF and their geometry replayed in an offline Chromium mock PDF.js reader. Actual hosted PDF.js CDN with original PDFs, Supabase, authentication, Resend, and device browser were not tested.

## Scope/safety

All 11 HTML pages include `V1.40 WEB · Developed by Samuel Chung` and updated cache references. Only PDF Checker logic/application import, HTML version tokens, documentation, and regression tests changed. Existing SQL (16 files) and protected Supabase/Auth/RLS/Edge Functions/MFA staging are byte-for-byte preserved; **no SQL migration or production project access for V1.40**. EWP Connect iOS untouched. MFA enforcement remains OFF; initial admin account confirmation/approval is pending.

## Deploy and test

1. Extract the **full** V1.40 ZIP to your GitHub Pages repo root, preserve `.nojekyll`, then commit/push. Hard-refresh the site.
2. Confirm `V1.40 WEB · Developed by Samuel Chung` appears in the footer on all pages.
3. In EWP Tools → Javelin vs Spruce PDF Checker, drop both supplied original PDFs. Confirm one **Second Floor** comparison, **12 matches**, **2 mismatches**, **0 reviews**, and the exact TJI 230/TJI 560 quantities above.
4. Confirm the two 5¼″ PSL products remain highlighted as missing. Separately regression-check the previous `109` versus `Framing 209` original PDF pair.
5. Do not commit original customer PDFs into the public repository. No SQL/Edge Function/Resend redeployment needed.

## Tests

New self-contained `tests/v1_40_checker_no_unit_regression.mjs`; copy-forward regressions `tests/v1_40_checker_section_regression.mjs` and `tests/v1_40_prior_checker_regression.mjs`; `tests/browser_checker_v1_40.py` supports a synthetic offline browser case and optional externally provided positioned-text replay. Existing beams/snow/consolidator/parser/MFA UI regressions preserved. Release verifier `tests/v1_40_release_verify.py`. See `tests/V1_40_TEST_RESULTS.md`.

**Do not recode again without an explicit user request.**
