import {SNOW_LOCATIONS} from './snow-data.mjs?v=1.28';
import {calculateSnow, nearestThree, localMatches, normalizeGeoResults} from './calc.mjs?v=1.28';
import {loadPair,displayLoadPair} from './load-units.mjs?v=1.28';
const $=id=>document.getElementById(id);
const state={mode:'location',chosen:null,source:null,querySequence:0,timer:0,controller:null,
 custom:{ss:{value:'',unit:'kpa'},sr:{value:'',unit:'kpa'}}};
const nameOf=x=>x.name;
const clean=()=>{$('snowError').hidden=true;$('snowError').textContent='';};
function showError(message){$('snowError').textContent=message;$('snowError').hidden=false;}
/** Show the same pair of fields in both modes. In BC mode values are reference
 * data and therefore read-only; switching back to Custom restores entered data. */
function paintLoads(){
 const isLocation=state.mode==='location';
 for(const [key,kpaId,psfId] of [['ss','snowSs','snowSsPsf'],['sr','snowSr','snowSrPsf']]){
  const entry=isLocation?{value:state.chosen?String(state.chosen[key]):'',unit:'kpa'}:state.custom[key];
  const displayed=displayLoadPair(entry);
  $(kpaId).value=displayed.kpa;
  $(psfId).value=displayed.psf;
  $(kpaId).readOnly=isLocation;
  $(psfId).readOnly=isLocation;
  $(kpaId).setAttribute('aria-readonly',String(isLocation));
  $(psfId).setAttribute('aria-readonly',String(isLocation));
 }
 $('snowLoadUnitHelp').textContent=isLocation?
  (state.chosen?'BCBC values shown in both units. Select Custom to enter your own loads.':'Select a BC location to populate both units. Switch to Custom to enter either unit.'):
  'Enter kPa or psf in either pair. The other unit updates instantly; the calculation uses the original input precision.';
}
function render(){
 clean();
 const custom=state.mode==='custom';
 const ss=custom?loadPair(state.custom.ss.value,state.custom.ss.unit).kpa:state.chosen?.ss??null;
 const sr=custom?loadPair(state.custom.sr.value,state.custom.sr.unit).kpa:state.chosen?.sr??null;
 const cbMode=$('snowCb').value;
 const cb=cbMode==='custom'?$('snowCustomCb').value:cbMode;
 $('snowChosen').hidden=!(state.chosen && !custom);
 if(state.chosen&&!custom)$('snowChosen').textContent=`Reference: ${state.chosen.name} · Ss ${state.chosen.ss} kPa · Sr ${state.chosen.sr} kPa${state.source?` · ${state.source}`:''}`;
 const incomplete=ss===null||sr===null||cb==='';
 const invalid=Number.isNaN(ss)||Number.isNaN(sr);
 if(incomplete||invalid){
  $('snowResultKpa').textContent='— kPa';$('snowResultPsf').textContent='— psf';
  $('snowEquation').textContent=invalid?'Review the custom load values.':'Select a reference location or complete the inputs.';
  if(invalid)showError('Enter non-negative numerical Ss and Sr loads in either kPa or psf.');
  return;
 }
 try{
  const result=calculateSnow(ss,sr,cb,cbMode==='0.55');
  $('snowResultKpa').textContent=`${result.kpa.toFixed(2)} kPa`;
  $('snowResultPsf').textContent=`${result.psf.toFixed(1)} psf`;
  const inputLine=`${Number(ss).toFixed(5).replace(/\.?0+$/,'')} × ${Number(cb)} + ${Number(sr).toFixed(5).replace(/\.?0+$/,'')} = ${result.raw.toFixed(2)} kPa`;
  $('snowEquation').textContent=(cbMode==='0.55'?`Part 9: max(1.00, ${inputLine})`:`S = Cb × Ss + Sr = ${inputLine}`)+'. Other code factors assumed 1.0.';
 }catch(e){$('snowResultKpa').textContent='— kPa';$('snowResultPsf').textContent='— psf';$('snowEquation').textContent='Review the numerical inputs.';showError(e.message);}
}
function chooseCode(item,origin='Direct BCBC reference'){
 state.chosen=item;state.source=origin;$('snowCitySearch').value=item.name;
 $('snowSuggest').hidden=true;$('snowCitySearch').setAttribute('aria-expanded','false');$('snowReferences').hidden=true;
 ++state.querySequence;if(state.controller)state.controller.abort();clearTimeout(state.timer);paintLoads();render();
}
function renderReferences(lat,lng,name){
 const nearby=nearestThree(SNOW_LOCATIONS,lat,lng);
 const panel=$('snowReferences'),target=$('snowReferenceChoices');target.replaceChildren();
 const info=document.createElement('p');info.className='small-hint';info.textContent=`Search location: ${name}. Select a code-listed reference; no load is applied automatically.`;target.append(info);
 for(const item of nearby){
  const btn=document.createElement('button');btn.type='button';btn.className='snow-reference-option';
  const left=document.createElement('strong');left.textContent=item.name;
  const right=document.createElement('small');right.textContent=`≈${Math.round(item.km)} km · Ss ${item.ss} / Sr ${item.sr} kPa`;
  btn.append(left,right);btn.addEventListener('click',()=>chooseCode(item,`Chosen near ${name}; proximity is not design verification`));target.append(btn);
 }
 panel.hidden=false;state.chosen=null;state.source=null;paintLoads();render();
}
function suggestion(label,kind,callback){const button=document.createElement('button');button.type='button';button.setAttribute('role','option');const name=document.createElement('span');name.textContent=label;const desc=document.createElement('small');desc.textContent=kind;button.append(name,desc);button.addEventListener('click',callback);return button;}
function renderSuggestions(locals,remote=[]){
 const list=$('snowSuggest');list.replaceChildren();
 const seen=new Set();
 for(const item of locals){list.append(suggestion(item.name,'BCBC Table C-2',()=>chooseCode(item)));seen.add(item.name.toLowerCase());}
 for(const item of remote){
  if(seen.has(item.name.toLowerCase()))continue;
  list.append(suggestion(item.name,'NRCan location',()=>{
   $('snowCitySearch').value=item.name;list.hidden=true;$('snowCitySearch').setAttribute('aria-expanded','false');
   renderReferences(item.lat,item.lng,item.name);
  }));seen.add(item.name.toLowerCase());
 }
 list.hidden=!list.childElementCount;$('snowCitySearch').setAttribute('aria-expanded',String(!list.hidden));
}
async function requestGeo(query,seq,locals,signal){
 const search=new URLSearchParams({q:query,lang:'en',keys:'geonames,nominatim,locate'});
 try{
  const response=await fetch(`https://geolocator.api.geo.ca/?${search}`,{signal,headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`NRCan returned HTTP ${response.status}`);
  const matches=normalizeGeoResults(await response.json());
  if(seq!==state.querySequence)return;
  renderSuggestions(locals,matches);
  $('snowLocationHelp').textContent=matches.length?'Select a listed reference or an NRCan place to compare nearby code references.':'No additional BC places found through NRCan. Try a nearby community.';
 }catch(e){if(seq!==state.querySequence||e.name==='AbortError')return;
  $('snowLocationHelp').textContent='NRCan lookup unavailable. Listed BCBC cities remain searchable offline. Try again later or use Custom.';
 }
}
function updateQuery(){
 ++state.querySequence;const seq=state.querySequence;clearTimeout(state.timer);state.controller?.abort();
 const query=$('snowCitySearch').value.trim();state.chosen=null;state.source=null;$('snowReferences').hidden=true;paintLoads();render();
 if(query.length<2){renderSuggestions([]);$('snowLocationHelp').textContent='Enter at least two characters to see matching BC locations.';return;}
 const locals=localMatches(SNOW_LOCATIONS,query);
 renderSuggestions(locals);
 $('snowLocationHelp').textContent=locals.length?'Showing BCBC locations; searching other BC communities…':'Searching NRCan for BC communities…';
 state.controller=new AbortController();
 state.timer=setTimeout(()=>requestGeo(query,seq,locals,state.controller.signal),400);
}
for(const node of document.querySelectorAll('[name="snowMode"]'))node.addEventListener('change',()=>{
 state.mode=document.querySelector('[name="snowMode"]:checked').value;
 $('snowLocationPanel').hidden=state.mode!=='location';
 paintLoads();render();
});
$('snowCb').addEventListener('change',()=>{$('snowCustomCbWrap').hidden=$('snowCb').value!=='custom';render();});
$('snowCustomCb').addEventListener('input',render);
for(const [key,kpaId,psfId] of [['ss','snowSs','snowSsPsf'],['sr','snowSr','snowSrPsf']]){
 for(const [sourceId,targetId,unit] of [[kpaId,psfId,'kpa'],[psfId,kpaId,'psf']]){
  $(sourceId).addEventListener('input',()=>{
   if(state.mode!=='custom')return;
   state.custom[key]={value:$(sourceId).value,unit};
   $(targetId).value=loadPair($(sourceId).value,unit).other;
   render();
  });
 }
}
$('snowCitySearch').addEventListener('input',updateQuery);
$('snowCitySearch').addEventListener('keydown',e=>{
 if(e.key==='Escape'){$('snowSuggest').hidden=true;$('snowCitySearch').setAttribute('aria-expanded','false');}
 if(e.key==='Enter'){
  const first=$('snowSuggest').querySelector('button');if(first && !$('snowSuggest').hidden){e.preventDefault();first.click();}
 }
});
document.addEventListener('click',e=>{if(!$('snowLocationPanel').contains(e.target)){$('snowSuggest').hidden=true;$('snowCitySearch').setAttribute('aria-expanded','false');}});
paintLoads();render();
