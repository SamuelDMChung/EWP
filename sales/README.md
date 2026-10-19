## V1.12 — New EWP Requests

Spruce Code is **no longer requested or required**. Server-side V1.12 migration removes the requirement even when V1.11 SQL was already installed. Old column/data remain in Supabase if previously created. Request history, shared ATS Tasks, attachments and email retry remain supported.

Do not publish frontend changes without first running `../v1_12_ewp_orders.sql` and redeploying `sales-request-email` from this release. See root `SALES_EMAIL_SETUP.md`.

---

## V1.11 WEB (October 16, 2026)

- New required Spruce Code and shared ATS task; New EWP Requests name; Portal All/Sales filter preserving identical two-column card sizes.
- **Deployment:** run `v1_11_sales_spruce_ats.sql` (upgrade from V1.10), redeploy `sales-request-email` Edge Function with included updated `index.ts`, then publish V1.11 web files. See `SALES_EMAIL_SETUP.md` and `PORTAL_HANDOFF.md`.
- The V1.10 historical SQL is corrected for fresh installs but must NOT be rerun in a live upgraded database. The new migration also incorporates the old SQL validator hotfix.

# Sales Requests — V1.10 WEB

Use the same Supabase sign-in as Tracker/Forecast. Requires `../v1_10_sales_requests.sql` and Edge Function `../supabase/functions/sales-request-email/index.ts`. See `../SALES_EMAIL_SETUP.md` for complete setup and email provider verification. Private PDF/JPG/PNG attachments optional; saved requests persist even when email service is not configured. Email recipient: `schung@griff.ca`. No automatic Project Tracker project creation.
