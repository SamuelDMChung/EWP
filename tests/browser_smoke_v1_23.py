"""Offline Chromium smoke, actual V1.23 app logic with mocked session/read-only Supabase.
Runs on about:blank because this sandbox blocks navigation to any HTTP origin.
Source JS imports are replaced only in the temporary in-memory test harness.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import quote
from xml.etree import ElementTree as ET
import re, json
ROOT=Path(__file__).resolve().parents[1]
fixtures=[
 dict(id='11111111-1111-4111-8111-111111111111',project_number='TC26003',address_project_name='101 King St',customer='Acme',sales='Alex Sale',tracker_phase='Awarded',tracker_project_type='Townhome',tracker_project_type_other=None,project_type='multi',tracker_due_date='2026-11-15',tracker_status='queue'),
 dict(id='22222222-2222-4222-8222-222222222222',project_number='TC26002',address_project_name='202 Oak St',customer='Other',sales='Chris Doe',tracker_phase='Bidding',tracker_project_type='SFD',tracker_project_type_other=None,project_type='sfd',tracker_due_date='2026-11-20',tracker_status='delivering'),
 dict(id='33333333-3333-4333-8333-333333333333',project_number='TC26001',address_project_name='303 Pine St',customer='Hidden',sales='',tracker_phase='Awarded',tracker_project_type='SFD',tracker_project_type_other=None,project_type='sfd',tracker_due_date='2026-11-20',tracker_status='queue')
]
tasks=[dict(id='t1',project_id=fixtures[0]['id'],task='Layout',status='queue',created_at='2026-10-01'),dict(id='t2',project_id=fixtures[1]['id'],task='Quote',status='done',created_at='2026-10-02')]

def html_for(p,css):
    html=(ROOT/p).read_text()
    html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.I|re.S)
    html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>','',html,flags=re.I|re.S)
    html=html.replace('</head>','<style>'+''.join((ROOT/c).read_text() for c in css)+'</style></head>')
    return html

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1450,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    # Validate all 9 static page navigation structures and their section-scoped return links.
    from bs4 import BeautifulSoup
    pages={'tracker/index.html':'ewp','forecast/index.html':'ewp','ewp-tools/index.html':'ewp','ewp-tools/snow-load/index.html':'ewp','ewp-tools/consolidate-material-list/index.html':'ewp','sales/index.html':'sales','orders/index.html':'sales','sales-tracking/index.html':'sales'}
    for path,view in pages.items():
        doc=BeautifulSoup((ROOT/path).read_text(),'html.parser')
        assert len(doc.select('.ewp-portal-nav__group--ewp .ewp-portal-nav__link'))==3,path
        assert len(doc.select('.ewp-portal-nav__group--sales .ewp-portal-nav__link'))==3,path
        assert doc.select_one('.ewp-portal-nav__brand')['href'].endswith('?view='+view),path
        assert next(x['href'] for x in doc.select('.ewp-portal-nav__links a') if x.text.strip()=='Portal').endswith('?view='+view),path
        assert doc.select_one('.ewp-portal-nav__group--'+view+' [aria-current="page"]'),path
        print('PASS',path,'-> Portal',view)
    html=html_for('sales-tracking/index.html',['theme.css','portal-nav.css','sales-tracking/styles.css'])
    page.set_content(html,wait_until='load')
    # Use the unmodified app body; import declarations replaced with test session/data stubs.
    app=(ROOT/'sales-tracking/app.mjs').read_text()
    app='\n'.join(line for line in app.splitlines() if not line.lstrip().startswith('import '))
    filt=(ROOT/'sales-tracking/filters.mjs').read_text().replace('export function','function')
    mocks=f'''const SUPABASE_URL='https://mock.example';const SUPABASE_PUBLISHABLE_KEY='test';const EWP_AUTH_STORAGE_KEY='test';
    async function restoreSession(){{return {{user:{{email:'test@example.com'}}}}}}
    async function getAccessToken(){{return 'mocktoken'}}
    async function startTrackerRealtime(){{return null}}
    async function stopTrackerRealtime(){{}}
    window.mockQueries=[];
    window.fetch=async function(url,options){{
       const u=new URL(url),q=u.searchParams,table=u.pathname.split('/').pop();
       window.mockQueries.push({{table,method:options?.method||'GET',sales:q.get('sales')}});
       let records=[];
       if(table==='tracker_settings')records=[{{id:'global',sales:['Alex Sale','Chris Doe']}}];
       else if(table==='projects'){{records={json.dumps(fixtures)};if(q.has('sales'))records=records.filter(p=>p.sales===q.get('sales').replace(/^eq\\./,''));}}
       else if(table==='tracker_work_items'){{records={json.dumps(tasks)};const ids=q.get('project_id')?.replace(/^in\\.\\(/,'').replace(/\\)$/,'').split(',')||[];records=records.filter(t=>ids.includes(t.project_id));}}
       else throw Error('Unexpected DB read '+table);
       const offset=Number(q.get('offset')||0),limit=Number(q.get('limit')||1000);
       return {{ok:true,json:async()=>records.slice(offset,offset+limit)}};
    }};
    '''
    page.add_script_tag(content=mocks+'\n'+filt+'\n'+app)
    page.locator('#salesTrackerSelect option[value="__all_sales__"]').wait_for(state="attached")
    page.select_option('#salesTrackerSelect','__all_sales__')
    page.locator('#salesTrackerRows tr').first.wait_for(state="attached")
    assert page.locator('#salesTrackerRows tr').count()==2
    assert page.locator('#salesTrackerSelectedName').inner_text()=='All Sales'
    assert page.locator('#salesTrackerSalesLabel').is_visible()
    assert '2 of 2 projects' in page.locator('#salesTrackerCount').inner_text()
    assert 'Hidden' not in page.locator('#salesTrackerRows').inner_text()
    print('PASS All Sales loads two salespeople; unassigned project excluded')
    page.select_option('#salesTrackerSales','Chris Doe')
    assert page.locator('#salesTrackerRows tr').count()==1
    assert 'TC26002' in page.locator('#salesTrackerRows').inner_text()
    page.select_option('#salesTrackerStatus','completed')
    assert page.locator('#salesTrackerRows tr').count()==0
    page.get_by_role('button',name='Clear filters').click()
    assert page.locator('#salesTrackerRows tr').count()==2
    page.select_option('#salesTrackerPhase','Awarded')
    assert page.locator('#salesTrackerRows tr').count()==1
    page.get_by_role('button',name='Clear filters').click()
    page.select_option('#salesTrackerType','SFD')
    assert page.locator('#salesTrackerRows tr').count()==1
    page.get_by_role('button',name='Clear filters').click()
    print('PASS salesperson+status+phase+type filters and reset')
    page.screenshot(path=str(ROOT/'tests'/'sales_tracking_all_sales_v1_23.png'),full_page=True)
    page.get_by_role('button',name='Change Selection').click()
    page.select_option('#salesTrackerSelect','Alex Sale')
    page.locator('#salesTrackerRows tr').first.wait_for(state="attached")
    assert page.locator('#salesTrackerRows tr').count()==1
    assert page.locator('#salesTrackerSalesLabel').is_hidden()
    assert any(x.get('sales')=='eq.Alex Sale' for x in page.evaluate('window.mockQueries') if x['table']=='projects')
    assert all(x['method']=='GET' for x in page.evaluate('window.mockQueries'))
    print('PASS individual Sales filtering retained, all database requests GET-only')
    assert not errors,errors
    # Portal appearance + SVG image loading tested with temporary in-memory data:image/svg+xml sources.
    html=html_for('index.html',['theme.css','portal-nav.css','portal.css'])
    for key in ['project_tracking','ewp_forecast','ewp_tools','new_ewp_requests','ewp_order','sales_project_tracking']:
        path=f'assets/workspace-icons/{key}.svg'
        svg=(ROOT/path).read_text();ET.fromstring(svg)
        html=html.replace('src="'+path+'"','src="data:image/svg+xml,'+quote(svg)+'"')
    page.set_content(html,wait_until='load')
    pv=(ROOT/'portal-views.mjs').read_text().replace('export function','function')
    page.add_script_tag(content=pv+'''\n document.getElementById('portalWorkspace').hidden=false;
    document.getElementById('portalAuthLoading').hidden=true;
    for(const b of document.querySelectorAll('[data-workspace-view]'))b.addEventListener('click',()=>setWorkspaceView(b.dataset.workspaceView));
    setWorkspaceView('ewp');''')
    assert page.locator('[data-workspace-group="ewp"] .workspace-card:visible').count()==3
    assert page.locator('[data-workspace-group="sales"] .workspace-card:visible').count()==0
    page.get_by_role('button',name='All',exact=True).click()
    assert page.locator('[data-workspace-group="sales"] .workspace-card:visible').count()==3
    for icon in page.locator('.card-icon--art img').all():
        assert icon.evaluate('(img)=>img.complete && img.naturalWidth>0'),icon.get_attribute('src')
    page.get_by_role('button',name='Sales',exact=True).click()
    assert page.locator('[data-workspace-group="ewp"] .workspace-card:visible').count()==0
    assert page.locator('.ewp-portal-nav__brand').get_attribute('href')=='./?view=sales'
    assert page.locator('.ewp-portal-nav__link[data-workspace-role="staff"]').is_hidden()
    page.get_by_role('button',name='EWP',exact=True).click()
    assert page.locator('.ewp-portal-nav__brand').get_attribute('href')=='./?view=ewp'
    page.get_by_role('button',name='All',exact=True).click()
    print('PASS all six SVGs render and All/EWP/Sales toggle preserves Portal nav')
    page.screenshot(path=str(ROOT/'tests'/'portal_v1_23_light.png'),full_page=True)
    page.evaluate('document.documentElement.dataset.ewpTheme="dark"')
    page.screenshot(path=str(ROOT/'tests'/'portal_v1_23_dark.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(ROOT/'tests'/'portal_v1_23_mobile.png'),full_page=True)
    cards=[el.bounding_box() for el in page.locator('.workspace-card:visible').all()]
    assert all(b['x']>=0 and b['x']+b['width']<394 for b in cards)
    assert page.locator('.ewp-portal-nav__group--ewp').is_visible()
    assert page.locator('.ewp-portal-nav__group--sales').is_visible()
    print('PASS light/dark/mobile Portal and grouped navigation layout')
    assert not errors,errors
    browser.close()
print('PASS V1.23 offline Chromium smoke')
