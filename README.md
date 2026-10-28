# EWP Management Portal — V1.28 WEB

Snow Load Calculator now synchronizes **Ss and Sr values in both kPa and psf**: four fields in one compact block, automatically linked in either input direction. Custom values remain editable; selecting a BC code-table location fills both units as read-only reference values. The final S calculation uses the originally entered precision. Removed the redundant standalone Quick Unit Converter card. Formula, BC location search, Cb options, other tools and the complete Portal are preserved. All **ten pages** show `V1.28 WEB · Developed by Samuel Chung`.

**Deploy** the entire `EWP_Management_Portal_V1_28_WEB_FULL.zip` to the GitHub Pages repository root; commit/push and hard refresh. There is no SQL migration, production Supabase operation, Edge Function redeployment or EWP Connect iOS change. Read `PORTAL_HANDOFF.md` first, then `ewp-tools/snow-load/README.md` and `tests/V1_28_TEST_RESULTS.md` for exact behavior, QA limits and deployment checks. The BC location dataset's incomplete 2024 audit remains outstanding.

---

# EWP Management Portal — V1.27 WEB

**Steel Beam Lookup** is now more compact: its four synchronized imperial/metric inputs filter a **four-column W-Beam Dimensions table** (Imperial, Metric, Flange Width, Actual Depth); the oversized result card and source/page reference wording were removed. The corrected dimensioned I-beam diagram sits **beside the table** on desktop and stacks above it on narrow screens. All 196 locally bundled W sections, selection, sorting and filtering are preserved. All ten web pages show `V1.27 WEB · Developed by Samuel Chung`. Read `PORTAL_HANDOFF.md` first and `tests/V1_27_TEST_RESULTS.md` for verification boundaries.

**Deploy:** replace the full GitHub Pages repository root with the V1.27 complete source ZIP. Commit/push and hard-refresh. There is no SQL, Supabase/Resend/Edge Function or EWP Connect iOS change.

---

# EWP Management Portal — V1.26 WEB

**Steel Beam Lookup** replaces the displayed **Steel Beam Width** name under EWP Tools while retaining the prior `ewp-tools/steel-beam-width/` URL. The utility now includes the **entire 196-row rolled-W table** from the owner's Varsteel reference (imperial and metric designations, actual depth, flange width, flange/web thickness and section modulus), live prefix filtering from the first nominal-depth digit, sortable columns, clickable rows, and a dimensioned W/I cross-section diagram. The two primary dimensional outputs remain flange width and actual depth in decimal inches. See `ewp-tools/steel-beam-width/README.md` and `tests/V1_26_TEST_RESULTS.md`. All 10 HTML page credits now read `V1.26 WEB · Developed by Samuel Chung`.

**Deployment:** Upload the complete ZIP into the root of the existing GitHub Pages repository (`ewp` or `EWP-Forecast`), replacing older files. Commit, push, and hard refresh. No SQL migration or Supabase/Resend/Edge Function/iOS changes. After deployment verify the live JSON module loads, sign-in, 196 rows and two-way designation updates. The source book is a limited reference list (not every historical/current W shape); BCBC snow table audit limitation remains.

---

# EWP Management Portal V1.25 WEB

**New EWP Tools utility: Steel Beam Width.** Four linked imperial/metric designation fields map to the exact two dimensions (flange width and actual depth, decimal inches) for **196 rolled W sections** from the supplied Varsteel Reference Book (PDF pages 10–14). Visit **EWP Tools → Steel Beam Width**. Test W12×14 / W310×21 for **3.97 in flange** and **11.91 in depth**. Unlisted members are rejected; nothing is approximated. All other workspaces and the two previous tools are retained. See `PORTAL_HANDOFF.md`, `ewp-tools/steel-beam-width/README.md`, and `tests/V1_25_TEST_RESULTS.md`.

**Deploy:** copy all files in the full V1.25 ZIP into the GitHub Pages repository root, commit, hard-refresh; no SQL or Supabase deployment. Relative URLs support both `/ewp/` and `/EWP-Forecast/`. No production testing performed.

---

# EWP Management Portal — V1.24 WEB (current)

The complete **V1.24 WEB** release is built from V1.23 WEB with a dedicated **Quick Unit Converter (kPa ↔ psf)** under EWP Tools → Snow Load Calculator. It has two instantly synchronized editable numeric fields and a Clear control, visually separate from the snow-load design panel; it does **not change roof snow-load results or any other Portal module**. All nine page credits and cache versions have been updated. No SQL migration, Supabase data write, or EWP Connect iOS change. Read `PORTAL_HANDOFF.md` first for exact release changes and deployment, then `tests/V1_24_TEST_RESULTS.md` for tested versus untested environments. Next planned version V1.25 WEB.

---

# EWP Management Portal — V1.23 WEB: Sales Overview, Grouped Navigation, SVG Workspace Icons

