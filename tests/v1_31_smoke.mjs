import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dimension,productSpec,pdfLinesFromItems,parseJavelin,parseSpruce,compareMaterials,classifyPdfPages} from '../ewp-tools/javelin-spruce-checker/logic.mjs';
let n=0;const t=(cond,message)=>{assert.ok(cond,message);n++};
const key=(text)=>productSpec(text)?.key;
const cases=[
 ['1 3/4" x 9 1/2" 1.55E TimberStrand LSL','LSL|1.55|1.75|9.5'],
 ['1-3/4" X 9-1/2" TIMBERSTRAND LSL 1.55E','LSL|1.55|1.75|9.5'],
 ['1.75 x 9.5 TimberStrand LSL 1.55E','LSL|1.55|1.75|9.5'],
 ['1¾ × 9½ LSL 1.55E','LSL|1.55|1.75|9.5'],
 ['1 1/4" x 9 1/2" 1.3E TimberStrand LSL','LSL|1.3|1.25|9.5'],
 ['1.25 × 9.5 1.3E LSL','LSL|1.3|1.25|9.5'],
 ['3 1/2" x 9 1/2" 1.55E TimberStrand LSL','LSL|1.55|3.5|9.5'],
 ['3.5 x 9.5 LSL 1.55E','LSL|1.55|3.5|9.5'],
 ['3.5 x 9.5 2.2E Parallam PSL','PSL|2.2|3.5|9.5'],
 ['5 1/4" x 11 7/8" Parallam PSL 2.2E','PSL|2.2|5.25|11.875'],
 ['5.25 x 11.875 2.2E PSL','PSL|2.2|5.25|11.875'],
 ['TJI 230 2-5/16" X 9-1/2"','TJI|230|2.3125|9.5'],
 ['9 1/2" TJI 230 joist','TJI|230|2.3125|9.5'],
 ['TJI 560 3-1/2" X 11-7/8"','TJI|560|3.5|11.875'],
];
for(const [input,expected] of cases)t(key(input)===expected,`product dimensions: ${input} => ${key(input)}`);
t(key('7/8" x 2 5/16" Web Stiffeners')===undefined,'always skip stiffeners');
t(key('1" x 2" Backer Blocks')===undefined,'always skip backer blocks');
for(const [input,expected] of [['1-3/4',1.75],['1 3/4',1.75],['1.75',1.75],['9.5',9.5],['11.875',11.875],['5/8',0.625],['9½',9.5]])t(dimension(input.replace('½',' 1/2'))===expected,'dimension '+input);
const old=JSON.parse(fs.readFileSync(new URL('./v1_30_pdf_fixtures.json',import.meta.url)));
const newer=JSON.parse(fs.readFileSync(new URL('./v1_31_new_pdf_fixtures.json',import.meta.url)));
const cv=ps=>ps.map(p=>({page:p.page,lines:pdfLinesFromItems(p.items,p.height),annotations:p.annotations}));
function check(pJ,pS){
 const pj=cv(pJ),ps=cv(pS);const j=parseJavelin(pj),s=parseSpruce(ps),r=compareMaterials(j,s);
 t(classifyPdfPages(pj).kind==='j','recognize Javelin content');t(classifyPdfPages(ps).kind==='s','recognize Spruce content');
 t(!j.records.some(x=>/web stiffeners|backer blocks/i.test(x.description)),'Javelin exclusions');
 t(!s.records.some(x=>/web stiffeners|backer blocks/i.test(x.description)),'Spruce exclusions');
 return {j,s,r};
}
const standard=check(old.j_standard,old.s_standard);
t(standard.r.stats.match===16&&standard.r.stats.mismatch===1&&standard.r.stats.review===0,'old standard summary');
t(standard.r.details.find(d=>d.status==='MISMATCH')?.reason.includes('353 LF'),'standard 353 LF required');
t(standard.r.details.find(d=>d.status==='MISMATCH')?.reason.includes('352 LF'),'standard 352 LF ordered');
const aria4=check(old.j_annotated,old.s_annotated);
t(aria4.j.stats.excluded===6,'L4 P6 strikeouts');t(aria4.j.excluded.reduce((sum,r)=>sum+r.qty,0)===10,'L4 10 P6 pieces excluded');
t(aria4.j.gradeOverride==='230','L4 level-wide joist grade override');t(aria4.r.stats.mismatch===0&&aria4.r.stats.review===1,'L4 1 unresolved rim-stock review');
const aria3=check(newer.j_new,newer.s_new);
t(aria3.r.stats.mismatch===1&&aria3.r.stats.review===1,'L3 shortage distinct from surplus stock');
const lsl125=aria3.r.details.find(d=>d.section==='Rim and blockings'&&d.product.includes('LSL 1.3'));
t(lsl125?.status==='MISMATCH'&&lsl125.expectedLF===809&&lsl125.actualLF===576,'L3 definite minimum 233 LF shortage with multi-ply');
const lsl175=aria3.r.details.find(d=>d.section==='Rim and blockings'&&d.product.startsWith('LSL 1.55 · 1.75'));
t(lsl175?.status==='REVIEW'&&lsl175.expectedLF===66&&lsl175.actualLF===306,'L3 excess 240 LF requires stock review');
for(const unit of ['211','212','213','202','201']){
 const row=aria3.r.details.find(d=>d.section===unit&&d.product.startsWith('LSL 1.55 · 1.75'));
 t(row?.status==='MATCH',`L3 ${unit} 1.75-inch LSL exact match`);
}
t(aria3.r.details.some(d=>d.product.startsWith('LSL 1.55 · 3.5')&&d.status==='MATCH'),'3.5-inch LSL still matches');
const blank=[{page:1,lines:pdfLinesFromItems([{str:'random document',transform:[1,0,0,1,20,300]}],800)}];
t(classifyPdfPages(blank).kind===null,'ambiguous PDF must not be assigned automatically');
const html=fs.readFileSync(new URL('../ewp-tools/javelin-spruce-checker/index.html',import.meta.url),'utf8');
for(const term of ['checkerDrop','checkerFiles','multiple','jSlot','sSlot','V1.31 WEB · Developed by Samuel Chung'])t(html.includes(term),'unified input contains '+term);
t(!html.includes('id="jDrop"')&&!html.includes('id="sDrop"'),'old upload pair removed');
const app=fs.readFileSync(new URL('../ewp-tools/javelin-spruce-checker/app.mjs',import.meta.url),'utf8');
t(app.includes('classifyPdfPages(pages)'),'content-based detection used');
t(app.includes('adoptEntry(entry')&&app.includes('removeEntry(entry)'),'replace/remove functions present');
console.log(`V1.31 smoke passed ${n} assertions`,{standard:standard.r.stats,L4:aria4.r.stats,L3:aria3.r.stats});
