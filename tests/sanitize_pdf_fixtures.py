"""Strip customer/address/order header and commercial columns from local test fixtures.
This script is used during release preparation, not by the browser application.
Only geometry needed for material-parsing regression is retained. No raw PDFs
are included in the public WEB release.
"""
import json
from pathlib import Path
root=Path(__file__).resolve().parent
for filename in ['v1_30_pdf_fixtures.json','v1_31_new_pdf_fixtures.json']:
 p=root/filename;data=json.loads(p.read_text())
 for name,pages in data.items():
  j=name.startswith('j_')
  for page in pages:
   height=page['height'];items=[]
   for item in page['items']:
    y=height-item.get('transform',[0,0,0,0,0,0])[5]
    x=item.get('transform',[0,0,0,0,0,0])[4]
    if j:
     # Javelin header and material-table body, including section labels and page breaks.
     if (32<=y<=41 or (100<=y<=745 if page['page']==1 else 75<=y<=745)) and x<575:items.append(item)
    else:
     # Spruce: retain only line item code, descriptions, Ordered and UM.
     # Prices, customer account/address, phone, taxes and payment remain omitted.
     if 290<=y<=630 and 0<=x<445:items.append(item)
   if not j and page['page']==1:
    # Non-customer-facing generic format fingerprints permit auto-classification.
    for text,x,y in [('Griff Building Supplies',24,30),('CUSTOMER COPY',290,38)]:
     items.append({'str':text,'transform':[1,0,0,1,x,height-y],'width':len(text)*5})
   page['items']=items
   if j:
    for ann in page['annotations']:
     # Keep annotation type, rectangle and the known generic engineering instruction.
     content=ann.get('contents','')
     ann['contents']=content if ('All joists' in content or not content) else '[redacted review note]'
 p.write_text(json.dumps(data,separators=(',',':')))
 print(filename,'sanitized fixture bytes',p.stat().st_size)
