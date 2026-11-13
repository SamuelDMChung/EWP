/** V1.41: Real MFA client module code, mock wire API / session (NO production access). */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let assertions=0;const check=(...args)=>{assert.ok(...args);assertions++};
const root=new URL('../',import.meta.url);
let source=fs.readFileSync(new URL('../mfa-client.mjs', import.meta.url),'utf8');
source=source.replace(/^import\s+.*?;\s*$/gm,'').replaceAll('export async function ','async function ').replaceAll('export function ','function ');
const routes=[],state={factors:[],aal:'aal1',saved:false};
let should405=false;
const token=aal=>'head.'+Buffer.from(JSON.stringify({aal})).toString('base64url')+'.sig';
const context={URL,Date,console,atob,encodeURIComponent,SUPABASE_URL:'https://testing.supabase.local',SUPABASE_PUBLISHABLE_KEY:'publishable',
 getAccessToken:async()=>token(state.aal),getCurrentSession:()=>({access_token:token(state.aal)}),
 acceptMfaSession:payload=>{check(!!payload.refresh_token);state.aal='aal2';state.saved=true;},
 fetch:async(url,init)=>{const route=new URL(url);routes.push({path:route.pathname,init});
  const respond=(payload,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(payload)});
  if(should405)return respond({},405);
  if(route.pathname==='/auth/v1/user')return respond({id:'test-user',factors:state.factors});
  if(route.pathname==='/auth/v1/factors'&&init.method==='POST')return respond({id:'totp-id',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg"></svg>'}});
  if(route.pathname==='/auth/v1/factors/totp-id/challenge')return respond({id:'challenge-id'});
  if(route.pathname==='/auth/v1/factors/totp-id/verify')return respond({access_token:token('aal2'),refresh_token:'rotate'});
  if(route.pathname==='/rest/v1/rpc/ewp_mfa_submit')return respond({ok:true});
  if(route.pathname==='/rest/v1/rpc/ewp_mfa_status')return respond({status:'pending',is_admin:false,enforcement_enabled:false});
  return respond({message:'Mock unexpected '+route.pathname},404);
 }};
vm.createContext(context);vm.runInContext(source+'\nthis.v41={mfaList,mfaEnroll,mfaChallenge,mfaVerify,mfaSubmit,mfaStatus,currentAal};',context);
const a=context.v41;
const empty=await a.mfaList();check(empty.totp.length===0);check(routes[0].path==='/auth/v1/user');check(routes[0].init.method==='GET');check(!!routes[0].init.headers.Authorization);
state.factors=[{id:'totp-id',factor_type:'totp',status:'verified',friendly_name:'test'},{id:'pending-id',factor_type:'totp',status:'unverified'},{id:'phone-id',factor_type:'phone',status:'verified'}];
const listed=await a.mfaList();check(listed.totp.length===1);check(listed.totp[0].id==='totp-id');check(listed.all.length===3);check(listed.phone.length===1);
state.factors=[];
const enrolled=await a.mfaEnroll();check(enrolled.id==='totp-id');check(routes.at(-1).path==='/auth/v1/factors');check(routes.at(-1).init.method==='POST');check(JSON.parse(routes.at(-1).init.body).factor_type==='totp');
const verified=await a.mfaVerify('totp-id','123456');check(state.aal==='aal2');check(state.saved);check(verified.refresh_token==='rotate');check(routes.some(r=>r.path==='/auth/v1/factors/totp-id/challenge'));check(routes.some(r=>r.path==='/auth/v1/factors/totp-id/verify'));
await a.mfaSubmit('totp-id');check(routes.at(-1).path==='/rest/v1/rpc/ewp_mfa_submit');check(JSON.parse(routes.at(-1).init.body).p_factor_id==='totp-id');
check(a.currentAal()==='aal2');
should405=true;await assert.rejects(a.mfaList(),/Auth method unavailable.*GET \/auth\/v1\/user/);assertions++;
should405=false;check(!routes.some(r=>r.path==='/auth/v1/factors'&&r.init.method==='GET'));
console.log(`PASS V1.41 MFA client regression (${assertions} assertions), correct Auth /user GET and enrollment POST/challenge/verify chain.`);
