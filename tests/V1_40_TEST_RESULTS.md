# EWP Management Portal V1.40 WEB — QA (November 5, 2026)

| Check | Outcome | Caveat |
|---|---|---|
| Canonical V1.39 ZIP verified before extraction | PASS | ZIP CRC and original 252-file inventory |
| New no-unit floor/large-order regression | PASS | 24 synthetic Node assertions |
| Earlier 109 / Framing 209/210/211 regression | PASS | 24 assertions; grouped-unit behavior preserved |
| Prior PDF Checker and markup regression | PASS | 54 assertions; strikeouts/highlights remain ignored |
| Real original PDFs with positioned text | PASS (offline) | 39 J rows / 13 S lines / 14 groups; 12 match / 2 mismatch / 0 review; all grouped Second Floor |
| TJI 230 / TJI 560 with comma-formatted Ordered LF | PASS (offline) | 1,676 and 1,551 LF matched; original source PDF text geometry |
| Browser at 1320 light/dark, 768 light, 390 dark | PASS | 4 synthetic and 4 private actual-position fixture scenarios; browser UI, download, overflow; PDF.js mocked |
| Steel Beam Lookup | PASS | 29 assertions; unchanged |
| Snow Load Calculator | PASS | 40 assertions; unchanged |
| Material Consolidator | PASS | 32 assertions; unchanged |
| Earlier connection parser | PASS | 23 assertions; unchanged |
| Full-source preflight | PASS | Source integrity, 11 HTML stamps, local refs, imports, unchanged Auth/RLS/Edge/Resend/MFA/SQL |
| Production browser via CDN PDF.js | **NOT TESTED** | Required post-deployment using actual PDFs |
| Production Supabase Auth / email / RLS | **NOT TESTED** | No production access or data changes |

## Source-derived results

Javelin and Spruce contain a **floor-wide Second Floor** list without numbered units. Local corrected comparison: 12 exact matches, two apparent missing-in-Spruce PSL material groups, no general parsing warnings. The two flagged groups are **2 × 9′ PSL 2.2E 5¼″ × 9½″ (18 LF)** and **2 × 10′ PSL 1.8E 5¼″ × 7″ (20 LF)**. The Javelin contains both while the inspected Spruce material list does not. Confirm with the material order before making purchasing decisions.

No original project PDFs, full extracted text payloads, customer-identifying screenshots, or private URLs are shipped in the public ZIP. The offline real-PDF check used a local PyMuPDF span replay, **not live PDF.js**.
