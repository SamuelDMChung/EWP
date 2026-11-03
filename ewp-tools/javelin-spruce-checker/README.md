# Javelin vs. Spruce PDF Checker — V1.32 WEB (current)

**Materials:** Interpret *only the original PDF page text*. All PDF annotations/markups are treated as review-location metadata only, not instructions. **Do not automatically exclude crossed-out PSL P6, alter TJI grade from FreeText notes, change quantity or material based on highlights or comments.** Any such changes must be made by the user in the existing session-only correction panel after opening the PDF.

**Review flags:** The source PDF annotation **type, rectangle and page number** are used to flag overlapping original material rows. The markup **contents are never read as material data**. Review badge with page/plot and original-PDF page link appears even when base cuts match. Unattached markings or failed annotation metadata create page review warnings. Markups on both source types are monitored. This may produce many reviews if the PDF was heavily highlighted, by design.

**Cut differences:** For non-stock rows, differences are computed separately for each nominal cut length and quantity. Example: Unit 200 PSL 2.2 3½×9½ shows `Missing 2 × 7′ (14 LF)` while other matching lengths stay neutral. Missing cuts red, surplus cuts amber. Print/Save PDF and exported HTML retain discrepancy and markup notes. Standard stock-versus-cut review and conservative LF shortage logic are unchanged.

**Unit 201 regression:** Base Javelin `TS3` LSL 1.55E 1¾×9½ is 1×11′ and Spruce `LSL1912` is 1×11′. The Javelin highlighted TS3 row is **MANUAL REVIEW** (not automatically matched), and the adjacent marked P5 row must not make it disappear. A crossed-out P5 remains part of the *base* expected material until session correction.

**Limits:** Selectable-text Javelin/Spruce layouts only. Native annotations may be missed if flattened into page contents or scanned/handwritten; no OCR. The offline Chromium test uses a controlled fake PDF.js reader, while the separate real-PDF local verification used PyMuPDF token geometry, not live browser PDF.js. Verify live PDF.js, page links, annotation placement and PDF exports on deployment. Do not upload original customer PDFs to public Pages repository. Other workspaces and Supabase unaffected.

---

# Javelin vs. Spruce PDF Checker — V1.31 WEB

**Upload:** Drop the two documents into the **same box**, select both from Browse PDFs, or add one and then the other later. The app detects Javelin versus Spruce by the PDF's actual headings and column structure, not the filenames. Each accepted file appears under Javelin or Spruce with Remove. A new PDF of an already-occupied type asks before replacing the previous file; unchanged duplicates are skipped by actual byte comparison. An ambiguous type is shown for manual Javelin/Spruce assignment rather than silently guessed. PDFs are read locally, with a serial queue and per-page cancellation checks.

**Dimensional fix:** Mixed fractions, hyphenated fractions, decimal inches and Unicode vulgar fractions match properly across TJI/LSL/PSL. For instance, `1-3/4 × 9-1/2`, `1 3/4 × 9 1/2`, `1¾ × 9½` and `1.75 × 9.5` identify identical LSL dimensions. Check grade, width and depth, not just approximate LF.

**Stock handling:** In Rim and Blockings, a longer stock allowance than Javelin's finished cuts is **MANUAL REVIEW REQUIRED** rather than an automatic cut mismatch. Stock shorter than the conservatively calculated minimum required LF is a definite **MISMATCH**, even when a row contains a multi-ply warning. LF sufficiency alone never certifies the cutting pattern, waste or kerf. Exact unit cut schedules still compare by piece length and quantity.

**Latest three sample pairs:** Standard L3D1: 16 match, 1 mismatch (rim shortage 353 vs 352 LF). Annotated L4 East: 24 match, 0 mismatch, 1 stock review with explicit level-wide joist-grade overrides and full-row struck PSL P6 exclusions. New L3 East: 30 match, 1 mismatch (1¼ × 9½ LSL 809 vs 576 LF), 1 review (1¾ × 9½ LSL 66 vs 306 LF); corresponding individual units match. Both web stiffeners and backer blocks are ignored.

**Privacy and verification:** PDF processing is browser-local. Reduced, non-commercial regression fixtures ship in tests; no original source PDFs. The Chromium UI regression mocks the external PDF.js reader, so actual browser PDF.js behavior and non-structured/handwritten annotations must be checked on deployment. No new Supabase tables, migrations or AI services.

