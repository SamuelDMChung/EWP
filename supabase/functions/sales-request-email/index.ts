/**
 * V1.10 Edge Function: authenticated, retriable Resend email for already saved Sales Requests.
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY),
 * RESEND_API_KEY, SALES_EMAIL_FROM (verified sender), SALES_NOTIFY_TO, SALES_PORTAL_URL.
 * Keep verify_jwt=true when using legacy JWT-based platform validation; also performs auth/v1/user check.
 * Server never trusts browser-provided recipient, email fields, or URL.
 */
const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SALES_SERVICE_ROLE_KEY') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SALES_PUBLIC_KEY') || '';
const resendKey = Deno.env.get('RESEND_API_KEY') || '';
const from = Deno.env.get('SALES_EMAIL_FROM') || '';
const to = Deno.env.get('SALES_NOTIFY_TO') || '';
const portal = Deno.env.get('SALES_PORTAL_URL') || '';
const allowedOrigin = Deno.env.get('SALES_ALLOWED_ORIGIN') || '';
const baseHeaders = { 'Content-Type':'application/json', 'Vary':'Origin' };
function cors(req:Request){const origin=req.headers.get('Origin')||'';return {...baseHeaders,
  ...(origin && (!allowedOrigin || origin===allowedOrigin)?{'Access-Control-Allow-Origin':origin}:{}),
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS'};}
function response(req:Request,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:cors(req)});}
const text=(v:unknown)=>String(v??'');
const safe=(v:unknown)=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
async function api(path:string,key:string,method='GET',body?:unknown,token=key){
 const resp=await fetch(url+path,{method,headers:{apikey:key,Authorization:`Bearer ${token}`,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'}),...(method==='PATCH'?{Prefer:'return=minimal'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await resp.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}if(!resp.ok)throw new Error(`Supabase ${resp.status}: ${data?.message||text(data).slice(0,160)}`);return data;
}
async function patch(id:string,changes:Record<string,unknown>){return api(`/rest/v1/sales_requests?id=eq.${id}`,serviceRole,'PATCH',changes);}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=='POST')return response(req,{error:'Method not allowed'},405);
 const jwt=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||'';
 if(!url||!serviceRole||!anonKey)return response(req,{error:'Email function needs Supabase environment configuration.'},503);
 if(!jwt)return response(req,{error:'Sign in to send a notification.'},401);
 try{
   // Verify real Supabase Auth user; do not rely on unverified JWT claims.
   const user=await api('/auth/v1/user',anonKey,'GET',undefined,jwt);
   if(!user?.id)return response(req,{error:'Invalid user session'},401);
   const payload=await req.json().catch(()=>null);
   const id=text(payload?.request_id);
   if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))return response(req,{error:'Invalid request ID'},400);
   // Read as this authenticated user (RLS applies) and then claim atomically by RPC.
   const rows=await api(`/rest/v1/sales_requests?select=*&id=eq.${id}&limit=1`,anonKey,'GET',undefined,jwt);
   const r=rows?.[0];if(!r)return response(req,{error:'Request not found'},404);
   if(r.email_status==='sent')return response(req,{status:'sent',already_sent:true});
   const claimed=await api('/rest/v1/rpc/sales_claim_email',anonKey,'POST',{p_id:id},jwt);
   if(claimed!==true)return response(req,{status:r.email_status==='sending'?'sending':'pending',message:'Already processing or retry limit reached.'},409);
   try{
     if(!resendKey||!from||!to||!portal)throw new Error('Missing RESEND_API_KEY, SALES_EMAIL_FROM, SALES_NOTIFY_TO or SALES_PORTAL_URL.');
     if(!/^https:\/\//i.test(portal))throw new Error('SALES_PORTAL_URL must be an HTTPS address.');
     const link=new URL(`sales/?request=${encodeURIComponent(id)}`,portal.endsWith('/')?portal:portal+'/').href;
     const subject=`New EWP Request — ${text(r.address).slice(0,110)} — ${text(r.customer).slice(0,75)}`;
     const fields=[['Submitted by',r.created_by_email],['Sales',r.sales],['Customer',r.customer],['Project',r.address],['Phase',r.phase],['Tasks',r.tasks?.join(', ')],['Requested due',r.due_date],['Instructions',r.instructions||'—'],['Attachment files',r.attachments?.length||0]];
     const plain=fields.map(([k,v])=>`${k}: ${text(v)}`).join('\n')+`\n\nView full request and private attachments (team sign-in required): ${link}`;
     const html=`<h2>New EWP Layout / Quotation Request</h2><table style="border-collapse:collapse">${fields.map(([k,v])=>`<tr><th style="text-align:left;padding:6px 12px;border-bottom:1px solid #ddd">${safe(k)}</th><td style="padding:6px 12px;border-bottom:1px solid #ddd;white-space:pre-wrap">${safe(v)}</td></tr>`).join('')}</table><p><a href="${safe(link)}">Open request and attachments in the EWP Portal</a></p>`;
     const send=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':`ewp-sales-${id}`},body:JSON.stringify({from,to:[to],subject,text:plain,html})});
     const body=await send.json().catch(()=>({}));if(!send.ok||!body.id)throw new Error(`Email service rejected request (${send.status}): ${text(body.message||body.name||'Unknown error').slice(0,220)}`);
     await patch(id,{email_status:'sent',email_provider_id:body.id,email_last_error:null,emailed_at:new Date().toISOString(),email_updated_at:new Date().toISOString()});
     return response(req,{status:'sent'});
   }catch(err){const msg=text(err instanceof Error?err.message:err).slice(0,350);
     await patch(id,{email_status:'failed',email_last_error:msg,email_updated_at:new Date().toISOString()}).catch(()=>{});
     return response(req,{status:'failed',error:msg},503);
   }
 }catch(err){return response(req,{error:text(err instanceof Error?err.message:err).slice(0,280)},401);}
});
