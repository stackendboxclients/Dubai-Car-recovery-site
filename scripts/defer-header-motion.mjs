import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const appFile = 'dist/app.js';
let app = readFileSync(appFile, 'utf8');

function replaceOnce(text, before, after) {
  assert.equal(text.split(before).length, 2, `Expected one match for ${before}`);
  return text.replace(before, () => after);
}

app = replaceOnce(
  app,
  " let backgroundVisible=backgroundSelector==='.header-motion-background';\n const shouldPlay=()=>!document.hidden&&!reducedMotion.matches&&backgroundVisible;",
  " const isHeaderBackground=backgroundSelector==='.header-motion-background';\n let backgroundVisible=isHeaderBackground;\n const shouldPlay=()=>!document.hidden&&!reducedMotion.matches&&backgroundVisible&&\n  (!isHeaderBackground||document.readyState==='complete');",
);
app = replaceOnce(
  app,
  " reducedMotion.addEventListener?.('change',resumeBackground);\n resumeBackground();",
  " reducedMotion.addEventListener?.('change',resumeBackground);\n if(isHeaderBackground&&document.readyState!=='complete'){\n  window.addEventListener('load',resumeBackground,{once:true});\n }\n resumeBackground();",
);
writeFileSync(appFile, app);
writeFileSync(`${appFile}.gz`, gzipSync(app, { level: 9 }));
const version = createHash('sha256').update(app).digest('hex').slice(0, 12);

let updatedPages = 0;
for (const name of readdirSync('dist', { recursive: true })) {
  if (!name.endsWith('.html')) continue;
  const file = join('dist', name);
  const html = readFileSync(file, 'utf8');
  if (!html.includes('class="header-motion-background')) continue;

  const videos = html.match(/<video class="header-motion-background[^>]*><source src="\/media\/header-clouds\.mp4"[^>]*>/g);
  assert.equal(videos?.length, 2, `Expected two header players in ${file}`);
  let updated = html;
  for (const video of videos) {
    updated = replaceOnce(updated, video, video
      .replace(' autoplay', '')
      .replace('preload="metadata"', 'preload="none"')
      .replace('<source src=', '<source data-src='));
  }

  const scriptUrl = updated.match(/\/app\.js\?v=[a-f0-9]+/)?.[0];
  assert(scriptUrl, `Expected versioned app script in ${file}`);
  updated = replaceOnce(updated, scriptUrl, `/app.js?v=${version}`);
  writeFileSync(file, updated);
  writeFileSync(`${file}.gz`, gzipSync(updated, { level: 9 }));
  updatedPages++;
}
assert(updatedPages > 0, 'Expected generated pages with header video');
console.log(`Deferred decorative header motion on ${updatedPages} pages.`);
