# V1.24 WEB — Release Validation (October 27, 2026)

## Verified locally

| Scope | Result | Evidence |
| --- | --- | --- |
| Converter exact ratios, roundtrip, edge cases and form events | PASS — 30 assertions | `node tests/v1_24_smoke.mjs` |
| Offline browser interaction in light and dark, 1350/390 px viewports | PASS — 4 scenarios | `python tests/browser_smoke_v1_24.py` |
| Converter visually a separate card below snow-load calculation | PASS | HTML/layout assertion + Chromium bounding-box check |
| Does not mutate Ss, Sr, Cb or calculated snow load S | PASS | Node DOM mocks and browser retained result text |
| Previous V1.21 smoke regression | PASS — 31 assertions | `node tests/v1_21_smoke.mjs` |
| Previous V1.22 PDF parser regression | PASS — 23 assertions | `node tests/v1_22_smoke.mjs` |
| Sherman Road 12-page report HUC610 | PASS — 50 pcs total, L3 17/L4 18/L5 15 | V1.22 position-based fixture |
| JS syntax and relative module imports | PASS | Node `--check` and path inventory |
| All nine pages and assets | PASS | HTML credits and asset/path inventory |
| Complete ZIP CRC and file count | PASS | `ZipFile.testzip()` |

## Important testing boundaries

- The test harness loads the actual converter UI script into Chromium after replacing its one `KPA_TO_PSF` module import with that same unchanged constant. This is necessary because container policy blocks loading local/file/web origins in the browser. The UI and CSS are the same as production, but this **does not constitute real live site or browser module-loader integration testing**.
- Supabase reads/writes, production auth/RLS, existing email/Resend flows, live NRCan suggestions, Outlook clipboard, and GitHub Pages deployment were **not tested**. **No production database, Edge Function, or iOS source changes were made**.
- The built-in snow location list is still not fully validated against the BCBC 2024 code table. Always confirm the Ss/Sr values for engineering use; the unit converter itself is a purely physical unit conversion, not a roof design calculation.

## Deployment + real-browser verification

1. Replace the entire WEB repo root contents with the V1.24 full ZIP and commit/push to GitHub Pages; preserve `.nojekyll`.
2. Hard-refresh and open **EWP Tools → Snow Load Calculator**. Scroll beneath the main snow-load result to locate the independently bordered Quick Unit Converter.
3. Type `1` in kPa; expect **20.8854 psf**. Type `1` in psf; expect **0.04788 kPa**. Test 0, decimals, negative values and Clear. Confirm changing the converter never changes the roof snow-load S shown above.
4. Verify signed-in navigation, light/dark and mobile, current GitHub Pages route, code-city/NRCan search, Sales Project Tracking All Sales + filters, HUC610 PDF totals, and the Forecast/Purchasing flows.
5. No SQL, Supabase, Edge Function, Resend or EWP Connect changes required.
