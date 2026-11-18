# V1.43 WEB — Deployment Instructions

1. Back up your GitHub Pages repository, then extract the **entire** `EWP_Management_Portal_V1_43_WEB_FULL.zip` into its root, including `.nojekyll` and all directories. Do not deploy just `logic.mjs`.
2. Commit and push. Wait for GitHub Pages deployment to complete, then hard refresh (`Ctrl+Shift+R`) the portal.
3. Confirm the footer on all eleven WEB pages shows **V1.43 WEB · Developed by Samuel Chung**.
4. In EWP Tools → Javelin vs. Spruce PDF Checker, upload the original Goat Ridge Javelin Main Floor and Spruce order 2611-C12951 PDFs. Under `Show`, select **Matches** (or **All items**). Verify **LVL 2.0E · 1.75″ × 7.25″ — MATCH** at **11 × 9′, 99 LF** each, Javelin p.1 and Spruce p.3. Confirm the previous separate 99 LF extra/missing alerts are gone.
5. Recheck older Page-Break Triplex (PSL 4×7′), Framing 209 and no-number Second Floor cases after deployment. The PDF.js CDN is not tested by offline fixture runs, so live validation is essential.
6. No new SQL, Edge Function, Resend or Supabase redeployment required. Do not change MFA enforcement settings.

**Safety:** Customer PDFs and coordinate-replay data are NOT in the public ZIP. PDF Checker remains a review aid and should not independently authorize material purchases.
