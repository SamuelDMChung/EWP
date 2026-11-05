# EWP Management Portal WEB — V1.39 New Chat Handoff

**Canonical complete WEB source:** `EWP_Management_Portal_V1_39_WEB_FULL.zip` (November 5, 2026). **Next version: V1.40 WEB.** Developed by Samuel Chung.

## Scope and background

V1.39 is based on the full, verified V1.38 WEB ZIP. The user uploaded an actual Weyerhaeuser Javelin L2 East `Layout Material List Report` and corresponding Griff Spruce `Order` PDF. The PDF Checker showed *Framing 209* Microllam LVL 2.0E 1¾ × 5½ under unit *109*, falsely reporting 212 LF missing. This is a parser error, not a source-document error.

**Root causes found in V1.38:**

1. Javelin `parseJavelin()` only recognized standalone numeric section headings (e.g., `109`); it **did not recognize** `framing 209 (110-114)`, so subsequent records inherited `109`.
2. Spruce `sectionName()` parsed `FRAMING 209 (UNIT 110-114)` as `110`, because it matched the parenthetical `UNIT` number before the leading `FRAMING` number.
3. Spruce material code parser did not accept `LVL512` and `productSpec()` did not normalize `Microllam LVL`, causing separately missing/misidentified LVL material records.
4. Identical cuts were unnecessarily labeled REVIEW just because Javelin contained a two-ply line, even though Javelin **Net Qty is already the final piece count**. The informational multi-ply note is retained, but identical normalized non-stock cuts are allowed to MATCH.

**Fixes:** Normalize leading `framing 209 (110-114)`, `framing 210 (115)`, `framing 211 (116)` headers to 209/210/211 in Javelin. In Spruce comment parsing, prefer `FRAMING 209` to the parenthetical `UNIT 110-114`, likewise for 210/211. Recognize `LVL...` Spruce item codes; canonicalize `2.0E MICROLLAM LVL` product dimensions/grade alongside Javelin. Keep 2-ply informational notes without inventing a review when all cuts and specs match. Old plain `109` headings remain unchanged.

## Original source-PDF findings (local read-only verification)

- Javelin page 2: `109` is one section, followed by `framing 209 (110-114)` with LVL M1, M2, M3-2, M4, M6-2, M5; page 3 includes `framing 210 (115)` and `framing 211 (116)`.
- Spruce page 3 has `L2 EAST - UNIT 109`, page 4 has `FRAMING 209 (UNIT 110-114)`, page 5 has `FRAMING 210 (UNIT 115)`, and page 6 has `FRAMING 211 (UNIT 116)`.
- Framing 209 Microllam LVL 2.0E 1¾ × 5½ is **212 LF on both reports**, cut schedule: `1 × 12', 11 × 7', 2 × 6', 11 × 5', 14 × 4'`. The final 4' count combines Javelin `M6-2` 2 pieces and `M5` 12 pieces.
- Local reconstruction from the **real customer PDFs** using PyMuPDF positional spans with the actual parser: 82 Javelin rows, 38 supported Spruce rows; 109's three material groups match; **all nine 209 groups match**, and 210/211 groups remain separate. These are cross-engine offline checks, **not live PDF.js**.
- Other areas still require inspection. This release deliberately does not extend the Spruce parser to interpret `EA`-unit 20-foot stock or named `corridor`/`stair` comments; the real original-pair offline run still reports other groups as mismatches. Do not mistake those for confirmed shortages without reviewing source PDFs.

## Preserved from V1.38

Complete GitHub Pages WEB source, 11 HTML workspaces/pages; Portal, Sales/Orders, Project Tracking, Forecast, Purchasing, inventory, EWP Tools, settings/navigation/themes; Supabase Auth/database/RLS, Edge Functions, Resend; original 2FA staging SQL, MFA QR enrollment, administrator UI and private RPC endpoints. **MFA enforcement remains OFF and no administrator was assigned** in the last verified production staging state; this release neither changes that status nor grants roles. Employee/Sales data and EWP Connect iOS are untouched. V1.36 SharePoint file request remains removed from the WEB UI per V1.37.

## QA and deployment

`tests/v1_39_checker_section_regression.mjs` tests 24 new synthetic scenarios. `tests/v1_39_prior_checker_regression.mjs` retains 54 prior assertions. Offline Chromium checker smoke (4 widths/themes), MFA mocked UI (2 widths), steel beam (29), snow load (40), material consolidator (32), older parser (23), release source preflight all pass. See `tests/V1_39_TEST_RESULTS.md`.

**Deploy:** Replace the GitHub Pages project root using all files from the complete V1.39 ZIP, preserve `.nojekyll`, push and hard-refresh. Confirm footer says `V1.39 WEB · Developed by Samuel Chung` on every HTML page. Sign in and run the exact two uploaded original PDFs **through live hosted PDF.js**. Verify `109` contains only its source unit materials, Framing `209` LVL is 212 LF vs 212 LF MATCH, and `210`/`211` stay separate; check all remaining warnings manually before ordering. PDF inputs must not be committed to public GitHub. **No SQL, auth, RLS, Edge Function or Resend migration is required for V1.39. No production project was accessed or modified for this release.**

**Limits:** The standalone browser relies on external PDF.js CDN; offline tests use mocked reader or PyMuPDF-based positional text rather than live PDF.js. The portal is not guaranteed correct for scanned PDFs, unusual formatting, annotations, alternative unit patterns or EA stock. See the full source handoff and tests; do not infer live production QA from fixture results.

**Do not recode again without an explicit request.**
