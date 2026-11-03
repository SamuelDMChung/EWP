"""Static WEB release assertions. Does not replace live production QA."""
from pathlib import Path
from urllib.parse import urlparse,unquote
import re,zipfile,hashlib,sys
root=Path(__file__).resolve().parents[1]
base=Path('/mnt/data/EWP_Management_Portal_V1_28_WEB_FULL.zip')
assert base.exists()
with zipfile.ZipFile(base) as z:
 orig={n:z.read(n) for n in z.namelist()}
assert (root/'PORTAL_HANDOFF.md').read_text().startswith('# EWP Management Portal — V1.29 WEB')
assert (root/'README.md').read_text().startswith('# EWP Management Portal — V1.29 WEB')
htmls=sorted(root.rglob('*.html'))
assert len(htmls)==10,len(htmls)
checked=0
for f in htmls:
 content=f.read_text()
 assert 'V1.29 WEB · Developed by Samuel Chung' in content,f
 assert '?v=1.29' in content,f
 for attr in re.findall(r'\b(?:src|href)=["\']([^"\']+)["\']',content):
  u=urlparse(attr);candidate=unquote(u.path)
  if u.scheme or u.netloc or candidate.startswith(('#','data:','mailto:','javascript:')):continue
  if candidate in ('','/'):continue
  ref=(f.parent/candidate).resolve()
  assert ref.is_relative_to(root.resolve()),(f,attr)
  if candidate.endswith('/'):
   ref=ref/'index.html'
  assert ref.exists(),(f.relative_to(root),attr)
  checked+=1
jsfiles=sorted(list(root.rglob('*.js'))+list(root.rglob('*.mjs')))
modchecked=0
for f in jsfiles:
 s=f.read_text()
 for ref in re.findall(r'\b(?:from|import)\s*\(?\s*["\'](\.[^"\']+)["\']',s):
  dest=(f.parent/urlparse(ref).path).resolve()
  assert dest.is_relative_to(root.resolve()) and dest.exists(),(f.relative_to(root),ref)
  modchecked+=1
oldsql={n:content for n,content in orig.items() if n.endswith('.sql')}
assert len(oldsql)==14,len(oldsql)
for n,content in oldsql.items():
 assert (root/n).read_bytes()==content,n
assert (root/'ewp-tools/consolidate-material-list/multi-file.mjs').exists()
assert (root/'ewp-tools/consolidate-material-list/README.md').exists()
assert 'id="materialParse"' not in (root/'ewp-tools/consolidate-material-list/index.html').read_text()
print('Release verification passed:',len(htmls),'HTML pages;',len(jsfiles),'JS files;',checked,'HTML relative asset refs;',modchecked,'module refs;',len(oldsql),'unchanged SQL files')
