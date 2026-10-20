import {config,headers,send,handleError,HttpError,sameOrigin,body,validateReview,clientHash,verifyChallenge,rateLimit,verifyBot,pagination,submissionHash} from '../reviews/server/core.mjs';
import {reviewRepository} from '../reviews/server/database.mjs';

export default async function handler(req,res) {
 headers(res);
 try {
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');throw new HttpError(405,'Method not allowed.');}
  const cfg=config();
  const hash=clientHash(req,cfg);
  if(req.method==='GET') {
   const page=pagination(req.query);
   try{return send(res,200,await reviewRepository.page(page));}
   catch(error){if(error.code==='INVALID_CURSOR')throw new HttpError(400,error.message);throw error;}
  }
  sameOrigin(req,cfg);
  const input=body(req);
  await rateLimit(hash,cfg);
  const review=validateReview(input);
  verifyChallenge(input.challenge,hash,cfg);
  await verifyBot(input,cfg);
  review.p_submission_hash=submissionHash(review,hash,cfg);
  let saved;
  try{saved=await reviewRepository.save(review);}catch(error){if(error.code==='REQUEST_CONFLICT')throw new HttpError(409,error.message);throw error;}
  if(saved?.id!==review.p_request_id)throw new HttpError(503,'We could not confirm that your review was saved. Please retry.');
  let stats=null;
  try{stats=await reviewRepository.stats();}catch(error){console.error('Review saved but rating refresh failed',{type:error.name});}
  send(res,201,{saved:true,review:saved,stats,message:'Thank you for sharing your experience! Your review is now published.'});
 }catch(error){handleError(res,error);}
}
