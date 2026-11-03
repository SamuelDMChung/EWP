import {downloadMaterialPdf} from './export-pdf.mjs?v=1.29';
import {consolidatePages,extractPdfPages,toTsv,combinedTsv,toEmailHtml,combinedEmailHtml,formatFeet} from './parser.mjs?v=1.29';
import {mergeMaterialResults,overlappingRevision,projectFromPages} from './multi-file.mjs?v=1.29';
const $=id=>document.getElementById(id);
const current={result:null,entries:[],library:null,processing:false,exporting:false,nextId:1};

function status(message,error=false){const node=$('materialStatus');node.textContent=message;node.classList.toggle('is-error',error);}
async function loadPdfJs(){
 if(current.library)return current.library;
 const candidates=[
  {lib:'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.min.mjs',worker:'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs'},
  {lib:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.min.mjs',worker:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.worker.min.mjs'}
 ];
 let last;
 for(const {lib,worker} of candidates){try{const pdf=await import(lib);pdf.GlobalWorkerOptions.workerSrc=worker;current.library=pdf;return pdf;}catch(e){last=e;}}
 throw new Error(`Unable to load PDF reader. Check your Internet connection. ${last?.message||''}`);
}
function clearChildren(target){target.replaceChildren();}
function cell(tag,text){const n=document.createElement(tag);n.textContent=String(text);return n;}
function renderTable(kind){
 const result=current.result;if(!result)return;
 const isConnector=kind==='connectors';
 const show=$('showMaterialBreakdown').checked,head=$(isConnector?'materialConnectorsHead':'materialLengthsHead'),body=$(isConnector?'materialConnectorsBody':'materialLengthsBody');
 clearChildren(head);clearChildren(body);
 const headers=['Product','Total',...(show?result.levels:[])];
 head.closest('table')?.classList.toggle('has-breakdown',show);
 const tr=document.createElement('tr');
 for(const text of headers){const th=cell('th',text);th.scope='col';tr.append(th);}
 head.append(tr);
 const items=isConnector?result.connectors:result.lengths;
 if(!items.length){const empty=document.createElement('tr');const td=cell('td','No matching rows found');td.colSpan=headers.length;td.className='empty-row';empty.append(td);body.append(empty);return;}
 for(const item of items){
  const tr=document.createElement('tr');
  tr.append(cell('td',item.product));
  const total=cell('td',isConnector?item.quantity:formatFeet(item.inches));total.className='material-num material-total';tr.append(total);
  if(show)for(const level of result.levels){const td=cell('td',isConnector?(item.byLevel[level]||0):formatFeet(item.byLevel[level]||0));td.className='material-num';tr.append(td);}
  body.append(tr);
 }
}
function renderResult(){
 const result=current.result;$('materialOutput').hidden=!result;
 if(!result)return;
 $('materialStats').textContent=`${result.stats.files} PDF${result.stats.files===1?'':'s'} · ${result.stats.pages} pages · ${result.levels.length} framing level${result.levels.length===1?'':'s'} (${result.levels.join(', ')}) · ${result.connectors.length} connector types · ${result.lengths.length} total-length products`;
 const warn=$('materialWarnings');clearChildren(warn);warn.hidden=!result.warnings.length;
 for(const message of result.warnings)warn.append(cell('p',message));
 renderTable('connectors');renderTable('lengths');
}
async function copyText(value,label){
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
  else {const textarea=document.createElement('textarea');textarea.value=value;textarea.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(textarea);textarea.select();const copied=document.execCommand('copy');textarea.remove();if(!copied)throw new Error('Copy command was not supported.');}
  status(`${label} copied for Excel. Paste into a spreadsheet.`);
 }catch(e){status(`Could not copy automatically: ${e.message}. Try another browser.`,true);}
}
// ClipboardItem writes both rich HTML (for Outlook/webmail) and a plain-text
// representation (for applications that prefer it). For older browsers use a
// selected HTML fragment with execCommand, then fall back to plain text with
// a truthful notice if rich formatting is not supported.
async function copyForEmail(html,plain,label){
  if(!current.result)return;
  let richCopied=false;
  let lastError;
  if(navigator.clipboard?.write && typeof ClipboardItem!=='undefined'){
    try{
      const richItem=new ClipboardItem({
        'text/html':new Blob([html],{type:'text/html'}),
        'text/plain':new Blob([plain],{type:'text/plain'})
      });
      await navigator.clipboard.write([richItem]);
      richCopied=true;
    }catch(error){lastError=error;}
  }
  if(!richCopied && typeof document.execCommand==='function' && typeof window.getSelection==='function'){
    const holder=document.createElement('div');
    holder.innerHTML=html;
    holder.style.cssText='position:fixed;left:-10000px;top:0;pointer-events:none;';
    document.body.append(holder);
    const selection=window.getSelection(),range=document.createRange();
    const previous=[];
    if(selection)for(let i=0;i<selection.rangeCount;i++)previous.push(selection.getRangeAt(i));
    try{
      range.selectNodeContents(holder);
      selection.removeAllRanges();selection.addRange(range);
      richCopied=!!document.execCommand('copy');
    }catch(error){lastError=error;}
    finally{
      selection?.removeAllRanges();
      for(const prior of previous)selection?.addRange(prior);
      holder.remove();
    }
  }
  if(richCopied){status(`${label} copied as a formatted table. Paste into your email body.`);return;}
  // A fallback still lets the user copy quantities without claiming borders.
  try{
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(plain);}
    else throw (lastError || new Error('Rich-text clipboard is unavailable.'));
    status(`${label} copied as plain text only. Your browser did not allow a formatted email table.`,true);
  }catch(error){status(`Could not copy ${label.toLowerCase()}: ${error?.message || 'Clipboard access denied'}.`,true);}
}
const zone=$('materialDropZone');
const fileInput=$('materialPdfFile');
const MAX_PDF_BYTES=200*1024*1024;
function isValidPdf(file){return !!file && (/\.pdf$/i.test(file.name)||file.type==='application/pdf');}
function makeButton(label,action,cssClass='tool-button'){
 const button=document.createElement('button');button.type='button';button.className=cssClass;button.textContent=label;button.addEventListener('click',action);return button;
}
function appendMiniTable(container,label,items,kind,levels){
 const title=document.createElement('h4');title.textContent=label;container.append(title);
 const scroll=document.createElement('div');scroll.className='material-mini-scroll';
 const table=document.createElement('table');table.className='material-mini-table';
 const head=document.createElement('thead'),body=document.createElement('tbody');
 const showLevels=$('showMaterialBreakdown').checked;
 const headings=['Product','Total',...(showLevels?levels:[])];
 const tr=document.createElement('tr');for(const h of headings)tr.append(cell('th',h));head.append(tr);
 for(const item of items){
  const row=document.createElement('tr');row.append(cell('td',item.product));
  row.append(cell('td',kind==='connectors'?item.quantity:formatFeet(item.inches)));
  if(showLevels)for(const level of levels)row.append(cell('td',kind==='connectors'?(item.byLevel[level]||0):formatFeet(item.byLevel[level]||0)));
  body.append(row);
 }
 if(!items.length){const row=document.createElement('tr'),td=cell('td','No matching rows');td.colSpan=headings.length;row.append(td);body.append(row);}
 table.append(head,body);scroll.append(table);container.append(scroll);
}
function renderFileList(){
 const parent=$('materialFileList'),openIds=new Set([...parent.querySelectorAll('details[open]')].map(n=>n.dataset.fileId));
 clearChildren(parent);
 $('materialFileCount').textContent=`(${current.entries.length})`;
 $('materialReset').disabled=current.entries.length===0;
 if(!current.entries.length){const li=cell('li','No PDFs added yet.');li.className='material-file-empty';parent.append(li);return;}
 for(const entry of current.entries){
  const li=document.createElement('li');li.className='material-file-row';li.dataset.fileId=entry.id;
  const info=document.createElement('div');info.className='material-file-info';
  const heading=cell('strong',entry.name);heading.className='material-file-name';info.append(heading);
  const state=document.createElement('div');state.className='material-file-state';
  const names={queued:'Queued',processing:'Processing',ready:'Included in totals',review:'Review before including',duplicate:'Duplicate excluded',error:'Processing failed'};
  state.append(cell('span',names[entry.status]||entry.status));
  if(entry.status==='processing'&&entry.progress)state.append(cell('span',` · ${entry.progress}`));
  if(entry.status==='ready'&&entry.parsed)state.append(cell('span',` · ${entry.parsed.stats.pages} pages · ${entry.parsed.connectors.length} connector types · ${entry.parsed.lengths.length} length products`));
  if(entry.status==='review')state.append(cell('span',` · ${entry.warning}`));
  if(entry.status==='duplicate'||entry.status==='error')state.append(cell('span',` · ${entry.warning}`));
  if(entry.status==='ready'&&entry.warning)state.append(cell('span',` · ${entry.warning}`));
  info.append(state);li.append(info);
  const actions=document.createElement('div');actions.className='material-file-actions';
  if(entry.status==='review')actions.append(makeButton('Include anyway',()=>includeReviewed(entry.id)));
  if(entry.status==='error'&&entry.file)actions.append(makeButton('Retry',()=>retryFile(entry.id)));
  actions.append(makeButton('Remove',()=>removeFile(entry.id),'tool-button material-remove-button'));
  li.append(actions);
  if(entry.parsed){
   const details=document.createElement('details');details.className='material-file-breakdown';details.dataset.fileId=String(entry.id);
   if(openIds.has(String(entry.id)))details.open=true;
   const summary=document.createElement('summary');summary.textContent='View this PDF’s materials';details.append(summary);
   const data=document.createElement('div');data.className='material-file-breakdown-inner';
   appendMiniTable(data,'Framing Connector Summary',entry.parsed.connectors,'connectors',entry.parsed.levels);
   appendMiniTable(data,'Total Lengths',entry.parsed.lengths,'lengths',entry.parsed.levels);
   details.append(data);li.append(details);
  }
  parent.append(li);
 }
}
function refreshTotals(){current.result=mergeMaterialResults(current.entries);renderResult();renderFileList();}
function includeReviewed(id){
 const entry=current.entries.find(item=>item.id===id&&item.status==='review');if(!entry)return;
 entry.status='ready';entry.warning=`Overlap accepted: ${entry.warning}`;
 refreshTotals();status(`${entry.name} included. Combined results updated.`);
}
function removeFile(id){
 const entry=current.entries.find(item=>item.id===id);if(!entry)return;
 entry.controller?.abort();current.entries=current.entries.filter(item=>item.id!==id);
 refreshTotals();status(`Removed ${entry.name}. Combined results updated.`);
}
function retryFile(id){
 const entry=current.entries.find(item=>item.id===id&&item.status==='error'&&item.file);if(!entry)return;
 entry.status='queued';entry.warning='';entry.progress='';entry.controller=null;
 renderFileList();void runQueue();
}
async function fingerprint(file){
 if(!globalThis.crypto?.subtle)throw new Error('Secure browser hashing is unavailable. Open the app over HTTPS to check for duplicate PDFs.');
 const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function addFiles(files){
 const added=[],rejected=[];
 for(const file of files){
  if(!isValidPdf(file)){rejected.push(`${file.name||'Unnamed file'} is not a PDF`);continue;}
  if(file.size>MAX_PDF_BYTES){rejected.push(`${file.name} exceeds the 200 MB per-file limit`);continue;}
  const entry={id:current.nextId++,name:file.name,size:file.size,file,status:'queued',parsed:null,fingerprint:null,controller:null,warning:'',progress:'',projectId:''};
  current.entries.push(entry);added.push(entry);
 }
 renderFileList();
 if(rejected.length)status(`${added.length} PDF${added.length===1?'':'s'} added; ${rejected.join('; ')}.`,true);
 else if(added.length)status(`${added.length} PDF${added.length===1?'':'s'} queued for automatic consolidation.`);
 if(added.length)void runQueue();
}
async function processEntry(entry){
 const controller=new AbortController();entry.controller=controller;
 entry.status='processing';entry.progress='Checking for duplicates';renderFileList();
 const isGone=()=>controller.signal.aborted||!current.entries.includes(entry);
 try{
  const hash=entry.fingerprint||await fingerprint(entry.file);
  if(isGone())return;
  entry.fingerprint=hash;
  const matched=current.entries.find(other=>other!==entry&&other.fingerprint===hash&&other.status!=='duplicate'&&other.status!=='error');
  if(matched){entry.status='duplicate';entry.warning=`Identical contents to ${matched.name}; excluded to prevent double-counting.`;entry.file=null;return;}
  entry.progress='Loading PDF reader';renderFileList();
  const pdf=await loadPdfJs();if(isGone())return;
  const pages=await extractPdfPages(entry.file,pdf,(i,n)=>{
   entry.progress=`Page ${i} of ${n}`;
   // Progress is live without rebuilding other report summaries.
   const progress=document.querySelector(`[data-file-id="${entry.id}"] .material-file-state`);
   if(progress)progress.textContent=`Processing · ${entry.progress}`;
  },controller.signal);
  if(isGone())return;
  const parsed=consolidatePages(pages);
  if(!parsed.connectors.length&&!parsed.lengths.length)throw new Error('No readable Framing Connector Summary or Total Lengths rows. Selectable-text material reports are required.');
  entry.parsed=parsed;entry.projectId=projectFromPages(pages);
  const conflict=overlappingRevision(entry,current.entries);
  if(conflict){entry.status='review';entry.warning=`${conflict.reason==='project'?'Same project as':'Same filename as'} ${conflict.name}; overlapping level(s): ${conflict.levels.join(', ')}.`;}
  else entry.status='ready';
  entry.file=null; // Keep only parsed material summaries, never the original PDF bytes.
 }catch(error){
  if(isGone()||error?.name==='AbortError')return;
  entry.status='error';entry.warning=error?.message||'Unknown PDF processing error';
 }finally{
  entry.controller=null;entry.progress='';refreshTotals();
 }
}
async function runQueue(){
 if(current.processing)return;
 current.processing=true;
 try{
  for(;;){
   const next=current.entries.find(item=>item.status==='queued');
   if(!next)break;
   await processEntry(next);
  }
 }finally{
  current.processing=false;refreshTotals();
  const entries=current.entries;
  const included=entries.filter(e=>e.status==='ready').length;
  const reviews=entries.filter(e=>e.status==='review').length;
  const failed=entries.filter(e=>e.status==='error').length;
  const duplicate=entries.filter(e=>e.status==='duplicate').length;
  if(entries.length)status(`${included} PDF${included===1?'':'s'} included in live totals${reviews?` · ${reviews} awaiting revision review`:''}${duplicate?` · ${duplicate} duplicate${duplicate===1?'':'s'} excluded`:''}${failed?` · ${failed} failed`:''}.`,failed>0);
 }
}
fileInput.addEventListener('change',()=>{const selected=[...(fileInput.files||[])];fileInput.value='';addFiles(selected);});
zone.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();fileInput.click();}});
let dragDepth=0;
function isFileDrag(event){return Array.from(event.dataTransfer?.types||[]).includes('Files');}
zone.addEventListener('dragenter',event=>{if(!isFileDrag(event))return;event.preventDefault();dragDepth++;zone.classList.add('is-dragover');});
zone.addEventListener('dragover',event=>{if(!isFileDrag(event))return;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';zone.classList.add('is-dragover');});
zone.addEventListener('dragleave',event=>{if(!isFileDrag(event))return;event.preventDefault();dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)zone.classList.remove('is-dragover');});
zone.addEventListener('drop',event=>{event.preventDefault();dragDepth=0;zone.classList.remove('is-dragover');addFiles([...(event.dataTransfer?.files||[])]);});
document.addEventListener('dragover',event=>{if(isFileDrag(event))event.preventDefault();});
document.addEventListener('drop',event=>{if(isFileDrag(event)){event.preventDefault();dragDepth=0;zone.classList.remove('is-dragover');}});
$('materialReset').addEventListener('click',()=>{
 for(const entry of current.entries)entry.controller?.abort();
 current.entries=[];fileInput.value='';dragDepth=0;zone.classList.remove('is-dragover');
 $('showMaterialBreakdown').checked=false;refreshTotals();status('All PDFs removed.');
});
$('showMaterialBreakdown').addEventListener('change',()=>{renderTable('connectors');renderTable('lengths');renderFileList();});
function selectedBreakdown(){return $('showMaterialBreakdown').checked;}
$('copyMaterialConnectorsEmail').addEventListener('click',()=>current.result&&copyForEmail(toEmailHtml(current.result.connectors,current.result.levels,'connectors',selectedBreakdown()),toTsv(current.result.connectors,current.result.levels,'connectors',selectedBreakdown()),'Connector summary'));
$('copyMaterialConnectorsExcel').addEventListener('click',()=>current.result&&copyText(toTsv(current.result.connectors,current.result.levels,'connectors',selectedBreakdown()),'Connector summary'));
$('copyMaterialLengthsEmail').addEventListener('click',()=>current.result&&copyForEmail(toEmailHtml(current.result.lengths,current.result.levels,'lengths',selectedBreakdown()),toTsv(current.result.lengths,current.result.levels,'lengths',selectedBreakdown()),'Total lengths'));
$('copyMaterialLengthsExcel').addEventListener('click',()=>current.result&&copyText(toTsv(current.result.lengths,current.result.levels,'lengths',selectedBreakdown()),'Total lengths'));
$('copyMaterialAllEmail').addEventListener('click',()=>current.result&&copyForEmail(combinedEmailHtml(current.result,selectedBreakdown()),combinedTsv(current.result,selectedBreakdown()),'Both tables'));
$('copyMaterialAllExcel').addEventListener('click',()=>current.result&&copyText(combinedTsv(current.result,selectedBreakdown()),'Both tables'));

$('downloadMaterialAllPdf').addEventListener('click',async()=>{
 if(!current.result||current.exporting)return;
 const button=$('downloadMaterialAllPdf');button.disabled=true;current.exporting=true;
 try{
  status('Preparing your combined PDF…');
  const exported=await downloadMaterialPdf(current.result,selectedBreakdown(),current.entries.filter(e=>e.status==='ready').length===1?current.entries.find(e=>e.status==='ready').name:'Combined_Material_Lists');
  status(`Downloaded combined material summary (${exported.pages} PDF page${exported.pages===1?'':'s'}).`);
 }catch(error){status(`Could not download PDF: ${error?.message||'Unknown error'}`,true);}
 finally{button.disabled=false;current.exporting=false;}
});

renderFileList();
