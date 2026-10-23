/** Client-side, paginated vector PDF export for BOTH consolidated material tables.
 * No upload: source data remain in browser memory. jsPDF is loaded on demand. */
import {formatFeet} from './parser.mjs?v=1.22';
let jsPdfPromise;
async function loadJsPdf(){
 if(globalThis.jspdf?.jsPDF)return globalThis.jspdf.jsPDF;
 if(!jsPdfPromise)jsPdfPromise=(async()=>{
  const sources=['https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js'];
  let last;
  for(const src of sources){
   try{
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=true;script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error(`Failed to load ${src}`));};document.head.append(script);});
    if(globalThis.jspdf?.jsPDF)return globalThis.jspdf.jsPDF;
   }catch(error){last=error;}
  }
  throw new Error(`PDF generator unavailable. Check internet access or content blockers. ${last?.message||''}`);
 })().catch(e=>{jsPdfPromise=null;throw e;});
 return jsPdfPromise;
}
function safeText(x){return String(x??'').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[^\x20-\x7e]/g,'?');}
export function getPdfGroups(result,showBreakdown){
 const levels=showBreakdown?result.levels:[];
 // Repeat product and total columns when the breakdown has too many levels.
 const chunks=[];
 for(let i=0;i<levels.length;i+=4)chunks.push(levels.slice(i,i+4));
 return chunks.length?chunks:[[]];
}
export async function downloadMaterialPdf(result,breakdown,fileName='material-list'){
 if(!result)throw new Error('Consolidate a PDF before exporting.');
 const JsPDF=await loadJsPdf();
 const doc=new JsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 const width=297,height=210,left=16,right=16,top=20,bottom=17;
 const green=[96,97,0],ink=[44,47,41],border=[205,207,201];
 let y=top,page=1;
 const groups=getPdfGroups(result,breakdown);
 function pageHeader(){
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(...ink);
  doc.text('Consolidated Material List',left,12);
  doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(100);
  doc.text('EWP Management Portal - V1.21 WEB',width-right,12,{align:'right'});
 }
 function newPage(){doc.addPage();page++;y=top;pageHeader();}
 pageHeader();
 function drawSection(title,items,kind,levelColumns,i){
  const totalWidth=width-left-right;
  const productWidth=levelColumns.length?112:Math.min(totalWidth-35,175);
  const numericWidth=(totalWidth-productWidth)/(1+levelColumns.length);
  const columns=['Product','Total',...levelColumns];
  const widths=[productWidth,...new Array(columns.length-1).fill(numericWidth)];
  const drawHeading=()=>{
   if(y+19>height-bottom)newPage();
   doc.setTextColor(...green);doc.setFont('helvetica','bold');doc.setFontSize(12);
   doc.text(safeText(title)+(groups.length>1?` (levels ${i+1}/${groups.length})`:''),left,y);y+=6;
   doc.setFillColor(243,244,237);doc.setDrawColor(...border);doc.rect(left,y,totalWidth,8,'FD');
   let x=left;doc.setTextColor(...ink);doc.setFontSize(8.2);
   for(let c=0;c<columns.length;c++){
    doc.text(safeText(columns[c]),x+(c===0?3:widths[c]-3),y+5.4,{align:c===0?'left':'right'});
    x+=widths[c];
   } y+=8;
  };
  drawHeading();
  if(!items.length){doc.setFontSize(8);doc.setTextColor(100);doc.text('No matching rows',left+3,y+6);y+=10;return;}
  for(const [index,item] of items.entries()){
   const values=[item.product,kind==='connectors'?item.quantity:formatFeet(item.inches),...levelColumns.map(level=>kind==='connectors'?(item.byLevel?.[level]||0):formatFeet(item.byLevel?.[level]||0))];
   doc.setFont('helvetica','normal');doc.setFontSize(8.1);
   const wrapped=doc.splitTextToSize(safeText(values[0]),productWidth-6);
   const rowHeight=Math.max(8,wrapped.length*4+3);
   if(y+rowHeight>height-bottom){newPage();drawHeading();}
   if(index%2===1){doc.setFillColor(249,249,246);doc.rect(left,y,totalWidth,rowHeight,'F');}
   doc.setDrawColor(...border);doc.setLineWidth(.14);doc.line(left,y+rowHeight,left+totalWidth,y+rowHeight);
   doc.setTextColor(...ink);doc.text(wrapped,left+3,y+4.9);
   let x=left+productWidth;
   for(let j=1;j<values.length;j++){
    if(j===1)doc.setFont('helvetica','bold');else doc.setFont('helvetica','normal');
    doc.text(safeText(values[j]),x+widths[j]-3,y+4.9,{align:'right'});x+=widths[j];
   }
   y+=rowHeight;
  }
  y+=12;
 }
 for(let group=0;group<groups.length;group++){
  if(group>0)newPage();
  drawSection('Framing Connector Summary (pcs)',result.connectors,'connectors',groups[group],group);
  drawSection('Total Lengths (LF)',result.lengths,'lengths',groups[group],group);
 }
 const totalPages=doc.internal.getNumberOfPages();
 for(let p=1;p<=totalPages;p++){
  doc.setPage(p);doc.setDrawColor(...border);doc.line(left,height-13,width-right,height-13);
  doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(110);
  doc.text('Check material quantities against the source Layout Material List before ordering.',left,height-9);
  doc.text(`${p} / ${totalPages}`,width-right,height-9,{align:'right'});
 }
 const cleanName=String(fileName||'material-list').replace(/\.pdf$/i,'').replace(/[^a-z0-9._ -]+/gi,'').trim().slice(0,80)||'material-list';
 doc.save(`${cleanName} - Consolidated Material List.pdf`);
 return {pages:totalPages,levelGroups:groups.length};
}
