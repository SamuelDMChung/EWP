# Consolidate Material List — V1.29 WEB

This EWP Tools page reads selectable-text Weyerhaeuser Layout Material List PDF reports entirely in your browser. Only **Framing Connector Summary** (Qty and Product columns) and **Total Lengths** are included. Weyerhaeuser report Products/Blocking/Accessories and nailing, Filler/Web Stiffener columns are excluded. PDF page breaks must not end an active level or summary section. Standalone INVERTED hanger orientation is normalized to its base model; distinct model suffixes remain separate.

## Workflow

1. Click **Add PDFs** to choose multiple files, or drag/drop one or more into the zone. The tool begins processing immediately, one document at a time. Further uploads append instead of replacing earlier files.
2. Watch **Queued → Processing → Included in totals** for each source. The two combined tables refresh as files finish. There is no Consolidate button. Each individual file must be <=200 MB; real-browser memory constraints still apply, and PDF.js is currently loaded from CDN.
3. The file list provides **Remove** (exclude that source from totals without re-reading all others), **Clear All**, **Retry** for failed files and **View this PDF's materials**. When a recognized project number and framing level conflict with an already included file (or an identical filename overlaps levels when project identifiers are unavailable), a candidate revision is **excluded pending Include anyway** or Remove. This check does not replace a technical check for duplicate levels across different plan areas, or reports missing a Project #.
4. Identical file bytes (SHA-256 digest) are excluded automatically even if their names differ. A changed revision is not necessarily an exact binary duplicate and must be reviewed separately.
5. The **Both tables** controls remain first: Copy for Email (rich bordered HTML if allowed), Copy for Excel (TSV), Download PDF. Individual-table copy controls and optional quantity/length by level remain available. Each file's own breakdown can be expanded independently.

## Privacy and implementation

- PDFs are read and processed locally. No files, parsed materials, calculated totals or hash fingerprints are uploaded to Supabase or a private server.
- Successful files retain only parsed material rows and a content fingerprint in tab memory, not their original bytes. Refreshing the browser clears the session list.
- The original PDF.js CDN loader remains unchanged. Scanned PDFs without text cannot be read. PDF exports use existing jsPDF CDN on demand.
- `multi-file.mjs` merges already-parsed results and detects overlapping project/level entries. `parser.mjs` continues to be responsible for column-accurate material extraction and includes an optional cancellation signal.
- Any repeated level names across **different projects** aggregate under one level heading in the combined per-level columns; inspect each source's separate breakdown when reviewing multi-project work.

## Regression and validation

See `../../tests/V1_29_TEST_RESULTS.md`. The 12-page Sherman Road fixture, split across four PDFs, must yield **HUC610 50 pcs** (L3 17, L4 18, L5 15). After removing L4 the total becomes 32. Confirm real-world PDF page-break handling, Outlook copy and browser-native PDF download on deployed GitHub Pages before using for procurement.
