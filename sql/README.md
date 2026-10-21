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
