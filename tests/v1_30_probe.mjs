import fs from 'node:fs';
import {pdfLinesFromItems,parseJavelin,parseSpruce,compareMaterials} from '../ewp-tools/javelin-spruce-checker/logic.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./v1_30_pdf_fixtures.json',import.meta.url)));
const conv=(input)=>input.map(p=>({page:p.page,lines:pdfLinesFromItems(p.items,p.height),annotations:p.annotations}));
for(const suffix of ['standard','annotated']){
 const j=parseJavelin(conv(fixtures['j_'+suffix])),s=parseSpruce(conv(fixtures['s_'+suffix])),out=compareMaterials(j,s);
 console.log('\n',suffix,'j rows=',j.stats,'spruce rows=',s.stats,'totals=',out.stats,'overall',out.overall,'warnings',out.warnings.slice(0,8));
 console.log('J first',j.records.slice(0,5).map(x=>({unit:x.unit,desc:x.description,spec:x.spec?.key,qty:x.qty,len:x.length})));
 console.log('S first',s.records.slice(0,5).map(x=>({section:x.section,desc:x.description,spec:x.spec?.key,qty:x.ordered,cuts:x.cuts,um:x.um})));
 for(const d of out.details)if(d.status!=='MATCH')console.log(d.section,d.product,d.status,d.reason,d.expectedLF,d.actualLF,d.expected.slice(0,90),d.actual.slice(0,90));
}
