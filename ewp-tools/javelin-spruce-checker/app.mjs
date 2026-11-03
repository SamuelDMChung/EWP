import {pdfLinesFromItems,pdfAnnotations,parseJavelin,parseSpruce,compareMaterials,classifyPdfPages} from './logic.mjs?v=1.31';
const $=id=>document.getElementById(id);
const state={pdfjs:null,jFile:null,sFile:null,j:null,s:null,result:null,overrides:[],jUrl:null,sUrl:null,jEntry:null,sEntry:null,generation:0,queue:Promise.resolve(),entries:[],nextId:1};
const MAX_BYTES=200*1024*1024;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const basename=file=>file?.name||'Not selected';
function setStatus(message,error=false){$('checkerStatus').textContent=message;$('checkerStatus').classList.toggle('is-error',error);}
async function getPdfJs(){
 if(state.pdfjs)return state.pdfjs;
 let last;
 for(const item of [
  ['https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.min.mjs','https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs'],
  ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.min.mjs','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.worker.min.mjs']]){
  try{const lib=await import(item[0]);lib.GlobalWorkerOptions.workerSrc=item[1];state.pdfjs=lib;return lib;}catch(error){last=error;}
 }
 throw Error(`PDF reader could not load. Check internet/CDN access: ${last?.message||'unknown error'}`);
}
async function readPdfPages(entry,generation){
 const file=entry.file,lib=await getPdfJs(),buf=await file.arrayBuffer();
 if(generation!==state.generation||entry.cancelled)return null;
 const task=lib.getDocument({data:new Uint8Array(buf),useSystemFonts:true});
 try{
  const pdf=await task.promise,pages=[];
  if(pdf.numPages>500)throw Error('Too many pages for one comparison (500 maximum).');
  for(let n=1;n<=pdf.numPages;n++){
   if(generation!==state.generation||entry.cancelled)return null;
   setStatus(`Reading ${file.name}, page ${n} of ${pdf.numPages}...`);
   const page=await pdf.getPage(n),viewport=page.getViewport({scale:1});
   const [text,anns]=await Promise.all([page.getTextContent(),page.getAnnotations({intent:'display'})]);
   pages.push({page:n,lines:pdfLinesFromItems(text.items,viewport.height),annotations:pdfAnnotations(anns,n,viewport)});
   page.cleanup?.();
  }
  return pages;
 }finally{try{await task.destroy();}catch{}}
}
function checkFile(file){if(!file||(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'))throw Error('Choose a PDF file.');if(file.size>MAX_BYTES)throw Error('PDF exceeds the 200 MB per-file limit.');}
function clearSlot(role){
 if(state[role+'Url'])URL.revokeObjectURL(state[role+'Url']);
 state[role+'Url']=null;state[role+'File']=null;state[role]=null;
 if(state[role+'Entry']){state[role+'Entry'].cancelled=true;state[role+'Entry'].status='removed';}
 state[role+'Entry']=null;state.result=null;state.overrides=[];
 $('checkerResults').hidden=true;
}
function renderFileSlots(){
 for(const [role,id,title] of [['j','jSlot','Javelin'],['s','sSlot','Spruce']]){
  const el=$(id),entry=state[role+'Entry'];el.replaceChildren();
  if(!entry){const span=document.createElement('span');span.className='small-hint';span.textContent=`No ${title} PDF selected`;el.append(span);continue;}
  const name=document.createElement('span');name.className='checker-slot-filename';name.textContent=entry.file.name;
  const detected=document.createElement('small');detected.textContent=entry.detectedBy==='manual'?'Manually assigned':'Automatically detected';
  const wrapper=document.createElement('div');wrapper.append(name,detected);el.append(wrapper);
  const button=document.createElement('button');button.type='button';button.className='tool-button';button.textContent='Remove';button.setAttribute('aria-label',`Remove ${title} PDF`);button.onclick=()=>removeEntry(entry);el.append(button);
 }
 const pending=$('checkerPending');pending.replaceChildren();
 for(const entry of state.entries.filter(e=>!e.cancelled&&e.status!=='included'&&e.status!=='removed'&&e.status!=='skipped')){
  const row=document.createElement('div');row.className='checker-file-slot';
  const box=document.createElement('div');box.className='checker-file-info';
  const title=document.createElement('strong');title.textContent=entry.file.name;box.append(title);
  const status=document.createElement('small');status.textContent=entry.status==='review'?'Document type unclear — choose below':entry.status==='failed'?`Could not read: ${entry.error}`:entry.status==='processing'?'Reading PDF...':'Queued';box.append(status);row.append(box);
  if(entry.status==='review'){
   const selection=document.createElement('select');selection.setAttribute('aria-label',`Choose document type for ${entry.file.name}`);
   for(const [value,label] of [['','Select type...'],['j','Javelin'],['s','Spruce']]){const opt=document.createElement('option');opt.value=value;opt.textContent=label;selection.append(opt);}
   const use=document.createElement('button');use.type='button';use.className='tool-button';use.textContent='Assign';use.onclick=()=>{if(selection.value)adoptEntry(entry,selection.value,'manual');};
   row.append(selection,use);
  }
  const remove=document.createElement('button');remove.type='button';remove.className='tool-button';remove.textContent='Remove';remove.onclick=()=>removeEntry(entry);row.append(remove);pending.append(row);
 }
 $('checkerPending').hidden=!pending.children.length;
}
function removeEntry(entry){
 entry.cancelled=true;entry.pages=null;entry.status='removed';
 if(state.jEntry===entry)clearSlot('j');
 if(state.sEntry===entry)clearSlot('s');
 state.entries=state.entries.filter(e=>e!==entry);renderFileSlots();
 if(!state.j||!state.s){$('checkerResults').hidden=true;setStatus('Add the missing PDF to compare.');}
}
function adoptEntry(entry,role,detectedBy){
 if(entry.cancelled||!entry.pages)return;
 let parsed;
 try{
  parsed=role==='j'?parseJavelin(entry.pages):parseSpruce(entry.pages);
  if(role==='j'&&!parsed.records.length&&!parsed.excluded.length)throw Error('No Javelin materials extracted. The PDF may be scanned or unsupported.');
  if(role==='s'&&!parsed.records.length)throw Error('No Spruce order materials extracted. Verify the PDF format.');
 }catch(error){entry.status='failed';entry.error=error.message;renderFileSlots();setStatus(error.message,true);return;}
 const other=state[role+'Entry'];
 if(other&&other!==entry){
  const label=role==='j'?'Javelin':'Spruce';
  if(!window.confirm(`A ${label} PDF is already selected. Replace ${other.file.name} with ${entry.file.name}?`)){
   entry.status='skipped';entry.cancelled=true;entry.pages=null;renderFileSlots();setStatus(`Kept existing ${label} PDF.`);return;
  }
  clearSlot(role);
 }
 try{
  state[role]=parsed;state[role+'File']=entry.file;state[role+'Entry']=entry;state[role+'Url']=URL.createObjectURL(entry.file);
  entry.role=role;entry.detectedBy=detectedBy;entry.status='included';entry.pages=null;
  state.overrides=[];renderFileSlots();
  if(state.j&&state.s){refresh();setStatus(`Compared ${state.j.stats.rows} Javelin rows with ${state.s.stats.rows} Spruce order lines.`);}
  else setStatus('Document identified. Add the other PDF to compare.');
 }catch(error){entry.status='failed';entry.error=error.message;renderFileSlots();setStatus(error.message,true);}
}
// Compare file bytes in bounded chunks, rather than guessing duplicate identity
// from filenames, timestamps or a potentially reused document number.
async function samePdfBytes(a,b){
 if(a.size!==b.size)return false;
 const chunk=1024*1024;
 for(let offset=0;offset<a.size;offset+=chunk){
  const end=Math.min(a.size,offset+chunk);
  const [left,right]=await Promise.all([a.slice(offset,end).arrayBuffer(),b.slice(offset,end).arrayBuffer()]);
  const x=new Uint8Array(left),y=new Uint8Array(right);
  for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;
 }
 return true;
}
async function processEntry(entry,generation){
 if(entry.cancelled||generation!==state.generation)return;
 entry.status='processing';renderFileSlots();
 try{
  for(const other of state.entries){
   if(other===entry||other.cancelled||other.status!=='included'||entry.file.size!==other.file.size)continue;
   if(await samePdfBytes(entry.file,other.file)){
    entry.status='skipped';entry.cancelled=true;renderFileSlots();
    setStatus(`${entry.file.name} is identical to an existing PDF; duplicate skipped.`,true);return;
   }
  }
  const pages=await readPdfPages(entry,generation);
  if(!pages||entry.cancelled||generation!==state.generation)return;
  entry.pages=pages;
  const result=classifyPdfPages(pages);
  if(!result.kind){entry.status='review';renderFileSlots();setStatus('Document type unclear: select Javelin or Spruce below.');return;}
  adoptEntry(entry,result.kind,'auto');
 }catch(error){if(generation!==state.generation||entry.cancelled)return;entry.status='failed';entry.error=error.message;renderFileSlots();setStatus(`Could not read ${entry.file.name}: ${error.message}`,true);}
}
function queueFiles(fileList){
 const files=[...fileList];if(!files.length)return;
 if(files.length>2){setStatus('Drop or choose a maximum of two PDFs at once.',true);return;}
 const generation=state.generation;const accepted=[];
 for(const file of files){
  try{checkFile(file);}catch(error){setStatus(error.message,true);continue;}
  const entry={id:state.nextId++,file,status:'queued',pages:null,cancelled:false};state.entries.push(entry);accepted.push(entry);
 }
 renderFileSlots();
 state.queue=state.queue.catch(()=>{}).then(async()=>{
  for(const entry of accepted)await processEntry(entry,generation);
 });
}
function badge(status){return `<span class="checker-tag" data-state="${esc(status)}">${esc(status==='REVIEW'?'MANUAL REVIEW':status)}</span>`;}
function pages(prefix,ns){return `${prefix} page${ns.length===1?'':'s'} ${[...new Set(ns)].join(', ')||'—'}`;}
function detailsHtml(d){return `<details class="checker-item" ${d.status==='MATCH'?'':'open'}>
 <summary><span>${esc(d.product)} · ${esc(d.section)}</span>${badge(d.status)}</summary>
 <p class="checker-reason">${esc(d.reason)}</p>
 <div class="checker-compare-grid"><div><h4>Expected — Javelin</h4><div>${esc(d.expected)}</div><p class="checker-evidence">${esc(pages('Javelin',d.javelinPages))} · ${d.expectedLF.toFixed(2)} LF</p></div><div><h4>Ordered — Spruce</h4><div>${esc(d.actual)}</div><p class="checker-evidence">${esc(pages('Spruce',d.sprucePages))} · ${d.actualLF.toFixed(2)} LF</p></div></div>
 ${d.notes.length?`<div class="checker-evidence">${d.notes.map(esc).join('<br>')}</div>`:''}</details>`;}
function renderDetails(){
 const filter=$('checkerFilter').value,query=$('checkerSearch').value.trim().toLowerCase();
 const items=state.result?.details.filter(d=>(filter==='all'||(filter==='issues'&&d.status!=='MATCH')||d.status===filter)&&(!query||`${d.section} ${d.product} ${d.reason}`.toLowerCase().includes(query)))||[];
 const container=$('checkerDetails');container.replaceChildren();let last='';
 if(!items.length){container.innerHTML='<p class="small-hint">No items in this view.</p>';return;}
 for(const d of items){
  if(d.section!==last){const h=document.createElement('h3');h.className='checker-section-title';h.textContent=d.section;container.append(h);last=d.section;}
  const holder=document.createElement('div');holder.innerHTML=detailsHtml(d);container.append(holder.firstElementChild);
 }
}
function overrideRowId(r){return `${r.page}|${r.y}|${r.plot}`;}
function renderCorrectionRows(){
 const out=$('checkerRows');out.replaceChildren();
 for(const r of [...state.j.records,...state.j.excluded]){
  const id=overrideRowId(r),isExcluded=state.j.excluded.includes(r),saved=state.overrides.find(c=>c.recordId===id);
  const row=document.createElement('div');row.className='checker-row';
  const info=document.createElement('span');info.innerHTML=`<strong>${esc(r.unit)} · ${esc(r.plot||'row')} · ${esc(r.spec?.label||r.description)}</strong><br><small>${esc(r.length)}′ · p.${r.page} · ${isExcluded?'Excluded by strikeout':'Included'} ${r.notes.length?' · '+esc(r.notes[0]):''}</small>`;row.append(info);
  const qty=document.createElement('input');qty.type='number';qty.min='0';qty.max='100000';qty.step='1';qty.value=saved?.quantity??r.qty;qty.setAttribute('aria-label',`Quantity of ${r.plot} on page ${r.page}`);row.append(qty);
  const grade=document.createElement('input');grade.placeholder='Grade';grade.value=saved?.grade??(r.spec?.type==='TJI'?r.spec.grade:'');grade.setAttribute('aria-label',`TJI grade of ${r.plot} on page ${r.page}`);grade.disabled=r.spec?.type!=='TJI';row.append(grade);
  const toggle=document.createElement('button');toggle.className='tool-button';toggle.type='button';let excluded=saved?.action==='exclude'||(isExcluded&&saved?.action!=='include');toggle.textContent=excluded?'Restore/include':'Exclude';toggle.onclick=()=>{excluded=!excluded;toggle.textContent=excluded?'Restore/include':'Exclude';toggle.dataset.exclude=excluded?'yes':'no';};toggle.dataset.exclude=excluded?'yes':'no';row.append(toggle);
  const apply=document.createElement('button');apply.type='button';apply.className='tool-primary';apply.textContent='Apply';apply.onclick=()=>{
   const value=Number(qty.value);if(!Number.isSafeInteger(value)||value<0||value>100000){setStatus('Enter a non-negative whole quantity.',true);return;}
   const g=grade.value.trim();if(!grade.disabled&&g&&!/^\d{2,4}$/.test(g)){setStatus('Enter a numeric TJI grade.',true);return;}
   const action=toggle.dataset.exclude==='yes'?'exclude':(isExcluded?'include':'keep');
   state.overrides=state.overrides.filter(x=>x.recordId!==id);
   state.overrides.push({recordId:id,action,quantity:value,grade:grade.disabled?'':g,reason:'User-adjusted Javelin source row'});
   refresh(false);setStatus(`Applied a session-only correction to ${r.plot} on Javelin page ${r.page}.`);
  };row.append(apply);out.append(row);
 }
}
function refresh(rebuildRows=true){
 if(!state.j||!state.s)return;
 state.result=compareMaterials(state.j,state.s,state.overrides);
 const r=state.result;$('checkerResults').hidden=false;
 $('checkerJView').href=state.jUrl+'#page=1';$('checkerSView').href=state.sUrl+'#page=1';
 $('checkerSourceNames').textContent=`Javelin: ${basename(state.jFile)} · Spruce: ${basename(state.sFile)}`;
 $('checkerMatches').textContent=r.stats.match;$('checkerMismatches').textContent=r.stats.mismatch;$('checkerReviews').textContent=r.stats.review;
 $('checkerOverall').textContent=`Overall: ${r.overall}${r.gradeOverride?` · level-wide TJI ${r.gradeOverride} instruction applied`:''}`;
 $('checkerOverall').dataset.state=r.overall;
 $('checkerStats').textContent=`${state.j.stats.rows} Javelin lines (${state.j.stats.excluded} crossed out) · ${state.s.stats.rows} Spruce lines · ${state.overrides.length} manual corrections · all web stiffeners and backer blocks excluded.`;
 const warnings=$('checkerWarnings');warnings.hidden=!r.warnings.length;warnings.replaceChildren();
 for(const w of r.warnings){const p=document.createElement('p');p.textContent='Review: '+w;warnings.append(p);}
 renderDetails();if(rebuildRows)renderCorrectionRows();
}
function reportHtml(){
 const r=state.result;const summary=`<h1>Javelin vs. Spruce Comparison</h1><p>${esc(basename(state.jFile))} vs. ${esc(basename(state.sFile))}</p><h2>${esc(r.overall)}</h2><p>Matches: ${r.stats.match} · Mismatches: ${r.stats.mismatch} · Unresolved reviews: ${r.stats.review}. User corrections: ${state.overrides.length}.</p>`;
 return `<!doctype html><html><head><meta charset="utf-8"><title>EWP Comparison Report</title><style>body{font:14px Arial;margin:30px;line-height:1.5;color:#242424}section{page-break-inside:avoid;border:1px solid #ccc;padding:12px;margin:10px 0}h3{margin:0}small{color:#555}</style></head><body>${summary}<p>Excluded: all web stiffeners and backer blocks. This is a review aid. Ambiguous or flattened annotations require human inspection.</p>${r.warnings.map(w=>`<p>REVIEW: ${esc(w)}</p>`).join('')}${r.details.map(d=>`<section><h3>${esc(d.status)} · ${esc(d.section)} · ${esc(d.product)}</h3><p>${esc(d.reason)}</p><p>Expected: ${esc(d.expected)} (${d.expectedLF} LF); Javelin p. ${d.javelinPages.join(', ')}</p><p>Ordered: ${esc(d.actual)} (${d.actualLF} LF); Spruce p. ${d.sprucePages.join(', ')}</p></section>`).join('')}</body></html>`;
}
$('checkerFilter').addEventListener('change',renderDetails);$('checkerSearch').addEventListener('input',renderDetails);
$('checkerReset').addEventListener('click',()=>{
 state.generation++;for(const entry of state.entries){entry.cancelled=true;entry.pages=null;}
 clearSlot('j');clearSlot('s');state.entries=[];state.overrides=[];
 $('checkerFiles').value='';$('checkerResults').hidden=true;renderFileSlots();setStatus('Drop both PDFs to begin.');
});
$('checkerDownload').addEventListener('click',()=>{if(!state.result)return;const url=URL.createObjectURL(new Blob([reportHtml()],{type:'text/html'}));const a=document.createElement('a');a.href=url;a.download='Javelin_Spruce_Comparison.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('checkerPrint').addEventListener('click',()=>window.print());
const input=$('checkerFiles'),zone=$('checkerDrop');
input.addEventListener('change',()=>{queueFiles(input.files);input.value='';});
zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click();}});
for(const event of ['dragenter','dragover'])zone.addEventListener(event,e=>{e.preventDefault();zone.classList.add('is-dragover');});
for(const event of ['dragleave','drop'])zone.addEventListener(event,e=>{e.preventDefault();zone.classList.remove('is-dragover');});
zone.addEventListener('drop',e=>queueFiles(e.dataTransfer?.files||[]));
renderFileSlots();
