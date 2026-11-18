/** V1.43 — LVL/Microllam grade representation regression.
 * Synthetic material rows; NO customer PDFs or fixture text are shipped.
 */
import assert from 'node:assert/strict';
import {dimension,productSpec,parseJavelin,parseSpruce,compareMaterials} from '../ewp-tools/javelin-spruce-checker/logic.mjs';
let checks=0;const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++};
const yes=(a,message)=>{assert.ok(a,message);checks++};
const specs=[
 '1 3/4" x 7 1/4" 2.0E Microllam LVL',
 '1-3/4" X 7-1/4" MICROLLAM LVL 2',
 '1.75" X 7.25" MICROLLAM LVL 2.0',
 '1¾" × 7¼" MICROLLAM LVL 2.0E'
].map(productSpec);
for(const spec of specs){eq(spec.key,'LVL|2.0|1.75|7.25','LVL 2, 2.0 and 2.0E share the same full-dimensional key');yes(!spec.ambiguous,'known grade not ambiguous');}
eq(specs[0].label,'LVL 2.0E · 1.75" × 7.25"','display canonical grade and decimal dimensions');
eq(dimension('7 1/4'),7.25,'seven-and-one-quarter inch recognized');
eq(dimension('7.25'),7.25,'decimal size recognized');
eq(productSpec('1-3/4" x 7-1/4" Microllam LVL 1.9E').key,'LVL|1.9|1.75|7.25','explicit different LVL grade stays separate');
const missing=productSpec('1-3/4" x 7-1/4" Microllam LVL');
eq(missing.key,null,'truly unknown grade remains unverified, not silently accepted as 2.0E');
eq(productSpec('1-3/4" x 7-1/4" Microllam LVL 2.0E LVL 1.9').key,null,'contradictory LVL grades remain uncertain');
eq(productSpec('1-3/4" x 7-1/4" Parallam PSL 1.9E').key,'PSL|1.9|1.75|7.25','PSL grades still enforced');
eq(productSpec('1-3/4" x 7-1/4" TimberStrand LSL 1.55E').key,'LSL|1.55|1.75|7.25','LSL grades still enforced');
const line=(y,values)=>({y,tokens:values.map(([x,text])=>({x,text,y,width:Math.max(8,String(text).length*3)})),text:values.map(x=>x[1]).join(' ')});
const javelin=parseJavelin([{page:1,lines:[
 line(100,[[37,'Level: Main Floor']]),
 line(130,[[275,'Products']]),
 line(380,[[37,'M2'],[98,`9'0"0`],[156,'1 3/4" x 7 1/4" 2.0E Microllam LVL'],[509,'1'],[538,'11']])
 ]}]);
const spruce=parseSpruce([{page:3,lines:[
 line(312,[[24,'COMMENT'],[128,'MAIN FLOOR'],[410,'1']]),
 line(388,[[24,'LVL714'],[128,'1-3/4" X 7-1/4" MICROLLAM LVL 2'],[325,'99'],[419,'LF']]),
 line(403,[[128,"11 - 9'"]])
 ]}]);
eq(javelin.records.length,1,'Javelin row recognized');
eq(spruce.records.length,1,'Spruce LVL714 row recognized');
eq(spruce.records[0].spec.key,javelin.records[0].spec.key,'actual parsed records agree');
eq(spruce.records[0].ordered,99,'Spruce amount is 99 LF');
eq(spruce.records[0].cuts,[{length:9,qty:11}],'Spruce 11 x 9ft cuts decoded');
const result=compareMaterials(javelin,spruce);
eq(result.stats,{match:1,mismatch:0,review:0},'LVL 99 LF same cuts is MATCH, not false discrepancy');
eq(result.details[0].expected,"11 × 9'",'expected length list');
eq(result.details[0].actual,"11 × 9'",'actual length list');
eq(result.details[0].expectedLF,99,'Javelin LF 99');
eq(result.details[0].actualLF,99,'Spruce LF 99');
console.log(`PASS V1.43 LVL grade normalization: ${checks} assertions`);
