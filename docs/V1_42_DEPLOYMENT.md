# V1.42 WEB — Deployment & acceptance

1. Back up the existing GitHub Pages repo and keep the V1.41 ZIP for rollback.
2. Unzip the **complete** `EWP_Management_Portal_V1_42_WEB_FULL.zip` into the GitHub Pages repo root (including `.nojekyll`); commit and push all changed files.
3. Hard-refresh the website, confirm `V1.42 WEB · Developed by Samuel Chung` on Portal and all 10 other HTML pages; verify login, nav, light/dark modes and the existing MFA staging UI.
4. Navigate **EWP Tools → Javelin vs Spruce PDF Checker**. Upload the original Javelin Main Floor and Spruce two-page Triplex PDFs privately in the browser. Expected: **7 MATCH, 0 MISMATCH, 1 MANUAL REVIEW**, one `Main Floor` section. `PSL 2.2E — 3½″ × 9½″` shows `4 × 7′ / 28 LF` on both sides, with Spruce page links **1 and 2**.
5. Verify `LSL 1.55E — 3½″ × 9½″` 1×8′ matches, and `LSL rim 1.3E` continues to show stock-feasibility review (1,056 LF ordered versus 1,042 LF listed). Export/print report and check the same counts and cross-page provenance.
6. Regression-test earlier Unit 201, Framing 209/Unit 109 and unnumbered Second Floor examples in hosted PDF.js; confirm tools, Forecast, Sales and EWP Order still open. Review all flagged stock substitutions before ordering.

**No Supabase SQL, Edge Function, Resend or OAuth changes are needed.** Staged 2FA retains its existing database state with enforcement off. The uploaded private PDFs must never be placed in a public GitHub repo. If deployment behaves differently from offline tests, collect parser/page observations without exposing account tokens or customer details.
