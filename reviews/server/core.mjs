import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import {repository} from './repository.mjs';

export const services = ['Car towing','Flatbed towing','Luxury & sports cars','Breakdown recovery','Accident recovery','Roadside assistance','Battery boost assistance','Tyre assistance','Emergency fuel assistance','Desert & off-road recovery','Motorcycle transport','Commercial vehicle recovery','Vehicle passing transport assistance'];
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class HttpError extends Error {
 constructor(status, message, errors) { super(message); this.status=status; this.errors=errors; }
}
export function config(env=process.env) {
 const origins=(env.REVIEW_ALLOWED_ORIGINS||'https://www.dubaicarrecovery.site,https://dubaicarrecovery.site').split(',').map(s=>s.trim());
 if(env.VERCEL_ENV==='preview'&&env.VERCEL_URL)origins.push('https://'+env.VERCEL_URL);
 if (!(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID) || !(env.DATABASE_URL||env.POSTGRES_URL) || env.REVIEW_SIGNING_SECRET?.length<32 || !env.REVIEW_SIGNING_SECRET) throw new HttpError(503,'Reviews are temporarily unavailable. Please try again later.');
 if(Boolean(env.TURNSTILE_SITE_KEY)!==Boolean(env.TURNSTILE_SECRET_KEY)) throw new HttpError(503,'Reviews are temporarily unavailable. Please try again later.');
 return {secret:env.REVIEW_SIGNING_SECRET,origins,siteKey:env.TURNSTILE_SITE_KEY||'',turnstileSecret:env.TURNSTILE_SECRET_KEY||''};
}
export function headers(res) {
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
}
export function send(res,status,body) { res.status(status).json(body); }
export function handleError(res,error) {
 if(error.status===429)res.setHeader('Retry-After','3600');
 if(!(error instanceof HttpError))console.error('Reviews request failed', {type:error?.name,code:error?.code||null,category:/certificate|self.signed|unable to verify/i.test(error?.message||'')?'tls':/password authentication|authentication failed/i.test(error?.message||'')?'auth':/connect|timeout|getaddrinfo|ENOTFOUND/i.test(error?.message||'')?'connection':/customer_reviews/i.test(error?.message||'')?'schema':'other'});
 send(res,error instanceof HttpError?error.status:503,{error:error instanceof HttpError?error.message:'Reviews are temporarily unavailable. Please try again later.',...(error.errors?{errors:error.errors}:{})});
}
export function sameOrigin(req,cfg) {
 if(!cfg.origins.includes(req.headers.origin))throw new HttpError(403,'Please submit your review from our website.');
 if(req.headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'Please submit your review from our website.');
}
export function body(req) {
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new HttpError(415,'Please send JSON.');
 if(Number(req.headers['content-length'])>16384)throw new HttpError(413,'Your review is too long.');
 let value=req.body;
 if(typeof value==='string') {try{value=JSON.parse(value);}catch{throw new HttpError(400,'Invalid request.');}}
 if(!value||typeof value!=='object'||Array.isArray(value)||Buffer.byteLength(JSON.stringify(value))>16384)throw new HttpError(400,'Invalid request.');
 return value;
}
const clean=value=>typeof value==='string'?value.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim():'';
export function validateReview(input) {
 const name=clean(input.name).replace(/\s+/g,' '),text=clean(input.text),rating=input.rating;
 const errors={};
 if(name.length<2||name.length>80)errors.name='Enter a name between 2 and 80 characters.';
 if(!Number.isInteger(rating)||rating<1||rating>5)errors.rating='Choose a rating from 1 to 5 stars.';
 if(text.length<10||text.length>3000)errors.text='Write between 10 and 3,000 characters.';
 if(/(?:https?:\/\/|www\.|\b[^\s@]+@[^\s@]+\.[^\s@]+\b|(?:\+?\d[\s().-]*){8,})/i.test(text))errors.text='Please remove links, phone numbers and email addresses from your review.';
 if(Object.keys(errors).length)throw new HttpError(422,'Please check the highlighted fields.',errors);
 if(!uuidPattern.test(input.requestId||''))throw new HttpError(400,'Please refresh the form and try again.');
 return {p_request_id:input.requestId,p_name:name,p_rating:rating,p_text:text};
}
export function sign(value,cfg) {return createHmac('sha256',cfg.secret).update(value).digest('base64url');}
export function submissionHash(review,client,cfg) {return sign('review:'+client+':'+JSON.stringify([review.p_name.toLocaleLowerCase('en'),review.p_rating,review.p_text]),cfg);}
export function clientHash(req,cfg) {
 // Vercel overwrites this platform header. Never trust a visitor-supplied X-Forwarded-For.
 const ip=process.env.VERCEL?req.headers['x-vercel-forwarded-for']?.split(',')[0].trim():req.socket?.remoteAddress;
 if(!ip||!isIP(ip))throw new HttpError(503,'Unable to verify your request. Please try again later.');
 return sign('ip:'+ip,cfg);
}
export function challenge(hash,cfg,now=Date.now()) {
 const value=Buffer.from(JSON.stringify({time:now,nonce:randomUUID(),hash})).toString('base64url');
 return value+'.'+sign(value,cfg);
}
export function verifyChallenge(token,hash,cfg,now=Date.now()) {
 try {
  if(typeof token!=='string'||token.length>1024)throw new Error();
  const [value,signature,...extra]=token.split('.');
  const expected=Buffer.from(sign(value,cfg)),actual=Buffer.from(signature||'');
  if(extra.length||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error();
  const data=JSON.parse(Buffer.from(value,'base64url').toString());
  if(data.hash!==hash||!Number.isFinite(data.time)||now-data.time<2000||now-data.time>7200000)throw new Error();
 }catch{throw new HttpError(400,'Please wait a moment, or refresh the form if it has expired.');}
}
export async function rateLimit(hash,cfg,scope='submit',limit=5,seconds=3600) {
 const allowed=await repository.limit(scope,hash,limit,seconds);
 if(allowed!==true)throw new HttpError(429,'Too many attempts. Please try again later.');
}
export async function verifyBot(input,cfg) {
 if(typeof input.website!=='string'||input.website!=='')throw new HttpError(400,'Unable to accept this submission.');
 if(!cfg.turnstileSecret)return;
 if(typeof input.turnstileToken!=='string'||!input.turnstileToken||input.turnstileToken.length>2048)throw new HttpError(400,'Please complete the security check.');
 const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:cfg.turnstileSecret,response:input.turnstileToken}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new HttpError(503,'The security check is unavailable. Please try again.');
 const result=await response.json();
 const hosts=cfg.origins.map(origin=>new URL(origin).hostname);
 if(!result.success||!hosts.includes(result.hostname)||result.action!=='customer_review')throw new HttpError(400,'The security check expired or failed. Please try again.');
}
export function pagination(query={}) {
 const limit=6;
 if(!query.cursor)return {limit,cursor:undefined};
 try {
  if(typeof query.cursor!=='string'||query.cursor.length>180||!/^[A-Za-z0-9_-]+$/.test(query.cursor))throw new Error();
  return {limit,cursor:query.cursor};
 }catch{throw new HttpError(400,'Invalid review page.');}
}
