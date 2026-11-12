// Injects the Google Tag Manager container (GTM-PK92F5J6) into every built HTML page.
// Runs after all other build steps. Idempotent: pages that already contain the
// container id are left untouched. Keeps the pre-compressed .gz copies in sync.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';

const ID = 'GTM-PK92F5J6';
const CONTACT_CAMPAIGNS = JSON.stringify(['24440969896', '24460132745']);
const HEAD = `<!-- Google Tag Manager --><script>(function(w,d,s,l,i){const campaigns=${CONTACT_CAMPAIGNS};const campaign=new URLSearchParams(location.search).get('dcr_campaign');if(campaigns.includes(campaign))return;try{if(campaign===null&&campaigns.includes(sessionStorage.getItem('dcr_ads_campaign')))return;}catch{}w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${ID}');</script><!-- End Google Tag Manager -->`;
const BODY = `<!-- Google Tag Manager (noscript) --><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript><!-- End Google Tag Manager (noscript) -->`;
const CONTACT_EVENTS = fs.readFileSync(new URL('./contact-events.js', import.meta.url), 'utf8')
  .replace('__DCR_CONTACT_CAMPAIGN_IDS__', CONTACT_CAMPAIGNS);
const PREVIEW_TEST = process.env.VERCEL_ENV === 'preview' ? `<script>${fs.readFileSync(new URL('./contact-events-preview.js', import.meta.url), 'utf8')}</script>` : '';
const BOOKING_HANDOFF = ' location.assign(url);';
const BOOKING_EVENT = " if (document.dispatchEvent(new CustomEvent('dcr:booking-whatsapp-open', {cancelable: true, detail: {continueHandoff: () => location.assign(url)}}))) location.assign(url);";

const appPath = path.join('dist', 'app.js');
const app = fs.readFileSync(appPath, 'utf8');
if (!app.includes(BOOKING_HANDOFF)) throw new Error('Booking WhatsApp handoff not found');
const measuredApp = app.includes(BOOKING_EVENT) ? app : app.replace(BOOKING_HANDOFF, BOOKING_EVENT);
const appVersion = createHash('sha256').update(measuredApp).digest('hex').slice(0, 12);
if (measuredApp !== app) {
  fs.writeFileSync(appPath, measuredApp);
  fs.writeFileSync(`${appPath}.gz`, zlib.gzipSync(measuredApp));
}

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
    let updated = html
      .replace(/<head([^>]*)>/i, (m) => `${m}${HEAD}${PREVIEW_TEST}<script>${CONTACT_EVENTS}</script>`)
      .replace(/src="\/app\.js\?v=[^"]+"/g, `src="/app.js?v=${appVersion}"`)
      .replace(/<body([^>]*)>/i, (m) => `${m}${BODY}`);
    if (file === path.join('dist', 'privacy', 'index.html')) {
      const oldNotice = 'This implementation has no analytics, advertising scripts, tracking cookies or public enquiry database.';
      if (!updated.includes(oldNotice)) throw new Error('Contact analytics privacy disclosure location not found');
      updated = updated.replace(oldNotice, 'If you allow optional contact analytics, Google Analytics counts Call taps, WhatsApp opens and booking-form handoffs from our tagged advertising campaigns. Google Analytics may use first-party cookies to distinguish visits. We do not send form details, contact numbers or WhatsApp messages to analytics. Your choice applies to this browser tab and can be changed on this page. Declining does not affect contact or booking features.');
    }
    fs.writeFileSync(file, updated);
    if (fs.existsSync(file + '.gz')) fs.writeFileSync(file + '.gz', zlib.gzipSync(updated));
    changed++;
  }
}
walk('dist');
console.log(`GTM ${ID}: injected into ${changed} of ${total} HTML pages`);
