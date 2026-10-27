import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {buildBeamIndex,lookupBeam,optionsFor,splitBeamDesignation,isValidBeamInput} from '../ewp-tools/steel-beam-width/lookup.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const data=JSON.parse(readFileSync(join(root,'ewp-tools/steel-beam-width/w-sections.json'),'utf8'));
let assertions=0;
function check(name,func){func();assertions++;console.log('PASS',name);}
const index=buildBeamIndex(data);
check('196 W sections extracted',()=>assert.equal(index.size,196));
check('all five scanned W-table pages represented',()=>assert.deepEqual([...new Set(data.map(x=>x.sourcePage))],[10,11,12,13,14]));
check('W families from W4 through W36',()=>assert.deepEqual([...index.imperialDepths].sort((a,b)=>a-b),[4,5,6,8,10,12,14,16,18,21,24,27,30,33,36]));
check('every imperial designation unique',()=>assert.equal(index.imperial.size,196));
check('every metric designation unique',()=>assert.equal(index.metric.size,196));
check('all 196 rows reverse lookup exactly',()=>{
  for(const row of data){
    const imp=splitBeamDesignation(row.imperial);const met=splitBeamDesignation(row.metric);
    assert.equal(lookupBeam(index,'imperial',imp.depth,imp.weight),row);
    assert.equal(lookupBeam(index,'metric',met.depth,met.weight),row);
  }
});
const cases=[
  ['W4x13','W100x19',4.06,4.16],
  ['W6x9','W150x14',3.94,5.90],
  ['W8x10','W200x15',3.94,7.89],
  ['W10x12','W250x18',3.96,9.87],
  ['W12x14','W310x21',3.97,11.91],
  ['W12x21','W310x31',6.45,12.04],
  ['W14x22','W360x33',5.00,13.74],
  ['W16x26','W410x39',5.50,15.69],
  ['W18x35','W460x52',6.00,17.70],
  ['W24x55','W610x82',7.00,23.57],
  ['W27x84','W690x125',9.96,26.71],
  ['W36x302','W920x449',16.66,37.33],
];
for (const [imp,met,w,d] of cases){
  check(`crosscheck ${imp} / ${met}`,()=>{const parts=splitBeamDesignation(imp);const row=lookupBeam(index,'imperial',parts.depth,parts.weight);assert.equal(row.metric,met);assert.equal(row.flangeWidthIn,w);assert.equal(row.depthIn,d);});
}
check('imperial W12 weights suggestions include 14',()=>assert.ok(optionsFor(index,'imperial','12').weights.includes(14)));
check('metric W310 mass suggestions include 21',()=>assert.ok(optionsFor(index,'metric','310').weights.includes(21)));
check('unlisted designation rejected',()=>assert.equal(lookupBeam(index,'imperial','12','999'),null));
check('noninteger weights rejected',()=>assert.equal(lookupBeam(index,'metric','310','21.3'),null));
check('empty values rejected',()=>assert.equal(lookupBeam(index,'metric','','21'),null));
check('numeric leading zero allowed',()=>assert.equal(lookupBeam(index,'imperial','012','014').imperial,'W12x14'));
check('nonzero digits only',()=>assert.equal(isValidBeamInput('0'),false));
check('no imperial/metric numeric approximation used',()=>assert.ok(!readFileSync(join(root,'ewp-tools/steel-beam-width/lookup.mjs'),'utf8').includes('1.48816')));
const hub=readFileSync(join(root,'ewp-tools/index.html'),'utf8');
check('hub third button is installed',()=>assert.match(hub,/href="steel-beam-width\/"/));
check('hub keeps both older utilities',()=>{assert.match(hub,/href="snow-load\/"/);assert.match(hub,/href="consolidate-material-list\/"/);});
const html=readFileSync(join(root,'ewp-tools/steel-beam-width/index.html'),'utf8');
check('four designation inputs installed',()=>{for(const id of ['beamImperialDepth','beamImperialWeight','beamMetricDepth','beamMetricMass'])assert.match(html,new RegExp(`id="${id}"`));});
check('only flange-width and actual-depth numeric outputs',()=>{assert.match(html,/id="beamFlangeWidth"/);assert.match(html,/id="beamActualDepth"/);});
check('tool maintains Portal EWP return and hub breadcrumb',()=>{assert.match(html,/href="\.\.\/\.\.\/\?view=ewp"/);assert.match(html,/href="\.\.\/"/);});
check('source data file accessible',()=>assert.ok(existsSync(join(root,'ewp-tools/steel-beam-width/w-sections.json'))));
const pages=[...['index.html','tracker/index.html','forecast/index.html','ewp-tools/index.html','ewp-tools/consolidate-material-list/index.html','ewp-tools/snow-load/index.html','ewp-tools/steel-beam-width/index.html','sales/index.html','orders/index.html','sales-tracking/index.html']];
check('all ten HTML pages show V1.25 WEB credits',()=>{for(const page of pages)assert.match(readFileSync(join(root,page),'utf8'),/V1\.25 WEB · Developed by Samuel Chung/,page);});
console.log(`V1.25 smoke: ${assertions} assertions passed`);
