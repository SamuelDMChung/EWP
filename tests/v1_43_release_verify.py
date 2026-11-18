"""V1.43 complete-source preflight against verified V1.42 canonical ZIP."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
from hashlib import sha256
import zipfile,re,subprocess
root=Path(__file__).resolve().parents[1]
base=Path('/mnt/data/EWP_Management_Portal_V1_42_WEB_FULL.zip')
with zipfile.ZipFile(base) as z:
 assert z.testzip() is None
 original={n:sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')}
files=[p for p in root.rglob('*') if p.is_file() and '__pycache__' not in p.parts]
assert not any(p.suffix.lower()=='.pdf' for p in files), 'Customer PDFs accidentally bundled'
assert not any('private' in p.name.lower() or 'goat_ridge' in p.name.lower() for p in files), 'Customer fixtures accidentally bundled'
js=[p for p in files if p.suffix in ('.js','.mjs')]
for p in js:
 r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
 assert r.returncode==0,(p,r.stderr)
html=[p for p in files if p.suffix=='.html' and 'tests' not in p.parts]
assert len(html)==11,len(html)
for p in html:
 s=p.read_text()
 assert 'V1.43 WEB · Developed by Samuel Chung' in s,p
 assert '?v=1.43' in s,p
class RefParser(HTMLParser):
 def __init__(self):super().__init__();self.refs=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs);self.refs.extend(d.get(k,'') for k in ('src','href'))
nrefs=0
for p in html:
 prs=RefParser();prs.feed(p.read_text())
 for ref in prs.refs:
  if not ref or ref.startswith(('#','mailto:','tel:','data:','javascript:','//')) or '://' in ref:continue
  fp=urlsplit(ref).path
  if not fp or fp=='/':continue
  target=(p.parent/unquote(fp)).resolve()
  assert target.is_file() or (target.is_dir() and (target/'index.html').is_file()),(p,ref)
  nrefs+=1
imports=0
pat=re.compile(r'''(?:from\s*|import\s*\(|import\s*)(['"])(\.?\.?/[^'"]+)\1''')
for p in js:
 for m in pat.finditer(p.read_text(errors='replace')):
  target=(p.parent/unquote(urlsplit(m.group(2)).path)).resolve()
  assert target.is_file(),(p,m.group(2))
  imports+=1
allowed={'README.md','PORTAL_HANDOFF.md','ewp-tools/javelin-spruce-checker/README.md','ewp-tools/javelin-spruce-checker/logic.mjs','ewp-tools/javelin-spruce-checker/app.mjs'}
changed=[]
for name,hashval in original.items():
 p=root/name
 assert p.is_file(),('Missing baseline source',name)
 if sha256(p.read_bytes()).hexdigest()!=hashval:
  changed.append(name)
  assert name in allowed or p.suffix=='.html',('Unexpected scope change',name)
 if name.startswith('supabase/') or (name.startswith('forecast/') and not name.endswith('.html')) or name.endswith('.sql') or name in ['mfa-client.mjs','portal-auth.mjs','shared-settings.mjs','workspace-auth.mjs','v1_38_mfa_staging.sql']:
  assert sha256(p.read_bytes()).hexdigest()==hashval,('Protected backend/source modified',name)
assert len(list(root.rglob('*.sql')))==len([n for n in original if n.endswith('.sql')]),'SQL file count changed'
for x in ['EWP_MANAGEMENT_PORTAL_V1_43_NEW_CHAT_HANDOFF.md','docs/V1_43_DEPLOYMENT.md','tests/V1_43_TEST_RESULTS.md','tests/v1_43_lvl_grade_regression.mjs','tests/browser_checker_v1_43.py']:
 assert (root/x).is_file(),x
m=(root/'mfa-client.mjs').read_text()
assert "request('/auth/v1/user',undefined,'GET')" in m
assert "request('/auth/v1/factors',undefined,'GET')" not in m
logic=(root/'ewp-tools/javelin-spruce-checker/logic.mjs').read_text()
assert 'lvlTrailingGrades' in logic and 'LVL 2' in logic
assert 'prior.code===c' in logic and 'footer=true;continue' in logic
app=(root/'ewp-tools/javelin-spruce-checker/app.mjs').read_text()
assert 'logic.mjs?v=1.43' in app
print(f'PASS V1.43 source preflight: {len(files)} files, {len(js)} valid JS, {len(html)} HTML credits, {nrefs} local references, {imports} JS imports; {len(changed)} V1.42 files changed; 16 SQL and protected backend intact.')
print('Changed baseline files:',', '.join(changed))