**Canonical input:** Full `EWP_Management_Portal_V1_22_WEB_FULL.zip` source release, plus the owner's `EWP_Portal_18_SVG_Icons(1).zip` (the `01_Selected` artwork). **Release:** `EWP_Management_Portal_V1_23_WEB_FULL.zip` (October 23, 2026). **Next:** V1.24 WEB. **Scope:** WEB ONLY, no EWP Connect iOS changes.

## V1.23 approved changes

1. **Sales Project Tracking — All Sales.** Dropdown begins `Choose salesperson…`, then **All Sales**, then configured names. All Sales reads the existing `projects` table in offset/limit batches, retains only records with a nonblank assigned salesperson (including historical names no longer in Settings), and reads matching task records from `tracker_work_items` in existing 75-ID batches. It uses existing status/consolidation logic; the Sales column remains among the nine sortable columns. In All Sales mode, an additional **Salesperson** dropdown filters the downloaded rows alongside Search/Status/Phase/Type. Refresh preserves filters where possible; Clear filters resets every filter. Individual salesperson mode continues to use the server-side `sales=eq.<name>` query and hides the extra dropdown. Both modes are **read-only**, via GET requests and an existing JWT. There is no new schema, RLS or write operation. Unassigned projects are intentionally excluded from All Sales.
2. **Grouped header navigation (all nine HTML pages).** Single-line group styling on desktop: Portal | EWP (Project Tracking, EWP Forecast, EWP Tools) | Sales (New EWP Requests, EWP Order, Sales Project Tracking). Olive accent on EWP label, teal on Sales; smaller screens horizontally scroll the navigation instead of dropping links. EWP Tools is unequivocally an EWP tool. Portal logo and Portal nav item return to **`?view=ewp`** from all five EWP pages including both nested tools, and to **`?view=sales`** from all three Sales pages. Inside the Portal, Portal navigation retains the currently selected view. Portal `?view=` still controls visual card preference only, **not authorization or RLS**. Existing Sales-Portal hide of EWP Tools nav link is retained.
3. **Six owner-supplied vector icons.** Imported six `01_Selected` SVGs into `assets/workspace-icons/`; the background is embedded in each asset, so the old background tile is removed. Recolored **EWP Tools purple to olive** and **EWP Order olive to teal** to enforce the EWP vs Sales classification. All six are used on the Portal cards. Original Griff logo assets are unchanged.
4. **Branding/version:** All nine web pages use `V1.23 WEB · Developed by Samuel Chung`; entrypoint cache references upgraded to `?v=1.23`. No changes to core Forecast, Project Tracking, Purchasing/Inventory, Sales submission forms, email functions, settings, Snow Load Calculator math/data, PDF extraction, Outlook HTML/Excel TSV or material PDF exporter.

## QA / deployment boundary

- `tests/browser_smoke_v1_23.py`: actual V1.23 Sales Tracking browser JS logic with mocked in-memory GET-only database/session, navigation-URL audit on all eight subpages, and offline Chromium Portal light/dark/mobile rendering with all six SVG artwork images. Browser network navigation is disabled by the sandbox; pages are in-memory and external services are mocked — **not** a live production database / GitHub Pages / NRCan test. See `tests/V1_23_TEST_RESULTS.md`.
- The original V1.21 (31 assertions) and V1.22 (23 assertions including Sherman Road PDF L5 HUC610 50 pcs) regression suites still pass. Node syntax, all import/asset paths, credits, XML SVGs and ZIP CRC were checked.
- No SQL migration, database modification, data import, RLS/auth/Edge Function/Resend change, or native iOS modification.
- **Deploy:** Upload/replace the full ZIP contents at the root of the existing GitHub Pages WEB repo; include all `assets/workspace-icons/*.svg`, keep `.nojekyll`, commit/push, wait for Pages propagation and hard-refresh. No SQL migration or Edge Function deployment needed. Smoke-test All Sales with your real datasets, client filters/refresh/change selection, EWP/Sales portal-return links, light/dark/mobile, the six art icons, Supabase session, Forecast ↔ Tracker sync, Purchasing, material PDF/export (Sherman Road HUC610 = 50) and Snow Load Calculator/NRCan.
- **Existing snow reference limitation unchanged:** V1.21's city list came from BCBC 2018 and has not been audited row-by-row against 2024; verify code values before engineering use.

---

## V1.22 WEB latest — grouped Portal and reliable connector columns

Built from V1.21 complete source. Portal adds **All / EWP / Sales** display modes with shareable `?view=ewp` and `?view=sales`, clearly labeled three-card groups, and responsive styling. Consolidate Material List now reads connector **Qty and Product columns by their PDF text positions**, preventing unrelated `Not Required` Filler/Web Stiffener notes from becoming part of model names. The 12-page Sherman Road regression calculates HUC610 **50 pcs** (L3 17, L4 18, L5 15). All other V1.21 tools, including the Snow Load Calculator, Sales Tracking filters, Both Tables PDF export and earlier Purchasing controls are preserved. **No SQL migration, production database updates, Edge Function redeployment or iOS changes.**

