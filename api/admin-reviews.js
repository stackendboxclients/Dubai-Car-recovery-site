import {config,headers,send,handleError,HttpError,body,authorize,rateLimit,clientHash,sameOrigin,pagination,uuidPattern} from '../reviews/server/core.mjs';
import {repository} from '../reviews/server/repository.mjs';
import {adminPage} from '../reviews/server/admin-page.mjs';
export default async function handler(req,res) {
 headers(res);
 try {
  if(!['GET','PATCH','DELETE'].includes(req.method)){res.setHeader('Allow','GET, PATCH, DELETE');throw new HttpError(405,'Method not allowed.');}
  const cfg=config();let admin;
  try{admin=await authorize(req,cfg);}catch(error){
   await rateLimit(clientHash(req,cfg),cfg,'adminlogin',20,3600);
   if(error.status===401)res.setHeader('WWW-Authenticate','Basic realm="Customer Review Administration", charset="UTF-8"');
   throw error;
  }
  if(req.method==='GET') {
   if((req.headers.accept||'').includes('text/html')&&req.query?.format!=='json') {
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    return res.status(200).send(adminPage);
   }
   const status=req.query?.status||'pending';
   if(!['pending','approved','rejected','removed'].includes(status))throw new HttpError(400,'Invalid status.');
   return send(res,200,await repository.page({...pagination(req.query),status,admin:true}));
  }
  // Browsers cache Basic credentials; explicitly reject cross-site writes.
  // CLI clients must send an explicit Bearer credential.
  if(!/^Bearer /.test(req.headers.authorization||''))sameOrigin(req,cfg);
  const input=body(req);
  if(!uuidPattern.test(input.id||''))throw new HttpError(400,'Invalid review ID.');
  const status=req.method==='DELETE'?'removed':input.status;
  if(!['approved','rejected','removed','pending'].includes(status))throw new HttpError(400,'Invalid moderation action.');
  const updated=await repository.moderate(input.id,status,admin);
  if(!updated)throw new HttpError(404,'Review not found.');
  send(res,200,{review:updated});
 }catch(error){handleError(res,error);}
}
