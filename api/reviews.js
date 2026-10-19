import {config,headers,send,handleError,HttpError,sameOrigin,body,validateReview,clientHash,verifyChallenge,rateLimit,verifyBot,pagination,uuidPattern} from '../reviews/server/core.mjs';
import {repository} from '../reviews/server/repository.mjs';

export default async function handler(req,res) {
 headers(res);
 try {
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');throw new HttpError(405,'Method not allowed.');}
  const cfg=config();
  const hash=clientHash(req,cfg);
  if(req.method==='GET') {
   const page=pagination(req.query);
   return send(res,200,await repository.page(page));
  }
  sameOrigin(req,cfg);
  const input=body(req);
  await rateLimit(hash,cfg);
  const review=validateReview(input);
  verifyChallenge(input.challenge,hash,cfg);
  await verifyBot(input,cfg);
  let saved;
  try{saved=await repository.save(review);}catch(error){if(error.code==='REQUEST_CONFLICT')throw new HttpError(409,error.message);throw error;}
  if(typeof saved!=='string'||!uuidPattern.test(saved))throw new HttpError(503,'We could not confirm that your review was saved. Please retry.');
  send(res,201,{saved:true,message:'Thank you for sharing your experience! Your review has been submitted and will appear after approval.'});
 }catch(error){handleError(res,error);}
}
