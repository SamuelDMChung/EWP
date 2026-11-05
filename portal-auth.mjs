/* V1.38: staged native Supabase TOTP verification and administrator approval. */
import { restoreSession, signInWithPassword, signOut, getLastEmail, getAccessToken, EWP_AUTH_STORAGE_KEY } from './forecast/auth.mjs?v=1.38';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './forecast/config.mjs';
import { portalViewFromUrl, setWorkspaceView } from './portal-views.mjs?v=1.24';
import { mfaStatus,mfaList,mfaEnroll,mfaVerify,mfaSubmit,currentAal } from './mfa-client.mjs?v=1.38';
const $=id=>document.getElementById(id);
let authenticated=false, connectionAttempt=0, mfaInfo=null, activeFactorId=null, setupFactorId=null;
let mfaOpenExplicitly=false, mfaStatusError='';
function safeNext(){const wanted=new URLSearchParams(location.search).get('next')||'';return /^(?:tracker|forecast|sales|orders|sales-tracking|ewp-tools|ewp-tools\/consolidate-material-list)\/(?:\?[^#]*)?$/.test(wanted)?wanted:'';}
function showError(text){$('portalLoginError').textContent=text||'';$('portalLoginError').hidden=!text;}
function setStatus(state,label){const el=$('portalCloudPill');el.className=`cloud-pill ${state}`;el.textContent=label;el.title=label;}
async function verifyConnection(){if(!authenticated||$('portalWorkspace').hidden)return;const attempt=++connectionAttempt;setStatus('connecting','Connecting to shared data…');try{
 const token=await getAccessToken();if(!token)throw new Error('Authentication unavailable');
 const response=await fetch(`${SUPABASE_URL.replace(/\/$/,'')}/rest/v1/tracker_settings?select=id&id=eq.global&limit=1`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'});
 if(!response.ok)throw new Error(`Supabase responded ${response.status}`);
 if(attempt===connectionAttempt&&authenticated)setStatus('connected','Shared data connected');
}catch(error){if(attempt===connectionAttempt&&authenticated){setStatus('error','Shared data connection issue');$('portalCloudPill').title=error.message;}}}
function notice(text){$('portalMfaMessage').textContent=text||'';}
function mfaPendingStatus(){return mfaInfo?.status||'not_enrolled';}
function isGateRequired(){return mfaInfo?.enforcement_enabled===true && !mfaInfo?.allowed;}
async function showMfaPanel(){
 $('portalMfa').hidden=false;$('portalWorkspace').hidden=true;$('portalMfaQr').hidden=true;$('portalMfaForm').hidden=true;
 $('portalMfaStart').hidden=true;$('portalMfaBack').hidden=!!mfaInfo?.enforcement_enabled;
 $('portalMfaCode').value='';activeFactorId=null;setupFactorId=null;
 if(mfaStatusError){notice('2FA configuration is not available: '+mfaStatusError);return;}
 try{
  const factors=await mfaList();const verified=(factors?.totp||factors?.all||[]).filter(f=>f.factor_type==='totp'&&f.status==='verified');
  if(!verified.length){
    notice('Set up an authenticator app. Your administrator must verify your identity before approving the new device.');
    $('portalMfaStart').hidden=false;return;
  }
  if(verified.length!==1){notice('Multiple verified authenticators detected. Contact the administrator for a secure account reset.');return;}
  activeFactorId=verified[0].id;
  if(currentAal()!=='aal2'){
    notice('Enter the current six-digit code from your authenticator app.');
    $('portalMfaForm').hidden=false;return;
  }
  if(mfaPendingStatus()==='approved' && mfaInfo?.allowed){
    notice('Your approved authenticator is verified. You may continue.');$('portalMfaBack').hidden=false;return;
  }
  if(mfaPendingStatus()==='not_enrolled'||mfaPendingStatus()==='rejected'){
    await mfaSubmit(activeFactorId);mfaInfo=await mfaStatus();
  }
  notice(mfaPendingStatus()==='pending'?'Authenticator verified. Waiting for administrator identity approval.':'Your authenticator requires administrator review.');
 }catch(error){notice(error?.message||'Unable to check your authenticator.');}
}
async function setSession(session){
 authenticated=!!session?.user;$('portalAuthLoading').hidden=true;
 $('portalLogin').hidden=authenticated;$('portalWorkspace').hidden=true;$('portalMfa').hidden=true;
 $('portalHeaderActions').hidden=!authenticated;
 $('portalCurrentEmail').textContent=authenticated?(session.user.email||'Signed-in employee'):'';
 const navAccount=$('ewpNavAccount');if(navAccount)navAccount.textContent=authenticated?(session.user.email||'Signed in'):'';
 if(!authenticated){connectionAttempt++;setStatus('connecting','Connecting to shared data…');mfaInfo=null;return;}
 try{mfaInfo=await mfaStatus();mfaStatusError='';}
 catch(error){mfaInfo=null;mfaStatusError=error?.message||'2FA check failed';}
 const admin=!!mfaInfo?.is_admin && mfaInfo?.status==='approved'&&mfaInfo?.verified_factor_count===1&&currentAal()==='aal2';
 window.dispatchEvent(new CustomEvent('ewp:mfa-status',{detail:{isAdmin:admin}}));
 if(isGateRequired()||mfaOpenExplicitly){await showMfaPanel();return;}
 $('portalWorkspace').hidden=false;
 const banner=$('portalMfaBanner');banner.hidden=!mfaInfo|| (mfaInfo?.status==='approved'&&currentAal()==='aal2');
 $('portalMfaBannerText').textContent=mfaInfo?.status==='pending'?'Authenticator awaiting administrator approval. The portal is still in setup mode.':mfaInfo?.status==='approved'?'Complete authenticator verification.':'Protect your account: register an authenticator before mandatory 2FA is enabled.';
 const next=safeNext();if(next){location.replace(new URL(next,location.href).href);return;}
 verifyConnection();
}
async function reloadMfa(){if(!authenticated)return;try{mfaInfo=await mfaStatus();mfaStatusError='';}catch(e){mfaStatusError=e.message;}await setSession(await restoreSession());}
async function init(){
 for(const button of document.querySelectorAll('[data-workspace-view]'))button.addEventListener('click',()=>setWorkspaceView(button.dataset.workspaceView,{updateUrl:true}));
 window.addEventListener('popstate',()=>setWorkspaceView(portalViewFromUrl()));setWorkspaceView(portalViewFromUrl());
 $('portalLoginEmail').value=getLastEmail();
 $('portalLoginForm').addEventListener('submit',async ev=>{ev.preventDefault();const btn=$('portalLoginButton');btn.disabled=true;btn.textContent='Signing in…';showError('');try{
  const session=await signInWithPassword($('portalLoginEmail').value,$('portalLoginPassword').value);$('portalLoginPassword').value='';mfaOpenExplicitly=false;await setSession(session);
 }catch(e){showError(e?.message||'Sign-in failed.');}finally{btn.disabled=false;btn.textContent='Sign in';}});
 async function logOut(){if(!confirm('Sign out of EWP Management on this browser?'))return;await signOut();mfaOpenExplicitly=false;await setSession(null);}
 $('portalSignOut').addEventListener('click',logOut);$('portalMfaSignOut').addEventListener('click',logOut);
 $('portalRefresh').addEventListener('click',verifyConnection);
 $('portalMfaOpen').addEventListener('click',async()=>{mfaOpenExplicitly=true;await setSession(await restoreSession());});
 $('portalMfaBack').addEventListener('click',async()=>{if(mfaInfo?.enforcement_enabled)return;mfaOpenExplicitly=false;await setSession(await restoreSession());});
 $('portalMfaRefresh').addEventListener('click',async()=>{await reloadMfa();});
 $('portalMfaStart').addEventListener('click',async()=>{const btn=$('portalMfaStart');btn.disabled=true;try{
  const data=await mfaEnroll();setupFactorId=data?.id;activeFactorId=setupFactorId;
  if(!data?.totp?.qr_code||!setupFactorId)throw new Error('No enrollment QR code was returned.');
  const svg=data.totp.qr_code;$('portalMfaQrImage').src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));
  $('portalMfaQr').hidden=false;$('portalMfaForm').hidden=false;$('portalMfaCode').value='';
  notice('Scan the QR with your authenticator, then enter its code. Never share the QR code.');btn.hidden=true;
 }catch(e){notice(e?.message||'Authenticator setup failed.');}finally{btn.disabled=false;}});
 $('portalMfaForm').addEventListener('submit',async ev=>{ev.preventDefault();const code=$('portalMfaCode').value.trim();if(!/^\d{6}$/.test(code))return;
 const btn=$('portalMfaVerify');btn.disabled=true;try{
  await mfaVerify(activeFactorId,code);
  if(setupFactorId)await mfaSubmit(setupFactorId);
  mfaOpenExplicitly=true;await setSession(await restoreSession());
 }catch(e){notice(e?.message||'Verification failed. Try a new code.');}finally{btn.disabled=false;}});
 window.addEventListener('storage',async ev=>{if(ev.key!==EWP_AUTH_STORAGE_KEY)return;try{await setSession(await restoreSession());}catch{await setSession(null);}});
 try{await setSession(await restoreSession());}catch{await setSession(null);showError('Could not restore your session. Sign in again.');}
}
init();
