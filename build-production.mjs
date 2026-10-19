import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
function extractArchive(file,expectedHash){
const archive=fs.readFileSync(file);
if(crypto.createHash('sha256').update(archive).digest('hex')!==expectedHash)throw new Error(`${file} checksum mismatch`);
let end=-1;
for(let i=archive.length-22;i>=Math.max(0,archive.length-65557);i--){if(archive.readUInt32LE(i)===0x06054b50){end=i;break;}}
if(end<0)throw new Error('ZIP directory missing');
let cursor=archive.readUInt32LE(end+16);const count=archive.readUInt16LE(end+10);
const cwd=path.resolve('.');let written=0;
for(let i=0;i<count;i++){
 if(archive.readUInt32LE(cursor)!==0x02014b50)throw new Error('Invalid ZIP entry');
 const method=archive.readUInt16LE(cursor+10),size=archive.readUInt32LE(cursor+20),decodedSize=archive.readUInt32LE(cursor+24);
 const nameLength=archive.readUInt16LE(cursor+28),extraLength=archive.readUInt16LE(cursor+30),commentLength=archive.readUInt16LE(cursor+32),offset=archive.readUInt32LE(cursor+42);
 const name=archive.subarray(cursor+46,cursor+46+nameLength).toString('utf8');cursor+=46+nameLength+extraLength+commentLength;
 if(!/^(source|dist|scripts)\//.test(name)&&name!=='PRODUCTION.md')throw new Error('Unexpected archive path');
 const target=path.resolve(cwd,name);if(!target.startsWith(cwd+path.sep)||name.includes('\\'))throw new Error('Unsafe archive path');
 if(archive.readUInt32LE(offset)!==0x04034b50)throw new Error('Invalid ZIP local entry');
 const start=offset+30+archive.readUInt16LE(offset+26)+archive.readUInt16LE(offset+28);
 const bytes=archive.subarray(start,start+size);
 const decoded=method===0?bytes:method===8?zlib.inflateRawSync(bytes):null;
 if(!decoded||decoded.length!==decodedSize)throw new Error('ZIP extraction failed');
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,decoded);written++;
}
console.log(`Extracted ${written} verified files from ${file}`);
}
extractArchive('website-source.zip','924ec363b79c4a1f49a4da8f859b8cc0a30538c54607e352ddb8a7574e4c081c');
extractArchive('about-update.zip','4c6c68791e02abfef33564a6b371fbe741562cf01d734d6cebebcf35d53393e4');
extractArchive('favicon-update.zip','6e320e4fe15b05080c38aa7ba228aa1c875d09caed1ea1163ae3246ea79d59bb');
extractArchive('circle-favicon-assets.zip','f9353ef51983bc67240840de8cd802e0dce91feb7387ab2b02dfddeaf32551c5');
for(const name of ['favicon.png','favicon-32.png','favicon.ico','apple-touch-icon.png','app-icon-192.png','app-icon-512.png','site.webmanifest']){
 fs.copyFileSync(path.join('source/assets',name),path.join('dist',name));
}
function updateFaviconVersion(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){updateFaviconVersion(file);continue;}
  if(!entry.name.endsWith('.html'))continue;
  const html=fs.readFileSync(file,'utf8');
  const updated=html.replaceAll('red-logo-1','circle-logo-3');
  if(updated===html)continue;
  fs.writeFileSync(file,updated);
  if(fs.existsSync(file+'.gz'))fs.writeFileSync(file+'.gz',zlib.gzipSync(updated));
 }
}
updateFaviconVersion('dist');
// The production assets are already present in dist. Restore this shared image
// directory for anyone rebuilding the published source archive after download.
fs.cpSync('dist/media/recovery','source/assets/recovery',{recursive:true});
execFileSync(process.execPath,['scripts/verify-static.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/build-reviews.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/verify-static.mjs'],{stdio:'inherit'});
