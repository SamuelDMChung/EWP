# EWP Order — V1.12 WEB

Standalone Sales order submission; **no automatic Project Tracking / Forecast linking**. Every field required except PO# and Special Notes. UI confirms data before inserting into `ewp_orders`; server-validated record is then emailed via `ewp-order-email` with existing Resend secrets. Separate team Submission History and Retry Email. Schema/Edge Function/website must all be deployed; see `../SALES_EMAIL_SETUP.md`. No live email/RLS verification performed when source was generated.
