import readline from 'node:readline/promises';
import {Writable} from 'node:stream';
import {uuidPattern} from '../reviews/server/core.mjs';
const [action='list',argument='',cursor='']=process.argv.slice(2);
if(!['list','approve','reject','remove','pending'].includes(action))throw new Error('Use list [status] [cursor], approve ID, reject ID, remove ID or pending ID.');
const base=process.env.REVIEW_SITE_URL||'https://www.dubaicarrecovery.site';
if(new URL(base).protocol!=='https:')throw new Error('Use your HTTPS website URL.');
let token=process.env.REVIEW_ADMIN_ACCESS_TOKEN;
if(!token) {
 if(!process.stdin.isTTY)throw new Error('Use an interactive terminal to enter your administrator access key.');
 process.stdout.write('Administrator access key (hidden): ');
 const silent=new Writable({write(_chunk,_encoding,callback){callback();}});
 const prompt=readline.createInterface({input:process.stdin,output:silent,terminal:true});token=await prompt.question('');prompt.close();process.stdout.write('\n');
}
let path='/api/admin-reviews',method='GET',payload;
if(action==='list') {
 const status=argument||'pending';if(!['pending','approved','rejected','removed'].includes(status))throw new Error('Invalid status.');path+='?status='+status+(cursor?'&cursor='+encodeURIComponent(cursor):'');
}else{if(!uuidPattern.test(argument))throw new Error('Provide a review UUID from the list command.');method=action==='remove'?'DELETE':'PATCH';payload={id:argument,status:{approve:'approved',reject:'rejected',pending:'pending'}[action]};}
const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(20000)});
const result=await response.json();if(!response.ok)throw new Error(result.error||'Moderation failed.');console.log(JSON.stringify(result,null,2));
