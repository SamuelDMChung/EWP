"""V1.40 offline browser smoke for non-unit PDF workflow.
Run with --fixture /path/to/positions.json to replay locally extracted text from
user PDFs (those customer PDFs/positions must NOT be committed or bundled).
Without --fixture, uses small synthetic, non-customer example.
PDF.js is mocked so this does not verify hosted native PDF.js extraction.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import argparse,re,json
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--fixture');args=parser.parse_args()
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

def item(x,y,txt,h=792):
 return {'str':txt,'transform':[1,0,0,1,x,h-y],'width':max(8,len(txt)*3.0),'height':10}
def synthetic():
 j=[item(150,48,'Layout Material List Report'),item(37,100,'Level: Second Floor'),item(280,130,'Products'),item(37,151,'Plot ID'),item(500,151,'Plies'),item(535,151,'Net Qty')]
 for i,(plot,length,qty) in enumerate([("K18'",18,1),("K15'",15,1)]):
  y=180+i*18;j.extend([item(37,y,plot),item(98,y,f'{length}\'0"0'),item(156,y,'11 7/8" TJI 230 joist'),item(509,y,'1'),item(538,y,str(qty))])
 j.extend([item(37,240,'P1'),item(98,240,"10'0\"0"),item(156,240,'5 1/4\" x 9 1/2\" 2.2E Parallam PSL'),item(509,240,'1'),item(538,240,'1')])
 s=[item(20,40,'Griff Building Supplies Ltd'),item(470,65,'CUSTOMER COPY'),item(20,275,'ORDERED REMAIN'),item(24,310,'COMMENT'),item(129,310,'SECOND FLOOR'),item(411,310,'1'),item(24,341,'TJI2301178'),item(129,341,'TJI 230 2-5/16" X 11-7/8"'),item(325,341,'33'),item(420,341,'LF'),item(129,353,"1 - 18', 1 - 15'")]
 return {'j':[{'page':1,'height':792,'items':j,'annotations':[]}], 's':[{'page':1,'height':792,'items':s,'annotations':[]}]}
fixtures=json.loads(Path(args.fixture).read_text()) if args.fixture else synthetic()
fake='''
const GlobalWorkerOptions={workerSrc:''};
function getDocument({data}){
 const label=String.fromCharCode(data[0]);
 const pages=globalThis.__fixture[label];
 return {promise:Promise.resolve({numPages:pages.length,getPage:async n=>({getViewport:()=>({height:pages[n-1].height}),getTextContent:async()=>({items:pages[n-1].items}),getAnnotations:async()=>pages[n-1].annotations,cleanup:()=>{}})}),destroy:async()=>{}};
}
globalThis.__pdfjsFake={GlobalWorkerOptions,getDocument};
'''
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
  page.locator('#checkerFiles').set_input_files([files('JavelinFloor','A'),files('SpruceFloor','B')])
  try: page.wait_for_function('()=>document.querySelector("#checkerResults").hidden===false',timeout=6000)
  except Exception:
   print('BROWSER DEBUG',errors,page.locator('#checkerStatus').inner_text(),page.locator('#checkerPending').inner_text(),page.locator('#jSlot').inner_text(),page.locator('#sSlot').inner_text());raise
  details=page.locator('#checkerDetails')
  assert page.locator('#checkerReviews').inner_text()=='0'
  if args.fixture:
   assert page.locator('#checkerMatches').inner_text()=='12',page.locator('#checkerMatches').inner_text()
   assert page.locator('#checkerMismatches').inner_text()=='2'
   assert details.inner_text().count('Second Floor')>=1
   page.locator('#checkerFilter').select_option('all')
   assert page.locator('.checker-item').count()==14
   for label in ['TJI 230','TJI 560']:
    element=page.locator('.checker-item').filter(has_text=label)
    assert element.count()==1
    assert element.locator('summary .checker-tag').get_attribute('data-state')=='MATCH'
   page.locator('#checkerFilter').select_option('issues')
   assert 'Unspecified section' not in details.inner_text()
  else:
   assert page.locator('#checkerMismatches').inner_text()=='1'
   assert 'Second Floor' in details.inner_text()
  if width==1320 and theme=='light':
   with page.expect_download() as dl: page.locator('#checkerDownload').click()
   report=dl.value.path().read_text()
   assert 'Second Floor' in report
   assert 'Unspecified section' not in report
   page.screenshot(path=str(root/'tests/v1_40_checker_synthetic.png') if not args.fixture else '/mnt/data/v140_original_preview_local_not_in_release.png',full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+4')
  assert not errors,errors
  print('PASS checker',width,theme,'source',('private positioned-text replay' if args.fixture else 'synthetic fixture'))
  page.close()
 browser.close()