For testing/deployment and precautions, first read `PORTAL_HANDOFF.md`, then `tests/V1_22_TEST_RESULTS.md`. Original V1.21 historical notes remain below.

---

## V1.21 WEB latest

V1.21 WEB is the next complete GitHub Pages source package from V1.20. New features: Both Tables Download PDF and moving combined actions to the top; EWP Tools Snow Load Calculator (BC Location / Custom, NRCan suggestion integration); read-only post-selection filters for Sales Project Tracking. Nine page credits. **No SQL migration or iOS changes.** Read `PORTAL_HANDOFF.md`, then `tests/V1_21_TEST_RESULTS.md` and `ewp-tools/snow-load/README.md` for critical BCBC data verification limits before using results in engineering work.

---

# EWP Management Portal V1.20 WEB — Full Source

**Latest WEB version:** V1.20 (October 23, 2026), based on complete V1.19 source. **Next:** V1.21. **iOS EWP Connect:** unchanged.

**V1.20:** Consolidate Material List now merges regular and `INVERTED` variants of the same hanger model; `HGUS410` is **71 pcs** across the sample levels (40 + 31). Removed the Manufacturer column; connector table shows Product / Total plus optional per-level amounts. Connector, lengths and both-sections results have separate **Copy for Email** (compact bordered HTML, with clipboard fallback) and **Copy for Excel** (TSV) controls. Copy for Email pastes into an Outlook message as a rich table when the browser/Outlook support HTML clipboard content. Current sample PDF totals and cross-page reading remain correct. Small on-screen table spacing improvements; all page credit lines updated to `V1.20 WEB · Developed by Samuel Chung`.

**Deploy:** Replace entire GitHub Pages repository root contents with this ZIP; hard-refresh all pages. **No SQL migration, Supabase updates, or Edge Function changes.** PDF processing stays entirely in the browser. Verify Copy for Email by pasting into your actual Outlook client; browser/mock tests alone cannot guarantee Outlook formatting. `PORTAL_HANDOFF.md` contains full details and regression checklist.

---

# EWP Management Portal — V1.19 WEB (Latest)

The **canonical source release** is **V1.19 WEB**, built from the full V1.18 package. This version fixes Material List PDF.js cleanup (`getDocument` loading task), adds local PDF drag-and-drop plus Browse, and standardizes `V1.19 WEB · Developed by Samuel Chung` across every workspace header. **No SQL migration, Supabase writes, Edge Function redeployment, or iOS changes** are required. Follow `PORTAL_HANDOFF.md` for deployment and sample-PDF verification. All earlier functionality is retained.

---

# EWP Management Portal — V1.18 WEB

Latest complete source release: **V1.18** (built from V1.17). New staff-visible Portal EWP Tools workspace and browser-local **Consolidate Material List** tool. Reads only Framing Connector Summary and Total Lengths from each `Level:` in Weyerhaeuser material list PDFs; handles sections spanning page breaks, sums across levels, offers optional breakdown and Excel-ready copy actions. No changes to production Supabase schema/data or Edge Functions; iOS remains unchanged. See `ewp-tools/README.md` and `PORTAL_HANDOFF.md` for operation, deployment and QA. Deploy full ZIP, not individual files.

---

# V1.17 WEB — Sales Project Tracking and Sales deep link (October 23, 2026)

**Canonical WEB source:** `EWP_Management_Portal_V1_17_WEB_FULL.zip` from V1.16. Next sequential version V1.18. Read `PORTAL_HANDOFF.md` first.

- Fifth Portal workspace **Sales Project Tracking**, present in All and Sales display modes, and accessible at `sales-tracking/`. Choose exactly one salesperson from shared `tracker_settings.sales`; the list shows the nine requested sortable fields; return using **Change Salesperson**. Uses existing authenticated shared Project Tracking data **read-only**.
- Shareable **Sales Portal** link: `https://samueldmchung.github.io/EWP-Forecast/?view=sales`. Refresh and browser history preserve All vs Sales; All retains the normal root URL. UI-only toggle; not access control.
- No V1.17 SQL migration, emails/Edge Function changes or EWP Connect iOS modifications. Keep preexisting RLS, shared Supabase and all other workspaces intact. Deploy the complete source directory to the current GitHub Pages root.

---

# EWP Management Portal V1.16 WEB

Latest release: V1.16 WEB (Oct 22, 2026), built on V1.15 full baseline. Added Duplex, Multiplex, Townhome to Tracker and Forecast project-type dropdowns and separated Follow-up filters; provides 265-project stress-test classification and incremental import-audit SQL. `PORTAL_HANDOFF.md` is the authoritative detailed handoff.

**Deployment prerequisite:** Apply V1.15 linked-color migration if absent, then V1.16 import-audit migration before any stress-test import. Never assume GitHub Pages or migrations already ran. This complete ZIP preserves all WEB workspaces, Supabase Auth, RLS, Edge Functions, Resend integration, settings and themes. EWP Connect iOS unchanged.

