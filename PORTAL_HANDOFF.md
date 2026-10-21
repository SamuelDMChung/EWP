# EWP Management Portal — V1.13 WEB Purchasing Upgrade

**Release:** `EWP_Management_Portal_V1_13_WEB_FULL.zip` (October 21, 2026).  
**Canonical input:** V1.12 WEB full source ZIP. **Next WEB version:** V1.14.  
**Scope:** WEB only; no changes to EWP Connect iOS, existing iOS prototype, shared sales workflows, Tracking, or Forecast material/delivery algorithms.

## V1.13 approved improvements implemented

1. **PO-grouped Purchasing view:** Imported purchase orders appear as expandable parent cards with all their material lines. Open, Partially Received, Received, Cancelled Remaining, and Removed are clearly distinguished. Filter between Open (default), All, Received, and Cancelled/Removed. Fully received POs remain accessible with their receipt history. Manual/Transfer incoming is kept in a separate group.
2. **Remove/Cancel PO:** When no quantities have been received, *Remove PO* soft-removes the full imported PO, cancelling all its remaining lines without deleting the historical header/material metadata. When a PO has receipts, *Cancel Remaining* closes only the outstanding incoming; already-received amounts and On Hand remain intact. A fully received PO cannot be removed without first undoing receipts. A *Restore PO* action returns cancelled incoming LF to Open without modifying On Hand. This is intentional audit-preserving 'remove', not irreversible database row deletion. The PO number remains reserved to prevent accidental duplicate imports. To re-import, restore the PO first.
3. **Receive All Remaining:** One confirmation previews each outstanding material and its LF; one Postgres RPC transaction receives every open line and atomically increases each inventory On Hand balance. Receiving one line also uses an atomic RPC, replacing the fragile V1.12 two-step browser writes.
4. **Receipt ledger and undo:** New `purchase_receipt_batches` and `purchase_receipt_lines` tables record each new receipt and its lines. Undo individual lines or all remaining lines in a batch; reversal deducts On Hand, reduces received LF, records a reason, and fails/rolls back entirely if there is insufficient On Hand or another invariant fails. Receipt history remains visible even for completed POs. Same flow supports Manual/Transfer receipts.
5. **Historical receipts:** Any received LF created BEFORE V1.13 has no per-batch ledger, so it is identified separately as *Undo Legacy*; a guarded adjustment accepts LF and reason, can never subtract new ledger-tracked receipts, and checks On Hand. It is recorded in existing activity history. The old receipt's original exact time/batch cannot be reconstructed.
6. **Forecast integration:** Open incoming LF excludes cancelled LF. Existing Stock Owed, Projected Balance, and incoming-by-lead-time calculations continue to recalculate using this corrected Open LF. No project-level delivery or Spruce figures are altered.
7. **Preserved:** Portal, Tracking/Coordination, Forecast project imports/levels, shared Supabase RLS and sign-in, Sales requests, EWP Order, Edge Functions/Resend, and light/dark appearance. Only `forecast/app.mjs`, `forecast/db.mjs`, `forecast/index.html`, `forecast/styles.css`, HTML version/cache markers and release docs are touched by this update. No email Edge Function redeployment or iOS rebuild required for the Purchasing feature.

## Mandatory deployment order

**Back up the existing Supabase database and GitHub Pages repository first.** Ensure your **V1.12** schema/workspaces are in place; V1.13 is an *incremental* migration, not a replacement for prior setup. Never run archived cumulative SQL against the active database.

1. Run **`v1_13_purchasing_receipts.sql`** in the **existing Supabase project** via SQL Editor **before publishing the V1.13 site**. It adds PO status and cancelled LF columns, receipt history tables, authenticated read policies, and 5 atomic RPCs (`purchase_receive`, `purchase_reverse_receipt`, `purchase_reverse_legacy`, `purchase_close_po`, `purchase_restore_po`). Does not erase existing POs, receipts or inventory. SQL transaction rolls back if a statement fails.
2. Confirm the SQL succeeds: `select to_regclass('public.purchase_receipt_batches'), to_regclass('public.purchase_receipt_lines');` Verify both populated with table names. Optionally confirm new columns in Table Editor and RPCs via Supabase Dashboard. Do not manually edit new receipt tables.
3. Publish **all V1.13 WEB source files** to the existing GitHub Pages root, including new `forecast/` assets and updated cache-busting references. Hard-refresh the site.
4. With TEST material/PO data: (a) import PO with two or more materials; receive one line then use Receive All for remaining; (b) verify On Hand and received/open LF match; (c) undo one receipt line, then undo the rest of its batch; (d) verify On Hand and open incoming return; (e) remove a never-received PO, confirm it disappears from Open but appears under Cancelled/Removed; restore it; (f) partially receive another PO then Cancel Remaining, verify received On Hand is preserved; (g) verify historic pre-V1.13 Undo Legacy and nonnegative-stock protection with safe test data; (h) verify Received filter and Entry History.
5. Regression: Inventory availability and Stock Owed; project Forecast PDF import/level dates/deliveries; Tracking task-card flow and shared Settings; two Sales forms plus Resend notifications; light/dark and mobile. If new receipt tables fail to load, ensure you ran SQL first and hard refreshed the frontend. Supabase Edge Functions do **not** change in V1.13.

## Concurrency and limits

- Receipt, reversal, close and restore are single-server Postgres transactions with authenticated RPC access, row locks and quantity checks. Any failure rolls back its entire transaction, including inventory updates and receipt lines.
- Existing unrestricted authenticated direct PATCH capability on inventory and purchase rows remains from the old app to preserve manual inventory editing and legacy compatibility; therefore the new ledger does not eliminate the need to coordinate manual stock adjustments with incoming receipt reversals. Receipt reversal is intentionally refused if available On Hand would go negative.
- Import/update of an *existing* PO still uses the preserved V1.12 browser-side revision path (non-transactional across multiple rows), and should not run concurrently with receiving the same PO. The new bulk receive and undo paths are atomic; revision imports are not changed in this release.
- Legacy receipts are not backfilled into guessed per-batch records. The guarded legacy adjustment can be used only after checking original stock history and available On Hand.
- PO removal means reversible soft-archive. No existing PO/source file or historical receipts are physically purged. Cancelled/removed PO numbers cannot be reused as a new PO until restored.
- SQL and new Supabase RPCs have **not** been executed on the user's production database in this release; browser tests were isolated with mocked data. Live multi-user concurrency / RLS / data migration must be tested during deployment. Treat V1.13 as complete WEB source **pending production validation**.

---

# EWP Management Portal — Canonical V1.12 WEB Handoff

**Release:** `EWP_Management_Portal_V1_12_WEB_FULL.zip` (October 19, 2026).  
**Canonical source:** V1.11 WEB full ZIP supplied by user. **Next:** V1.13 WEB.  
**Scope:** WEB only. V1.3 Capacitor iOS remains a separate prototype and was not changed.

## V1.12 changes

1. **New EWP Requests:** Remove mandatory Spruce Code field from its form, payload, Submission History and Resend notification. Preserve existing `sales_requests.spruce_code` values/column if V1.11 SQL had been deployed. No other request requirements, attachment storage, task selection or history/email retry behavior should change. Its server-side `sales_validate_request()` no longer requires Spruce Code.
2. **Fourth Portal workspace: EWP Order** (`orders/`) fills the reserved bottom-right Portal slot. **All** shows Tracking, Forecast, New EWP Requests and EWP Order (two columns); **Sales** shows the two Sales workspaces in equal half-width cards on desktop. Shared navigation added on all five routes. Shared Supabase sign-in, header, Settings and light/dark styling continue.
3. **EWP Order fields in required order:** Layout Status (Reviewed / Not Reviewed - Proceed with liability on Customer), Spruce Code, Jobsite Address, Level, Ship Date (calendar), Ship Time (every 30 minutes 6:00 AM through 5:00 PM inclusive), Truck Type (COS / LR HIAB / Regular HIAB / Customer Pick-up), PO# (optional), Authorized Buyer, Special Notes (optional). All others mandatory; **Layout Status has no preselected default**. Special Notes placeholder is exactly `Enter floor sheathing, glue, exclude dropped header/posts here. Please be explicit.`
4. **EWP Order submission:** Browser required-field checks plus database CHECK constraints, modal confirmation preview with Back to Edit and Confirm & Submit, then INSERT to new `ewp_orders` table and POST to new `ewp-order-email` Edge Function. Email to existing `SALES_NOTIFY_TO` (`schung@griff.ca` intended). Confirmation modal cannot send twice; if email fails after a saved row, do not resubmit — use Submission History → Retry Email. Order history shows team submissions, email states and retry. Plain-text and escaped-HTML Resend messages contain exactly those ten fields plus verified submitter email and a protected Portal deep link. No attached files for EWP Order.
5. **No project linking:** Do NOT create a Tracker project, Forecast level, delivery or Spruce order automatically. `ewp_orders` is independent by agreement. Future integration is deferred.
6. **Backend migration:** `v1_12_ewp_orders.sql` is incremental over V1.10 and is safe **whether V1.11 SQL ran or not**. It adds shared ATS if absent, fixes original V1.10 JSONB choice validation by replacing `sales_validate_request()` with version *without* mandatory Spruce Code; preserves the optional V1.11 spruce column and older request values if present. Creates an independent RLS-protected `ewp_orders` table, insert attribution, and atomic `ewp_order_claim_email` retry RPC. Do not rerun V1.10 initial schema or require V1.11 patch before V1.12.
7. **Email function deployment:** **Redeploy** `sales-request-email` to omit Spruce Code from new request emails; **deploy** new `ewp-order-email`. Both use the same four already configured Resend-related secrets (`RESEND_API_KEY`, `SALES_EMAIL_FROM`, `SALES_NOTIFY_TO`, `SALES_PORTAL_URL`) plus existing Supabase Auth credentials. `supabase/config.toml` now includes both functions with JWT verification enabled. Orders use distinct provider idempotency keys `ewp-order-<uuid>`.

