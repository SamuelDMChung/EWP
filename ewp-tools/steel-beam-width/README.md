# Steel Beam Lookup — V1.27 WEB

- **Four inputs**: Imperial nominal depth (in) + weight (lb/ft), or Canadian metric nominal depth (mm) + mass (kg/m). Editing either complete designation pair fills the other, automatically filters the table, and updates dimension labels. Unlisted pairs show a warning, not guessed dimensions.
- **Only four displayed table columns**: Imperial, Metric, **Flange Width bf (in)**, **Actual Depth d (in)**. Table header sorting, row click/keyboard selection, Clear and first-digit depth prefix filtering retained across all 196 W shapes from the user-supplied Varsteel Reference Book (PDF pp. 10–14). The source JSON still stores other engineering fields for provenance but the interface does not display them.
- The single **I-section illustration is beside the table** on desktop and stacked above on mobile. Dimension lines use dedicated extension lines and triangles to avoid marker overlap. Labels show actual bf/d upon selection; drawing is **not to scale**. Large separate results panel, PDF/page attribution and extended disclaimer are no longer visible.
- **Example:** W12×14 ↔ W310×21 → bf **3.97 in**, d **11.91 in**; W12×50 ↔ W310×74 → bf **8.08 in**, d **12.19 in**. Only rolled W sections in the supplied book are supported; not a structural design calculator.
- **Compatibility:** Existing `ewp-tools/steel-beam-width/` path and all other tools, auth/data/settings stay unchanged. No SQL or deployment of functions needed. Read `tests/V1_27_TEST_RESULTS.md`; live production HTTP/JSON and authentication require post-deployment verification.

---

# Steel Beam Lookup — V1.26 WEB

**Display name** was changed from Steel Beam Width. The URL remains `ewp-tools/steel-beam-width/` intentionally to preserve links and navigation. This is the third EWP Tools utility. It is a browser-only static reference lookup, not a structural-design calculator or unit-conversion formula.

## Inputs and main outputs

- Four editable inputs: imperial W nominal depth (in) and weight (lb/ft), or Canadian metric nominal depth (mm) and mass (kg/m).
- Typing the **first nominal-depth digit** immediately filters the full reference table under the form. Entering weight/mass narrows the rows further; an exact matching pair synchronizes all four input values. Clicking any beam in the table fills both designation systems, selects its row and updates the graphic.
- Two main outputs only: **flange width (bf)** and **actual depth (d)** in decimal inches (2 decimals). The accompanying labelled I-section SVG cross-section shows the same two dimensions and is **not to scale**. Empty or unlisted pairs never show guessed values; Clear resets all fields, table filters, sorting, dimensions and diagram.
- Example: Imperial **W12×14** ↔ Metric **W310×21**; flange **3.97 in**, depth **11.91 in**.

## Full W-section table

The reference panel includes all **196** rolled-W sections in the user's Varsteel Reference Book (PDF pages **10–14**, printed pp. **4–8**), with **Imperial, Metric, actual depth, flange width, flange thickness, web thickness and section modulus**. The header is sticky, sortable numerically (including by designation), and horizontal scroll is available on narrow screens. Source data are bundled in `w-sections.json`; `tests/extract_varsteel_w.py` regenerates the full dataset from the user-supplied PDF.

**Exception:** The Varsteel table leaves the W30×90 section-modulus value empty; we display `—` instead of manufacturing a value. All 196 existing V1.25 designation pairs and measured flange widths and depths were retained. WWF welded beams, S sections and HP piles are intentionally excluded. This covers the supplied catalog's 196 rolled W shapes, not every W section ever made. Verify with supplier and current structural references for design-critical use.

## QA / deployment

- `tests/v1_26_smoke.mjs`: 47 assertions; `tests/browser_smoke_v1_26.py`: desktop/mobile light/dark with actual UI and module logic injected in an offline Chromium page; `tests/V1_26_TEST_RESULTS.md` contains expanded QA. No live GitHub Pages, production Supabase or HTTP-module-fetch smoke was possible here.
- Deploy the **complete** V1.26 WEB ZIP to the existing GitHub Pages repo root, commit/push, hard-refresh. Check All/EWP Portal → EWP Tools → Steel Beam Lookup, live JSON load of 196 rows, W12 filter, W310 filter, both designation pairs, row click, sorting, diagram labels, themes/mobile, and other tools. No SQL/Edge Function updates required.
