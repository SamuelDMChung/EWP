# Continue EWP Management Portal — V1.34 WEB (November 3, 2026)

## Canonical baseline

Use `EWP_Management_Portal_V1_34_WEB_FULL.zip` as the **complete canonical WEB source**. Next release V1.35 WEB. Read `PORTAL_HANDOFF.md` first, then `README.md`, `forecast/EWP_FORECAST_HANDOFF.md`, relevant EWP Tools documentation, and `tests/V1_34_TEST_RESULTS.md`. Do not recode until expressly requested. Preserve all other WEB workspaces, Supabase auth/RLS/database/Edge Functions/Resend, purchasing, navigation, themes, developer credits, and EWP Connect iOS separately.

## V1.34 fixes relative to V1.33

1. **Fix Javelin strikeout/TS3 row confusion:** Browser V1.33 screenshot had 3 PSL-related exclusions, missed Unit 201 LSL `TS3 1 × 11′`, and incorrectly retained neighboring `P5 2 × 7′` PSL. Root failure reproduced by reversing annotation PDF Y-coordinates. New PDF.js adapter retains raw + viewport-converted rectangles, and row matching selects the best-consistent orientation **across the complete document**. When tied and conflicting, no automatic row exclusion. Still requires unique, substantial 2D row overlap. Meaningful `All joists 230, TYP. this level` FreeText note and row strikeouts still applied. Ordinary highlights completely ignored.
2. **Remove technical comparison diagnostics:** The Javelin/Spruce line counts and yellow parser review/warning section (second screenshot) no longer render or export. Uncertainty in parsing is retained in internal QA warnings, not counted as user-facing review. Real material mismatches, missing/excess cut chips, and stock/cut feasibility reviews remain.
3. **Unit 201 expected:** 1 × 11′ Javelin TS3 matches 1 × 11′ Spruce LSL. `P5` intentionally crossed out; Unit 200 adjusted PSL also matches. Rim 233 LF shortage remains a mismatch.

## Test notes

70 Node assertions; four offline responsive Chromium scenarios with intentionally inverted annotation frames; 29 Steel, 40 Snow, 32 Consolidator, 23 historical Parser assertions; original PDF geometry inspected with pypdf/PyMuPDF in both orientation assumptions. All 11 page credits, JS syntax, imports, HTML paths and 14 retained SQL/protected backend verified. **Actual CDN PDF.js live processing was NOT tested**, nor production GitHub Pages/Supabase/print/Outlook. User should deploy and test real uploaded PDFs to confirm results before ordering. The real customer PDFs are intentionally excluded from the public WEB ZIP.

## Deployment / release discipline

Deploy the **full** V1.34 ZIP over the current GitHub Pages source root, commit/push and hard-refresh `?v=1.34`. No incremental SQL, Edge Functions or Resend redeploy. Test unit 200 and 201, all 6 PSL P5 exclusions, rim mismatch, review count, manual restore, highlights, HTML/print; spot check other workspaces and desktop/mobile themes. Do not access or mutate production Supabase without explicit authorization and checking permissions first. All future releases require a complete source ZIP, updated handoff, testing results, release notes, developer credits on all pages, deployment steps and SQL only if needed.
