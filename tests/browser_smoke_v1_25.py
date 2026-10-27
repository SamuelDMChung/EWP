"""Offline Chromium in-memory UI smoke: real lookup.mjs logic and new page markup/styles.
Does not test HTTP fetch, live Supabase authentication, or deployed GitHub Pages.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'ewp-tools/steel-beam-width/index.html').read_text()
STYLES='\n'.join((ROOT/x).read_text() for x in ['portal-nav.css','theme.css','ewp-tools/tools.css','ewp-tools/steel-beam-width/styles.css'])
LOOKUP=(ROOT/'ewp-tools/steel-beam-width/lookup.mjs').read_text()
JS=re.sub(r'\bexport\s+(?=function)', '', LOOKUP)
DATA=json.loads((ROOT/'ewp-tools/steel-beam-width/w-sections.json').read_text())
HTML=re.sub(r'<link\b[^>]*>', '', HTML)
HTML=re.sub(r'<script\b[^>]*>\s*</script>', '', HTML)
HTML=HTML.replace('</head>','<style>'+STYLES+'</style></head>')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for theme in ('light','dark'):
  for width in (1350,390):
   pg=browser.new_page(viewport={'width':width,'height':900},device_scale_factor=1)
   errors=[]
   pg.on('pageerror',lambda error:errors.append(str(error)))
   pg.set_content(HTML)
   pg.evaluate('(v)=>document.documentElement.dataset.ewpTheme=v',theme)
   pg.add_script_tag(content=JS+'\nmountSteelBeamWidth(document, '+json.dumps(DATA)+');')
   assert pg.locator('#beamCount').inner_text()=='196'
   assert pg.locator('#beamFlangeWidth').inner_text()=='—'
   pg.locator('#beamImperialDepth').fill('12');pg.locator('#beamImperialWeight').fill('14')
   assert pg.locator('#beamMetricDepth').input_value()=='310'
   assert pg.locator('#beamMetricMass').input_value()=='21'
   assert pg.locator('#beamFlangeWidth').inner_text()=='3.97″'
   assert pg.locator('#beamActualDepth').inner_text()=='11.91″'
   assert 'W12×14' in pg.locator('#beamMatchedTitle').inner_text()
   pg.locator('#beamClear').click()
   pg.locator('#beamMetricDepth').fill('310');pg.locator('#beamMetricMass').fill('21')
   assert pg.locator('#beamImperialDepth').input_value()=='12'
   assert pg.locator('#beamImperialWeight').input_value()=='14'
   assert pg.locator('#beamFlangeWidth').inner_text()=='3.97″'
   pg.locator('#beamMetricMass').fill('999')
   assert pg.locator('#beamFlangeWidth').inner_text()=='—'
   assert pg.locator('#beamActualDepth').inner_text()=='—'
   assert pg.locator('#beamImperialDepth').input_value()==''
   assert 'No matching' in pg.locator('#beamStatus').inner_text()
   pg.locator('#beamMetricMass').fill('21')
   assert pg.locator('#beamFlangeWidth').inner_text()=='3.97″'
   pg.locator('#beamClear').click()
   assert pg.locator('#beamFlangeWidth').inner_text()=='—'
   assert not errors,errors
   assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'),(width,theme,pg.evaluate('document.documentElement.scrollWidth'))
   assert pg.locator('.tools-breadcrumb a').get_attribute('href')=='../'
   assert pg.locator('.ewp-portal-nav__brand').get_attribute('href')=='../../?view=ewp'
   if width==1350:
    pg.locator('#beamImperialDepth').fill('12');pg.locator('#beamImperialWeight').fill('14')
    pg.locator('.steel-panel').screenshot(path=str(ROOT/f'tests/steel_beam_width_v1_25_{theme}.png'))
   print('PASS',theme,width,'imperial/metric/missing/clear/mobile/no overflow')
   pg.close()
 hub=browser.new_page()
 hub.set_content((ROOT/'ewp-tools/index.html').read_text())
 assert hub.locator('.tool-card').count()==3
 assert hub.locator('.tool-card[href="steel-beam-width/"]').count()==1
 assert hub.locator('.tool-card[href="snow-load/"]').count()==1
 assert hub.locator('.tool-card[href="consolidate-material-list/"]').count()==1
 print('PASS hub all three tools present')
 browser.close()
print('V1.25 Chromium smoke: 5 offline in-memory cases passed')
