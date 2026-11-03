import fitz,json,pathlib
base=pathlib.Path('/mnt/data');dest=pathlib.Path(__file__).parent/'v1_30_pdf_fixtures.json'
files={'j_standard':'TC25280 - 3780 W 4 - L3D1.pdf','s_standard':'2610-C09329.pdf','j_annotated':'TC26203 - 33418 Marshall Rd (Aria Block B) - L4 East.pdf','s_annotated':'2610-C08021.pdf'}
all={}
for name,filename in files.items():
 doc=fitz.open(base/filename);pages=[]
 for i,p in enumerate(doc):
  words=p.get_text('words')
  # use word-token representation in top-left coords; for PDFJS transform[5] is bottom-origin.
  items=[{'str':w[4], 'transform':[1,0,0,1,w[0],p.rect.height-w[1]], 'width':w[2]-w[0]} for w in words]
  annotations=[{'subtype':a.type[1],'contents':(a.info or {}).get('content',''), 'rect':[a.rect.x0,a.rect.y0,a.rect.x1,a.rect.y1]} for a in (p.annots() or [])]
  pages.append({'page':i+1,'height':p.rect.height,'items':items,'annotations':annotations})
 all[name]=pages
with open(dest,'w') as f:json.dump(all,f)
print(dest, dest.stat().st_size)
