/* V1.36 — Sales requests: existing Supabase requests, optional private small attachments, authenticated SharePoint File Request handoff. */
import { restoreSession,getAccessToken,getCurrentSession,signOut,EWP_AUTH_STORAGE_KEY } from '../forecast/auth.mjs?v=1.0-p3';
import { SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY } from '../forecast/config.mjs';
import { loadTrackerSettings } from '../tracker/cloud.mjs?v=1.12';
const $=id=>document.getElementById(id);
const ORIGIN=SUPABASE_URL.replace(/\/$/,'');
const BUCKET='ewp-sales-request-files';
const STORAGE=`${ORIGIN}/storage/v1`;
const REST=`${ORIGIN}/rest/v1`;
const FUNCTIONS=`${ORIGIN}/functions/v1`;
const MAX_FILE=10*1024*1024,MAX_TOTAL=30*1024*1024;
let currentSettings={sales:[],tasks:[],phases:[]};
let busy=false,authenticated=false;
function textStatus(message,kind=''){const el=$('salesFormMessage');el.textContent=message;el.className=`sales-message ${kind}`;}
function cloud(message,kind='connecting'){$('salesCloudPill').textContent=message;$('salesCloudPill').className=`cloud-pill ${kind}`;}
function switchTab(target){const history=target==='history';$('historyPanel').hidden=!history;$('newPanel').hidden=history;$('historyTab').classList.toggle('active',history);$('newTab').classList.toggle('active',!history);if(history)loadHistory().catch(e=>{cloud('Shared data error','error');$('salesHistory').textContent=e.message;});}
function fillSelect(id,values,placeholder){const el=$(id),old=el.value;el.replaceChildren(new Option(placeholder,''));for(const option of values||[])if(typeof option==='string'&&option.trim())el.add(new Option(option,option));if([...el.options].some(o=>o.value===old))el.value=old;}
function renderOptions(){
  fillSelect('salesPerson',currentSettings.sales,'Choose salesperson…');
  fillSelect('salesPhase',currentSettings.phases,'Choose phase…');
  const target=$('salesTaskChoices');const selected=new Set([...target.querySelectorAll('input:checked')].map(el=>el.value));target.replaceChildren();
  if(!currentSettings.tasks?.length){target.textContent='No tasks configured. Please add Tasks in Settings before submitting.';return;}
  for(const name of currentSettings.tasks){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.name='tasks';check.value=name;check.checked=selected.has(name);label.append(check,document.createTextNode(name));target.append(label);}
}
async function headers(json=false){const token=await getAccessToken();if(!token)throw new Error('Your session has expired. Sign in again.');return{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,...(json?{'Content-Type':'application/json'}:{})};}
async function parseResponse(response){const raw=await response.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}if(!response.ok)throw new Error(data?.message||data?.error||data?.msg||data?.details||`Request failed (${response.status}).`);return data;}
async function loadSettings(){currentSettings=await loadTrackerSettings();renderOptions();}
// Never embed the Microsoft file-request token in the public GitHub Pages source.
// The authenticated-only Supabase table is read-only to browser clients.
function sharePointStatus(message,kind=''){$('salesSharePointStatus').textContent=message;$('salesSharePointStatus').className=`sales-sharepoint-status ${kind}`;}
function validateSharePointUrl(value){try{const url=new URL(value);if(url.protocol!=='https:'||!(/(^|\.)sharepoint\.com$/i.test(url.hostname))||!url.pathname.startsWith('/:f:/'))return null;return url.href;}catch{return null;}}
async function loadSharePointLink(){
  const link=$('salesSharePointUpload');link.hidden=true;link.removeAttribute('href');
  sharePointStatus('Checking SharePoint upload access…');
  try{
    const response=await fetch(`${REST}/ewp_sales_file_request?select=upload_url&id=eq.new_ewp_requests&limit=1`,{headers:await headers(),cache:'no-store'});
    const rows=await parseResponse(response);const destination=validateSharePointUrl(rows?.[0]?.upload_url);
    if(!destination){sharePointStatus('SharePoint File Request not configured. Ask the portal administrator to complete the V1.36 Supabase setup.','error');return;}
    link.href=destination;link.hidden=false;
    sharePointStatus('Upload opens in a separate SharePoint tab. Return here afterward to submit your request.','success');
  }catch(error){sharePointStatus('SharePoint upload link unavailable. Requests and existing small-file attachments still work; ask the portal administrator to check setup.','error');}
}
function projectUploadLabel(){const form=$('salesRequestForm');return [form.elements.customer.value.trim(),form.elements.address.value.trim()].filter(Boolean).join(' - ');}
async function copyProjectLabel(){
  const label=projectUploadLabel();
  if(!label){sharePointStatus('Enter Customer and Project Name / Address first, then copy the label.','error');return;}
  try{await navigator.clipboard.writeText(label);sharePointStatus('Project label copied. Include it in the SharePoint file names before uploading.','success');}
  catch{sharePointStatus(`Could not copy automatically. Use this project label in your file names: ${label}`,'error');}
}
function safeFilename(filename){return String(filename).replace(/[^a-z0-9._-]/gi,'_').slice(0,90)||'attachment';}
function validateFiles(files){let total=0;for(const f of files){total+=f.size;if(f.size>MAX_FILE)throw new Error(`“${f.name}” exceeds 10 MB.`);if(!/\.(pdf|png|jpe?g)$/i.test(f.name)||!['application/pdf','image/png','image/jpeg'].includes(f.type))throw new Error(`“${f.name}” must be PDF, JPG or PNG.`);}if(total>MAX_TOTAL)throw new Error('All attachments together must be 30 MB or less.');}
async function uploadFiles(files,requestId,userId){const uploaded=[];for(const file of files){const path=`${userId}/${requestId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;const response=await fetch(`${STORAGE}/object/${BUCKET}/${path}`,{method:'POST',headers:{...await headers(), 'Content-Type':file.type,'x-upsert':'false'},body:file});await parseResponse(response);uploaded.push({name:file.name,path,size:file.size,type:file.type});}return uploaded;}
async function storeRequest(payload){const response=await fetch(`${REST}/sales_requests`,{method:'POST',headers:{...await headers(true),Prefer:'return=representation'},body:JSON.stringify(payload)});const rows=await parseResponse(response);if(!rows?.[0]?.id)throw new Error('The database did not confirm the saved request. Check Submission History before trying again.');return rows[0];}
async function notifyTeam(requestId){const response=await fetch(`${FUNCTIONS}/sales-request-email`,{method:'POST',headers:await headers(true),body:JSON.stringify({request_id:requestId})});return parseResponse(response);}
async function submit(event){
  event.preventDefault();if(busy)return;const form=$('salesRequestForm');textStatus('');
  if(!form.checkValidity()){form.reportValidity();return;}
  const selected=[...form.querySelectorAll('input[name="tasks"]:checked')].map(c=>c.value);
  if(!selected.length){textStatus('Select at least one Task.','error');return;}
  const sales=$('salesPerson').value,phase=$('salesPhase').value;
  if(!currentSettings.sales.includes(sales)||!currentSettings.phases.includes(phase)||selected.some(t=>!currentSettings.tasks.includes(t))){textStatus('A selected option has changed in Settings. Refresh and choose again.','error');return;}
  const files=[...$('salesFiles').files];try{validateFiles(files);}catch(e){textStatus(e.message,'error');return;}
  const sharePointConfirmed=$('salesSharePointConfirmed').checked;
  const sharePointNote='Plans uploaded to company SharePoint (confirmed by requester; separate from portal attachments).';
  const typedInstructions=form.elements.instructions.value.trim();
  const instructions=sharePointConfirmed?[typedInstructions,sharePointNote].filter(Boolean).join('\n\n'):typedInstructions;
  if(instructions.length>5000){textStatus('Please shorten Additional Instructions to leave room for the SharePoint upload confirmation.','error');return;}
  const user=getCurrentSession()?.user;
  if(!user?.id){textStatus('Sign in again before submitting.','error');return;}
  const requestId=crypto.randomUUID();busy=true;$('salesSubmit').disabled=true;
  let saved=false;
  try{
    textStatus(files.length?'Uploading private attachments…':'Saving your request…');
    const attachments=await uploadFiles(files,requestId,user.id);
    const row=await storeRequest({id:requestId,created_by:user.id,created_by_email:user.email||'',customer:form.elements.customer.value.trim(),address:form.elements.address.value.trim(),sales,phase,tasks:selected,due_date:form.elements.due_date.value,instructions,attachments,email_status:'pending'});
    saved=true;
    textStatus('Request saved. Notifying the design team…');
    try{
      const result=await notifyTeam(row.id);
      textStatus(result?.status==='sent'?`Request saved and email accepted for delivery to schung@griff.ca. Reference: ${row.id.slice(0,8).toUpperCase()}`:`Request saved. Email status: ${result?.status||'pending'}. View Submission History.`,result?.status==='sent'?'success':'');
    }catch(error){textStatus(`Request SAVED, but email is not yet confirmed: ${error.message}\nOpen Submission History to retry after email setup. Do not submit the request again.`,'error');}
    form.reset();
    await loadSettings().catch(()=>{});
  }catch(error){textStatus(`${error.message}${!saved&&files.length?' If uploads started, an unattached file may remain in private storage.':''}`,'error');}
  finally{busy=false;$('salesSubmit').disabled=false;}
}
async function signedDownload(path,tab){const response=await fetch(`${STORAGE}/object/sign/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',headers:await headers(true),body:JSON.stringify({expiresIn:300})});const data=await parseResponse(response);if(!data?.signedURL)throw new Error('Could not create a private download link.');const uri=data.signedURL.startsWith('http')?data.signedURL:`${STORAGE}${data.signedURL.startsWith('/object/')?'':'/object/'}${data.signedURL}`;if(tab){tab.location.replace(uri);}else{location.assign(uri);}}
function renderHistory(rows){const root=$('salesHistory');root.replaceChildren();if(!rows.length){root.textContent='No requests yet.';return;}
  for(const record of rows){const article=document.createElement('article');article.className='sales-history-card';
    const content=document.createElement('div');content.className='sales-history-detail';const title=document.createElement('h3');title.textContent=`${record.address} — ${record.customer}`;content.append(title);
    for(const detail of [`${record.sales} · ${record.phase} · Due ${record.due_date}`,`Tasks: ${(record.tasks||[]).join(', ')}`,`Submitted ${new Date(record.created_at).toLocaleString()} by ${record.created_by_email||'staff'}`,record.instructions?`Instructions: ${record.instructions}`:''])if(detail){const line=document.createElement('p');line.textContent=detail;content.append(line);}
    if(Array.isArray(record.attachments)&&record.attachments.length){const wrap=document.createElement('div');wrap.className='sales-history-files';for(const file of record.attachments){const btn=document.createElement('button');btn.type='button';btn.textContent=`📎 ${file.name}`;btn.addEventListener('click',()=>{const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;signedDownload(file.path,tab).catch(e=>{tab?.close();alert(e.message);});});wrap.append(btn);}content.append(wrap);}
    const meta=document.createElement('div');const state=document.createElement('div');state.className=`sales-email-state ${record.email_status||'pending'}`;state.textContent=record.email_status==='sent'?'Email sent':record.email_status==='failed'?'Email failed':record.email_status==='sending'?'Sending…':'Email queued';meta.append(state);
    if(record.email_status!=='sent'){const retry=document.createElement('button');retry.className='sales-retry';retry.type='button';retry.textContent='Retry email';retry.disabled=record.email_status==='sending';retry.addEventListener('click',async()=>{retry.disabled=true;try{const r=await notifyTeam(record.id);alert(r?.status==='sent'?'Email accepted for delivery.':`Status: ${r?.status||'pending'}`);}catch(e){alert(`Email not sent: ${e.message}`);}finally{await loadHistory();}});meta.append(retry);}
    article.append(content,meta);root.append(article);
  }
}
async function loadHistory(){const response=await fetch(`${REST}/sales_requests?select=id,created_at,created_by_email,customer,address,sales,phase,tasks,due_date,instructions,attachments,email_status&order=created_at.desc&limit=100`,{headers:await headers()});const rows=await parseResponse(response);renderHistory(rows||[]);cloud('Shared data connected','connected');}
async function refresh(){cloud('Connecting to shared data…');try{await loadSettings();if(!$('historyPanel').hidden)await loadHistory();cloud('Shared data connected','connected');}catch(e){cloud('Shared data connection issue','error');textStatus(e.message,'error');}}
async function init(){const session=await restoreSession();if(!session?.user){location.replace(new URL('../?next=sales/',location.href).href);return;}authenticated=true;$('salesLoading').hidden=true;$('salesWorkspace').hidden=false;$('salesEmail').textContent=session.user.email||'';$('ewpNavAccount').textContent=session.user.email||'';
  $('salesSignOut').addEventListener('click',async()=>{if(!confirm('Sign out of EWP Management on this browser?'))return;await signOut();location.replace('../');});
  $('salesRefresh').addEventListener('click',refresh);$('salesSettingsButton').addEventListener('click',()=>window.EWPSharedSettings?.open());
  $('newTab').addEventListener('click',()=>switchTab('new'));$('historyTab').addEventListener('click',()=>switchTab('history'));
  $('salesRequestForm').addEventListener('submit',submit);$('salesCopyProjectLabel').addEventListener('click',copyProjectLabel);window.addEventListener('ewp:settings-saved',refresh);
  window.addEventListener('storage',e=>{if(e.key===EWP_AUTH_STORAGE_KEY&&!e.newValue)location.replace('../');else if(e.key==='ewp_tracker_settings_modified_v18')refresh();});
  if(new URLSearchParams(location.search).has('request'))switchTab('history');
  await Promise.all([refresh(),loadSharePointLink()]);
}
init().catch(e=>{cloud('Could not load New EWP Requests','error');$('salesLoading').textContent=e.message;});
