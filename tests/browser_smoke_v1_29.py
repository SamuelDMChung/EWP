"""Offline Chromium end-to-end UI test using the actual V1.29 app, parser and aggregator.
The PDF.js CDN is replaced by a deterministic fake document reader yielding positioned
PDF text items extracted from the user-supplied Sherman Road PDF. No production data
or live PDF.js CDN is exercised.
"""
import json, urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
fixture=json.loads((ROOT/'tests/sherman_12pages_fixture.json').read_text())
html=(ROOT/'ewp-tools/consolidate-material-list/index.html').read_text()
import re
html=re.sub(r'<link\b[^>]*>', '', html)
html=re.sub(r'<script\b[^>]*src="(?:../../theme.js|../../workspace-auth.mjs|../../shared-settings.mjs)[^"]*"[^>]*>\s*</script>', '',html)
css='\n'.join((ROOT/p).read_text() for p in ('portal-nav.css','theme.css','ewp-tools/tools.css'))
html=html.replace('</head>','<style>'+css+'</style></head>')
fake_pdf_js='''
export const GlobalWorkerOptions={workerSrc:''};
export function getDocument({data}){
  const fixture=globalThis.__pdfFixture;
  const id=String.fromCharCode(data[0]);
  const slices={A:[0,4],B:[4,7],C:[7,10],R:[10,12],D:[0,4]};
  if(id==='E')return {promise:Promise.reject(new Error('Unreadable test PDF')),destroy:async()=>{}};
  const [start,end]=slices[id]||[0,0];
  return {promise:Promise.resolve({
    numPages:end-start,
    getPage:async n=>({getTextContent:async()=>({items:fixture[start+n-1]}),cleanup:()=>{}})
  }),destroy:async()=>{}};
}
'''

# Flatten first-party ES modules for an offline document with no HTTP origin.
# The source logic remains unchanged except for imports/export keywords and
# PDF.js network loading, which is substituted by the fixture-powered test stub.
html=re.sub(r'<script\b[^>]*>\s*</script>', '',html)
all_js=[]
for filename in ('parser.mjs','multi-file.mjs','export-pdf.mjs','app.mjs'):
 text=(ROOT/'ewp-tools/consolidate-material-list'/filename).read_text()
 text=re.sub(r'^import\s+.*?;\s*$', '',text,flags=re.M)
 text=re.sub(r'\bexport\s+(?=function|async|const|class)', '',text)
 if filename=='app.mjs':
  text=re.sub(r'async function loadPdfJs\(\)\{.*?\n\}\nfunction clearChildren',
   'async function loadPdfJs(){return globalThis.__pdfjsFake;}\nfunction clearChildren',text,flags=re.S)
 all_js.append(text)
