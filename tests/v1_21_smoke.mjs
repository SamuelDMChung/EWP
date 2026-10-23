import assert from 'node:assert/strict';
import {SNOW_LOCATIONS} from '../ewp-tools/snow-load/snow-data.mjs';
import {calculateSnow,nearestThree,localMatches,normalizeGeoResults} from '../ewp-tools/snow-load/calc.mjs';
import {filterSalesRows} from '../sales-tracking/filters.mjs';
import {consolidatePages,normalizeConnectorProduct,combinedEmailHtml,combinedTsv} from '../ewp-tools/consolidate-material-list/parser.mjs';
import {getPdfGroups,downloadMaterialPdf} from '../ewp-tools/consolidate-material-list/export-pdf.mjs';
let count=0;const checks=[];const check=(fn)=>{checks.push(Promise.resolve().then(fn));count++;};
check(()=>assert.equal(calculateSnow(2.6,.3,.8).kpa,2.38));
check(()=>assert.ok(Math.abs(calculateSnow(2.6,.3,.55,true).kpa-1.73)<1e-10));
check(()=>assert.equal(calculateSnow(0,0,.55,true).kpa,1));
check(()=>assert.equal(calculateSnow(0,0,.8,false).kpa,0));
check(()=>assert.throws(()=>calculateSnow(-1,0,.8)));
check(()=>assert.throws(()=>calculateSnow(2,0,0)));
check(()=>assert.ok(Math.abs(calculateSnow(2.6,.3,.8).psf-49.705)<.02));
check(()=>assert.equal(SNOW_LOCATIONS.length,113));
check(()=>assert.equal(SNOW_LOCATIONS.find(x=>x.name==='100 Mile House').ss,2.6));
check(()=>assert.deepEqual(localMatches(SNOW_LOCATIONS,'Port Al').map(x=>x.name),['Port Alice','Port Alberni']));
check(()=>assert.equal(nearestThree(SNOW_LOCATIONS,49.26,-122.78).length,3));
check(()=>assert.equal(normalizeGeoResults([{key:'geonames',name:'Port Coquitlam',province:'British Columbia',lat:49.26,lng:-122.78},{key:'geonames',name:'Ottawa',province:'Ontario',lat:45.3,lng:-75.6}]).length,1));
check(()=>assert.deepEqual(normalizeGeoResults([{key:'nominatim',name:'Victoria, BC',lat:48.4,lng:-123.3}]).map(x=>x.name),['Victoria, BC']));
const sales=[
 {projectNumber:'TC26268',address:'7645 Berkley St',task:'Layout',status:'queue',customer:'Alpha',phase:'Bidding',type:'SFD',sales:'JW',due:'2026-11-01'},
 {projectNumber:'TC26269',address:'105 Foo',task:'ATS',status:'delivering',customer:'Beta',phase:'Awarded',type:'Townhome',sales:'JW',due:'2026-11-02'},
 {projectNumber:'TC26270',address:'200 Other',task:'Quote',status:'completed',customer:'Gamma',phase:'Awarded',type:'Custom Project',sales:'JW',due:''}
];
check(()=>assert.equal(filterSalesRows(sales,{status:'delivering'}).length,1));
check(()=>assert.equal(filterSalesRows(sales,{query:'Berkley'}).length,1));
check(()=>assert.equal(filterSalesRows(sales,{query:'tc26269',type:'Townhome'}).length,1));
check(()=>assert.equal(filterSalesRows(sales,{phase:'Awarded'}).length,2));
check(()=>assert.equal(filterSalesRows(sales,{type:'Others'}).length,1));
check(()=>assert.equal(filterSalesRows(sales,{query:'xyz'}).length,0));
check(()=>assert.equal(normalizeConnectorProduct('HGUS410 INVERTED Not Required'),'HGUS410'));
check(()=>assert.equal(normalizeConnectorProduct('HUS1.81/10 (INVERTED) No Not Required'),'HUS1.81/10'));
check(()=>assert.notEqual(normalizeConnectorProduct('HGUS410'),normalizeConnectorProduct('HGUS412')));
const pages=[
 ['Level: L2 Framing','Framing Connector Summary','H123 40 Simpson HGUS410','H124 1 Simpson HUS1.81/10'],
 ['Page 2 of 3','H125 2 Simpson HGUS410 INVERTED Not Required','Total Lengths','100\'0"0 11 7/8" TJI 230'],
 ['200\'0"0 11 7/8" TJI 230','Level: L3 Framing','Framing Connector Summary','H126 29 Simpson HGUS410','Total Lengths','150\'0"0 11 7/8" TJI 230']
];
const merged=consolidatePages(pages);
check(()=>assert.equal(merged.connectors.find(x=>x.product==='HGUS410').quantity,71));
check(()=>assert.equal(merged.connectors.find(x=>x.product==='HGUS410').byLevel['L2 Framing'],42));
check(()=>assert.equal(merged.lengths[0].inches,450*12));
check(()=>assert.equal(merged.stats.pages,3));
check(()=>assert.ok(combinedEmailHtml(merged,true).includes('border:1px solid')));
check(()=>assert.ok(combinedTsv(merged,true).includes('HGUS410\t71\t42\t29')));
check(()=>assert.deepEqual(getPdfGroups(merged,false),[[]]));
check(()=>assert.equal(getPdfGroups({...merged,levels:['1','2','3','4','5','6']},true).length,2));
// Browser PDF export mocked at jsPDF boundary; verifies table pagination and file save without pretending to test native viewer.
const saved=[];
class DummyDoc {
 constructor(){this.pages=1;this.internal={getNumberOfPages:()=>this.pages};}
 addPage(){this.pages++;} setPage(){} setFont(){} setFontSize(){} setTextColor(){} text(){} setFillColor(){} setDrawColor(){} rect(){} setLineWidth(){} line(){}
 splitTextToSize(text){return [text];} save(name){saved.push(name);}
}
globalThis.jspdf={jsPDF:DummyDoc};
check(async()=>{const result=await downloadMaterialPdf(merged,false,'TC26268 - Quote.pdf');assert.equal(result.levelGroups,1);assert.ok(saved[0].includes('Consolidated Material List.pdf'));});
await Promise.all(checks);
console.log(`V1.21 smoke checks: ${count} assertions executed`);
