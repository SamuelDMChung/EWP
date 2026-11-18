"""V1.43 browser smoke for LVL 7¼ grade normalization.
Optional --fixture JSON can replay positions extracted privately from uploaded PDFs.
No customer PDFs or private fixture data are included in the release package.
PDF.js is simulated: LIVE CDN/browser PDF.js verification is still required.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import argparse,re,json
root=Path(__file__).resolve().parents[1]
pa=argparse.ArgumentParser();pa.add_argument('--fixture');args=pa.parse_args()
html=(root/'ewp-tools/javelin-spruce-checker/index.html').read_text()
html=re.sub(r'<link\b[^>]*>','',html)
html=re.sub(r'<script\b[^>]*src="[^"]*"[^>]*>\s*</script>','',html)
css='\n'.join((root/s).read_text() for s in ['portal-nav.css','theme.css','ewp-tools/tools.css','ewp-tools/javelin-spruce-checker/checker.css'])
html=html.replace('</head>','<style>'+css+'</style></head>')
logic=(root/'ewp-tools/javelin-spruce-checker/logic.mjs').read_text()
app=(root/'ewp-tools/javelin-spruce-checker/app.mjs').read_text()
logic=re.sub(r'\bexport\s+(?=(?:const|function|class|async)\b)','',logic)
app=re.sub(r'^import\s+.*?;\s*$','',app,flags=re.M)
app=re.sub(r'async function getPdfJs\(\)\{.*?\n\}\nasync function readPdfPages','async function getPdfJs(){return globalThis.__pdfjsFake;}\nasync function readPdfPages',app,flags=re.S)
assert 'return globalThis.__pdfjsFake' in app

def item(x,y,txt,h=792):return {'str':txt,'transform':[1,0,0,1,x,h-y],'width':max(8,len(txt)*3.0),'height':10}
def synthetic():
 j=[item(150,48,'Layout Material List Report'),item(37,100,'Level: Main Floor'),item(280,130,'Products'),item(37,150,'Plot ID'),item(500,150,'Plies'),item(535,150,'Net Qty')]
 j += [item(37,215,'M2'),item(98,215,"9'0\"0"),item(156,215,'1 3/4" x 7 1/4" 2.0E Microllam LVL'),item(509,215,'1'),item(538,215,'11')]
 s=[item(20,40,'Griff Building Supplies Ltd'),item(470,65,'CUSTOMER COPY'),item(20,275,'ORDERED REMAIN'),item(24,310,'COMMENT'),item(129,310,'MAIN FLOOR'),item(411,310,'1'),item(24,341,'LVL714'),item(129,341,'1-3/4" X 7-1/4" MICROLLAM LVL 2'),item(325,341,'99'),item(420,341,'LF'),item(129,353,"11 - 9'")]
 return {'j':[{'page':1,'height':792,'items':j,'annotations':[]}],'s':[{'page':1,'height':792,'items':s,'annotations':[]}]}
fixtures=json.loads(Path(args.fixture).read_text()) if args.fixture else synthetic()
fake='''const GlobalWorkerOptions={workerSrc:''};
function getDocument({data}){const label=String.fromCharCode(data[0]);const pages=globalThis.__fixture[label];return {promise:Promise.resolve({numPages:pages.length,getPage:async n=>({getViewport:()=>({height:pages[n-1].height}),getTextContent:async()=>({items:pages[n-1].items}),getAnnotations:async()=>pages[n-1].annotations,cleanup:()=>{}})}),destroy:async()=>{}};}
globalThis.__pdfjsFake={GlobalWorkerOptions,getDocument};'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for theme,width in [('light',1320),('dark',1320),('light',768),('dark',390)]:
  page=browser.new_page(viewport={'width':width,'height':880},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='load')
  page.evaluate('(theme)=>document.documentElement.setAttribute("data-ewp-theme",theme)',theme)
  page.evaluate('(d)=>globalThis.__fixture={A:d.j,B:d.s}',fixtures)
  page.add_script_tag(content=fake+'\n'+logic+'\n'+app)
  files=lambda n,letter:{'name':n+'.pdf','mimeType':'application/pdf','buffer':letter.encode()}
  page.locator('#checkerFiles').set_input_files([files('JavelinMainFloor','A'),files('SpruceMainFloor','B')])
  page.wait_for_function('()=>document.querySelector("#checkerResults").hidden===false',timeout=9000)
  page.locator('#checkerFilter').select_option('MATCH')
  matching=page.locator('.checker-item').filter(has_text='LVL 2.0E · 1.75" × 7.25"')
  assert matching.count()==1,(matching.count(),page.locator('#checkerDetails').inner_text()[:2000])
  assert matching.locator('summary .checker-tag').get_attribute('data-state')=='MATCH'
  matching.locator('summary').click()
  text=matching.inner_text();assert "11 × 9′" in text and '99.00 LF' in text,text
  assert 'Main Floor' in text
  if args.fixture:
   assert page.locator('#checkerMatches').inner_text()=='11',page.locator('#checkerMatches').inner_text()
   assert page.locator('#checkerMismatches').inner_text()=='1'
   assert page.locator('#checkerReviews').inner_text()=='1'
  else:
   assert page.locator('#checkerMatches').inner_text()=='1'
   assert page.locator('#checkerMismatches').inner_text()=='0'
   assert page.locator('#checkerReviews').inner_text()=='0'
  assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+4')
  assert not errors,errors
  if args.fixture and width==1320 and theme=='light':
   page.screenshot(path='/mnt/data/v143_private_lvl_browser_preview.png',full_page=True)
  print('PASS V1.43 LVL browser replay',width,theme,'private geometry' if args.fixture else 'synthetic')
  page.close()
 browser.close()
