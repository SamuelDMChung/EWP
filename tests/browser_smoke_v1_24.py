"""Offline V1.24 browser smoke, actual converter UI JS and styling.
No live URL can be opened in this environment; module's existing import is
replaced by a literal from the unchanged local calc module for this harness.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'ewp-tools/snow-load/index.html').read_text()
STYLES='\n'.join((ROOT/f).read_text() for f in ['portal-nav.css','theme.css','ewp-tools/tools.css','ewp-tools/snow-load/styles.css'])
JS=(ROOT/'ewp-tools/snow-load/pressure-converter.mjs').read_text()
assert JS.count("import {KPA_TO_PSF} from './calc.mjs?v=1.24';")==1
JS=JS.replace("import {KPA_TO_PSF} from './calc.mjs?v=1.24';", 'const KPA_TO_PSF=20.885434273;')
JS=re.sub(r'\bexport\s+(?=function|const)', '', JS)
HTML=re.sub(r'<link\b[^>]*>', '', HTML)
HTML=re.sub(r'<script\b[^>]*>\s*</script>', '', HTML)
HTML=HTML.replace('</head>','<style>'+STYLES+'</style></head>')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for theme in ('light','dark'):
  for width in (1350,390):
   page=browser.new_page(viewport={'width':width,'height':900},device_scale_factor=1)
   page.set_content(HTML)
   page.evaluate('(theme)=>document.documentElement.setAttribute("data-ewp-theme",theme)',theme)
   page.locator('#snowResultKpa').evaluate('(e)=>e.textContent="2.38 kPa"')
   page.add_script_tag(content=JS)
   assert page.locator('#pressurePsf').input_value()=='20.8854'
   page.locator('#pressureKpa').fill('2.6')
   assert page.locator('#pressurePsf').input_value()=='54.3021',page.locator('#pressurePsf').input_value()
   assert page.locator('#snowResultKpa').inner_text()=='2.38 kPa'
   page.locator('#pressurePsf').fill('50')
   assert page.locator('#pressureKpa').input_value()=='2.394013'
   page.locator('#pressureKpa').fill('invalid')
   assert page.locator('#pressurePsf').input_value()==''
   assert page.locator('#pressureMessage').is_visible()
   page.locator('#pressureClear').click()
   assert page.locator('#pressureKpa').input_value()=='' and page.locator('#pressurePsf').input_value()==''
   assert not page.locator('#pressureMessage').is_visible()
   assert page.locator('.snow-converter-panel').bounding_box()['y']>page.locator('.snow-result').bounding_box()['y']
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'),(theme,width,page.evaluate('document.documentElement.scrollWidth'))
   if width==1350:
    page.locator('#pressureKpa').fill('1')
    page.locator('.snow-converter-panel').screenshot(path=str(ROOT/f'tests/converter_v1_24_{theme}.png'))
   print('PASS',theme,width,'bidirectional / invalid / clear / layout / independence')
   page.close()
 browser.close()
print('V1.24 browser smoke: 4 offline viewport/theme scenarios passed')
