"""Regenerate all columns of the Varsteel rolled W-section table from the owner's 68-page PDF.

Source: printed pages 4-8 (PDF pages 10-14). Only rolled W sections.
The x-coordinate reading is specific to this PDF layout; data must be source-audited.
Run: python tests/extract_varsteel_w.py /path/to/Varsteel.pdf
"""
import fitz, json, re, sys
from pathlib import Path
p = fitz.open(sys.argv[1]); rows = []; errors = []
for pi in range(9, 14):
    words = p[pi].get_text('words')
    anchors = sorted((w for w in words if 58 <= w[0] <= 67 and re.fullmatch(r'\d+', w[4]) and 94 < w[1] < 400), key=lambda w:w[1])
    imp_family = met_family = None
    for w in anchors:
        yy = w[1]; line = [v for v in words if abs(v[1] - yy) < .65]
        def col(lo, hi): return [v[4] for v in sorted(line, key=lambda v:v[0]) if lo <= v[0] < hi]
        im = col(37,53); me = col(78,97); mw = col(99,116)
        d = col(121,144); bf = col(147,168); tf = col(176,205); tw = col(205,229); sx = col(229,270)
        try:
            if im:
                assert len(im)==1 and re.fullmatch(r'W\d+', im[0]);imp_family=int(im[0][1:])
            if me:
                assert len(me)==1 and re.fullmatch(r'W\d+', me[0]);met_family=int(me[0][1:])
            assert imp_family and met_family and all(len(c)==1 for c in [mw,d,bf,tf,tw]); assert len(sx)<=1
            row = dict(imperial=f'W{imp_family}x{w[4]}',metric=f'W{met_family}x{mw[0]}',flangeWidthIn=float(bf[0]),depthIn=float(d[0]),flangeThicknessIn=float(tf[0]),webThicknessIn=float(tw[0]),sectionModulusIn3=float(sx[0]) if sx else None,sourcePage=pi+1)
            assert 2<row['flangeWidthIn']<30 and 3<row['depthIn']<50
            assert .1<row['flangeThicknessIn']<8 and .1<row['webThicknessIn']<5
            rows.append(row)
        except Exception as exc:
            errors.append((pi+1,round(yy,2),w[4],im,me,mw,d,bf,tf,tw,sx,str(exc)))
assert not errors, errors
assert len(rows)==196
assert len({r['imperial'] for r in rows})==196
assert len({r['metric'] for r in rows})==196
assert next(r for r in rows if r['imperial']=='W12x14')==dict(imperial='W12x14',metric='W310x21',flangeWidthIn=3.97,depthIn=11.91,flangeThicknessIn=.225,webThicknessIn=.2,sectionModulusIn3=14.9,sourcePage=11)
missing=[r['imperial'] for r in rows if r['sectionModulusIn3'] is None]
assert missing==['W30x90'],missing
out=Path(__file__).parent.parent/'ewp-tools'/'steel-beam-width'/'w-sections.json'
out.write_text(json.dumps(rows,indent=2,ensure_ascii=False)+'\n')
print('196 complete Varsteel W sections extracted; blank published section modulus:',missing)
