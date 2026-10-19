import * as blob from '@vercel/blob';
import {randomUUID} from 'node:crypto';

const publicFields=['id','customer_name','rating','review_text','service','created_at'];
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const conflict=error=>error instanceof blob.BlobPreconditionFailedError||/already exists|already been uploaded|precondition/i.test(error?.message||'');
const opts=()=>({abortSignal:AbortSignal.timeout(12000)});

export function createRepository(storage=blob,namespace='customer-reviews-v1/') {
 async function read(path) {
  const result=await storage.get(namespace+path,{access:'private',useCache:false,...opts()});
  if(!result)return null;
  if(result.statusCode!==200)throw new Error('Unexpected storage response');
  return {value:await new Response(result.stream).json(),etag:result.blob.etag};
 }
 async function write(path,value,etag) {
  return storage.put(namespace+path,JSON.stringify(value),{access:'private',addRandomSuffix:false,allowOverwrite:Boolean(etag),...(etag?{ifMatch:etag}:{}),contentType:'application/json',cacheControlMaxAge:60,...opts()});
 }
 async function ensureMarker(prefix,record) {
  // Lexicographic inverse timestamps put newest submissions first. These are
  // discovery markers only: public reads ALWAYS recheck the canonical status.
  const path=prefix+'/'+String(9999999999999-Date.parse(record.created_at)).padStart(13,'0')+'-'+record.id+'.json';
  try {await write(path,{id:record.id});}catch(error){if(!conflict(error))throw error;}
 }
 async function save(input) {
  const path='records/'+input.p_request_id+'.json';
  const desired={id:input.p_request_id,customer_name:input.p_name,rating:input.p_rating,review_text:input.p_text,service:input.p_service,email:input.p_email,status:'pending',created_at:new Date().toISOString(),moderated_at:null,moderated_by:null};
  try {await write(path,desired);}catch(error){if(!conflict(error))throw error;}
  const saved=(await read(path))?.value;
  if(!saved)throw new Error('Saved review could not be confirmed');
  if(['customer_name','rating','review_text','service','email'].some(key=>saved[key]!==desired[key])){const error=new Error('This request was already used. Please refresh and try again.');error.code='REQUEST_CONFLICT';throw error;}
  await ensureMarker('submitted',saved);
  return saved.id;
 }
 async function moderate(id,status,admin) {
  if(!idPattern.test(id))throw new Error('Invalid review ID');
  if(!['pending','approved','rejected','removed'].includes(status))throw new Error('Invalid status');
  for(let attempt=0;attempt<8;attempt++) {
   const current=await read('records/'+id+'.json');if(!current)return null;
   const updated={...current.value,status,moderated_at:new Date().toISOString(),moderated_by:admin};
   try {
    if(status==='approved')await ensureMarker('published',updated);
    await write('records/'+id+'.json',updated,current.etag);
    return {id,status};
   }catch(error){if(!conflict(error))throw error;}
  }
  throw new Error('Review changed concurrently; please retry');
 }
 async function page({status='approved',cursor,limit=6,admin=false}={}) {
  // Only scan a bounded page of markers; never download the entire dataset.
  // Tombstones can produce a partial page, with a cursor to keep loading.
  const response=await storage.list({prefix:namespace+(admin?'submitted/':'published/'),limit,cursor,...opts()});
  const records=await Promise.all(response.blobs.map(async marker=>{
   const id=/([0-9a-f-]{36})\.json$/i.exec(marker.pathname)?.[1];
   if(!idPattern.test(id||''))throw new Error('Invalid review index');
   return (await read('records/'+id+'.json'))?.value;
  }));
  const reviews=records.filter(record=>record&&record.status===status).map(record=>admin?record:Object.fromEntries(publicFields.map(key=>[key,record[key]])));
  return {reviews,nextCursor:response.hasMore?response.cursor:null};
 }
 async function limit(scope,hash,maximum,seconds) {
  if(!/^[a-z]+$/.test(scope)||!/^[A-Za-z0-9_-]+$/.test(hash))throw new Error('Invalid rate key');
  const path='limits/'+scope+'/'+hash+'.json';
  for(let attempt=0;attempt<12;attempt++) {
   const current=await read(path),now=Date.now();
   const count=current&&current.value.expiresAt>now?current.value.count:0;
   if(count>=maximum)return false;
   const value={count:count+1,expiresAt:count?current.value.expiresAt:now+seconds*1000,nonce:randomUUID()};
   try{await write(path,value,current?.etag);return true;}catch(error){if(!conflict(error))throw error;}
  }
  return false; // Contention must never bypass a limit.
 }
 async function cleanup() {
  let cursor,removed=0,scanned=0;
  do {
   const batch=await storage.list({prefix:namespace+'limits/',limit:100,cursor,...opts()});
   for(const item of batch.blobs){scanned++;const current=await read(item.pathname.slice(namespace.length));if(current&&current.value.expiresAt<Date.now()-86400000){try{await storage.del(item.pathname,{ifMatch:current.etag,...opts()});removed++;}catch(error){if(!conflict(error))throw error;}}}
   cursor=batch.hasMore?batch.cursor:null;
  }while(cursor&&scanned<1000);
  return {scanned,removed};
 }
 return {save,moderate,page,limit,cleanup};
}
export const repository=createRepository(blob,process.env.REVIEW_STORAGE_NAMESPACE||(process.env.VERCEL_ENV==='preview'?'customer-reviews-preview-v1/':'customer-reviews-v1/'));
