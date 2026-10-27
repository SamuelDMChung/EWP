/** V1.25: exact W-section lookup (not a numeric conversion formula).
 * Values derive from the Varsteel Reference Book, PDF pages 10-14.
 */
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
    if (!imp || !met || !Number.isFinite(row.flangeWidthIn) || !Number.isFinite(row.depthIn) || row.flangeWidthIn <= 0 || row.depthIn <= 0) {
      throw new Error('Invalid beam table record.');
    }
    const impKey = `${Number(imp.depth)}:${Number(imp.weight)}`;
    const metKey = `${Number(met.depth)}:${Number(met.weight)}`;
    if (imperial.has(impKey) || metric.has(metKey)) throw new Error('Duplicate beam designation in reference table.');
    imperial.set(impKey, row);
    metric.set(metKey, row);
    imperialDepths.add(Number(imp.depth));
    metricDepths.add(Number(met.depth));
    if (!imperialWeights.has(+imp.depth)) imperialWeights.set(+imp.depth, new Set());
    if (!metricWeights.has(+met.depth)) metricWeights.set(+met.depth, new Set());
    imperialWeights.get(+imp.depth).add(+imp.weight);
    metricWeights.get(+met.depth).add(+met.weight);
  }
  return {imperial,metric,imperialDepths,metricDepths,imperialWeights,metricWeights, size:rows.length};
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

function setDatalist(list, values) {
  list.replaceChildren(...values.map(value=>{const option=list.ownerDocument.createElement('option');option.value=String(value);return option;}));
}

/** Small, dependency-free UI controller. Mirrors designation pairs ONLY upon exact table match. */
export function mountSteelBeamWidth(doc, rows) {
  const index = buildBeamIndex(rows);
  const fields = {
    imperial: {depth:doc.getElementById('beamImperialDepth'),weight:doc.getElementById('beamImperialWeight')},
    metric: {depth:doc.getElementById('beamMetricDepth'),weight:doc.getElementById('beamMetricMass')}
  };
  const lists={
    imperial:{depth:doc.getElementById('beamImperialDepthList'),weight:doc.getElementById('beamImperialWeightList')},
    metric:{depth:doc.getElementById('beamMetricDepthList'),weight:doc.getElementById('beamMetricMassList')}
  };
  const status=doc.getElementById('beamStatus');
  const width=doc.getElementById('beamFlangeWidth');
  const depth=doc.getElementById('beamActualDepth');
  const title=doc.getElementById('beamMatchedTitle');
  const clear=doc.getElementById('beamClear');
  const available=doc.getElementById('beamCount');
  if ([...Object.values(fields).flatMap(pair=>Object.values(pair)),...Object.values(lists).flatMap(pair=>Object.values(pair)),status,width,depth,title,clear,available].some(node=>!node)) {
    throw new Error('Steel Beam Width page is missing required controls.');
  }
  available.textContent=String(index.size);
  for (const system of ['imperial','metric']) {
    setDatalist(lists[system].depth,optionsFor(index,system).depths);
  }
  const resetResult=()=>{width.textContent='—';depth.textContent='—';title.textContent='No section selected';};
  const update=(source)=>{
    const other=source==='imperial'?'metric':'imperial';
    const pair=fields[source];
    setDatalist(lists[source].weight,optionsFor(index,source,pair.depth.value).weights);
    const inputDepth=pair.depth.value.trim(), inputWeight=pair.weight.value.trim();
    if (!inputDepth || !inputWeight) {
      fields[other].depth.value='';fields[other].weight.value='';
      resetResult();status.textContent='Enter both designation values to find a W beam.';status.dataset.state='neutral';return;
    }
    const found=lookupBeam(index,source,inputDepth,inputWeight);
    if (!found) {
      fields[other].depth.value='';fields[other].weight.value='';
      resetResult();status.textContent=`No matching ${source} W section in the reference book. Check the depth and weight.`;status.dataset.state='warning';return;
    }
    const otherValues=splitBeamDesignation(found[other]);
    fields[other].depth.value=otherValues.depth;
    fields[other].weight.value=otherValues.weight;
    setDatalist(lists[other].weight,optionsFor(index,other,otherValues.depth).weights);
    width.textContent=`${found.flangeWidthIn.toFixed(2)}″`;
    depth.textContent=`${found.depthIn.toFixed(2)}″`;
    title.textContent=`${found.imperial.replace('x','×')}  /  ${found.metric.replace('x','×')}`;
    status.textContent=`Matched Varsteel reference, PDF page ${found.sourcePage}.`;
    status.dataset.state='success';
  };
  for (const system of ['imperial','metric']) for (const field of ['depth','weight']) {
    fields[system][field].addEventListener('input',()=>update(system));
    fields[system][field].addEventListener('change',()=>update(system));
  }
  clear.addEventListener('click',()=>{
    for (const pair of Object.values(fields)) for (const node of Object.values(pair)) node.value='';
    for (const system of ['imperial','metric']) setDatalist(lists[system].weight,[]);
    resetResult();status.textContent='Enter a W-beam designation in either system.';status.dataset.state='neutral';
    fields.imperial.depth.focus();
  });
  status.textContent='Enter a W-beam designation in either system.';
  status.dataset.state='neutral';
  return index;
}