---

## V1.15 WEB — Linked Ticket Borders and Full-Column Dragging (October 21, 2026)

**Canonical full source:** V1.15 based on V1.14. **Next version:** V1.16. Read `PORTAL_HANDOFF.md` first.

- Entire Project Tracking columns now accept drops, including full empty column space.
- Linked tickets get the same 2px solid color border on all sides, top-right matching `Task 1/X` badge, and stable shared assignments from Supabase. Single-task and fully merged Coordination project tickets use neutral borders.
- New **mandatory incremental migration** `v1_15_tracker_linked_colors.sql` creates a restricted assignment table and an authenticated, concurrency-safe RPC. Twenty distinct colors are assigned to simultaneous active multi-task projects; a color returns to the pool after every task reaches Coordination and the project merges. A new project reuses the lowest available slot.
- **Deployment:** Make sure earlier SQL prerequisites actually ran (particularly V1.13 then V1.14 if needed); run V1.15 SQL **before** updating GitHub Pages. No Edge Function or EWP Connect iOS rebuild needed. Production testing has not been performed.

---

## V1.14 WEB — Direct PO Re-import (October 21, 2026)

**Canonical full source:** V1.14 based on V1.13. **Next version:** V1.15. Read `PORTAL_HANDOFF.md` first.

- Reimport any existing PO (active, fully received, cancelled, or removed) with the same PO #, review the warning, and click **Update PO**. Previously removed/cancelled POs reactivate automatically in the same database transaction. No manual restore needed.
- The new atomic `purchase_import_revision` RPC handles **both** new PO creation and existing PO revisions. It preserves received inventory and historical receipt links, prevents reducing an item below received LF, cancels open LF for superseded materials, and verifies optimistic version numbers.
- **Mandatory deployment:** After V1.13 Purchasing SQL has been run, execute **`v1_14_purchase_order_reimport.sql`** in the existing Supabase SQL Editor **before** deploying V1.14 website files. No Edge Function or iOS changes.
- Test a removed PO with a sample revision, a partially received PO, and stock/receiving history. SQL and production multi-user behavior require live verification. See handoff for details.

---

## V1.13 WEB — Purchasing (October 21, 2026)

**Current complete WEB baseline:** V1.13, built from V1.12. Next V1.14. Read **`PORTAL_HANDOFF.md`** first.

- Forecast → Purchasing: grouped PO cards, Open/All/Received/Cancelled filters, Remove PO / Cancel Remaining / Restore PO, Receive All Remaining, individual receipt undo or whole-batch undo, and history for completed POs. Manual/Transfer stays separate.
- Receipts and undo are atomic Postgres transactions updating both On Hand and incoming received LF. Legacy pre-V1.13 receipts have a guarded adjustment path. No changes to the EWP Connect iOS app or any Sales form/Edge Function.
- **Required before GitHub Pages publication:** back up Supabase, then run the new **`v1_13_purchasing_receipts.sql`** in SQL Editor on top of your existing V1.12 database. This is not cumulative and does not reapply V1.10–V1.12 migrations. Verify tables and test with temporary POs.
- Publish the entire ZIP as usual. No Edge Function changes. Read the detailed deployment/limitations in `PORTAL_HANDOFF.md`.

---

## V1.12 WEB — EWP Order release (October 19, 2026)

**Canonical complete WEB source:** V1.12 from uploaded V1.11. Next V1.13. Read `PORTAL_HANDOFF.md` first.

- Fourth Portal card **EWP Order** at `/orders/`; independent form and order history, preview before submitting, 8 required fields / 2 optional, automated email to `SALES_NOTIFY_TO` via Resend.
- **New EWP Requests:** Spruce Code removed; existing request and historical database values preserved. ATS remains shared with Tracking.
- **Deployment prerequisite:** run **`v1_12_ewp_orders.sql`** after V1.10 SQL. It works with or without previously running V1.11 SQL, so do **not** run V1.11 now just because it remains packaged. Deploy/redeploy **both** Edge Functions: `sales-request-email` and `ewp-order-email`. Then publish the entire web directory to GitHub Pages root.
- Shared authentication, Supabase database, Settings, light/dark theme and Tracker/Forecast algorithms unchanged. V1.3 Capacitor iOS prototype remains separate. Source build does not prove live email delivery or migration success.

See `SALES_EMAIL_SETUP.md` for step-by-step deployment and test plan.

---

## V1.11 WEB (October 16, 2026)

- New required Spruce Code and shared ATS task; New EWP Requests name; Portal All/Sales filter preserving identical two-column card sizes.
- **Deployment:** run `v1_11_sales_spruce_ats.sql` (upgrade from V1.10), redeploy `sales-request-email` Edge Function with included updated `index.ts`, then publish V1.11 web files. See `SALES_EMAIL_SETUP.md` and `PORTAL_HANDOFF.md`.
- The V1.10 historical SQL is corrected for fresh installs but must NOT be rerun in a live upgraded database. The new migration also incorporates the old SQL validator hotfix.

