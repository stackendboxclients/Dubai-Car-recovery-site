import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {BlobPreconditionFailedError} from '@vercel/blob';
import {createLimiter,repository} from '../reviews/server/repository.mjs';
import {createReviewRepository,reviewRepository} from '../reviews/server/database.mjs';
import {config,challenge,clientHash,verifyChallenge,pagination} from '../reviews/server/core.mjs';
import reviews from '../api/reviews.js';
import statsHandler from '../api/review-stats.js';
import reviewConfig from '../api/review-config.js';
import legacyAdmin from '../api/admin-reviews.js';

Object.assign(process.env,{NODE_ENV:'test',BLOB_READ_WRITE_TOKEN:'test-token',DATABASE_URL:'postgresql://test.invalid/reviews',REVIEW_SIGNING_SECRET:'test-secret-'.repeat(6),REVIEW_ALLOWED_ORIGINS:'https://www.dubaicarrecovery.site'});
delete process.env.VERCEL;
const blobs=new Map(),rows=new Map();let dbFailure=false,blobFailure=false,clock=0;
const storage={
 async get(path,options){assert.equal(options.access,'private');assert.equal(options.useCache,false);if(blobFailure)throw new Error('private storage failure');const row=blobs.get(path);return row?{statusCode:200,stream:new Response(row.text).body,blob:{etag:row.etag}}:null;},
 async put(path,value,options){if(blobFailure)throw new Error('private storage failure');const row=blobs.get(path);if(row&&(!options.allowOverwrite||options.ifMatch!==row.etag))throw new BlobPreconditionFailedError();if(options.ifMatch&&!row)throw new BlobPreconditionFailedError();blobs.set(path,{text:value,etag:randomUUID()});return {pathname:path};},
 async list({prefix}){return {blobs:[...blobs.keys()].filter(pathname=>pathname.startsWith(prefix)).map(pathname=>({pathname})),hasMore:false};},
 async del(path){blobs.delete(path);}
};
Object.assign(repository,createLimiter(storage,'test/'));
const sql=async(strings,...values)=>{
 if(dbFailure)throw new Error('secret database failure');
 const query=strings.join('?');
 if(query.includes('INSERT INTO customer_reviews')){
  const [id,customer_name,rating,review_text,submission_hash]=values;
  if(rows.has(id)||[...rows.values()].some(row=>row.submission_hash===submission_hash))return [];
  const row={id,customer_name,rating,review_text,submission_hash,source:'customer_submission',status:'published',created_at:new Date(Date.now()+clock++).toISOString()};rows.set(id,row);return [row];
 }
 if(query.includes('WHERE id='))return rows.has(values[0])?[rows.get(values[0])]:[];
 if(query.includes('COUNT(*)')){const genuine=[...rows.values()].filter(row=>row.status==='published'&&row.source==='customer_submission');return [{count:genuine.length,average:genuine.length?genuine.reduce((sum,row)=>sum+row.rating,0)/genuine.length:0}];}
 if(query.includes('SELECT id,customer_name,rating,review_text,created_at')){
  const limit=values.at(-1),after=values.length===3?values:null;
  return [...rows.values()].filter(row=>row.status==='published'&&row.source==='customer_submission'&&(!after||row.created_at<after[0]||row.created_at===after[0]&&row.id<after[1])).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id)).slice(0,limit);
 }
 throw new Error('Unexpected SQL query: '+query);
};
Object.assign(reviewRepository,createReviewRepository(()=>sql));
const req=(method='GET',body,extra={})=>({method,body,query:{},socket:{remoteAddress:'203.0.113.7'},headers:{origin:'https://www.dubaicarrecovery.site','content-type':'application/json'},...extra});
const call=async(handler,request)=>{const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(value){this.body=value;}};await handler(request,res);return res;};
const valid=(overrides={})=>({name:'TEST ONLY Customer',rating:5,text:'TEST ONLY: professional towing experience.',website:'',requestId:randomUUID(),challenge:challenge(clientHash(req(),config()),config(),Date.now()-3000),...overrides});
const clear=()=>{rows.clear();blobs.clear();clock=0;};

