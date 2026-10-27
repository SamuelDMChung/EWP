# Steel Beam Width — V1.25 WEB

The **third EWP Tools utility**, `ewp-tools/steel-beam-width/`, uses a static, local `w-sections.json` reference file with **196** W sections transcribed from the **Varsteel Reference Book**, PDF pages 10–14 (printed wide-flange pages 4–8). It is a lookup, not a physics/unit conversion approximation.

## Inputs and results

- Imperial (ASTM): **Nominal depth (in)** and **Weight (lb/ft)**, for example 12 and 14.
- Metric (Canadian): **Nominal depth (mm)** and **Mass (kg/m)**, for example 310 and 21.
- A complete, valid pair automatically fills the other two values. Inputs are linked in both directions; suggestions are based on table entries. Other pairs are not touched until a valid matching section is found.
- Only outputs: **Flange width (bf)** and **Actual depth (d)**, decimal inches, 2 decimal places. W12×14 / W310×21: **3.97 in** and **11.91 in**.
- Blank/invalid/unlisted values never retain stale dimensions. Clear empties all fields. No database access/write is performed.

## Scope and source

This covers **all 196 rolled W beams listed in this supplied Varsteel book**, W4 through W36, **not** every historical or newer W section. S sections, welded wide-flange WWF and HP piles are separate tables and are excluded. Source PDF is not bundled; fact data, source page references and extraction reproducibility helper `tests/extract_varsteel_w.py` are included.

## Manual test after GitHub Pages deployment

1. Sign in through the Portal; choose EWP and open EWP Tools → Steel Beam Width.
2. Enter 12 then 14 on Imperial side. Verify Metric shows 310 / 21 and 3.97″ flange, 11.91″ depth.
3. Clear and enter 310 then 21 on Metric side. Verify reverse fields and matching dimensions.
4. Enter a nonexistent section (e.g. W12×999), confirm the outputs clear and a warning appears.
5. Check listed datalist suggestions, Clear, dark theme, phone layout, Portal EWP link, and breadcrumb to EWP Tools.
6. Check the other two tools remain fully functional. No SQL or Edge Function deployment required.
