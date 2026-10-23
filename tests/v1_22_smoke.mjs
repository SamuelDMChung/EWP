import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {consolidatePages,extractPdfPages,combinedEmailHtml,combinedTsv} from '../ewp-tools/consolidate-material-list/parser.mjs';
import {portalViewFromUrl} from '../portal-views.mjs';
import {filterSalesRows} from '../sales-tracking/filters.mjs';
const fixture=JSON.parse(await readFile(new URL('sherman_12pages_fixture.json',import.meta.url)));
const stubFile={arrayBuffer:async()=>new Uint8Array([37,80,68,70]).buffer};
let cleanup=0,destroyed=0;
const stubPdf = {getDocument: () => ({
  promise: Promise.resolve({
    numPages: fixture.length,
    getPage: async page => ({
      getTextContent: async () => ({items: fixture[page-1]}),
      cleanup: () => {cleanup++;}
    })
  }),
  destroy: async () => {destroyed++;}
})};
const pages=await extractPdfPages(stubFile,stubPdf);
const result=consolidatePages(pages);
const get=name=>result.connectors.find(c=>c.product===name);
let assertions=0;
const check=(name,action)=>{action();assertions++;console.log('PASS',name);};
check('12-page PDF accounted',()=>assert.equal(result.stats.pages,12));
check('level headings',()=>assert.deepEqual(result.levels,['L3 Framing','L4 Framing','L5 Framing','Roof']));
check('HUC610 total 50',()=>assert.equal(get('HUC610')?.quantity,50));
check('HUC610 by level 17/18/15',()=>assert.deepEqual(get('HUC610')?.byLevel,{'L3 Framing':17,'L4 Framing':18,'L5 Framing':15}));
check('L5 HUC610 15 pcs',()=>assert.equal(get('HUC610')?.byLevel['L5 Framing'],15));
check('HU410 consolidated 10',()=>assert.equal(get('HU410')?.quantity,10));
check('HU610 consolidated 9',()=>assert.equal(get('HU610')?.quantity,9));
check('IUS2.37/9.5 280 pcs',()=>assert.equal(get('IUS2.37/9.5')?.quantity,280));
check('no bogus Not Required products',()=>assert.ok(result.connectors.every(c=>!/\bnot\s+(?:requ|req|r\b)/i.test(c.product))));
check('no product split for HU/HUC',()=>assert.equal(result.connectors.filter(c=>/^HUC610(?:\s|$)/.test(c.product)).length,1));
check('different connector models preserved',()=>assert.equal(get('HUC610X SKR30')?.quantity,19));
check('custom description preserved',()=>assert.equal(get('Custom Saddle By Steel Supplier')?.quantity,1));
check('total lengths present',()=>assert.ok(result.lengths.some(x=>x.product.includes('TJI 230'))));
check('total lengths through PDF page breaks',()=>assert.equal(result.lengths.find(x=>x.product==='11 7/8" TJI 230 joist')?.inches,(7350+7564+5330)*12));
check('proper cleanup',()=>{assert.equal(cleanup,12);assert.equal(destroyed,1);});
check('HTML and TSV clean',()=>{assert.ok(!combinedEmailHtml(result,true).includes('Not Required'));assert.ok(!combinedTsv(result,true).includes('Not Required'));});
check('portal sales URL mode',()=>assert.equal(portalViewFromUrl('https://example.org/EWP-Forecast/?view=sales'),'sales'));
check('portal ewp URL mode',()=>assert.equal(portalViewFromUrl('https://example.org/EWP-Forecast/?view=ewp'),'ewp'));
check('portal all URL mode',()=>assert.equal(portalViewFromUrl('https://example.org/EWP-Forecast/'),'all'));
check('unknown mode falls back to all',()=>assert.equal(portalViewFromUrl('https://example.org/EWP-Forecast/?view=unknown'),'all'));
check('sales tracking unchanged',()=>assert.equal(filterSalesRows([{status:'queue',phase:'Bidding',type:'SFD'}],{status:'queue'}).length,1));
// Keep the active connector column layout across page boundaries even if the
// next PDF page does not repeat its column headers.
const headerPage=fixture[7].filter(i=>['Level: L5 Framing','Framing Connector Summary','Qty','Product','Face Nails','PlotID','Manuf','Filler','Web Stiff'].includes(i.str) && i.transform[5]>600);
const h16row=fixture[7].filter(i=>Math.abs(i.transform[5]-(fixture[7].find(x=>x.str==='H16')?.transform[5]||0))<1);
const fakeContinuation={getDocument:()=>({promise:Promise.resolve({numPages:2,getPage:async n=>({getTextContent:async()=>({items:n===1?headerPage:h16row}),cleanup(){}})}),destroy(){}})};
const crossPages=await extractPdfPages(stubFile,fakeContinuation);
const crossResult=consolidatePages(crossPages);
check('headerless connector continuation stays clean',()=>assert.equal(crossResult.connectors.find(i=>i.product==='HUC610')?.quantity,1));
check('geometry-based Qty and Product extraction',()=>{
 const l5=pages[7].find(r=>/^H16\s+1\s+User\s+HUC610\b/.test(r.text));
 assert.equal(l5.connectorCells.quantity,'1');assert.equal(l5.connectorCells.product,'HUC610');
});
console.log(`V1.22 smoke checks: ${assertions} assertions passed; PDF rows: ${result.stats.connectorRows} connectors, ${result.stats.lengthRows} lengths; unmatched: ${result.stats.unmatchedLines}`);
