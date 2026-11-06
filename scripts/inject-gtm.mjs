// Injects the Google Tag Manager container (GTM-PK92F5J6) into every built HTML page.
// Runs after all other build steps. Idempotent: pages that already contain the
// container id are left untouched. Keeps the pre-compressed .gz copies in sync.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ID = 'GTM-PK92F5J6';
const HEAD = `<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${ID}');</script><!-- End Google Tag Manager -->`;
const BODY = `<!-- Google Tag Manager (noscript) --><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript><!-- End Google Tag Manager (noscript) -->`;

let changed = 0;
let total = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!entry.name.endsWith('.html')) continue;
    total++;
    const html = fs.readFileSync(file, 'utf8');
    if (html.includes(ID)) continue;
    if (!/<head[^>]*>/i.test(html) || !/<body[^>]*>/i.test(html)) continue;
    const updated = html
      .replace(/<head([^>]*)>/i, (m) => `${m}${HEAD}`)
      .replace(/<body([^>]*)>/i, (m) => `${m}${BODY}`);
    fs.writeFileSync(file, updated);
    if (fs.existsSync(file + '.gz')) fs.writeFileSync(file + '.gz', zlib.gzipSync(updated));
    changed++;
  }
}
walk('dist');
console.log(`GTM ${ID}: injected into ${changed} of ${total} HTML pages`);
