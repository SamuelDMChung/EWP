import { restoreSession, signInWithPassword, signOut, getCurrentSession, EWP_AUTH_STORAGE_KEY } from '../forecast/auth.mjs?v=1.0-p3';
import { startTrackerRealtime, stopTrackerRealtime } from './realtime.mjs?v=1.0-p3';
import { loadTrackerCloud, saveTrackerProject, setTrackerProjectStatus, moveTrackerWorkItem, deleteTrackerProject, getNextTrackerNumber, saveTrackerSettings, addTrackerFilter, removeTrackerFilter } from './cloud.mjs?v=1.0-p3';

(() => {
  const PROJECTS_KEY = 'tc_project_tracker_v01_projects'; // legacy browser data; never used as authoritative data
  const OLD_COUNTER_KEY = 'tc_project_tracker_v01_counters';
  const SETTINGS_KEY = 'ewp_project_tracker_v02_settings';
  const ISSUED_COUNTER_KEY = 'ewp_project_tracker_v03_issued_counters';
  const SAVED_FILTERS_KEY = 'ewp_project_tracker_v04_saved_filters';

  const PROJECT_SYNC_SIGNAL = 'ewp_shared_projects_changed';
  const BOARD_VIEW_KEY = 'ewp_tracker_board_density_v13'; // UI preference only; no project data
  let boardDensity = 'compact';
  try { if (localStorage.getItem(BOARD_VIEW_KEY) === 'detailed') boardDensity = 'detailed'; } catch {}
  function announceProjectChange() {
    // Inform another open portal tab immediately. Supabase remains authoritative.
    try { localStorage.setItem(PROJECT_SYNC_SIGNAL, String(Date.now())); } catch {}
  }
  const defaultSettings = { sales: [], assignees: [], tasks: [] };
  let projects = [];
  let settings = { ...defaultSettings };
  let issuedCounters = {};
  let savedFilters = [];
  let activeFilters = createEmptyFilters();
  let activeSavedFilterId = '';
  let draggedWorkItem = null;
  let dragOccurred = false;
  let editingProjectId = null;
  let currentPrimaryView = 'board';
  let cloudReady = false;
  let syncing = false;
  const followUpSelectedIds = new Set();
  let followUpEmailDirty = false;
  let followUpSubjectDirty = false;
  const COORDINATION_STATUSES = ['pending','in_review','delivering'];
  const PROJECT_STATUSES = ['queue','in_progress',...COORDINATION_STATUSES,'completed'];

  const lists = {
    queue: document.getElementById('queueList'),
    in_progress: document.getElementById('progressList'),
    coordination: document.getElementById('coordinationList'),
    completed: document.getElementById('doneList')
  };

  const projectForm = document.getElementById('projectForm');
  const editDialog = document.getElementById('editDialog');
  const editForm = document.getElementById('editForm');

  function uid(prefix = 'id') {
    return crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeStatus(value) {
    return ['queue', 'in_progress', 'done'].includes(value) ? value : 'queue';
  }

  function normalizeWorkItem(raw = {}, legacyProject = {}) {
    const status = normalizeStatus(raw.status || legacyProject.status || 'queue');
    return {
      id: raw.id || uid('task'),
      task: String(raw.task ?? legacyProject.task ?? '').trim(),
      assignee: String(raw.assignee ?? legacyProject.assignee ?? '').trim(),
      dueDate: raw.dueDate || '',
      status,
      createdAt: raw.createdAt || legacyProject.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || legacyProject.updatedAt || new Date().toISOString(),
      startedAt: raw.startedAt ?? legacyProject.startedAt ?? (status === 'in_progress' ? legacyProject.updatedAt || null : null),
      completedAt: raw.completedAt ?? legacyProject.completedAt ?? (status === 'done' ? legacyProject.updatedAt || null : null)
    };
  }

  function normalizeProject(raw = {}) {
    let workItems;
    if (Array.isArray(raw.workItems) && raw.workItems.length) {
      workItems = raw.workItems.map(item => normalizeWorkItem(item, raw));
    } else {
      // V0.4 and earlier stored one task/assignee/status directly on the project.
      workItems = [normalizeWorkItem({}, raw)];
    }

    const normalized = {
      address: '',
      aplRequired: 'No',
      projectTypeOther: '',
      largeTji: 'No',
      ...raw,
      id: raw.id || uid('project'),
      workItems
    };
    delete normalized.task;
    delete normalized.assignee;
    delete normalized.status;
    delete normalized.startedAt;
    delete normalized.completedAt;
    return normalized;
  }

  // Phase 2 cloud is the only source of truth. No automatic localStorage import:
  // it risks overwriting more recent team data and is origin/path dependent.
  function cloudMessage(text, failed=false) {
    const el=document.getElementById('trackerCloudMessage');
    if (!el) return;
    el.textContent=text;
    el.classList.toggle('tracker-cloud-error',failed);
  }
  function setCloudReady(value) {
    cloudReady=value;
    document.getElementById('trackerWorkspace').classList.toggle('hidden',!value);
  }
  function fromRow(row, workItems) {
    const type=row.tracker_project_type || (row.project_type === 'sfd' ? 'SFD' : 'Multi');
    return {
      id:row.id, version:Number(row.version||1), projectNumber:row.project_number||'',
      sales:row.sales||'',customer:row.customer||'',address:row.address_project_name||'',
      phase:row.tracker_phase||'Awarded', projectType:type,
      projectStatus: PROJECT_STATUSES.includes(row.tracker_status) ? row.tracker_status : null,
      projectTypeOther:row.tracker_project_type_other||'',
      largeTji:row.tracker_large_tji||'No',aplRequired:row.tracker_apl_required||'No',
      dateSubmitted:row.tracker_date_submitted||'',dueDate:row.tracker_due_date||'',
      createdAt:row.created_at||'',updatedAt:row.updated_at||'',
      workItems:workItems.filter(item=>item.project_id===row.id).map(item=>({
        id:item.id,task:item.task||'',assignee:item.assignee||'',dueDate:item.due_date||'',
        status:normalizeStatus(item.status),startedAt:item.started_at||null,
        completedAt:item.completed_at||null,createdAt:item.created_at||'',updatedAt:item.updated_at||''
      }))
    };
  }
  async function syncCloud(message='Shared data synced') {
    if (syncing) return;
    syncing=true;
    try {
      const data=await loadTrackerCloud();
      projects=(data.projects||[]).map(item=>fromRow(item,data.workItems||[]));
      settings={sales:data.settings.sales||[],assignees:data.settings.assignees||[],tasks:data.settings.tasks||[]};
      savedFilters=(data.filters||[]).map(row=>({id:row.id,name:row.name,search:row.search||'',filters:row.filters||{},createdAt:row.created_at||''}));
      issuedCounters={};
      const yy=currentYY();
      const next=Number(await getNextTrackerNumber(yy));
      if (Number.isFinite(next)&&next>0) issuedCounters[yy]=next-1;
      setCloudReady(true);
      cloudMessage(message);
      render();
    } catch(error) {
      cloudMessage(`Cloud error: ${error.message}`,true);
      throw error;
    } finally { syncing=false; }
  }
  async function withCloud(action) {
    if(!cloudReady) return;
    try { await action(); }
    catch(error) { console.error(error); cloudMessage(error.message,true); alert(error.message); await syncCloud('Shared data reloaded').catch(()=>{}); }
  }
  async function addSettingCloud() {
    await saveTrackerSettings(settings);
    cloudMessage('Settings saved to Supabase');
  }

  function todayISO() {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function currentYY() {
    return String(new Date().getFullYear()).slice(-2);
  }

  function currentPrefix() {
    return `TC${currentYY()}`;
  }

  function projectPrefix(projectNumber) {
    const match = String(projectNumber || '').match(/^(TC\d{2})(\d{3})$/i);
    return match ? match[1].toUpperCase() : currentPrefix();
  }

  function projectSuffix(projectNumber) {
    const match = String(projectNumber || '').match(/^TC\d{2}(\d{3})$/i);
    return match ? match[1] : '001';
  }

  function yyFromPrefix(prefix) {
    const match = String(prefix || '').match(/^TC(\d{2})$/i);
    return match ? match[1] : currentYY();
  }

  function getNextSequence() {
    return Number(issuedCounters[currentYY()] || 0) + 1;
  }

  function nextProjectNumber() {
    const next = getNextSequence();
    return next <= 999 ? `${currentPrefix()}${String(next).padStart(3, '0')}` : `${currentPrefix()} — sequence full`;
  }

  function raiseIssuedCounter(prefix, sequence) {
    const yy = yyFromPrefix(prefix);
    issuedCounters[yy] = Math.max(Number(issuedCounters[yy] || 0), Number(sequence || 0));
  }

  function buildProjectNumber(prefix, suffix) {
    const clean = String(suffix || '').trim();
    if (!/^\d{3}$/.test(clean)) return null;
    return `${prefix}${clean}`.toUpperCase();
  }

  function isDuplicateProjectNumber(number, ignoreId = null) {
    return projects.some(project => project.id !== ignoreId && String(project.projectNumber || '').toUpperCase() === number.toUpperCase());
  }

  function formatDate(value) {
    if (!value) return '—';
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return value;
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      .format(new Date(y, m - 1, d));
  }

  function displayProjectType(project) {
    return project.projectType === 'Others' && project.projectTypeOther
      ? project.projectTypeOther
      : (project.projectType || '—');
  }

  function statusLabel(status) {
    return ({queue:'Queue',in_progress:'In Progress',pending:'Pending',in_review:'In Review',delivering:'Delivering',completed:'Completed',coordination:'Coordination',done:'Done'})[status] || 'Queue';
  }

  function projectStatus(project) {
    const saved = project.projectStatus;
    // Coordination and fully delivered are project-level, never derived from
    // task completion. On-plate columns are derived from independent tasks.
    if (COORDINATION_STATUSES.includes(saved) || saved === 'completed') return saved;
    const items = Array.isArray(project.workItems) ? project.workItems : [];
    if (items.some(item => item.status === 'in_progress' || item.status === 'done')) return 'in_progress';
    if (items.length) return 'queue';
    return saved === 'in_progress' ? 'in_progress' : 'queue';
  }

  function isOffPlate(project) {
    return COORDINATION_STATUSES.includes(project.projectStatus) || project.projectStatus === 'completed';
  }

  function allTasksDone(project) {
    return Boolean(project.workItems?.length) && project.workItems.every(item => item.status === 'done');
  }

  function effectiveDueDate(project, workItem) {
    return workItem.dueDate || project.dueDate || '';
  }

  function isWorkItemOverdue(project, workItem) {
    const due = effectiveDueDate(project, workItem);
    return workItem.status !== 'done' && projectStatus(project) !== 'completed' && due && due < todayISO();
  }

  function allWorkItemEntries() {
    return projects.flatMap(project => (project.workItems || []).map(workItem => ({ project, workItem })));
  }

  function createEmptyFilters() {
    return {
      sales: [],
      customer: [],
      phase: [],
      status: [],
      aplRequired: [],
      largeTji: [],
      assignee: [],
      task: []
    };
  }

  function uniqueSorted(values) {
    const map = new Map();
    values.forEach(raw => {
      const value = String(raw || '').trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (!map.has(key)) map.set(key, value);
    });
    return [...map.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  function getFilterOptions(key) {
    if (key === 'phase') return [
      { value: 'Awarded', label: 'Awarded' },
      { value: 'Bidding', label: 'Bidding' }
    ];
    if (key === 'status') return [
      { value: 'queue', label: 'Queue' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'pending', label: 'Pending' },
      { value: 'in_review', label: 'In Review' },
      { value: 'delivering', label: 'Delivering' },
      { value: 'completed', label: 'Completed' }
    ];
    if (key === 'aplRequired' || key === 'largeTji') return [
      { value: 'Yes', label: 'Yes' },
      { value: 'No', label: 'No' }
    ];

    const entries = allWorkItemEntries();
    const values = key === 'sales'
      ? uniqueSorted([...(settings.sales || []), ...projects.map(project => project.sales)])
      : key === 'assignee'
        ? uniqueSorted([...(settings.assignees || []), ...entries.map(entry => entry.workItem.assignee)])
        : key === 'task'
          ? uniqueSorted([...(settings.tasks || []), ...entries.map(entry => entry.workItem.task)])
          : key === 'customer'
            ? uniqueSorted(projects.map(project => project.customer))
            : [];

    return values.map(value => ({ value, label: value }));
  }

  function filterDisplayName(key) {
    return ({
      sales: 'Sales',
      customer: 'Customer',
      phase: 'Phase',
      status: 'Status',
      aplRequired: 'APL',
      largeTji: '>14" TJI',
      assignee: 'Assignee',
      task: 'Task'
    })[key] || key;
  }

  function defaultFilterText(key) {
    return ({
      sales: 'All Sales',
      customer: 'All Customers',
      phase: 'All Phases',
      status: 'All Statuses',
      aplRequired: 'Any',
      largeTji: 'Any',
      assignee: 'All Assignees',
      task: 'All Tasks'
    })[key] || 'Any';
  }

  function displayFilterValue(key, value) {
    return key === 'status' ? statusLabel(value) : value;
  }

  function isFilterActive() {
    const search = document.getElementById('projectSearch')?.value.trim() || '';
    return Boolean(search) || Object.values(activeFilters).some(values => values.length);
  }

  function entryValue(entry, key) {
    const { project, workItem } = entry;
    if (key === 'status') return entry.boardStatus || projectStatus(project);
    if (key === 'assignee') return workItem.assignee;
    if (key === 'task') return workItem.task;
    return project[key];
  }

  function workItemEntryMatchesFilters(entry) {
    const { project, workItem } = entry;
    const search = (document.getElementById('projectSearch')?.value || '').trim().toLowerCase();
    if (search) {
      const haystack = [
        project.projectNumber,
        project.address,
        project.customer,
        project.sales,
        ...(project.workItems || []).map(item => item.assignee),
        ...(project.workItems || []).map(item => item.task),
        project.phase,
        displayProjectType(project),
        statusLabel(projectStatus(project)),
        statusLabel(workItem.status),
        project.largeTji,
        project.aplRequired,
        project.dateSubmitted,
        project.dueDate,
        workItem.dueDate
      ].map(value => String(value || '').toLowerCase()).join(' ');
      if (!haystack.includes(search)) return false;
    }

    return Object.entries(activeFilters).every(([key, selected]) => {
      if (!selected.length) return true;
      const values = key === 'assignee' || key === 'task'
        ? (entry.boardStatus && !isOffPlate(project) ? [String(workItem[key] || '')] : (project.workItems || []).map(item => String(item[key] || '')))
        : key === 'status' && !entry.boardStatus && !isOffPlate(project)
          ? uniqueSorted([projectStatus(project), ...(project.workItems || []).map(item => item.status === 'done' ? 'in_progress' : item.status)])
          : [String(entryValue(entry, key) || '')];
      return values.some(value => selected.some(option => String(option).toLowerCase() === value.toLowerCase()));
    });
  }

  function getFilteredWorkItems() {
    // List and project-level filter counters retain one row per project.
    return projects.map(project => ({project,workItem:project.workItems?.[0] || normalizeWorkItem()}))
      .filter(workItemEntryMatchesFilters);
  }

  function getFilteredBoardEntries() {
    return projects.flatMap(project => {
      if (isOffPlate(project) || !project.workItems?.length) {
        return [{project,workItem:project.workItems?.[0] || normalizeWorkItem(),boardStatus:projectStatus(project),aggregate:true}];
      }
      return project.workItems.map(workItem => ({
        project,workItem,boardStatus:workItem.status === 'done' ? 'in_progress' : workItem.status,aggregate:false
      }));
    }).filter(workItemEntryMatchesFilters);
  }

  function markFilterAsCustom() {
    activeSavedFilterId = '';
    const select = document.getElementById('savedFilterSelect');
    if (select) select.value = '';
    document.getElementById('deleteSavedFilter')?.classList.add('hidden');
  }

  function renderFilterControls() {
    document.querySelectorAll('.multi-select-filter').forEach(container => {
      const key = container.dataset.filter;
      const menu = container.querySelector('.multi-filter-menu');
      const text = container.querySelector('.multi-filter-text');
      const options = getFilterOptions(key);
      const selected = activeFilters[key] || [];
      menu.innerHTML = '';

      if (!options.length) {
        const empty = document.createElement('div');
        empty.className = 'filter-menu-empty';
        empty.textContent = 'No options yet';
        menu.appendChild(empty);
      } else {
        options.forEach(option => {
          const row = document.createElement('label');
          row.className = 'filter-check-row';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = selected.some(value => String(value).toLowerCase() === String(option.value).toLowerCase());
          checkbox.addEventListener('change', () => {
            const values = activeFilters[key] || [];
            if (checkbox.checked) {
              if (!values.some(value => String(value).toLowerCase() === String(option.value).toLowerCase())) values.push(option.value);
            } else {
              activeFilters[key] = values.filter(value => String(value).toLowerCase() !== String(option.value).toLowerCase());
            }
            markFilterAsCustom();
            renderFilterDrivenViews();
          });
          const label = document.createElement('span');
          label.textContent = option.label;
          row.append(checkbox, label);
          menu.appendChild(row);
        });
      }

      if (!selected.length) text.textContent = defaultFilterText(key);
      else if (selected.length === 1) text.textContent = displayFilterValue(key, selected[0]);
      else text.textContent = `${selected.length} selected`;
      container.classList.toggle('has-selection', selected.length > 0);
    });

    renderActiveFilterChips();
    renderSavedFilterSelect();
  }

  function createFilterChip(label, onRemove) {
    const chip = document.createElement('span');
    chip.className = 'active-filter-chip';
    const text = document.createElement('span');
    text.textContent = label;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${label}`);
    remove.addEventListener('click', onRemove);
    chip.append(text, remove);
    return chip;
  }

  function renderActiveFilterChips() {
    const wrap = document.getElementById('activeFilterChips');
    if (!wrap) return;
    wrap.innerHTML = '';
    const search = document.getElementById('projectSearch')?.value.trim() || '';

    if (search) {
      wrap.appendChild(createFilterChip(`Search: ${search}`, () => {
        document.getElementById('projectSearch').value = '';
        markFilterAsCustom();
        renderFilterDrivenViews();
      }));
    }

    Object.entries(activeFilters).forEach(([key, values]) => {
      values.forEach(value => {
        wrap.appendChild(createFilterChip(`${filterDisplayName(key)}: ${displayFilterValue(key, value)}`, () => {
          activeFilters[key] = activeFilters[key].filter(item => String(item).toLowerCase() !== String(value).toLowerCase());
          markFilterAsCustom();
          renderFilterDrivenViews();
        }));
      });
    });

    wrap.classList.toggle('hidden', !wrap.children.length);
    const criteriaCount = (search ? 1 : 0) + Object.values(activeFilters).filter(values => values.length).length;
    const badge = document.getElementById('activeFilterCount');
    badge.textContent = criteriaCount;
    badge.classList.toggle('hidden', criteriaCount === 0);
    document.getElementById('clearAllFilters').disabled = criteriaCount === 0;
  }

  function renderSavedFilterSelect() {
    const select = document.getElementById('savedFilterSelect');
    if (!select) return;
    const current = activeSavedFilterId;
    select.innerHTML = '<option value="">Saved filters</option>';
    [...savedFilters]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .forEach(saved => {
        const option = document.createElement('option');
        option.value = saved.id;
        option.textContent = saved.name;
        select.appendChild(option);
      });
    select.value = savedFilters.some(filter => filter.id === current) ? current : '';
    document.getElementById('deleteSavedFilter').classList.toggle('hidden', !select.value);
  }

  function renderFilterDrivenViews() {
    renderBoard();
    renderList();
    renderFollowUp();
    renderFilterControls();
    const visibleEntries = getFilteredBoardEntries();
    const totalEntries = projects.length;
    const visibleProjects = new Set(visibleEntries.map(entry => entry.project.id)).size;
    const result = document.getElementById('filterResultCount');
    if (isFilterActive()) {
      result.textContent = `${visibleProjects} of ${totalEntries} projects`;
    } else {
      result.textContent = `${projects.length} project${projects.length === 1 ? '' : 's'}`;
    }
  }

  function closeFilterMenus(except = null) {
    document.querySelectorAll('.multi-select-filter.open').forEach(container => {
      if (container !== except) container.classList.remove('open');
    });
  }

  function clearAllFilters() {
    activeFilters = createEmptyFilters();
    document.getElementById('projectSearch').value = '';
    activeSavedFilterId = '';
    closeFilterMenus();
    renderFilterDrivenViews();
  }

  function applySavedFilter(id) {
    const saved = savedFilters.find(item => item.id === id);
    if (!saved) return;
    const next = createEmptyFilters();
    Object.keys(next).forEach(key => {
      next[key] = Array.isArray(saved.filters?.[key]) ? [...saved.filters[key]] : [];
    });
    activeFilters = next;
    document.getElementById('projectSearch').value = saved.search || '';
    activeSavedFilterId = saved.id;
    closeFilterMenus();
    renderFilterDrivenViews();
  }

  function switchView(viewName) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(`view-${viewName}`)?.classList.add('active');

    if (viewName === 'board' || viewName === 'list' || viewName === 'followup') currentPrimaryView = viewName;
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === currentPrimaryView);
    });

    const filterBar = document.getElementById('sharedFilterBar');
    if (filterBar) filterBar.classList.toggle('hidden', !(viewName === 'board' || viewName === 'list'));
    closeAllCombos();
    closeFilterMenus();
    if (viewName === 'list') renderList();
    if (viewName === 'followup') renderFollowUp();
  }

  function openAddProject() {
    prepareNewProjectForm(true);
    switchView('add');
  }

  function returnToPrimaryView() {
    switchView(currentPrimaryView);
  }

  function render() {
    renderSettingsPage();
    refreshWorkItemTaskSelects();
    refreshAllComboMenus();
    document.getElementById('nextProjectNumber').textContent = nextProjectNumber();
    renderFilterDrivenViews();
  }

  function boardColumn(status) {
    return COORDINATION_STATUSES.includes(status) ? 'coordination' : status;
  }

  function setBoardDensity(mode) {
    boardDensity = mode === 'detailed' ? 'detailed' : 'compact';
    const board = document.getElementById('board');
    board.classList.toggle('board-compact', boardDensity === 'compact');
    board.classList.toggle('board-detailed', boardDensity === 'detailed');
    document.querySelectorAll('[data-board-density]').forEach(button => {
      const selected = button.dataset.boardDensity === boardDensity;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    try { localStorage.setItem(BOARD_VIEW_KEY, boardDensity); } catch {}
  }

  function updateCoordinationFilterButtons() {
    document.querySelectorAll('[data-coordination-status]').forEach(button => {
      const status = button.dataset.coordinationStatus;
      const selected = activeFilters.status.length === 1 && activeFilters.status[0] === status;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function renderBoard() {
    updateCoordinationFilterButtons();
    Object.values(lists).forEach(list => { list.innerHTML = ''; });
    const finishedList = document.getElementById('finishedTaskList');
    const finishedSection = document.getElementById('finishedTasksSection');
    const readyList = document.getElementById('readyCoordinationList');
    finishedList.innerHTML = '';
    readyList.innerHTML = '';
    const visibleEntries = getFilteredBoardEntries();
    const sorted = [...visibleEntries].sort((a, b) => {
      if (a.boardStatus === 'completed' && b.boardStatus === 'completed')
        return (b.project.updatedAt || '').localeCompare(a.project.updatedAt || '');
      return (effectiveDueDate(a.project,a.workItem) || '9999-12-31').localeCompare(effectiveDueDate(b.project,b.workItem) || '9999-12-31') ||
        (a.project.createdAt || '').localeCompare(b.project.createdAt || '');
    });
    sorted.forEach(({project,workItem,boardStatus,aggregate}) => {
      const destination = !aggregate && workItem.status === 'done'
        ? finishedList : (lists[boardColumn(boardStatus)] || lists.queue);
      destination.appendChild(createWorkItemCard(project,workItem,aggregate));
    });
    const readyProjects = [...new Set(visibleEntries.filter(e => !e.aggregate && allTasksDone(e.project)).map(e => e.project.id))]
      .map(id => projects.find(project => project.id === id)).filter(Boolean);
    readyProjects.forEach(project => {
      const panel = document.createElement('div');
      panel.className = 'ready-coordination-card';
      const label = document.createElement('div');
      label.textContent = `${project.projectNumber} · ${project.workItems.length}/${project.workItems.length} tasks done`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ready-coordination-button';
      button.textContent = 'Move to Coordination →';
      button.addEventListener('click', () => moveProject(project.id,'coordination'));
      panel.append(label,button);
      readyList.appendChild(panel);
    });
    // Keep Finished Tasks as a drop target even before the first task finishes.
    finishedSection.classList.remove('hidden');
    document.getElementById('finishedTaskCount').textContent = String(finishedList.children.length);
    Object.entries(lists).forEach(([status,list]) => {
      if (!list.children.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = isFilterActive() ? `No matching projects or tasks in ${statusLabel(status)}.` : ({
          queue:'New tasks will appear here.',
          in_progress:'Drag a task here when work begins.',
          coordination:'After all tasks are done, move the linked project here for In Review.',
          completed:'Fully delivered projects appear here.'
        })[status];
        list.appendChild(empty);
      }
    });
    const projectIds = {queue:new Set(),in_progress:new Set(),coordination:new Set(),completed:new Set()};
    visibleEntries.forEach(({project,boardStatus}) => projectIds[boardColumn(boardStatus)].add(project.id));
    for (const [status,id,badge] of [
      ['queue','queueCount','queueBadge'],['in_progress','progressCount','progressBadge'],
      ['coordination','coordinationCount','coordinationBadge'],['completed','doneCount','doneBadge']
    ]) {
      document.getElementById(id).textContent = String(projectIds[status].size);
      document.getElementById(badge).textContent = String(projectIds[status].size);
    }
  }

  function createWorkItemCard(project, workItem, aggregate = false) {
    const card = document.getElementById('projectCardTemplate').content.firstElementChild.cloneNode(true);
    const currentStatus = aggregate ? projectStatus(project) : workItem.status;
    const done = !aggregate && currentStatus === 'done';
    const total = project.workItems?.length || 1;
    const taskIndex = Math.max(0,(project.workItems || []).findIndex(item => item.id === workItem.id));
    const taskLabel = aggregate
      ? `${total} linked task${total === 1 ? '' : 's'} · ${(project.workItems || []).filter(i=>i.status==='done').length} done`
      : (workItem.task || 'Unassigned task');
    card.dataset.projectId = project.id;
    card.dataset.workItemId = workItem.id;
    card.classList.toggle('task-completed-card', done);
    card.classList.toggle('task-split-card', !aggregate);
    card.querySelector('.project-number').textContent = project.projectNumber || '—';
    const forecastLink = card.querySelector('.forecast-project-link');
    forecastLink.href = `../forecast/?project=${encodeURIComponent(project.projectNumber || '')}`;
    forecastLink.title = `Open ${project.projectNumber} in EWP Forecast`;
    forecastLink.addEventListener('click', event => event.stopPropagation());
    forecastLink.addEventListener('dragstart', event => event.stopPropagation());
    card.querySelector('.project-address').textContent = project.address || 'No address';
    card.querySelector('.project-task').textContent = taskLabel;
    card.querySelector('.customer-name').textContent = project.customer || '—';
    const phase = card.querySelector('.phase-pill');
    phase.textContent = project.phase || '—';
    phase.classList.add(String(project.phase || '').toLowerCase());
    card.querySelector('.project-type').textContent = displayProjectType(project);
    const tji = card.querySelector('.tji-indicator');
    tji.textContent = project.largeTji === 'Yes' ? '>14" TJI: Yes' : '>14" TJI: No';
    if (project.largeTji === 'Yes') tji.classList.add('flag-yes');
    const apl = card.querySelector('.apl-indicator');
    apl.textContent = project.aplRequired === 'Yes' ? 'APL: Yes' : 'APL: No';
    if (project.aplRequired === 'Yes') apl.classList.add('flag-yes');
    const due = card.querySelector('.due-date');
    due.textContent = formatDate(effectiveDueDate(project,workItem));
    if (!done && isWorkItemOverdue(project,workItem)) due.classList.add('overdue');
    card.querySelector('.assignee').textContent = aggregate ? uniqueSorted((project.workItems || []).map(item=>item.assignee)).join(', ') || '—' : workItem.assignee || '—';
    card.querySelector('.sales').textContent = project.sales || '—';
    card.classList.toggle('card-off-plate', aggregate && isOffPlate(project));
    card.querySelector('.compact-project-number').textContent = project.projectNumber || '—';
    card.querySelector('.compact-project-type').textContent = displayProjectType(project);
    card.querySelector('.compact-project-address').textContent = project.address || 'No address';
    card.querySelector('.compact-customer').textContent = project.customer || '—';
    card.querySelector('.compact-sales').textContent = project.sales || '—';
    const compactLinkage = card.querySelector('.compact-task-linkage');
    compactLinkage.classList.toggle('hidden',aggregate);
    compactLinkage.textContent = `↳ ${taskLabel}${total>1 ? ` · Task ${taskIndex+1}/${total}` : ''}`;
    card.querySelector('.compact-assignee').textContent = `Assigned: ${aggregate ? '—' : workItem.assignee || '—'}`;
    card.querySelector('.compact-due').textContent = `Due: ${formatDate(effectiveDueDate(project,workItem))}`;
    if (!done && isWorkItemOverdue(project,workItem)) card.querySelector('.compact-due').classList.add('overdue');
    const compactStatusPill = card.querySelector('.compact-status-pill');
    compactStatusPill.textContent = statusLabel(currentStatus);
    compactStatusPill.classList.add(`status-${currentStatus}`);
    const compactCoordinationSelect = card.querySelector('.compact-coordination-select');
    if (aggregate && COORDINATION_STATUSES.includes(currentStatus)) {
      compactStatusPill.classList.add('hidden');
      compactCoordinationSelect.classList.remove('hidden');
      compactCoordinationSelect.classList.add(`status-${currentStatus}`);
      compactCoordinationSelect.value = currentStatus;
      for (const eventName of ['click','pointerdown','mousedown','dragstart'])
        compactCoordinationSelect.addEventListener(eventName, event => event.stopPropagation());
      compactCoordinationSelect.addEventListener('change', event => {
        event.stopPropagation();
        moveProject(project.id,compactCoordinationSelect.value);
      });
    }
    const compactForecastLink = card.querySelector('.compact-forecast-link');
    compactForecastLink.href = forecastLink.href;
    compactForecastLink.setAttribute('aria-label',`Open ${project.projectNumber || 'project'} in EWP Forecast`);
    compactForecastLink.addEventListener('click', event => event.stopPropagation());
    compactForecastLink.addEventListener('dragstart', event => event.stopPropagation());
    const statusPill = card.querySelector('.card-project-status');
    statusPill.textContent = statusLabel(currentStatus);
    statusPill.classList.add(`status-${currentStatus}`);
    const statusControl = card.querySelector('.coordination-status-control');
    if (aggregate && COORDINATION_STATUSES.includes(currentStatus)) {
      statusControl.classList.remove('hidden');
      const selector = statusControl.querySelector('select');
      selector.value = currentStatus;
      for (const eventName of ['click','pointerdown','mousedown','dragstart'])
        statusControl.addEventListener(eventName,event=>event.stopPropagation());
      selector.addEventListener('change',event=>{
        event.stopPropagation();
        moveProject(project.id,selector.value);
      });
    }
    for (const control of card.querySelectorAll('.task-quick-action')) {
      if (aggregate) { control.classList.add('hidden'); continue; }
      const nextStatus = currentStatus === 'queue' ? 'in_progress' : currentStatus === 'in_progress' ? 'done' : 'in_progress';
      control.textContent = currentStatus === 'queue' ? 'Start task' : currentStatus === 'in_progress' ? 'Mark done ✓' : 'Reopen task';
      control.setAttribute('aria-label',`${control.textContent}: ${taskLabel}`);
      for (const ev of ['click','pointerdown','mousedown','dragstart']) {
        if (ev === 'click') control.addEventListener(ev,event=>{event.stopPropagation(); moveTask(project,workItem,nextStatus);});
        else control.addEventListener(ev,event=>event.stopPropagation());
      }
    }
    card.addEventListener('dragstart', event => {
      draggedWorkItem = {projectId:project.id,workItemId:aggregate?null:workItem.id,aggregate};
      dragOccurred = true;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain',JSON.stringify(draggedWorkItem));
    });
    card.addEventListener('dragend', () => {
      draggedWorkItem = null;
      card.classList.remove('dragging');
      document.querySelectorAll('.dropzone').forEach(zone=>zone.classList.remove('drag-over'));
      setTimeout(()=>{dragOccurred=false;},0);
    });
    card.addEventListener('click', () => { if (!dragOccurred) openEditProject(project.id,aggregate?null:workItem.id); });
    return card;
  }

  function renderList() {
    const body = document.getElementById('projectTableBody');
    const empty = document.getElementById('listEmptyState');
    body.innerHTML = '';
    const visibleEntries = getFilteredWorkItems();

    const sorted = [...visibleEntries].sort((a, b) => {
      const byProject = String(b.project.projectNumber || '').localeCompare(String(a.project.projectNumber || ''), undefined, { numeric: true });
      if (byProject) return byProject;
      return String(a.workItem.task || '').localeCompare(String(b.workItem.task || ''), undefined, { sensitivity: 'base' });
    });

    sorted.forEach(({ project, workItem }) => {
      const row = document.createElement('tr');
      row.className = 'project-table-row';
      row.title = 'Click to edit project';
      if (isWorkItemOverdue(project, workItem)) row.classList.add('row-overdue');

      const cells = [
        project.projectNumber || '—',
        project.address || '—',
        uniqueSorted((project.workItems||[]).map(item=>item.task)).join(', ') || '—',
        statusLabel(projectStatus(project)),
        project.customer || '—',
        project.sales || '—',
        project.phase || '—',
        displayProjectType(project),
        project.largeTji || 'No',
        project.aplRequired || 'No',
        formatDate(project.dateSubmitted),
        formatDate(project.dueDate),
        uniqueSorted((project.workItems||[]).map(item=>effectiveDueDate(project,item))).map(formatDate).join(', ') || '—',
        uniqueSorted((project.workItems||[]).map(item=>item.assignee)).join(', ') || '—'
      ];

      cells.forEach((value, index) => {
        const td = document.createElement('td');
        td.textContent = value;
        if (index === 0) {
          td.className = 'table-project-number';
          const link = document.createElement('a');
          link.href = `../forecast/?project=${encodeURIComponent(project.projectNumber || '')}`;
          link.className = 'tracker-forecast-inline';
          link.title = `Open ${project.projectNumber} in EWP Forecast`;
          link.textContent = ' ↗';
          link.addEventListener('click', event => event.stopPropagation());
          td.appendChild(link);
        }
        if (index === 3) {
          td.classList.add('table-status');
          const badge = document.createElement('span');
          badge.className = `status-pill status-${projectStatus(project)}`;
          badge.textContent = statusLabel(projectStatus(project));
          td.replaceChildren(badge);
        }
        if ((index === 11 || index === 12) && isWorkItemOverdue(project, workItem)) td.classList.add('overdue');
        row.appendChild(td);
      });

      row.addEventListener('click', () => openEditProject(project.id));
      body.appendChild(row);
    });

    if (!visibleEntries.length) {
      empty.textContent = projects.length && isFilterActive()
        ? 'No projects match the current search and filters.'
        : 'No projects yet.';
    }
    empty.classList.toggle('hidden', visibleEntries.length !== 0);
    document.querySelector('.project-table').classList.toggle('hidden', visibleEntries.length === 0);
  }

  // Follow-up: one row per project (not per work item), no new tables or mutations.
  // The sales choice is exact and case-insensitive to avoid accidental partial matches.
  function followUpMatch(actual, expected) {
    return String(actual || '').trim().toLocaleLowerCase() === String(expected || '').trim().toLocaleLowerCase();
  }

  function followUpSelectOptions(id, values, firstLabel) {
    const element = document.getElementById(id);
    const selected = element.value;
    element.replaceChildren();
    const blank = new Option(firstLabel, '');
    element.add(blank);
    uniqueSorted(values).forEach(value => element.add(new Option(value, value)));
    element.value = [...element.options].some(option => option.value === selected) ? selected : '';
  }

  function followUpProjectDeadlines(project) {
    // Completed work-item deadlines are not actionable for an overdue check.
    const dates = [project.dueDate,
      ...(project.workItems || []).map(item => item.dueDate)
    ].filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value || ''));
    return [...new Set(dates)];
  }

  function followUpVisibleProjects() {
    const sales = document.getElementById('followUpSales').value;
    if (!sales) return [];
    const type = document.getElementById('followUpType').value;
    const phase = document.getElementById('followUpPhase').value;
    const status = document.getElementById('followUpStatus').value;
    const assignee = document.getElementById('followUpAssignee').value;
    const due = document.getElementById('followUpDue').value;
    const search = document.getElementById('followUpSearch').value.trim().toLocaleLowerCase();
    const today = todayISO();
    const within30 = new Date(`${today}T12:00:00`);
    within30.setDate(within30.getDate() + 30);
    const maxDue = `${within30.getFullYear()}-${String(within30.getMonth()+1).padStart(2,'0')}-${String(within30.getDate()).padStart(2,'0')}`;
    return projects.filter(project => {
      if (!followUpMatch(project.sales, sales)) return false;
      const currentType = project.projectType === 'Other' ? 'Others' : project.projectType;
      if (type && !followUpMatch(currentType, type)) return false;
      if (phase && !followUpMatch(project.phase, phase)) return false;
      const state = projectStatus(project);
      if (status === 'open' && state === 'completed') return false;
      if (status && status !== 'open' && status !== state) return false;
      if (assignee && !(project.workItems || []).some(item => followUpMatch(item.assignee, assignee))) return false;
      if (search && ![project.projectNumber, project.customer, project.address]
        .some(value => String(value || '').toLocaleLowerCase().includes(search))) return false;
      const deadlines = followUpProjectDeadlines(project);
      if (due === 'no-date' && deadlines.length) return false;
      if (due === 'overdue' && (state === 'completed' || !deadlines.some(date => date < today))) return false;
      if (due === '30days' && !deadlines.some(date => date >= today && date <= maxDue)) return false;
      return true;
    }).sort((a, b) => String(a.projectNumber).localeCompare(String(b.projectNumber),undefined,{numeric:true}));
  }

  function followUpEmailText() {
    const sales = document.getElementById('followUpSales').value;
    const selectedProjects = followUpVisibleProjects().filter(project => followUpSelectedIds.has(project.id));
    if (!sales || !selectedProjects.length) return '';
    const types = new Set(selectedProjects.map(project => project.projectType));
    const queue = types.size === 1 && types.has('SFD') ? 'SFD'
      : types.size === 1 && types.has('Multi') ? 'multiplex'
      : [...types].some(type => type === 'Others' || type === 'Other') ? 'EWP'
      : 'SFD/multiplex';
    const projectLines = selectedProjects.map(project =>
      `${project.projectNumber || '—'} | ${project.customer || '—'} | ${project.address || '—'}`
    ).join('\n');
    const firstName = String(sales).trim().split(/\s+/)[0] || sales;
    return `Hi ${firstName},\n\n` +
      `We are currently updating our ${queue} queue of projects drawn in Javelin for layouts.\n\n` +
      `Could you update us on the status of the following projects? Any information would be helpful, including upcoming delivery dates, orders you have written (and for which levels), or projects that are no longer moving ahead.\n\n` +
      `${projectLines}\n\nThank you!`;
  }

  function renderFollowUpEmail() {
    const box = document.getElementById('followUpEmail');
    const copy = document.getElementById('followUpCopy');
    const subject = document.getElementById('followUpSubject');
    if (!followUpEmailDirty) box.value = followUpEmailText();
    if (!followUpSubjectDirty) subject.value = 'Request for Project Status Updates';
    copy.disabled = !followUpSelectedIds.size || !box.value.trim();
    document.getElementById('followUpCopySubject').disabled = !followUpSelectedIds.size || !subject.value.trim();
    const visible = followUpVisibleProjects();
    document.getElementById('followUpSelectAll').disabled = !visible.length || visible.every(project => followUpSelectedIds.has(project.id));
    document.getElementById('followUpClear').disabled = followUpSelectedIds.size === 0;
    document.getElementById('followUpSelectedCount').textContent =
      `${followUpSelectedIds.size} project${followUpSelectedIds.size === 1 ? '' : 's'} selected for email.`;
  }

  function followUpSelectionChanged() {
    followUpEmailDirty = false; // never let an edited draft silently contain the wrong project list
    document.getElementById('followUpCopyStatus').textContent = '';
    renderFollowUpEmail();
  }

  function renderFollowUp() {
    const salesEl = document.getElementById('followUpSales');
    const previousSales = salesEl.value;
    followUpSelectOptions('followUpSales', [...(settings.sales || []), ...projects.map(project => project.sales)], 'Choose salesperson…');
    followUpSelectOptions('followUpAssignee', [...(settings.assignees || []), ...allWorkItemEntries().map(entry => entry.workItem.assignee)], 'All assignees');
    if (previousSales !== salesEl.value) { followUpSelectedIds.clear(); followUpEmailDirty = false; followUpSubjectDirty = false; }

    const visible = followUpVisibleProjects();
    const visibleIds = new Set(visible.map(project => project.id));
    let selectionChanged = false;
    for (const id of followUpSelectedIds) {
      if (!visibleIds.has(id)) { followUpSelectedIds.delete(id); selectionChanged = true; }
    }
    if (selectionChanged) followUpEmailDirty = false;

    const list = document.getElementById('followUpProjectList');
    list.replaceChildren();
    if (!salesEl.value || !visible.length) {
      const msg = document.createElement('div');
      msg.className = 'followup-empty';
      msg.textContent = !salesEl.value ? 'Choose a salesperson to view their projects.' : 'No projects match these filters.';
      list.appendChild(msg);
    }
    visible.forEach(project => {
      const row = document.createElement('label');
      row.className = 'followup-project-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = project.id;
      checkbox.checked = followUpSelectedIds.has(project.id);
      checkbox.setAttribute('aria-label', `Include ${project.projectNumber || project.address} in follow-up`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) followUpSelectedIds.add(project.id);
        else followUpSelectedIds.delete(project.id);
        row.classList.toggle('selected', checkbox.checked);
        followUpSelectionChanged();
      });
      const main = document.createElement('span');
      main.className = 'followup-project-main';
      const title = document.createElement('strong');
      title.textContent = `${project.projectNumber || '—'} · ${project.customer || '—'}`;
      const address = document.createElement('small');
      address.textContent = project.address || 'No address';
      const tags = document.createElement('span');
      tags.className = 'followup-project-tags';
      [displayProjectType(project), project.phase || '—', statusLabel(projectStatus(project)),
        `Due ${formatDate(project.dueDate)}`].forEach(text => {
        const tag = document.createElement('span');
        tag.textContent = text;
        tags.appendChild(tag);
      });
      main.append(title, address, tags);
      row.append(checkbox, main);
      list.appendChild(row);
    });
    document.getElementById('followUpResultCount').textContent = salesEl.value
      ? `${visible.length} matching project${visible.length === 1 ? '' : 's'}`
      : 'Choose a salesperson to see projects.';
    document.getElementById('followUpSelectAll').disabled = !visible.length || visible.every(project => followUpSelectedIds.has(project.id));
    document.getElementById('followUpClear').disabled = followUpSelectedIds.size === 0;
    renderFollowUpEmail();
  }

  async function copyFollowUpField(id, label) {
    const field = document.getElementById(id);
    const status = document.getElementById('followUpCopyStatus');
    if (!followUpSelectedIds.size || !field.value.trim()) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(field.value);
      else {
        field.focus(); field.select();
        if (!document.execCommand('copy')) throw new Error('Copy not supported');
      }
      status.textContent = `${label} copied. Paste it into your email client and review before sending.`;
    } catch {
      field.focus(); field.select();
      status.textContent = `Automatic copy unavailable. ${label} selected—use Ctrl+C or Cmd+C.`;
    }
  }

  function getComboValues(combo) {
    const key = combo.dataset.combo;
    return Array.isArray(settings[key]) ? settings[key] : [];
  }

  function renderComboMenu(combo, query = '') {
    const menu = combo.querySelector('.combo-menu');
    if (!menu) return;
    const values = getComboValues(combo);
    const q = query.trim().toLowerCase();
    const filtered = values.filter(value => value.toLowerCase().includes(q));
    menu.innerHTML = '';

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'combo-empty';
      empty.textContent = values.length ? 'No matching saved names' : 'No saved names yet';
      menu.appendChild(empty);
      return;
    }

    filtered.forEach(value => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'combo-option';
      option.textContent = value;
      option.setAttribute('role', 'option');
      option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => {
        const input = combo.querySelector('input');
        input.value = value;
        combo.classList.remove('open');
        input.focus();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      menu.appendChild(option);
    });
  }

  function bindCombo(combo) {
    if (!combo || combo.dataset.bound === '1') return;
    combo.dataset.bound = '1';
    const input = combo.querySelector('input');
    const toggle = combo.querySelector('.combo-toggle');
    if (!input || !toggle) return;

    input.addEventListener('focus', () => {
      closeAllCombos(combo);
      renderComboMenu(combo, input.value);
      combo.classList.add('open');
    });
    input.addEventListener('input', () => {
      renderComboMenu(combo, input.value);
      combo.classList.add('open');
    });
    toggle.addEventListener('click', () => {
      const willOpen = !combo.classList.contains('open');
      closeAllCombos(combo);
      if (willOpen) {
        renderComboMenu(combo, '');
        combo.classList.add('open');
        input.focus();
      }
    });
  }

  function setupCombos() {
    document.querySelectorAll('.combo-field').forEach(bindCombo);
    document.addEventListener('click', event => {
      if (!event.target.closest('.combo-field')) closeAllCombos();
    });
  }

  function closeAllCombos(except = null) {
    document.querySelectorAll('.combo-field.open').forEach(combo => {
      if (combo !== except) combo.classList.remove('open');
    });
  }

  function refreshAllComboMenus() {
    document.querySelectorAll('.combo-field').forEach(combo => {
      bindCombo(combo);
      const input = combo.querySelector('input');
      renderComboMenu(combo, input?.value || '');
    });
  }

  function fillTaskSelect(select, currentValue = '') {
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = settings.tasks.length ? 'Select task' : 'Set up tasks in Settings';
    placeholder.disabled = true;
    placeholder.selected = !currentValue;
    select.appendChild(placeholder);

    const options = [...settings.tasks];
    if (currentValue && !options.some(value => value.toLowerCase() === currentValue.toLowerCase())) options.push(currentValue);
    options.forEach(task => {
      const option = document.createElement('option');
      option.value = task;
      option.textContent = task;
      if (task === currentValue) option.selected = true;
      select.appendChild(option);
    });
  }

  function refreshWorkItemTaskSelects() {
    document.querySelectorAll('.work-item-task-select').forEach(select => {
      const current = select.value;
      fillTaskSelect(select, current);
    });
  }

  function projectDueInput(mode) {
    return document.getElementById(mode === 'new' ? 'dueDate' : 'editDueDate');
  }

  function refreshInheritedTaskDueDates(mode) {
    const container = document.getElementById(mode === 'new' ? 'newWorkItemsContainer' : 'editWorkItemsContainer');
    const inherited = projectDueInput(mode).value || '';
    container.querySelectorAll('.work-item-editor[data-due-inherited="true"] .work-item-due').forEach(input => {
      input.value = inherited;
    });
  }

  function createWorkItemEditor(item = {}, mode = 'edit') {
    const row = document.createElement('div');
    row.className = 'work-item-editor';
    row.dataset.workItemId = item.id || '';
    row.dataset.dueInherited = item.dueDate ? 'false' : 'true';

    const top = document.createElement('div');
    top.className = 'work-item-editor-top';

    const number = document.createElement('span');
    number.className = 'work-item-number';
    number.textContent = 'Task';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'work-item-remove';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      const container = row.parentElement;
      if (!container) return;
      if (container.querySelectorAll('.work-item-editor').length <= 1) {
        window.alert('A project must have at least one work item.');
        return;
      }
      closeAllCombos();
      row.remove();
      renumberWorkItemEditors(container);
    });
    top.append(number, remove);

    const grid = document.createElement('div');
    grid.className = 'work-item-grid';

    const taskLabel = document.createElement('label');
    taskLabel.innerHTML = '<span>Task</span>';
    const taskSelect = document.createElement('select');
    taskSelect.className = 'work-item-task-select';
    taskSelect.required = true;
    fillTaskSelect(taskSelect, item.task || '');
    taskLabel.appendChild(taskSelect);

    const assigneeLabel = document.createElement('label');
    assigneeLabel.innerHTML = '<span>Assignee</span>';
    const combo = document.createElement('div');
    combo.className = 'combo-field';
    combo.dataset.combo = 'assignees';
    const assigneeInput = document.createElement('input');
    assigneeInput.type = 'text';
    assigneeInput.className = 'work-item-assignee';
    assigneeInput.placeholder = 'Choose or type an assignee';
    assigneeInput.autocomplete = 'off';
    assigneeInput.required = true;
    assigneeInput.value = item.assignee || '';
    const comboToggle = document.createElement('button');
    comboToggle.type = 'button';
    comboToggle.className = 'combo-toggle';
    comboToggle.setAttribute('aria-label', 'Show assignee names');
    comboToggle.textContent = '▾';
    const comboMenu = document.createElement('div');
    comboMenu.className = 'combo-menu';
    comboMenu.setAttribute('role', 'listbox');
    combo.append(assigneeInput, comboToggle, comboMenu);
    assigneeLabel.appendChild(combo);

    const dueLabel = document.createElement('label');
    dueLabel.innerHTML = '<span>Task Due Date <small>(defaults to project)</small></span>';
    const dueInput = document.createElement('input');
    dueInput.type = 'date';
    dueInput.className = 'work-item-due';
    dueInput.value = item.dueDate || projectDueInput(mode).value || '';
    dueInput.addEventListener('change', () => { row.dataset.dueInherited = 'false'; });
    const dueDefault = document.createElement('button');
    dueDefault.type = 'button';
    dueDefault.className = 'work-item-use-default';
    dueDefault.textContent = '↺ Use project due date';
    dueDefault.title = 'Follow future changes to the project due date';
    dueDefault.addEventListener('click', () => {
      row.dataset.dueInherited = 'true';
      dueInput.value = projectDueInput(mode).value || '';
    });
    dueLabel.append(dueInput,dueDefault);

    const statusLabelEl = document.createElement('label');
    statusLabelEl.innerHTML = '<span>Task Status</span>';
    const statusSelect = document.createElement('select');
    statusSelect.className = 'work-item-status';
    for (const [value,label] of [['queue','Queue'],['in_progress','In Progress'],['done','Done (task only)']]) {
      const opt = document.createElement('option');
      opt.value = value;opt.textContent = label;
      statusSelect.add(opt);
    }
    statusSelect.value = normalizeStatus(item.status || 'queue');
    statusLabelEl.appendChild(statusSelect);
    grid.append(taskLabel,assigneeLabel,dueLabel,statusLabelEl);
    row.append(top, grid);
    bindCombo(combo);
    renderComboMenu(combo, assigneeInput.value);
    return row;
  }

  function renumberWorkItemEditors(container) {
    container.querySelectorAll('.work-item-editor').forEach((row, index) => {
      const label = row.querySelector('.work-item-number');
      if (label) label.textContent = `Task ${index + 1}`;
    });
  }

  function addWorkItemEditor(containerId, item = {}, mode = 'edit') {
    const container = document.getElementById(containerId);
    const row = createWorkItemEditor(item, mode);
    container.appendChild(row);
    renumberWorkItemEditors(container);
    return row;
  }

  function collectWorkItems(containerId, errorEl, existingProject = null) {
    const container = document.getElementById(containerId);
    const rows = [...container.querySelectorAll('.work-item-editor')];
    if (!rows.length) {
      errorEl.textContent = 'Add at least one work item.';
      return null;
    }

    const now = new Date().toISOString();
    const existingById = new Map((existingProject?.workItems || []).map(item => [item.id, item]));
    const items = [];

    for (const row of rows) {
      const task = row.querySelector('.work-item-task-select')?.value || '';
      const assignee = row.querySelector('.work-item-assignee')?.value.trim() || '';
      // Keep NULL on inherited tasks so later project date changes propagate.
      const dueDate = row.dataset.dueInherited === 'true' ? '' : row.querySelector('.work-item-due')?.value || '';
      const status = normalizeStatus(row.querySelector('.work-item-status')?.value || 'queue');
      if (!task) {
        errorEl.textContent = 'Every work item needs a Task.';
        return null;
      }
      if (!assignee) {
        errorEl.textContent = 'Every work item needs an Assignee.';
        return null;
      }

      const id = row.dataset.workItemId || uid('task');
      const previous = existingById.get(id);
      let startedAt = previous?.startedAt || null;
      let completedAt = previous?.completedAt || null;
      if (status === 'in_progress' && !startedAt) startedAt = now;
      if (status === 'done' && previous?.status !== 'done') completedAt = now;
      if (status !== 'done') completedAt = null;

      items.push({
        id,
        task,
        assignee,
        dueDate,
        status,
        createdAt: previous?.createdAt || now,
        updatedAt: now,
        startedAt,
        completedAt
      });
    }
    return items;
  }

  function renderSettingsPage() {
    renderSettingList('sales', 'salesSettingsList', 'salesSettingsCount');
    renderSettingList('assignees', 'assigneeSettingsList', 'assigneeSettingsCount');
    renderSettingList('tasks', 'taskSettingsList', 'taskSettingsCount');
  }

  function renderSettingList(key, listId, countId) {
    const list = document.getElementById(listId);
    list.innerHTML = '';
    const values = settings[key] || [];
    document.getElementById(countId).textContent = values.length;

    if (!values.length) {
      const empty = document.createElement('div');
      empty.className = 'setting-empty';
      empty.textContent = 'None added yet.';
      list.appendChild(empty);
      return;
    }

    values.forEach(value => {
      const chip = document.createElement('span');
      chip.className = 'setting-chip';
      const text = document.createElement('span');
      text.textContent = value;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = `Remove ${value}`;
      remove.addEventListener('click', () => withCloud(() => removeSetting(key, value))); 
      chip.append(text, remove);
      list.appendChild(chip);
    });
  }

  async function addSetting(key, rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return false;
    if (settings[key].some(existing => existing.toLowerCase() === value.toLowerCase())) return false;
    settings[key].push(value);
    settings[key].sort((a, b) => a.localeCompare(b));
    await addSettingCloud();
    render();
    return true;
  }

  async function removeSetting(key, value) {
    settings[key] = settings[key].filter(item => item !== value);
    await addSettingCloud();
    render();
  }

  function setProjectTypeConditional(selectId, wrapId, inputId) {
    const select = document.getElementById(selectId);
    const wrap = document.getElementById(wrapId);
    const input = document.getElementById(inputId);
    const isOther = select.value === 'Others';
    wrap.classList.toggle('hidden', !isOther);
    input.required = isOther;
    if (!isOther) input.value = '';
  }

  function prepareNewProjectForm(clearAll = false) {
    if (clearAll) projectForm.reset();
    const next = getNextSequence();
    document.getElementById('projectPrefix').textContent = currentPrefix();
    document.getElementById('projectSuffix').value = next <= 999 ? String(next).padStart(3, '0') : '';
    if (!document.getElementById('dateSubmitted').value) document.getElementById('dateSubmitted').value = todayISO();
    if (clearAll) {
      projectForm.querySelector('input[name="largeTji"][value="No"]').checked = true;
      projectForm.querySelector('input[name="aplRequired"][value="No"]').checked = true;
      const container = document.getElementById('newWorkItemsContainer');
      container.innerHTML = '';
      addWorkItemEditor('newWorkItemsContainer', { status: 'queue' }, 'new');
    }
    setProjectTypeConditional('projectType', 'projectTypeOtherWrap', 'projectTypeOther');
    document.getElementById('formError').textContent = '';
    refreshAllComboMenus();
  }

  function validateDates(submitted, due, errorEl) {
    if (submitted && due && due < submitted) {
      errorEl.textContent = 'Due date cannot be earlier than Date Submitted.';
      return false;
    }
    return true;
  }

  function validateWorkItemDates(workItems, submitted, errorEl) {
    const invalid = workItems.find(item => item.dueDate && submitted && item.dueDate < submitted);
    if (invalid) {
      errorEl.textContent = `Task due date for “${invalid.task}” cannot be earlier than Date Submitted.`;
      return false;
    }
    return true;
  }

  async function moveTask(project,workItem,destinationStatus) {
    if (!cloudReady || isOffPlate(project)) return;
    if (!['queue','in_progress','done'].includes(destinationStatus) || workItem.status === destinationStatus) return;
    await withCloud(async () => {
      await moveTrackerWorkItem(workItem.id,destinationStatus);
      await syncCloud(`${project.projectNumber} · ${workItem.task} → ${statusLabel(destinationStatus)}`);
      announceProjectChange();
    });
  }

  async function moveProject(projectId,destinationStatus,expectedVersion=null) {
    if (!cloudReady) return;
    const project = projects.find(item => item.id === projectId);
    if (!project) return;
    const current = projectStatus(project);
    const next = destinationStatus === 'coordination' ? 'in_review' : destinationStatus;
    if (!PROJECT_STATUSES.includes(next) || (boardColumn(current) === destinationStatus && destinationStatus === 'coordination') || current === next) return;
    if (destinationStatus === 'coordination' && !allTasksDone(project) && !isOffPlate(project)) {
      alert('Finish all linked tasks first. Then use “Move to Coordination” to move the project into In Review.');
      return;
    }
    if (next === 'completed' && !isOffPlate(project)) {
      alert('Completed means the entire job has been delivered. Move the project through Coordination first.');
      return;
    }
    // Reopen only the selected task when an off-plate project is pulled back
    // onto the EWP plate. Keep all other completed tasks in their history.
    let reopen = null;
    if (isOffPlate(project) && ['queue','in_progress'].includes(next) &&
        !(project.workItems || []).some(item => item.status !== 'done') && project.workItems?.length) {
      if (project.workItems.length === 1) reopen = project.workItems[0];
      else {
        const choice = prompt(`Which task should be reopened for ${project.projectNumber}?\n${project.workItems.map((item,i)=>`${i+1}. ${item.task}`).join('\n')}\nEnter the task number (Cancel to keep the project as-is).`);
        if (choice === null) return;
        const idx = Number(choice);
        if (!Number.isInteger(idx) || idx < 1 || idx > project.workItems.length) {
          alert('Please choose a valid task number. No changes were made.');
          return;
        }
        reopen = project.workItems[idx-1];
      }
    }
    await withCloud(async () => {
      await setTrackerProjectStatus(project.id,next,expectedVersion ?? project.version);
      if (reopen) await moveTrackerWorkItem(reopen.id,next);
      await syncCloud(`Project moved to ${statusLabel(next)}`);
      announceProjectChange();
    });
  }

  function openEditProject(projectId, focusWorkItemId = null) {
    const project = projects.find(item => item.id === projectId);
    if (!project) return;
    editingProjectId = projectId;
    document.getElementById('editDialogTitle').textContent = `${project.projectNumber} · ${statusLabel(projectStatus(project))}`;
    document.getElementById('editProjectStatus').value = projectStatus(project);
    const isTcNumber=/^TC\d{5}$/i.test(project.projectNumber);
    document.getElementById('editProjectPrefix').textContent = isTcNumber ? projectPrefix(project.projectNumber) : project.projectNumber;
    document.getElementById('editProjectSuffix').value = isTcNumber ? projectSuffix(project.projectNumber) : '';
    document.getElementById('editProjectSuffix').disabled = !isTcNumber;
    document.getElementById('editProjectSuffix').required = isTcNumber;
    document.getElementById('editProjectSuffix').classList.toggle('hidden',!isTcNumber);
    document.getElementById('editSales').value = project.sales || '';
    document.getElementById('editCustomer').value = project.customer || '';
    document.getElementById('editAddress').value = project.address || '';
    document.getElementById('editPhase').value = project.phase || 'Awarded';
    document.getElementById('editProjectType').value = project.projectType || 'SFD';
    document.getElementById('editProjectTypeOther').value = project.projectTypeOther || '';
    setProjectTypeConditional('editProjectType', 'editProjectTypeOtherWrap', 'editProjectTypeOther');
    editForm.querySelector(`input[name="editLargeTji"][value="${project.largeTji === 'Yes' ? 'Yes' : 'No'}"]`).checked = true;
    editForm.querySelector(`input[name="editAplRequired"][value="${project.aplRequired === 'Yes' ? 'Yes' : 'No'}"]`).checked = true;
    document.getElementById('editDateSubmitted').value = project.dateSubmitted || '';
    document.getElementById('editDueDate').value = project.dueDate || '';

    const container = document.getElementById('editWorkItemsContainer');
    container.innerHTML = '';
    (project.workItems || []).forEach(item => {
      const row = addWorkItemEditor('editWorkItemsContainer', item, 'edit');
      if (focusWorkItemId && item.id === focusWorkItemId) row.classList.add('focused-work-item');
    });
    if (!project.workItems?.length) addWorkItemEditor('editWorkItemsContainer', { status: 'queue' }, 'edit');

    document.getElementById('editError').textContent = '';
    refreshAllComboMenus();
    editDialog.showModal();
    if (focusWorkItemId) {
      setTimeout(() => container.querySelector('.focused-work-item')?.scrollIntoView({ block: 'nearest' }), 0);
    }
  }

  function closeEditProject() {
    if (editDialog.open) editDialog.close();
    editingProjectId = null;
    closeAllCombos();
  }

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });
  document.getElementById('followUpSales').addEventListener('change', () => {
    followUpSelectedIds.clear(); followUpSelectionChanged(); renderFollowUp();
  });
  for (const id of ['followUpType','followUpPhase','followUpStatus','followUpAssignee','followUpDue']) {
    document.getElementById(id).addEventListener('change', renderFollowUp);
  }
  document.getElementById('followUpSearch').addEventListener('input', renderFollowUp);
  document.getElementById('followUpSelectAll').addEventListener('click', () => {
    followUpVisibleProjects().forEach(project => followUpSelectedIds.add(project.id));
    followUpSelectionChanged(); renderFollowUp();
  });
  document.getElementById('followUpClear').addEventListener('click', () => {
    followUpSelectedIds.clear(); followUpSelectionChanged(); renderFollowUp();
  });
  document.getElementById('followUpEmail').addEventListener('input', () => {
    followUpEmailDirty = true;
    document.getElementById('followUpCopyStatus').textContent = '';
    renderFollowUpEmail();
  });
  document.getElementById('followUpCopy').addEventListener('click', () => copyFollowUpField('followUpEmail','Email body'));
  document.getElementById('followUpCopySubject').addEventListener('click', () => copyFollowUpField('followUpSubject','Subject'));
  document.getElementById('followUpSubject').addEventListener('input', () => {
    followUpSubjectDirty = true;
    document.getElementById('followUpCopyStatus').textContent = '';
    renderFollowUpEmail();
  });
  document.querySelectorAll('.add-project-trigger').forEach(button => button.addEventListener('click', openAddProject));
  document.getElementById('settingsButton').addEventListener('click', () => switchView('settings'));
  document.getElementById('closeSettingsView').addEventListener('click', returnToPrimaryView);
  document.getElementById('cancelAddProjectTop').addEventListener('click', returnToPrimaryView);
  document.getElementById('cancelAddProject').addEventListener('click', returnToPrimaryView);

  document.getElementById('projectType').addEventListener('change', () => {
    setProjectTypeConditional('projectType', 'projectTypeOtherWrap', 'projectTypeOther');
  });
  document.getElementById('editProjectType').addEventListener('change', () => {
    setProjectTypeConditional('editProjectType', 'editProjectTypeOtherWrap', 'editProjectTypeOther');
  });

  document.getElementById('projectSuffix').addEventListener('input', event => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 3);
  });
  document.getElementById('editProjectSuffix').addEventListener('input', event => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 3);
  });

  document.getElementById('dueDate').addEventListener('change', () => refreshInheritedTaskDueDates('new'));
  document.getElementById('editDueDate').addEventListener('change', () => refreshInheritedTaskDueDates('edit'));
  document.getElementById('addNewWorkItem').addEventListener('click', () => {
    addWorkItemEditor('newWorkItemsContainer', { status: 'queue' }, 'new');
  });
  document.getElementById('addEditWorkItem').addEventListener('click', () => {
    addWorkItemEditor('editWorkItemsContainer', { status: 'queue' }, 'edit');
  });

  projectForm.addEventListener('submit', async event => {
    event.preventDefault();
    const error = document.getElementById('formError');
    error.textContent = '';
    if (!projectForm.checkValidity()) {
      projectForm.reportValidity();
      return;
    }
    if (!settings.tasks.length) {
      error.textContent = 'Add at least one Task in Settings before creating a project.';
      return;
    }

    const prefix = currentPrefix();
    const projectNumber = buildProjectNumber(prefix, document.getElementById('projectSuffix').value);
    if (!projectNumber) {
      error.textContent = 'Project number must end in exactly 3 digits.';
      return;
    }
    if (isDuplicateProjectNumber(projectNumber)) {
      error.textContent = `${projectNumber} already exists. Choose a different last 3 digits.`;
      return;
    }

    const submitted = document.getElementById('dateSubmitted').value;
    const due = document.getElementById('dueDate').value;
    if (!validateDates(submitted, due, error)) return;
    const workItems = collectWorkItems('newWorkItemsContainer', error);
    if (!workItems || !validateWorkItemDates(workItems, submitted, error)) return;

    await withCloud(async()=>{
      const now=new Date().toISOString();
      const payload={
        projectNumber,autoNumber:projectNumber===nextProjectNumber(), sales:document.getElementById('sales').value.trim(),
        customer:document.getElementById('customer').value.trim(),
        address:document.getElementById('address').value.trim(),
        phase:document.getElementById('phase').value,
        projectType:document.getElementById('projectType').value,
        projectTypeOther:document.getElementById('projectTypeOther').value.trim(),
        largeTji:projectForm.querySelector('input[name="largeTji"]:checked')?.value||'No',
        aplRequired:projectForm.querySelector('input[name="aplRequired"]:checked')?.value||'No',
        dateSubmitted:submitted,dueDate:due
      };
      const created=await saveTrackerProject(payload,workItems.map(item=>({...item,id:item.id||crypto.randomUUID(),createdAt:now})),null);
      await syncCloud(`Project ${created?.project_number || projectNumber} created in Supabase`);
      announceProjectChange();
      prepareNewProjectForm(true);
      switchView('board');
    });
  });

  document.getElementById('clearProjectForm').addEventListener('click', () => prepareNewProjectForm(true));

  editForm.addEventListener('submit', async event => {
    event.preventDefault();
    const error = document.getElementById('editError');
    error.textContent = '';
    if (!editingProjectId) return;
    if (!editForm.checkValidity()) {
      editForm.reportValidity();
      return;
    }

    const project = projects.find(item => item.id === editingProjectId);
    if (!project) return;
    const prefix = document.getElementById('editProjectPrefix').textContent.trim();
    const projectNumber = /^TC\d{2}$/i.test(prefix) ? buildProjectNumber(prefix, document.getElementById('editProjectSuffix').value) : project.projectNumber;
    if (!projectNumber) {
      error.textContent = 'Project number must end in exactly 3 digits.';
      return;
    }
    if (isDuplicateProjectNumber(projectNumber, project.id)) {
      error.textContent = `${projectNumber} already exists. Choose a different last 3 digits.`;
      return;
    }

    const submitted = document.getElementById('editDateSubmitted').value;
    const due = document.getElementById('editDueDate').value;
    if (!validateDates(submitted, due, error)) return;
    const workItems = collectWorkItems('editWorkItemsContainer', error, project);
    if (!workItems || !validateWorkItemDates(workItems, submitted, error)) return;
    const selectedStatus = document.getElementById('editProjectStatus').value;
    if (COORDINATION_STATUSES.includes(selectedStatus) && !isOffPlate(project) && workItems.some(item=>item.status!=='done')) {
      error.textContent = 'All work items must be Done before moving the project to Coordination.';
      return;
    }
    if (selectedStatus === 'completed' && !isOffPlate(project)) {
      error.textContent = 'A project must enter Coordination before it can be marked fully delivered.';
      return;
    }

    await withCloud(async()=>{
      const payload={
        id:project.id,projectNumber,
        sales:document.getElementById('editSales').value.trim(),
        customer:document.getElementById('editCustomer').value.trim(),
        address:document.getElementById('editAddress').value.trim(),
        phase:document.getElementById('editPhase').value,
        projectType:document.getElementById('editProjectType').value,
        projectTypeOther:document.getElementById('editProjectTypeOther').value.trim(),
        largeTji:editForm.querySelector('input[name="editLargeTji"]:checked')?.value||'No',
        aplRequired:editForm.querySelector('input[name="editAplRequired"]:checked')?.value||'No',
        dateSubmitted:submitted,dueDate:due
      };
      await saveTrackerProject(payload,workItems.map(item=>({...item,id:item.id||crypto.randomUUID()})),project.version);
      if (selectedStatus !== (project.projectStatus || projectStatus(project))) {
        // tracker_save_project increments version once. Apply a second, version-
        // checked status change rather than modifying the legacy Forecast RPC.
        await setTrackerProjectStatus(project.id, selectedStatus, project.version + 1);
      }
      closeEditProject();
      await syncCloud('Project changes saved');
      announceProjectChange();
    });
  });

  document.getElementById('deleteProject').addEventListener('click', async () => {
    if (!editingProjectId) return;
    const project = projects.find(item => item.id === editingProjectId);
    if (!project) return;
    const count = project.workItems?.length || 0;
    const confirmed = window.confirm(`Delete ${project.projectNumber} and its ${count} work item${count === 1 ? '' : 's'}?\n\nThis cannot be undone. The automatic project-number counter will NOT move backward.`);
    if (!confirmed) return;
    await withCloud(async()=>{
      await deleteTrackerProject(project.id,project.version);
      closeEditProject();
      await syncCloud('Project removed');
      announceProjectChange();
    });
  });

  document.querySelectorAll('.setting-add-row').forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const input = form.querySelector('input');
      await withCloud(async()=>{
        if (await addSetting(form.dataset.setting,input.value)) input.value='';
      });
    });
  });

  [...Object.values(lists),document.getElementById('finishedTaskList')].forEach(zone => {
    zone.addEventListener('dragover', event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', event => {
      if (!zone.contains(event.relatedTarget)) zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', event => {
      event.preventDefault();
      zone.classList.remove('drag-over');
      let payload = draggedWorkItem;
      if (!payload) {
        try { payload = JSON.parse(event.dataTransfer.getData('text/plain')); } catch { payload = null; }
      }
      if (!payload?.projectId) return;
      const project = projects.find(item => item.id === payload.projectId);
      if (!project) return;
      const destination = zone.dataset.status;
      if (payload.aggregate) {
        if (destination === 'done') return;
        moveProject(project.id,destination);
      } else {
        const item = project.workItems.find(task => task.id === payload.workItemId);
        if (!item) return;
        if (['queue','in_progress','done'].includes(destination)) moveTask(project,item,destination);
        else if (destination === 'coordination') moveProject(project.id,destination);
        else alert('This is a task, not a fully delivered project. Mark the task Done first, then move the project through Coordination.');
      }
    });
  });

  document.getElementById('closeEditDialog').addEventListener('click', closeEditProject);
  document.getElementById('cancelEdit').addEventListener('click', closeEditProject);
  editDialog.addEventListener('click', event => {
    if (event.target === editDialog) closeEditProject();
  });
  editDialog.addEventListener('close', () => {
    editingProjectId = null;
    closeAllCombos();
  });

  document.getElementById('projectSearch').addEventListener('input', () => {
    markFilterAsCustom();
    renderFilterDrivenViews();
  });
  document.getElementById('filterToggleButton').addEventListener('click', () => {
    document.getElementById('filterPanel').classList.toggle('hidden');
    closeFilterMenus();
  });
  document.getElementById('clearAllFilters').addEventListener('click', clearAllFilters);

  // The three Coordination pills are shortcuts to the EXISTING Status filter;
  // they share saved-filter chips, counts, and Clear rather than creating a second filter state.
  document.querySelectorAll('[data-coordination-status]').forEach(button => {
    button.addEventListener('click', () => {
      const status = button.dataset.coordinationStatus;
      activeFilters.status = activeFilters.status.length === 1 && activeFilters.status[0] === status ? [] : [status];
      markFilterAsCustom();
      renderFilterDrivenViews();
    });
  });
  document.querySelectorAll('[data-board-density]').forEach(button => {
    button.addEventListener('click', () => setBoardDensity(button.dataset.boardDensity));
  });
  setBoardDensity(boardDensity);

  document.querySelectorAll('.multi-select-filter').forEach(container => {
    container.querySelector('.multi-filter-trigger').addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = !container.classList.contains('open');
      closeFilterMenus(container);
      container.classList.toggle('open', willOpen);
    });
    container.querySelector('.multi-filter-menu').addEventListener('click', event => event.stopPropagation());
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.multi-select-filter')) closeFilterMenus();
  });

  document.getElementById('savedFilterSelect').addEventListener('change', event => {
    const id = event.target.value;
    if (!id) {
      activeSavedFilterId = '';
      document.getElementById('deleteSavedFilter').classList.add('hidden');
      return;
    }
    applySavedFilter(id);
  });

  const saveFilterDialog = document.getElementById('saveFilterDialog');
  document.getElementById('saveCurrentFilter').addEventListener('click', () => {
    document.getElementById('savedFilterName').value = '';
    document.getElementById('saveFilterError').textContent = '';
    saveFilterDialog.showModal();
    setTimeout(() => document.getElementById('savedFilterName').focus(), 0);
  });
  document.getElementById('closeSaveFilterDialog').addEventListener('click', () => saveFilterDialog.close());
  document.getElementById('cancelSaveFilter').addEventListener('click', () => saveFilterDialog.close());
  saveFilterDialog.addEventListener('click', event => {
    if (event.target === saveFilterDialog) saveFilterDialog.close();
  });

  document.getElementById('saveFilterForm').addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.getElementById('savedFilterName');
    const error = document.getElementById('saveFilterError');
    const name = input.value.trim();
    error.textContent = '';
    if (!name) {
      error.textContent = 'Enter a name for this saved filter.';
      return;
    }
    if (savedFilters.some(item => item.name.toLowerCase() === name.toLowerCase())) {
      error.textContent = 'A saved filter with this name already exists.';
      return;
    }
    const saved = {
      id: uid('filter'),
      name,
      search: document.getElementById('projectSearch').value.trim(),
      filters: Object.fromEntries(Object.entries(activeFilters).map(([key, values]) => [key, [...values]])),
      createdAt: new Date().toISOString()
    };
    await withCloud(async()=>{
      await addTrackerFilter(saved);
      savedFilters.push(saved);
      activeSavedFilterId=saved.id;
      saveFilterDialog.close();
      renderFilterControls();
    });
  });

  document.getElementById('deleteSavedFilter').addEventListener('click', async () => {
    const saved = savedFilters.find(item => item.id === activeSavedFilterId);
    if (!saved) return;
    if (!window.confirm(`Delete saved filter “${saved.name}”?`)) return;
    await withCloud(async()=>{
      await removeTrackerFilter(saved.id);
      savedFilters=savedFilters.filter(item=>item.id!==saved.id);
      activeSavedFilterId='';
      renderSavedFilterSelect();
    });
  });

  setupCombos();
  setCloudReady(false);
  document.getElementById('trackerLoginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const button=e.target.querySelector('button[type="submit"]');
    button.disabled=true;
    const err=document.getElementById('trackerLoginError');
    err.textContent='';
    try {
      await signInWithPassword(document.getElementById('trackerLoginEmail').value,document.getElementById('trackerLoginPassword').value);
      await syncCloud('Signed in · shared data loaded');
      document.getElementById('trackerLogin').classList.add('hidden');
      prepareNewProjectForm(true);
    } catch(error) { err.textContent=error.message; cloudMessage(error.message,true); }
    finally { button.disabled=false; }
  });
  document.getElementById('trackerSignOut').addEventListener('click',async()=>{
    if (!confirm('Sign out of the EWP Management session?')) return;
    await stopTrackerRealtime();
    await signOut();
    projects=[];settings={...defaultSettings};savedFilters=[];
    setCloudReady(false);
    window.location.assign('../');
  });
  document.getElementById('trackerReload').addEventListener('click',()=>{
    syncCloud('Shared data refreshed').catch(error => cloudMessage(error.message,true));
  });
  let trackerRefreshTimer = null;
  function scheduleTrackerRefresh() {
    if (!cloudReady || document.visibilityState !== 'visible' || document.querySelector('dialog[open]')) return;
    if (trackerRefreshTimer) clearTimeout(trackerRefreshTimer);
    trackerRefreshTimer=setTimeout(() => {
      trackerRefreshTimer=null;
      if (!syncing && !document.querySelector('dialog[open]')) syncCloud('Shared projects updated').catch(()=>{});
    }, 350);
  }
  window.addEventListener('focus', scheduleTrackerRefresh);
  document.addEventListener('visibilitychange', scheduleTrackerRefresh);
  window.addEventListener('storage', event => {
    if (event.key === PROJECT_SYNC_SIGNAL) scheduleTrackerRefresh();
  });
  // Other employees may update projects while this workspace remains open.
  window.setInterval(scheduleTrackerRefresh, 60000);
  // A ?project= link from Forecast opens Tracking filtered to the same Project #.
  const linkedProject = new URLSearchParams(window.location.search).get('project');
  if (linkedProject) {
    document.getElementById('projectSearch').value = linkedProject.trim().slice(0, 80);
  }
  (async()=>{
    try {
      const session=await restoreSession();
      if (!session?.user) { window.location.replace('../?next=tracker%2F'); return; }
      await syncCloud('Connected to shared Supabase');
      prepareNewProjectForm(true);
      startTrackerRealtime(scheduleTrackerRefresh, () => {}).catch(error => console.warn('Tracker live sync unavailable',error));
    } catch(error) {
      // A transient cloud failure is not necessarily a sign-out; keep the page for retry.
      cloudMessage(`Could not load shared data: ${error.message}`,true);
      document.getElementById('trackerReload').disabled=false;
    }
  })();
})();
