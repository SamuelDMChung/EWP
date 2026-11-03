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