flat_js='\n'.join(all_js)

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for theme,width in [('light',1320),('dark',1320),('light',390),('dark',390)]:
  page=browser.new_page(viewport={'width':width,'height':850},accept_downloads=True)
  errors=[]
  page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content(html,wait_until='load')
  page.evaluate('(theme)=>document.documentElement.setAttribute("data-ewp-theme",theme)',theme)
  page.evaluate('(fixture)=>globalThis.__pdfFixture=fixture',fixture)
  fake=re.sub(r'\bexport\s+', '',fake_pdf_js)
  page.add_script_tag(content=fake+'\nglobalThis.__pdfjsFake={GlobalWorkerOptions,getDocument};')
  # Offline about:blank is not a secure origin in this harness. Substitute a
  # deterministic digest solely to exercise duplicate workflows. HTTPS production
  # uses genuine browser SHA-256 through crypto.subtle.
  page.add_script_tag(content="Object.defineProperty(crypto,'subtle',{value:{digest:async(_,buffer)=>{const out=new Uint8Array(32),b=new Uint8Array(buffer);b.forEach((v,i)=>out[i%32]^=v);return out.buffer;}}});")
  page.add_script_tag(content=flat_js)
  assert page.locator('#materialParse').count()==0
  assert page.locator('#materialPdfFile').get_attribute('multiple') is not None
  assert not page.locator('#materialOutput').is_visible()
  if theme=='light' and width==1320:
   page.locator('#materialPdfFile').set_input_files([
    {'name':'L3.pdf','mimeType':'application/pdf','buffer':b'A'},
    {'name':'L4.pdf','mimeType':'application/pdf','buffer':b'B'}
   ])
   page.wait_for_function('()=>document.querySelectorAll(".material-file-state").length===2 && Array.from(document.querySelectorAll(".material-file-state")).every(e=>e.textContent.includes("Included in totals"))')
   def huc():
    return page.locator('#materialConnectorsBody tr').filter(has=page.get_by_text('HUC610',exact=True)).first.locator('td').nth(1).inner_text()
   assert huc()=='35',huc()
   page.evaluate('''()=>{const t=new DataTransfer();t.items.add(new File([new Uint8Array([67])],'L5.pdf',{type:'application/pdf'}));document.querySelector('#materialDropZone').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:t}));}''')
   page.wait_for_function('()=>document.querySelectorAll(".material-file-state").length===3 && Array.from(document.querySelectorAll(".material-file-state")).every(e=>e.textContent.includes("Included in totals"))')
   assert huc()=='50'
   assert page.locator('#materialStats').inner_text().startswith('3 PDFs · 10 pages')
   page.locator('#showMaterialBreakdown').check()
   assert page.locator('#materialConnectorsHead').get_by_text('L5 Framing').is_visible()
   # Copy for Excel and formatted email must reflect the currently included files.
   page.evaluate("""()=>{
     window.__clipboardText='';window.__clipboardHtml='';
     class MockClipboardItem{constructor(items){this.items=items;}}
     window.ClipboardItem=MockClipboardItem;
     Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
       writeText:async text=>{window.__clipboardText=text;},
       write:async items=>{window.__clipboardHtml=await items[0].items['text/html'].text();window.__clipboardText=await items[0].items['text/plain'].text();}
     }});
   }""")
   page.locator('#copyMaterialAllExcel').click()
   page.wait_for_function("()=>window.__clipboardText.includes('HUC610\\t50')")
   page.locator('#copyMaterialAllEmail').click()
   page.wait_for_function("()=>window.__clipboardHtml.includes('<table') && window.__clipboardHtml.includes('HUC610')")
   # Simulated jsPDF checks that the combined download is sourced from the live totals.
   page.evaluate("""()=>{
      window.__pdfSaves=[];
      class DummyPDF{
       constructor(){this.pages=1;this.internal={getNumberOfPages:()=>this.pages};}
       addPage(){this.pages++;}setPage(){}setFont(){}setFontSize(){}setTextColor(){}
       text(){}setFillColor(){}setDrawColor(){}rect(){}setLineWidth(){}line(){}
       splitTextToSize(value){return [value];}save(name){window.__pdfSaves.push(name);}
      }
      window.jspdf={jsPDF:DummyPDF};
   }""")
   page.locator('#downloadMaterialAllPdf').click()
   page.wait_for_function('()=>window.__pdfSaves.length===1')
   assert 'Combined_Material_Lists' in page.evaluate('window.__pdfSaves[0]')
   # Add same bytes under a different file name: should exclude exact binary duplicate.
   page.locator('#materialPdfFile').set_input_files({'name':'CopiedL5.pdf','mimeType':'application/pdf','buffer':b'C'})
   page.wait_for_function('()=>document.querySelectorAll(".material-file-state").length===4 && document.querySelector(".material-file-list").textContent.includes("Duplicate excluded")')
   assert huc()=='50'
   # Another revision of L3 with different content (id=D) must be reviewed first.
   page.locator('#materialPdfFile').set_input_files({'name':'L3_Revision.pdf','mimeType':'application/pdf','buffer':b'D'})
   page.wait_for_function('()=>document.querySelector(".material-file-list").textContent.includes("Review before including")')
   assert huc()=='50'
   page.locator('#materialFileList').get_by_role('button',name='Include anyway').click()
   assert huc()=='67'
   page.locator('#materialFileList li.material-file-row').filter(has=page.get_by_text('L3_Revision.pdf',exact=True)).get_by_role('button',name='Remove').click()
   assert huc()=='50'
   # Removing L4 subtracts its quantities with no reprocessing of other PDFs.
   page.locator('#materialFileList li.material-file-row').filter(has=page.get_by_text('L4.pdf',exact=True)).get_by_role('button',name='Remove').click()
   assert huc()=='32'
   # Failed file is isolated; existing totals remain valid.
   page.locator('#materialPdfFile').set_input_files({'name':'Bad.pdf','mimeType':'application/pdf','buffer':b'E'})
   page.wait_for_function('()=>document.querySelector(".material-file-list").textContent.includes("Processing failed")')
   assert huc()=='32'
   # Per-file expandable breakdown still reveals parsed source rows.
   page.locator('#materialFileList li.material-file-row').filter(has=page.get_by_text('L3.pdf',exact=True)).locator('summary').click()
   assert page.locator('#materialFileList li.material-file-row').filter(has=page.get_by_text('L3.pdf',exact=True)).get_by_text('Framing Connector Summary').is_visible()
   page.screenshot(path=str(ROOT/'tests/material_multi_v1_29_light_desktop.png'),full_page=True)
   page.locator('#materialReset').click()
   assert not page.locator('#materialOutput').is_visible()
   assert page.locator('#materialFileList li.material-file-row').count()==0
   assert not errors,errors
   print('PASS desktop end-to-end: bulk, incremental drop, duplicate hash, revision confirmation, removal, error isolation, breakdown, clear')
  else:
   # One small source report to validate responsive lists and live output.
   page.locator('#materialPdfFile').set_input_files({'name':'L3.pdf','mimeType':'application/pdf','buffer':b'A'})
   page.wait_for_function('()=>document.querySelector(".material-file-list").textContent.includes("Included in totals")')
   assert page.locator('#materialOutput').is_visible()
   assert page.locator('#materialConnectorsBody tr').filter(has=page.get_by_text('HUC610',exact=True)).first.locator('td').nth(1).inner_text()=='17'
   assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'),page.evaluate('document.documentElement.scrollWidth')
   assert not errors,errors
   if theme=='dark' and width==390:
    page.screenshot(path=str(ROOT/'tests/material_multi_v1_29_dark_mobile.png'),full_page=True)
   print('PASS',theme,width,'browser, PDF queue, summary and layout')
  page.close()
 browser.close()
print('V1.29 browser smoke completed')
