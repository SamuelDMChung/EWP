/** Simplified uniform roof snow load with normal importance, Cw=Cs=Ca=1.
 * Part 9 displays the specified snow-load minimum 1.0 kPa. This is NOT a
 * complete Part 4 roof geometry/drift/wind/accumulation design model. */
export const KPA_TO_PSF = 20.885434273;
export function calculateSnow(ss, sr, cb, part9=false){
 const numbers=[ss,sr,cb].map(Number);
 if(numbers.some(n=>!Number.isFinite(n)||n<0) || numbers[2]===0) throw new Error('Enter non-negative Ss/Sr and a positive Cb factor.');
 const [ground,rain,roof]=numbers;
 const raw=ground*roof+rain;
 const kpa=part9?Math.max(1,raw):raw;
 return {raw,kpa,psf:kpa*KPA_TO_PSF};
}
export function distanceKm(lat1,lon1,lat2,lon2){
 const rad=Math.PI/180;
 const dlat=(lat2-lat1)*rad,dlon=(lon2-lon1)*rad;
 const a=Math.sin(dlat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dlon/2)**2;
 return 12742*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
export function nearestThree(locations,lat,lng){
 return locations.filter(item=>Number.isFinite(item.lat)&&Number.isFinite(item.lng))
   .map(item=>({...item,km:distanceKm(lat,lng,item.lat,item.lng)}))
   .sort((a,b)=>a.km-b.km).slice(0,3);
}
export function localMatches(locations,query){
 const q=query.trim().toLocaleLowerCase();
 if(q.length<2)return [];
 return locations.filter(x=>x.name.toLocaleLowerCase().includes(q))
   .sort((a,b)=>a.name.toLocaleLowerCase().startsWith(q)?-1:b.name.toLocaleLowerCase().startsWith(q)?1:a.name.localeCompare(b.name))
   .slice(0,8);
}
/** Normalizes a geolocator.api.geo.ca flat result and excludes non-BC matches. */
export function normalizeGeoResults(raw){
 if(!Array.isArray(raw))return [];
 const allowed=/\b(british columbia|b\.?c\.?)\b/i;
 const seen=new Set();
 return raw.filter(x=>{
  if(!x || !Number.isFinite(Number(x.lat)) || !Number.isFinite(Number(x.lng)))return false;
  // Geonames' province field is populated; some Nominatim matches include BC in name.
  if(!allowed.test(String(x.province||'')) && !allowed.test(String(x.name||'')))return false;
  const lat=Number(x.lat),lng=Number(x.lng);
  return lat>48 && lat<61 && lng< -114 && lng> -140;
 }).map(x=>({name:String(x.name||'Location').trim(),lat:Number(x.lat),lng:Number(x.lng),category:String(x.category||'Place')}))
 .filter(x=>{const key=`${x.name.toLowerCase()}|${x.lat.toFixed(2)}|${x.lng.toFixed(2)}`;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,7);
}