## V1.12 deployment order (company account; not done in this source build)

1. Back up GitHub Pages source and Supabase database. Verify original V1.10 sales table and email function are installed. If V1.11 was not deployed, **skip V1.11 SQL** and use V1.12 SQL directly; V1.12 carries forward its needed ATS/validation fixes. If V1.11 was already applied, run V1.12 as normal.
2. **Run** `v1_12_ewp_orders.sql` in the existing Supabase SQL Editor once. Confirm `ewp_orders` exists, `ewp_order_claim_email` exists, and shared Tasks still include ATS. Legacy sales requests and legacy spruce values must remain available. The SQL is idempotent for normal repeat execution.
3. Using the configured Supabase CLI/project, deploy BOTH functions from this complete ZIP: `supabase functions deploy sales-request-email` and `supabase functions deploy ewp-order-email`. Maintain `verify_jwt=true`, verify Resend sender/test restrictions and `SALES_NOTIFY_TO=schung@griff.ca` (email is accepted by Resend, not guaranteed delivered). Verify `SALES_PORTAL_URL` is the GitHub Pages site root ending in `/`.
4. Publish all web files to the existing GitHub Pages root, including new `orders/` and changed navigation and cache-busters. Hard-refresh **all five routes**; verify shared authentication and no redirect loop from `orders/` after sign-in.
5. New EWP Request test: submit a request **without Spruce Code**, select ATS, verify database insert and email content (no Spruce Code), optional PDF, Submission History and retry. If V1.11 SQL ran, verify old spruce values still stored.
6. EWP Order test: all eight mandatory fields required, no auto-default Layout Status, optional PO#/notes blank accepted, dropdown values exact, calendar and 23 time options inclusive, preview back/edit/outside close, confirmation inserts *one* row and sends one email. Inspect `schung@griff.ca` inbox and email subject/body. Test failed notification + history Retry; check another signed-in team member can see order history. Test light/dark and mobile.
7. Regression-test Forecast (quantities/dates/delivery/purchasing), Tracking (task cards/Coordination/filters), shared Settings, authentication, All/Sales portal cards, and New EWP Request private attachments. Live production Supabase/Resend QA not claimed in this source build.

## Verification and known limits

- **Completed isolated checks:** Node parsed every JS/MJS module; TypeScript transpilation parsed both Edge Functions; all five HTML pages have unique element IDs and navigation links; Chromium mocked-DOM tests passed Portal All (4 cards) / Sales (2 cards), all 10 ordered form fields, exact 23 Ship Time choices, blank required-field block, modal review/Back to Edit, exactly one mocked order save/email, Submission History, and New EWP Requests submission with ATS **without Spruce Code**. Original Tracker and Forecast calculation files checked byte-for-byte identical against V1.11. ZIP CRC tested after packaging.
- The Chromium test uses isolated in-page module mocks rather than live HTTP navigation, because the container browser blocks localhost/public navigation. None of these checks proves production Supabase SQL migration, RLS behavior with multiple accounts, Resend receipt or GitHub Pages deployment.
- `ewp_orders` is not tied to existing project data and does not reserve actual shipping capacity. Layout Status text is captured verbatim; the option mentioning customer liability does not automatically create legal indemnification.
- Email functions protect credentials server-side, verify Supabase Auth users, atomically claim rows and retry up to 5 attempts; exactly-once email delivery cannot be guaranteed across all provider failures. Same team-wide read access design as current New EWP Requests; assess permissions before inviting external accounts.

---

# EWP Management Portal — Canonical V1.11 WEB Handoff

**Release:** `EWP_Management_Portal_V1_11_WEB_FULL.zip` (October 16, 2026).  
**Source:** V1.10 WEB full package, preserving V1.9 Forecast and V1.5 Coordination logic. **Next: V1.12 WEB.** iOS V1.3 Capacitor prototype unchanged.

## V1.11 changes

- **Sales Request form:** mandatory free-text **Spruce Code** (up to 80 characters) immediately after Customer and before Project Name/Address; saved as `sales_requests.spruce_code` and displayed in Submission History and notification emails. Existing pre-V1.11 requests continue to display with a legacy/blank Spruce Code, not deleted or overwritten.
- **Shared Tasks:** append ATS to `tracker_settings.tasks` JSONB via incremental SQL. Sales request multi-select uses existing Settings-driven checkbox rendering, so ATS appears in the Sales tool and as a work-item choice in Tracker. Existing names are preserved; at least one task still required.
- **Renaming:** user-visible Sales Requests → **New EWP Requests** across all four navigation bars, Sales page and Portal card. Existing `/sales/` URL, `sales_requests` table, storage bucket and deployed function identifier remain unchanged.
- **Portal:** All / Sales toggle inside the authenticated homepage. Default All displays two half-width cards on the first row (Tracking, Forecast) and a half-width New EWP Requests card in the first position of the second row, leaving the second slot free for a future fourth workspace. Sales hides just the two non-Sales cards; the remaining Sales card **never stretches** to full width on desktop. Filtering the Portal does not grant/revoke any app permissions or hide navigation links.
- **Database patch:** **run `v1_11_sales_spruce_ats.sql` after V1.10** and before uploading V1.11 website. Adds nullable `spruce_code` to preserve historical rows; before-insert validation requires it for all NEW submissions. Also repairs earlier JSONB vs ANY validator bug. Original `v1_10_sales_requests.sql` packaged here is corrected for **fresh installation only**; do not rerun on an upgraded production environment.
- **Function:** redeploy V1.11 `supabase/functions/sales-request-email/index.ts` (same `sales-request-email` function name) to include the Spruce Code in Resend notification body. Four existing secrets remain unchanged. Email has not been independently confirmed delivered in production.

## V1.11 verification (isolated, not live)

- Tested the Portal cards in headless Chromium using locally injected styles/DOM: All view showed 577 × 156 px cards in two columns, with New EWP Requests on the second row; Sales view displayed only New EWP Requests at the exact same width and height. Dark-mode styles were also rendered.
- Tested Sales form field ordering and mandatory Spruce Code validity in isolated Chromium. Mocked a submission with ATS checked: payload included `spruce_code`, the selected ATS task, Customer, Sales, Phase and due date. Submitting no tasks was correctly rejected. Email response was simulated; no real notification was sent.
- All `.js` and `.mjs` files passed Node syntax checks; all four HTML pages had unique DOM IDs and V1.11 labels. ZIP integrity tested after packaging. Supabase SQL migration and real Edge Function email were **not executed** in this environment.

## Protected behavior / validation

Preserve existing V1.10 Sales authentication, RLS, private attachments, Submission History, email retry and idempotency; V1.9 date editing, Forecast parsing/purchasing; V1.5 task Coordination; V1.8 shared Settings and light/dark theme. **Test on live Supabase/Resend before employee-wide rollout**. Static/sandbox tests are not proof of production email delivery or SQL correctness on the company's database.

See `SALES_EMAIL_SETUP.md` for the precise upgrade order. No full-schema migration, no changes to Forecast/Tracker calculations.

---

# EWP Management Portal — Canonical V1.10 WEB Handoff

**Release:** `EWP_Management_Portal_V1_10_WEB_FULL.zip` (October 14, 2026).
**Parent baseline:** V1.9 WEB; V1.3 Capacitor iOS demo remains unchanged. **Next:** V1.11 WEB.
**REQUIRES new incremental SQL and deployed email Edge Function**. See `SALES_EMAIL_SETUP.md` before deployment; never publish Resend/service-role secrets to GitHub Pages.

## V1.10 — fourth Sales Requests tool

- Adds fourth `sales/` workspace accessible from Portal and three existing navigation bars. Reuses existing portal Supabase authentication, dark/light theme and shared Settings. No TC project created by submission.
- Sales form: Customer, Project Name/Address, Sales dropdown, Phase dropdown, Task multi-select checkboxes (>=1), and Requested Due Date are mandatory. Instructions and Drawings/Attachments are optional. Sales, Tasks and Phases source the same `tracker_settings` record; V1.10 SQL adds `phases` column with Awarded/Bidding defaults. The Project Tracking Phase dropdown/filter/editor now uses that same shared Phase list; existing phases remain available on old projects. Shared Settings exposes Phases across all tools.
- Supabase `sales_requests` rows protected by RLS; authenticated team can read all submissions, insert their own, not erase or fake notification status. The request is saved before sending email. Submission History displays saved requests, email status and retry. Private Supabase Storage bucket stores optional PDF/JPG/PNG files, and email links to an authenticated request instead of attaching drawings. Limit 10 MB/file / 30 MB/request. Confirm storage permissions fit your employee access policy.
- Authenticated Edge Function `supabase/functions/sales-request-email/index.ts` sends via Resend API to the configured recipient `schung@griff.ca` (environment variable `SALES_NOTIFY_TO`). Sender must be a verified domain/address set in `SALES_EMAIL_FROM`; never assume the recipient may be used as a sender. Server verifies Supabase user, atomically claims each request via SQL RPC, idempotency key prevents common duplicates, logs success/failure. The server cannot start delivering email until credentials, verified sender and the Edge Function are configured by your company.
- No changes to Forecast quantities/PDF/Spruce/deliveries, existing Tracker task split/merge/Coordination or project-number logic; no new iOS build. Historical SQL remains under `sql/archive/` and current V1.6 migration remains at root.

## Deployment/testing status

1. Back up V1.9 web and Supabase. Apply `v1_10_sales_requests.sql` once; complete setup in `SALES_EMAIL_SETUP.md`, including Resend verification/secrets and Supabase Edge Function deploy; then replace web source on GitHub Pages.
2. In Settings verify Sales, Tasks and Phases. Submit with all required fields, first without attachment then with PDF; inspect email receipt, Submission History and linked private attachment. Verify pending/failed retry and dark mode. Test existing Tracker phase edit, task moving to Coordination, Forecast dates and purchasing unchanged.
3. Offline: JS syntax verified; static DOM IDs unique; isolated mocked Chromium form submission required-field, checkbox, email invocation and history passed. **No live Supabase/Resend email, Storage or production RLS testing**; these are required before company rollout. Database SQL was authored but not executed here.

