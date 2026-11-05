"""V1.37 New EWP Requests: removed Full Takeoff and SharePoint UI; offline mocked browser tests.
No live Supabase auth/storage/Resend involved.
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
async function loadTrackerSettings(){return {sales:['Sales User'],tasks:['ATS','Dimensional Takeoff','EWP Layout','EWP Takeoff','Full Takeoff'],phases:['Awarded','Bidding']};}
window.EWPSharedSettings={open(){}};
window.__savedPayload=null;
window.__routelog=[];
window.fetch=async (url,options={})=>{
 const path=String(url);window.__routelog.push({path,authorization:options.headers?.Authorization||''});
 const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 if(path.includes('/storage/v1/object/ewp-sales-request-files/') && options.method==='POST')return reply({Key:'test'});
 if(path.includes('/sales_requests') && options.method==='POST'){
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
 for width,theme,attachment in [(1366,'light',False),(768,'dark',False),(390,'light',True),(390,'dark',False)]:
  page=browser.new_page(viewport={'width':width,'height':900},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='load')
  page.evaluate('(theme)=>document.documentElement.setAttribute("data-ewp-theme",theme)',theme)
  page.add_script_tag(content=stub+script)
  page.wait_for_function('()=>document.querySelector("#salesWorkspace").hidden===false && document.querySelectorAll("input[name=tasks]").length===4')
  assert not page.locator('.sales-sharepoint').count()
  assert not page.locator('#salesSharePointUpload').count()
  assert not page.locator('#salesSharePointConfirmed').count()
  assert not page.locator('#salesCopyProjectLabel').count()
  assert page.locator('#salesFiles').count()==1
  choices=page.locator('input[name=tasks]').evaluate_all('(els)=>els.map(e=>e.value)')
  assert choices==['ATS','Dimensional Takeoff','EWP Layout','EWP Takeoff'],choices
  assert page.evaluate('()=>document.documentElement.scrollWidth <= window.innerWidth+2'), 'horizontal overflow'
  page.locator('[name=customer]').fill('Mock Customer')
  page.locator('[name=address]').fill('Project A')
  page.locator('#salesPerson').select_option('Sales User')
  page.locator('#salesPhase').select_option('Awarded')
  page.locator('input[name=tasks][value="ATS"]').check()
  page.locator('input[name=tasks][value="EWP Layout"]').check()
  page.locator('[name=due_date]').fill('2026-11-20')
  page.locator('[name=instructions]').fill('Keep existing client instructions.')
  if attachment:
   page.locator('#salesFiles').set_input_files({'name':'drawing.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.7\n1 0 obj\nendobj\n%%EOF'})
  page.locator('#salesSubmit').click()
  page.wait_for_function('()=>window.__savedPayload!==null')
  page.wait_for_function('()=>window.__routelog.some(r=>r.path.includes("sales-request-email"))')
  saved=page.evaluate('window.__savedPayload')
  assert saved['tasks']==['ATS','EWP Layout'],saved
  assert saved['instructions']=='Keep existing client instructions.',saved
  assert len(saved['attachments'])==(1 if attachment else 0),saved
  if attachment:assert saved['attachments'][0]['name']=='drawing.pdf',saved
  routes=page.evaluate('window.__routelog')
  assert not any('ewp_sales_file_request' in x['path'] for x in routes),routes
  assert any('sales_requests' in x['path'] for x in routes),routes
  assert any('sales-request-email' in x['path'] for x in routes),routes
  assert not errors,errors
  if width==1366:page.screenshot(path=str(ROOT/'tests/v1_37_sales_desktop.png'),full_page=True)
  if width==390 and theme=='dark':page.screenshot(path=str(ROOT/'tests/v1_37_sales_mobile_dark.png'),full_page=True)
  page.close()
 browser.close()
print('V1.37 offline browser smoke PASSED: 4 responsive cases, Shared Task filter, request submission, attachments preserved, no SharePoint calls.')