# EWP Management Portal V1.10 WEB — Sales Requests release

**Read `PORTAL_HANDOFF.md` and `SALES_EMAIL_SETUP.md` first.** Latest full source built on V1.9 WEB. Adds a new fourth workspace for Sales Requests; no separate iOS recode.

New mandatory form fields: Customer, Project Name/Address, Sales, Phase, at least one Task, Due Date. Optional Drawings/Attachments and Instructions. Saves submissions in Supabase; `schung@griff.ca` is the initial email **recipient**. **Real email delivery requires Supabase SQL migration + Edge Function deployment + verified Resend sending domain/secrets.** Do not assume uploading files to GitHub Pages alone makes email work. Run `v1_10_sales_requests.sql` only after previous database migrations and back up first. The original Tracker/Forecast core logic remains.

---

# EWP Management Portal V1.9 WEB — Full Source

Web-only update from V1.8. In Forecast → Projects & Materials, the project/level **Edit** buttons are removed and dates become clickable. On a **collapsed** project, click its **Next** date to edit the estimated delivery dates of all *undelivered* levels in one dialog. On an **expanded** project, click a level's date to edit *only that level*. Fully delivered levels are read-only. Changed level dates save into existing Supabase records and Entry History; material, inventory, Spruce and delivery quantities are unchanged.

Forecast's material matrix and Tracking's Follow-up project list no longer create nested vertical page scrollbars. The matrix keeps horizontal scrolling for wide materials. UI dialogs and option lists may still scroll internally when needed. Theme, shared settings, portal headers and V1.5–V1.8 workflows remain in place.

**Deploy:** Back up V1.8, then replace all website files in the GitHub Pages root with this package. Hard-refresh each page. **No new SQL is required.** Test dates, dark mode, one vertical scrollbar and shared data live before team rollout. See `PORTAL_HANDOFF.md` for tests, known constraints, version history, and deployment checklist.

---

# EWP Management Portal V1.8 WEB — Full Source

V1.8 continues directly from **V1.7 WEB**, preserving the common Supabase backend and independent task-card/Forecast workflows. This is a **web-only UI and Settings release**; the V1.3 Capacitor iOS demo is not updated.

- **Unified header:** Portal, Tracking and Forecast use the same email/sign-out, database connection indicator, Refresh and Settings actions. Forecast has no redundant header Add Project button (the Add Project tab remains).
- **Identical typography:** Shared family, header sizes, headings, navigation and control styles on all three routes, with compact data-specific sizing retained for dense tables/cards.
- **Shared Settings:** All three buttons open `shared-settings.mjs` with Appearance, Sales Names, Assignee Names and Tasks. Editing a list updates the SAME authenticated Supabase `tracker_settings` record already used by Tracker. There is no new SQL or separate Settings data store.
- **Dark mode:** Repaired Forecast matrix alternating rows, overdue schedule, inventory and purchasing warning cells, date picker icons and other contrast issues. Light mode remains available.

**Deploy:** Back up V1.7, then copy ALL files to the existing GitHub Pages repository root (including the new `shared-settings.mjs` and updated `theme.css`/`theme.js`), commit and push, then hard-refresh. **No Supabase SQL changes for V1.8.** Test a Settings add/remove on both Tracking and Forecast, status pills, dark tables and task/project operations with your live team account.

**Testing:** JavaScript syntax, static HTML IDs, isolated mocked Settings interactions and computed dark contrast were verified. Real Supabase/GitHub Pages tests could not be run in this environment. Full detail and historical migration instructions remain in `PORTAL_HANDOFF.md`.

---

# EWP Management Portal V1.7 WEB — Full Source

V1.7 is derived directly from the canonical V1.6 web source, with **unified Tracker/Forecast headers**, a **Light/Dark setting available in both workspace Settings**, and removal of all redundant Tracker board summary/count bubbles. No database changes or SQL migrations are needed if V1.6 is already deployed.

**Deploy:** Copy all files in this directory to the *root* of the existing GitHub Pages website, overwriting old files. Include `theme.js` and `theme.css` in the root. Do not replace only the HTML pages: both CSS and shared theme script are required. Keep the Supabase project/auth unchanged.

**Use:** Tracker → Settings → Appearance; Forecast → Settings → Appearance. Your choice follows navigation between these pages and the Portal on the same browser (stored locally, not in Supabase). Default is Light.

**Preserved:** Work-item drag/split/merge, Coordination statuses, project number generation, Sales/project type sync, Forecast manual/PDF imports, material/level calculations, inventories, purchasing and previous SQL archive.

See `PORTAL_HANDOFF.md` for the exact migration history, test results and protected systems.

---

# EWP Management Portal V1.6 WEB — Deployment Quick Start

**Canonical source: WEB V1.6 (October 13, 2026).** Includes Portal, Project Tracking, Forecast, shared Supabase setup, Griff branding, original historic handoffs, and SQL archive. **Next: V1.7 WEB.** The V1.3 iOS demo is not updated.

