# EWP Management Portal — V1.33 WEB Test Results

Date: 2026-11-03. Canonical source: V1.32 WEB complete ZIP. Scope: PDF Checker annotation handling + version credits/cache only. No production access or changes.

## Passed suites

| Command | Result | Coverage |
| --- | --- | --- |
| `node tests/v1_33_smoke.mjs` | **46 assertions** | Grade FreeText restored, 6 PSL strikeouts, per-row geometry, adjacent TS3 safe, highlights ignored, existing red/amber precise cuts, manual restore, L3/L4 pairs |
| `python tests/browser_smoke_v1_33.py` | **4 scenarios** | 1320px light/dark, 768px light, 390px dark; real UI and parser JS with **simulated PDF.js**; upload, duplicate, removal, replacement, filtering, HTML export, no script exceptions/overflow |
| `node tests/v1_33_beam_regression.mjs` | **29 assertions** | Steel lookup original feature/data retained, V1.33 HTML stamps |
| `node tests/v1_33_snow_regression.mjs` | **40 assertions** | Snow load/paired pressure converter unchanged, V1.33 page stamps |
| `node tests/v1_29_smoke.mjs` | **32 assertions** | Multi-PDF material consolidator unaffected |
| `node tests/v1_22_smoke.mjs` | **23 assertions** | Connector parser and page-break behavior unchanged |
| `python tests/v1_33_release_verify.py` | **Passed** | 11 HTML credits, all local paths and JS syntax, backend/SQL hash ledger, no shipped customer PDFs, ZIP baseline scope |

## Source-pair results

**L3 East Javelin + Spruce:** **30 matches, 1 mismatch, 1 review**. Six geometry-aligned whole-row P5 strikeouts excluded. Unit 200 PSL 2.2E 3½×9½: Javelin 21 LF after exclusion = Spruce 21 LF (MATCH). Unit 201 LSL 1.55E 1¾×9½: Javelin TS3 1×11′ preserved despite adjacent P5 strikeout; Spruce 1×11′ (MATCH). Ordinary highlight above TS3 does nothing. Real Rim/Blockings LSL 1¼×9½: 809 LF Javelin vs 576 LF Spruce (233 LF definite shortage), MISMATCH. Rim 1¾×9½ stock substitution remains REVIEW. Restoring Unit 200 P5 in session correctly displays `Missing 2 × 7′ (14 LF)` in red.

**Level 4 annotated fixture:** **24 matches, 0 mismatch, 1 review**, with explicit TJI 230 level note and six PSL P6 full-row exclusions correctly applied. Highlights do not alter results.

**Independent original-PDF geometry:** Real user-supplied 3-page Javelin and 5-page Spruce PDFs were read with **PyMuPDF**, using source text-span heights and annotation rectangles rather than fixture coordinates. Their geometrical comparison reproduced the L3 counts and both unit outcomes. A check with only bottom text anchors (without heights) gave incorrect row assignments; this exposed a critical edge case which V1.33 corrects by using PDF.js item height/baseline-aware geometry. This validates independent geometry processing **but is not live browser PDF.js QA**.

## Remaining verification / limitations

- The offline Chromium harness substitutes its fake PDF.js loader with positioned-text fixtures. **External CDN PDF.js and actual browser text/annotation coordinates have not been run with real PDFs.** Confirm on deployed GitHub Pages before production ordering use.
- No live Auth/RLS/Resend/Edge Function integration tests, actual PDF export/print-dialog, Outlook workflows or multi-user actions. They were not modified.
- Flattened, scanned, handwritten, or unusual PDF annotations cannot be guaranteed; ambiguous strikeouts deliberately remain un-applied with a targeted warning. Extra stock LF does not certify a feasible cutting pattern.
- Snow location table's BCBC 2024 source audit is still outstanding from older releases.

## Deploy / regression checklist

1. Back up the existing Pages repository; extract the **entire** `EWP_Management_Portal_V1_33_WEB_FULL.zip` at its root, commit/push, hard-refresh `?v=1.33` assets.
2. Authenticate; upload the original Aria L3 PDF pair in the hosted browser, confirm exact six P5 exclusions, Unit 200 MATCH (21 LF each), Unit 201 MATCH (11 LF each), real rim shortage, one stock review, no highlighting-created warnings, and accurate filters/HTML download/print output.
3. Test the L4 annotated pair for explicit level-wide TJI 230 and six P6 exclusions, without highlights creating flags. Try a manual Restore on a crossed-out piece and verify red missing cut count.
4. Check EWP/Sales Portal toggle, Forecast, Tracking, Purchasing/Inventory, Order/Request, Snow, Beam and Consolidator, desktop/mobile dark/light themes in a read-only session.
5. No SQL migration and no Edge Function or Resend redeployment. EWP Connect iOS untouched. Never upload customer PDFs into public Pages repository.
