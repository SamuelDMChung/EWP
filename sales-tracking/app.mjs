/** EWP V1.17 — read-only Sales Project Tracking. No POST/UPDATE/DELETE calls. */
import { restoreSession, getAccessToken, EWP_AUTH_STORAGE_KEY } from '../forecast/auth.mjs?v=1.0-p3';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../forecast/config.mjs';
import { startTrackerRealtime, stopTrackerRealtime } from '../tracker/realtime.mjs?v=1.0-p3';

const $ = id => document.getElementById(id);
const REST = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
const COORDINATION = new Set(['pending','in_review','delivering']);
const VALID_STATUSES = new Set(['queue','in_progress','pending','in_review','delivering','completed']);
const names = {
  queue:'Queue', in_progress:'In Progress', pending:'Pending',
  in_review:'In Review', delivering:'Delivering', completed:'Completed'
};
let salesperson = '';
let selectedRows = [];
let sort = {key:'projectNumber', direction:'desc'};
let sequence = 0;
let realtimeTimer = 0;
let inFlight = 0;
const resetMessage = () => { $('salesTrackerResultsMessage').hidden=true; $('salesTrackerResultsMessage').classList.remove('error'); };

async function request(table, options) {
  const token = await getAccessToken();
  if (!token) throw new Error('Your sign-in has expired. Please open the Portal and sign in again.');
  const response = await fetch(`${REST}/${table}?${options.toString()}`, {
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,Accept:'application/json'},
    cache:'no-store'
  });
  let result;
  try { result=await response.json(); } catch {result=null;}
  if (!response.ok) throw new Error(result?.message || `Supabase returned ${response.status}`);
  return result || [];
}
async function allRows(table, columns, filters={}) {
  const result=[];
  for(let offset=0;;offset+=1000) {
    const query = new URLSearchParams({select:columns,limit:'1000',offset:String(offset),...filters});
    const batch=await request(table,query);
    result.push(...batch);
    if(batch.length<1000) return result;
  }
}

