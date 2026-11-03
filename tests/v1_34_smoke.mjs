/** V1.34 annotation-specific geometry regression; positioned-text fixtures, NOT live PDF.js. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pdfLinesFromItems,pdfAnnotations,parseJavelin,parseSpruce,compareMaterials,compareCutLengths,associateStrikeouts,attachRowGeometry,classifyPdfPages,orientStrikeouts} from '../ewp-tools/javelin-spruce-checker/logic.mjs';
let n=0;const t=(value,msg)=>{assert.ok(value,msg);++n;};
const f=JSON.parse(fs.readFileSync(new URL('./v1_31_new_pdf_fixtures.json',import.meta.url)));
const old=JSON.parse(fs.readFileSync(new URL('./v1_30_pdf_fixtures.json',import.meta.url)));
const cv=pages=>pages.map(p=>({page:p.page,lines:pdfLinesFromItems(p.items,p.height),annotations:pdfAnnotations(p.annotations,p.page)}));
const j=parseJavelin(cv(f.j_new)),s=parseSpruce(cv(f.s_new)),r=compareMaterials(j,s);
t(classifyPdfPages(cv(f.j_new)).kind==='j','Javelin classified from content');
t(classifyPdfPages(cv(f.s_new)).kind==='s','Spruce classified from content');
t(j.excluded.length===6&&j.stats.excluded===6,'six unambiguous whole-row PSL strikeouts excluded');
t(j.excluded.every(x=>x.plot==='P5'&&x.spec.type==='PSL'),'all exclusions are P5 PSL');
t(j.warnings.length===0,'actual L3 aligned strikeouts do not generate speculative warnings');
t(s.warnings.length===0,'Spruce text clean');
t(r.stats.match===30&&r.stats.mismatch===1&&r.stats.review===1,'L3 total 30 match / 1 mismatch / 1 stock review');
const get=(unit,part)=>r.details.find(x=>x.section===unit&&x.product.startsWith(part));
const p200=get('200','PSL 2.2 · 3.5');
t(p200.status==='MATCH','unit 200 PSL order matches after intentional crossed-out 2 x 7ft P5');
t(p200.expectedLF===21&&p200.actualLF===21,'Unit 200 PSL 21 LF on each side after strikeout');
t(p200.cutDeltas.every(x=>x.difference===0),'unit 200 no cut-level discrepancy');
t(j.excluded.some(x=>x.unit==='200'&&x.plot==='P5'&&x.qty===2&&x.length===7),'Unit 200 P5 strikeout specifically excluded');
const l201=get('201','LSL 1.55 · 1.75');
t(l201.status==='MATCH','Unit 201 LSL 1.75x9.5 MATCH, no highlight warning');
t(l201.expectedLF===11&&l201.actualLF===11,'Unit 201 11 LF in both PDFs');
t(l201.diffSummary===''&&l201.cutDeltas.length===1&&l201.cutDeltas[0].difference===0,'Unit 201 cut-list equality');
t(j.records.some(x=>x.unit==='201'&&x.plot==='TS3'&&x.length===11),'TS3 present after PSL P5 strikeout');
t(r.details.every(x=>!('marked' in x)&&!('markups' in x)),'no markup-only flags or fields');
t(r.details.every(x=>!x.reason.includes('marked material')),'no markup-only status reasons');
const rim=get('Rim and blockings','LSL 1.3 · 1.25');
t(rim.status==='MISMATCH','real rim shortage still flagged');
t(rim.expectedLF===809&&rim.actualLF===576,'real 233 LF shortage preserved');
const row={page:2,unit:'201',plot:'P5',spec:{type:'PSL'},rowRect:[32,622.7,558,634.8],notes:[],excluded:false};
const neighbor={page:2,unit:'201',plot:'TS3',spec:{type:'LSL'},rowRect:[32,636.1,558,648.2],notes:[],excluded:false};
const strike={page:2,type:'StrikeOut',rect:[33,621.5,546,635.3]};
t(associateStrikeouts([row,neighbor],[strike]).length===0,'correct geometry has no warning');
t(row.excluded&&!neighbor.excluded,'exact P5 excluded but neighboring TS3 retained');
const missingTarget={...neighbor,excluded:false,notes:[]};
t(associateStrikeouts([missingTarget],[strike]).length===1&&!missingTarget.excluded,'missing P5 cannot transfer strikeout onto TS3');
const overlapping={page:2,unit:'201',plot:'P7',spec:{type:'PSL'},rowRect:[32,626,556,638],notes:[],excluded:false};
const wide={page:2,type:'StrikeOut',rect:[33,625,546,640]};
t(associateStrikeouts([{...row,excluded:false,notes:[]},overlapping],[wide]).length===1&&!overlapping.excluded,'ambiguous overlap never auto-excludes either row');
const narrow={page:2,type:'StrikeOut',rect:[160,622,220,635]};
const original={...row,excluded:false,notes:[]};
t(associateStrikeouts([original],[narrow]).length===1&&!original.excluded,'ambiguous partial strikeout must not delete a PSL');
const textRows=cv(f.j_new);const highlights=textRows.flatMap(p=>p.annotations).filter(x=>x.type==='Highlight');
t(highlights.length===0,'highlights entirely filtered out of parsed annotation metadata');
const pNative=pdfAnnotations([{annotationType:12,rect:[33,621,546,635]},{annotationType:9,rect:[30,620,544,633]},{annotationType:3,contentsObj:{str:'All joists 230, TYP. this level'},rect:[20,20,100,40]},{annotationType:2,rect:[1,1,2,2]}],2);
t(pNative.length===2&&pNative[0].type==='StrikeOut'&&pNative[1].type==='FreeText','PDF.js numeric types map and ignore highlights/links');
t(pNative[1].contents==='All joists 230, TYP. this level','recognize meaningful FreeText contents');
t(pNative[0].contents==='','non-FreeText content ignored');
const annOld=cv(old.j_annotated),oldJ=parseJavelin(annOld),oldS=parseSpruce(cv(old.s_annotated)),oldR=compareMaterials(oldJ,oldS);
t(oldJ.gradeOverride==='230','L4 explicit level-wide TJI 230 FreeText override restored');
t(oldJ.excluded.length===6&&oldJ.excluded.every(x=>x.plot==='P6'),'L4 6 P6 strikeouts excluded');
t(oldJ.records.filter(x=>x.spec.type==='TJI').every(x=>x.spec.grade==='230'),'TJI grade note applied to entire level');
t(oldR.stats.match===24&&oldR.stats.mismatch===0&&oldR.stats.review===1,'L4 historical expected result restored');
const oldNoHighlights=JSON.parse(JSON.stringify(old.j_annotated));oldNoHighlights.forEach(x=>x.annotations=x.annotations.filter(a=>!/(highlight)/i.test(a.type||a.subtype||'')));
const withoutHighlights=parseJavelin(cv(oldNoHighlights));
t(withoutHighlights.records.length===oldJ.records.length&&withoutHighlights.excluded.length===oldJ.excluded.length,'removing highlights does not change row inclusion');
t(compareMaterials(withoutHighlights,oldS).stats.match===oldR.stats.match,'removing highlights does not affect matches');
const forceShort=JSON.parse(JSON.stringify(f.j_new));
forceShort.forEach(pg=>pg.annotations=pg.annotations.filter(a=>!/(strikeout)/i.test(a.subtype||a.type||'')));
const rawJ=parseJavelin(cv(forceShort)),rawR=compareMaterials(rawJ,s);
const rawP200=rawR.details.find(x=>x.section==='200'&&x.product.startsWith('PSL 2.2 · 3.5'));
t(rawP200.status==='MISMATCH'&&rawP200.expectedLF===35&&rawP200.actualLF===21,'without strikeout unit 200 still catches 14 LF shortage');
t(rawP200.diffSummary==='Missing 2 × 7′ (14 LF)','exact 2×7 mismatch retained when not crossed out');
const corrected=compareMaterials(j,s,[{recordId:`${j.excluded.find(x=>x.unit==='200').page}|${j.excluded.find(x=>x.unit==='200').y}|P5`,action:'include',reason:'verified restoration'}]);
t(corrected.details.find(x=>x.section==='200'&&x.product.startsWith('PSL 2.2 · 3.5')).status==='MISMATCH','session-only Restore/include correctly reintroduces struck material');
const cuts=compareCutLengths({cut:new Map([[7,2],[10,1]])},{cut:new Map([[6,1],[10,1]])});
t(cuts.find(x=>x.length===7).state==='short'&&cuts.find(x=>x.length===6).state==='extra','red missing and amber extra both computed');
const html=fs.readFileSync(new URL('../ewp-tools/javelin-spruce-checker/index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../ewp-tools/javelin-spruce-checker/app.mjs',import.meta.url),'utf8');
for(const word of ['checkerDrop','checkerFiles','jSlot','sSlot','V1.34 WEB · Developed by Samuel Chung'])t(html.includes(word),'existing upload UI/version '+word);
t(app.includes('cutEvidence(d')&&app.includes('compareMaterials'),'cut discrepancy UI retained');
t(!app.includes('MARKED PDF AREA')&&!app.includes('markupEvidence')&&!html.includes('marked areas are flagged'),'no marked-area UI warnings');
t(app.includes('annotationReadError')&&app.includes('pdfAnnotations(anns,n,viewport)'),'actual PDF.js adapter retained');
// V1.34 regression: reproduce the genuine swapped-coordinate failure that
// V1.33's fake-PDF.js fixture could not catch. Do not embed customer PDFs.
const mirrored=(box,height)=>[box[0],height-box[3],box[2],height-box[1]];
function dualCoords(invert){
 return cv(f.j_new).map(p=>{
  const h=f.j_new.find(x=>x.page===p.page).height;
  return {...p,annotations:p.annotations.map(a=>a.type==='StrikeOut'?{
   ...a,rect:invert?mirrored(a.rect,h):a.rect,
   alternateRect:invert?a.rect:mirrored(a.rect,h)
  }:a)};
 });
}
for(const invert of [false,true]){
 const jDual=parseJavelin(dualCoords(invert)),rDual=compareMaterials(jDual,s);
 t(jDual.excluded.length===6,`all 6 correct PSL rows excluded despite ${invert?'swapped':'normal'} annotation coordinates`);
 t(jDual.excluded.every(x=>x.plot==='P5'&&x.spec.type==='PSL'),`only P5 PSL excluded, not neighboring LSL (${invert})`);
 t(jDual.records.some(x=>x.unit==='201'&&x.plot==='TS3'&&x.length===11),`201 TS3 11 ft still present (${invert})`);
 t(!jDual.excluded.some(x=>x.unit==='201'&&x.spec.type==='LSL'),`never remove Unit 201 LSL (${invert})`);
 t(jDual.excluded.some(x=>x.unit==='201'&&x.plot==='P5'),`201 2x7 PSL correctly excluded (${invert})`);
 const l=rDual.details.find(x=>x.section==='201'&&x.product.startsWith('LSL 1.55 · 1.75'));
 const p=rDual.details.find(x=>x.section==='201'&&x.product.startsWith('PSL 2.2 · 3.5'));
 t(l?.status==='MATCH'&&l.expectedLF===11,`201 LSL exact match (${invert})`);
 t(!p||p.status==='MATCH',`201 PSL deleted on both sides after strikeout (${invert})`);
 t(jDual.annotationOrientation===(invert?'alternate':'primary'),`document-wide coordinate calibration selected correct transform (${invert})`);
 t(jDual.warnings.length===0,`correct marks have no misleading diagnostics (${invert})`);
}
// If a document has only one annotation which points to different materials
// under two plausible frames, do NOT silently exclude either material.
const r1={page:1,plot:'P5',spec:{type:'PSL'},rowRect:[35,110,545,120],notes:[],excluded:false};
const r2={page:1,plot:'TS3',spec:{type:'LSL'},rowRect:[35,170,545,180],notes:[],excluded:false};
const risky={page:1,type:'StrikeOut',rect:[33,110,546,120],alternateRect:[33,170,546,180]};
const decision=orientStrikeouts([r1,r2],[risky]);
t(decision.orientation==='ambiguous'&&decision.annotations[0].skippedAmbiguousOrientation,'isolated ambiguous strikeout cannot delete an unrelated LSL');
associateStrikeouts([r1,r2],decision.annotations);
t(!r1.excluded&&!r2.excluded,'ambiguous flipped strikeout deletes neither row');
const cHtml=fs.readFileSync(new URL('../ewp-tools/javelin-spruce-checker/index.html',import.meta.url),'utf8');
const cApp=fs.readFileSync(new URL('../ewp-tools/javelin-spruce-checker/app.mjs',import.meta.url),'utf8');
t(!cHtml.includes('id="checkerStats"')&&!cHtml.includes('id="checkerWarnings"'),'remove user-requested stats and yellow diagnostics panels');
t(!cApp.includes("$('checkerWarnings')")&&!cApp.includes("$('checkerStats')"),'no references to deleted diagnostics elements');
t(!cApp.includes('r.warnings.map('),'exported reports also omit diagnostic notices');
// Diagnostic warnings are not material discrepancies or user-facing reviews.
const warnJ={...j,warnings:['ambiguous strikeout']};
const warnR=compareMaterials(warnJ,s);
t(warnR.stats.review===r.stats.review&&warnR.overall===r.overall,'parser diagnostics cannot change report statuses');
console.log(`V1.34 regression passed: ${n} assertions. L3:`,r.stats,'L4:',oldR.stats);
