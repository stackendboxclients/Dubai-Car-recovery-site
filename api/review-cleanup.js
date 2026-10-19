import {timingSafeEqual} from 'node:crypto';
import {headers,send,handleError,HttpError} from '../reviews/server/core.mjs';
import {repository} from '../reviews/server/repository.mjs';
export default async function handler(req,res) {
 headers(res);
 try {
  if(req.method!=='GET')throw new HttpError(405,'Method not allowed.');
  const actual=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+(process.env.CRON_SECRET||''));
  if(!process.env.CRON_SECRET||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new HttpError(401,'Authentication required.');
  send(res,200,await repository.cleanup());
 }catch(error){handleError(res,error);}
}
