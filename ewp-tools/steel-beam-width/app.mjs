import {mountSteelBeamWidth} from './lookup.mjs?v=1.28';

const status=document.getElementById('beamStatus');
try {
  // Bundled static data, not a remote search or an approximation formula.
  const response=await fetch(new URL('./w-sections.json',import.meta.url),{cache:'no-store'});
  if (!response.ok) throw new Error(`Could not load section data (HTTP ${response.status}).`);
  mountSteelBeamWidth(document,await response.json());
} catch (error) {
  status.textContent=`Beam data unavailable: ${error.message}`;
  status.dataset.state='warning';
  document.getElementById('beamInputs').setAttribute('aria-disabled','true');
}
