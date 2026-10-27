"""V1.26 offline Chromium tests: actual HTML/CSS and lookup module run in browser.
Data is in-memory, not production network or Supabase. HTTP JSON fetch not exercised.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re
R=Path(__file__).resolve().parents[1]
html=(R/'ewp-tools/steel-beam-width/index.html').read_text()
styles='\n'.join((R/x).read_text() for x in ['portal-nav.css','theme.css','ewp-tools/tools.css','ewp-tools/steel-beam-width/styles.css'])
js=re.sub(r'\bexport\s+(?=(?:function|const))','',(R/'ewp-tools/steel-beam-width/lookup.mjs').read_text())
records=json.loads((R/'ewp-tools/steel-beam-width/w-sections.json').read_text())
html=re.sub(r'<link\b[^>]*>','',html)
html=re.sub(r'<script\b[^>]*>\s*</script>','',html)
html=html.replace('</head>','<style>'+styles+'</style></head>')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 cases=0
 for theme in ('light','dark'):
  for viewport in (1350,390):
   page=browser.new_page(viewport={'width':viewport,'height':900})
   errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
   page.set_content(html);page.evaluate('(v)=>document.documentElement.dataset.ewpTheme=v',theme)
   page.add_script_tag(content=js+'\nmountSteelBeamWidth(document,'+json.dumps(records)+');')
   assert page.locator('#beamTableBody tr').count()==196
   assert '196 of 196' in page.locator('#beamTableCount').inner_text()
   assert page.locator('.steel-data-table thead th').count()==7
   assert page.locator('.beam-diagram-figure').count()==1
   assert page.locator('h1').inner_text()=='Steel Beam Lookup'
   page.locator('#beamImperialDepth').fill('12')
   assert page.locator('#beamTableBody tr').count()==30,('W12 count',page.locator('#beamTableBody tr').count())
   assert page.locator('#beamFlangeWidth').inner_text()=='—'
   page.locator('#beamImperialWeight').fill('14')
   assert page.locator('#beamTableBody tr').count()==1
   assert page.locator('#beamMetricDepth').input_value()=='310'
   assert page.locator('#beamMetricMass').input_value()=='21'
   assert page.locator('#beamFlangeWidth').inner_text()=='3.97″'
   assert page.locator('#beamActualDepth').inner_text()=='11.91″'
   assert page.locator('#beamDiagramWidth').text_content()=='bf = 3.97″'
   assert page.locator('#beamDiagramDepth').text_content()=='d = 11.91″'
   assert page.locator('#beamTableBody tr').first.locator('td').all_text_contents()==['W12×14','W310×21','11.91','3.97','0.225','0.200','14.90']
   page.locator('#beamClear').click()
   assert page.locator('#beamTableBody tr').count()==196
   page.locator('#beamMetricDepth').fill('310')
   assert page.locator('#beamTableBody tr').count()==30
   page.locator('#beamMetricMass').fill('21')
   assert page.locator('#beamImperialDepth').input_value()=='12'
   assert page.locator('#beamImperialWeight').input_value()=='14'
   assert page.locator('#beamTableBody tr').count()==1
   page.locator('#beamMetricMass').fill('999')
   assert page.locator('#beamTableBody tr').count()==0
   assert page.locator('#beamTableEmpty').is_visible()
   assert 'No matching' in page.locator('#beamStatus').inner_text()
   page.locator('#beamClear').click()
   page.locator('.beam-sort-button[data-beam-sort="flangeWidthIn"]').click()
   first=page.locator('#beamTableBody tr').first.locator('td').all_text_contents()
   assert first[0]=='W6×9',first
   page.locator('.beam-sort-button[data-beam-sort="flangeWidthIn"]').click()
   assert page.locator('#beamTableBody tr').first.locator('td').nth(0).inner_text()=='W14×730'
   page.locator('#beamClear').click()
   page.locator('.beam-row-select').first.click()
   assert page.locator('#beamImperialDepth').input_value()=='4'
   assert page.locator('#beamImperialWeight').input_value()=='13'
   assert page.locator('#beamTableBody tr').count()==1
   page.locator('#beamClear').click()
   assert page.locator('#beamDiagramWidth').text_content()=='bf = —'
   assert not errors,errors
   assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'),(theme,viewport,page.evaluate('document.documentElement.scrollWidth'))
   if viewport==1350:
    page.locator('#beamImperialDepth').fill('12');page.locator('#beamImperialWeight').fill('14')
    page.screenshot(path=str(R/f'tests/steel_beam_lookup_v1_26_{theme}.png'),full_page=True)
   print('PASS browser',theme,viewport,'table, 2-way filter, select, sort, diagram, no overflow')
   cases+=1;page.close()
 browser.close()
 print('V1.26 browser cases:',cases)
