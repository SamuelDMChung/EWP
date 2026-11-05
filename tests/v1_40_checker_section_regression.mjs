/** V1.39 grouping regression, synthetic tokens; no customer files or live PDF.js. */
import assert from 'node:assert/strict';
import {parseJavelin, parseSpruce, compareMaterials, productSpec} from '../ewp-tools/javelin-spruce-checker/logic.mjs';
let checks=0;
function check(value,msg){assert.ok(value,msg);checks++;}
function line(y,entries){const tokens=entries.map(([x,text])=>({x,text,y}));return {y,tokens,text:tokens.map(t=>t.text).join(' ')};}
function heading(text,y=250){return line(y,[[270,text]]);}
function jrow(plot,length,desc,plies,qty,y){return line(y,[[37,plot],[98,length+`'0"0`],[156,desc],[509,String(plies)],[537,String(qty)]]);}
function comment(text,y){return line(y,[[24,'COMMENT'],[129,text],[411,'1']]);}
function stock(code,desc,ordered,um,y){return line(y,[[24,code],[129,desc],[321,String(ordered)],[420,um]]);}
function descLine(text,y){return line(y,[[129,text]]);}
const lvl='1 3/4" x 5 1/2" 2.0E Microllam LVL';
const jp=[{page:1,lines:[line(90,[[150,'Level: Level 2']]),heading('109',200),jrow("J11'",11,'9 1/2" TJI 230 joist',1,1,240),heading('framing 209 (110-114)',300),
 jrow('M1',12,lvl,1,1,360),jrow('M2',7,lvl,1,11,374),jrow('M3-2',6,lvl,2,2,388),jrow('M4',5,lvl,1,11,402),jrow('M6-2',4,lvl,2,2,416),jrow('M5',4,lvl,1,12,430),heading('framing 210 (115)',480),jrow("O18'",18,'9 1/2" TJI 360 joist',1,1,510),heading('framing 211 (116)',550),jrow("O17'",17,'9 1/2" TJI 360 joist',1,1,580)],annotations:[]}];
const sp=[{page:1,lines:[comment('L2 EAST - UNIT 109',310),stock('TJI230912','TJI 230 2-5/16" X 9-1/2"',11,'LF',328),descLine("1 - 11'",339),comment('FRAMING 209 (UNIT 110-114)',366),stock('LVL512','1-3/4" X 5-1/2" MICROLLAM LVL',212,'LF',387),descLine('2.0E',398),descLine("1 - 12', 11 - 7', 2 - 6', 11 - 5', 2 - 4', 12 - 4'",409),comment('FRAMING 210 (UNIT 115)',445),stock('TJI360912','TJI 360 2-5/16" X 9-1/2"',18,'LF',464),descLine("1 - 18'",476),comment('FRAMING 211 (UNIT 116)',509),stock('TJI360912','TJI 360 2-5/16" X 9-1/2"',17,'LF',526),descLine("1 - 17'",538)]}];
const j=parseJavelin(jp),s=parseSpruce(sp),r=compareMaterials(j,s);
check(j.records.some(x=>x.unit==='109'&&x.plot==="J11'"),'preceding Unit 109 retained');
check(j.records.filter(x=>x.unit==='209').length===6,'all six LVL rows placed in framing 209');
check(j.records.every(x=>x.plot!=='M1'||x.unit==='209'),'framing 209 no longer inherited as 109');
check(j.records.some(x=>x.unit==='210'&&x.plot==="O18'"),'framing 210 maps to 210 not 209');
check(j.records.some(x=>x.unit==='211'&&x.plot==="O17'"),'framing 211 maps to 211');
check(s.records.some(x=>x.section==='109'&&x.code==='TJI230912'),'Spruce 109 stays independent');
check(s.records.some(x=>x.section==='209'&&x.code==='LVL512'),'Spruce FRAMING 209 precedes parenthetical UNIT 110');
check(s.records.some(x=>x.section==='210'&&x.code==='TJI360912'),'Spruce FRAMING 210 not mistaken for UNIT 115');
check(s.records.some(x=>x.section==='211'&&x.code==='TJI360912'),'Spruce FRAMING 211 not mistaken for UNIT 116');
check(s.records.filter(x=>x.code==='LVL512').every(x=>x.spec.type==='LVL'),'LVL512 recognized as saleable material');
check(productSpec('1 3/4" x 5 1/2" 2.0E Microllam LVL').key==='LVL|2.0|1.75|5.5','Javelin LVL specs normalize');
check(productSpec('1-3/4" X 5-1/2" MICROLLAM LVL 2.0E').key==='LVL|2.0|1.75|5.5','Spruce LVL specs normalize identically');
const lvl209=r.details.find(x=>x.section==='209'&&x.product.startsWith('LVL 2.0'));
check(Boolean(lvl209),'framing 209 LVL exists');
check(lvl209.status==='MATCH','exact 209 LVL cuts matched despite 2-ply description');
check(lvl209.expectedLF===212&&lvl209.actualLF===212,'209 LVL exactly 212 LF on both sides');
check(lvl209.expected===lvl209.actual,'framing 209 piece breakdowns identical');
check(!r.details.some(x=>x.section==='109'&&x.product.startsWith('LVL')),'no false LVL discrepancy under 109');
check(r.details.find(x=>x.section==='109').status==='MATCH','actual 109 remains match');
check(r.details.find(x=>x.section==='210').status==='MATCH'&&r.details.find(x=>x.section==='211').status==='MATCH','subsequent framing sections remain matched');
check(r.stats.mismatch===0&&r.stats.review===0,'no invented material mismatches or reviews');
// Repeat the actual type in both named heading variations, with and without UNIT text.
const variants=['framing 209 (110-114)','FRAMING 209 (UNIT 110-114)','framing 209','FRAMING 209 (110–114)'];
for(const variant of variants){const v=parseJavelin([{page:1,lines:[heading('109',200),heading(variant,300),jrow('M1',12,lvl,1,1,360)],annotations:[]}]);check(v.records[0]?.unit==='209',`Javelin heading variation ${variant}`);}
console.log(`V1.40 retained section/LVL regression PASSED: ${checks} assertions; 109 and 209 are distinct, 209 LVL 212 LF matched.`);
