"""Offline Chromium UI test using actual Snow Load Calculator DOM/CSS and JS.
ES modules are flattened into a single in-memory script solely for this offline
harness; no production source is modified. NRCan/network not tested live.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'ewp-tools/snow-load'
html=(P/'index.html').read_text()
styles='\n'.join((ROOT/p).read_text() for p in ('portal-nav.css','theme.css','ewp-tools/tools.css','ewp-tools/snow-load/styles.css'))
html=re.sub(r'<link\b[^>]*>', '',html)
html=re.sub(r'<script\b[^>]*>\s*</script>', '',html)
html=html.replace('</head>','<style>'+styles+'</style></head>')
js=''
for f in ('snow-data.mjs','calc.mjs','load-units.mjs','app.mjs'):
 text=(P/f).read_text()
 text=re.sub(r'^import\s+.*?;\s*$', '',text,flags=re.M)
 text=re.sub(r'\bexport\s+(?=function|const|class)', '',text)
 js+='\n'+text
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for theme in ('light','dark'):
  for width in (1350,800,390):
   page=browser.new_page(viewport={'width':width,'height':900})
   errs=[];page.on('pageerror',lambda err:errs.append(str(err)))
   page.set_content(html)
   page.evaluate('(theme)=>document.documentElement.setAttribute("data-ewp-theme",theme)',theme)
   page.evaluate('window.fetch=async()=>({ok:true,json:async()=>[]})')
   page.add_script_tag(content=js)
   assert page.locator('#snowSs').get_attribute('readonly') is not None
   assert page.locator('#snowResultKpa').inner_text()=='— kPa'
   assert page.locator('#pressureKpa').count()==0
   assert page.locator('.snow-converter-panel').count()==0
   page.locator('input[name="snowMode"][value="custom"]').check()
   assert not page.locator('#snowSs').evaluate('(e)=>e.readOnly')
   page.locator('#snowSs').fill('2.6')
   page.locator('#snowSr').fill('0.3')
   assert page.locator('#snowSsPsf').input_value()=='54.3',page.locator('#snowSsPsf').input_value()
   assert page.locator('#snowSrPsf').input_value()=='6.27'
   assert page.locator('#snowResultKpa').inner_text()=='2.38 kPa'
   assert page.locator('#snowResultPsf').inner_text()=='49.7 psf'
   page.locator('#snowSsPsf').fill('50')
   assert page.locator('#snowSs').input_value()=='2.394013'
   assert page.locator('#snowResultKpa').inner_text()=='2.22 kPa'
   # psf input retains full precision even though paired kPa display is rounded.
   page.locator('#snowSrPsf').fill('6.27')
   res=float(page.locator('#snowResultKpa').inner_text().split()[0])
   assert abs(res-((50*.8+6.27)/20.885434273))<.01
   page.locator('#snowSsPsf').fill('oops')
   assert page.locator('#snowSs').input_value()==''
   assert page.locator('#snowError').is_visible()
   assert page.locator('#snowResultKpa').inner_text()=='— kPa'
   page.locator('#snowSsPsf').fill('0')
   assert page.locator('#snowSs').input_value()=='0'
   page.locator('#snowSr').fill('')
   assert page.locator('#snowSrPsf').input_value()==''
   assert page.locator('#snowResultKpa').inner_text()=='— kPa'
   # Restore custom values for persistence test
   page.locator('#snowSsPsf').fill('54.3')
   page.locator('#snowSrPsf').fill('6.27')
   custom_before=page.locator('#snowResultKpa').inner_text()
   # Selecting BC reference fills both displayed units and makes them read only.
   page.locator('input[name="snowMode"][value="location"]').check()
   page.locator('#snowCitySearch').fill('100 Mile')
   page.locator('#snowSuggest button').first.click()
   assert page.locator('#snowSs').input_value()=='2.6'
   assert page.locator('#snowSsPsf').input_value()=='54.3'
   assert page.locator('#snowSr').input_value()=='0.3'
   assert page.locator('#snowSrPsf').input_value()=='6.27'
   assert page.locator('#snowSs').evaluate('(e)=>e.readOnly')
   assert page.locator('#snowResultKpa').inner_text()=='2.38 kPa'
   page.locator('#snowCb').select_option('0.55')
   assert page.locator('#snowResultKpa').inner_text()=='1.73 kPa'
   # Restore the custom psf values after toggling.
   page.locator('input[name="snowMode"][value="custom"]').check()
   assert page.locator('#snowSsPsf').input_value()=='54.3'
   assert page.locator('#snowSrPsf').input_value()=='6.27'
   assert page.locator('#snowSs').input_value()=='2.599898'
   assert not page.locator('#snowSrPsf').evaluate('(e)=>e.readOnly')
   page.locator('#snowCb').select_option('0.8')
   assert page.locator('#snowResultKpa').inner_text()==custom_before
   assert not errs,errs
   assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'),(theme,width,page.evaluate('document.documentElement.scrollWidth'))
   if width in (1350,390):
    page.locator('input[name="snowMode"][value="custom"]').check()
    page.screenshot(path=str(ROOT/f'tests/snow_load_v1_28_{theme}_{width}.png'),full_page=True)
   print('PASS',theme,width,'custom kPa/psf, source-precision, invalid, blank, location read-only, return to custom, Cb, responsive')
   page.close()
 browser.close()
print('V1.28 browser smoke: 6 offline viewports/themes passed')
