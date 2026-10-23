# EWP Tools — V1.22 WEB

Consolidate Material List now extracts only Qty and Product using the Framing Connector Summary's **PDF column coordinates** instead of cleaning the concatenated entire row. This excludes nailing, Filler and Web Stiffener columns, including `Not Required` notes on L5 HUC610 in the 12-page Sherman Road example. Column positions persist across PDF page breaks; unexpected formats without a detectable header skip unsafe rows and show a warning rather than guessing. Copy for Email, Copy for Excel, Download PDF, per-level options, inverted hanger normalization and Total Lengths remain unchanged. **Test report:** `tests/V1_22_TEST_RESULTS.md`. No Supabase upload or database changes. EWP and All Portal views show the tools; Sales hides them as a view preference only.

---

# EWP Tools — V1.21 WEB

- Two utilities on the hub: **Consolidate Material List** and **Snow Load Calculator**.
- Consolidate Material List prioritizes the Both Tables actions at the top and adds a paginated, client-generated **Download PDF** including per-level breakdown when selected; rich Outlook email copy and Excel TSV unchanged. jsPDF library loads on demand via CDN; material data stays local.
- Snow Load Calculator: simplified BCBC 2024 formula with custom Ss/Sr, BC listed-city lookup, 0.80 / 0.55 / custom Cb and a client-side NRCan geolocator suggestion service. **Starter city data require full cross-check against BCBC 2024: the underlying upload was from BCBC 2018.** See `snow-load/README.md` before production use. Nearest city is not automatic design approval.
- No SQL migration, no new Supabase tables or data writes. All/Sales portal visibility behavior unchanged. EWP Connect iOS unchanged.

---

# EWP Tools — V1.20 WEB

**New in V1.20:** Connector models with standalone `INVERTED` mounting orientation are consolidated with the unmodified model. Source HGUS410 69 + HGUS410 INVERTED 2 = **71 pcs**. The 5-page sample includes L2=40, L3=31. Manufacturer no longer appears in summary or copied data. Each section and the combined output provide **Copy for Email** (compact, light-bordered HTML table via ClipboardItem, with accurate plain-text fallback notice) and **Copy for Excel** (TSV). Per-level checkbox affects both screen and clipboard tables. No changes to PDF page-break continuity, local processing, authentication or other workspaces. No SQL migration required.

**Live QA required:** Paste into Outlook desktop/web compose and visually confirm cell borders, column widths, heading shading and totals; test Excel paste and level breakdown. Browser clipboard permissions/support differ across clients. See root `PORTAL_HANDOFF.md`.

---

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
