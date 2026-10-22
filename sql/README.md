# Current WEB SQL migration — V1.15

Run **`../v1_15_tracker_linked_colors.sql`** in the SAME Supabase project SQL Editor **before** publishing the V1.15 website. It requires working Tracker task/Coordination schema and does not replace or re-run older migrations. It adds `tracker_active_colors` (authenticated read-only) and atomic `tracker_sync_active_colors()` (authenticated RPC), with no changes to PO, inventory, Forecast or Sales data. Check actual installation of V1.13 and V1.14 separately before deploying; read root `../PORTAL_HANDOFF.md` for required order and tests.

---

# Current WEB SQL migration — V1.14

First confirm `../v1_13_purchasing_receipts.sql` was already executed. Then run `../v1_14_purchase_order_reimport.sql` in your existing Supabase project **before** publishing the V1.14 frontend. It adds a single authenticated transactional PO import/revision RPC, without deleting existing records.

Older migrations (including V1.13) remain in the package for history and upgrade sequencing only; do not rerun ones already deployed. See `../PORTAL_HANDOFF.md` for testing and the intended order.

---

# Current WEB SQL migration — V1.13

Run **`../v1_13_purchasing_receipts.sql`** exactly on top of the existing V1.12 database *before* V1.13 GitHub Pages deployment. Back up first. It adds the atomic purchasing ledger and RPCs without deleting historical records.

All files in `archive/` are historical only. Do **not** rerun them during this upgrade. See `../PORTAL_HANDOFF.md`.

---

# SQL — V1.6 WEB

- **Only apply `../v1_6_forecast_coordination_intake.sql` for the V1.6 update**, on an existing V1.5-compatible Supabase database. Make a backup before running.
- `archive/` contains historical installation and migrations retained for recovery/reference, **not deployment scripts**. They have NOT been deleted or merged into a destructive one-click setup.
- If your database is still on V1.3/V1.4, follow the chronological V1.4 and V1.5 SQL instructions in `PORTAL_HANDOFF.md` *before* applying V1.6.
- Do not rerun archive SQL on your active Supabase just to deploy V1.6.
- SQL archive paths are `sql/archive/<original filename>` (including `supabase_v0_26.sql`).
