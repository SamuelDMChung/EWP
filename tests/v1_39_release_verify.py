"""V1.39 WEB full-source preflight; preserves staged MFA/auth and protected backend."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
from hashlib import sha256
import zipfile,subprocess,re
root=Path(__file__).resolve().parents[1]
base=Path('/mnt/data/EWP_Management_Portal_V1_38_WEB_FULL.zip')
with zipfile.ZipFile(base) as z:
 assert z.testzip() is None
 baseline={n:sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')}
files=[p for p in root.rglob('*') if p.is_file()]
assert not any(p.suffix.lower()=='.pdf' for p in files),'customer/source PDFs cannot be published'
assert not any(p.name in ('2611-C10466.pdf','TC26224 - 46723 Yale Rd - L2 East.pdf') for p in files)
js=[p for p in files if p.suffix in ('.js','.mjs')]
for p in js:
 r=subprocess.run(['node','--check',str(p)],text=True,capture_output=True)
 assert r.returncode==0,(p,r.stderr)
htmls=[p for p in files if p.suffix=='.html' and 'tests' not in p.parts]
assert len(htmls)==11
for p in htmls:
 txt=p.read_text()
 assert 'V1.39 WEB · Developed by Samuel Chung' in txt, p
 assert '?v=1.39' in txt,p
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
pat=re.compile(r'''(?:from\s*|import\s*\(|import\s*)(['"])(\.?\.?/[^'"]+)\1''')
for p in js:
 for m in pat.finditer(p.read_text(errors='replace')):
  target=(p.parent/unquote(urlsplit(m.group(2)).path)).resolve()
  assert target.is_file(),(p,m.group(2))
  imports+=1
allowed_changes={'README.md','PORTAL_HANDOFF.md','ewp-tools/javelin-spruce-checker/README.md', 'ewp-tools/javelin-spruce-checker/logic.mjs','ewp-tools/javelin-spruce-checker/app.mjs'}
changed=[]
for n,hash_ in baseline.items():
 file=root/n
 assert file.is_file(),('missing baseline file',n)
 if sha256(file.read_bytes()).hexdigest()!=hash_:
  changed.append(n)
  assert n in allowed_changes or n.endswith('.html'),('out-of-scope modification',n)
 for prefix in ('sql/','supabase/'):
  if n.startswith(prefix):assert sha256(file.read_bytes()).hexdigest()==hash_,('SQL or backend changed',n)
for n in ['portal-auth.mjs','shared-settings.mjs','v1_38_mfa_staging.sql']:
 assert sha256((root/n).read_bytes()).hexdigest()==baseline[n],('MFA/auth modified',n)
logic=(root/'ewp-tools/javelin-spruce-checker/logic.mjs').read_text()
app=(root/'ewp-tools/javelin-spruce-checker/app.mjs').read_text()
assert "./logic.mjs?v=1.39" in app
assert 'const framing=t.match' in logic and 'Microllam' not in logic # type normalization case insensitive regex in uppercase
assert 'MICROLLAM|LVL' in logic
assert all((root/f).is_file() for f in ('EWP_MANAGEMENT_PORTAL_V1_39_NEW_CHAT_HANDOFF.md','tests/V1_39_TEST_RESULTS.md','tests/v1_39_checker_section_regression.mjs'))
print(f'PASS V1.39 preflight: {len(files)} files, {len(js)} JS syntax files, 11 HTML page credits, {nref} local HTML refs, {imports} imports, {len(changed)} changed baseline files; all protected SQL and MFA/auth untouched.')
print('Changed:', ', '.join(changed))