1. **Back up** your Supabase data and current GitHub Pages repository.
2. Ensure V1.4 and V1.5 one-time migrations are already installed. If not, consult `PORTAL_HANDOFF.md` and archived scripts **in order**.
3. **Run `v1_6_forecast_coordination_intake.sql` ONCE in your current Supabase SQL Editor BEFORE web deployment.** This prevents an irrelevant Assign task from being generated when Forecast creates a project already in Coordination→Delivering. It changes no existing data.
4. Upload all web files into your existing GitHub Pages **repository root**, not a versioned subfolder. Remove obsolete root SQL files from the repository if you wish to mirror the clean V1.6 layout; full historical copies are retained under `sql/archive/`.
5. Hard-refresh the portal. Test Sales choices vs Tracker Settings, SFD/Multi/Others, manual material entry, automatic Forecast→Delivering, preservation of status on Tracker-linked imports, and V1.5 task-card movement.

**Important:** Production Supabase validation remains your responsibility; browser tests were mocked and do not prove live RLS/SQL execution. The original Forecast PDF parse/PO/Spruce workflows and shared auth are retained.

For full architecture, explicit V1.6 changes, known edge cases and all historical decisions, read `PORTAL_HANDOFF.md`.

---

# EWP Management Portal V1.5 WEB — Deployment Quick Start

**Full web source** (Portal + Tracker + unchanged Forecast backend logic). V1.5 implements drag-to-Coordination work items and automatic combined project cards, with a simpler new-project task form.

1. Back up your existing Supabase database and the V1.4 GitHub Pages repository.
2. If you have not run the V1.4 compatibility SQL yet, run `v1_4_legacy_task_status_reconciliation.sql` once first.
3. **REQUIRED:** Run `v1_5_atomic_task_coordination.sql` **once** in Supabase SQL Editor. Do NOT rerun `phase2_migration.sql`, `v1_2_project_status_migration.sql` or the Forecast schema creation scripts.
4. Deploy the *contents* of this directory into the root of your existing GitHub Pages repository, preserving file paths.
5. Hard-refresh, log in, and TEST two linked tasks moved independently to Coordination; verify automatic one-card In Review merge and returning one selected task to In Progress.

**Database remains shared** with Forecast. No separate iOS release in V1.5. Live testing requires your Supabase account and is not claimed here.

For full details, known constraints, rollback considerations and past development history, read `PORTAL_HANDOFF.md`.

---

# EWP Management Portal V1.4 — WEB only

Continue web development from the V1.3 source; the Capacitor V1.3 iOS demo is not updated in this package.

**Start with `PORTAL_HANDOFF.md`.** This V1.4 Tracker release separates linked work items into independently movable Queue, In Progress and Finished Tasks cards, adds Start/Done/Reopen controls, keeps one project card in Coordination/Completed, and makes task due-date pickers inherit the project due date visibly. Forecast/Supabase source remains present and its domain calculations are unchanged.

**Deployment prerequisite:** On the existing company Supabase database, back up first and run `v1_4_legacy_task_status_reconciliation.sql` once before pushing V1.4 web files to GitHub Pages. This preserves the initial placement of V1.3 In Progress projects with old queued task rows. Do NOT run the original full Phase 2 migrations again. See the handoff for details and tests.

No changes to Forecast's SFD/Multi calculations, dropdowns, PDF-less material entry or creation-to-Coordination sync are included in this specific task-card release; those discussed changes are queued separately.

---

# EWP Management Portal — V1.3 (complete project)

Next version: **V1.4**. Root `PORTAL_HANDOFF.md` is the authoritative migration and development record. V1.3 is based on the V1.2 complete build and preserves Supabase, the full Forecast workflow, the original project-number allocator, and Follow-up.

**New in V1.3:** a clearly labeled Tracker Settings button, **Compact / Detailed** Board view switch (initial default Compact; selected view remembered in that browser), concise cards with direct Forecast links and Coordination status selection, off-plate hiding of drawing due-date/assignee in both Board views, and color-coded Coordination header pills wired to the existing Status filter. Brand styling, four Board columns and all underlying workflows remain intact. All three page mastheads show `Version V1.3 · Developed by Samuel Chung`.

**SQL for V1.3: none.** If migrating directly from a version earlier than V1.2, run the included `v1_2_project_status_migration.sql` **once before deployment**. If V1.2 is already functioning on your Supabase database, do not rerun it. Never rerun older full setup scripts during a routine version update. Back up first.

Deploy: extract the complete ZIP to the existing GitHub Pages repository root and push. Test Compact/Detailed switching, Coordination pill filtering, full card editing and direct Forecast links, Follow-up, project statuses, and Forecast imports against your production data. Automated offline tests used mock projects; live Supabase verification remains pending.

---

# EWP Management Portal — V1.2

Complete GitHub Pages/Supabase application. Two workspaces: Project Tracking and EWP Forecast.

