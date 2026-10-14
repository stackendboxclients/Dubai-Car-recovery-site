import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
const archive=fs.readFileSync('website-source.zip');
if(crypto.createHash('sha256').update(archive).digest('hex')!=='7eb639f2d0c275cc172ef005442b73995eae58369924b9f3752c59def5c728d2')throw new Error('Source archive checksum mismatch');
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
console.log(`Extracted ${written} verified production/source files`);
execFileSync(process.execPath,['scripts/verify-static.mjs'],{stdio:'inherit'});