---

# EWP Management Portal — Canonical V1.9 WEB Handoff

**Release:** `EWP_Management_Portal_V1_9_WEB_FULL.zip` (October 14, 2026).  
**Parent baseline:** V1.8 WEB FULL, with shared Supabase database, unified typography/settings/headers and dark theme.  
**Next release:** V1.10 WEB (continue sequential V1.8 → V1.9 → V1.10 unless the user requests otherwise).  
**Backend migration: NONE**. V1.9 is a date-editing and scrolling frontend-only release.

## V1.9 changes — Projects & Materials

1. **Replace matrix header Edit buttons with interactive delivery dates.** In collapsed projects, clicking the date following **Next** opens a dialog with **every undelivered level** in that project (including undated legacy levels). Each level has its own date input, and one **Save Dates** action saves changed dates. Fully delivered levels never appear in the dialog. In expanded projects, the date next to the individual level name opens the same dialog containing **only that level**. Fully delivered expanded level dates remain visible but cannot be edited through this interaction. A pencil icon and focus-visible styles make interactive dates clear in both Griff light and dark themes. Tracking/Manage/Expand/Collapse functionality is retained.
2. **No change to Forecast materials and delivered records.** Only `levels.estimated_delivery_date`, `levels.updated_at`, `levels.version` are PATCHed for changed, non-delivered levels. Project metadata, default date, revisions, quantities, exclusions, Spruce orders, physical delivery records, inventory and purchasing line items are not edited. Forecast's next date, weekly/monthly forecasts and lead-time purchasing recalculate on the normal `syncFromCloud()` path. Date modifications are logged to existing `activity_log` via the existing `update_forecast_date` action. The legacy `Edit Project` dialog code is retained internally to avoid risky deletion of functionality but its matrix header **Edit** entry buttons are removed per request. Forecast Manage Level still has its own existing delivery date control.
3. **Concurrent changes:** Before saving, re-read current Supabase rows and check that each target level remains active, undelivered and unchanged since the dialog opened; optimistic version conditions protect each PATCH. Save issues are reported and shared records refreshed. **Note:** As there is no new database RPC/transaction, a multi-level Save applies individual level PATCHes in sequence. A network failure partway through can leave earlier dates saved: the interface warns clearly and requests a refresh/review of remaining levels. Live concurrency under a delivery happening during the brief PATCH interval still requires real-user verification; no claim of fully atomic multi-row transaction.
4. **One regular page vertical scrollbar.** Remove Forecast material matrix's `68vh` fixed maximum height and internal vertical scrolling; retain left/right horizontal matrix scrolling, including the existing top horizontal scrollbar. Remove the artificial 430px internal scrolling on Tracker Follow-up's selected-project list. Other everyday Portal/Tracking/Forecast pages remain natural document scrolling. Native combo dropdowns, the Settings overlay, auth overlays, and modals may still scroll internally when necessary to fit shorter screens, since those are not additional page-scrolling regions. Root body scroll remains available.
5. **Consistent V1.9 headings:** Three HTML pages and resource cache tags advance to `V1.9` and `?v=1.9`. The existing V1.8 shared theme, Settings, identity, navigation typography and native iOS V1.3 prototype are not changed.

## Verification and known limitations

- JS syntax checks for all JavaScript modules passed; HTML uniqueness checks passed for all three routes; no new SQL files or database changes.
- Isolated headless Chromium tests (mocked Supabase APIs, **not** company data) covered collapsed two-level editor excluding a fully delivered third level, expanded one-level editor, persistence of changed dates, audit event calls, rejected stale versions, and restoration of normal page-height matrix scrolling with horizontal overflow intact. Dark-mode date-link style exists. All three pages keep the same V1.9 masthead.
- **Not verified against production:** Real Supabase authentication/RLS, live activity logging, concurrent deliveries or two-person edits, end-to-end PDF import/Inventory and actual GitHub Pages deployment. Test before team rollout. No SQL needed when upgrading from properly migrated V1.8.

## Deploy V1.9

1. Back up the existing V1.8 website and Supabase records. Keep your existing Supabase URL, keys, schema and existing applied migrations intact.
2. Replace all GitHub Pages repository root files with the contents of the full V1.9 ZIP; include updated Forecast `app.mjs`, `index.html`, `styles.css`, shared `theme.css`, and Tracker `styles.css`. Hard-refresh Portal, Tracking and Forecast.
3. In Forecast → Projects & Materials, test one collapsed project (including mixed delivered/not delivered levels), click **Next** date, change multiple outstanding dates and save; expand a project, change just one level date, and ensure delivered levels are not editable. Confirm the Next date, 6-week Forecast, Purchasing and Entry History all reflect edits. Test from a second staff account and in dark mode.
4. Scroll a long matrix and Tracking Follow-up: the browser should have one vertical page scrollbar; matrix horizontal scroll still works. Regression-test Tracking tasks/Coordination, Forecast PDF/manual entry, Spruce/delivery, Inventory, and the shared Settings/Supabase header.

---

# EWP Management Portal — Canonical V1.8 WEB Handoff

**Release:** `EWP_Management_Portal_V1_8_WEB_FULL.zip` (October 14, 2026).  
**Source baseline:** V1.7 WEB FULL (all three pages + Supabase backend, no iOS changes).  
**Next release:** V1.9 WEB.  
**No new SQL migration.** Do not modify Supabase schema or rerun historic migration scripts solely for V1.8.

## V1.8 confirmed requirements and implementation

1. **Identical typography across Portal, Project Tracking and EWP Forecast:** Shared `theme.css` typography tokens (`--ewp-font`, body, heading, form/control, label scales). Identical Inter/system font stack and matching page H1 `38px` at 1400px (responsive clamp), weight 850, line-height, tracking. Matching semantic styles for header kicker, version text, section headings, nav tabs, and controls. Compact work-item cards and dense material tables retain smaller intentional data-specific sizes while using the same family.
2. **Consistent header action layout:** Three pages have the same account/email/sign-out chip, a color-coded Supabase connection pill, Refresh, and Settings button order and sizing. Forecast's redundant **header** `+ Add Project` button is removed; **Add Project tab is unchanged**. Project Tracking retains its Board/List `+ Add Project` actions. Forecast header Refresh calls existing cloud synchronization; Tracker retains existing cloud Refresh. Portal's Refresh runs an authenticated light-weight `tracker_settings` query; only reports **connected after a successful response**. Portal does not claim *live realtime subscribed* without starting a realtime channel; Tracker and Forecast retain their subscribed-only `· live` indicators.
3. **One Settings implementation on all three routes:** New `shared-settings.mjs` renders the exact same dialog and handlers for Sales Names, Assignee Names, Tasks and Appearance on Portal, Tracking, and Forecast. Uses the existing authenticated Supabase `tracker_settings` REST read/write via `tracker/cloud.mjs`'s new `loadTrackerSettings` export and existing `saveTrackerSettings`. No duplicate settings list, new database table, or new permissions; uses same id `global` and list names `sales`, `assignees`, `tasks`. An add/remove reads the latest settings first, persists all three arrays, then refreshes. List values are rendered with DOM text nodes (not HTML injection). Tracker's original Settings `view-settings` markup is retained as an unreachable compatibility shell for legacy `app.js` DOM bindings; the visible Settings button instead opens the unified modal. Shared themes remain stored locally in the same V1.7 key. Changes in the same tab notify the relevant workspace to refresh from Supabase; other tabs get a browser storage signal and regular Realtime/foreground refresh.
4. **Full dark-mode readability update:** Extended `theme.css` to fix light-only stripes in the material matrix; overdue delivery schedule rows; negative purchasing/inventory columns; purchase dialogs, alternate table rows, status and metadata chips, editable/readonly inputs, native date picker calendar icons, Follow-up lists, and project task cards. Olive/charcoal branding and Pending amber, In Review blue, Delivering green retain semantic meaning. Kept a readable light theme and high-density tables.
5. **Protected existing behavior:** Supabase auth/API URLs/keys, RLS, Realtime setup, Tracker task drag/merge/Coordinator workflow, existing TC number generation, Forecast PDF/manual material import, purchase parsing, inventory/lead-time calculations, material-date rules and deliveries unchanged. Two minimal Forecast `app.mjs` handlers wire header Refresh and settings refresh. Tracker `app.js` only wires shared Settings and updates on cross-tab settings changes. Portal session setup additionally verifies database reachability for its status pill. No backend changes.

## Verification and limits

