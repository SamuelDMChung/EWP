# Continue EWP Management Portal — V1.35 WEB (November 3, 2026)

## Canonical baseline

Use `EWP_Management_Portal_V1_35_WEB_FULL.zip` as the **complete canonical WEB source**; next version **V1.36 WEB**. Read `PORTAL_HANDOFF.md` first, then `README.md`, `forecast/EWP_FORECAST_HANDOFF.md`, EWP Tools README and `tests/V1_35_TEST_RESULTS.md`. Do not recode without explicit user instructions. Preserve all other WEB workspaces, Supabase auth/database/RLS, Edge Functions/Resend, purchasing, settings, navigation and themes; EWP Connect iOS remains separate. Never access or mutate production Supabase without checking connection/permissions and receiving authorization.

## V1.35 specification — overrides V1.33–V1.34 annotation behavior

- **No automatic whole-row strikeout handling at all.** The entire geometry/orientation/exclusion pipeline was removed. The Javelin parser includes every original material row, irrespective of visual markup. Highlights, annotations and crossed-out marks have no effect on material inclusion or status.
- Explicit **FreeText TJI grade note** (e.g. `All joists 230, TYP. this level`) still applies only to that level. Unknown/ambiguous FreeText does not rewrite rows.
- Users manually select **Exclude → Apply** for confirmed struck material under `Inspect or correct Javelin material lines (session only)`; restoring and editing quantities/TJI grade remain. No data uploaded to DB; only browser session state.
- Real per-length shortage/surplus chips remain red/amber; material-only mismatch cards and stock/cutting reviews remain; **no yellow parser diagnostic panel or extraction counts**.

## Expected original example

Unit 201 LSL TS3 1¾ × 9½ 1.55E: Javelin `1×11′` versus Spruce `1×11′` = **MATCH** even if surrounding PSL is struck/highlighted. Unit 201 PSL P5 `2×7′` stays in raw Javelin and is a **14 LF MISMATCH** until manually excluded. Unit 200 PSL P5 `2×7′` likewise is missing 14 LF until manually excluded. Rim/blocking LSL 1¼ × 9½ 809 vs 576 LF remains a 233 LF shortage. L3 offline controlled fixture result: **27 MATCH / 7 MISMATCH / 1 REVIEW**. Annotated L4 fixture: **21 MATCH / 6 MISMATCH / 1 REVIEW**, with TJI 230 grade notes applied but PSL P6 strikeouts ignored.

## QA and limitations

54 Node smoke assertions, 4 offline responsive Chromium app flows (mock PDF.js), 29 Steel, 40 Snow, 32 Consolidator, 23 legacy parser, plus all 11 page credits, source syntax/paths/imports and protected SQL/backend hash verification. Independent original-PDF text geometry via PyMuPDF also identifies Unit 201 TS3 and the intended mismatch outcomes. **Real PDF.js CDN/browser file extraction still unverified** (restricted runtime network); fake PDF.js is not equivalent. Customer PDFs are not in ZIP. Read `tests/V1_35_TEST_RESULTS.md` for specifics. No production Supabase accessed and no SQL/Edge/Resend changes.

## Deploy

Replace GitHub Pages repository root from complete V1.35 ZIP, including `.nojekyll`; commit/push, hard-refresh `?v=1.35`. Authenticated browser: upload original PDFs, verify 201 LSL MATCH, 201/200 PSL mismatches until manual exclusions, rim shortage, ignored highlights and no yellow technical block; test filters, HTML export, print, responsive themes and other workspaces. Do not publish customer PDFs. **No SQL migration or backend redeployment**. Next release should include another complete ZIP, current handoff, all-page credits, QA and deployment notes.
