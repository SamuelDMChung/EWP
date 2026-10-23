import {consolidatePages,extractPdfPages,toTsv,combinedTsv,formatFeet} from './parser.mjs?v=1.19';
const $=id=>document.getElementById(id);
const current={result:null,pdf:null,library:null,busy:false};

function status(message,error=false){const node=$('materialStatus');node.textContent=message;node.classList.toggle('is-error',error);}
function setBusy(on){current.busy=on;$('materialParse').disabled=on||!current.pdf;$('materialPdfFile').disabled=on;$('materialReset').disabled=on;$('materialDropZone').classList.toggle('is-disabled',on);$('materialDropZone').setAttribute('aria-disabled',String(on));}
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
 const headers=['Product',...(isConnector?['Manufacturer']:[]),'Total',...(show?result.levels:[])];
 const tr=document.createElement('tr');
 for(const text of headers){const th=cell('th',text);th.scope='col';tr.append(th);}
 head.append(tr);
 const items=isConnector?result.connectors:result.lengths;
 if(!items.length){const empty=document.createElement('tr');const td=cell('td','No matching rows found');td.colSpan=headers.length;td.className='empty-row';empty.append(td);body.append(empty);return;}
 for(const item of items){
  const tr=document.createElement('tr');
  tr.append(cell('td',item.product));
  if(isConnector)tr.append(cell('td',item.manufacturers.join(' / ')));
  const total=cell('td',isConnector?item.quantity:formatFeet(item.inches));total.className='material-num material-total';tr.append(total);
  if(show)for(const level of result.levels){const td=cell('td',isConnector?(item.byLevel[level]||0):formatFeet(item.byLevel[level]||0));td.className='material-num';tr.append(td);}
  body.append(tr);
 }
}
function renderResult(){
 const result=current.result;$('materialOutput').hidden=!result;
 if(!result)return;
 $('materialStats').textContent=`${result.stats.pages} PDF pages · ${result.levels.length} framing level${result.levels.length===1?'':'s'} (${result.levels.join(', ')}) · ${result.connectors.length} connector types · ${result.lengths.length} total-length products`;
 const warn=$('materialWarnings');clearChildren(warn);warn.hidden=!result.warnings.length;
 for(const message of result.warnings)warn.append(cell('p',message));
 renderTable('connectors');renderTable('lengths');
}
async function copyText(value,label){
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
  else {const textarea=document.createElement('textarea');textarea.value=value;textarea.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(textarea);textarea.select();const copied=document.execCommand('copy');textarea.remove();if(!copied)throw new Error('Copy command was not supported.');}
  status(`${label} copied. Paste directly into Excel or a spreadsheet.`);
 }catch(e){status(`Could not copy automatically: ${e.message}. Try another browser.`,true);}
}
const zone=$('materialDropZone');
const fileInput=$('materialPdfFile');
function isValidPdf(file){return !!file && (/\.pdf$/i.test(file.name)||file.type==='application/pdf');}
function selectMaterialFile(file){
 if(current.busy)return;
 current.result=null;
 $('showMaterialBreakdown').checked=false;
 renderResult();
 current.pdf=null;
 if(!file){
   $('materialFileSelection').hidden=true;
   $('materialPdfName').textContent='';
   $('materialParse').disabled=true;
   status('');
   return;
 }
 if(!isValidPdf(file)){
   fileInput.value='';
   $('materialFileSelection').hidden=true;
   $('materialParse').disabled=true;
   status('Please choose one PDF document.',true);
   return;
 }
 if(file.size>200*1024*1024){
   fileInput.value='';
   $('materialFileSelection').hidden=true;
   $('materialParse').disabled=true;
   status('This PDF exceeds 200 MB. Split it into smaller reports before consolidating.',true);
   return;
 }
 current.pdf=file;
 $('materialPdfName').textContent=file.name;
 $('materialFileSelection').hidden=false;
 $('materialParse').disabled=false;
 status('PDF selected. Choose Consolidate to process all pages.');
}
fileInput.addEventListener('change',()=>selectMaterialFile(fileInput.files?.[0]||null));
zone.addEventListener('keydown',event=>{
 if(current.busy)return;
 if(event.key==='Enter'||event.key===' '){event.preventDefault();fileInput.click();}
});
let dragDepth=0;
function isFileDrag(event){return Array.from(event.dataTransfer?.types||[]).includes('Files');}
zone.addEventListener('dragenter',event=>{
 if(!isFileDrag(event))return;
 event.preventDefault();dragDepth++;
 if(!current.busy)zone.classList.add('is-dragover');
});
zone.addEventListener('dragover',event=>{
 if(!isFileDrag(event))return;
 event.preventDefault();
 if(event.dataTransfer)event.dataTransfer.dropEffect=current.busy?'none':'copy';
 if(!current.busy)zone.classList.add('is-dragover');
});
zone.addEventListener('dragleave',event=>{
 if(!isFileDrag(event))return;
 event.preventDefault();dragDepth=Math.max(0,dragDepth-1);
 if(!dragDepth)zone.classList.remove('is-dragover');
});
zone.addEventListener('drop',event=>{
 event.preventDefault();dragDepth=0;zone.classList.remove('is-dragover');
 if(current.busy)return;
 const files=Array.from(event.dataTransfer?.files||[]);
 if(files.length!==1){status('Please drop exactly one PDF file.',true);return;}
 fileInput.value=''; // Dropped File is tracked directly, not via FileList.
 selectMaterialFile(files[0]);
});
// Prevent a PDF accidentally dropped outside the zone from navigating away.
document.addEventListener('dragover',event=>{if(isFileDrag(event))event.preventDefault();});
document.addEventListener('drop',event=>{if(isFileDrag(event)){event.preventDefault();dragDepth=0;zone.classList.remove('is-dragover');}});
$('materialReset').addEventListener('click',()=>{
 fileInput.value='';zone.classList.remove('is-dragover');dragDepth=0;
 selectMaterialFile(null);
});
$('materialParse').addEventListener('click',async()=>{
 const file=current.pdf;if(!file||current.busy)return;
 if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'){status('Please choose a PDF document.',true);return;}
 if(file.size>200*1024*1024){status('This PDF exceeds 200 MB. Split it into smaller reports before consolidating.',true);return;}
 setBusy(true);current.result=null;renderResult();
 try{
  status('Loading PDF reader…');const lib=await loadPdfJs();
  const pages=await extractPdfPages(file,lib,(i,n)=>status(`Reading page ${i} of ${n}…`));
  const result=consolidatePages(pages);
  if(!result.connectors.length&&!result.lengths.length)throw new Error('No readable Framing Connector Summary or Total Lengths rows were found. This tool requires a selectable-text material report (scanned PDFs are not supported).');
  current.result=result;renderResult();status(`Finished processing ${result.stats.pages} pages. Review the tables and use Copy to paste them into Excel.`);
 }catch(e){status(`Could not consolidate PDF: ${e?.message||'Unknown error'}`,true);}
 finally{setBusy(false);}
});
$('showMaterialBreakdown').addEventListener('change',()=>{renderTable('connectors');renderTable('lengths');});
$('copyMaterialConnectors').addEventListener('click',()=>current.result&&copyText(toTsv(current.result.connectors,current.result.levels,'connectors',$('showMaterialBreakdown').checked),'Connector summary'));
$('copyMaterialLengths').addEventListener('click',()=>current.result&&copyText(toTsv(current.result.lengths,current.result.levels,'lengths',$('showMaterialBreakdown').checked),'Total lengths'));
$('copyMaterialAll').addEventListener('click',()=>current.result&&copyText(combinedTsv(current.result,$('showMaterialBreakdown').checked),'Both tables'));
