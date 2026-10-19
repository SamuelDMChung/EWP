import { restoreSession, signInWithPassword, signOut, getLastEmail, getAccessToken, EWP_AUTH_STORAGE_KEY } from "./forecast/auth.mjs?v=1.0-p3";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./forecast/config.mjs";
const $ = id => document.getElementById(id);
let authenticated = false;
let connectionAttempt = 0;
function safeNext() {
  const requested = new URLSearchParams(location.search).get("next") || "";
  return /^(?:tracker|forecast|sales|orders)\/(?:\?[^#]*)?$/.test(requested) ? requested : "";
}
function showError(message) { $("portalLoginError").textContent=message || "Could not sign in."; $("portalLoginError").hidden=!message; }
function setStatus(state,label) {
  const pill=$("portalCloudPill"); pill.className=`cloud-pill ${state}`; pill.textContent=label;
  pill.title=label;
}
async function verifyConnection() {
  if (!authenticated) return;
  const attempt=++connectionAttempt;
  setStatus('connecting','Connecting to shared data…');
  try {
    const token=await getAccessToken();
    if (!token) throw new Error('Authentication is unavailable.');
    const response=await fetch(`${SUPABASE_URL.replace(/\/$/,'')}/rest/v1/tracker_settings?select=id&id=eq.global&limit=1`, {
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'
    });
    if (!response.ok) throw new Error(`Supabase responded ${response.status}`);
    if (attempt===connectionAttempt && authenticated) setStatus('connected','Shared data connected');
  } catch(error) {
    if (attempt===connectionAttempt && authenticated) { setStatus('error','Shared data connection issue'); $("portalCloudPill").title=error.message; }
  }
}
function setSession(session) {
  authenticated=!!session?.user;
  $("portalAuthLoading").hidden=true;
  $("portalLogin").hidden=authenticated;
  $("portalWorkspace").hidden=!authenticated;
  $("portalHeaderActions").hidden=!authenticated;
  $("portalCurrentEmail").textContent=authenticated?(session.user.email || 'Signed-in employee'):'';
  const navAccount=$("ewpNavAccount"); if(navAccount) navAccount.textContent=authenticated?(session.user.email||'Signed in'):'';
  if(authenticated){
    const next=safeNext();
    if(next){location.replace(new URL(next,location.href).href); return;}
    verifyConnection();
  } else {connectionAttempt++;setStatus('connecting','Connecting to shared data…');}
}
function setWorkspaceView(view) {
  const selected=view==='sales'?'sales':'all';
  for(const button of document.querySelectorAll('[data-workspace-view]')) {
    const active=button.dataset.workspaceView===selected;
    button.classList.toggle('is-selected',active);
    button.setAttribute('aria-pressed',String(active));
  }
  for(const card of document.querySelectorAll('.workspace-card[data-workspace-role="staff"]'))
    card.hidden=selected==='sales';
}
async function init() {
  for(const button of document.querySelectorAll('[data-workspace-view]'))
    button.addEventListener('click',()=>setWorkspaceView(button.dataset.workspaceView));
  setWorkspaceView('all');
  $("portalLoginEmail").value=getLastEmail();
  $("portalLoginForm").addEventListener('submit',async event=>{
    event.preventDefault();const button=$("portalLoginButton");button.disabled=true;button.textContent='Signing in…';showError('');
    try{const session=await signInWithPassword($("portalLoginEmail").value,$("portalLoginPassword").value);$("portalLoginPassword").value='';setSession(session);}
    catch(error){showError(error?.message||'Sign-in failed. Please try again.');}
    finally{button.disabled=false;button.textContent='Sign in';}
  });
  $("portalSignOut").addEventListener('click',async()=>{if(!confirm('Sign out of EWP Management on this browser?'))return;await signOut();setSession(null);});
  $("portalRefresh").addEventListener('click',()=>verifyConnection());
  window.addEventListener('storage',async event=>{
    if(event.key!==EWP_AUTH_STORAGE_KEY)return;
    if(!event.newValue){setSession(null);return;}
    try{setSession(await restoreSession());}catch{setSession(null);}
  });
  try{setSession(await restoreSession());}catch{setSession(null);showError('Could not restore your session. Please sign in again.');}
}
init();
