import {config,headers,send,handleError,HttpError} from '../reviews/server/core.mjs';
import {reviewRepository} from '../reviews/server/database.mjs';
export default async function handler(req,res) {
 headers(res);
 try {
  if(req.method!=='GET'){res.setHeader('Allow','GET');throw new HttpError(405,'Method not allowed.');}
  config();send(res,200,await reviewRepository.stats());
 }catch(error){handleError(res,error);}
}
