/* EWP Management V1.19 — client-side Weyerhaeuser material report consolidation.
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
function parseConnector(line){
  // Column-leading PlotID, Qty, Manuf, Product, then optional nailing schedule.
  const m=clean(line).match(/^([A-Za-z]{1,4}\d+[\w.'/-]*)\s+(\d+)\s+([A-Za-z][\w&.-]*)\s+(.+)$/);
  if(!m)return null;
  const [,plot,qtyText,manufacturer,tail]=m;
  if(!/^H\w/i.test(plot))return null;
  const qty=Number(qtyText);
  if(!Number.isSafeInteger(qty)||qty<0||qty>1000000)return null;
  // Nailing counts are outside the requested connector material name.
  const material=clean(tail
    .split(/\s+(?=\d+\s*-\s*(?:10d|SDS|Strong-Grip|16d|8d|Nail|Screw))/i)[0]
    .replace(/\s+(?:(?:No\s+)?Not\s+Required|No\s+(?:No|Yes))\s*$/i,''));
  if(!material||!/\w/.test(material))return null;
  return { product:material, manufacturer, quantity:qty, plot };
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
        const c=parseConnector(line);
        if(!c){skipped++;continue;}
        const key=c.product.toLowerCase();
        const old=level.connectors.get(key);
        if(old){old.quantity+=c.quantity;old.manufacturers.add(c.manufacturer);}
        else level.connectors.set(key,{product:c.product,quantity:c.quantity,manufacturers:new Set([c.manufacturer])});
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
      const val=connectors.get(key)||{product:c.product,quantity:0,byLevel:{},manufacturers:new Set()};
      val.quantity+=c.quantity;val.byLevel[level.name]=(val.byLevel[level.name]||0)+c.quantity;
      for(const manufacturer of c.manufacturers)val.manufacturers.add(manufacturer);
      connectors.set(key,val);
    }
    for(const [key,l] of level.lengths){
      const val=lengths.get(key)||{product:l.product,inches:0,byLevel:{}};
      val.inches+=l.inches;val.byLevel[level.name]=(val.byLevel[level.name]||0)+l.inches;
      lengths.set(key,val);
    }
  }
  const sorting=(a,b)=>a.product.localeCompare(b.product,undefined,{numeric:true,sensitivity:'base'});
  const connectorList=[...connectors.values()].sort(sorting).map(c=>({...c,manufacturers:[...c.manufacturers].sort()}));
  const lengthList=[...lengths.values()].sort(sorting);
  if(!recognizedConnectors)warnings.push('No Framing Connector Summary rows were found.');
  if(!recognizedLengths)warnings.push('No Total Lengths rows were found.');
  if(skipped)warnings.push(`${skipped} non-matching line(s) occurred inside target sections. Review the PDF if the figures seem incomplete.`);
  return {levels:names,connectors:connectorList,lengths:lengthList,warnings,stats:{pages:pages.length,levelCount:names.length,connectorRows:recognizedConnectors,lengthRows:recognizedLengths,unmatchedLines:skipped}};
}

export function toTsv(items,levels,kind,showLevels=false){
  const connector=kind==='connectors';
  const title=connector?'FRAMING CONNECTOR SUMMARY — QUANTITY (PCS)':'TOTAL LENGTHS — LINEAR FEET (LF)';
  const header=['Product',...(connector?['Manufacturer']:[]),'Total',...(showLevels?levels:[])];
  const rows=items.map(item=>[
    item.product,
    ...(connector?[item.manufacturers.join(' / ')]:[]),
    connector?String(item.quantity):formatFeet(item.inches),
    ...(showLevels?levels.map(level=>connector?String(item.byLevel[level]||0):formatFeet(item.byLevel[level]||0)):[])
  ]);
  return [title,header.join('\t'),...rows.map(cols=>cols.map(col=>String(col).replace(/[\t\r\n]+/g,' ')).join('\t'))].join('\n');
}
export function combinedTsv(result,showLevels=false){
  return [toTsv(result.connectors,result.levels,'connectors',showLevels),toTsv(result.lengths,result.levels,'lengths',showLevels)].join('\n\n');
}

export async function extractPdfPages(file,pdfjsLib,onPage=()=>{}){
  const array=new Uint8Array(await file.arrayBuffer());
  const task=pdfjsLib.getDocument({data:array});
  // Cleanup belongs to the PDFDocumentLoadingTask. PDFDocumentProxy.destroy()
  // is not consistently available in the browser PDF.js build.
  let doc;
  const pages=[];
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
      pages.push(rows.map(row=>clean(row.items.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' '))).filter(Boolean));
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
