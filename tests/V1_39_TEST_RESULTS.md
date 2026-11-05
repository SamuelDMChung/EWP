# EWP Management Portal WEB — V1.39 Test Results (November 5, 2026)

| Check | Result | Interpretation |
|---|---|---|
| Baseline V1.38 complete ZIP integrity | PASS | 245 files and archive CRC |
| Section/Framing 209 + LVL regression | PASS | 24 synthetic Node assertions; `109`/`209`/`210`/`211`, Spruce bracketed UNIT number, LVL code + grade normalization, Net Qty and cuts |
| Prior checker regression | PASS | 54 assertions, unchanged L3/L4 behavior; no automatic strikeout exclusions |
| Real uploaded Javelin/Spruce positional extraction | PASS (offline) | PyMuPDF extraction with actual checker logic. 82 Javelin rows / 38 supported Spruce lines; 109 independent, all nine framing 209 product groups match, 212 LVL LF each |
| Steel Beam Lookup | PASS | 29 assertions; source untouched |
| Snow Load Calculator | PASS | 40 assertions; source untouched |
| Multi-PDF Material Consolidator | PASS | 32 assertions; source untouched |
| Earlier connector parser | PASS | 23 assertions; source untouched |
| Checker Chromium browser smoke | PASS | 4 offline mocked PDF.js cases (1320 light/dark, 768 light, 390 dark); source UI logic exercised |
| V1.38 staged MFA Chromium UI smoke | PASS | Mocked authentication at 1280/390 px; no live enrollment |
| Full WEB release verifier | PASS | 11 version-stamped HTML pages, JS syntax, local assets/imports, unchanged auth/SQL/backend hashes |
| Live CDN PDF.js on user originals | NOT TESTED | Required post-deployment, especially for text token coordinate/heading alignment |
| Hosted Supabase/Email production integration | NOT TESTED | No production write or sign-in performed in V1.39 |

## Specific result

The original Javelin page 2 section `framing 209 (110-114)` and Spruce page 4 comment `FRAMING 209 (UNIT 110-114)` now both normalize to section `209`. The matching Microllam LVL 2.0E 1¾ × 5½ cut list is **1×12', 11×7', 2×6', 11×5', 14×4'**, 212 LF on each side; the group is **MATCH**, not a false Unit 109 missing-material error.

Net Qty remains the piece count; Plies is not an extra multiplier. Informational multi-ply notes remain in underlying detail but identical verified cutting lists are not automatically designated as an uncertain mismatch or review solely for that reason.

**Known remaining limitations in this specific PDF pair:** Spruce `EA` stock rows (for 20-foot lengths) are not handled by this version's LF/PC reader, and named corridor/stair headings outside numeric/framing sections have not been generalized. Other apparent mismatches may be parsing artifacts, not actual order shortages. This release focuses narrowly on the reported Framing 209 bug plus LVL identity.

All original customer PDFs were analyzed outside the public project ZIP and **are not bundled**. Offline fixtures cannot be described as live PDF.js testing.
