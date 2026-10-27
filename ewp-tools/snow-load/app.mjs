import {SNOW_LOCATIONS} from './snow-data.mjs?v=1.24';
import {calculateSnow, nearestThree, localMatches, normalizeGeoResults} from './calc.mjs?v=1.24';
const $=id=>document.getElementById(id);
const state={mode:'location',chosen:null,source:null,querySequence:0,timer:0,controller:null};
const nameOf=x=>x.name;
const clean=()=>{$('snowError').hidden=true;$('snowError').textContent='';};
function showError(message){$('snowError').textContent=message;$('snowError').hidden=false;}
function render(){
 clean();const selected=state.mode==='custom'?{ss:$('snowSs').value,sr:$('snowSr').value}:state.chosen;
 const cbMode=$('snowCb').value;
 const cb=cbMode==='custom'?$('snowCustomCb').value:cbMode;
 $('snowChosen').hidden=!(state.chosen && state.mode==='location');
 if(state.chosen&&state.mode==='location')$('snowChosen').textContent=`Reference: ${state.chosen.name} · Ss ${state.chosen.ss} kPa · Sr ${state.chosen.sr} kPa${state.source?` · ${state.source}`:''}`;
 const empty= !selected || selected.ss==='' || selected.sr==='' || cb==='';
 if(empty){$('snowResultKpa').textContent='— kPa';$('snowResultPsf').textContent='— psf';$('snowEquation').textContent='Select a reference location or complete the inputs.';return;}
 try{
  const result=calculateSnow(selected.ss,selected.sr,cb,cbMode==='0.55');
  $('snowResultKpa').textContent=`${result.kpa.toFixed(2)} kPa`;
  $('snowResultPsf').textContent=`${result.psf.toFixed(1)} psf`;
  const inputLine=`${Number(selected.ss)} × ${Number(cb)} + ${Number(selected.sr)} = ${result.raw.toFixed(2)} kPa`;
  $('snowEquation').textContent=(cbMode==='0.55' ? `Part 9: max(1.00, ${inputLine})` : `S = Cb × Ss + Sr = ${inputLine}`) + '. Other code factors assumed 1.0.';
 }catch(e){$('snowResultKpa').textContent='— kPa';$('snowResultPsf').textContent='— psf';$('snowEquation').textContent='Review the numerical inputs.';showError(e.message);}
}
function chooseCode(item,origin='Direct BCBC reference'){
 state.chosen=item;state.source=origin;$('snowCitySearch').value=item.name;
 $('snowSuggest').hidden=true;$('snowCitySearch').setAttribute('aria-expanded','false');$('snowReferences').hidden=true;
 ++state.querySequence;if(state.controller)state.controller.abort();clearTimeout(state.timer);render();
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
 panel.hidden=false;state.chosen=null;state.source=null;render();
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
 const query=$('snowCitySearch').value.trim();state.chosen=null;state.source=null;$('snowReferences').hidden=true;render();
 if(query.length<2){renderSuggestions([]);$('snowLocationHelp').textContent='Enter at least two characters to see matching BC locations.';return;}
 const locals=localMatches(SNOW_LOCATIONS,query);
 renderSuggestions(locals);
 $('snowLocationHelp').textContent=locals.length?'Showing BCBC locations; searching other BC communities…':'Searching NRCan for BC communities…';
 state.controller=new AbortController();
 state.timer=setTimeout(()=>requestGeo(query,seq,locals,state.controller.signal),400);
}
for(const node of document.querySelectorAll('[name="snowMode"]'))node.addEventListener('change',()=>{
 state.mode=document.querySelector('[name="snowMode"]:checked').value;
 $('snowLocationPanel').hidden=state.mode!=='location';$('snowCustomPanel').hidden=state.mode!=='custom';render();
});
$('snowCb').addEventListener('change',()=>{$('snowCustomCbWrap').hidden=$('snowCb').value!=='custom';render();});
for(const id of ['snowSs','snowSr','snowCustomCb'])$(id).addEventListener('input',render);
$('snowCitySearch').addEventListener('input',updateQuery);
$('snowCitySearch').addEventListener('keydown',e=>{
 if(e.key==='Escape'){$('snowSuggest').hidden=true;$('snowCitySearch').setAttribute('aria-expanded','false');}
 if(e.key==='Enter'){
  const first=$('snowSuggest').querySelector('button');if(first && !$('snowSuggest').hidden){e.preventDefault();first.click();}
 }
});
document.addEventListener('click',e=>{if(!$('snowLocationPanel').contains(e.target)){$('snowSuggest').hidden=true;$('snowCitySearch').setAttribute('aria-expanded','false');}});
render();
