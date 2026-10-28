/** V1.28: Bidirectional display of non-negative snow/rain pressures.
 * Store the edited quantity as the authoritative input. Never calculate a
 * snow load from the rounded display shown in the other unit. */
import {KPA_TO_PSF} from './calc.mjs?v=1.28';

export function parseLoadPressure(value){
 const text=String(value??'').trim();
 if(text==='')return null;
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text))return NaN;
 const number=Number(text);
 return Number.isFinite(number)&&number>=0?number:NaN;
}

export function formatLoadPressure(amount,unit){
 if(!Number.isFinite(amount))return '';
 if(unit!=='kpa'&&unit!=='psf')throw new RangeError('Invalid pressure unit');
 const decimals=unit==='kpa'?6:2;
 if(amount!==0&&amount<0.5*10**(-decimals))return amount.toPrecision(4);
 return amount.toFixed(decimals).replace(/\.?0+$/,'');
}

/** Returns the kPa value at original precision and a display-only paired field.
 * Invalid values have kpa=NaN, blanks kpa=null. */
export function loadPair(value,sourceUnit){
 if(sourceUnit!=='kpa'&&sourceUnit!=='psf')throw new RangeError('Invalid pressure unit');
 const original=String(value??'');
 const number=parseLoadPressure(original);
 const toUnit=sourceUnit==='kpa'?'psf':'kpa';
 if(number===null||Number.isNaN(number))return {source:original,other:'',kpa:number,valid:false};
 const kpa=sourceUnit==='kpa'?number:number/KPA_TO_PSF;
 const other=sourceUnit==='kpa'?number*KPA_TO_PSF:kpa;
 return {source:original,other:formatLoadPressure(other,toUnit),kpa,valid:true};
}

export function displayLoadPair(entry){
 const paired=loadPair(entry.value,entry.unit);
 return entry.unit==='kpa'?
   {kpa:entry.value,psf:paired.other}:
   {kpa:paired.other,psf:entry.value};
}
