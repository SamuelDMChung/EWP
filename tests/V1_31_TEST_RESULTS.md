# V1.31 WEB — Testing & Deployment Notes

Release candidate: November 3, 2026. Based on `EWP_Management_Portal_V1_30_WEB_FULL.zip`.

## Automated source tests (passed)

| Test | Result | What was actually verified |
| --- | --- | --- |
| `node tests/v1_31_smoke.mjs` | **61 assertions** | Fraction/decimal/Unicode normalization for TJI, PSL, LSL; PDF format detection; exact material checks on three paired PDF samples; non-applicable material exclusion; new UI element integrity |
| `node tests/v1_31_prior_checker_regression.mjs` | **27 assertions** | Standard and Aria L4 annotation comparison, grade overrides, crossed P6, prior tool features |
| `node tests/v1_31_beam_regression.mjs` | **29 assertions** | Steel Beam Lookup mapping and source preserved, 196 W sections and two output columns |
| `node tests/v1_31_snow_regression.mjs` | **40 assertions** | Snow Load Calculator kPa/psf conversions, custom input and BC lookup behavior, pages/cache stamps |
| `node tests/v1_29_smoke.mjs` | **32 assertions** | Multiple-PDF material consolidator and duplicate/revision safeguards preserved |
| `node tests/v1_22_smoke.mjs` | **23 assertions** | Material connector Qty/Product geometry, Sherman Road HUC610 and page-break regression |
| `python tests/browser_smoke_v1_31.py` | **4 Chromium scenarios** | Actual V1.31 application UI JS with controlled PDF.js reader in light/dark 1320px desktop, light 768px tablet and dark 390px mobile. Includes bulk uploader, incremental drag/drop, byte duplicate exclusion, explicit replacement, removal, unrecognized type requiring manual selection, results/export and absence of browser JS errors |
| `python tests/v1_31_release_verify.py` | **Passed** | 11 HTML credits, 55 JS syntax checks, 199 relative HTML references, 80 relative module imports, 14 SQL hashes unchanged; no raw PDFs in release and sanitized test fixtures |

## Three checked sample pairs — positioned-text fixtures

- `TC25280 — L3D1` / `2610-C09329`: **16 match / 1 mismatch / 0 review**. 1¼ × 11⅞ LSL rim requires 353 LF versus 352 LF stock.
- `TC26203 — L4 East` / `2610-C08021`: **24 match / 0 mismatch / 1 review**. TJI 230 level-wide override and 6 crossed PSL P6 rows (10 pieces) excluded. 1¼ × 9½ rim stock requires cutting review.
- `TC26203 — L3 East` / `2610-C03464`: **30 match / 1 mismatch / 1 review**. Rim 1¼ × 9½ LSL = minimum **809 LF** required vs **576 LF** in ordered stock (233 LF short; may be greater if multi-ply requires more physical pieces). Rim 1¾ × 9½ LSL = **66 LF** of finished pieces vs **306 LF** ordered (240 LF surplus), under manual stock review; all checked individual-unit 1¾ LSL schedules match.

The checker does not certify that enough gross LF can be cut into the needed pieces; physical cut feasibility, kerf, waste, mixed revisions and delivery scopes still need human review.

## Limitations requiring live verification

- Browser interaction tests use PDF.js **test fixtures from positioned text and annotation data**, *not* live PDF.js reading the original PDF files in a hosted browser. The external PDF.js CDN, real PDF.js geometry, annotation extraction across exports, PDF-object links, download/print behavior, and all customer layouts must be validated after deployment.
- No OCR or AI: handwritten/flattened/unknown annotations can escape detection; compare against originals and keep uncertainty in MANUAL REVIEW REQUIRED.
- No production Supabase login/data migration/Edge Function testing was performed; source was kept unchanged in the relevant areas.
- The Snow Load Calculator's earlier BCBC 2024 location-data row audit remains incomplete.

## Deployment steps

1. Back up the currently deployed GitHub Pages WEB repo (V1.30 if deployed) before replacing anything.
2. Extract the **full V1.31 ZIP** into the repository root (normally `https://samueldmchung.github.io/ewp/` following the repository rename). Keep `.nojekyll`, the entire `/ewp-tools/` tree, SQL history, all modules and assets.
3. Commit and push the complete source, wait for the GitHub Pages deploy status, then hard-refresh / clear stale cached modules.
4. Test the new one-box checker using the three actual Javelin/Spruce PDF pairs, both simultaneously and incrementally. Compare grade overrides, stock shortages, surplus/review, and same/unknown document types. Confirm button exports, browser print/Save PDF and dark/mobile UI.
5. Verify Portal All/EWP/Sales navigation; auth, Tracker→Forecast sync, Sales Project Tracking filters, Purchasing, live multi-PDF consolidation and other existing EWP Tools against actual production data in a read-only workflow.

**No SQL migration, Edge Function redeploy, Resend adjustment or iOS Xcode build is required.** Production Supabase records were not changed while developing V1.31.
