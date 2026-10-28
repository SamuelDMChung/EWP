"""V1.27 actual Chromium HTML/CSS/JS in-memory test; never accesses production."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re
R=Path(__file__).resolve().parents[1]
h=(R/'ewp-tools/steel-beam-width/index.html').read_text()
styles='\n'.join((R/x).read_text() for x in ['portal-nav.css','theme.css','ewp-tools/tools.css','ewp-tools/steel-beam-width/styles.css'])
js=re.sub(r'\bexport\s+(?=(?:function|const))','',(R/'ewp-tools/steel-beam-width/lookup.mjs').read_text())
rows=json.loads((R/'ewp-tools/steel-beam-width/w-sections.json').read_text())
h=re.sub(r'<link\b[^>]*>','',h)
h=re.sub(r'<script\b[^>]*>\s*</script>','',h)
h=h.replace('</head>','<style>'+styles+'</style></head>')
with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for theme in ['light','dark']:
    for viewport in [1400,900,390]:
      page=browser.new_page(viewport={'width':viewport,'height':900})
      errors=[]
      page.on('pageerror',lambda e:errors.append(str(e)))
      page.set_content(h)
      page.evaluate('(v)=>document.documentElement.dataset.ewpTheme=v',theme)
      page.add_script_tag(content=js+'\nmountSteelBeamLookup(document,'+json.dumps(rows)+');')
      assert page.locator('h1').inner_text()=='Steel Beam Lookup'
      assert page.locator('h2#steelTableHeading').inner_text()=='W-Beam Dimensions'
      assert page.locator('.steel-result').count()==0
      assert page.locator('.steel-note').count()==0
      assert page.locator('.steel-data-table thead th').count()==4
      assert page.locator('#beamTableBody tr').count()==196
      assert page.locator('.beam-diagram-figure').count()==1
      assert page.locator('#beamDiagramWidth').text_content()=='bf'
      assert page.locator('#beamDiagramDepth').text_content()=='d'
      assert page.locator('#beamStatus').inner_text().lower().find('varsteel')==-1
      # Check table + diagram truly side by side except narrow mobile where stacked.
      table=page.locator('.steel-table-content').bounding_box()
      figure=page.locator('.beam-diagram-aside').bounding_box()
      if viewport>800:
        assert abs(table['y']-figure['y'])<4,(theme,viewport,table,figure)
        assert table['x']+table['width']<figure['x']+3,(table,figure)
      else:
        assert figure['y']<table['y'],(table,figure)
      page.locator('#beamImperialDepth').fill('12')
      assert page.locator('#beamTableBody tr').count()==30
      page.locator('#beamImperialWeight').fill('14')
      assert page.locator('#beamTableBody tr').count()==1
      assert page.locator('#beamMetricDepth').input_value()=='310'
      assert page.locator('#beamMetricMass').input_value()=='21'
      assert page.locator('#beamTableBody tr').first.locator('td').all_text_contents()==['W12×14','W310×21','3.97','11.91']
      assert page.locator('#beamDiagramWidth').text_content()=='bf = 3.97″'
      assert page.locator('#beamDiagramDepth').text_content()=='d = 11.91″'
      assert 'page' not in page.locator('#beamStatus').inner_text().lower()
      # Confirm graphical dimension text does not intersect either arrow line; text bounds separate.
      bounds=page.evaluate('''() => {const svg=document.querySelector('#beamDiagram');const w=document.querySelector('#beamDiagramWidth').getBBox(), d=document.querySelector('#beamDiagramDepth').getBBox();return {w:{x:w.x,y:w.y,width:w.width,height:w.height},d:{x:d.x,y:d.y,width:d.width,height:d.height}};}''')
      assert bounds['w']['y']+bounds['w']['height']<37,bounds
      assert bounds['d']['x']>222 and bounds['d']['x']+bounds['d']['width']<300,bounds
      page.locator('#beamClear').click()
      assert page.locator('#beamTableBody tr').count()==196
      assert page.locator('#beamDiagramWidth').text_content()=='bf'
      page.locator('#beamMetricDepth').fill('310')
      assert page.locator('#beamTableBody tr').count()==30
      page.locator('#beamMetricMass').fill('21')
      assert page.locator('#beamImperialDepth').input_value()=='12'
      assert page.locator('#beamImperialWeight').input_value()=='14'
      assert page.locator('#beamTableBody tr').count()==1
      page.locator('#beamMetricMass').fill('999')
      assert page.locator('#beamTableBody tr').count()==0
      assert page.locator('#beamTableEmpty').is_visible()
      page.locator('#beamClear').click()
      page.locator('[data-beam-sort="flangeWidthIn"]').click()
      assert page.locator('#beamTableBody tr').first.locator('td').first.inner_text()=='W6×9'
      page.locator('[data-beam-sort="flangeWidthIn"]').click()
      assert page.locator('#beamTableBody tr').first.locator('td').first.inner_text()=='W14×730'
      page.locator('#beamClear').click()
      page.locator('#beamTableBody .beam-row-select').first.click()
      assert page.locator('#beamImperialDepth').input_value()=='4'
      assert page.locator('#beamImperialWeight').input_value()=='13'
      assert page.locator('#beamTableBody tr').count()==1
      assert not errors,errors
      assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'), (theme,viewport,page.evaluate('document.documentElement.scrollWidth'))
      # Show filtered W12x50 screenshot
      if viewport in [1400,390]:
        page.locator('#beamClear').click()
        page.locator('#beamImperialDepth').fill('12')
        page.locator('#beamImperialWeight').fill('50')
        page.screenshot(path=str(R/f'tests/steel_beam_lookup_v1_27_{theme}_{viewport}.png'),full_page=True)
      print('PASS',theme,viewport,'4-column lookup, side-by-side illustration, arrows, filtering, sorting, responsive')
      page.close()
  browser.close()