- Syntax checks passed for every 15 JS/MJS module (including new `shared-settings.mjs`) and all three HTML files have unique IDs.
- Isolated headless Chromium DOM/CSS interaction tests using **mocked Supabase settings** confirmed that all three Settings dialogs load/submit shared list values, Light/Dark theme changes, and **all three H1 computed fonts are identical** (`38px`, `850`, identical family/line-height at 1400px).
- Isolated computed-style tests confirm dark row/background pairs: matrix alternate row `rgb(44,50,41)` / text `rgb(240,238,231)`; overdue `rgb(73,56,37)` / text `rgb(255,211,138)`; purchase shortage `rgb(75,40,38)` / text `rgb(255,196,190)`. Static mock screenshots are not a production/live-site verification.
- All previous Forecast and Tracker domain logic retained except event hookups above; ZIP integrity and source diff verified.
- **Limit:** Browser policy here blocks local/file URL navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`), so full production-like application page boot, live Supabase, RLS, real-time events, PDF import and SQL are **not** certified by this release's tests. Run live smoke tests after deployment.

## Deploy

1. Back up the current V1.7 GitHub Pages repository. Keep your Supabase database untouched.
2. Replace the website files in your existing GitHub Pages **root** with the contents of this V1.8 package, including `shared-settings.mjs`, updated `theme.css`/`theme.js`, and all three page HTML files; do not put the extracted folder one level down.
3. Hard-refresh Portal/Tracking/Forecast (cache query versions changed to `?v=1.8`). Sign in on Portal and confirm the status pill only claims Connected when network actually works.
4. Open Settings on EACH page, verify identical Sales Names/Assignee Names/Tasks/Appearance; add a temporary test entry and remove it, then ensure Tracking/Forecast dropdowns refresh. Confirm the dark Forecast material matrix, overdue row, projected shortage, dates, dialogs, Follow-up and board. Check all three pages in Light mode too.
5. Regression-test Tracker task Queue → In Progress → Coordination / combined In Review, Forecast manual entry, PDF import, Project # cross-link, and one-way Forecast → Tracking creation. No new SQL for V1.8; when upgrading from older versions, historical V1.4–V1.6 SQL prerequisites still apply.

---

# EWP Management Portal — Canonical V1.7 WEB Handoff

**Release:** `EWP_Management_Portal_V1_7_WEB_FULL.zip` (October 13, 2026).  
**Source baseline:** V1.6 WEB FULL, preserving V1.5 task workflow and V1.6 Forecast intake and calculations.  
**Next:** V1.8 WEB. **Scope:** UI consistency, dark theme and removal of redundant Tracker summary counters; **no SQL migration**.

## V1.7 changes

1. **Consistent Griff page headers.** Project Tracking uses the same account chip, sign-out and Supabase connection pill treatment as Forecast rather than a separate cloud strip. Tracker's `#trackerCloudMessage` is now placed within the page header and reports connected/error state; green connected text includes `live` only after the Realtime channel actually reaches `SUBSCRIBED`. An explicit Refresh button remains in the Tracker header, and Settings remains clearly visible beside it. Signed-in email derives from the **existing Supabase session**, not a new account system.
2. **Removed duplicate Tracker summary counters:** Deleted the row of Queue/In Progress/Coordination/Completed and Next Project Number cards entirely. Also removed the tiny numeric bubbles beside board-column names, per user's request. The filter-result count (e.g. '2 projects') remains useful; column headings, drag zones, card data, filters and task behavior remain the same. Internally the next TC number generator still runs when creating projects; only the dashboard number was removed.
3. **Settings in both workspaces.** Project Tracking Settings now includes an Appearance control before existing Sales, Assignees, Tasks settings. Forecast adds a prominent Settings button in its header, opening a modal with the same Appearance control. Both offer Light and Dark themes. This is a UI-only preference saved as `ewp_management_display_theme_v17` in localStorage on the browser origin, shared by homepage, Tracker and Forecast. Changing theme in one open tab also updates other tabs via `storage` events. Theme is *not* stored in Supabase and is therefore not automatically shared to a different device or browser.
4. **Unified, accessible dark styling.** New common `theme.js` and `theme.css` are included at the portal root and loaded by all three HTML entrypoints. Colors preserve the supplied Griff olive/charcoal palette and semantic Coordination Pending/In Review/Delivering status colors. Dark backgrounds, forms, search, cards, tables, modal dialogs and the landing portal are styled to avoid light flashes. Default remains Light. `theme.js` runs in the document head to set `data-ewp-theme` early.
5. **Scope protections:** No edits to V1.6 Forecast `app.mjs` algorithms, data parser files, Supabase API client, migrations, RLS, authentication implementation, project task SQL or work-item drag logic. Tracker JavaScript changes only wire the new header and remove display-only counter writes; no new database fields. Existing V1.6 SQL files remain packaged for new installations, but **do not run any SQL just for V1.7**.

## Verification / deployment

- 26 V1.5 Tracker mock-browser workflow assertions still pass: independent task movement, partial/full Coordination merge, selective reopen, date inheritance and zero JavaScript exceptions.
- V1.6 Forecast mock-browser tests still pass: Sales and types, Others, manual entries, SFD/undated demand, Forecast-created Delivering and preservation of pre-existing Tracker status; zero JavaScript exceptions.
- Separate UI mock-browser tests passed: removed counts, theme controls in both Settings locations, Light/Dark update, Forecast Settings modal and shared browser preference across Tracker, Forecast and Portal. Dark Tracker board and Forecast Settings dialog visually reviewed; light and dark use same Griff accents.
- JavaScript syntax checked and full ZIP contents validated. **No live production Supabase/Chrome-Safari deployment was tested here.**
- To deploy: back up the V1.6 website, then replace the complete GitHub Pages web root files with V1.7 files (especially `theme.js` and `theme.css`). There is no V1.7 SQL execution. A browser hard-refresh may be needed if GitHub Pages/clients cache old CSS/JS. Test signed-in status, Forecast dialog, theme retention across pages and board tasks on live data.
- If upgrading directly from a version earlier than V1.6, consult the V1.6 migration section below for required Supabase SQL *before* deploying this frontend. Do not rerun prior migrations that have already been applied.

---

# EWP Management Portal — Canonical V1.6 WEB Handoff

**Release:** `EWP_Management_Portal_V1_6_WEB_FULL.zip` (October 13, 2026).  
**Baseline:** canonical V1.5 WEB; all V1.5 independent-task/Coordination workflows and shared project IDs preserved.  
**Scope:** WEB only (Forecast functionality, Tracker-aware entry, legacy SQL organization). Capacitor iOS demo remains V1.3. **Next version: V1.7 WEB.**  
**Deployment prerequisite:** Back up the Supabase database and GitHub repo, make sure V1.4 and V1.5 SQL migrations were previously applied, then **run `v1_6_forecast_coordination_intake.sql` ONCE before uploading the V1.6 frontend.** Do not run historical setup SQL.

## V1.6 implementation and decisions

1. **Same Sales list as Tracker.** Forecast Add Project AND Edit Project now load `tracker_settings.sales` from the SAME Supabase shared team settings, plus salesperson names on existing project records, matching the Tracker's exact Sales-choice behavior. Changing settings in Tracker will flow into Forecast on the next shared sync/reload/focus. If Forecast encounters an existing saved name no longer in settings, it retains that name as a valid displayed selection so old records are not discarded. Tracker-owned project metadata remains read-only in Forecast. If the settings request fails, Forecast's existing normal cloud sync shows an error instead of pretending the new list is current.
2. **Same Project Type choices:** `SFD`, `Multi`, `Others`, with optional detail input for Others. `tracker_project_type` stores the precise type so it can round-trip with Tracking. Existing legacy database `projects.project_type` continues using only `sfd`/`multi` per the existing DB constraint; Others uses `multi` for that legacy internal column. In the UI and Tracker it remains `Others`, never displayed as Multi. This avoids changing existing schema/check constraints and keeps old Tracker code compatible.
3. **SFD/Multi/Others forecasting parity:** All 3 can use the 6-week package schedule, 6-week material demand, monthly material outlook, purchasing, Spruce, deliveries, inventory, manual entry and PDF imports. Removes the historical rule excluding SFD from dated forecasts and the SFD-only purchasing buffer. For **new or revised** Forecast entries, each level requires a delivery date. Existing undated levels are NOT deleted or forcibly dated: the Delivery Forecast shows an Unscheduled warning by project/level, and undated outstanding material is counted as immediate/lead-time purchasing exposure, not silently ignored. Inventory columns/CSV show **Dated Forecast** and **Undated Demand** rather than type-specific buffers. Forecast edit dialogs preserve legacy undated levels on unrelated edits; date editing asks for a date.
4. **PDF-free manual original Forecast creation.** New `+ Enter Materials Manually` button in Add Project reveals the existing Step 3 level/material editor without a PDF. User can add/remove multiple levels and enter material/positive total LF, schedule estimated dates, preview, then run the EXACT same confirmation and save/revision flow as imports. The old Spruce-order Manual Entry option remains separate and unchanged. Adding material forecast to an existing Tracker project uses the same shared Project # and preserves Tracker authority.
5. **One-way project creation.** A genuinely **new** Forecast project creates one shared `projects` row with `tracker_status='delivering'` and displays in Tracker's Coordination→Delivering, bypassing the legacy trigger's spurious `Assign task` placeholder. The supplied one-time SQL changes **only** `tracker_initialize_work_item()` so it skips a placeholder specifically for Forecast insertions marked Delivering and with no Tracker phase. Tracker-created projects still start in Queue with their own tasks and no Forecast materials. **Existing projects (including first Forecast imports from Tracker) preserve their existing Tracker statuses**, work items and metadata, regardless of whether Forecast import uses a PDF or manual entry. Existing imported Forecast revisions also preserve workflow. No new tables or user credentials are introduced.
6. **SQL cleanup:** Historical SQL scripts that were cluttering the active project root were relocated byte-for-byte to `sql/archive/` (Phase 2, optional realtime, V1.2, V1.4, V1.5, Forecast V0.26). No historical scripts are executed as part of cleanup; no live table/data deletion. The only *new* executable V1.6 script in root is `v1_6_forecast_coordination_intake.sql`. `sql/README.md` gives the exact path and migration order. When updating your GitHub Pages repository, remove superseded SQL files from their OLD root locations once safely archived as in this ZIP; this affects Git source files, NOT live Supabase records.
7. **V1.5 Tracker regression preserved:** Drag linked work items separately through Queue/In Progress/Coordination, automatic one-card In Review merge once the last task arrives, selective reopen, due-date inheritance, default Queue on new tasks, unchanged Follow-up and color filters. Tracker gets only a minor zero-task Forecast-card label/safeguard: it no longer pretends Forecast-created Delivering projects have a drawing task, and asks the user to add a task in Edit Project before dragging such a project back on-plate.

## Important operational precautions

- **This is not a tested live-Supabase deployment.** Browser tests use a mock of the shared Supabase tables; SQL was reviewed statically, not executed against a real database. Back up live data, run SQL in Supabase, check for success, and then deploy to GitHub Pages. Do not push this frontend first.
- V1.6 new Forecast project insertion + several related level/material REST writes are still the pre-existing multi-request implementation, not an all-or-nothing server transaction. The client attempts cleanup on failure; refresh and verify if connectivity drops midway. For complex future workflows a transactional Supabase RPC would be a separate project.
- Do not rerun historical `phase2_migration.sql` or `supabase_v0_26.sql`; these are archived for disaster recovery/documentation. If V1.5 migration wasn't applied, apply `sql/archive/v1_4_legacy_task_status_reconciliation.sql`, then `sql/archive/v1_5_atomic_task_coordination.sql`, then the V1.6 SQL, after assessing which have already been run.
- `tracker_settings` requires the authenticated team's existing RLS access; no credentials/API endpoints are changed.
- Keep Project # unchanged once levels exist; the shared project record remains one row for web and future iOS.

