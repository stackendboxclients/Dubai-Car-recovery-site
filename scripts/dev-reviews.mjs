// Local QA server. Uses the same handlers as Vercel and a separate private test namespace.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import reviews from '../api/reviews.js';
import config from '../api/review-config.js';
import cleanup from '../api/review-cleanup.js';
if(!process.env.REVIEW_STORAGE_NAMESPACE?.startsWith('local-test-'))throw new Error('Local QA requires an isolated local-test- storage namespace.');
const routes={'/api/reviews':reviews,'/api/review-config':config,'/api/review-cleanup':cleanup};
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml','.mp4':'video/mp4','.xml':'application/xml'};
http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://127.0.0.1:4189'),handler=routes[url.pathname.replace(/\/$/,'')];
  res.status=code=>{res.statusCode=code;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};res.send=data=>res.end(data);
  if(handler){req.query=Object.fromEntries(url.searchParams);let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16384){res.status(413).json({error:'Request too large.'});return;}}req.body=raw;await handler(req,res);return;}
  let file=path.resolve('dist','.'+decodeURIComponent(url.pathname));if(!file.startsWith(path.resolve('dist')+path.sep)&&file!==path.resolve('dist')){res.status(404).end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.status(404).end('Not found');return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
 }catch{res.statusCode=500;res.end('Local QA server error');}
}).listen(4189,'127.0.0.1',()=>console.log('Local review QA: http://127.0.0.1:4189/#share-your-experience (isolated private test storage)'));
