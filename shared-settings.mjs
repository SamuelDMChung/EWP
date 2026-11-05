/* V1.8: exactly one Settings interface and Supabase writer for Portal, Tracker, Forecast, Sales Project Tracking, New EWP Requests and EWP Order and EWP Tools. */
import { loadTrackerSettings, saveTrackerSettings } from './tracker/cloud.mjs?v=1.12';
import { mfaStatus, mfaPending, mfaDecide, mfaAdminList, mfaRevoke, currentAal } from './mfa-client.mjs?v=1.38';
const CHANGE_SIGNAL='ewp_tracker_settings_modified_v18';
const categories=[
  { key:'sales',title:'Sales Names',placeholder:'Add sales name',description:'Used in the Sales dropdown throughout Tracking and Forecast.' },
  { key:'assignees',title:'Assignee Names',placeholder:'Add assignee name',description:'Available when assigning work items in Project Tracking.' },
  { key:'tasks',title:'Tasks',placeholder:'Add task',description:'Task types available when creating or editing work items.' },
  { key:'phases',title:'Phases',placeholder:'Add project phase',description:'Available in Project Tracking and New EWP Requests (for example Awarded, Bidding).' }
];
let current={sales:[],assignees:[],tasks:[],phases:['Awarded','Bidding']};
let pending=false;
const dialog=document.createElement('dialog');
dialog.id='ewpSharedSettingsDialog';
dialog.className='ewp-shared-settings-dialog';
dialog.setAttribute('aria-labelledby','ewpSharedSettingsTitle');
dialog.innerHTML=`
  <header class="ewp-shared-settings-head">
    <div><span class="ewp-settings-kicker">EWP MANAGEMENT</span><h2 id="ewpSharedSettingsTitle">Settings</h2></div>
    <button type="button" class="ewp-settings-close" aria-label="Close settings">×</button>
  </header>
  <div class="ewp-shared-settings-scroll">
    <section class="ewp-settings-section ewp-settings-appearance">
      <div><h3>Appearance</h3><p>Display theme for the Portal, Project Tracking, Forecast, New EWP Requests, EWP Order and EWP Tools in this browser.</p></div>
      <label>Theme<select id="ewpSharedThemeSelect" aria-label="Theme"><option value="light">Light</option><option value="dark">Dark</option></select></label>
    </section>
    <section class="ewp-settings-section" id="ewpMfaManagement" hidden>
      <h3>2FA Management — Administrator</h3>
      <p>Approve employee authenticator registrations only after verifying their identity in person or through a trusted existing contact method. Approval is not required for ordinary logins.</p>
      <div id="ewpMfaAdminStatus" role="status" aria-live="polite"></div>
      <button type="button" id="ewpMfaAdminRefresh">Refresh 2FA requests</button>
      <div id="ewpMfaRequests"></div>
      <h4>Approved authenticators</h4>
      <div id="ewpMfaApproved"></div>
      <p class="small-note">Revoking approval blocks access after enforcement. To replace a lost phone, the factor must also be deleted securely through Supabase Auth Admin tools; this screen never deletes Auth factors.</p>
    </section>
    <div class="ewp-settings-status" id="ewpSettingsStatus" role="status" aria-live="polite"></div>
    <div class="ewp-settings-grid" id="ewpSettingsLists"></div>
  </div>`;
