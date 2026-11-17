# EWP Management Portal V1.42 WEB — Test Results

**Date:** November 17, 2026. **Baseline:** V1.41 complete WEB ZIP; verified archive CRC before extraction. Only local source/fixture testing; no production writes.

## What was fixed

Spruce order `2611-C12366.pdf`: `PSL3912` description and Ordered **28 LF** occur on page 1; its grade `2.2E` and cut breakdown **4 × 7′** occur on page 2. The prior parser could flush the row at a page break or misinterpret the page-two grade/cuts as a new product. Footer/buyer tokens could also contaminate the pending description. The new parser preserves incomplete records and reconstructs product/cut data across pages, prevents duplicate ordered quantities, and tracks source pages. Recognizes `Main Floor` as a valid unnumbered section.

## Regression results

- V1.42 dedicated synthetic page-break cases: **24 assertions PASS**, including no repeated-code and repeated-code continuations, exact duplicate removal, different-cut retention, footer suppression, missing-cut warnings, page provenance, and no false material mismatches.
- V1.40 unnumbered floor/large Spruce order: **24 PASS**.
- V1.40 Framing 209/Unit 109 separation and Microllam normalization: **24 PASS**.
- Earlier Javelin/Spruce parser/annotation regression: **54 PASS**.
- Steel Beam Lookup: **29 PASS**; Snow Load: **40 PASS**; Multi-File Material Consolidator: **32 PASS**; Google Authenticator MFA request path regression: **23 PASS**.
- Browser checker: **4 synthetic viewports and 4 private positioned-text PDF replays PASS**, 1320px light/dark, 768px light, 390px dark, using the real portal JavaScript parsing/rendering but a mocked PDF.js reader.
- Source release preflight: see `v1_42_release_verify.py` for 11 credits, JS syntax, local HTML links, import targets, 16 unchanged SQL files, and protected backend file hashes versus V1.41.

## Independent source-PDF check

The original Triplex Javelin and Spruce PDFs were read using PyMuPDF text geometry and their positions replayed through the browser checker. **7 MATCH / 0 MISMATCH / 1 REVIEW** across eight material groups. The PSL 2.2E 3½″ × 9½″ is **4 × 7′ (28 LF)**, compared correctly between Javelin p.1 and Spruce pp.1–2; adjacent LSL 1.55E 3½″ × 9½″ 1 × 8′ also matches. The separate rim-stock case is deliberately **MANUAL REVIEW: 1,042 LF listed cuts, 1,056 LF ordered in 16′ stock**. Preserve this warning until a person confirms cutting feasibility and waste.

## Limitations / post-deployment gates

- **The hosted native PDF.js 6.3.289 CDN implementation was NOT executed** here: external CDN access is unavailable. The browser replay is controlled/mocked PDF.js, not real browser text extraction of the original PDF bytes. Perform a hosted original-file end-to-end check after deployment; visually confirm cut rows and PDF page links.
- No tests against live Supabase Auth, Edge Functions, Resend, GitHub Pages caching, or any customer orders. No production SQL or 2FA enforcement change.
- Do not include source customer PDFs, positioned-text private fixtures or TOTP secrets in the public release ZIP. Scanned PDFs still require manual review.
- V1.41 real MFA-client browser sequence with simulated REST at **1280px and 390px passed** (no 405 request), carried forward without MFA code changes.