## Verification performed here

- `node --check` on all 13 JS modules (success).
- Mocked browser tests: settings Sales options; type dropdown SFD/Multi/Others; Others metadata classification; dated Other project in monthly schedule; undated SFD warning and purchasing demand; PDF-free manual Step 3, review and save; new manual Other project saved as Delivering with shared type details; adding original materials to a Tracker project without changing In Progress status; browser errors none. No native PDF parsing regression was triggered in this mock.
- Re-ran all 26 V1.5 mocked headless Chromium Tracker workflow assertions successfully (linked tasks, partial/full Coordination, reopen, inherited dates, no JS errors).
- ZIP file integrity, file references, and source/handoff preservation verified when packaging.

## Quick company-side rollout and acceptance checklist

1. Back up live Supabase and repo; ensure v1_5 RPC migration exists. In Supabase SQL Editor execute `v1_6_forecast_coordination_intake.sql` once; confirm success.
2. Replace web files at GitHub Pages repository root with V1.6. Historical SQL from old root folders can be deleted there because they now reside in `sql/archive/`.
3. Open Tracker Settings, confirm Sales list; open Forecast Add Project, compare Sales dropdown and SFD/Multi/Others choices. Change a Sales option in Tracker Settings and verify Forecast refresh picks it up.
4. Use a TEST TC# to create an Others project via Manual Entry with one dated level and positive material LF; verify it appears once in Tracker Coordination under Delivering and NOT as an Assign Task/Queue item.
5. Create a separate test project in Tracker with two tasks; open that TC# in Forecast, manually add a dated level; verify Tracker's Queue/In Progress remains exactly as it was. Test the PDF import path separately.
6. Confirm one existing SFD project with a dated level now appears in 6-week/monthly schedules. Verify older undated SFD projects remain visible in the Unscheduled warning and counted in purchasing.
7. Regression: Task 1 drag to Coordination while Task 2 remains In Progress; Task 2 drag merges cards In Review; reopen only one task. Verify Spruce partial orders, purchase PDF/Excel import, forecast revision reconciliation, Follow-up and permissions before broad rollout.

---

# EWP Management Portal — Canonical V1.5 WEB Handoff

**Release:** `EWP_Management_Portal_V1_5_WEB_FULL.zip` (October 13, 2026).  
**Baseline:** V1.4 WEB (preserved source/handoff below). **Next version: V1.6 WEB.**  
**Scope:** Project Tracking web UX and task-to-Coordination workflow, NOT Forecast calculations / parsers / Supabase shared records / iOS.  
**Required:** Back up Supabase, then run `v1_5_atomic_task_coordination.sql` exactly once BEFORE uploading the V1.5 web files. This replaces existing task-move RPC atomically and reconciles older all-Done active projects. It requires prior V1.2 project-status and V1.4 reconciliation migrations; do NOT rerun old setup SQL scripts.

## V1.5 decisions implemented

1. **Direct task drag into Coordination.** Task cards can move Queue ↔ In Progress and each independently into Coordination. The latter persists `tracker_work_items.status='done'` while other linked cards stay in their own column. Partial task cards in Coordination display task name / Task N of M / arrival progress, read-only `In Review`, and are draggable back to Queue or In Progress. The green Finished Tasks shelf, Move to Coordination action and Mark Done/Start/Reopen card buttons from V1.4 were removed.
2. **Automatic visual merge.** When the **final** work item moves to Coordination, a single Supabase RPC transaction records task Done **and** atomically changes parent `projects.tracker_status` to `in_review`. Board then renders ONE combined Coordination card (not duplicated rows), preserving ALL original task records / assignees / dates / TC# / Forecast data. Subsequent Pending, In Review, Delivering, and Completed operate on that same project-level card; Completed still means fully delivered, never just that drafting ended.
3. **Reopening.** Drag a partial Coordination task back out to resume that individual task. Drag a combined project card back to Queue/In Progress to choose which task to reopen; other completed work items remain Done and reappear separately in Coordination. No data merging or deletion.
4. **New-project task form:** remove Task Status (new tasks always saved as queue) and `↺ Use project due date`. Task date automatically shows/inherits the project due date, saves NULL for inheritance, and follows future project-date changes; typing a task-specific date overrides it, and **clearing the custom date restores inheritance automatically**. Edit-project form retains Task Status for maintenance; a last-task edit to Done also promotes the overall project to In Review.
5. **Filters/counts:** Coordination color/status quick filters include individually finished In Review work items, as well as combined project statuses. Each column badge counts unique project numbers in that column, not total tasks. Search/List/Follow-up retain one project-level record; customer-sales compact spacing retained.
6. **No Forecast domain edits.** `forecast/app.mjs`, parsers, `.mjs` dependencies, styles and auth/backend keys unchanged; only visible masthead version and cache-busting refs changed on Forecast and Portal. Griff branding remains. iOS Capacitor stays frozen at demo V1.3.

## V1.5 test and rollout

- Automated tests: JS syntax; static references; mocked headless Chromium for Queue→In Progress→partial Coordination→automatic combined Coordination, reopen/split, due-date inheritance and new task statuses; static SQL review. **Real Supabase deployment/test cannot be performed in this environment.**
- Back up the existing Supabase project and GitHub Pages files. If V1.4's `v1_4_legacy_task_status_reconciliation.sql` was not applied, run that first. Run `v1_5_atomic_task_coordination.sql` once in SQL Editor and check success.
- Upload *all* contents of V1.5 ZIP to GitHub Pages repo root (not a nested versioned directory). Refresh browser, log in, create a TEST project with 2 work items; both start Queue. Drag one to In Progress and to Coordination; it should show ONE task (1/2) while the other remains on-plate. Drag second to Coordination; both collapse to ONE In Review project card. Drag combined card back to In Progress and select Task 2; verify Task 1 remains coordinated. Then test Coordination pills and Forecast link.
- Do not use this build as proof of tested live Supabase. The SQL is needed for concurrency-safe last-task aggregation; deploying frontend without it can leave server project statuses stale.
- **Not included in V1.5 (separately discussed):** shared Forecast Sales/Project Type choices, SFD and Others forecasting parity with Multi, PDF-less manual Forecast creation, Forecast-created Coordination → Delivering rule, and Option A (preserve existing Tracking status on first Forecast import). These remain next-phase candidate tasks, not silently implemented.

---

# EWP Management Portal — Canonical V1.4 WEB Handoff

**Latest full WEB package:** `EWP_Management_Portal_V1_4_WEB_FULL.zip` (October 13, 2026).  
**Direct source baseline:** supplied `EWP_Management_Portal_V1_3_FULL(1).zip` (not the V1.3 Capacitor proof-of-concept).  
**Next sequential version:** V1.5.  
**Live verification:** pending; isolated mocked-browser scenarios passed, real company Supabase not accessible here.  
**Scope:** Tracker task workflow / card UI / task due-date defaults; Forecast computations, parsers, auth, portal navigation, Follow-up mail templates and inventory algorithms are unchanged. iOS source is not generated in this WEB-only build.

## V1.4 implemented: linked, independently movable task cards

1. A multi-task project appears as **one independently movable card for each task** in the active Board's Queue and In Progress columns. Tasks keep their project ID and TC project #, client, sales, Forecast link and project details; a visible `↳ Task Name · Task 1/N` indicator links related cards. Card click opens the same single Project editor and highlights the clicked task.
2. Task workflow statuses are persisted in the existing `tracker_work_items.status` (`queue`, `in_progress`, `done`) using **existing `tracker_move_work_item` RPC**; no new RPC is needed. Drag Queue ↔ In Progress or to **Finished Tasks**; quick buttons Start task / Mark done / Reopen task are provided so users need not drag. A task done while another is in progress/queue does **not** move the project into Coordination.
3. Finished Tasks is a separate, explicitly task-level drop area within the **In Progress** column. It is NOT the main Completed project column, which continues to mean the *entire project physically delivered*. Finished cards are visible and reopenable until the project moves to Coordination.
4. When every task is Done, a project-level action **Move to Coordination →** appears beneath the finished tasks. The user must click it (or explicitly drag the completed task to Coordination); the project never moves automatically. Once moved, one project-level Coordination card appears as **In Review**, including the preexisting Pending/In Review/Delivering quick status selector. After that, assignee and task due dates remain hidden on the compact/detailed off-plate card but are preserved in the editor and backend. Completed project cards also stay aggregated.
5. Moving an off-plate, all-done project back to Queue/In Progress reopens **only one chosen task**: if there are several, user chooses its numbered work item via a prompt; the rest remain Done. Dragging a single unfinished active task onto Coordination warns that all work items must be completed first. Dragging an individual task directly onto the Project Completed column warns instead of confusing task completion with full delivery. Editing each task's status is also supported through the project editor; the overall Project Status field remains available for coordination/delivery management.
6. Compact customer/sales separator now uses 7px padding each side. Both detailed and compact cards remain in the V1.3 density toggle, default Compact. Linked tasks have a small olive left border; finished cards have a green border. Board counts are **unique project IDs per column** (one linked project may count in Queue and In Progress simultaneously), while List and Follow-up remain one row/selected project per shared Project #. Board tasks and project-level aggregates use existing searchable filters and saved-filter controls.
7. **Task Due Date inheritance:** New work items and existing work items with NULL/blank `due_date` display the current Project Due Date inside the date picker, not a blank field. Dates remain inherited dynamically as the Project Due Date changes; they are stored NULL and display the current project due date on Board/List. Any task's manually selected date becomes a durable independent override. `↺ Use project due date` resets a task to inheritance; existing explicit due-date overrides are retained.
8. V1.3 canonical original handoff/history, full Forecast code/data/SQL, Griff assets, shared auth, Supabase config and Phase 2/V1.2 migrations remain included. There is **no new table, credential, backend project linkage or data duplication**.

