"""Offline Chromium mock of staged MFA UI (not live Supabase nor real module network loading)."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
html=re.sub(r'<link\b[^>]*>', '', html)
html=re.sub(r'<script\b[^>]*>\s*</script>', '', html)
html=html.replace('</head>','<style>'+(ROOT/'portal.css').read_text()+'</style></head>')
script=re.sub(r'^import .*?;\s*$', '', (ROOT/'portal-auth.mjs').read_text(), flags=re.M)
stubs='''
const EWP_AUTH_STORAGE_KEY='auth';
const SUPABASE_URL='https://mock.supabase.test';const SUPABASE_PUBLISHABLE_KEY='test';
const state=window.__mfaState={aal:'aal1',status:'not_enrolled',factor:false,authenticated:false};
let restored=null;
function restoreSession(){return Promise.resolve(restored);}
function signInWithPassword(email,password){restored={user:{email:email,id:'user1'}};state.authenticated=true;return Promise.resolve(restored);}
function signOut(){restored=null;return Promise.resolve();}
function getLastEmail(){return '';}
function getAccessToken(){return Promise.resolve('token');}
function setWorkspaceView(){}function portalViewFromUrl(){return 'all';}
function currentAal(){return state.aal;}
function mfaStatus(){return Promise.resolve({status:state.status,is_admin:false,verified_factor_count:state.factor?1:0,enforcement_enabled:false,allowed:true});}
function mfaList(){return Promise.resolve({totp:state.factor?[{id:'factor1',factor_type:'totp',status:'verified'}]:[]});}
function mfaEnroll(){return Promise.resolve({id:'factor1',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>'}});}
function mfaVerify(id,code){if(code!=='123456')throw Error('Invalid code');state.aal='aal2';state.factor=true;return Promise.resolve({});}
function mfaSubmit(){state.status='pending';return Promise.resolve();}
window.fetch=async()=>new Response(JSON.stringify([{id:'global'}]),{status:200,headers:{'Content-Type':'application/json'}});
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in (1280,390):
  page=browser.new_page(viewport={'width':width,'height':900})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html)
  page.add_script_tag(content=stubs+script)
  page.locator('#portalLogin').wait_for(state='visible')
  page.locator('#portalLoginEmail').fill('employee@example.com')
  page.locator('#portalLoginPassword').fill('password')
  page.locator('#portalLoginButton').click()
  page.locator('#portalMfaOpen').wait_for(state='visible')
  page.locator('#portalMfaOpen').click()
  page.locator('#portalMfaStart').wait_for(state='visible')
  page.locator('#portalMfaStart').click()
  page.locator('#portalMfaQrImage').wait_for(state='visible')
  page.locator('#portalMfaCode').fill('123456')
  page.locator('#portalMfaVerify').click()
  page.get_by_text('Waiting for administrator identity approval').wait_for(state='visible')
  assert page.evaluate('window.__mfaState.status')=='pending'
  assert not errors, errors
  page.screenshot(path=str(ROOT/f'tests/v1_38_mfa_{width}.png'))
  page.close()
  print(f'PASS offline mocked TOTP + pending approval at {width}px')
 browser.close()
