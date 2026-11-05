"""V1.37 source preflight; compare full canonical V1.36 ZIP and protected ledger."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
from html.parser import HTMLParser
from hashlib import sha256
import re,subprocess,json,zipfile,sys
root=Path(__file__).resolve().parents[1]
baseline=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/EWP_Management_Portal_V1_36_WEB_FULL.zip')
assert baseline.exists(),f'Baseline missing: {baseline}'
with zipfile.ZipFile(baseline) as z:
 assert z.testzip() is None
 initial={name:sha256(z.read(name)).digest() for name in z.namelist() if not name.endswith('/')}
files=[p for p in root.rglob('*') if p.is_file()]
js=[p for p in files if p.suffix in {'.js','.mjs'}]
for p in js:
 r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
 assert r.returncode==0,(p,r.stderr)
htmls=[p for p in files if p.suffix=='.html' and 'tests' not in p.parts]
assert len(htmls)==11,len(htmls)
for p in htmls:
 text=p.read_text()
 assert 'V1.37 WEB · Developed by Samuel Chung' in text,p
 assert '?v=1.37' in text,p
 assert '?v=1.36' not in text,p
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.refs=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  self.refs.extend(d[key] for key in ('src','href') if key in d)
count_refs=0
for p in htmls:
 h=Parser();h.feed(p.read_text())
 for url in h.refs:
  if not url or url.startswith(('#','mailto:','tel:','data:','javascript:','//')) or '://' in url or '${' in url:continue
  path=urlsplit(url).path
  if not path or path=='/':continue
  assert not path.startswith('/'),(p,url)
  target=(p.parent/unquote(path)).resolve()
  assert target.is_file() or target.is_dir() and (target/'index.html').is_file(),(p,url)
  count_refs+=1
pattern=re.compile(r'''(?:from\s*|import\s*\(|import\s*)(['"])(\.?\.?/[^'"]+)\1''')
count_imports=0
for p in js:
 for m in pattern.finditer(p.read_text(errors='replace')):
  path=urlsplit(m.group(2)).path
  assert (p.parent/unquote(path)).resolve().is_file(),(p,path)
  count_imports+=1
# Protected hashes may be older than V1.36, but must still hold.
protected=json.loads((root/'tests/v1_32_protected_hashes.json').read_text())
for name,digest in protected.items():
 p=root/name
 assert p.is_file() and sha256(p.read_bytes()).hexdigest()==digest,('protected changed',name)
allowed={'PORTAL_HANDOFF.md','README.md','SALES_EMAIL_SETUP.md','sales/README.md','sales/sales.mjs','sales/sales.css'}
modified=[]
for name,digest in initial.items():
 p=root/name
 assert p.is_file(),('missing baseline file',name)
 if sha256(p.read_bytes()).digest()!=digest:
  modified.append(name)
  assert name in allowed or (name.endswith('.html') and not name.startswith('tests/')),('out-of-scope',name)
assert len([n for n in modified if n.endswith('.html')])==11
for name in initial:
 if name.endswith('.sql') or name.startswith('supabase/'):
  assert sha256((root/name).read_bytes()).digest()==initial[name],('protected SQL/backend changed',name)
assert not any(p.suffix.lower()=='.pdf' for p in files),'Customer PDFs should not be in source'
assert not any('IgDY-EU2vbPMRbxM0XxRDIdf' in p.read_text(errors='ignore') for p in files if p.suffix in {'.js','.mjs','.html','.md','.sql','.css'}),'Private URL leaked'
for name in ['sales/index.html','sales/sales.mjs','sales/sales.css']:
 s=(root/name).read_text().lower()
 assert 'sharepoint' not in s,name
assert 'full takeoff' not in (root/'sales/index.html').read_text().lower()
assert (root/'sales/sales.mjs').read_text().count('requestTasks()') >= 3
print(f'V1.37 release verify PASSED: {len(htmls)} HTML credits, {len(js)} JS syntax files, {count_refs} local HTML references, {count_imports} relative imports, {sum(n.endswith(".sql") for n in initial)} unchanged SQL files, {len(modified)} approved edits, {len(files)} files. No production data changes.')
