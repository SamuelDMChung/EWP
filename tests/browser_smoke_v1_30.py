"""Offline Playwright browser regression. Uses actual first-party UI/logic with mocked
PDF.js getDocument returning positioned text and annotation fixtures from the four PDFs.
No live CDN, Supabase, actual PDF.js rendering, or hosted deployment is verified."""
import re,json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'ewp-tools/javelin-spruce-checker/index.html').read_text()
html=re.sub(r'<link\b[^>]*>', '', html)
html=re.sub(r'<script\b[^>]*src="[^"]*"[^>]*>\s*</script>', '',html)
css='\n'.join((root/p).read_text() for p in ['portal-nav.css','theme.css','ewp-tools/tools.css','ewp-tools/javelin-spruce-checker/checker.css'])
html=html.replace('</head>','<style>'+css+'</style></head>')
logic=(root/'ewp-tools/javelin-spruce-checker/logic.mjs').read_text()
app=(root/'ewp-tools/javelin-spruce-checker/app.mjs').read_text()
logic=re.sub(r'\bexport\s+(?=(?:const|function|class|async)\b)','',logic)
app=re.sub(r'^import\s+.*?;\s*$', '',app,flags=re.M)
app=re.sub(r'async function getPdfJs\(\)\{.*?\n\}\nasync function readPdf','async function getPdfJs(){return globalThis.__pdfjsFake;}\nasync function readPdf',app,flags=re.S)
fixture=json.loads((root/'tests/v1_30_pdf_fixtures.json').read_text())
fake='''
const GlobalWorkerOptions={workerSrc:''};
function getDocument({data}){
 const id=String.fromCharCode(data[0]);
 const names={A:'j_standard',B:'s_standard',C:'j_annotated',D:'s_annotated'};
 const pages=globalThis.__fixture[names[id]];
 if(!pages)throw Error('Invalid fixture input');
 return {promise:Promise.resolve({numPages:pages.length,getPage:async n=>({
    getViewport:()=>({height:pages[n-1].height,convertToViewportRectangle:r=>r}),
    getTextContent:async()=>({items:pages[n-1].items}),
    getAnnotations:async()=>pages[n-1].annotations,
    cleanup:()=>{}
 })}),destroy:async()=>{}};
}
globalThis.__pdfjsFake={GlobalWorkerOptions,getDocument};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for theme,width in [('light',1330),('dark',390)]:
  page=browser.new_page(viewport={'width':width,'height':900},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='load')
  page.evaluate('(theme)=>document.documentElement.setAttribute("data-ewp-theme",theme)',theme)
  page.evaluate('(fixture)=>globalThis.__fixture=fixture',fixture)
  page.add_script_tag(content=fake+'\n'+logic+'\n'+app)
  assert not page.locator('#checkerResults').is_visible()
  page.locator('#jFile').set_input_files({'name':'TC25280.pdf','mimeType':'application/pdf','buffer':b'A'})
  page.wait_for_function('()=>document.querySelector("#checkerStatus").textContent.includes("other PDF")')
  page.locator('#sFile').set_input_files({'name':'2610-C09329.pdf','mimeType':'application/pdf','buffer':b'B'})
  page.wait_for_function('()=>document.querySelector("#checkerResults").hidden === false')
  assert page.locator('#checkerMismatches').inner_text()=='1'
  assert page.locator('#checkerReviews').inner_text()=='0'
  assert '353 LF' in page.locator('#checkerDetails').inner_text()
  page.locator('#checkerFilter').select_option('all')
  assert page.locator('.checker-item').count()>=15
  assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+3')
  if theme=='light':
   with page.expect_download() as download_info:page.locator('#checkerDownload').click()
   download=download_info.value
   assert download.suggested_filename.endswith('.html')
   page.locator('#jFile').set_input_files({'name':'TC26203.pdf','mimeType':'application/pdf','buffer':b'C'})
   page.locator('#sFile').set_input_files({'name':'2610-C08021.pdf','mimeType':'application/pdf','buffer':b'D'})
   page.wait_for_function('()=>document.querySelector("#checkerResults").hidden===false && document.querySelector("#checkerOverall").textContent.includes("MANUAL REVIEW")')
   assert page.locator('#checkerMismatches').inner_text()=='0'
   assert page.locator('#checkerReviews').inner_text()=='1'
   assert page.locator('#checkerStats').inner_text().find('6 crossed out')!=-1
   page.locator('#checkerJavelinReview summary').click()
   assert page.locator('.checker-row').count()>50
   assert not errors,errors
   page.screenshot(path=str(root/'tests/v1_30_checker_desktop.png'),full_page=True)
  else:
   page.screenshot(path=str(root/'tests/v1_30_checker_mobile_dark.png'),full_page=True)
  assert not errors,errors
  print('PASS',theme,width,'browser; errors',len(errors))
  page.close()
 browser.close()
