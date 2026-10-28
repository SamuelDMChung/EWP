"""Static release QA: code syntax, references, baseline integrity and archive."""
from pathlib import Path
from urllib.parse import urlparse
import subprocess, re, zipfile, hashlib
root=Path(__file__).resolve().parents[1]
prior=Path('/mnt/data/EWP_Management_Portal_V1_27_WEB_FULL.zip')
js=[p for p in root.rglob('*') if p.suffix in ('.js','.mjs')]
for p in js:
 r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
 assert r.returncode==0,(p,r.stderr)
print(f'PASS: node --check {len(js)} JavaScript files')
html_files=list(root.rglob('*.html'))
assert len(html_files)==10
ref_count=0
for p in html_files:
 s=p.read_text()
 assert 'V1.28 WEB · Developed by Samuel Chung' in s,p
 assert '?v=1.28' in s,p
 for path in re.findall(r'(?:src|href)=["\']([^"\']+)["\']',s):
  if path.startswith(('https://','http://','data:','mailto:','#','javascript:')):continue
  dest=(p.parent/path.split('?')[0].split('#')[0]).resolve()
  assert dest.exists(),(p,path)
  ref_count+=1
print(f'PASS: {len(html_files)} HTML pages, credits and {ref_count} relative local HTML references')
module_count=0
for p in js:
 s=p.read_text()
 for m in re.finditer(r'\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["\'](\.[^"\']+)["\']',s):
  target=(p.parent/m.group(1).split('?')[0]).resolve()
  assert target.exists(),(p,m.group(1))
  module_count+=1
print(f'PASS: {module_count} relative module references')
with zipfile.ZipFile(prior) as z:
 base={n:z.read(n) for n in z.namelist() if not n.endswith('/')}
for name,data in base.items():
 p=root/name
 assert p.exists(),name
 if name.lower().endswith('.sql') or name=='ewp-tools/steel-beam-width/w-sections.json':
  assert p.read_bytes()==data, 'Unintended DB schema or beam reference modification: '+name
print(f'PASS: {sum(n.endswith(".sql") for n in base)} SQL files and original 196-shape beam catalog byte-identical')
no_change_dirs=['tracker','forecast','sales','orders','sales-tracking']
for name,data in base.items():
 if name.startswith(tuple(d+'/' for d in no_change_dirs)) and not name.endswith('.html'):
  assert (root/name).read_bytes()==data,name
print('PASS: all non-HTML code/data in tracker, forecast, sales, orders and sales-tracking unchanged')
zip_path=Path('/mnt/data/EWP_Management_Portal_V1_28_WEB_FULL.zip')
files=sorted(p for p in root.rglob('*') if p.is_file() and '__pycache__' not in p.parts)
with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
 for p in files:z.write(p,p.relative_to(root).as_posix())
with zipfile.ZipFile(zip_path) as z:
 assert z.testzip() is None
 members=z.namelist()
 assert len(members)==len(set(members))==len(files)
 for n in members:
  assert not n.startswith('/') and '..' not in n.split('/'),n
 assert z.read('ewp-tools/snow-load/load-units.mjs')
 print(f'PASS: ZIP {len(members)} files, {zip_path.stat().st_size:,} bytes, no duplicates, CRC okay')
