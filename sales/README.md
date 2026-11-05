# V1.37 — New EWP Requests task and upload simplification (November 4, 2026)

- `Full Takeoff` is filtered from **New EWP Requests** Task checkboxes only. This does not change the shared Tracker Tasks configuration, project tracking or existing history.
- The V1.36 SharePoint File Request panel/button, project-label copy, confirmation, link fetch and automatic SharePoint note in new requests are removed. Previously saved instructions/history remain unchanged.
- Existing private Supabase PDF/JPG/PNG attachments (10 MB each, 30 MB total), request submission, email notification and signed downloads remain.
- No SQL migration required. The historical V1.36 configuration table may remain in Supabase unused. Do not run historical SharePoint setup SQL for V1.37.

---

# V1.36 — SharePoint upload handoff (Nov 3, 2026)

The New EWP Requests form now includes a large-plan **Open SharePoint File Request** link loaded from an authenticated Supabase configuration row. It deliberately does not expose the bearer URL in public HTML/JS. Sales copies the customer/project label, renames plan files before uploading, performs the upload at SharePoint, then returns to submit the form. An optional checkbox records the salesperson's statement that plans were uploaded; this is appended to the existing Instructions field for history/email. It is not a verified SharePoint upload status. There is no automatic linking or downloading via Submission History.

Run `../v1_36_sharepoint_file_request.sql`, then the **separately supplied PRIVATE SQL seed** outside of public source. See `../PORTAL_HANDOFF.md` for setup, security, limitations and deployment. Existing small Supabase attachments, request validation/notifications and all other behavior are retained.

---

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