document.body.append(dialog);
const $=selector=>dialog.querySelector(selector);
const status=$('#ewpSettingsStatus');
function message(text,error=false) {status.textContent=text;status.classList.toggle('is-error',error);}
function render() {
  const target=$('#ewpSettingsLists');target.replaceChildren();
  for(const config of categories){
    const section=document.createElement('section');section.className='ewp-settings-section';
    const head=document.createElement('div');head.className='ewp-settings-category-head';
    const title=document.createElement('h3');title.textContent=config.title;
    const count=document.createElement('span');count.className='ewp-settings-count';count.textContent=String(current[config.key].length);
    head.append(title,count);
    const note=document.createElement('p');note.textContent=config.description;
    const form=document.createElement('form');form.className='ewp-settings-add';form.dataset.kind=config.key;
    const input=document.createElement('input');input.type='text';input.placeholder=config.placeholder;input.setAttribute('aria-label',config.placeholder);input.maxLength=120;
    const add=document.createElement('button');add.type='submit';add.textContent='Add';
    form.append(input,add);
    const list=document.createElement('div');list.className='ewp-settings-chips';
    if(!current[config.key].length){
      const empty=document.createElement('span');empty.className='ewp-settings-empty';empty.textContent='None added yet.';list.append(empty);
    }
    for(const name of current[config.key]){
      const chip=document.createElement('span');chip.className='ewp-settings-chip';
      const label=document.createElement('span');label.textContent=name;
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${name}`);
      remove.title=`Remove ${name}`;
      remove.addEventListener('click',()=>update(config.key,name,'remove'));
      chip.append(label,remove);list.append(chip);
    }
    form.addEventListener('submit',event=>{event.preventDefault();update(config.key,input.value,'add');});
    section.append(head,note,form,list);target.append(section);
  }
}
async function reload() {
  current=await loadTrackerSettings();
  for(const config of categories) current[config.key]=Array.isArray(current[config.key])?current[config.key]:[];
  render();
}
async function update(key,raw,operation) {
  if(pending)return;
  const value=String(raw||'').trim();if(!value)return;
  if(operation==='remove'&&!confirm(`Remove “${value}” from ${categories.find(c=>c.key===key).title}?`))return;
  pending=true;dialog.classList.add('is-saving');message('Saving settings…');
  try{
    // Fresh read at mutation time; always save all four shared lists together.
    await reload();
    if(operation==='add'){
      if(current[key].some(n=>n.toLowerCase()===value.toLowerCase())){message('That name is already in the list.');return;}
      current[key]=[...current[key],value].sort((a,b)=>a.localeCompare(b));
    } else {current[key]=current[key].filter(n=>n!==value);}
    await saveTrackerSettings(current);
    await reload();
    message('Settings saved to shared Supabase.');
    window.dispatchEvent(new CustomEvent('ewp:settings-saved'));
    try{localStorage.setItem(CHANGE_SIGNAL,String(Date.now()));}catch{}
  }catch(error){message(error?.message||'Could not save settings.',true);}
  finally{pending=false;dialog.classList.remove('is-saving');}
}
async function renderMfaAdmin(){
  const section=$('#ewpMfaManagement'); section.hidden=true;
  let adminConfirmed=false;
  try{
    const state=await mfaStatus();
    if(!state?.is_admin || state.status!=='approved' || state.verified_factor_count!==1 || currentAal()!=='aal2')return;
    adminConfirmed=true;section.hidden=false;
    $('#ewpMfaAdminStatus').textContent='Loading enrollment approvals…';
    const [pending,approved]=await Promise.all([mfaPending(),mfaAdminList()]);
    const requestRoot=$('#ewpMfaRequests');requestRoot.replaceChildren();
    const approvedRoot=$('#ewpMfaApproved');approvedRoot.replaceChildren();
    if(!pending?.length){const p=document.createElement('p');p.textContent='No pending 2FA enrollment requests.';requestRoot.append(p);}
    for(const item of pending||[]){
      const row=document.createElement('div');row.className='ewp-mfa-admin-row';
      const label=document.createElement('span');label.textContent=item.email||'Employee';
      const approve=document.createElement('button');approve.type='button';approve.textContent='Approve';
      const reject=document.createElement('button');reject.type='button';reject.textContent='Reject';
      approve.addEventListener('click',()=>decide(item,true));reject.addEventListener('click',()=>decide(item,false));
      row.append(label,approve,reject);requestRoot.append(row);
    }
    for(const item of approved||[]){
      const row=document.createElement('div');row.className='ewp-mfa-admin-row';
      const label=document.createElement('span');label.textContent=`${item.email||'Employee'} — ${item.status}`;
      row.append(label);
      if(item.status==='approved'){
        const revoke=document.createElement('button');revoke.type='button';revoke.textContent='Revoke approval';
        revoke.addEventListener('click',async()=>{
          if(!confirm(`Revoke authenticator approval for ${item.email}? This is only the FIRST reset step; the Auth factor must also be deleted by the authorized account administrator.`))return;
          try{await mfaRevoke(item.user_id,item.factor_id);await renderMfaAdmin();}catch(error){$('#ewpMfaAdminStatus').textContent=error.message;}
        });row.append(revoke);
      }
      approvedRoot.append(row);
    }
    $('#ewpMfaAdminStatus').textContent='Only administrator-approved, uniquely verified authenticators qualify for protected access.';
  }catch(error){section.hidden=!adminConfirmed;$('#ewpMfaAdminStatus').textContent=error?.message||'Cannot retrieve 2FA approvals.';}
}
async function decide(item,approved){
  if(!confirm(`${approved?'Approve':'Reject'} ${item.email} authenticator registration? ${approved?'Approve only after verifying the employee identity independently.':''}`))return;
  $('#ewpMfaAdminStatus').textContent='Recording administrator decision…';
  try{await mfaDecide(item.user_id,item.factor_id,approved);await renderMfaAdmin();}
  catch(error){$('#ewpMfaAdminStatus').textContent=error?.message||'Approval action failed.';}
}
$('#ewpMfaAdminRefresh').addEventListener('click',renderMfaAdmin);
async function open(){
  if(dialog.open)return;
  $('#ewpSharedThemeSelect').value=document.documentElement.getAttribute('data-ewp-theme')==='dark'?'dark':'light';
  message('Loading shared settings…');
  dialog.showModal();
  try{await reload();message('Sales, assignees, tasks and phases are shared across all workspaces.');}
  catch(error){message(error?.message||'Could not load settings.',true);}
}
window.EWPSharedSettings={open};
$('.ewp-settings-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
$('#ewpSharedThemeSelect').addEventListener('change',event=>window.EWPTheme?.apply(event.target.value,true));
for(const id of ['portalSettingsButton','forecastSettingsButton','salesTrackerSettings','ewpToolsSettings']){
  document.getElementById(id)?.addEventListener('click',open);
}
window.addEventListener('storage',event=>{if(event.key===CHANGE_SIGNAL&&dialog.open)reload().catch(error=>message(error.message,true));});

/* V1.38 administrator-only MFA panel styles. */
const mfaStyle=document.createElement('style');mfaStyle.textContent='.ewp-mfa-admin-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 0;border-bottom:1px solid var(--ewp-border,#ddd)}.ewp-mfa-admin-row span{flex:1;min-width:180px}#ewpMfaManagement[hidden]{display:none!important}';document.head.append(mfaStyle);
