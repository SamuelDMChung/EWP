# EWP Tools — V1.19 WEB

Internal hub at `ewp-tools/` linked from the Portal's **All** view (staff-labelled tile); hidden from the Portal **Sales** toggle. The visibility filter is not an authorization boundary. The current Supabase sign-in/session guard applies, but staff-only access must be implemented with roles/RLS separately if required.

## V1.19 bug fix and drop zone

- The document's `doc.destroy()` is no longer called. The supported `getDocument()` loading task (`task.destroy()`) is cleaned up in a guarded `finally` block; cleanup failures cannot erase the parsed result. The main document read is inside the `try`, so failed loads are also cleaned up.
- One-PDF drag-and-drop area highlights when a file is dragged over; Browse PDF remains available, including keyboard activation. The existing 200 MB limit, selectable-text requirement, and explicit Consolidate/Clear buttons remain. Selected files are kept entirely in browser memory.
- All page headers use the uniform `V1.19 WEB · Developed by Samuel Chung` credit.

## Consolidate Material List

`ewp-tools/consolidate-material-list/` is a browser-only PDF consolidation tool, with no database writes, storage uploads, or Edge Function calls. Accepts selectable-text Weyerhaeuser Layout Material List Report PDFs; PDF.js 6.3.289 is loaded on demand from the same CDN/fallback URLs as Forecast. Network access to one of those CDNs is required to initialize the PDF reader. Scanned PDFs are unsupported (no OCR).

Only reads `Framing Connector Summary` (material/product + Qty + manufacturer) and `Total Lengths` (material/product + summed length). It ignores all line items in `Products`, `Blocking`, `Accessories`, `Wall Framing`, etc. The parser keeps the current level and active report section across page changes, ignores page headings/footers, and combines matching product names case-insensitively. Different product name strings, even if similar, remain separate. `HGUS410 INVERTED` is intentionally separate from `HGUS410`; compatible connector rows with different manufacturers combine with manufacturer names retained.

The UI displays separate aggregated tables, optional level-by-level columns, and individual/both copy buttons. Copy is tab-delimited for Excel. Lengths are shown in linear feet; feet/inches are parsed into inches before summing so mixed-inch values are accurate. For the sample report (TC26268, 5 pages), TJI 230 11 7/8\" should consolidate to 4385 LF; HGUS410 = 69 pcs; IUS2.37/11.88 = 424 pcs.

Errors and warnings are displayed for unsupported/non-readable PDFs and text rows not matching the expected layout. Users should compare important totals against the source before ordering materials; no automatic inventory/order changes occur.

## Test steps

1. Log into the Portal; switch **All/Sales**. Verify EWP Tools tile appears only under All; New EWP Requests/EWP Order/Sales Tracking unchanged.
2. Open EWP Tools hub, then Consolidate Material List. Test a file with two or more levels and page breaks inside Products, Total Lengths, and connector summaries. Verify correct quantities and per-level breakdown.
3. Test Copy connectors / Copy total lengths / Copy both. Paste into Excel and verify separate tab-delimited columns and matching breakdown values.
4. Test PDF lacking target sections, scanned PDF, malformed/non-PDF selection and a different-size PDF. Verify explicit user-facing warnings.
5. Test both themes, mobile width, refresh, sign-out/auth redirect from the nested tool route, settings and navigation.

No V1.19 SQL migration required. Existing browser-only PDF workflow is unchanged apart from upload UI and cleanup reliability. EWP Connect iOS is unchanged.
