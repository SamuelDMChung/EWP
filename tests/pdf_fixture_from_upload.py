"""Generate a portable PDF-text-coordinate fixture from the actual Sherman Road PDF.
PyMuPDF extracts original selectable text (no OCR), preserving column anchors.
This is a cross-engine approximation of PDF.js getTextContent(), not PDF.js itself.
"""
import fitz,json,sys
from pathlib import Path
source=Path(sys.argv[1]);target=Path(sys.argv[2]);doc=fitz.open(source);pages=[]
for p in doc:
 items=[]
 for block in p.get_text('dict')['blocks']:
  for line in block.get('lines',[]):
   for sp in line['spans']:
    if sp['text'].strip():
     items.append({'str':sp['text'],'transform':[1,0,0,1,float(sp['bbox'][0]),float(p.rect.height-sp['bbox'][1])]})
 pages.append(items)
target.write_text(json.dumps(pages,separators=(',',':')))
print('fixture',len(pages),'pages',sum(map(len,pages)),'items',target.stat().st_size,'bytes')