## Database deployment — IMPORTANT one-time compatibility step

**Run `v1_4_legacy_task_status_reconciliation.sql` in the EXISTING Supabase SQL Editor once, BEFORE deploying V1.4 frontend.** Preview SQL in the file before running; take a database backup. This prevents legacy V1.3 In Progress projects whose per-task statuses were left entirely `queue` from appearing unexpectedly as all queued task cards. It updates those legacy task statuses to `in_progress` *only where all tasks are still queue and the project-level status is in_progress*. It does **not** modify Coordination/Completed projects, projects with already mixed task statuses, Forecast levels/materials, or any sales/customer/project metadata. The UPDATE is safe to rerun but intended once, and preserves existing task identities, assignments and dates. Prior V1.2 migration must already exist (as it did in V1.3). No other SQL required for this release.

**Known limitation:** The existing `tracker_move_work_item` increments project version but does NOT rewrite the legacy `projects.tracker_status` for active task movements. The V1.4 Board and List derive Queue/In Progress display from work-item status; Coordination/Completed remain authoritative from `projects.tracker_status`. An external client reading only raw project `tracker_status` may see the old active-project status until a project editor save updates it; do not use that column alone as a task-progress source. Do not auto-advance Forecast material/delivery state based on task completion.

## QA completed (not live integration)

- `node --check` on changed Tracker script and all `.js`/`.mjs` modules.
- Isolated Chromium DOM+CSS test with mocked Supabase modules: one project shown as one Queue and one In Progress card; linked project number and individual task titles; one off-plate Forecast-created Coordination aggregate; 7px separator; Edit dialog highlights task; inherited date visibly populated; project due date updates inherited task but not custom override; completion of one task leaves the other queued; drag-event completion of second task produces two Finished Tasks; only then shows manual Coordination action; action moves to In Review once and retains both work item records. No JavaScript page errors. Rendered screenshots for human visual inspection only. The real HTTP navigation to localhost was blocked by this environment, so DOM was exercised with directly injected module mocks, not through a public deployment.
- Forecast's domain `.mjs` and parsing algorithms are untouched; no Supabase integration or migration SQL was executed on live database.

## Deploy/test on company environment

1. Back up the GitHub Pages repository and shared Supabase project data. Run/review `v1_4_legacy_task_status_reconciliation.sql` in Supabase SQL Editor once.
2. Replace the repository root with the contents of the full V1.4 WEB ZIP; commit/push and hard-refresh. All three mastheads show V1.4, with no iOS rebuild required.
3. Open an existing two-task project and verify one card in Queue and one in Progress after assigning distinct statuses. Check individual Start/Done/Reopen actions and drag targets. Confirm other work items and Forecast data remain unchanged.
4. Verify completed tasks in the Finished Tasks shelf; with some tasks incomplete, moving to Coordination must be blocked. With all Done, click **Move to Coordination** and verify exactly one In Review card. Change to Pending and Delivering, move to Completed only when physically delivered, and test reopening just one task from Coordination.
5. Edit project due date and verify NULL task due dates follow; verify custom task dates do not change; use Reset to Project Date on a custom task. Check Board/List/Follow-up filters, task assignments, TC numbering, Griff icon, Forecast import/delivery/inventory and two-user live sync.
6. Do not mark company-side integration passed until the above are verified with the live shared database and a second user.

## Earlier agreed Forecast requests: NOT in this task-focused recode

The following previously discussed enhancements remain queued for a separate subsequent release; **do not assume V1.4 implements them**: Sales dropdown shared with Tracker settings, Project Type choices SFD/Multi/Others with equivalent scheduling/purchasing behavior, first-class Manual Entry of project levels/materials without PDF, Forecast-created new project automatically entering Coordination → Delivering, and existing Tracker project preserving its tracking status when Forecast material data is first imported (Option A). Existing V1.3 Forecast code remains unchanged for safety. User has not resolved whether dates should be mandatory for newly created Forecast levels.

---

# EWP Management Portal — Canonical V1.3 Handoff

**Latest complete source release:** `EWP_Management_Portal_V1_3_FULL.zip` (October 13, 2026)  
**Parent baseline:** V1.2 full, retaining V1.0 Phase 3 → V1.1 → V1.2 lineage.  
**Next version:** V1.4.  
**Database migrations for V1.3:** **NONE**. V1.3 is Tracker Board UI-only plus release masthead/cache version updates on all three routes. **The V1.2 one-time `v1_2_project_status_migration.sql` is still required if your deployment has not already run it**; do NOT rerun if already applied. The original V1.2 migration file is included unchanged for reference.  
**Live production verification:** still pending; V1.3 was exercised with synthetic sample data in an isolated headless browser, NOT with your company's actual Supabase records.

## V1.3 changes

1. **Visible Settings:** `tracker/index.html` replaces the tiny top-right gear with a labeled Griff-olive-bordered **⚙ Settings** button in the same header. It continues opening the existing Tracker Settings view; no settings/data changes.
2. **Compact/Detailed Board switch:** A two-button control beside `+ Add Project`, **Compact selected initially**, switches only Board card presentation (not filters, List or Follow-up). Stores a user's chosen display preference in browser `localStorage` key `ewp_tracker_board_density_v13` (never writes project data). If storage is blocked, defaults to Compact on every reload. This is the **only new local storage use**; shared projects remain entirely in Supabase.
3. **Compact cards:** Show one project #, type, one-line address/name, customer + sales name, and a single status pill. Queue/In Progress additionally show short assignee and due date. Dedicated compact ↗ EWP Forecast link remains available, and clicking the rest of the card still opens full project details. Drag and drop continues. Compact Coordination status is an actual color-coded native select that lets the user change Pending/In Review/Delivering directly with one interaction; no second status pill/dropdown duplication.
4. **Detailed cards:** Retain V1.2's existing task name, phase, badges, Forecast button and status controls; the V1.3 Compact/Detailed switch hides/shows layouts without affecting server records or task metadata.
5. **Off-plate card metadata:** Both Compact and Detailed **Coordination** (all three statuses) and **Completed** cards hide historical due date and drawing assignee; these values are **not erased** and remain available when editing or when moved back to Queue/In Progress. Sales, client, address, type and project status remain visible.
6. **Clickable Coordination header pills:** Pending (amber), In Review (blue), Delivering (green) become toggling filter buttons. They **reuse the existing main Board/List status filter state** (`activeFilters.status`) and its chips/counter/Save Filter/Clear; selecting one replaces the current status selection with that single value (other filter dimensions stay intact). Clicking the selected pill again removes the status restriction. Consequently, while a Coordination pill is selected, other Board columns may show no matches; this is intentional global Status-filter behavior, **not** a separate hidden Coordination-only filter. Existing saved filters are NOT modified by clicking a shortcut; the active filter is treated as custom. Follow-up continues to use its own independent filters.
7. **Unified version text:** Portal, Tracker, Forecast and Portal footer now say `Version V1.3 · Developed by Samuel Chung`; touched page resource query tags advance to `?v=1.3` to reduce stale cached UI. Forecast domain `.mjs` computation logic and shared auth code are **unchanged**.
8. **No Test Mode** or new status tables/functions. The one overall project status and four-column drag workflow from V1.2, the repaired TC numbering system, and the Follow-up subject/body + first-name greeting remain unchanged.

## V1.3 checks actually performed

- Node syntax check passed for changed `tracker/app.js` and the other JS/MJS modules. HTML structure has no repeated IDs and the three mastheads share V1.3.
- An isolated Chromium DOM+CSS test with mocked shared data and injected Tracker module dependencies passed: Compact initial mode; 7 cards with one per project; Compact ↔ Detailed view; off-plate cards hide due/assignee in both views; all three colored Coordination selects visible in Compact; clicking Pending pill filters the same project set/chips, clicking again clears; main status filter updates Coordination pill pressed state; Clear resets; clicking a card opens Edit Project; Settings opens; a compact Coordination status select updates mocked shared server state; Queue→Coordination drag defaults to In Review; Follow-up keeps its independent All-status default, first-name greeting, and separate subject/body; and 390px-wide header placement was checked. Preview screenshots were generated from **mock data only**. Direct navigation to `https://example.com` in the automated browser remained blocked by the execution environment; isolated DOM tests do not imply live integration success.
- Original V1.2 database SQL files, Forecast parsing/material calculations, auth, realtime, and integration logic retained byte-for-byte; status handling/dragging API unchanged. The mock tests do not substitute for production end-to-end verification.

## V1.3 deployment and regression checklist

1. Back up your GitHub Pages repo and relevant Supabase data. Confirm V1.2 `v1_2_project_status_migration.sql` has previously succeeded; otherwise follow the V1.2 migration instructions **before deploying V1.3**.
2. Extract the **entire V1.3 ZIP** into the existing GitHub Pages repository root, replacing the old files; commit and push, then hard refresh once.
3. Open Tracker Board. Check **⚙ Settings**, its navigation, initial Compact view, Compact/Detailed toggle, view choice remembering after reload, card-click edit modal, and the separate ↗ Forecast deep links. Check compact legibility with long addresses/customer names and small screens.
4. Inspect Queue/In Progress vs Coordination/Completed in **both** views: due/assignee appear only while on the EWP plate. Confirm they remain intact when editing or moving back.
5. Click Pending, In Review, Delivering pills; check existing Status filter chip/counts, selected-pill state, toggle off, Clear, saved filters, other filters, and list view synchronization. Follow-up remains independently filtered.
6. Drag projects Queue→In Progress→Coordination (defaults to In Review), manually select Pending or Delivering, drag back to Queue/In Progress, and optionally mark Completed; verify status persists in real Supabase after reload and is visible to a teammate. No task-level or per-level status introduced.
7. Regression-test project editing/creation, TC sequence, settings, Follow-up greeting and copy actions, cross-tool metadata priority, navigation/auth, Forecast PDF import, Spruce partial deliveries, inventory, purchasing, and team sync. Do not mark V1.3 live-verified until this passes on real data.

