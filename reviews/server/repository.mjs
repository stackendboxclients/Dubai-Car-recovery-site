import * as blob from '@vercel/blob';
import {randomUUID} from 'node:crypto';

const conflict=error=>error instanceof blob.BlobPreconditionFailedError||/already exists|already been uploaded|precondition/i.test(error?.message||'');
const opts=()=>({abortSignal:AbortSignal.timeout(12000)});

// The existing private Blob store remains an atomic shared rate-limit store.
// Customer review records are written to Postgres in database.mjs.
export function createLimiter(storage=blob,namespace='customer-reviews-v1/') {
 async function read(path) {
  const result=await storage.get(namespace+path,{access:'private',useCache:false,...opts()});
  if(!result)return null;
  if(result.statusCode!==200)throw new Error('Unexpected storage response');
  return {value:await new Response(result.stream).json(),etag:result.blob.etag};
 }
 async function write(path,value,etag) {
  return storage.put(namespace+path,JSON.stringify(value),{access:'private',addRandomSuffix:false,allowOverwrite:Boolean(etag),...(etag?{ifMatch:etag}:{}),contentType:'application/json',cacheControlMaxAge:60,...opts()});
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
  return false;
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
 return {limit,cleanup};
}
export const repository=createLimiter(blob,process.env.REVIEW_STORAGE_NAMESPACE||(process.env.VERCEL_ENV==='preview'?'customer-reviews-preview-v1/':'customer-reviews-v1/'));
