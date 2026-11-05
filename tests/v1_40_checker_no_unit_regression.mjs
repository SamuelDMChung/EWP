/** V1.40 no-unit/floor grouping and right-aligned >999 LF quantities.
 * Deterministic synthetic tokens; real user PDFs are NOT bundled. */
import assert from 'node:assert/strict';
import {parseJavelin,parseSpruce,compareMaterials,productSpec} from '../ewp-tools/javelin-spruce-checker/logic.mjs';
let checks=0;const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
const line=(y,cols)=>({y,tokens:cols.map(([x,text,width=0])=>({x,text,y,width})),text:cols.map(c=>c[1]).join(' ')});
const header=(text,y=130)=>line(y,[[280,text]]);
const jr=(plot,l,s,qty,y)=>line(y,[[37,plot],[98,`${l}'0"0`],[156,s],[508,'1'],[537,String(qty)]]);
const comment=(label,y)=>line(y,[[24,'COMMENT'],[129,label],[411,'1']]);
const sr=(code,desc,ordered,quantityX,y)=>line(y,[[24,code],[129,desc],[quantityX,ordered],[420,'LF']]);
const desc=(text,y)=>line(y,[[129,text]]);
const jpdf=[{page:1,lines:[
 line(100,[[37,'Level: Second Floor']]),header('Products'),
 jr("K18'",18,'11 7/8" TJI 230 joist',12,178),
 jr("X23'",23,'11 7/8" TJI 560 joist',29,198),
 jr('TSCa1',16,'1 3/4" x 11 7/8" 1.55E TimberStrand LSL',27,220),
 header('Blocking',260),
 jr('TSBk1',2,'1 3/4" x 11 7/8" 1.55E TimberStrand LSL',50,290),
 jr('TSBk1',1,'1 3/4" x 11 7/8" 1.55E TimberStrand LSL',145,310)
 ],annotations:[]}];
const spdf=[{page:1,lines:[
 comment('EXAMPLE STREET - SECOND FLOOR',310),
 sr('TJI2301178','TJI 230 2-5/16" X 11-7/8"','1,676',313,326),desc("12 - 18'",339),
 sr('TJI5601178','TJI 560 3-1/2" X 11-7/8"','1,551',313,360),desc("29 - 23'",372),
 sr('LSL11178','1-3/4" X 11-7/8" TIMBERSTRAND LSL 1.55E','677',320,400),desc("27 - 16', 50 - 2', 145 - 1'",413)
 ]}];
let j=parseJavelin(jpdf),s=parseSpruce(spdf),r=compareMaterials(j,s);
ok(j.records.length===5,'five separate Javelin base rows');
ok(j.records.every(x=>x.unit==='Second Floor'),'Products and Blocking stay in one floor section');
ok(s.records.length===3,'four digit LF Ordered values read as material lines');
ok(s.records.every(x=>x.section==='Second Floor'),'address comment normalized to Second Floor');
ok(s.records.find(x=>x.code==='TJI2301178').ordered===1676,'reads 1,676 LF');
ok(s.records.find(x=>x.code==='TJI5601178').ordered===1551,'reads 1,551 LF');
ok(!s.records.find(x=>x.code==='TJI2301178').description.includes('1,676'),'qty not appended to product description');
ok(r.details.find(x=>x.product.startsWith('TJI 230')).actualLF===1676,'proper TJI 230 LF');
ok(r.details.find(x=>x.product.startsWith('LSL 1.55')).expectedLF===677,'blocking and products merged at floor level');
// The fixture intentionally supplies only one TJI cut on Spruce. Both TJI rows
// must be parsed; exact cut comparisons still must correctly detect shortages.
ok(r.stats.match===1&&r.stats.review===2,'inconsistent synthetic TJI totals not silently accepted');
// All floor labels, without any numeric UNIT, normalize to the same grouping.
const samples=[['Second Floor','2nd Floor','Second Floor'],['First Floor','1st Floor','First Floor'],['Level 2','L2 EAST','Level 2'],['Third Floor','THIRD FLOOR','Third Floor']];
for(const [jFloor,sFloor,target] of samples){
 const jp=[{page:1,lines:[line(95,[[40,`Level: ${jFloor}`]]),jr('P1',9,'3 1/2" x 9 1/2" 2.2E Parallam PSL',1,200)]}];
 const sp=[{page:1,lines:[comment(sFloor,313),sr('PSL3912','3-1/2" x 9-1/2" PARALLAM PSL 2.2E','9',320,340),desc("1 - 9'",352)]}];
 const a=parseJavelin(jp),b=parseSpruce(sp),v=compareMaterials(a,b);
 ok(a.records[0].unit===target&&b.records[0].section===target,`matched no-unit floor ${jFloor}/${sFloor}`);
 ok(v.stats.match===1&&v.stats.mismatch===0,`matching cut list ${jFloor}/${sFloor}`);
}
// No floor labels at all still compare under a shared neutral section.
const bareJ=parseJavelin([{page:1,lines:[jr('P1',9,'3 1/2" x 9 1/2" 2.2E Parallam PSL',1,200)]}]);
const bareS=parseSpruce([{page:1,lines:[sr('PSL3912','3-1/2" x 9-1/2" PARALLAM PSL 2.2E','9',320,340),desc("1 - 9'",353)]}]);
ok(compareMaterials(bareJ,bareS).stats.match===1,'without level or unit headings, still compares');

const namedJ=parseJavelin([{page:1,lines:[line(90,[[40,'Level: Second Floor']]),jr('P1',9,'3 1/2" x 9 1/2" 2.2E Parallam PSL',1,190)]}]);
ok(compareMaterials(namedJ,bareS).stats.match===1,'single unlabelled Spruce section matches named Javelin floor');
const namedS=parseSpruce([{page:1,lines:[comment('SECOND FLOOR',313),sr('PSL3912','3-1/2" x 9-1/2" PARALLAM PSL 2.2E','9',320,340),desc("1 - 9'",353)]}]);
ok(compareMaterials(bareJ,namedS).stats.match===1,'single unlabelled Javelin section matches named Spruce floor');
const numS=parseSpruce([{page:1,lines:[comment('UNIT 209',313),sr('PSL3912','3-1/2" x 9-1/2" PARALLAM PSL 2.2E','9',320,340),desc("1 - 9'",353)]}]);
ok(compareMaterials(bareJ,numS).stats.match===0,'never infer numeric unit number from an unlabelled Javelin report');

// Spruce extraction may split the thousands number into adjacent tokens.
const split=parseSpruce([{page:1,lines:[comment('SECOND FLOOR',311),line(340,[[24,'TJI2301178'],[129,'TJI 230 2-5/16" X 11-7/8"'],[313,'1,',8],[322,'676',11],[420,'LF']]),desc("12 - 18'",353)]}]);
ok(split.records.length===1&&split.records[0].ordered===1676,'split 1,676 quantity reconstructed');
// No product-spec change to existing materials.
ok(productSpec('1 3/4" x 11 7/8" 2.0E Microllam LVL').key==='LVL|2.0|1.75|11.875','LVL normalization retained');
console.log(`PASS V1.40 unnumbered floor/large-order regression: ${checks} assertions`);
