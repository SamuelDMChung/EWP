"""Offline V1.34 Chromium UI regression.
Actual app and parser JS, with deterministic positioned-text/annotation fixtures
for all six uploaded PDFs. External PDF.js CDN, native PDF rendering and hosted
Supabase are not tested here.
"""
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
app=re.sub(r'async function getPdfJs\(\)\{.*?\n\}\nasync function readPdfPages','async function getPdfJs(){return globalThis.__pdfjsFake;}\nasync function readPdfPages',app,flags=re.S)
assert 'return globalThis.__pdfjsFake' in app
fixtures=json.loads((root/'tests/v1_30_pdf_fixtures.json').read_text())
fixtures.update(json.loads((root/'tests/v1_31_new_pdf_fixtures.json').read_text()))
fixtures['unrecognized']=[{'page':1,'height':800,'items':[{'str':'some random heading','transform':[1,0,0,1,30,600]}],'annotations':[]}]
fake='''
const GlobalWorkerOptions={workerSrc:''};
function getDocument({data}){
 const id=String.fromCharCode(data[0]);
 const names={A:'j_standard',B:'s_standard',C:'j_annotated',D:'s_annotated',E:'j_new',F:'s_new',G:'unrecognized'};
 const pages=globalThis.__fixture[names[id]];
 if(!pages)throw Error('Invalid fixture input');
 return {promise:Promise.resolve({numPages:pages.length,getPage:async n=>({
    getViewport:()=>({height:pages[n-1].height,convertToViewportRectangle:r=>id==='E'?[r[0],pages[n-1].height-r[3],r[2],pages[n-1].height-r[1]]:r}),
    getTextContent:async()=>({items:pages[n-1].items}),
    getAnnotations:async()=>pages[n-1].annotations,
    cleanup:()=>{}
 })}),destroy:async()=>{}};
}
globalThis.__pdfjsFake={GlobalWorkerOptions,getDocument};
'''
file=lambda n,c:{'name':n+'.pdf','mimeType':'application/pdf','buffer':c.encode()}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for theme,width in [('light',1320),('dark',1320),('light',768),('dark',390)]:
  page=browser.new_page(viewport={'width':width,'height':900},accept_downloads=True)
  page.on('dialog',lambda dialog:dialog.accept())
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='load')
  page.evaluate('(theme)=>document.documentElement.setAttribute("data-ewp-theme",theme)',theme)
  page.evaluate('(fixture)=>globalThis.__fixture=fixture',fixtures)
  page.add_script_tag(content=fake+'\n'+logic+'\n'+app)
  assert page.locator('#checkerFiles').get_attribute('multiple') is not None
  assert page.locator('#checkerStats').count()==0
  assert page.locator('#checkerWarnings').count()==0
  assert not page.locator('#checkerResults').is_visible()
  page.locator('#checkerFiles').set_input_files([file('TC25280','A'),file('2610-C09329','B')])
  page.wait_for_function('()=>document.querySelector("#checkerResults").hidden===false')
  assert page.locator('#checkerMismatches').inner_text()=='1'
  assert int(page.locator('#checkerReviews').inner_text())==0
  assert page.locator('.checker-marked-tag').count()==0
  assert 'TC25280' in page.locator('#jSlot').inner_text()
  assert '2610-C09329' in page.locator('#sSlot').inner_text()
  assert 'Automatically detected' in page.locator('#jSlot').inner_text()
  # Duplicate same upload must not remove already included documents.
  page.locator('#checkerFiles').set_input_files(file('TC25280','A'))
  page.wait_for_function('()=>document.querySelector("#checkerStatus").textContent.includes("duplicate skipped")')
  assert page.locator('#checkerResults').is_visible()
  # Removing Spruce makes comparison unavailable without altering Javelin.
  page.get_by_role('button',name='Remove Spruce PDF').click()
  assert not page.locator('#checkerResults').is_visible()
  assert 'TC25280' in page.locator('#jSlot').inner_text()
  # A separate later drag/drop can provide the missing PDF.
  page.evaluate('''()=>{let d=new DataTransfer();d.items.add(new File([Uint8Array.of(66)],'2610-C09329.pdf',{type:'application/pdf'}));document.querySelector('#checkerDrop').dispatchEvent(new DragEvent('drop',{dataTransfer:d,bubbles:true,cancelable:true}));}''')
  page.wait_for_function('()=>document.querySelector("#checkerResults").hidden===false')
  assert page.locator('#checkerMismatches').inner_text()=='1'
  if theme=='light' and width==1320:
   # Replacement of both roles is explicit and preserves the new pair's results.
   page.locator('#checkerFiles').set_input_files([file('TC26203-L3','E'),file('2610-C03464','F')])
   page.wait_for_function('()=>document.querySelector("#sSlot").textContent.includes("2610-C03464") && document.querySelector("#jSlot").textContent.includes("TC26203-L3") && document.querySelector("#checkerDetails").textContent.includes("Rim")')
   assert page.locator('#checkerMismatches').inner_text()=='1'
   assert int(page.locator('#checkerReviews').inner_text())==1
   assert 'MARKED PDF AREA' not in page.locator('#checkerDetails').inner_text()
   assert 'Definite minimum-stock shortage' in page.locator('#checkerDetails').inner_text()
   page.locator('#checkerFilter').select_option('all')
   assert page.locator('.checker-item').count()>=25
   assert '306.00 LF' in page.locator('#checkerDetails').inner_text()
   # Unit 201 LSL stays matched despite highlight and neighboring P5 strikeout.
   unit201=page.locator('.checker-item').filter(has_text='LSL 1.55 · 1.75" × 9.5" · 201')
   assert unit201.count()==1
   unit201.locator('summary').click()
   assert '1 × 11′' in unit201.inner_text()
   assert '11.00 LF' in unit201.inner_text()
   assert 'MATCH' in unit201.inner_text()
   assert 'MANUAL REVIEW' not in unit201.inner_text()
   page.locator('#checkerFilter').select_option('issues')
   page.screenshot(path=str(root/'tests/v1_34_checker_light.png'),full_page=True)
   with page.expect_download() as info: page.locator('#checkerDownload').click()
   assert info.value.suggested_filename.endswith('.html')
   data=info.value.path().read_text()
   assert 'REVIEW MARKUP' not in data and 'marked area' not in data.lower()
   assert 'REVIEW: Javelin' not in data and 'strikeout could not' not in data
   assert 'Definite minimum-stock shortage' in data
   # Unknown document: must not silently assign it to Javelin or Spruce.
   page.locator('#checkerFiles').set_input_files(file('unknown','G'))
   page.wait_for_function('()=>document.querySelector("#checkerPending").textContent.includes("Document type unclear")')
   assert page.locator('#checkerPending select').count()==1
   assert '2610-C03464' in page.locator('#sSlot').inner_text()
   page.locator('#checkerReset').click()
   assert page.locator('#checkerPending').is_hidden()
   assert page.locator('#checkerResults').is_hidden()
  elif theme=='dark' and width==390:
   page.screenshot(path=str(root/'tests/v1_34_checker_mobile_dark.png'),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+4')
  assert not errors,errors
  print(f'PASS {theme} {width}px unified upload, browser errors={len(errors)}')
  page.close()
 browser.close()
