# V1.30 WEB — verification and known limitations

**Baseline:** `EWP_Management_Portal_V1_29_WEB_FULL.zip`; all existing source modules carried forward.

- `node tests/v1_30_smoke.mjs`: 27 sample-grounded parser and annotation assertions. Uses fitz-derived, positioned-text / annotation fixtures from the four source PDFs, not a screenshot/OCR guess.
- `python tests/browser_smoke_v1_30.py`: Chromium offline checks for desktop/light and mobile/dark; file selection, automatic comparison, issue counts, report download, source rows / manual review, responsive layouts, no page JavaScript exceptions. **PDF.js itself is mocked**, so this does not prove CDN loading, native PDF parsing or browser print output.
- Standard pair expected: 16 exact matching material groups; one confirmed mismatch — 353 LF Javelin rim requirement vs 352 LF Spruce 16′ stock.
- Annotated pair expected: FreeText applies TJI 230 on Level 4 only; whole-row strikeouts exclude six PSL P6 rows totaling 10 pieces (70 LF); 24 matching material groups; zero definite mismatch; one unresolved rim stock-length review. Web stiffeners/backer blocks excluded on both files.
- The existing V1.21, V1.22 and V1.29 PDF consolidation tests, W-beam lookup and Snow Load calculator tests should remain intact. The V1.29 test files contain prior-version credit expectations; version-specific copies for V1.30 are provided.
- All source/import paths, 11 page credits, ZIP CRC, SQL unchanged checks are verified by V1.30 release verification.

**Deployment smoke:** real live PDF.js, annotated PDF FreeText/StrikeOut geometry, source PDF viewer links, mobile Safari and Outlook/PDF-print behavior require a post-deployment check; **do not treat the local fixture run as production verification.** Also the pre-existing Snow Load Calculator's BCBC 2024 city table still awaits full row-by-row audit.
