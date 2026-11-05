/* V1.38: Supabase native TOTP and staged administrator-approval client.
   The browser never receives service-role credentials, approvals or TOTP secrets of others. */
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './forecast/config.mjs';
import { getCurrentSession, getAccessToken, acceptMfaSession } from './forecast/auth.mjs?v=1.38';
const BASE = SUPABASE_URL.replace(/\/$/,'');
async function request(path, body, method='POST') {
  const token = await getAccessToken();
  if (!token) throw new Error('Sign in again to continue.');
  const response=await fetch(`${BASE}${path}`,{method,headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const raw=await response.text();let json;try{json=JSON.parse(raw)}catch{json=raw}
  if(!response.ok)throw new Error(json?.msg||json?.message||json?.error_description||json?.error||`Supabase ${response.status}`);
  return json;
}
export async function mfaStatus(){return request('/rest/v1/rpc/ewp_mfa_status',{});}
export async function mfaList(){return request('/auth/v1/factors',undefined,'GET');}
export async function mfaEnroll(){return request('/auth/v1/factors',{factor_type:'totp',friendly_name:'EWP Management Portal '+Date.now()});}
export async function mfaChallenge(factorId){return request(`/auth/v1/factors/${encodeURIComponent(factorId)}/challenge`,{});}
export async function mfaVerify(factorId,code){
 const challenge=await mfaChallenge(factorId);
 const data=await request(`/auth/v1/factors/${encodeURIComponent(factorId)}/verify`,{challenge_id:challenge.id,code});
 if(!data?.access_token||!data?.refresh_token)throw new Error('Verification returned no updated session. Sign in again.');
 acceptMfaSession(data);return data;
}
export async function mfaSubmit(factorId){return request('/rest/v1/rpc/ewp_mfa_submit',{p_factor_id:factorId});}
export async function mfaPending(){return request('/rest/v1/rpc/ewp_mfa_pending',{});}
export async function mfaDecide(userId,factorId,approve){return request('/rest/v1/rpc/ewp_mfa_decide',{p_user_id:userId,p_factor_id:factorId,p_approve:!!approve});}
export async function mfaAdminList(){return request('/rest/v1/rpc/ewp_mfa_admin_list',{});}
export async function mfaRevoke(userId,factorId){return request('/rest/v1/rpc/ewp_mfa_revoke',{p_user_id:userId,p_factor_id:factorId});}
export function currentAal(){
 try { const token=getCurrentSession()?.access_token?.split('.')[1]; if(!token)return 'aal1'; const fixed=token.replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(fixed))?.aal||'aal1'; }catch{return 'aal1';}
}
