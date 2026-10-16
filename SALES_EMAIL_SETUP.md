# V1.11 live upgrade — new mandatory Spruce Code + ATS

If V1.10 has ALREADY been deployed to Supabase, **do not rerun `v1_10_sales_requests.sql`.** Back up your data, then run `v1_11_sales_spruce_ats.sql` once in Supabase SQL Editor **before** deploying the V1.11 website. It also incorporates the earlier V1.10 JSONB Tasks/Sales validator hotfix, so you need not run that hotfix again. Older submissions keep a blank (legacy) Spruce Code; only newly submitted requests must supply one. The script adds `ATS` to the existing shared Tasks list without discarding any custom tasks.

**Email redeployment required:** In Supabase → Edge Functions → `sales-request-email` → Code, replace `index.ts` with `supabase/functions/sales-request-email/index.ts` from V1.11 and redeploy so the new Spruce Code appears in email. Do not change the four Resend/Supabase secrets. A V1.10 function left running can still send an email but will OMIT Spruce Code. The existing deployed testing sender `onboarding@resend.dev` remains restricted by Resend to recipients permitted on that account.

Upload the V1.11 website to GitHub Pages, including all paths; keep private secrets out of the public repository. Check the Sales form (Customer → Spruce Code → Project Name), History, email, Portal All/Sales toggle and Settings → Tasks ATS. The Portal filter is DISPLAY-ONLY, not a permission system.

---

# V1.10 — Sales Request email and database setup

**This is a new Supabase-backed tool, not merely a web form.** Uploading the website alone will not send email. The business database, private file storage, and Edge Function must be configured before enabling the form for the team.

## First-time installation (one-time)

1. Back up your existing company Supabase database and V1.9 web source. Check that V1.4, V1.5, and V1.6 migrations are already applied (never rerun historical full schema scripts).
2. Run **`v1_10_sales_requests.sql`** ONCE in the existing Supabase SQL Editor. It creates `sales_requests`, private bucket `ewp-sales-request-files`, safe RLS policies, an atomic notification-claim function, and adds `tracker_settings.phases` (initial choices Awarded and Bidding). It does not create Project Tracking work orders or change Forecast calculations.
3. Create a **Resend** account and verify a sender domain that you are authorized to send email from (e.g., configure DNS for a company-owned domain with IT's permission). **`schung@griff.ca` is the initial TO/recipient address, not automatically an authorized FROM address.** You may test with Resend's `onboarding@resend.dev` limitations while setting up. Don't publish email API credentials in the website.
4. With the Supabase CLI configured for the existing project, set the **Edge Function secrets** server-side (not in GitHub Pages):
   - `RESEND_API_KEY` — Resend API key
   - `SALES_EMAIL_FROM` — verified sender, e.g., `EWP Sales <requests@your-verified-domain.com>`
   - `SALES_NOTIFY_TO` — `schung@griff.ca`
   - `SALES_PORTAL_URL` — the **full existing GitHub Pages portal root** ending in `/`, e.g. `https://your-org.github.io/your-repo/`
   - `SALES_ALLOWED_ORIGIN` — optional browser-origin allowlist, e.g. `https://your-org.github.io` (origin only, without `/repo/`)
   - Supabase automatically provides `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the legacy `SUPABASE_ANON_KEY` in many projects. If no public/anon key is pre-provisioned, set a custom function secret `SALES_PUBLIC_KEY`. If the legacy service-role variable is absent, set a custom `SALES_SERVICE_ROLE_KEY`. **Supabase disallows custom secret names beginning with `SUPABASE_`.** The service-role key must only be in secure server-side environment variables.
5. Deploy the function by Supabase CLI from the package root: `supabase functions deploy sales-request-email`. By default, `supabase/config.toml` requests JWT verification. The function **also independently checks the Supabase Auth user**, reads only saved requests, and obtains the recipient/sender from secrets. Avoid `--no-verify-jwt` unless your Supabase key setup requires it and the Auth check has been validated.
6. Upload the full WEB package to the existing GitHub Pages repository **without** storing the environment variable values. You may keep `supabase/` and `sql/` in the development repository; they are not used or executed by GitHub Pages. In production, consider restricting deployment so only static web assets are publicly hosted.
7. Hard-refresh Portal, Tracking, Forecast, and Sales Requests. Log in as a test employee. From Settings, confirm at least one Sales name, one Task, and the Phase choices. Submit one test request with or without an attachment and verify the email actually arrives at **`schung@griff.ca`**.

## Operational behavior and limitations

- Sales Requests are **separate** from Project Tracking; submitting does *not* automatically allocate a TC project number or create a design task in Queue. Define an intake/acceptance workflow before adding that link.
- Mandatory: Customer, Project Name/Address, Sales, Phase, Due Date, and at least one Task. Optional: Instructions and Drawings/Attachments.
- Attachments are privately stored in Supabase Storage (PDF/JPG/PNG, 10 MB/file, 30 MB total). Email includes a secure deep link to the request instead of attaching confidential plans. Signed file links last 5 minutes. All currently authenticated company team accounts can view the submission list and request attachments; assess roles before admitting external sales users.
- Once the submission row is saved, email notification runs via a server-side Edge Function. The email is **accepted by Resend** when the app shows “sent”; final inbox delivery is not guaranteed (spam filtering, bounce, or company mail routing still apply).
- If email credentials or the Edge Function aren't ready, the **request still saves to Supabase**, with status `pending` or `failed`; do **not** resubmit a duplicate. Use Submission History → Retry Email after configuration. Five retry attempts are allowed by the SQL claim function before an administrator must investigate/reset the row.
- The server uses a stable Resend idempotency key for each request to reduce duplicate delivery during retries, and an atomic SQL claim to avoid concurrent sends. Resend idempotency behavior is bounded by the provider's retention period; exactly-once delivery cannot be guaranteed across every outage.
- If file uploading succeeds but request saving fails, **orphan files may remain** in the private bucket. This is documented, and the team should periodically audit and remove unused objects.
- This package's tests do not send real email or execute live Supabase SQL. Validate against a test database/team account before broad rollout.

## Useful references

- Supabase: https://supabase.com/docs/guides/functions/auth
- Resend sender verification: https://resend.com/docs/dashboard/domains/introduction
- Resend API and idempotency: https://resend.com/docs/api-reference/emails/send-email