## Canonical architecture and historical notes

The following earlier handoff sections remain authoritative wherever not superseded by V1.3. In particular, the Forecast processing rules, the existing V1.2 project-status RPC and non-destructive migration, Phase 3 shared authentication, and Project Tracking's ownership of shared project metadata all remain protected.

---

# EWP Management Portal — Canonical V1.2 Handoff

**Latest complete source release:** `EWP_Management_Portal_V1_2_FULL.zip` (October 13, 2026).  
**Parent/source baseline:** `EWP_Management_Portal_V1_1_FULL.zip`, itself derived from canonical V1.0 Phase 3.  
**Next release:** V1.3 (then V1.4, etc.).  
**Live production verification:** NOT YET PERFORMED. No real Supabase SQL was run in this environment, no production GitHub Pages was changed, and the browser automation environment blocked local/remote test navigation. Do not assume live acceptance.

## CRITICAL: V1.2 requires one-time SQL before the frontend is deployed

Run **`v1_2_project_status_migration.sql`** in the existing Supabase SQL Editor **BEFORE uploading V1.2 static files**. This migration is non-destructive. It:

1. Adds `public.projects.tracker_status` (the **one unified status of an entire project**, including SFD and Multi; no per-level status).
2. Safely reconciles old Queue/In Progress/Done work item states. **Old all-Done drawing tasks become In Review, never Completed**, because full delivery cannot be inferred from drafting completion. Check migrated statuses manually and mark truly delivered jobs Completed as appropriate.
3. Adds status validation and a new version-checked, authenticated `public.tracker_set_project_status(uuid,text,integer)` RPC for drag/drop, the coordination selector and editing. Updates the existing project `version` and `updated_at` for team synchronization.
4. DOES NOT touch any existing Forecast data, `tracker_work_items` metadata (assignments, task descriptions, due dates), projects' sales/customer fields, past delivery history, Project # sequence counters, existing RPC definitions, triggers, or RLS policies. It does not reset TC numbering.
5. Is safe to rerun in the sense that it only backfills `tracker_status` where still NULL, preserves previously classified statuses, and guards the named CHECK constraint. Only run once in normal deployment.

Do NOT rerun `phase2_migration.sql`, `phase3_realtime_optional.sql`, or `forecast/supabase_v0_26.sql` as part of the V1.2 upgrade. Back up the database and repository first.

## V1.2 features and protected behavior

1. **Brand palette from exact supplied Griff logo:** olive `#949300`, charcoal `#3c3935`, warm ivory `#eae4db`. The top navigation on all three routes is charcoal, primary actions use readable dark olive `#747300` with white text, olive accents/active filters replace most former blue, and backgrounds remain lightly ivory/white for legible dense tables. Semantic error/success/warning colors are preserved. Coordination status colors remain **Pending amber**, **In Review blue**, **Delivering green**.
2. **Four Board columns:** Queue / In Progress / Coordination / Completed. The project moves as ONE card (even if multiple legacy tasks/assignees are stored); no task-level Board status and no per-level status for Multi.
3. **One project status:** `queue`, `in_progress`, `pending`, `in_review`, `delivering`, `completed`. `pending`, `in_review`, and `delivering` all group into Coordination. In Progress = on EWP plate; Coordination = off EWP plate; Completed = entire job delivered.
4. **Drag behavior:** From Queue or In Progress into Coordination defaults to **In Review**. From Coordination back to Queue/In Progress restores drafting workload. Moving a Coordination card within the same column does **not** overwrite a manually selected Pending/Delivering status. Any column can be moved to Completed; no delivery automation is assumed. The Coordination card's dropdown can explicitly set Pending, In Review or Delivering. The Edit Project form also has one **Project Status** select. Task assignment metadata remains editable but its legacy independent status selection is hidden and unchanged.
5. **Board/List filtering:** Reuses the fully functional existing saved filter system, no extra quick filter bar. Status options include all six; one result per project. Task and assignee filters/search still examine all stored work item metadata, but projects never get duplicated in Board/List. Saved filters continue to work.
6. **Follow-up:** Default status is **All statuses**, with Open (exclude Completed) and all six detailed status choices. Retains exact salesperson matching, type/phase/assignee/due/search filters and selected-project pruning. The subject `Request for Project Status Updates` is a separate editable field with **Copy Subject**; the body is separately editable with **Copy Email**. Greeting uses salesperson **first token only** (`James Harper` → `Hi James,`). App **never sends email**.
7. **Versioning:** Visible masthead on Portal, Tracker, Forecast, plus root footer = `Version V1.2 · Developed by Samuel Chung`. HTML asset cache tags updated to `?v=1.2` on touched assets. Source internals of Forecast remain V0.27 and all original module/SQL history is preserved. Griff logo assets remain identical from V1.1.

## V1.2 verification performed / limitations

- `node --check` passed for the changed Tracker JS and every existing `.js`/`.mjs` module.
- HTML parsing checks found no duplicate IDs in the three route documents. All three page mastheads have the shared V1.2 label.
- Node VM unit tests passed: all six project states, three statuses grouped into Coordination, legacy Done fallback mapped to In Review, first-name greeting, separate subject/body, correct TC#/client/address formatting, and SFD/Multi template branching.
- Exact V1.1 archive diff confirmed Forecast domain `.mjs` code, Forecast parsers, auth, Realtime modules, native SQL history, and untouched files were preserved byte-for-byte (excluding explicitly changed three HTML/CSS and Tracker interface modules).
- Headless Chromium browser test attempts were blocked by environment with `ERR_BLOCKED_BY_ADMINISTRATOR` even on intercepted URL navigations; therefore **browser interactions and real Supabase migrations have NOT been tested**. Do not describe them as passed.

## Deployment / manual acceptance checklist

1. Make a database backup and back up current GitHub Pages project.
2. **Run `v1_2_project_status_migration.sql` once in Supabase SQL Editor first.** Verify returned project statuses with the read-only verification queries in that file. Inspect historical old Done projects (now In Review), manually reclassify truly delivered projects as Completed later.
3. Copy full **V1.2 ZIP contents into the existing GitHub Pages repository root**; keep folders/root as shipped and push. Hard refresh after GitHub Pages deployment.
4. Sign in; verify Portal two buttons, navigation, version mastheads, logo and Griff colors on Portal, Tracker and Forecast.
5. Tracker Board: one card per project, four columns, drop Queue→Coordination = In Review, change to Pending/Delivering with card dropdown, drag to In Progress and back, drag to Completed. Check simultaneous users refresh and version conflicts.
6. Tracker List: one row per project even when multiple work items exist; test shared search, status saved filters and task/assignee filters.
7. Follow-up: All statuses default, exact salesperson filter, filter each six statuses, select projects, edit/copy subject and body separately, confirm `Hi James,` for a `James Harper` salesperson and correct chosen project list. No emails sent.
8. Regression-test project creation, editing, existing task metadata and due dates, Board/List saved filters, Project # allocator (including previous repaired TC26 counter), Forecast Javelin import/prefill, sales/customer authority, Spruce, partial deliveries, purchasing, inventory, Realtime and sign-out.
9. Only mark V1.2 live-verified after successful company-side tests.

## Core architecture and protected legacy handoffs

All V1.1/V1.0 Phase 3 invariants and forecast-specific handoff below continue to apply unless explicitly superseded above. In particular, Project # remains the common linking key and Project Tracking retains priority for shared metadata conflicts. Project statuses are internal Tracker metadata and must **NOT** automatically infer Forecast level delivery state. The existing `forecast/EWP_FORECAST_HANDOFF.md` remains authoritative for Forecast behavior. No additional test mode was added.

---

# EWP Management Portal — Canonical V1.1 Handoff

**Latest complete source ZIP:** `EWP_Management_Portal_V1_1_FULL.zip`  
**Latest canonical source release:** **V1.1** (October 13, 2026), derived directly from the uploaded **V1.0 Phase 3** release.  
**Live verification:** NOT YET VERIFIED against the real shared Supabase database or production GitHub Pages; do not equate offline UI tests with production sign-off.  
**Versioning:** Next V1.2, followed by V1.3 and so on. Use no phase-based or independent per-module version labels in the three page mastheads.

## V1.1 changes — implemented

1. **Simplified root portal:** The authenticated homepage has exactly two large workspace cards/buttons: `Project Tracking` and `EWP Forecast`. The previous descriptive cards and shared-registry informational notice were removed from the homepage; existing sign-in, sign-out, shared top navigation, deep links and security remain.
2. **Griff logo on every top-left navigation:** The supplied original logo is preserved at `assets/griff-logo-original.png`; a square navigation-optimized derivative using the same original artwork is `assets/griff-nav-icon.png`. Root portal, Tracker and Forecast all load this shared file via the top navigation instead of the old letter `E`.
3. **Unified mastheads:** Portal, Tracker and Forecast all show **`Version V1.1 · Developed by Samuel Chung`** immediately below their page titles. Tracker and Portal mastheads now follow Forecast's edge-aligned page-header layout; their page-specific kicker/title are retained. Previous Tracker `Phase 3` and Forecast `Version 0.27` strings were updated in the visible mastheads only; underlying protected Forecast computation remains V0.27 internally.
4. **Project Tracking / Follow-up:** A third `Follow-up` tab sits alongside Board and List. It provides a **single exact-match salesperson selector** from shared Tracker settings and live project data. Optional independent filters: Project Type (SFD/Multi/Others), Phase (Awarded/Bidding), project-level work-item Status (open by default / all / Queue / In Progress / Done), Assignee, due date (overdue / next 30 days / missing), and search by Project #/Customer/Address.
5. **Project selection / email:** One checkbox row per shared project regardless of number of work items. `Select All Filtered`, `Clear Selection`, `Email Preview`, and `Copy Email`. The plain-text copy includes a subject, salutation with the stored salesperson label, context tailored to selected project types, request for upcoming delivery dates/order levels/canceled work, and exactly one `TC# | Client | Address` row for each selected project. Email text is editable before copying. **No email is sent by the app**. Copying uses Clipboard API with `execCommand` fallback and manual-select guidance where browser permissions prevent copying.
6. **Selection safety:** Default status excludes completed projects; users may explicitly filter Done or All. Switching salesperson clears selections and the old draft; selecting/deselecting or changing filters removes any now-hidden projects from the selection, preventing accidental inclusion of other salespeople's projects. The Follow-up filters do NOT modify the existing Board/List filter system or its cloud-saved filters. Project and settings data are read-only from the existing `loadTrackerCloud()` return data; **no new database reads, tables, columns, RPCs, RLS rules, or migrations.** The tab is not persisted as an activity record.
7. **Cache refresh:** Changed HTML references use `?v=1.1` for relevant static assets and scripts so GitHub Pages/browser caches pick up V1.1. Untouched internal module import paths may still use V1.0 query tags and keep their original module semantics; all three pages import the same shared origin auth key and preserve existing logins.

