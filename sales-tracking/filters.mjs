/** Client-side read-only filtering of the already scoped salesperson's rows. */
export function filterSalesRows(records,{query='',status='',phase='',type=''}={}){
 const needle=String(query).trim().toLocaleLowerCase();
 return records.filter(row=>{
  if(status&&row.status!==status)return false;
  if(phase&&String(row.phase||'').toLocaleLowerCase()!==phase.toLocaleLowerCase())return false;
  if(type){
   const actual=String(row.type||'').toLocaleLowerCase();
   if(type==='Others'){
    if(['sfd','multi','duplex','multiplex','townhome'].includes(actual))return false;
   } else if(actual!==type.toLocaleLowerCase())return false;
  }
  return !needle||['projectNumber','address','task','status','customer','sales','phase','type','due']
    .some(key=>String(row[key]||'').toLocaleLowerCase().includes(needle));
 });
}
