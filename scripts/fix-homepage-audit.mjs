import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';

const dist = path.resolve('dist');
const business = JSON.parse(fs.readFileSync('source/business.json', 'utf8'));
const whatsapp = `https://wa.me/${business.whatsapp}`;
assert(/^https:\/\/wa\.me\/\d{9,15}$/.test(whatsapp));

// The prepared link is hidden until a valid enquiry is ready. Keep a real
// fallback destination in the markup and after form resets so crawlers and
// assistive technology never encounter an anchor without an href.
const appPath = path.join(dist, 'app.js');
let app = fs.readFileSync(appPath, 'utf8');
assert(app.includes("link.removeAttribute('href')"), 'Expected enquiry reset code');
app = app.replace("link.removeAttribute('href')", `link.href='${whatsapp}'`);
fs.writeFileSync(appPath, app);
fs.writeFileSync(`${appPath}.gz`, zlib.gzipSync(app, {level: 9}));
const appVersion = crypto.createHash('sha256').update(app).digest('hex').slice(0, 12);
const galleryFiles = Array.from({length: 17}, (_, index) => `recovery-${String(index + 1).padStart(2, '0')}.webp`);
const galleryHash = crypto.createHash('sha256');
for (const name of galleryFiles) galleryHash.update(fs.readFileSync(path.join('assets', 'optimized-gallery', name)));
const galleryVersion = galleryHash.digest('hex').slice(0, 12);

let changedPages = 0;
function updateHtml(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { updateHtml(file); continue; }
    if (entry.name !== 'index.html') continue;
    const original = fs.readFileSync(file, 'utf8');
    let html = original.replaceAll('<a class="prepared-link" hidden', `<a class="prepared-link" href="${whatsapp}" hidden`);
    html = html.replaceAll('<div class="review-dots" aria-label="Review rotation">', '<div class="review-dots" role="group" aria-label="Review rotation">');
    html = html.replace(/(<article class="transport-slide"[^>]*><img src="\/media\/recovery\/recovery-\d{2}\.webp)"/g, `$1?v=${galleryVersion}"`);
    html = html.replace(/src="\/app\.js\?v=[^"]+"/g, `src="/app.js?v=${appVersion}"`);
    if (html === original) continue;
    fs.writeFileSync(file, html);
    fs.writeFileSync(`${file}.gz`, zlib.gzipSync(html, {level: 9}));
    changedPages++;
  }
}
updateHtml(dist);
assert(changedPages >= 2, 'Expected homepage and booking page updates');

// Same gallery photos, dimensions and markup; smaller WebP files reduce the
// amount fetched by the already-existing transport carousel.
for (const name of galleryFiles) {
  const src = path.join('assets', 'optimized-gallery', name);
  assert(fs.existsSync(src), `Missing optimized gallery image: ${name}`);
  fs.copyFileSync(src, path.join(dist, 'media', 'recovery', name));
}
console.log(`Audit fixes applied to ${changedPages} pages; 17 gallery images optimized.`);
