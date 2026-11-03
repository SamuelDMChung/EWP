/* V1.29 — deterministic, browser-only aggregation of already-parsed reports.
   PDF bytes are never saved or sent to the backend. */
const sortProducts=(a,b)=>a.product.localeCompare(b.product,undefined,{numeric:true,sensitivity:'base'});
const normalizeProject=value=>String(value||'').trim().toUpperCase().replace(/(?:[_\-\s]+(?:REV(?:ISION)?|R)\s*\d+[A-Z]?)$/i,'');

export function projectFromPages(pages){
 for(const page of pages){
  for(const row of page){
   const text=typeof row==='string'?row:row?.text||'';
   const match=String(text).match(/\bPROJECT\s*#\s*:\s*([A-Z]{1,8}\d{3,}(?:[_-][A-Z0-9]+)*)/i);
   if(match)return normalizeProject(match[1]);
  }
 }
 return '';
}

export function overlappingRevision(entry,otherEntries){
 if(!entry.parsed)return null;
 const levels=new Set(entry.parsed.levels.map(s=>s.toLowerCase()));
 for(const other of otherEntries){
  if(other===entry||!other.parsed||other.status!=='ready')continue;
  const sameProject=Boolean(entry.projectId&&other.projectId&&other.projectId===entry.projectId);
  const sameName=(!entry.projectId||!other.projectId)&&entry.name.toLowerCase()===other.name.toLowerCase();
  if(!sameProject&&!sameName)continue;
  const overlap=other.parsed.levels.filter(level=>levels.has(level.toLowerCase()));
  if(overlap.length)return {name:other.name,levels:overlap,reason:sameProject?'project':'filename'};
 }
 return null;
}

export function mergeMaterialResults(entries){
 const included=entries.filter(entry=>entry.status==='ready'&&entry.parsed);
 if(!included.length)return null;
 const levels=[];const levelSet=new Set();
 const connectors=new Map();const lengths=new Map();const warnings=[];
 let pages=0,connectorRows=0,lengthRows=0,unmatchedLines=0;
 const merge=(target,items,field)=>{
  for(const item of items){
   const key=item.product.toLowerCase();
   let merged=target.get(key);
   if(!merged){merged={product:item.product,[field]:0,byLevel:{}};target.set(key,merged);}
   merged[field]+=item[field];
   for(const [level,count] of Object.entries(item.byLevel||{}))merged.byLevel[level]=(merged.byLevel[level]||0)+count;
  }
 };
 for(const entry of included){
  const result=entry.parsed;
  for(const level of result.levels){if(!levelSet.has(level)){levelSet.add(level);levels.push(level);}}
  merge(connectors,result.connectors,'quantity');merge(lengths,result.lengths,'inches');
  pages+=result.stats.pages;connectorRows+=result.stats.connectorRows;lengthRows+=result.stats.lengthRows;unmatchedLines+=result.stats.unmatchedLines;
  for(const warning of result.warnings)warnings.push(`${entry.name}: ${warning}`);
 }
 return {
  levels,connectors:[...connectors.values()].sort(sortProducts),lengths:[...lengths.values()].sort(sortProducts),warnings,
  stats:{pages,levelCount:levels.length,connectorRows,lengthRows,unmatchedLines,files:included.length}
 };
}
