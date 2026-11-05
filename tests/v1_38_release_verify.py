"""V1.38 source QA — unchanged non-auth workspaces, file/reference integrity, staged-only security."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
from html.parser import HTMLParser
from hashlib import sha256
import re,subprocess,zipfile,sys
root=Path(__file__).resolve().parents[1]
baseline=Path('/mnt/data/EWP_Management_Portal_V1_37_WEB_FULL.zip')
assert baseline.is_file()
with zipfile.ZipFile(baseline) as z:
 assert z.testzip() is None
 original={n:sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')}
files=[p for p in root.rglob('*') if p.is_file()]
js=[p for p in files if p.suffix in {'.mjs','.js'}]
for p in js:
 r=subprocess.run(['node','--check',str(p)],text=True,capture_output=True)
 assert r.returncode==0,(p,r.stderr)
htmls=[p for p in files if p.suffix=='.html' and 'tests' not in p.parts]
assert len(htmls)==11
for p in htmls:
 src=p.read_text()
 assert 'V1.38 WEB · Developed by Samuel Chung' in src,p
 assert '?v=1.38' in src,p
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.refs=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs);self.refs += [d[k] for k in ('src','href') if k in d]
numrefs=0
for p in htmls:
 h=Parser();h.feed(p.read_text())
 for ref in h.refs:
  if not ref or ref.startswith(('#','mailto:','tel:','data:','javascript:','//')) or '://' in ref:continue
  path=urlsplit(ref).path
  if not path or path=='/':continue
  out=(p.parent/unquote(path)).resolve()
  assert out.is_file() or out.is_dir() and (out/'index.html').is_file(),(p,ref)
  numrefs+=1
pat=re.compile(r'''(?:from\s*|import\s*\(|import\s*)(['"])(\.?\.?/[^'"]+)\1''')
imports=0
for p in js:
 for match in pat.finditer(p.read_text(errors='replace')):
  u=urlsplit(match.group(2)).path
  assert (p.parent/unquote(u)).resolve().is_file(),(p,u)
  imports+=1
allowed={'portal-auth.mjs','portal.css','shared-settings.mjs','forecast/auth.mjs','README.md','PORTAL_HANDOFF.md','sql/README.md'}
modified=[]
for n,digest in original.items():
 p=root/n
 assert p.exists(),('missing V1.37 file',n)
 if sha256(p.read_bytes()).hexdigest()!=digest:
  modified.append(n)
  assert n in allowed or n.endswith('.html') or (n.endswith('.mjs') or n.endswith('.js')) and 'auth.mjs?v=1.38' in p.read_text(),('out of scope',n)
for n in original:
 if n.endswith('.sql') or n.startswith('supabase/'):
  assert sha256((root/n).read_bytes()).hexdigest()==original[n],('protected backend changed',n)
assert 'CREATE TABLE IF NOT EXISTS ewp_private.mfa_admins' in (root/'v1_38_mfa_staging.sql').read_text()
assert 'enforcement_enabled boolean NOT NULL DEFAULT false' in (root/'v1_38_mfa_staging.sql').read_text()
assert 'REVOKE ALL ON FUNCTION public.ewp_mfa_status() FROM PUBLIC, anon' in (root/'v1_38_mfa_staging.sql').read_text()
assert 'mfaStatus()' in (root/'portal-auth.mjs').read_text()
assert 'renderMfaAdmin' in (root/'shared-settings.mjs').read_text()
assert not any(p.suffix.lower()=='.pdf' for p in files),'no customer PDFs in source'
print(f'PASS V1.38: {len(files)} files, {len(js)} JS syntax, 11 HTML credits, {numrefs} HTML paths, {imports} imports, {len(modified)} prior files changed; SQL and backend history intact.')
