/* EWP Management V1.22 — column-aware Weyerhaeuser material report consolidation.
 * The active level and section deliberately survive PDF page breaks.
 * Only Framing Connector Summary and Total Lengths are read.
 */
export function clean(value='') { return String(value).replace(/\s+/g,' ').trim(); }

export function parseFeetInches(value) {
  const text=clean(value).replaceAll('’',"'").replaceAll('“','"').replaceAll('”','"');
  const match=text.match(/^(\d+(?:\.\d+)?)\s*'\s*(\d+(?:\.\d+)?)?\s*"?\s*(\d+)?$/);
  if(!match) return null;
  const feet=Number(match[1]);
  const inch=Number(match[2]||0);
  // ActiveReports often writes 15'0"0: the final 0 is a fractional-inch marker.
  if(!Number.isFinite(feet)||!Number.isFinite(inch)||inch>=12)return null;
  return Math.round(feet*1200+inch*100) / 100; // precise to 1/100 inch
}
export function formatFeet(totalInches=0){
  const value=totalInches/12;
  return Number.isInteger(value) ? String(value) : (Math.round(value*100)/100).toFixed(2);
}
function levelName(raw){return clean(raw).replace(/^Level\s*:\s*/i,'') || 'Unspecified level';}
function sectionOf(line){
  const s=clean(line).toLowerCase();
  if(/^framing\s+connector\s+summary\b/.test(s)) return 'connectors';
  if(/^total\s+lengths\b/.test(s)) return 'lengths';
  if(/^(?:products?|wall\s+framing|accessories|blocking|other\s+materials?|hardware|hangers|framing\s+materials|joist\s+schedule|connection\s+details|fasteners)\b/.test(s))return 'other';
  return null;
}
function furniture(line){
  const s=clean(line);
  return !s || /^(?:Layout Material List Report|Job\s*:|Number of Sheets\b|Address\b|Design Date\b|PROJECT\s*#|Job Name\b|Plot\s*I?D\b|PlotID\b|Length\s+Product\b|\(†\)|\(‡\)|Refer to Weyerhaeuser|Page\s+\d+\s+of\s+\d+)/i.test(s)
    || /^\d{1,2}\/\d{1,2}\/\d{4}\s/.test(s)
    || /^(?:Not Required|No No|No Yes)$/i.test(s);
}
// INVERTED is a mounting orientation, not a different hanger SKU.
// Remove it as a standalone modifier for ANY connector model, leaving
// dimensions and meaningful model suffixes untouched.
export function normalizeConnectorProduct(value){
  return clean(value)
    .replace(/\s+(?:No\s+)?Not\s+Required\s*$/i, '')
    .replace(/\s+No\s+(?:No|Yes)\s*$/i, '')
    .replace(/(?:\(\s*INVERTED\s*\)|\[\s*INVERTED\s*\]|\bINVERTED\b)/gi, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\s*[-–—]\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function parseConnector(line,sourceLine){
  // When PDF text coordinates are available, ONLY Qty and Product column
  // content can become a material. Filler/Web Stiffener and nailing notes
  // must never be parsed as part of the product name.
  if(sourceLine && typeof sourceLine==='object'){
    if(!sourceLine.connectorCells)return null; // never fallback to whole-row PDF text
    const plot=clean(line).match(/^([A-Za-z]{1,4}\d+[\w.'/\-]*)\b/)?.[1];
    if(!plot||!/^H\w/i.test(plot))return null;
    const {quantity,product}=sourceLine.connectorCells;
    const qtyText=clean(quantity);
    const qty=Number(qtyText);
    if(!/^\d+$/.test(qtyText)||!Number.isSafeInteger(qty)||qty>1000000)return null;
    const material=normalizeConnectorProduct(product);
    if(!material||!/\w/.test(material))return null;
    return {product:material,quantity:qty,plot};
  }
  // Column-leading PlotID, Qty, Manuf, Product, then optional nailing schedule.
  const m=clean(line).match(/^([A-Za-z]{1,4}\d+[\w.'/-]*)\s+(\d+)\s+([A-Za-z][\w&.-]*)\s+(.+)$/);
  if(!m)return null;
  const [,plot,qtyText,manufacturer,tail]=m;
  if(!/^H\w/i.test(plot))return null;
  const qty=Number(qtyText);
  if(!Number.isSafeInteger(qty)||qty<0||qty>1000000)return null;
  // Nailing counts are outside the requested connector material name.
  const material=normalizeConnectorProduct(tail
    .split(/\s+(?=\d+\s*-\s*(?:10d|SDS|Strong-Grip|16d|8d|Nail|Screw))/i)[0]);
  if(!material||!/\w/.test(material))return null;
  return { product:material, quantity:qty, plot };
}
function parseLength(line){
  const s=clean(line);
  // Weyerhaeuser Total Lengths is Length-first, sometimes PDF extraction glues the two columns.
  let m=s.match(/^(\d+(?:\.\d+)?\s*'\s*\d*(?:\.\d+)?\s*"?\s*\d*)\s*(.+)$/);
  if(!m)return null;
  const inches=parseFeetInches(m[1]);
  const product=clean(m[2]);
  if(inches==null||!product||!/[a-z]/i.test(product))return null;
  return {product,inches};
}
function rowText(row) { return typeof row==='string' ? clean(row) : clean(row?.text); }
export function consolidatePages(pages){
  const levels=new Map(); let activeLevel=null,section='other';
  const warnings=[];let recognizedConnectors=0,recognizedLengths=0, skipped=0;
  function ensureLevel(name){
    if(!levels.has(name))levels.set(name,{name,connectors:new Map(),lengths:new Map(),pageNumbers:new Set()});
    return levels.get(name);
  }
  for(let pageIndex=0;pageIndex<pages.length;pageIndex++){
    const page=Array.isArray(pages[pageIndex])?pages[pageIndex]:[];
    for(const sourceLine of page){
      const line=rowText(sourceLine);
      if(!line)continue;
      const foundLevel=line.match(/^Level\s*:\s*(.+)$/i);
      if(foundLevel){const nextLevel=levelName(foundLevel[1]);if(nextLevel!==activeLevel)section='other';activeLevel=nextLevel;ensureLevel(activeLevel);continue;}
      const sectionHit=sectionOf(line);
      if(sectionHit){section=sectionHit;continue;}
      if(furniture(line))continue; // headers/footers MUST NOT break a continued section
      if(section!=='connectors'&&section!=='lengths')continue;
      if(!activeLevel){activeLevel='Unspecified level';ensureLevel(activeLevel);warnings.push('A material section had no preceding Level heading.');}
      const level=ensureLevel(activeLevel);
      if(section==='connectors'){
        const c=parseConnector(line,sourceLine);
        if(!c){skipped++;continue;}
        const key=c.product.toLowerCase();
        const old=level.connectors.get(key);
        if(old)old.quantity+=c.quantity;
        else level.connectors.set(key,{product:c.product,quantity:c.quantity});
        recognizedConnectors++;level.pageNumbers.add(pageIndex+1);
      } else {
        const l=parseLength(line);
        if(!l){skipped++;continue;}
        const key=l.product.toLowerCase();
        const old=level.lengths.get(key);
        if(old)old.inches+=l.inches;
        else level.lengths.set(key,{product:l.product,inches:l.inches});
        recognizedLengths++;level.pageNumbers.add(pageIndex+1);
      }
    }
  }
  const names=[...levels.keys()];
  const connectors=new Map(),lengths=new Map();
  for(const level of levels.values()){
    for(const [key,c] of level.connectors){
      const val=connectors.get(key)||{product:c.product,quantity:0,byLevel:{}};
      val.quantity+=c.quantity;val.byLevel[level.name]=(val.byLevel[level.name]||0)+c.quantity;
      connectors.set(key,val);
    }
    for(const [key,l] of level.lengths){
      const val=lengths.get(key)||{product:l.product,inches:0,byLevel:{}};
      val.inches+=l.inches;val.byLevel[level.name]=(val.byLevel[level.name]||0)+l.inches;
      lengths.set(key,val);
    }
  }
  const sorting=(a,b)=>a.product.localeCompare(b.product,undefined,{numeric:true,sensitivity:'base'});
  const connectorList=[...connectors.values()].sort(sorting);
  const lengthList=[...lengths.values()].sort(sorting);
  if(!recognizedConnectors)warnings.push('No Framing Connector Summary rows were found.');
  if(!recognizedLengths)warnings.push('No Total Lengths rows were found.');
  if(skipped)warnings.push(`${skipped} non-matching line(s) occurred inside target sections. Review the PDF if the figures seem incomplete.`);
  return {levels:names,connectors:connectorList,lengths:lengthList,warnings,stats:{pages:pages.length,levelCount:names.length,connectorRows:recognizedConnectors,lengthRows:recognizedLengths,unmatchedLines:skipped}};
}

// Keep email and Excel columns derived from the same data so copying never
// changes product grouping or per-level quantities.
function tableData(items,levels,kind,showLevels=false){
  const isConnector=kind==='connectors';
  const title=isConnector?'FRAMING CONNECTOR SUMMARY — QUANTITY (PCS)':'TOTAL LENGTHS — LINEAR FEET (LF)';
  const headers=['Product','Total',...(showLevels?levels:[])];
  const rows=items.map(item=>[
    item.product,
    isConnector?String(item.quantity):formatFeet(item.inches),
    ...(showLevels?levels.map(level=>isConnector?String(item.byLevel[level]||0):formatFeet(item.byLevel[level]||0)):[])
  ]);
  return {title,headers,rows};
}
export function toTsv(items,levels,kind,showLevels=false){
  const {title,headers,rows}=tableData(items,levels,kind,showLevels);
  const plain=value=>String(value).replace(/[\t\r\n]+/g,' ');
  return [title,headers.join('\t'),...rows.map(cols=>cols.map(plain).join('\t'))].join('\n');
}
export function combinedTsv(result,showLevels=false){
  return [toTsv(result.connectors,result.levels,'connectors',showLevels),toTsv(result.lengths,result.levels,'lengths',showLevels)].join('\n\n');
}
const escapeHtml=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// Outlook and webmail support pasted HTML tables most reliably with styles
// inlined on each cell (rather than a CSS class or external stylesheet).
export function toEmailHtml(items,levels,kind,showLevels=false){
  const {title,headers,rows}=tableData(items,levels,kind,showLevels);
  const tableWidth=showLevels?Math.min(920,Math.max(560,340+levels.length*105)):480;
  const tableStyle=`border-collapse:collapse;border-spacing:0;width:${tableWidth}px;max-width:100%;border:1px solid #cdd2d1;font-family:Arial,Calibri,sans-serif;font-size:12px;line-height:1.25;color:#29313b;`;
  const common='border:1px solid #d9dedb;padding:5px 9px;vertical-align:middle;';
  const headStyle=common+'background-color:#f2f3ed;font-weight:700;text-align:left;';
  const headNumStyle=headStyle+'text-align:right;';
  const titleHtml=`<p style="margin:0 0 6px 0;font-family:Arial,Calibri,sans-serif;font-size:13px;line-height:1.3;font-weight:700;color:#29313b;">${escapeHtml(title)}</p>`;
  const headHtml='<tr>'+headers.map((heading,i)=>`<th scope="col" style="${i?' '+headNumStyle:headStyle}">${escapeHtml(heading)}</th>`).join('')+'</tr>';
  const rowsHtml=rows.length ? rows.map((cols,index)=>'<tr>'+cols.map((value,i)=>{
    const shade=index%2===1?'background-color:#fafaf8;':'';
    const align=i?'text-align:right;white-space:nowrap;':'text-align:left;';
    const weight=i===1?'font-weight:700;':'';
    return `<td style="${common}${shade}${align}${weight}">${escapeHtml(value)}</td>`;
  }).join('')+'</tr>').join('')
   : `<tr><td colspan="${headers.length}" style="${common}">No matching rows found</td></tr>`;
  return titleHtml+`<table role="table" width="${tableWidth}" cellspacing="0" cellpadding="0" border="1" style="${tableStyle}"><thead>${headHtml}</thead><tbody>${rowsHtml}</tbody></table>`;
}
export function combinedEmailHtml(result,showLevels=false){
  const separator='<div style="height:14px;line-height:14px;font-size:1px;">&nbsp;</div>';
  return '<div>'+toEmailHtml(result.connectors,result.levels,'connectors',showLevels)+separator+toEmailHtml(result.lengths,result.levels,'lengths',showLevels)+'</div>';
}

export async function extractPdfPages(file,pdfjsLib,onPage=()=>{}){
  const array=new Uint8Array(await file.arrayBuffer());
  const task=pdfjsLib.getDocument({data:array});
  // Cleanup belongs to the PDFDocumentLoadingTask. PDFDocumentProxy.destroy()
  // is not consistently available in the browser PDF.js build.
  let doc;
  const pages=[];
  let connectorHeader=null;
  try{
    doc=await task.promise;
    for(let i=1;i<=doc.numPages;i++){
      const page=await doc.getPage(i), content=await page.getTextContent();
      // Rebuild physical rows instead of trusting arbitrary PDF text-stream order.
      const rows=[];
      for(const item of content.items){
        const str=clean(item.str);if(!str)continue;
        const y=Number(item.transform?.[5]||0),x=Number(item.transform?.[4]||0);
        let row=rows.find(r=>Math.abs(r.y-y)<=2.0);
        if(!row){row={y,items:[]};rows.push(row);}
        row.items.push({x,text:str});
      }
      rows.sort((a,b)=>b.y-a.y);
      // Capture the PDF's actual column anchors from the repeated header.
      // Keep the last layout through page breaks (a continuation page may
      // omit its header). Positional extraction is much safer than stripping
      // arbitrary Filler / Web Stiffener annotations from the complete row.
      let header=connectorHeader;
      const pageRows=[];
      for(const row of rows){
        const items=row.items.sort((a,b)=>a.x-b.x);
        const text=clean(items.map(i=>i.text).join(' '));
        if(!text)continue;
        const heading=name=>items.find(i=>clean(i.text).toLowerCase()===name.toLowerCase());
        const qty=heading('Qty'),product=heading('Product');
        const next=['Face Nails','Top Nails','Member Nails','Filler','Web Stiff']
          .map(heading).filter(Boolean).filter(i=>i.x>(product?.x??Infinity)).sort((a,b)=>a.x-b.x)[0];
        if(qty&&product&&next&&qty.x<product.x){
          const manuf=heading('Manuf');
          header={qtyX:qty.x,qtyEnd:manuf?.x||product.x,productX:product.x,productEnd:next.x};
        }
        const source={text};
        if(header && /^H[A-Za-z0-9.'\/-]*\d+\s/i.test(text)){
          // Guard the Qty/Product boundaries. No value outside the Product
          // column is allowed into the resulting connector's name.
          source.connectorCells={
            quantity:clean(items.filter(i=>i.x>=header.qtyX-1.5&&i.x<header.qtyEnd-0.5).map(i=>i.text).join(' ')),
            product:clean(items.filter(i=>i.x>=header.productX-1.5&&i.x<header.productEnd-1.5).map(i=>i.text).join(' '))
          };
        }
        pageRows.push(source);
      }
      connectorHeader=header;
      pages.push(pageRows);
      onPage(i,doc.numPages);
      // Page cache release should never erase a successful extraction.
      try { if(typeof page.cleanup==='function')page.cleanup(); }
      catch(error){console.warn('PDF page cleanup failed:',error);}
    }
    return pages;
  }finally{
    try { if(typeof task?.destroy==='function')await task.destroy(); }
    catch(error){console.warn('PDF reader cleanup failed:',error);}
  }
}
