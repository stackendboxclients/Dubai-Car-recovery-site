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
extractArchive('about-update.zip','0e67a3cb6d4c8010cb18f3ecb9f44c907d419d1aed03393d89218cade45f5120');
// The production assets are already present in dist. Restore this shared image
// directory for anyone rebuilding the published source archive after download.
fs.cpSync('dist/media/recovery','source/assets/recovery',{recursive:true});
execFileSync(process.execPath,['scripts/verify-static.mjs'],{stdio:'inherit'});