function updateConnection(text, error=false) {
  const indicator=$('salesTrackerConnection');
  indicator.textContent=text;
  indicator.style.color=error?'#b42318':'';
}
function formatDate(iso) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '—';
  const [year,month,day]=iso.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(year,month-1,day));
}
function formatType(project) {
  const kind=project.tracker_project_type || (project.project_type==='sfd'?'SFD':'Multi');
  return kind==='Others' && project.tracker_project_type_other ? project.tracker_project_type_other : kind;
}
function canonicalStatus(project, tasks) {
  const status=project.tracker_status;
  if(COORDINATION.has(status) || status==='completed') return status;
  if(tasks.length && tasks.every(task=>task.status==='done')) return 'in_review';
  if(tasks.some(task=>task.status==='in_progress' || task.status==='done')) return 'in_progress';
  if(tasks.length) return 'queue';
  return VALID_STATUSES.has(status)?status:'queue';
}
function displayRows(projects, tasks) {
  const byProject=new Map();
  for(const task of tasks) {
    if(!byProject.has(task.project_id)) byProject.set(task.project_id,[]);
    byProject.get(task.project_id).push(task);
  }
  const output=[];
  for(const project of projects) {
    const workItems=(byProject.get(project.id)||[]).sort((a,b)=>
      String(a.created_at||'').localeCompare(String(b.created_at||'')) || String(a.id).localeCompare(String(b.id)));
    const projectStatus=canonicalStatus(project,workItems);
    const common={
      projectNumber:project.project_number || '—',
      address:project.address_project_name || '—', customer:project.customer || '—',
      sales:project.sales || '—', phase:project.tracker_phase || 'Awarded',
      type:formatType(project),due:project.tracker_due_date || ''
    };
    if(COORDINATION.has(projectStatus) || projectStatus==='completed' || !workItems.length) {
      const joined=[...new Set(workItems.map(item=>String(item.task||'').trim()).filter(Boolean))].join(', ');
      output.push({...common,task:joined || '—',status:projectStatus});
    } else {
      // Still on EWP plate: each task gets its own row, including independent status.
      for(const item of workItems) output.push({...common,
        task:item.task || '—',status:item.status==='done'?'in_review':item.status==='in_progress'?'in_progress':'queue'});
    }
  }
  return output;
}
function showMessage(message, error=false) {
  const element=$('salesTrackerResultsMessage');
  element.hidden=false;element.textContent=message;element.classList.toggle('error',error);
}
function compare(a,b,key) {
  const av=String(a[key]||'');const bv=String(b[key]||'');
  if(key==='due') {
    if(!av) return bv?1:0;
    if(!bv) return -1;
  }
  return av.localeCompare(bv,undefined,{numeric:true,sensitivity:'base'});
}
function renderTable() {
  const records=[...selectedRows].sort((a,b)=>{
    const ordered=compare(a,b,sort.key) * (sort.direction==='asc'?1:-1);
    return ordered || compare(a,b,'projectNumber')*-1 || compare(a,b,'task');
  });
  const tbody=$('salesTrackerRows');const fragment=document.createDocumentFragment();
  for(const record of records) {
    const tr=document.createElement('tr');
    for(const key of ['projectNumber','address','task','status','customer','sales','phase','type','due']) {
      const td=document.createElement('td');
      if(key==='status') {
        const badge=document.createElement('span');
        badge.className=`status-pill status-${VALID_STATUSES.has(record.status)?record.status:'queue'}`;
        badge.textContent=names[record.status]||record.status;
        td.appendChild(badge);
      } else td.textContent=key==='due'?formatDate(record.due):(record[key]||'—');
      tr.appendChild(td);
    }
    fragment.appendChild(tr);
  }
  tbody.replaceChildren(fragment);
  $('salesTrackerCount').textContent=`${new Set(selectedRows.map(row=>row.projectNumber)).size} project${new Set(selectedRows.map(row=>row.projectNumber)).size===1?'':'s'} · ${selectedRows.length} task/project row${selectedRows.length===1?'':'s'}`;
  for(const th of document.querySelectorAll('.sales-tracking-table th')) {
    const button=th.querySelector('button');
    const active=button.dataset.sort===sort.key;
    th.setAttribute('aria-sort',active ? (sort.direction==='asc'?'ascending':'descending'):'none');
    button.querySelector('span').textContent=active?(sort.direction==='asc'?'↑':'↓'):'';
  }
  $('salesTrackerTableWrap').hidden=selectedRows.length===0;
  if(!selectedRows.length) showMessage('No projects found for this salesperson.');
  else resetMessage();
}
async function refreshSelected({silent=false}={}) {
  if(!salesperson) return;
  const localSales=salesperson;
  const mySequence=++sequence;
  inFlight++;
  $('salesTrackerRefresh').disabled=true;
  if(!silent) showMessage('Loading projects from Supabase…');
  try {
    const projects=await allRows('projects',
      'id,project_number,address_project_name,customer,sales,tracker_phase,tracker_project_type,tracker_project_type_other,project_type,tracker_due_date,tracker_status',
      {sales:`eq.${localSales}`,order:'project_number.desc'});
    if(mySequence!==sequence || salesperson!==localSales) return;
    const tasks=[];
    for(let i=0;i<projects.length;i+=75) {
      const ids=projects.slice(i,i+75).map(p=>p.id);
      if(!ids.length) continue;
      const batch=await allRows('tracker_work_items','id,project_id,task,status,created_at',
        {project_id:`in.(${ids.join(',')})`,order:'created_at.asc'});
      tasks.push(...batch);
      if(mySequence!==sequence || salesperson!==localSales) return;
    }
    selectedRows=displayRows(projects,tasks);
    renderTable();
    updateConnection('Shared data connected');
  } catch(error) {
    console.error('Sales Tracking refresh failed',error);
    if(mySequence===sequence && salesperson===localSales) {
      showMessage(`Could not refresh projects: ${error.message}. Use Refresh to try again.`,true);
      updateConnection('Shared data connection issue',true);
    }
  } finally {inFlight=Math.max(0,inFlight-1);$('salesTrackerRefresh').disabled=inFlight>0;}
}
function showSelection() {
  sequence++;
  salesperson='';
  selectedRows=[];
  $('salesTrackerSelect').value='';
  $('salesTrackerSelectView').hidden=false;
  $('salesTrackerResultsView').hidden=true;
  resetMessage();
}
function chooseSalesperson(value) {
  if(!value) return;
  const allowed=[...$('salesTrackerSelect').options].some(o=>o.value===value);
  if(!allowed) return;
  salesperson=value;
  sort={key:'projectNumber',direction:'desc'};
  selectedRows=[];
  $('salesTrackerSelectedName').textContent=value;
  $('salesTrackerCount').textContent='Loading projects…';
  $('salesTrackerSelectView').hidden=true;
  $('salesTrackerResultsView').hidden=false;
  $('salesTrackerTableWrap').hidden=true;
  refreshSelected();
}
function scheduleRefresh() {
  if(!salesperson || document.hidden) return;
  if(realtimeTimer) clearTimeout(realtimeTimer);
  realtimeTimer=setTimeout(()=>refreshSelected({silent:true}),400);
}
async function init() {
  $('salesTrackerSelect').addEventListener('change', event=>chooseSalesperson(event.target.value));
  $('salesTrackerChange').addEventListener('click',showSelection);
  $('salesTrackerRefresh').addEventListener('click',()=>{
    if(salesperson) refreshSelected(); else loadSalesOptions();
  });
  for(const button of document.querySelectorAll('[data-sort]')) button.addEventListener('click',()=>{
    const key=button.dataset.sort;
    sort={key,direction:sort.key===key&&sort.direction==='asc'?'desc':'asc'};
    if(selectedRows.length) renderTable();
  });
  window.addEventListener('ewp:settings-saved',()=>{if(!salesperson) loadSalesOptions();else scheduleRefresh();});
  window.addEventListener('focus',scheduleRefresh);
  document.addEventListener('visibilitychange',scheduleRefresh);
  window.addEventListener('storage', event=>{
    if(event.key===EWP_AUTH_STORAGE_KEY) scheduleRefresh();
    if(event.key==='ewp_shared_projects_changed') scheduleRefresh();
    if(event.key==='ewp_tracker_settings_modified_v18' && !salesperson) loadSalesOptions();
  });
  const session=await restoreSession();
  if(!session?.user) return; // shared workspace-auth handles the existing Portal sign-in redirect
  $('salesTrackerLoading').hidden=true;
  $('salesTrackerSelectView').hidden=false;
  await loadSalesOptions();
  // Optional live refresh; the focus/visibility handlers remain a fallback.
  startTrackerRealtime(scheduleRefresh,()=>{}).catch(()=>{});
}
async function loadSalesOptions() {
  const select=$('salesTrackerSelect');
  try {
    const settings=await request('tracker_settings',new URLSearchParams({select:'sales',id:'eq.global',limit:'1'}));
    const sales=[...new Set((settings[0]?.sales||[]).map(s=>String(s||'').trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
    select.replaceChildren(new Option('Choose salesperson…',''),...sales.map(name=>new Option(name,name)));
    $('salesTrackerSelectHelp').textContent=sales.length ?
      'Select one salesperson to open the read-only project list.' :
      'No salespeople configured yet. Add them through Project Tracking Settings.';
    updateConnection('Shared data connected');
  } catch(error) {
    updateConnection('Shared data connection issue',true);
    $('salesTrackerSelectHelp').textContent=`Could not load salespeople: ${error.message}. Select Refresh to retry.`;
  }
}
init().catch(error=>{console.error('Sales Tracking init failed',error);$('salesTrackerLoading').textContent='Unable to start Sales Project Tracking. Try refreshing this page.';});
window.addEventListener('pagehide',()=>{if(realtimeTimer) clearTimeout(realtimeTimer);stopTrackerRealtime().catch(()=>{});});
