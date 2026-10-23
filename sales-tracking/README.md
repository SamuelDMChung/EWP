# Sales Project Tracking — V1.23 WEB

Adds **All Sales** as the first valid selection. The app reads all assigned salespeople's projects with existing authenticated, read-only Supabase REST GET requests; projects with blank `sales` fields are excluded. Active task rows and consolidated Coordination/Completed project rows retain the V1.17 rules. All Sales presents a client-side Salesperson filter in addition to search, status, phase and type; individual choice keeps the original exact salesperson query. Refresh/sorting/change selection work as before. This does not change database access permissions, schema, data or auth. See `../tests/V1_23_TEST_RESULTS.md`.

---

# Sales Project Tracking — V1.21 WEB

After salesperson selection, the results list displays **Search** across visible columns plus **Status**, **Phase**, **Type** dropdowns and **Clear filters**. Filters combine with sorting and operate only on existing read-only rows fetched for that salesperson; refresh preserves filters; switching salesperson clears them. Counts show matches and source totals. Type Others covers stored free-text custom type descriptions. No schema/RLS/write changes. Test in light/dark modes and `?view=sales`.

---

# Sales Project Tracking — V1.17 WEB

Sales-facing read-only view under `sales-tracking/`. Linked from Portal All and Sales display modes; no separate data storage or SQL migration.

## UI

- Initial single-select dropdown of salesperson names from `tracker_settings.sales`, sorted alphabetically. Selection immediately opens the project list.
- Results screen hides the salesperson dropdown completely, displays the selected name and **Change Salesperson** button to return to the empty dropdown.
- Table columns in requested order: Project #, Address, Task, Status, Customer, Sales, Phase, Type, Project Due. Sortable by header; project number descending initially. Horizontal scroll on narrow screens.
- Active on-plate projects: one row per independent work item, with task-level status (`done` displayed In Review, matching the main Tracking Board's completed individual task card).
- Coordination or Completed projects: one row per project; merged names of tasks shown in Task field (blank displays `—`), status from `projects.tracker_status`.
- Project Type supports SFD, Multi, Duplex, Multiplex, Townhome, Others, with an existing detailed Others description displayed where stored. Blank project due dates display `—`.

## Database / security

- Uses existing shared `forecast/auth.mjs` session, Supabase publishable key and authenticated REST GET requests. **No new tables, writes, or access policies.** RLS on existing `projects`, `tracker_work_items`, `tracker_settings` still applies. The Sales Portal toggle controls presentation only and **does not restrict permissions**.
- Fetches configured names first; on selection filters `projects` by exact Sales name on the Supabase server, then loads work items for only those projects in 75-ID chunks. Page through batches of up to 1000 rows. No duplicate project data created.
- Reuses Tracker Realtime subscription for opportunistic refresh; also refreshes on focus, tab visibility and cross-tab Tracker change signals; Refresh button available.
- Shared Settings button uses `shared-settings.mjs`. Theme follows existing `theme.js` local preference.

## QA

Open the Portal with `?view=sales`, then navigate to the Sales Project Tracking card. Test one salesperson with a multi-task project, one with Coordination/Delivering records, changed tasks/statuses in another Tracker tab, and switching back to choose another name. Verify the list cannot edit records. Confirm auth redirects to `../?next=sales-tracking%2F` when signed out, that the same session persists on refresh, and that light/dark mode remain readable.
