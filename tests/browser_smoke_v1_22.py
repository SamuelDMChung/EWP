"""Offline Chromium UI/layout test. Auth + production DB are NOT exercised.
Uses actual portal HTML/CSS + unmodified portal-view control source, inline.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import re
root=Path('/mnt/data/ewp_v122_work');output=root/'tests'
html=(root/'index.html').read_text()
html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.I|re.S)
html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>','',html,flags=re.I|re.S)
styles='\n'.join((root/f).read_text() for f in ['theme.css','portal-nav.css','portal.css'])
html=html.replace('</head>','<style>'+styles+'</style></head>')
js=(root/'portal-views.mjs').read_text().replace('export function ','function ')
js+='''\ndocument.getElementById('portalWorkspace').hidden=false;
document.getElementById('portalAuthLoading').hidden=true;
for(const button of document.querySelectorAll('[data-workspace-view]'))button.addEventListener('click',()=>setWorkspaceView(button.dataset.workspaceView));
setWorkspaceView('all');\n'''
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':900})
 errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
 page.set_content(html,wait_until='load');page.add_script_tag(content=js)
 def verify(view,ewp,sales):
  a=page.locator('[data-workspace-group="ewp"] .workspace-card:visible').count()
  b=page.locator('[data-workspace-group="sales"] .workspace-card:visible').count()
  assert (a,b)==(ewp,sales),(view,a,b)
  assert page.locator(f'[data-workspace-view="{view}"]').get_attribute('aria-pressed')=='true'
  assert page.locator('.workspace-card').count()==6
  print('PASS',view,'cards',a,b)
 verify('all',3,3)
 page.screenshot(path=str(output/'portal_all_light_v1_22.png'),full_page=True)
 page.get_by_role('button',name='EWP',exact=True).click();verify('ewp',3,0)
 page.get_by_role('button',name='Sales',exact=True).click();verify('sales',0,3)
 assert page.locator('.ewp-portal-nav__link[data-workspace-role="staff"]').is_hidden()
 page.get_by_role('button',name='All',exact=True).click();verify('all',3,3)
 page.evaluate('document.documentElement.setAttribute("data-ewp-theme","dark")')
 page.screenshot(path=str(output/'portal_all_dark_v1_22.png'),full_page=True)
 print('PASS dark-mode styles')
 page.set_viewport_size({'width':390,'height':844})
 page.screenshot(path=str(output/'portal_all_mobile_v1_22.png'),full_page=True)
 boxes=[c.bounding_box() for c in page.locator('.workspace-group .workspace-card:visible').all()]
 assert all(box['x']>=0 and box['x']+box['width']<=393 for box in boxes),boxes
 print('PASS mobile',len(boxes),'visible cards without horizontal overflow')
 assert not errors,errors
 print('PASS zero page errors')
 browser.close()
