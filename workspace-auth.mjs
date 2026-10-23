import { restoreSession, EWP_AUTH_STORAGE_KEY } from "./forecast/auth.mjs?v=1.0-p3";
const label = document.getElementById("ewpNavAccount");
// Resolve from this root-level module URL; pages may be nested two directories deep.
const portalUrl=new URL('./',import.meta.url);
const relativePath=location.pathname.startsWith(portalUrl.pathname)
  ? location.pathname.slice(portalUrl.pathname.length)
  : 'forecast/';
const allowed=new Set(['tracker/','forecast/','sales/','orders/','sales-tracking/','ewp-tools/','ewp-tools/consolidate-material-list/']);
const workspace=allowed.has(relativePath)?relativePath:'forecast/';
function redirectToPortal() {
  const url=new URL(portalUrl);
  url.searchParams.set('next',workspace+location.search);
  location.replace(url.href);
}
function show(session) {
  if (label) label.textContent = session?.user?.email || "";
}
window.addEventListener("storage", async event => {
  if (event.key !== EWP_AUTH_STORAGE_KEY) return;
  if (!event.newValue) { redirectToPortal(); return; }
  try { show(await restoreSession()); } catch { redirectToPortal(); }
});
restoreSession().then(session => {
  if (!session?.user) redirectToPortal();
  else show(session);
}).catch(() => redirectToPortal());
