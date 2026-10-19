import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import * as blob from '@vercel/blob';
import {createRepository} from '../reviews/server/repository.mjs';
const namespace=process.env.REVIEW_STORAGE_NAMESPACE;
if(!namespace?.startsWith('local-test-'))throw new Error('Only an isolated test namespace is allowed.');
const repo=createRepository(blob,namespace);
const input={p_request_id:randomUUID(),p_name:'TEST ONLY — storage verification',p_rating:1,p_text:'TEST ONLY — persistence and moderation verification, not customer feedback.',p_service:'Car towing',p_email:'private@example.test'};
try {
 assert.equal(await repo.save(input),input.p_request_id);
 assert.equal((await repo.page()).reviews.length,0);
 assert((await repo.page({admin:true,status:'pending'})).reviews.some(row=>row.id===input.p_request_id));
 await repo.moderate(input.p_request_id,'approved','qa-test');
 const independent=createRepository(blob,namespace);
 const found=(await independent.page()).reviews.find(row=>row.id===input.p_request_id);assert(found);assert.equal(found.rating,1);assert(!('email' in found));
 await repo.save(input);assert.equal((await repo.page()).reviews.filter(row=>row.id===input.p_request_id).length,1);
 await repo.moderate(input.p_request_id,'removed','qa-test');assert(!(await repo.page()).reviews.some(row=>row.id===input.p_request_id));
 const key=randomUUID();const results=await Promise.all(Array.from({length:8},()=>repo.limit('test',key,5,3600)));assert.equal(results.filter(Boolean).length,5);
 console.log('PASS: actual private Vercel storage save, pending visibility, 1-star approval, independent read/persistence, email privacy, idempotency, removal, concurrent rate limit.');
} finally {
 const prefix=namespace;
 let page;
 do{page=await blob.list({prefix,limit:100});if(page.blobs.length)await blob.del(page.blobs.map(row=>row.url));}while(page.hasMore);
 console.log('Isolated QA records removed; production review namespace was never populated.');
}