## V1.1 verification performed

- `node --check` on Tracker and Portal scripts and other JS modules.
- Offline headless Chromium mock-data test: portal shows exactly two workspace links, all three Tracker tabs load, salesperson JH only sees JH projects, Done is excluded by default, exact sales match prevents SC project inclusion, multi-work-item projects show only once, type and keyword filters work, selection copies distinct TC#/Client/Address lines into the template, switching status to Done drops the stale selection, switching salesperson clears the old selections, Board remains accessible, and no browser JavaScript errors appeared in that test.
- No real Supabase account, server permissions, outbound email, or GitHub Pages deployment were exercised here. Forecast domain workflows and shared auth were NOT re-verified live. Final company-side integration test is required.

## Deployment for V1.1

1. Back up the current V1.0 GitHub Pages repository and (recommended) Supabase database.
2. **NO SQL REQUIRED.** Do **NOT** rerun `forecast/supabase_v0_26.sql`, `phase2_migration.sql`, or `phase3_realtime_optional.sql` to deploy V1.1. These are retained only as historical setup scripts.
3. Extract the **complete** V1.1 ZIP to your existing GitHub Pages repository **root** (not inside a new nested V1.1 folder); include `assets/`, both app folders, root HTML/CSS/JS, `.nojekyll`, and all docs. Commit and push.
4. Hard refresh once after deployment, sign in at the Portal, check navigation and logo on all three routes, confirm signed-in status, and open Project Tracking → Follow-up. Select a real salesperson, filter project types, choose projects, inspect the preview, click Copy Email, and paste into a draft in your normal email client. Verify no done projects appear by default; check All/Done filter explicitly.
5. Regression-test Board/List, settings, creating/editing a project, Forecast import/pre-fill, Spruce and delivery workflows, and cross-tool links. If the current V1.0 Phase 3 tests have not yet been run, do those too. Only then mark V1.1 live-verified.

## Protected architecture and important handoff

The complete V1.0 Phase 3 architecture, Tracker/Forecast authority, database constraints, auth, deep-links, real-time/fallback refresh, and regression rules below remain **binding and preserved**. Source and SQL scripts remain intact unless explicitly noted in the V1.1 list. **Do not change Forecast algorithms or schema as a side-effect of UI work.** `forecast/EWP_FORECAST_HANDOFF.md` is also authoritative for operational Forecast behavior.

---

# EWP Management Portal — Phase 2 Handoff

**Canonical release:** V1.0 Phase 3, integrated portal + Phase 2.1 shared Supabase implementation.
**Protected components:** EWP Forecast V0.27; Project Tracker V0.5 interface/workflow.

## Architecture

- Root `index.html` is the navigation portal.
- `forecast/` contains **Forecast V0.27 application code with only Phase 1 navigation and a Phase 2 intake metadata-prefill safeguard**; its existing `projects` table is the authoritative registry.
- `tracker/app.js` is a module: it calls `tracker/cloud.mjs` for all shared data and RPCs and imports `forecast/auth.mjs` for the same Supabase session. No Tracker project or settings writes use browser localStorage.
- SQL: `phase2_migration.sql` at the repository root; incremental migration on top of `forecast/supabase_v0_26.sql`. It is deliberately non-destructive.
- Tracker stores new fields directly in existing `projects` columns prefixed `tracker_`; tasks are in `tracker_work_items` with `project_id` foreign key; global lists in `tracker_settings`; filters in `tracker_saved_filters`; issued-number high water in `tracker_number_sequences`.
- New PDF projects are automatically given an `Assign task` tracker work item through a projects trigger. Existing Forecast projects are backfilled likewise. Tracker's transactional save replaces any placeholder work item with its submitted tasks.

## Key invariants

1. **Two routes to project creation**: in Tracker create TCYYXXX; in Forecast import Javelin PDF and preserve its original project number. Forecast revision/import logic matches number and adds/reconciles levels on existing shared `projects` row.
2. Server-side RPC `tracker_save_project` locks the year number sequence, honors manually selected suffixes with uniqueness protection, allocates default numbers on server, and validates optimistic project version on edits. All work items are updated in the same transaction.
3. Tracker cannot delete projects with linked Forecast levels, or rename a number that has levels. A project edit must not overwrite Forecast's `project_type` classification where it already has levels. Material and work item statuses are separate.
4. **Do not delete or change Forecast tables/functions/triggers** when developing Tracking. Read `forecast/EWP_FORECAST_HANDOFF.md` before any changes to the Forecast logic.
5. Shared login is through `forecast/auth.mjs` and the origin-scoped localStorage session key. Full portal auth navigation and security controls are Phase 3.
6. New tracking tables use the existing permissive RLS authenticated-team model. Production-hardening or individual row permissions require a separate design.

## Testing and deployment

- Run Phase 2 SQL in the existing Supabase project before pushing the frontend.
- Test Tracker sign in/restore, cloud read, create/edit/delete non-Forecast project, settings persisting on reload, drag Queue → In Progress → Done, cross-browser visibility, and duplicate number races.
- Test Forecast import new projects and import PDF to existing Tracker project, including revisions, Spruce and delivery data retention.
- Syntax checks of `tracker/app.js`, `tracker/cloud.mjs` and original Forecast modules passed. Local graphical browser testing was blocked by the environment (`ERR_BLOCKED_BY_ADMINISTRATOR`), so don't claim production end-to-end verification.
- Data formerly stored only in Tracker V0.5 browser localStorage are not auto-migrated. Existing sales names present in Forecast projects seed Tracker settings on first migration.
- Deploy root contents to GitHub Pages; leave `.nojekyll` in root.

## Phase 2.1 Project # authority and Prefill

- **Project # is the canonical common linking key**, normalized by trimming spaces and casefolding uppercase. `public.projects` is shared.
- Tracker ownership is inferred from non-null `tracker_phase` on a project saved in Tracking. For these records, Tracker controls Sales, Customer, Project Name/Address and Tracker Type; Forecast owns Revision, Level dates, material forecast, Spruce, deliveries and inventory.
- Forecast performs a fresh Supabase project-number lookup when typing and after Javelin PDF extraction. Before review and save, it checks again to protect against out-of-date values.
- Forecast project editing locks Tracker-owned project metadata and only updates revision/date. Reconciliation and legacy bulk import never overwrite Tracker-owned fields.
- No SQL changes in Phase 2.1; existing `phase2_migration.sql` remains the required base migration.

- Tracker saves notify Forecast tabs on the same browser origin through an origin-scoped storage event, and Forecast retains Realtime and visible-tab polling fallback (once per minute).
- Tracker `Other` project types remain in Tracker-specific metadata; Forecast operational forecasting remains limited to existing `SFD` / `Multi` modes. Do not reinterpret Tracker `Other` as a new Forecast computation mode without explicit design approval.

## Phase 3 — Authoritative changes

- Root `portal-auth.mjs` uses `forecast/auth.mjs?v=1.0-p3` and displays a single sign-in form. The existing Supabase session key `ewp_forecast_supabase_session_v08` is retained to avoid forcing another login after upgrading.
- Root `/` is the login and navigation portal. Deep links into `/tracker/` or `/forecast/` redirect unauthenticated users back to `/?next=tracker%2F` or `/?next=forecast%2F`. Validate destinations strictly; never accept arbitrary external URLs.
- Shared `workspace-auth.mjs` checks each tool's login state, displays the signed-in email in the nav, and reacts to cross-tab sign-out. Forecast and Tracker native sign-out buttons now lead back to the portal login.
- `forecast/auth.mjs` reads the latest same-origin persisted session and serializes refreshes with `navigator.locks` where available, limiting refresh races between tabs. Do not introduce duplicate or different `auth.mjs` import query strings within one page.
- Project # deep links: Tracker board cards/list cells → `/forecast/?project=...`; Forecast matrix project headings → `/tracker/?project=...`. Tracker searches by the incoming project number; Forecast goes to its material matrix for projects with levels, or the PDF intake form with prefilled Project # if a Tracker project has no levels.
- `tracker/realtime.mjs` subscribes to shared `projects` plus Tracker tables. Running `phase3_realtime_optional.sql` enables publication of Tracker tables; fallback refresh also works without it. Do not reload the Tracker board automatically while a modal dialog is open, to protect unsaved form edits.
- Root `phase2_migration.sql` and `forecast/supabase_v0_26.sql` are retained as documented setup/recovery scripts but are NOT to be rerun during Phase 3 deployment. Forecast's computation/schema code remains unchanged except navigation, auth import versioning and Project # links.
- No data deletion, no new tables, no RLS policy changes in Phase 3. User-approved Tracker-first conflicts from Phase 2.1 remain authoritative.
- Browser navigation to local HTTP servers can be blocked in the execution environment; mocked browser tests cover portal sign-in states and Tracker interactions, but real Supabase / GitHub Pages tests must still be performed after deployment.
