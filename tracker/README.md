# V1.4 Tracker independent task cards

For active projects, every `tracker_work_items` record is one Board card linked to the same project #. Task queue, in progress and done are independent, and Finished Tasks are shown inside the In Progress column. When all tasks finish the user manually moves the project to Coordination In Review, which combines into one project card again. Completed means the whole job delivered. Individual task statuses are stored via the existing `tracker_move_work_item` RPC. In edit/new task forms, an empty stored task due date inherits the project due date *visibly*, without saving duplicate dates. Use “Use project due date” to reset an override. Customer/sales separator has wider spacing. One-time deployment reconciliation of legacy all-queued tasks under In Progress projects: see root `v1_4_legacy_task_status_reconciliation.sql`. Full documentation and remaining Forecast TODOs: root `PORTAL_HANDOFF.md`. V1.3 features preserved otherwise.

---

# Project Tracking — V1.3 UI addendum

The Project Tracking Board keeps four columns and one project-level status (Queue, In Progress, Coordination with Pending/In Review/Delivering, Completed). It now defaults to **Compact** cards; users can select Detailed and the browser remembers their presentation preference. Coordination/Completed hide historical drafting due dates and assignees on Board cards only. The three existing colored Coordination header pills are active shortcuts for the *existing main status filter*, which also drives saved-filter chips and List; there is no second filter state. Compact Coordination statuses are editable from their colored native select. Settings has a visible labeled button in the Tracker header. All other workflows are preserved. **No V1.3 SQL; the V1.2 project-status migration must already be present.** See root `PORTAL_HANDOFF.md`.

---

## V1.2 update

The Board and List now display **one card/row per project** with a shared `projects.tracker_status`; columns Queue, In Progress, Coordination (Pending/In Review/Delivering), Completed. Project work-item entries remain for task/assignee/due-date metadata but **do not provide separate workflow statuses**. Coordination receives new projects as In Review when dragged in, and can be manually set to Pending or Delivering. An Edit Project status selector is also provided. Original filtered/saved filter UI retained. Follow-up defaults to All statuses, copies subject/body separately, and greets salesperson by first name. New `v1_2_project_status_migration.sql` at repository root **must be run before deploying**. See canonical root PORTAL_HANDOFF.md.

# Project Tracking — V1.1 Follow-up addendum

Follow-up is a third tab next to Board/List. It uses the existing shared `projects` and `tracker_work_items` data already loaded through `loadTrackerCloud()`; no additional SQL is needed. Select a salesperson, apply optional filters, select projects, edit the drafted email and Copy Email to your clipboard. Project numbers, clients and addresses are collected once per project, even when multiple work items exist. Defaults exclude Done projects but can be changed. No messages are sent, stored or logged, and no follow-up persistence is added. Existing Board/List saved filters remain separate and unchanged. See root `PORTAL_HANDOFF.md` for migration rules and company-side tests.

---

**Phase 2 update:** Project Tracking now saves projects, work items, settings and saved filters in Supabase. See the repository root `README.md` and `phase2_migration.sql` for setup before deployment.

# EWP Project Tracker V0.5

Local browser prototype for EWP project/work tracking.

## V0.5 major change — one project, multiple work items

A project now keeps one permanent project number while containing one or more independently assigned work items.

Example:
- TC26042 — Dimension Lumber Takeoff — Sarah — In Progress
- TC26042 — EWP Takeoff — Sam — Queue
- TC26042 — EWP Design — John — Queue

The project number is not duplicated; the Board and List display the individual work items.

### Behavior
- Board cards represent work items, not whole projects.
- Dragging a card changes only that work item's status.
- Each work item has Task, Assignee, Status, and an optional Task Due Date.
- If Task Due Date is blank, it uses the project's Due Date.
- Project status is automatic:
  - all work items Queue -> Queue
  - all work items Done -> Done
  - anything in between -> In Progress
- Clicking any Board card or List row opens the parent project and all its work items for editing.
- Existing V0.4 single-task projects are automatically migrated into one V0.5 work item.
- Existing saved filters remain compatible; Task, Assignee, and Status now filter individual work items.
- Search/filter results show work-item counts and project counts.

## Existing features retained
- TCYYXXX numbering with non-recycled automatic sequence
- hard duplicate project-number prevention
- editable last three project-number digits
- Sales, Customer, Address, Phase, Project Type, >14-inch TJI, APL Required, Date Submitted, Due Date
- Settings for Sales, Assignee, and Task options
- Board / List views
- shared multi-select search/filter system
- saved filters
- project deletion without rolling the number counter backward
- local browser persistence

## Testing
Unzip the folder and open `index.html` in Chrome or Edge.
