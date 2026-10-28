/** V1.26: Steel Beam Lookup, Varsteel rolled W sections; published dimensions only. */
export function splitBeamDesignation(designation) {
  const match = /^W\s*(\d+)\s*[x×]\s*(\d+)$/i.exec(String(designation ?? '').trim());
  return match ? {depth: match[1], weight: match[2]} : null;
}

export function isValidBeamInput(value) {
  return /^\d+$/.test(String(value ?? '').trim()) && Number(value) > 0;
}

export function buildBeamIndex(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('W-section reference table is empty.');
  const imperial = new Map(), metric = new Map();
  const imperialDepths = new Set(), metricDepths = new Set();
  const imperialWeights = new Map(), metricWeights = new Map();
  for (const row of rows) {
    const imp = splitBeamDesignation(row.imperial);
    const met = splitBeamDesignation(row.metric);
    if (!imp || !met || !Number.isFinite(row.flangeWidthIn) || !Number.isFinite(row.depthIn) ||
      row.flangeWidthIn <= 0 || row.depthIn <= 0 || !Number.isFinite(row.flangeThicknessIn) ||
      !Number.isFinite(row.webThicknessIn) || row.flangeThicknessIn <= 0 || row.webThicknessIn <= 0 ||
      (row.sectionModulusIn3 !== null && (!Number.isFinite(row.sectionModulusIn3) || row.sectionModulusIn3 <= 0))) {
      throw new Error('Invalid beam table record.');
    }
    const impKey = `${Number(imp.depth)}:${Number(imp.weight)}`;
    const metKey = `${Number(met.depth)}:${Number(met.weight)}`;
    if (imperial.has(impKey) || metric.has(metKey)) throw new Error('Duplicate beam designation in reference table.');
    imperial.set(impKey, row);metric.set(metKey, row);
    imperialDepths.add(Number(imp.depth));metricDepths.add(Number(met.depth));
    if (!imperialWeights.has(+imp.depth)) imperialWeights.set(+imp.depth, new Set());
    if (!metricWeights.has(+met.depth)) metricWeights.set(+met.depth, new Set());
    imperialWeights.get(+imp.depth).add(+imp.weight);
    metricWeights.get(+met.depth).add(+met.weight);
  }
  return {imperial,metric,imperialDepths,metricDepths,imperialWeights,metricWeights,size:rows.length};
}

export function lookupBeam(index, system, depth, weight) {
  if (!['imperial','metric'].includes(system)) throw new RangeError('Unknown beam designation system.');
  if (!isValidBeamInput(depth) || !isValidBeamInput(weight)) return null;
  return index[system].get(`${Number(depth)}:${Number(weight)}`) ?? null;
}

export function optionsFor(index, system, depth='') {
  if (!['imperial','metric'].includes(system)) throw new RangeError('Unknown beam designation system.');
  const allDepths = [...index[`${system}Depths`]].sort((a,b)=>a-b);
  const weights = [...(index[`${system}Weights`].get(Number(depth)) || [])].sort((a,b)=>a-b);
  return {depths:allDepths,weights};
}

function startsNominal(value, typed) {
  const t = String(typed ?? '').trim();
  if (!t) return true;
  if (!/^\d+$/.test(t)) return false;
  const normalized = t.replace(/^0+(?=\d)/, '');
  return String(value).startsWith(normalized);
}

/** Prefix filter: the very first nominal depth digit narrows the full table. */
export function filterBeamRows(rows, system, nominalDepth='',weight='') {
  if (!['imperial','metric'].includes(system)) throw new RangeError('Unknown beam designation system.');
  return rows.filter(row=>{
    const v = splitBeamDesignation(row[system]);
    return v && startsNominal(v.depth,nominalDepth) && startsNominal(v.weight,weight);
  });
}

