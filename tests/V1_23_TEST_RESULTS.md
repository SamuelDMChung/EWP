# V1.23 WEB — Release QA (October 23, 2026)

## Tested / passed

- [x] Base package: complete V1.22 source; owner SVG `01_Selected` assets present, XML parses.
- [x] Nine HTML pages: all V1.23 developer credits, grouped EWP and Sales links, correct active-page link.
- [x] Eight non-root pages: brand and Portal links return to `?view=ewp` (five EWP) or `?view=sales` (three Sales).
- [x] Portal All/EWP/Sales card counts (6/3/3) with user-supplied SVG icon artwork on six cards.
- [x] Offline Chromium light/dark/mobile render; six SVG image natural widths >0.
- [x] All Sales mocked browser: reads multiple salespeople, excludes empty sales; extra Salesperson filter, Status filter and Clear filters interact correctly.
- [x] Individual Sales mocked browser: retains exact salesperson server-side filter, hides Salesperson dropdown; all mocked Supabase calls GET only.
- [x] V1.21 existing smoke: **31 assertions**.
- [x] V1.22 existing smoke: **23 assertions** including real-PDF-position fixture Sherman Road L5 HUC610 **50 total** (L3 17 / L4 18 / L5 15); no `Not Required` contamination.
- [x] All JavaScript syntax / all local relative imports, HTML asset references, SVG XML parse, HTML version credits and ZIP testzip CRC.

## Not tested / production QA required

- [ ] Real Supabase data, login, RLS, realtime, slow network, 1000+ projects pagination in production.
- [ ] GitHub Pages live deployment/HTTP asset cache, native browser network navigation; this test environment blocked real HTTP navigation.
- [ ] Outlook/Excel clipboard, PDF.js real-browser processing, native mobile Safari, NRCan API and current BCBC 2024 table completeness.
- [ ] Actual Purchasing/Inventory transaction writes (intentionally not performed).

## Deployment

Commit all files from `EWP_Management_Portal_V1_23_WEB_FULL.zip` to the GitHub Pages web repository root, including `assets/workspace-icons/`, `.nojekyll` and updated docs. Hard refresh after Pages updates. **No SQL or Edge Function deployment.** No Supabase/iOS modifications.