---

# Javelin vs. Spruce PDF Checker — V1.30 WEB

This tool is the fourth card in EWP Tools. It performs an **in-browser, deterministic** comparison of a selectable-text Weyerhaeuser Javelin Layout Material List Report and a Griff Spruce sales-order PDF. No materials, customer data or annotations are uploaded to Supabase, transmitted to AI services, or persisted. Supabase authentication is inherited from the existing EWP Tools workspace. Does **not** write to existing projects, orders, or purchasing.

## Supported initial formats

- Javelin unitized Layout Material List pages, including tables continuing across pages, Net Qty, Plies, Plot ID, level, section, piece length, material grade, and dimensions.
- Spruce order rows using `Ordered` and `UM` (LF/PC), multiline product descriptions and `quantity - cutting length` breakdowns, comment headings for unit/section, and continued cut lines across page boundaries. Does not treat Sold/Remain/Price/Taxes/Delivery as additional materials.
- The checker **always excludes web stiffeners and backer blocks**. Other unsupported codes generate a review warning rather than being silently counted as matched.
- Explicit FreeText *"All joists 230, TYP. this level"* changes TJI grade **only for that level**. Grade-only strikeouts are not deletions. Whole-row StrikeOut markup excludes the affected material row; highlight alone has no effect. Other FreeText and ambiguous/multi-level markups require manual review. The original Javelin source record remains available in memory.
- `MATCH`: same unit, normalized product (TJI/LSL/PSL grade, nominal width/depth), cut-length quantity breakdown, total LF; `MISMATCH`: definite missing/excess/wrong cuts/products, or stock shortage. Stock substitutions with sufficient LF remain `MANUAL REVIEW REQUIRED`, since cut feasibility/kerf cannot be proven by LF alone.
- Sample 1 (TC25280 vs 2610-C09329) yields **16 matching product-unit groups and one mismatch**: 353 LF expected for 1¼ × 11⅞ LSL rim, 352 LF ordered as 22 × 16′ stock.
- Sample 2 (TC26203 vs 2610-C08021) yields **24 matching product-unit groups, 0 definite mismatches, 1 stock review** after changing joist grades to TJI 230 and excluding **6 crossed-out P6 rows, 10 pieces / 70 LF**.

## UI

Select or drop the Javelin and Spruce PDFs independently; comparison starts as soon as both are present. Show issues/all/matches/mismatches/reviews, text search, expandable unit-by-product evidence with both PDFs' page numbers. Open original PDFs for human inspection. Session-only Javelin correction panel can exclude/restore rows or change quantity/TJI grade, but overrides are **not** written back to the source PDFs. Results update on correction. Download a standalone HTML report; Print/Save PDF uses browser print dialog.

## Important limitations

- PDFs must have selectable text. No OCR is included. **Scanned, flattened or handwritten annotations are not reliably interpretable** and must be checked manually. The tool does not certify all annotations are visible as structured PDF objects.
- Geometry of PDF.js text tokens and annotation rectangles varies between export versions. Unknown layouts, overlapping marks, conflicting grade notes or partial data should remain review items rather than auto-corrected.
- Only initial Weyerhaeuser TJI 230/360/560 thickness mappings are known from the sample sales orders. Other product families/grades need source-based validation before auto-matching.
- Piece-length comparisons use nominal cutting quantities; cutting feasibility from stock pieces is **never** automatically approved, even if LF seems sufficient. User must independently confirm saw kerf, waste, and delivery scope.
- Current version's browser run was exercised against positioned-text/annotation fixtures extracted from all four uploaded source PDFs, with a fake PDF.js reader; full production PDF.js CDN, browser PDF rendering, real-order trials and Outlook/export remain to be checked after deployment. Browser output is an aid to review, not approval of an order.

## Deploy / QA

Deploy the complete WEB ZIP unchanged to GitHub Pages (`/ewp/` or the still-valid relative-path repository), hard-refresh, authenticate, open EWP Tools and choose the fourth card. Run both supplied PDF pairs with the live PDF.js reader: verify counts, exact 353→352 LF mismatch, no false TJI grade mismatch in Aria, six struck P6 rows omitted, backer blocks/web stiffeners ignored, PDF links, live filters, user corrections, print/save and report HTML. No SQL migration or Edge Function update needed.
