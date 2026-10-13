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
