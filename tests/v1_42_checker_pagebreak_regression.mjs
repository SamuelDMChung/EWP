/** V1.42: Page-break material continuity / no duplicate quantity regression.
 * Synthetic token geometry only: customer PDFs remain outside public ZIP.
 */
import assert from 'node:assert/strict';
import {parseSpruce,parseJavelin,compareMaterials} from '../ewp-tools/javelin-spruce-checker/logic.mjs';
let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const line=(y,entries)=>({y,tokens:entries.map(([x,text])=>({x,text,y,width:Math.max(8,text.length*3)})),text:entries.map(x=>x[1]).join(' ')});
const material=(code,description,lf,y=550)=>line(y,[[24,code],[129,description],[325,String(lf)],[420,'LF']]);
const continuation=(text,y=317)=>line(y,[[129,text]]);
const comment=(text,y=310)=>line(y,[[24,'COMMENT'],[129,text],[412,'1']]);
const header=(y=297)=>line(y,[[24,'Item'],[129,'Description'],[320,'Ordered'],[420,'UM'],[480,'Price']]);
const footer=()=>[line(600,[[455,'SubTotal']]),line(605,[[20,'Payment Method(s)'],[119,'Buyer:'],[164,'Example Name']]),line(614,[[164,'BENNING'],[457,'SalesTax']])];
const baseP1=[comment('TRIPLEX - MAIN FLOOR',312),material('PSL3912','3-1/2" X 9-1/2" PARALLAM PSL',28,562),...footer()];
const baseP2=[header(),continuation('2.2E',316),continuation("4 - 7'",326),material('LSL3912','3-1/2" X 9-1/2" TIMBERSTRAND LSL',8,342),continuation('1.55E',353),continuation("1 - 8'",365),...footer()];
const j=[{page:1,lines:[line(98,[[37,'Level: Main Floor']]),line(130,[[280,'Wall Framing']]),line(202,[[37,'PHd1'],[98,"7'0\"0"],[156,'3 1/2" x 9 1/2" 2.2E Parallam PSL'],[509,'1'],[539,'4']]),line(225,[[37,'TSHd1'],[98,"8'0\"0"],[156,'3 1/2" x 9 1/2" 1.55E TimberStrand LSL'],[509,'1'],[539,'1']])]}];
function run(p1=baseP1,p2=baseP2){const s=parseSpruce([{page:1,lines:p1},{page:2,lines:p2}]);const compare=compareMaterials(parseJavelin(j),s);return {s,compare};}
{
 const {s,compare}=run();
 eq(s.records.length,2,'one PSL record across pages and one LSL record');
 const psl=s.records.find(r=>r.code==='PSL3912');
 ok(Boolean(psl),'PSL is retained');
 eq(psl.pages,[1,2],'both original page numbers recorded');
 ok(psl.description.includes('2.2E')&&psl.description.includes("4 - 7'"),'continuation grade and cuts attached');
 ok(!psl.description.includes('BENNING')&&!psl.description.includes('Buyer'),'footer excluded');
 eq(psl.cuts,[{qty:4,length:7}],'correct four 7ft cuts');
 eq(psl.ordered,28,'28 LF counted once');
 ok(!psl.notes.length,'no false missing cut or grade warnings');
 eq(compare.stats.mismatch,0,'no false material mismatch');
 eq(compare.stats.match,2,'two match groups');
 ok(s.records.every(r=>r.section==='Main Floor'),'unnumbered Main Floor recognized on Spruce');
 const entry=compare.details.find(x=>x.product?.startsWith('PSL'));
 eq(entry.sprucePages,[1,2],'provenance links both pages');
}
{
 // Some PDF.js exports repeat a code, quantity and UM on page two but omit
 // description. Treat it as the unfinished *same* row, not another purchase.
 const repeats=[header(),material('PSL3912','',28,310),continuation('2.2E',316),continuation("4 - 7'",326),material('LSL3912','3-1/2" X 9-1/2" TIMBERSTRAND LSL',8,342),continuation('1.55E',353),continuation("1 - 8'",365)];
 const {s,compare}=run(baseP1,repeats);
 eq(s.records.length,2,'repeated page header does not create extra material');
 eq(s.records.find(x=>x.code==='PSL3912').ordered,28,'repeated 28 LF not double counted');
 eq(compare.stats.match,2,'with repeated code, both materials match');
 eq(compare.stats.mismatch,0,'with repeated code, no false mismatch');
}
{
 // Recovery if a different PDF tokenizer caused the prior incomplete item to
 // be flushed before its page-two standalone grade and cuts.
 const p1=[...baseP1.slice(0,2),material('TJI2301178','TJI 230 2-5/16" X 11-7/8"',252,585),...footer()];
 // A genuinely different material heading before the break must not be
 // overwritten by earlier PSL descriptions; both records stay independent.
 const {s}=run(p1,baseP2);
 eq(s.records.length,3,'two separate materials and page-two LSL retained');
 ok(s.records.find(x=>x.code==='PSL3912')?.notes.some(x=>/Missing or unreadable/.test(x)),'missing cuts flagged rather than invented');
}
{
 // An identical COMPLETED item repeated on the next page must not be counted
 // twice, but a different cut list for a separate same-code row must survive.
 const fullP1=[comment('MAIN FLOOR'),material('PSL3912','3-1/2" X 9-1/2" PARALLAM PSL',28,540),continuation('2.2E',552),continuation("4 - 7'",564),...footer()];
 const exactP2=[header(),material('PSL3912','3-1/2" X 9-1/2" PARALLAM PSL',28,315),continuation('2.2E',326),continuation("4 - 7'",337),...footer()];
 const a=parseSpruce([{page:1,lines:fullP1},{page:2,lines:exactP2}]);
 eq(a.records.length,1,'identical completed repeat removed');
 eq(a.records[0].ordered,28,'identical repeat does not double-count 28 LF');
 eq(a.records[0].pages,[1,2],'duplicate page retained for source trace');
 const differentP2=[header(),material('PSL3912','3-1/2" X 9-1/2" PARALLAM PSL',28,315),continuation('2.2E',326),continuation("2 - 14'",337),...footer()];
 const b=parseSpruce([{page:1,lines:fullP1},{page:2,lines:differentP2}]);
 eq(b.records.length,2,'different cut breakdown not mistaken for duplicate');
}
{
 // A page-two standalone grade must not be borrowed from a completed prior
 // order; no matching material to associate with it means it is discarded.
 const p1=[material('PSL3912',`3-1/2" X 9-1/2" PARALLAM PSL`,28,530),continuation('2.2E',541),continuation("4 - 7'",552),...footer()];
 const p2=[header(),continuation('1.55E',316),continuation("4 - 7'",327),material('LSL3912','3-1/2" X 9-1/2" TIMBERSTRAND LSL',8,341),continuation('1.55E',353),continuation("1 - 8'",365)];
 const s=parseSpruce([{page:1,lines:p1},{page:2,lines:p2}]);
 eq(s.records.length,2,'orphan text does not fabricate a new record');
 eq(s.records.find(x=>x.code==='PSL3912').cuts,[{qty:4,length:7}],'completed prior cuts unchanged');
}
console.log(`PASS V1.42 Spruce cross-page continuity: ${checks} assertions`);