test('automatic customer reviews',async t=>{
 await t.test('all five ratings publish and persist for independent GET requests',async()=>{clear();for(let rating=1;rating<=5;rating++){const result=await call(reviews,req('POST',valid({rating,text:`TEST ONLY: my honest experience rating ${rating} stars.`})));assert.equal(result.statusCode,201);assert.equal(result.body.review.rating,rating);assert.equal(result.body.saved,true);}const first=await call(reviews,req());const second=await call(reviews,req());assert.equal(first.body.reviews.length,5);assert.deepEqual(first.body.reviews,second.body.reviews);assert.equal(first.body.stats.count,5);assert.equal(first.body.stats.average,3);assert.equal((await call(statsHandler,req())).body.average,3);});
 await t.test('example content is never included in genuine statistics',async()=>{clear();const result=await call(reviews,req());assert.equal(result.body.stats.count,0);assert.equal(result.body.stats.average,0);assert.equal(result.body.reviews.length,0);});
 await t.test('idempotent request and content deduplication',async()=>{clear();const input=valid();assert.equal((await call(reviews,req('POST',input))).statusCode,201);assert.equal((await call(reviews,req('POST',input))).statusCode,201);assert.equal(rows.size,1);assert.equal((await call(reviews,req('POST',{...input,requestId:randomUUID()}))).statusCode,409);assert.equal(rows.size,1);});
 await t.test('invalid, malicious and cross-origin submissions fail',async()=>{clear();for(const change of [{name:'',rating:0,text:''},{rating:6},{rating:1.5},{text:'short'},{text:'Call +971501263137 for your review'},{text:'Visit https://spam.invalid today'},{website:'bot'}]){blobs.clear();const result=await call(reviews,req('POST',valid(change)));assert([400,422].includes(result.statusCode));}assert.equal(rows.size,0);assert.equal((await call(reviews,req('POST',valid(),{headers:{origin:'https://attacker.invalid','content-type':'application/json'}}))).statusCode,403);assert.equal((await call(reviews,req('POST',valid(),{headers:{origin:'https://www.dubaicarrecovery.site','content-type':'application/json','content-length':'17000'}}))).statusCode,413);assert.throws(()=>pagination({cursor:'../records'}));});
 await t.test('plain text and multiline formatting are stored safely',async()=>{clear();const text="<script>alert('test')</script>\nThe driver helped carefully.";const result=await call(reviews,req('POST',valid({name:'  Test\u0000    Customer  ',text})));assert.equal(result.statusCode,201);assert.equal(result.body.review.customer_name,'Test Customer');assert.equal((await call(reviews,req())).body.reviews[0].review_text,text);});
 await t.test('database and rate-store failures do not claim success',async()=>{clear();dbFailure=true;let result=await call(reviews,req('POST',valid()));assert.equal(result.statusCode,503);assert(!result.body.saved);dbFailure=false;blobFailure=true;result=await call(reviews,req('POST',valid()));assert.equal(result.statusCode,503);assert(!result.body.saved);blobFailure=false;assert.equal(rows.size,0);});
 await t.test('rate limiting is shared and blocks a sixth hourly attempt',async()=>{clear();for(let n=0;n<5;n++){const result=await call(reviews,req('POST',valid({text:`TEST ONLY: independent experience number ${n}.`})));assert.equal(result.statusCode,201);}assert.equal((await call(reviews,req('POST',valid()))).statusCode,429);});
 await t.test('cursor pagination handles more than one page without repetition',async()=>{clear();for(let n=0;n<14;n++){const value=valid({name:'TEST ONLY Customer '+n,text:'TEST ONLY: review number '+n+' of fourteen.'});const hash=randomUUID();await reviewRepository.save({p_request_id:value.requestId,p_name:value.name,p_rating:value.rating,p_text:value.text,p_submission_hash:hash});}let cursor,ids=[];do{const result=await call(reviews,req('GET',null,{query:cursor?{cursor}:{}}));assert.equal(result.statusCode,200);ids.push(...result.body.reviews.map(review=>review.id));cursor=result.body.nextCursor;}while(cursor);assert.equal(ids.length,14);assert.equal(new Set(ids).size,14);});
 await t.test('legacy manual moderation endpoint is disabled',async()=>{for(const method of ['GET','PATCH','DELETE'])assert.equal((await call(legacyAdmin,req(method))).statusCode,410);});
 await t.test('signed challenge rejects forged, too-fast and expired tokens',async()=>{const cfg=config();for(const token of ['forged',challenge('a',cfg),challenge('a',cfg,Date.now()-7300000),challenge('b',cfg,Date.now()-3000)])assert.throws(()=>verifyChallenge(token,'a',cfg));assert.equal((await call(reviewConfig,req())).statusCode,200);});
 await t.test('existing carousel styling and examples remain',()=>{const baseline=JSON.parse(fs.readFileSync('tests/original-assets.json'));const current=fs.readFileSync('dist/index.html','utf8');const hash=value=>createHash('sha256').update(value).digest('hex');assert.equal(hash(fs.readFileSync('dist/styles.css')),baseline['styles.css']);assert.equal((current.match(/class="example-review-label"/g)||[]).length,6);assert(current.includes('setInterval')===false);assert(fs.readFileSync('dist/app.js','utf8').includes('setInterval(nextReviewSet,2000)'));assert(current.includes('Your review will appear automatically after successful submission.'));assert(!current.includes('after approval'));assert(!fs.readFileSync('reviews/client/reviews.js','utf8').includes('innerHTML'));});
});