/** Stable, numeric table sorting; absent published values appear last. */
export function sortBeamRows(rows, column='imperial', direction='asc') {
  const valid=['imperial','metric','depthIn','flangeWidthIn','flangeThicknessIn','webThicknessIn','sectionModulusIn3'];
  if (!valid.includes(column) || !['asc','desc'].includes(direction)) throw new RangeError('Unknown sort column/direction.');
  return rows.map((row,i)=>({row,i})).sort((a,b)=>{
    const val=r=>column==='imperial'||column==='metric' ? splitBeamDesignation(r[column]) : r[column];
    const x=val(a.row),y=val(b.row);
    if (x==null || y==null) return x==null && y==null ? a.i-b.i : x==null ? 1 : -1;
    const diff=typeof x==='object' ? (Number(x.depth)-Number(y.depth) || Number(x.weight)-Number(y.weight)) : x-y;
    return (direction==='asc'?diff:-diff) || a.i-b.i;
  }).map(x=>x.row);
}

function setDatalist(list, values) {
  list.replaceChildren(...values.map(value=>{const option=list.ownerDocument.createElement('option');option.value=String(value);return option;}));
}

function displayNumber(n, digits=2){return n==null?'—':Number(n).toFixed(digits);}

/** UI controller: no API/DB requests; only locally loaded catalogue rows. */
export function mountSteelBeamWidth(doc, rows) {
  const index=buildBeamIndex(rows);
  const fields={
    imperial:{depth:doc.getElementById('beamImperialDepth'),weight:doc.getElementById('beamImperialWeight')},
    metric:{depth:doc.getElementById('beamMetricDepth'),weight:doc.getElementById('beamMetricMass')}
  };
  const lists={
    imperial:{depth:doc.getElementById('beamImperialDepthList'),weight:doc.getElementById('beamImperialWeightList')},
    metric:{depth:doc.getElementById('beamMetricDepthList'),weight:doc.getElementById('beamMetricMassList')}
  };
  const el=id=>doc.getElementById(id);
  const status=el('beamStatus'),clear=el('beamClear');
  const tableBody=el('beamTableBody'),tableCount=el('beamTableCount'),tableEmpty=el('beamTableEmpty');
  const diagWidth=el('beamDiagramWidth'),diagDepth=el('beamDiagramDepth'),diagram=el('beamDiagram');
  const headers=[...doc.querySelectorAll('[data-beam-sort]')];
  if ([...Object.values(fields).flatMap(pair=>Object.values(pair)),...Object.values(lists).flatMap(pair=>Object.values(pair)),status,clear,tableBody,tableCount,tableEmpty,diagWidth,diagDepth,diagram].some(node=>!node)) {
    throw new Error('Steel Beam Lookup page is missing required controls.');
  }
  for(const sys of ['imperial','metric']) setDatalist(lists[sys].depth,optionsFor(index,sys).depths);
  let activeSystem='imperial',selected=null,sortColumn='imperial',sortDirection='asc';
  const statusSet=(message,state='neutral')=>{status.textContent=message;status.dataset.state=state;};
  const resetResult=()=>{
    diagWidth.textContent='bf';diagDepth.textContent='d';
    diagram.setAttribute('aria-label','Illustrative W-beam cross-section showing flange width and overall depth; select a W section to see dimensions.');
  };
  function applySelection(found) {
    selected=found;
    const i=splitBeamDesignation(found.imperial),m=splitBeamDesignation(found.metric);
    fields.imperial.depth.value=i.depth;fields.imperial.weight.value=i.weight;
    fields.metric.depth.value=m.depth;fields.metric.weight.value=m.weight;
    for(const sys of ['imperial','metric']) setDatalist(lists[sys].weight,optionsFor(index,sys,fields[sys].depth.value).weights);
    diagWidth.textContent=`bf = ${displayNumber(found.flangeWidthIn)}″`;
    diagDepth.textContent=`d = ${displayNumber(found.depthIn)}″`;
    diagram.setAttribute('aria-label',`W-beam cross-section: flange width ${displayNumber(found.flangeWidthIn)} inches; actual depth ${displayNumber(found.depthIn)} inches. Not to scale.`);
    statusSet(`${found.imperial.replace('x','×')} selected.`,'success');
  }
  const recordNodes=new Map();
  for(const beam of rows){
    const tr=doc.createElement('tr');tr.className='beam-row';
    const imperialCell=doc.createElement('td');
    const pick=doc.createElement('button');pick.type='button';pick.className='beam-row-select';pick.textContent=beam.imperial.replace('x','×');
    pick.setAttribute('aria-label',`Select ${beam.imperial.replace('x',' by ')}`);
    pick.addEventListener('click',()=>{activeSystem='imperial';applySelection(beam);renderTable();});
    imperialCell.append(pick);tr.append(imperialCell);
    const cells=[beam.metric.replace('x','×'),displayNumber(beam.flangeWidthIn),displayNumber(beam.depthIn)];
    for(const [i,value] of cells.entries()){const td=doc.createElement('td');td.textContent=value;if(i>0)td.className='beam-number';tr.append(td);}
    recordNodes.set(beam,tr);
  }
  function renderTable() {
    const pair=fields[activeSystem];
    const filtered=filterBeamRows(rows,activeSystem,pair.depth.value,pair.weight.value);
    const sorted=sortBeamRows(filtered,sortColumn,sortDirection);
    tableBody.replaceChildren(...sorted.map(row=>{
      const node=recordNodes.get(row);
      node.classList.toggle('beam-row--selected',row===selected);
      return node;
    }));
    tableCount.textContent=`Showing ${filtered.length} of ${index.size} sections`;
    tableEmpty.hidden=filtered.length!==0;
    for(const header of headers){
      const isCurrent=header.dataset.beamSort===sortColumn;
      header.closest('th').setAttribute('aria-sort',isCurrent?(sortDirection==='asc'?'ascending':'descending'):'none');
      header.querySelector('.beam-sort-indicator').textContent=isCurrent?(sortDirection==='asc'?' ▲':' ▼'):'';
    }
  }
  for(const header of headers) header.addEventListener('click',()=>{
    const next=header.dataset.beamSort;
    sortDirection=sortColumn===next && sortDirection==='asc' ? 'desc' : 'asc';sortColumn=next;renderTable();
  });
  function update(source){
    activeSystem=source;selected=null;
    const other=source==='imperial'?'metric':'imperial',pair=fields[source];
    setDatalist(lists[source].weight,optionsFor(index,source,pair.depth.value).weights);
    const d=pair.depth.value.trim(),w=pair.weight.value.trim();
    if(!d || !w){
      fields[other].depth.value='';fields[other].weight.value='';
      resetResult();statusSet('Enter both designation values, or select a row from the filtered table.');
      renderTable();return;
    }
    const found=lookupBeam(index,source,d,w);
    if(!found){
      fields[other].depth.value='';fields[other].weight.value='';
      resetResult();statusSet(`No matching ${source} W section. Check the values or choose a listed row.`,'warning');
      renderTable();return;
    }
    applySelection(found);renderTable();
  }
  for(const sys of ['imperial','metric'])for(const part of ['depth','weight']){
    fields[sys][part].addEventListener('input',()=>update(sys));
    fields[sys][part].addEventListener('change',()=>update(sys));
  }
  clear.addEventListener('click',()=>{
    for(const pair of Object.values(fields))for(const node of Object.values(pair))node.value='';
    for(const sys of ['imperial','metric'])setDatalist(lists[sys].weight,[]);
    selected=null;activeSystem='imperial';sortColumn='imperial';sortDirection='asc';resetResult();
    statusSet('Enter a W designation or select a row from the full table.');renderTable();
    fields.imperial.depth.focus();
  });
  resetResult();statusSet('Enter a W designation or select a row from the full table.');renderTable();
  return index;
}

// Alias for new consumers without changing the earlier public module entrypoint.
export const mountSteelBeamLookup=mountSteelBeamWidth;
