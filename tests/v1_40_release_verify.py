"""V1.40 verified complete-source preflight compared with canonical V1.39 ZIP."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
from hashlib import sha256
import subprocess,re,zipfile
root=Path(__file__).resolve().parents[1]
base=Path('/mnt/data/EWP_Management_Portal_V1_39_WEB_FULL.zip')
with zipfile.ZipFile(base) as z:
 assert z.testzip() is None
 baseline={n:sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')}
files=[p for p in root.rglob('*') if p.is_file()]
assert not any(p.suffix.lower()=='.pdf' for p in files),'source/customer PDFs must not be committed'
assert not any(p.name.endswith('input.json') for p in files)
js=[p for p in files if p.suffix in ('.js','.mjs')]
for p in js:
 r=subprocess.run(['node','--check',str(p)],text=True,capture_output=True)
 assert r.returncode==0,(str(p),r.stderr)
htmls=[p for p in files if p.suffix=='.html' and 'tests' not in p.parts]
assert len(htmls)==11
for p in htmls:
 txt=p.read_text()
 assert 'V1.40 WEB · Developed by Samuel Chung' in txt,p
 assert '?v=1.40' in txt,p
class Refs(HTMLParser):
 def __init__(self): super().__init__();self.refs=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs);self.refs.extend([d[k] for k in ('src','href') if k in d])
nref=0
for p in htmls:
 parser=Refs();parser.feed(p.read_text())
 for ref in parser.refs:
  if not ref or ref.startswith(('#','mailto:','tel:','data:','javascript:','//')) or '://' in ref:continue
  fp=urlsplit(ref).path
  if not fp or fp=='/':continue
  target=(p.parent/unquote(fp)).resolve()
  assert target.is_file() or target.is_dir() and (target/'index.html').is_file(),(p,ref)
  nref+=1
imports=0
pattern=re.compile(r'''(?:from\s*|import\s*\(|import\s*)(['"])(\.?\.?/[^'"]+)\1''')
for p in js:
 for m in pattern.finditer(p.read_text(errors='replace')):
  target=(p.parent/unquote(urlsplit(m.group(2)).path)).resolve()
  assert target.is_file(),(p,m.group(2))
  imports+=1
allowed={'README.md','PORTAL_HANDOFF.md','ewp-tools/javelin-spruce-checker/README.md','ewp-tools/javelin-spruce-checker/logic.mjs','ewp-tools/javelin-spruce-checker/app.mjs'}
changed=[]
for name,old in baseline.items():
 p=root/name
 assert p.is_file(),('missing source',name)
 if sha256(p.read_bytes()).hexdigest()!=old:
  changed.append(name)
  assert name in allowed or name.endswith('.html'),('out-of-scope edit',name)
 if name.startswith(('sql/','supabase/')) or name in ['portal-auth.mjs','workspace-auth.mjs','shared-settings.mjs','v1_38_mfa_staging.sql']:
  assert sha256(p.read_bytes()).hexdigest()==old,('protected production component changed',name)
assert len(list(root.rglob('*.sql')))==len([n for n in baseline if n.endswith('.sql')]),'unexpected SQL migration'
for name in ['EWP_MANAGEMENT_PORTAL_V1_40_NEW_CHAT_HANDOFF.md','tests/V1_40_TEST_RESULTS.md','tests/v1_40_checker_no_unit_regression.mjs','tests/browser_checker_v1_40.py']:
 assert (root/name).is_file(),name
logic=(root/'ewp-tools/javelin-spruce-checker/logic.mjs').read_text()
app=(root/'ewp-tools/javelin-spruce-checker/app.mjs').read_text()
assert "./logic.mjs?v=1.40" in app
assert 'function floorSection(' in logic and 'function orderedToken(' in logic
assert not (root/'v140_input.json').exists()
print(f'PASS V1.40 preflight: {len(files)} files, {len(js)} JS syntax, 11 HTML credits, {nref} local HTML references, {imports} imports; {len(changed)} modified baseline files; all protected SQL/Auth/MFA/backend unchanged.')
print('Changed baseline:',', '.join(changed))
