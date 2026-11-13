"""V1.41 offline Chromium: real portal and MFA client modules, simulated Supabase REST.
No production service, no real account, and no Google Authenticator verification.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
html=re.sub(r'<link\b[^>]*>', '', html)
html=re.sub(r'<script\b[^>]*>\s*</script>', '', html)
html=html.replace('</head>','<style>'+(ROOT/'portal.css').read_text()+'</style></head>')
strip=lambda p: re.sub(r'^import .*?;\s*$', '', (ROOT/p).read_text(),flags=re.M)
# Real application logic, not stubbed MFA API calls.
mfa=strip('mfa-client.mjs').replace('export async function','async function').replace('export function','function')
portal=strip('portal-auth.mjs')
stubs=r'''const EWP_AUTH_STORAGE_KEY='auth';
const SUPABASE_URL='https://mock.supabase.test';const SUPABASE_PUBLISHABLE_KEY='publishable-key';
const state=window.__mfaState={aal:'aal1',status:'not_enrolled',factor:false,authenticated:false,requests:[]};
let restored=null;
const makeToken=aal=>'head.'+btoa(JSON.stringify({aal})).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')+'.sig';
function getCurrentSession(){return restored;}
function acceptMfaSession(payload){restored={...restored,...payload};state.aal='aal2';state.factor=true;return restored;}
function restoreSession(){return Promise.resolve(restored);}
function signInWithPassword(email,password){restored={user:{email,id:'user1'},access_token:makeToken('aal1'),refresh_token:'initial'};state.authenticated=true;return Promise.resolve(restored);}
function signOut(){restored=null;return Promise.resolve();}
function getLastEmail(){return '';}
function getAccessToken(){return Promise.resolve(restored?.access_token||'');}
function setWorkspaceView(){}function portalViewFromUrl(){return 'all';}
window.fetch=async (url, init={})=>{
 let path=new URL(url).pathname,method=init.method||'GET';state.requests.push({path,method});
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 if(path==='/auth/v1/user' && method==='GET')return reply({id:'user1',factors:state.factor?[{id:'factor1',factor_type:'totp',status:'verified'}]:[]});
 if(path==='/auth/v1/factors' && method==='POST')return reply({id:'factor1',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120"/></svg>'}});
 if(path==='/auth/v1/factors/factor1/challenge' && method==='POST')return reply({id:'challenge1'});
 if(path==='/auth/v1/factors/factor1/verify' && method==='POST')return reply({access_token:makeToken('aal2'),refresh_token:'rotated',expires_in:3600});
 if(path==='/rest/v1/rpc/ewp_mfa_status')return reply({status:state.status,is_admin:false,verified_factor_count:state.factor?1:0,enforcement_enabled:false,allowed:true});
 if(path==='/rest/v1/rpc/ewp_mfa_submit'){state.status='pending';return reply({});}
 if(path==='/rest/v1/tracker_settings')return reply([{id:'global'}]);
 return reply({message:'Unexpected mock URL '+method+' '+path},405);
};'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in (1280,390):
  page=browser.new_page(viewport={'width':width,'height':920})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html)
  page.add_script_tag(content=stubs+'\n'+mfa+'\n'+portal)
  page.locator('#portalLogin').wait_for(state='visible')
  page.locator('#portalLoginEmail').fill('employee@example.com')
  page.locator('#portalLoginPassword').fill('secret')
  page.locator('#portalLoginButton').click()
  page.locator('#portalMfaOpen').wait_for(state='visible')
  page.locator('#portalMfaOpen').click()
  page.locator('#portalMfaStart').wait_for(state='visible')
  assert page.locator('#portalMfaMessage').inner_text().find('Google Authenticator')>=0
  page.locator('#portalMfaStart').click()
  page.locator('#portalMfaQrImage').wait_for(state='visible')
  assert 'Google Authenticator' in page.locator('#portalMfaQr').inner_text()
  page.locator('#portalMfaCode').fill('123456')
  page.locator('#portalMfaVerify').click()
  page.get_by_text('Waiting for administrator identity approval').wait_for(state='visible')
  data=page.evaluate('window.__mfaState')
  assert data['status']=='pending' and data['aal']=='aal2' and data['factor'],data
  paths=[(r['method'],r['path']) for r in data['requests']]
  assert ('GET','/auth/v1/user') in paths, paths
  assert ('POST','/auth/v1/factors') in paths, paths
  assert ('POST','/auth/v1/factors/factor1/challenge') in paths, paths
  assert ('POST','/auth/v1/factors/factor1/verify') in paths, paths
  assert ('GET','/auth/v1/factors') not in paths,paths
  assert not errors,errors
  page.screenshot(path=str(ROOT/f'tests/v1_41_mfa_{width}.png'))
  print(f'PASS V1.41 browser {width}px: real MFA client -> mock Auth REST, TOTP pending, no 405. {len(paths)} requests')
  page.close()
 browser.close()
