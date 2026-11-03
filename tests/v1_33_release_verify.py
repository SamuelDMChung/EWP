"""V1.33 complete-web source preflight (read-only against V1.32 ZIP)."""
import zipfile,subprocess,hashlib,re,html.parser,sys,json
from pathlib import Path
from urllib.parse import urlsplit,unquote
root=Path(__file__).resolve().parents[1]
orig=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/EWP_Management_Portal_V1_32_WEB_FULL.zip')
files=[p for p in root.rglob('*') if p.is_file()]
js=[p for p in files if p.suffix in {'.js','.mjs'}]
for p in js:
 proc=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
 assert proc.returncode==0,('JS syntax failed',p,proc.stderr)
htmls=[p for p in files if p.suffix=='.html' and 'tests' not in p.parts]
assert len(htmls)==11,len(htmls)
for p in htmls:
 s=p.read_text()
 assert 'V1.33 WEB · Developed by Samuel Chung' in s,p
 assert '?v=1.33' in s,p
 assert '?v=1.32' not in s,p
class Parser(html.parser.HTMLParser):
 def __init__(self):super().__init__();self.refs=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  for k in ('href','src'):
   if k in d:self.refs.append(d[k])
refs=0
for p in htmls:
 h=Parser();h.feed(p.read_text())
 for url in h.refs:
  if not url or url.startswith(('#','mailto:','tel:','data:','javascript:','//')) or '://' in url or '${' in url:continue
  path=urlsplit(url).path
  if path in ('','/'):continue
  assert not path.startswith('/'),('root path',p,url)
  target=(p.parent/unquote(path)).resolve()
  assert target.is_file() or (target.is_dir() and (target/'index.html').is_file()),('broken ref',p,url)
  refs+=1
pattern=re.compile(r'''(?:from\s*|import\s*\(|import\s*)(['"])(\.?\.?/[^'"]+)\1''')
imports=0
for p in js:
 for m in pattern.finditer(p.read_text(errors='replace')):
  path=urlsplit(m.group(2)).path
  assert (p.parent/unquote(path)).resolve().is_file(),('broken import',p,path)
  imports+=1
# Portable hash ledger allows rerunning backend/SQL integrity checks when the prior ZIP is unavailable.
protected=json.loads((root/'tests/v1_32_protected_hashes.json').read_text())
for name,digest in protected.items():
 p=root/name
 assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==digest,('protected backend/SQL altered',name)
assert not any(p.suffix.lower()=='.pdf' for p in files), 'Original customer PDFs must never be in WEB release'
sql_count=sum(x.endswith('.sql') for x in protected)
assert sql_count>=14,sql_count
changed=[]
if orig.is_file():
 with zipfile.ZipFile(orig) as z:
  base={i.filename:hashlib.sha256(z.read(i)).digest() for i in z.infolist() if not i.is_dir()}
 # Strict out-of-scope change verification against the prior canonical ZIP.
 allowed={'PORTAL_HANDOFF.md','README.md','ewp-tools/README.md','ewp-tools/javelin-spruce-checker/README.md',
          'ewp-tools/javelin-spruce-checker/app.mjs','ewp-tools/javelin-spruce-checker/logic.mjs','ewp-tools/javelin-spruce-checker/checker.css','ewp-tools/javelin-spruce-checker/index.html'}
 for name,digest in base.items():
  p=root/name;assert p.is_file(),('missing canonical file',name)
  if hashlib.sha256(p.read_bytes()).digest()!=digest:
   changed.append(name)
   assert name in allowed or (name.endswith('.html') and 'tests/' not in name),('out-of-scope change',name)
 for name in base:
  if name.endswith('.sql') or name.startswith('supabase/'):
   assert hashlib.sha256((root/name).read_bytes()).digest()==base[name],('backend changed',name)
else:
 print('NOTE: prior V1.32 ZIP unavailable; baseline-to-baseline scope comparison skipped (protected hash ledger still checked).')
 assert not any(p.suffix.lower()=='.pdf' for p in files),'Customer PDF not allowed in public ZIP'
 assert all('tmp_local_pdf' not in p.name for p in files),'Transient raw PDF inspection code not allowed in release'
 for f in ['tests/v1_30_pdf_fixtures.json','tests/v1_31_new_pdf_fixtures.json']:
  data=(root/f).read_text()
  for needle in ['340 Ewen','33418 Marshall','1253 WEST','NU FRAME INC','KERRISDALE LUMBER','3780 West 4th']:
   assert needle.lower() not in data.lower(),(f,needle)
print(f'V1.33 preflight PASSED: {len(htmls)} HTML credits; {len(js)} JS syntax; {refs} local HTML paths; {imports} module imports; {sql_count} SQL unchanged; {len(changed)} approved modified baseline files; {len(files)} total files; no raw PDFs or backend edits.')
