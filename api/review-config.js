import {config,headers,send,handleError,HttpError,clientHash,challenge,rateLimit} from '../reviews/server/core.mjs';
export default async function handler(req,res) {
 headers(res);
 try {
  if(req.method!=='GET'){res.setHeader('Allow','GET');throw new HttpError(405,'Method not allowed.');}
  const cfg=config(),hash=clientHash(req,cfg);
  await rateLimit(hash,cfg,'config',60,60);
  send(res,200,{challenge:challenge(hash,cfg),siteKey:cfg.siteKey});
 }catch(error){handleError(res,error);}
}
