# V1.43 WEB Test Results — November 17, 2026

**Baseline:** complete V1.42 WEB source ZIP, verified CRC. All testing is read-only/offline. No production Supabase change.

## Change / original source documents
- Javelin p.1 M2: `1 3/4" x 7 1/4" 2.0E Microllam LVL`, Net Qty 11, cut 9′ = **99 LF**.
- Spruce p.3 LVL714: `1-3/4" X 7-1/4" MICROLLAM LVL 2`, Ordered **99 LF**, `11 - 9′`.
- Previous V1.42: `LVL|2.0|1.75|7.25` vs `null` key → false extra/missing 99 LF.
- V1.43: canonical `LVL|2.0|1.75|7.25` on both → **MATCH**, no extra or missing. Explicit different grades still distinct; unknown grades not silently inferred.

## Automated tests
- V1.43 LVL focused parser tests: **26 assertions PASS**, including decimal/mixed/vulgar fractions, explicit different/contradictory/missing grades, parser and one-product comparison.
- V1.43 carried-forward Spruce page-break: **24 assertions PASS**.
- V1.40 unnumbered-floor regression: **24 assertions PASS**; V1.39 Framing 209 regression: **24 PASS**.
- Prior checker regression: **54 assertions PASS**.
- Steel Beam Lookup: **29 PASS**; Snow Load Calculator: **40 PASS**; Google Authenticator MFA client: **23 PASS**.
- **244 assertions passed in these eight executed Node suites.** Historical consolidated-material tests are preserved but were not rerun in this release.
- Offline browser test: 4 synthetic viewports + 4 source-PDF position replay viewports (1320 light, 1320 dark, 768 light, 390 dark): LVL 99 LF labeled MATCH.
- Full source preflight **PASS**: 11 credited HTML pages, 99 JS syntax checks, 199 local HTML links, 138 JS imports, all 16 SQL files and protected backend source unchanged from V1.42. ZIP integrity verified separately after packaging.

## Replay of the two uploaded original PDFs
Text positions extracted with PyMuPDF from the user's uploaded PDFs and fed into the actual JavaScript parser; an offline browser mock returned **11 MATCH / 1 MISMATCH / 1 REVIEW**. The distinct remaining blocking mismatch/review are outside this change's scope. No customer PDF or positional replay was packaged.

## Limits
- **This is NOT live PDF.js verification:** browser tests used a simulated PDF.js text reader. Retest original PDFs through hosted PDF.js after deploying.
- No production Supabase, Auth, Edge Functions, GitHub Pages cache, Resend, or EWP Connect iOS tests; no backend updates.