**IMPORTANT: Run `v1_2_project_status_migration.sql` in your existing Supabase SQL Editor BEFORE deploying these files.** This is a new incremental, non-destructive one-time status migration; never rerun the historical full migrations. See `PORTAL_HANDOFF.md` for precise deployment order, architecture, protected functionality, features and tests.

V1.2 includes Griff palette across three pages; four project Board columns with In Review default when dragged to Coordination; one unified project status; existing task/assignee metadata preserved; new statuses on Board/List/Follow-up filters; subject/body separate copying and first-name-only salesperson greetings; same shared auth and version mastheads.

Full project ZIP: `EWP_Management_Portal_V1_2_FULL.zip`. Next build: V1.3. Production verification pending.

# EWP Management Portal — V1.1 (Full Source)

**Developed by Samuel Chung** · Canonical baseline: V1.0 Phase 3 · Next version V1.2.  
For full system constraints and migration history, **read `PORTAL_HANDOFF.md` first**.

## What's new in V1.1

- Two-button Portal homepage with unified shared nav; existing Supabase sign-in/sign-out retained.
- User-supplied Griff logo used for the top-left icon on Portal, Tracker and Forecast.
- Identical `Version V1.1 · Developed by Samuel Chung` mastheads across all three pages.
- Project Tracking has a **Follow-up** tab: choose one Sales person; filter projects by type, phase, status, assignee, due date or search; select individual projects or all matches; edit and copy a project-status request email listing `TC# | Client | Address`. Does not send mail.
- Defaults to open projects (not Done). Switching sales clears prior selection. Changing filters drops hidden selected projects. Board/List filters remain independent.
- **No Supabase SQL changes required**. Do not rerun existing migrations or schema setup.
- All original Forecast operational functions and existing Tracker project creation/assignment workflows remain in the ZIP.

## Install / verification

Copy the full extracted ZIP **contents** to your GitHub Pages repo root, commit/push, then open the portal URL and test using existing Supabase sign-in. The supplied `assets/` folder is required for the new navigation logo. Live-Supabase test remains pending; please verify before company-wide use.

---

# EWP Management Portal — V1.0 Phase 3 (Integrated Portal)

**Developed by Samuel Chung @ Griff**

## Phase 3 — Unified login and cross-app workflow

This release builds on the **working Phase 2.1 project-number authority fix** and the existing **Forecast V0.27** operational workflows.

- **One login at the portal**: use the existing Supabase credentials at the main homepage. That authenticated browser session is reused in Tracking and Forecast, and restored on normal refresh. All navigation stays under the same GitHub Pages origin.
- **Single sign-out**: signing out of the portal or either tool ends that browser's session. Open pages in other tabs react to a sign-out via browser storage events.
- **Direct routes**: if someone bookmarks `/tracker/` or `/forecast/` without a session, they are returned to the portal login; after signing in they can continue to the requested workspace.
- **Project # links**: Project Tracking board cards and list rows link to the Forecast project. Forecast project/level cards link back to Tracking. Direct links carry the Project # as a URL parameter and pre-filter or pre-fill the destination.
- **Tracker cloud refresh**: optional Realtime notifications for shared project/task/settings changes, with refresh on focus, across-tab notification, manual refresh, and 60-second foreground fallback. The external Supabase JS module is loaded only for Realtime. If it cannot load, all core operations still use Supabase REST.
- **Supabase session handling**: updates to shared session tokens are synchronized between tabs. Where supported, refresh is guarded by a browser-level lock to reduce simultaneous refresh-token conflicts.
- **Protected Forecast workflow**: PDF parsing, original material quantities, Last Package, Spruce/delivery logic, inventory, purchase orders, and prior data are not modified. Tracker authority on conflicting customer/sales/address values remains as in Phase 2.1.

### Installation (Phase 3)

1. Back up your existing GitHub repository (and ideally your Supabase database).
2. This release requires **no new schema migration**. Your previous successful `phase2_migration.sql` and the Forecast V0.26 schema remain valid.
3. Extract the ZIP. Copy all its contents to the GitHub repository root, replacing `index.html`, scripts, styles, and the `tracker/` and `forecast/` folders as appropriate.
4. Commit and **Push origin**, wait for GitHub Pages, then open the portal URL. Versioned JavaScript/CSS imports for Phase 3 are included to reduce stale-browser-code problems.
5. Log in once at the portal, navigate to both tools, test cross-links, create/edit a test project, refresh, and sign out. Verify both creation paths and protected forecast/delivery records.
6. **Optional**: Run `phase3_realtime_optional.sql` in Supabase SQL Editor to enable publication of Tracker tables for faster live updates between different employees. The SQL is idempotent and does not delete records. Without it, focus/refresh/foreground 60-second fallback remains active.

### Scope and limitations

