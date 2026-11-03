"""V1.31 complete-web source release preflight (read-only)."""
import zipfile,subprocess,hashlib,re,sys,html.parser
from pathlib import Path
from urllib.parse import unquote,urlsplit
root=Path(__file__).resolve().parents[1]
original=Path('/mnt/data/EWP_Management_Portal_V1_30_WEB_FULL.zip')
files=[p for p in root.rglob('*') if p.is_file()]
js=[p for p in files if p.suffix in {'.js','.mjs'}]
for p in js:
 proc=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
 if proc.returncode:raise SystemExit('JS syntax failed: '+str(p)+'\n'+proc.stderr)
htmls=[p for p in files if p.suffix=='.html' and 'tests' not in p.parts]
assert len(htmls)==11,('HTML pages',len(htmls))
for p in htmls:
 s=p.read_text();assert 'V1.31 WEB · Developed by Samuel Chung' in s,p
 assert '?v=1.31' in s,p
# HTML local links/assets must resolve relative to page's directory, ignoring anchors/queries.
class Parser(html.parser.HTMLParser):
 def __init__(self):super().__init__();self.refs=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  for k in ('href','src'):
   if k in d:self.refs.append((k,d[k]))
refs=0
for p in htmls:
 h=Parser();h.feed(p.read_text())
 for key,url in h.refs:
  if not url or url.startswith(('#','mailto:','tel:','data:','javascript:','//')) or '://' in url or '${' in url:continue
  path=urlsplit(url).path
  if path in ('','/'):continue
  if path.startswith('/'):
   # GitHub Pages repo links are intentionally relative; root-only paths aren't needed here.
   raise AssertionError(f'Absolute project path in {p}: {url}')
  target=(p.parent/unquote(path)).resolve()
  if not target.is_file() and not (target.is_dir() and (target/'index.html').is_file()):
   raise AssertionError(f'Broken local link in {p.relative_to(root)}: {url}')
  refs+=1
# Check local ES module import literals.
imports=0
pattern=re.compile(r'''(?:from\s*|import\s*\(|import\s*)(['"])(\.?\.?/[^'"]+)\1''')
for p in js:
 for m in pattern.finditer(p.read_text(errors='replace')):
  path=urlsplit(m.group(2)).path
  target=(p.parent/unquote(path)).resolve()
  if not target.is_file():raise AssertionError(f'Broken import {p.relative_to(root)} {m.group(2)}')
  imports+=1
# No historical schema or email edge function alterations.
with zipfile.ZipFile(original) as z:
 original_sql={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.endswith('.sql')}
for n,digest in original_sql.items():assert hashlib.sha256((root/n).read_bytes()).hexdigest()==digest,'SQL modified: '+n
# PII-derived raw material PDFs are not part of public web release.
assert not any(p.suffix.lower()=='.pdf' for p in files)
for f in ['tests/v1_30_pdf_fixtures.json','tests/v1_31_new_pdf_fixtures.json']:
 data=(root/f).read_text()
 for needle in ['340 Ewen','33418 Marshall','1253 WEST','NU FRAME INC','KERRISDALE LUMBER','3780 West 4th']:
  assert needle.lower() not in data.lower(),(f,needle)
print(f'PRE-FLIGHT PASSED: {len(htmls)} HTML pages; {len(js)} JS/ESM syntax checks; {refs} HTML local refs; {imports} relative ES imports; {len(original_sql)} unchanged SQL scripts; {len(files)} source/test files; no raw PDFs')
