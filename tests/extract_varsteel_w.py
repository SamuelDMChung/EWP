"""Reproduce the V1.25 local W-section dimension reference from the user-provided Varsteel PDF.

Source: Varsteel Reference Book, 68-page PDF, pages 10-14 (printed pages 4-8).
Only W (rolled wide-flange) sections are included; WWF, S, and HP are excluded.
Uses fixed, visually verified printed table columns; fails closed if any entry is malformed.
Run: python tests/extract_varsteel_w.py /path/to/Varsteel.pdf
"""
import fitz, json, re, sys
from pathlib import Path
p=fitz.open(sys.argv[1]); result=[]; problems=[]
for page_i in range(9,14):
    words=p[page_i].get_text('words')
    # All table entries have an imperial mass in the printed imperial designation column.
    anchors=sorted((w for w in words if 58<=w[0]<=67 and re.fullmatch(r'\d+',w[4]) and 94<w[1]<400),key=lambda w:w[1])
    imperial_family=metric_family=None
    for w in anchors:
        yy=w[1]
        row=[v for v in words if abs(v[1]-yy)<0.65 and v[0]<175]
        def col(lo,hi):return [v[4] for v in sorted(row,key=lambda v:v[0]) if lo<=v[0]<hi]
        imp=col(37,53); met=col(78,97); mass=col(99,116)
        dp=col(121,144); bw=col(147,168)
        if imp:
            assert len(imp)==1 and re.fullmatch('W[0-9]+',imp[0]),(page_i+1,yy,imp)
            imperial_family=int(imp[0][1:])
        if met:
            assert len(met)==1 and re.fullmatch('W[0-9]+',met[0]),(page_i+1,yy,met)
            metric_family=int(met[0][1:])
        try:
            assert imperial_family and metric_family and len(mass)==1 and len(dp)==1 and len(bw)==1, (imp,met,mass,dp,bw)
            rowval={"imperial":f"W{imperial_family}x{w[4]}","metric":f"W{metric_family}x{mass[0]}","flangeWidthIn":float(bw[0]),"depthIn":float(dp[0]),"sourcePage":page_i+1}
            assert 2<rowval['flangeWidthIn']<30 and 3<rowval['depthIn']<50
            result.append(rowval)
        except Exception as exc: problems.append((page_i+1,round(yy,1),str(exc)))
assert not problems, problems
assert len(result)==len(set(v['imperial'] for v in result)), 'Duplicate imperial designation'
assert len(result)==len(set(v['metric'] for v in result)), 'Duplicate metric designation'
assert [v for v in result if v['imperial']=='W12x14']==[{"imperial":"W12x14","metric":"W310x21","flangeWidthIn":3.97,"depthIn":11.91,"sourcePage":11}]
assert len(result)>180, len(result)
out=Path(__file__).parent.parent/'ewp-tools'/'steel-beam-width'/'w-sections.json'; out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(result,indent=2)+'\n')
print('Extracted',len(result),'W beams from pages',sorted(set(v['sourcePage'] for v in result)))
from collections import Counter
print('Per page:',Counter(v['sourcePage'] for v in result))
print('Depth families:',sorted(set(v['imperial'].split('x')[0] for v in result),key=lambda x:int(x[1:])))
print('Start:',result[:5]); print('End:',result[-5:])