- **No role-based permissions** were added. Existing Supabase RLS team-wide authenticated permissions remain; restrict Supabase accounts to intended employees.
- Realtime requires a working Supabase Realtime service and tables in `supabase_realtime`; if blocked or offline, use Refresh or reopen the tab.
- The main portal is a navigation/login surface; Tracking and Forecast retain separate interfaces and specialized statuses. One Project # links both in a single `projects` registry.
- Automated local tests include syntax/paths and simulated login / Tracker interaction. Live-company-Supabase end-to-end testing still needs your final deployment test.

## Phase 2.1 — Project Tracking is authoritative

- **Project #** matches the same shared Supabase `projects` record (case-insensitive), for projects made in either tool.
- Forecast looks up that project directly in Supabase when the user types a number and after a Javelin PDF import, pre-filling Customer, Sales, Project Name/Address and Type.
- For Tracker-managed records, those shared fields are read-only in Forecast and always use Tracker values, even when a PDF contains conflicting details. Forecast still owns Revision, dates, levels and materials.
- PDF revisions and bulk imports no longer overwrite shared Tracker-managed fields. The final save re-checks the server and requests a new review if Tracker data changed during entry.
- A Tracker-only record is linked by Project # when its first PDF is imported; subsequent imports reconcile the same project without duplicating the registry record.
- Changes saved in Tracking notify other open portal tabs; Forecast also refreshes on tab focus, Realtime notifications, or a once-a-minute foreground fallback.
- **No additional SQL:** `phase2_migration.sql` must already have succeeded. There is no new schema change in this hotfix.

## What's new

- **Portal (`/`)**: the Phase 1 landing page is retained.
- **Project Tracking (`/tracker/`)**: reads and writes shared Supabase tables instead of browser `localStorage`. Sales, task, assignee settings and saved filters are stored in the cloud. Existing Forecast-only projects appear in the Tracker's Queue with an `Assign task` work item.
- **EWP Forecast (`/forecast/`)**: the V0.27 Spruce, PDF, inventory, and purchasing calculations are preserved; PDF intake now pre-fills known Sales/Customer details from the shared project record. Both tools use the same `public.projects` table. Existing Tracker projects are found by project number when importing their Javelin PDF in Forecast.
- **Project numbers**: new Tracker records use `TCYYXXX`; the number is issued atomically on the server for the default automatically proposed number. A manually chosen suffix must still be unique. PDF-imported project numbers that don't use this format are preserved.
- **Login**: Tracker uses the existing Forecast Supabase authentication session in the same browser origin. It can also show its own Supabase sign-in form. A redesigned portal-wide login is reserved for Phase 3.
- **Safety**: no destructive migration. Tracker cannot delete projects with existing Forecast levels. Edits protect against stale project versions. Work-item status and material-delivery status stay independent.

## Deploy in this order

1. **Backup** your Supabase database and GitHub repository before migrating.
2. In your *existing* Supabase project's SQL Editor, execute **`phase2_migration.sql`**, found in the root of this ZIP. This requires the existing EWP Forecast V0.26 schema. Run it **before** deploying the Phase 2 frontend. The migration is transaction-wrapped and creates tables, indexes, triggers, and RPC functions. If it refuses to proceed because duplicate project numbers exist, resolve the duplicates first; do not delete random records to work around it.
3. Unzip the release and copy its contents to the GitHub Pages repository root. **Do not simply copy the `tracker` folder**. Keep the portal, `forecast/`, `tracker/` and root CSS together. Existing files from Phase 1 may be replaced. Commit and push.
4. Wait for Pages and open your existing portal URL, then `/tracker/`. If you've signed into Forecast in the same browser origin, Tracker should use that session. Otherwise sign in with the same Supabase account.
5. Check Settings to confirm the recovered sales list; add missing sales/assignees/tasks. Create a dummy TC project in Tracker. Open Forecast and import a PDF for its number; confirm the forecast connects to the same record. Confirm task and Spruce statuses are independent.

**There is no need to rerun `forecast/supabase_v0_26.sql`** if it is already installed. Run only the root `phase2_migration.sql` for this release.

## Important limitations

- The previous Tracker's browser-only saved projects/settings are **not imported automatically**. They might still exist in the original browser profile/origin, but an automatic migration could accidentally conflict with newer shared records. Any lost browser-only settings can be recreated in Tracker's new cloud Settings. The migration recovers Sales names found in existing Forecast projects.
- No direct access to a live company Supabase instance was available during development; SQL must be run and validated in your project. JavaScript syntax and static package checks were completed, but live end-to-end tests still need to be done after migration. This is an integration test build.
- Sharing still follows the existing Supabase model: authenticated users have shared access to the company's project records. Fine-grained department/role permissions are not part of Phase 2.
- Tracker refreshes from Supabase when loaded, on window focus and via the Refresh button. Full real-time Tracker subscriptions, unified portal authentication, and further cross-app navigation are Phase 3 tasks.
- A project with an existing EWP level cannot have its number changed or be deleted from Tracker, to prevent breaking PDF matching or delivery history.

See `PORTAL_HANDOFF.md` for technical handoff details and `forecast/EWP_FORECAST_HANDOFF.md` for protected Forecast calculations and workflow rules.
