import {pdfLinesFromItems,pdfAnnotations,parseJavelin,parseSpruce,compareMaterials} from './logic.mjs?v=1.30';
const $=id=>document.getElementById(id);
const state={pdfjs:null,jFile:null,sFile:null,j:null,s:null,result:null,overrides:[],sequence:0,jUrl:null,sUrl:null};
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
async function readPdf(file,kind,sequence){
 const lib=await getPdfJs(),buf=await file.arrayBuffer();
 if(sequence!==state.sequence)return null;
 const task=lib.getDocument({data:new Uint8Array(buf),useSystemFonts:true});
 try{
  const pdf=await task.promise, pages=[];
  if(pdf.numPages>500)throw Error('Too many pages for one comparison (500 maximum).');
  for(let n=1;n<=pdf.numPages;n++){
   if(sequence!==state.sequence)return null;
   setStatus(`Reading ${kind} PDF, page ${n} of ${pdf.numPages}...`);
   const page=await pdf.getPage(n),viewport=page.getViewport({scale:1});
   const [text,anns]=await Promise.all([page.getTextContent(),page.getAnnotations({intent:'display'})]);
   pages.push({page:n,lines:pdfLinesFromItems(text.items,viewport.height),annotations:pdfAnnotations(anns,n,viewport)});
   page.cleanup?.();
  }
  return kind==='Javelin'?parseJavelin(pages):parseSpruce(pages);
 }finally{try{await task.destroy();}catch{}}
}
function checkFile(file){if(!file||(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'))throw Error('Choose a PDF file.');if(file.size>MAX_BYTES)throw Error('PDF exceeds the 200 MB per-file limit.');}
async function setFile(kind,file){
 try{checkFile(file);}catch(e){setStatus(e.message,true);return;}
 const seq=++state.sequence;state.overrides=[];
 if(state[kind+'Url'])URL.revokeObjectURL(state[kind+'Url']);
 state[kind+'Url']=URL.createObjectURL(file);
 state[kind+'File']=file;state[kind]=null;
 $('jName').textContent=basename(state.jFile);$('sName').textContent=basename(state.sFile);
 $('checkerResults').hidden=true;
 try{
  if(state.jFile&&!state.j)state.j=await readPdf(state.jFile,'Javelin',seq);
  if(seq!==state.sequence)return;
  if(state.sFile&&!state.s)state.s=await readPdf(state.sFile,'Spruce',seq);
  if(seq!==state.sequence)return;
  if(state.j&&state.s){
   if(!state.j.records.length&&!state.j.excluded.length)throw Error('No Javelin materials extracted. The document may be scanned or use an unsupported layout.');
   if(!state.s.records.length)throw Error('No Spruce order materials extracted. Check that this is the correct PDF.');
   refresh();setStatus(`Compared ${state.j.stats.rows} Javelin source rows with ${state.s.stats.rows} Spruce order lines.`);
  }else setStatus('Add the other PDF to compare.');
 }catch(e){if(seq===state.sequence)setStatus(`Could not compare: ${e.message}`,true);}
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
$('checkerReset').addEventListener('click',()=>{state.sequence++;if(state.jUrl)URL.revokeObjectURL(state.jUrl);if(state.sUrl)URL.revokeObjectURL(state.sUrl);state.jUrl=state.sUrl=null;state.jFile=state.sFile=state.j=state.s=state.result=null;state.overrides=[];$('jFile').value='';$('sFile').value='';$('jName').textContent='No file selected';$('sName').textContent='No file selected';$('checkerResults').hidden=true;setStatus('Add the two matching PDFs to begin.');});
$('checkerDownload').addEventListener('click',()=>{if(!state.result)return;const url=URL.createObjectURL(new Blob([reportHtml()],{type:'text/html'}));const a=document.createElement('a');a.href=url;a.download='Javelin_Spruce_Comparison.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('checkerPrint').addEventListener('click',()=>window.print());
for(const [id,kind,drop] of [['jFile','j','jDrop'],['sFile','s','sDrop']]){
 const input=$(id),zone=$(drop);input.addEventListener('change',()=>{if(input.files[0])setFile(kind,input.files[0]);});
 zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click();}});
 for(const event of ['dragenter','dragover'])zone.addEventListener(event,e=>{e.preventDefault();zone.classList.add('is-dragover');});
 for(const event of ['dragleave','drop'])zone.addEventListener(event,e=>{e.preventDefault();zone.classList.remove('is-dragover');});
 zone.addEventListener('drop',e=>{if(e.dataTransfer?.files[0])setFile(kind,e.dataTransfer.files[0]);});
}
