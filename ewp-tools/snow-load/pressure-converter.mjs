/** V1.24: stand-alone pressure unit converter; never touches snow-load input/state. */
import {KPA_TO_PSF} from './calc.mjs?v=1.24';

/** A nonfinite or malformed entry is invalid; a cleared input returns null. */
export function convertPressure(value,fromUnit){
 const text=String(value??'').trim();
 if(text==='')return null;
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text))return NaN;
 const amount=Number(text);
 if(!Number.isFinite(amount))return NaN;
 if(fromUnit==='kpa')return amount*KPA_TO_PSF;
 if(fromUnit==='psf')return amount/KPA_TO_PSF;
 throw new RangeError('Unknown pressure unit');
}

/** Enough decimals for everyday design review; keep the edited input unchanged. */
export function formatPressure(amount,toUnit){
 if(!Number.isFinite(amount))return '';
 const places=toUnit==='kpa'?6:4;
 if(toUnit!=='kpa'&&toUnit!=='psf')throw new RangeError('Unknown pressure unit');
 // Prevent misleading zeros for very small valid numbers.
 if(amount!==0&&Math.abs(amount)<0.5*10**(-places))return amount.toPrecision(4);
 return amount.toFixed(places).replace(/\.?0+$/,'');
}

export function mountPressureConverter(doc){
 const kpa=doc.getElementById('pressureKpa');
 const psf=doc.getElementById('pressurePsf');
 const clear=doc.getElementById('pressureClear');
 const message=doc.getElementById('pressureMessage');
 if(!kpa||!psf||!clear||!message)return false;
 function changed(source,target,unit){
  const value=convertPressure(source.value,unit);
  message.textContent=Number.isNaN(value)?'Enter a valid numeric pressure.':'';
  target.value=value===null||Number.isNaN(value)?'':formatPressure(value,unit==='kpa'?'psf':'kpa');
 }
 kpa.addEventListener('input',()=>changed(kpa,psf,'kpa'));
 psf.addEventListener('input',()=>changed(psf,kpa,'psf'));
 clear.addEventListener('click',()=>{kpa.value='';psf.value='';message.textContent='';kpa.focus();});
 return true;
}

if(typeof document!=='undefined')mountPressureConverter(document);
