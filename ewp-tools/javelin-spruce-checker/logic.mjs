/* V1.31: browser-only material checking. No external AI, OCR or database access.
 * PDF.js text items are grouped geometrically; all source objects retain page/row provenance.
 */
const VULGAR_FRACTIONS={'¼':'1/4','½':'1/2','¾':'3/4','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8','⅓':'1/3','⅔':'2/3'};
export const clean=s=>String(s??'').replace(/([0-9])(?=[¼½¾⅛⅜⅝⅞⅓⅔])/g,'$1 ').replace(/[¼½¾⅛⅜⅝⅞⅓⅔]/g,c=>VULGAR_FRACTIONS[c]).replace(/[“”″]/g,'\"').replace(/[’′]/g,"'").replace(/\s+/g,' ').trim();
// Dimensions can arrive as decimals, simple fractions or mixed fractions in either PDF.
// A fraction must not be mistaken for a decimal or truncated at its first digit.
const DIMENSION_PART=String.raw`(?:\d+(?:\.\d+)?(?:\s*[- ]\s*\d+\s*\/\s*\d+)?|\d+\s*\/\s*\d+)`;
const DIMENSION_PAIR=new RegExp(`(${DIMENSION_PART})\\s*\"?\\s*[X×]\\s*(${DIMENSION_PART})\\s*\"?`,'i');
const BEFORE_TJI=new RegExp(`(${DIMENSION_PART})\\s*\"?\\s*TJI`,'i');
export function dimension(text){
 const s=clean(text).replace(/(\d)\s*[-–]\s*(\d+\s*\/\s*\d+)/g,'$1 $2');
 const mixed=s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
 if(mixed&&Number(mixed[3])>0)return Number(mixed[1])+Number(mixed[2])/Number(mixed[3]);
 const fraction=s.match(/^(\d+)\s*\/\s*(\d+)$/);
 if(fraction&&Number(fraction[2])>0)return Number(fraction[1])/Number(fraction[2]);
 return /^\d+(?:\.\d+)?$/.test(s)?Number(s):null;
}
export function feet(text){
 const s=clean(text);
 const m=s.match(/^(\d+(?:\.\d+)?)\s*'\s*(\d+(?:\.\d+)?)?\s*(?:"\s*\d+)?/);
 return m?Number(m[1])+Number(m[2]||0)/12:null;
}
const normNum=n=>Number.isFinite(n)?String(Math.round(n*10000)/10000):'?';
export function productSpec(input){
 // Normalize hyphenated mixed fractions, but never erase decimal points.
 const s=clean(input).toUpperCase().replace(/(\d)\s*[-–]\s*(\d+\s*\/\s*\d+)/g,'$1 $2');
 if(/(?:WEB\s+STIFFENER|BACKER\s+BLOCK)/.test(s))return null;
 const type=/\bTJI\b/.test(s)?'TJI':/\b(?:PARALLAM|PSL)\b/.test(s)?'PSL':/\b(?:TIMBERSTRAND|LSL)\b/.test(s)?'LSL':null;
 if(!type)return {key:null,label:clean(input),type:'UNKNOWN',ambiguous:true};
 const grade=type==='TJI'?(s.match(/\bTJI\s*(\d{2,4})\b/)?.[1]||''):(s.match(/\b(\d+(?:\.\d+)?)\s*E\b/)?.[1]||'');
 let width=null,depth=null;
 const pair=s.match(DIMENSION_PAIR);
 if(pair){width=dimension(pair[1]);depth=dimension(pair[2]);}
 if(type==='TJI'){
  if(depth==null){const candidate=s.match(BEFORE_TJI);depth=candidate?dimension(candidate[1]):null;}
  // Javelin gives nominal depth, but omits the physical flange width.
  if(width==null&&{'230':1,'360':1,'560':1}[grade])width=grade==='560'?3.5:2+5/16;
 }
 const key=grade&&width!=null&&depth!=null?`${type}|${grade}|${normNum(width)}|${normNum(depth)}`:null;
 return {key,type,grade,width,depth,label:`${type} ${grade||'?'} · ${width??'?'}" × ${depth??'?'}"`,ambiguous:!key};
}
// Determine format from actual PDF page contents, never from the filename.
// Low-confidence or conflicting evidence must be assigned by the user.
export function classifyPdfPages(pages){
 const lines=pages.slice(0,Math.min(pages.length,3)).flatMap(p=>(p.lines||[]).map(l=>clean(l.text).toUpperCase()));
 const blob=lines.join('\n');
 const j=(/LAYOUT MATERIAL LIST REPORT/.test(blob)?4:0)+(/PLOT\s*ID|PLOTID/.test(blob)?1:0)+(/NET\s*QTY/.test(blob)?1:0)+(/\bPLIES\b/.test(blob)?1:0);
 const s=(/GRIFF BUILDING SUPPLIES/.test(blob)?2:0)+(/CUSTOMER COPY/.test(blob)?2:0)+(/\bORDERED\b/.test(blob)?1:0)+(/\bREMAIN\b/.test(blob)?1:0)+(/\bCOMMENT\b/.test(blob)?1:0);
 if(j>=4&&j>=s+2)return {kind:'j',confidence:j,reason:'Javelin material-list headings'};
 if(s>=4&&s>=j+2)return {kind:'s',confidence:s,reason:'Spruce sales-order headings'};
 return {kind:null,confidence:Math.max(s,j),reason:'Unrecognized or ambiguous document; choose Javelin or Spruce manually'};
}
export function cutsFromDescription(desc){
 const text=clean(desc); const out=[];
 for(const m of text.matchAll(/(?:^|[,;\s])([0-9]+)\s*[-–]\s*([0-9]+(?:\.[0-9]+)?)\s*'\s*(?:([0-9]+(?:\.\d+)?)\s*\")?/g)){
  const qty=Number(m[1]), length=Number(m[2])+(Number(m[3]||0)/12);
  if(qty>0&&qty<=10000&&length>0&&length<200)out.push({qty,length});
 }
 return out;
}
export function pdfLinesFromItems(items,pageHeight){
 const tokens=items.filter(x=>typeof x.str==='string'&&x.str.trim()).map(x=>({text:clean(x.str), x:Number(x.transform?.[4]??x.x??0),y:Math.round((pageHeight-Number(x.transform?.[5]??(pageHeight-x.y??0)))*10)/10, width:Number(x.width)||0}));
 tokens.sort((a,b)=>a.y-b.y||a.x-b.x);
 const lines=[];
 for(const t of tokens){
  let line=lines.length?lines[lines.length-1]:null;
  if(!line||Math.abs(line.y-t.y)>2.4){line={y:t.y,tokens:[]};lines.push(line);}
  line.tokens.push(t);
 }
 for(const line of lines){line.tokens.sort((a,b)=>a.x-b.x);line.text=line.tokens.map(t=>t.text).join(' ');}
 return lines;
}
export function pdfAnnotations(annots,pageNumber,viewport){
 return annots.map(a=>{
  const raw=a.rect||[0,0,0,0]; let rect;
  if(viewport?.convertToViewportRectangle){const r=viewport.convertToViewportRectangle(raw);rect=[Math.min(r[0],r[2]),Math.min(r[1],r[3]),Math.max(r[0],r[2]),Math.max(r[1],r[3])];}
  else rect=raw;
  return {type:clean(a.subtype||a.annotationType||a.type),contents:clean(a.contentsObj?.str||a.contents||a.titleObj?.str||''),rect,page:pageNumber};
 });
}
function cols(line,breaks){return breaks.map(([min,max])=>clean(line.tokens.filter(t=>t.x>=min&&t.x<max).map(t=>t.text).join(' ')));}
export function parseJavelin(pages){
 const records=[],annotations=[],warnings=[],pageLevels=new Map(),ambiguousLevelPages=new Set();let currentLevel='Unspecified level',unit='Unspecified section';
 for(const page of pages){
  const pageNo=page.page,lines=page.lines||[],anns=(page.annotations||[]).map(a=>({...a,type:a.type||a.subtype,page:a.page||pageNo}));
  annotations.push(...anns);
  if(!lines.length)warnings.push(`Javelin p.${pageNo}: no selectable text; page may be scanned or flattened.`);
  for(const line of lines){
   const t=clean(line.text), y=line.y;
   if(/\bLevel\s*:\s*(.+)/i.test(t)){currentLevel=t.match(/\bLevel\s*:\s*(.+)/i)[1].trim();if(pageLevels.has(pageNo)&&pageLevels.get(pageNo)!==currentLevel)ambiguousLevelPages.add(pageNo);pageLevels.set(pageNo,currentLevel);unit='Unspecified section';continue;}
   if(/^(?:(?:\d+(?:st|nd|rd|th)\s+)?rim and blockings|\d{3}(?:\s*\+\s*stair(?:s)?)?)$/i.test(t)&&line.tokens.some(x=>x.x>230&&x.x<400)){unit=/rim and blockings/i.test(t)?'Rim and blockings':t.replace(/\s+/g,' ').replace(/stair$/i,'stairs').trim();continue;}
   if(!line.tokens.some(x=>x.x>=535)||y<60||y>745)continue;
   const [plot,length,description,pliesText,qtyText]=cols(line,[[32,95],[95,153],[153,500],[500,532],[532,568]]);
   if(!/^\d+(?:\.\d+)?\s*'/.test(length)||!/^[0-9]+$/.test(qtyText))continue;
   const qty=Number(qtyText),plies=Number(pliesText);
   if(!(qty>0&&qty<100000)||!(plies>0&&plies<100)) {warnings.push(`Javelin page ${pageNo}: invalid quantity or ply count near ${plot}`);continue;}
   const actualLength=feet(length);if(actualLength===null){warnings.push(`Javelin page ${pageNo}: unrecognized length ${length}`);continue;}
   const spec=productSpec(description);
   if(spec===null)continue; // Exclude both web stiffeners and backer blocks, always.
   const record={source:'Javelin',page:pageNo,y,plot,unit,level:currentLevel,description,length:actualLength,qty,plies,spec,originalSpec:spec,notes:[],excluded:false};
   if(plies!==1)record.notes.push(`Multi-ply Javelin row (${plies} plies; Net Qty ${qty}); verify that order quantity represents net pieces.`);
   if(!spec.key)record.notes.push('Product specifications could not be normalized unambiguously.');
   records.push(record);
  }
 }
 const overrideAnns=annotations.filter(a=>/freetext/i.test(a.type)&&/all\s+joists\s+(\d+)\s*,?\s*typ\.?\s*this\s+level/i.test(a.contents));
 const gradeByLevel=new Map();
 // Annotation on a continuation page inherits its Javelin level from the prior page.
 let inherited='Unspecified level';for(const p of pages){if(pageLevels.has(p.page))inherited=pageLevels.get(p.page);else pageLevels.set(p.page,inherited);}
 for(const ann of overrideAnns){
  if(ambiguousLevelPages.has(ann.page)){warnings.push(`Javelin p.${ann.page}: multiple levels share a page; note scope requires review.`);continue;}
  const level=pageLevels.get(ann.page)||'Unspecified level';
  if(!gradeByLevel.has(level))gradeByLevel.set(level,new Set());
  gradeByLevel.get(level).add(ann.contents.match(/all\s+joists\s+(\d+)/i)[1]);
 }
 for(const [level,grades] of gradeByLevel){
  if(grades.size>1){warnings.push(`Conflicting joist-grade instructions for ${level}: ${[...grades].join(', ')}. Review manually.`);continue;}
  const grade=[...grades][0];
  for(const r of records){if(r.level!==level||r.spec?.type!=='TJI')continue;
   const width=grade==='560'?3.5:2+5/16;
   r.spec={...r.spec,grade,width,key:r.spec.depth==null?null:`TJI|${grade}|${normNum(width)}|${normNum(r.spec.depth)}`,label:`TJI ${grade} · ${width}\" × ${r.spec.depth}\"`,ambiguous:r.spec.depth==null};
   r.notes.push(`Original ${r.originalSpec.label}; applied level-wide annotation "All joists ${grade}" (${overrideAnns.filter(a=>pageLevels.get(a.page)===level).map(a=>'p.'+a.page).join(', ')})`);
  }
 }
 const activeGrade=gradeByLevel.size===1&&[...gradeByLevel.values()][0].size===1?[...gradeByLevel.values()][0].values().next().value:null;
 const strikeouts=annotations.filter(a=>/strikeout/i.test(a.type));
 for(const a of strikeouts){
  const nearby=records.filter(r=>r.page===a.page&&Math.abs(r.y-(a.rect[1]+a.rect[3])/2)<7.2);
  if(nearby.length!==1){warnings.push(`Javelin page ${a.page}: strikeout cannot be assigned confidently to one material row.`);continue;}
  const r=nearby[0],width=a.rect[2]-a.rect[0];
  if(width>330){r.excluded=true;r.notes.push(`Full-row strikeout on Javelin page ${a.page}`);}
  else if(width<100 && r.spec.type==='TJI' && activeGrade){r.notes.push('Grade-only strikeout interpreted using explicit level-wide note.');}
  else {r.notes.push('Ambiguous strikeout — review before approving this row.');warnings.push(`Javelin p.${a.page} ${r.unit} ${r.plot}: ambiguous strikeout.`);}
 }
 const otherFreeText=annotations.filter(a=>/freetext/i.test(a.type)&&!overrideAnns.includes(a));
 for(const a of otherFreeText)warnings.push(`Javelin p.${a.page}: unrecognized text annotation "${a.contents||'(no extractable text)'}". Review manually.`);
 return {records:records.filter(r=>!r.excluded),excluded:records.filter(r=>r.excluded),annotations,warnings,gradeOverride:activeGrade,stats:{pages:pages.length,rows:records.length,excluded:records.filter(r=>r.excluded).length}};
}
function sectionName(text){
 let t=clean(text).replace(/^COMMENT\s*/i,'').replace(/^L\d+(?:D\d+)?\s*(?:EAST|WEST)?\s*[-–]?\s*/i,'');
 if(/RIM\s+AND\s+BLOCKING/i.test(t)||/BLOCKING/i.test(t)&&!/UNIT/i.test(t))return 'Rim and blockings';
 const m=t.match(/UNIT\s+(\d{3})(\s*\+\s*STAIRS?)?/i);if(m)return m[1]+(m[2]?' + stairs':'');
 const n=t.match(/\b(\d{3})\s*\+\s*STAIR/i);if(n)return n[1]+' + stairs';
 return null;
}
function descOf(line){return clean(line.tokens.filter(t=>t.x>=126&&t.x<322).map(t=>t.text).join(' '));}
export function parseSpruce(pages){
 const records=[],warnings=[];let section='Unspecified section',active=null,level='';
 const flush=()=>{
  if(!active)return;
  active.description=clean(active.description);
  active.cuts=cutsFromDescription(active.description);
  active.spec=productSpec(active.description);
  if(!active.spec){active=null;return;}
  if(!active.spec.key)active.notes.push('Unrecognized product specification.');
  if(active.um==='LF'){
   const total=active.cuts.reduce((sum,c)=>sum+c.qty*c.length,0);
   if(!active.cuts.length)active.notes.push('Missing or unreadable cut-length description.');
   else if(Math.abs(total-active.ordered)>0.05)active.notes.push(`Cut breakdown totals ${total} LF, but Ordered is ${active.ordered} LF.`);
  }
  if(active.um==='PC'){
   // Standard Spruce rim code suffix 16 or explicit 16' in description.
   const match=active.description.match(/\b(\d+(?:\.\d+)?)\s*'\s*(?:TIMBERSTRAND|LSL|PARALLAM|PSL)/i);
   active.stockLength=match?Number(match[1]):(/16$/.test(active.code)?16:null);
   if(active.stockLength===null)active.notes.push('Stock length not identified.');
  }
  // PDF repeats an identical last item at next-page top in some Spruce prints.
  const last=records[records.length-1];
  if(last&&last.page===active.page-1&&active.isFirstOnPage&&last.code===active.code&&last.section===active.section&&last.ordered===active.ordered&&last.um===active.um&&clean(last.description)===active.description){
   warnings.push(`Spruce page ${active.page}: repeated continuation row ${active.code} excluded to avoid double-counting.`);
  }else records.push(active);
  active=null;
 };
 for(const page of pages){let firstMaterial=true;
  const lines=page.lines||[];if(!lines.length)warnings.push(`Spruce p.${page.page}: no selectable text; page may be scanned.`);
  for(const line of lines){
   const y=line.y;if(y<295||y>630)continue;
   const c=clean(line.tokens.filter(t=>t.x>=18&&t.x<117).map(t=>t.text).join(' '));
   const d=descOf(line);
   if(/^COMMENT\b/i.test(c)){
    flush();const n=sectionName(d);
    if(n)section=n;
    else if(/^L\d/i.test(d))level=d;
    continue;
   }
   if(/^AB$/.test(c)||/^ZONE|^FUEL/.test(c)){flush();continue;}
   if(/^(?:TJI\d+|PSL\d+|LSL\w+)$/i.test(c)){
    flush();const qtyText=clean(line.tokens.filter(t=>t.x>=320&&t.x<370).map(t=>t.text).join(' '));
    const ordered=Number(qtyText.replace(/,/g,''));
    const um=clean(line.tokens.filter(t=>t.x>=418&&t.x<445).map(t=>t.text).join(' ')).split(' ')[0].toUpperCase();
    if(!Number.isFinite(ordered)||ordered<=0||!['LF','PC'].includes(um)){warnings.push(`Spruce p.${page.page}: cannot safely read Ordered/UM for ${c}.`);continue;}
    active={source:'Spruce',page:page.page,y,code:c,section,level,description:d,ordered,um,notes:[],isFirstOnPage:firstMaterial};firstMaterial=false;
   }else if(c&&/^[A-Z][A-Z0-9/.-]{2,20}$/i.test(c)&&!['ITEM','DESCRIPTION','REMAIN','SOLD','ORDERED','ELIGIBLE','SUBTOTAL','PAYMENT'].includes(c.toUpperCase())){
    flush();warnings.push(`Spruce p.${page.page}: unrecognized order item code ${c}. Review this row.`);
   }else if(active&&d&&!(line.text||'').match(/(?:subtotal|sales tax|price|amount|eligible|signature|charge|payment)/i)){
    // Only description-column continuation, even when it crosses page breaks.
    active.description+=' '+d;
   }
  }
  // Preserve active record across pages when its cut list continues onto next page.
 }
 flush();
 return {records,warnings,stats:{pages:pages.length,rows:records.length}};
}
const aggregate=records=>{
 const groups=new Map();
 for(const r of records){if(r.spec===null)continue;
  const key=`${r.unit||r.section}|${r.spec?.key||r.spec?.label}`;
  if(!groups.has(key))groups.set(key,{key,section:r.unit||r.section,spec:r.spec,cut:new Map(),stock:[],total:0,items:[],notes:[]});
  const g=groups.get(key);g.items.push(r);g.notes.push(...r.notes);
  if(r.source==='Javelin'){
   g.cut.set(r.length,(g.cut.get(r.length)||0)+r.qty);g.total+=r.length*r.qty;
  }else if(r.um==='PC'){
   g.stock.push({length:r.stockLength,qty:r.ordered,page:r.page});g.total+=r.ordered*(r.stockLength||0);
  }else{for(const c of r.cuts)g.cut.set(c.length,(g.cut.get(c.length)||0)+c.qty);g.total+=r.ordered;}
 }
 return groups;
};
function lengthList(g){return [...(g?.cut||[])].sort((a,b)=>b[0]-a[0]).map(([len,qty])=>`${qty} × ${len}'`).join(', ')||'—';}
const near=(a,b)=>Math.abs(a-b)<.05;
function cutListsEqual(e,a){
 if(e.cut.size!==a.cut.size)return false;
 for(const [len,qty] of e.cut)if((a.cut.get(len)||0)!==qty)return false;
 return true;
}
function isStockSection(e,a){return /rim and blockings/i.test(e?.section||a?.section||'');}
function overlapStatus(e,a){
 if(!e||!a)return 'MISMATCH';
 const stockLF=a.stock.reduce((sum,x)=>sum+(x.length||0)*x.qty,0);
 // Even when Javelin includes a multi-ply entry, the unmultiplied Net Qty
 // provides a conservative minimum: fewer LF cannot satisfy that requirement.
 if(a.stock.length&&a.stock.every(x=>x.length)&&stockLF+.0001<e.total)return 'MISMATCH';
 if(isStockSection(e,a)&&!a.stock.length&&a.total+.0001<e.total)return 'MISMATCH';
 const uncertain=e.notes.some(n=>/ambiguous|could not|multi-ply/i.test(n))||a.notes.some(n=>/unreadable|missing|could not|unrecognized|totals/i.test(n));
 if(uncertain)return 'REVIEW';
 if(a.stock.length){
  if(a.stock.some(x=>!x.length))return 'REVIEW';
  return 'REVIEW'; // A gross stock allowance isn't proof of a viable cutting layout.
 }
 if(cutListsEqual(e,a)&&near(e.total,a.total))return 'MATCH';
 // In Rim/Blockings, 16-ft material can be ordered as cutting stock. Extra LF
 // is not an exact cut match, but could be deliberate purchasing allowance.
 if(isStockSection(e,a)&&a.cut.has(16)&&a.total+0.0001>=e.total)return 'REVIEW';
 return 'MISMATCH';
}
export function compareMaterials(javelin,spruce,manualChanges=[]){
 // User-approved manual changes are session-only, never persisted or written to Supabase.
 const changes=new Map(manualChanges.map(x=>[x.recordId,x]));
 const candidates=[...javelin.records,...javelin.excluded.filter(r=>changes.get(`${r.page}|${r.y}|${r.plot}`)?.action==='include')];
 const eRows=candidates.map(r=>{
  const id=`${r.page}|${r.y}|${r.plot}`;const c=changes.get(id);
  if(!c)return r;
  if(c.action==='exclude')return null;
  const copy={...r,notes:[...r.notes,`Manual override: ${c.reason||'user-reviewed'}`]};
  if(c.grade&&copy.spec?.type==='TJI'){copy.spec={...copy.spec,grade:c.grade,key:`TJI|${c.grade}|${normNum(c.grade==='560'?3.5:2+5/16)}|${normNum(copy.spec.depth)}`};}
  if(c.quantity!=null&&Number.isSafeInteger(Number(c.quantity))&&Number(c.quantity)>=0)copy.qty=Number(c.quantity);
  return copy;
 }).filter(Boolean);
 const expected=aggregate(eRows),actual=aggregate(spruce.records);
 const allKeys=new Set([...expected.keys(),...actual.keys()]);const details=[];
 for(const key of allKeys){
  const e=expected.get(key),a=actual.get(key),status=overlapStatus(e,a);
  let reason='Exact product and cut lengths agree.';
  if(!e)reason='Extra material in Spruce (not found in Javelin).';
  else if(!a)reason='Material missing from Spruce.';
  else if(a.stock.length){const stockLF=a.stock.reduce((s,x)=>s+(x.length||0)*x.qty,0);reason=stockLF<e.total?`Definite minimum-stock shortage: requires at least ${e.total} LF, ordered ${stockLF} LF (before kerf).`:`Stock substitution: ${stockLF} LF ordered vs ${e.total} LF required. Cutting feasibility and waste need confirmation.`;}
  else if(isStockSection(e,a)&&status==='REVIEW'&&!cutListsEqual(e,a))reason=`Rim/blocking stock allowance differs: ${a.total} LF ordered vs ${e.total} LF of finished cuts. Confirm the extra stock/cutting plan.`;
  else if(isStockSection(e,a)&&status==='MISMATCH'&&a.total<e.total)reason=`Definite shortage: ${e.total} LF of finished cuts required, ${a.total} LF ordered (before kerf).`;
  else if(status==='MISMATCH')reason='Different length/quantity breakdown or total LF.';
  else if(status==='REVIEW')reason='Uncertain specifications, quantity interpretation, or PDF extraction.';
  details.push({key,section:e?.section||a?.section,product:e?.spec?.label||a?.spec?.label,status,reason,expected:e?lengthList(e):'—',actual:a?(a.stock.length?a.stock.map(s=>`${s.qty} × ${s.length||'?'}' stock`).join(', '):lengthList(a)):'—',expectedLF:e?.total??0,actualLF:a?.total??0,javelinPages:e?.items.map(x=>x.page)||[],sprucePages:a?.items.map(x=>x.page)||[],notes:[...(e?.notes||[]),...(a?.notes||[])]});
 }
 const globalWarnings=[...javelin.warnings,...spruce.warnings];
 // Don't report a complete match if any parse/annotation warning is outstanding.
 const stats={match:details.filter(x=>x.status==='MATCH').length,mismatch:details.filter(x=>x.status==='MISMATCH').length,review:details.filter(x=>x.status==='REVIEW').length+globalWarnings.length};
 const overall=stats.mismatch?'MISMATCH':stats.review?'MANUAL REVIEW REQUIRED':'MATCH';
 return {details:details.sort((a,b)=>a.section.localeCompare(b.section,{numeric:true})||a.product.localeCompare(b.product)),warnings:globalWarnings,stats,overall,excluded:javelin.excluded,gradeOverride:javelin.gradeOverride};
}
