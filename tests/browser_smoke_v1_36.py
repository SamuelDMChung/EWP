"""V1.36 offline browser integration: auth-protected SharePoint link retrieval, responsive form and submission.
All Supabase, Auth and MS services mocked. This does not prove any live SharePoint upload.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'sales/index.html').read_text()
html=re.sub(r'<link\b[^>]*>', '', html)
html=re.sub(r'<script\b[^>]*>\s*</script>', '', html)
styles='\n'.join((ROOT/p).read_text() for p in ['portal-nav.css','theme.css','sales/sales.css'])
html=html.replace('</head>','<style>'+styles+'</style></head>')
script=(ROOT/'sales/sales.mjs').read_text()
script=re.sub(r'^import\s+.*?;\s*$', '', script, flags=re.M)
assert 'import {' not in script
stub='''
Object.defineProperty(Crypto.prototype,'randomUUID',{value:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',configurable:true});
const SUPABASE_URL='https://project.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='local-anon-key';
const EWP_AUTH_STORAGE_KEY='auth';
const authUser={id:'4d4d4d4d-3333-4444-8888-123456789abc', email:'sales@example.com'};
async function restoreSession(){return {user:authUser};}
function getCurrentSession(){return {user:authUser};}
async function getAccessToken(){return 'mock-token';}
async function signOut(){}
async function loadTrackerSettings(){return {sales:['Sales User'],tasks:['Layout'],phases:['Awarded','Bidding']};}
window.EWPSharedSettings={open(){}};
window.__savedPayload=null;
window.__routelog=[];
window.fetch=async (url,options={})=>{
 const path=String(url);window.__routelog.push({path,authorization:options.headers?.Authorization||''});
 const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 if(path.includes('/ewp_sales_file_request?')) {
  if(window.__linkState==='error')return reply({message:'Config table unavailable'},404);
  if(window.__linkState==='empty')return reply([]);
  if(window.__linkState==='malicious')return reply([{upload_url:'https://evil.example.com/phish'}]);
  return reply([{upload_url:'https://tenant-my.sharepoint.com/:f:/g/personal/test/RandomToken'}]);
 }
 if(path.includes('/sales_requests') && options.method==='POST') {
   window.__savedPayload=JSON.parse(options.body);
   return reply([{...window.__savedPayload}]);
 }
 if(path.includes('/sales-request-email'))return reply({status:'sent'});
 if(path.includes('/sales_requests?'))return reply([]);
 throw Error('Unexpected external fetch '+path);
};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for state,width,theme in [('ok',1320,'light'),('ok',390,'dark'),('empty',768,'light'),('error',390,'light'),('malicious',1320,'dark')]:
  page=browser.new_page(viewport={'width':width,'height':900},accept_downloads=True)
  errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
  
  page.set_content(html,wait_until='load')
  page.evaluate('(theme)=>document.documentElement.setAttribute("data-ewp-theme",theme)',theme)
  page.evaluate('(state)=>window.__linkState=state',state)
  page.add_script_tag(content=stub+script)
  page.wait_for_function('()=>document.querySelector("#salesWorkspace").hidden===false && document.querySelector("#salesSharePointStatus").textContent!=="Checking SharePoint upload access…"')
  btn=page.locator('#salesSharePointUpload')
  if state=='ok':
   assert btn.is_visible(),(state,width)
   assert btn.get_attribute('href')=='https://tenant-my.sharepoint.com/:f:/g/personal/test/RandomToken'
   assert btn.get_attribute('target')=='_blank'
   assert 'noopener' in btn.get_attribute('rel')
   assert 'Upload opens' in page.locator('#salesSharePointStatus').inner_text()
  else:
   assert not btn.is_visible(),(state,width)
   assert not btn.get_attribute('href')
  assert not errors,errors
  # Fill out a request; external upload confirmation is an attestation only.
  page.locator('[name=customer]').fill('Mock Customer')
  page.locator('[name=address]').fill('33418 Project Road')
  page.locator('#salesPerson').select_option('Sales User')
  page.locator('#salesPhase').select_option('Awarded')
  page.locator('[name=tasks]').first.check()
  page.locator('[name=due_date]').fill('2026-11-20')
  page.locator('[name=instructions]').fill('Please review plans.')
  if state=='ok':
   page.evaluate('()=>{navigator.clipboard={writeText:async label=>{window.__copiedLabel=label;}}}')
   page.locator('#salesCopyProjectLabel').click()
   page.wait_for_function('()=>window.__copiedLabel!==undefined')
   assert page.evaluate('window.__copiedLabel')=='Mock Customer - 33418 Project Road'
   page.locator('#salesSharePointConfirmed').check()
  page.locator('#salesSubmit').click()
  
  try: page.wait_for_function('()=>window.__savedPayload!==null',timeout=4000)
  except Exception:
   print('DEBUG',state,width,'msg=',page.locator('#salesFormMessage').inner_text(),'console-errors',errors, 'routelog',page.evaluate('window.__routelog'))
   print('Validity',page.evaluate('()=>{const f=document.querySelector("#salesRequestForm");return [f.checkValidity(),[...f.querySelectorAll("input,select,textarea")].filter(e=>!e.checkValidity()).map(x=>[x.name,x.validationMessage])]}'))
   raise
  saved=page.evaluate('window.__savedPayload')
  assert saved['customer']=='Mock Customer' and saved['address']=='33418 Project Road'
  assert saved['attachments']==[], 'External SharePoint link must not populate Supabase attachments'
  if state=='ok':assert 'Plans uploaded to company SharePoint' in saved['instructions']
  else: assert saved['instructions']=='Please review plans.'
  assert any('/ewp_sales_file_request?' in row['path'] and row['authorization']=='Bearer mock-token' for row in page.evaluate('window.__routelog'))
  assert not errors,errors
  if state=='ok' and width==1320:page.screenshot(path=str(ROOT/'tests/v1_36_sharepoint_desktop.png'),full_page=True)
  if state=='ok' and width==390:page.screenshot(path=str(ROOT/'tests/v1_36_sharepoint_mobile.png'),full_page=True)
  page.close()
 browser.close()
 print('V1.36 browser smoke PASSED: 5 scenarios (authenticated valid/missing/error/unsafe links, desktop/tablet/mobile, copy project label, confirmation persistence, existing submissions).')
