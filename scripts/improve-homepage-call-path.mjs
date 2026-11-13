import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const file = 'dist/index.html';
let html = readFileSync(file, 'utf8');

function replaceOnce(before, after) {
  assert.equal(html.split(before).length, 2, 'Expected one matching homepage element');
  html = html.replace(before, () => after);
}

const originalHeading = /<p class="hero-dubai-title">DUBAI<\/p><h1>[^]*?<\/h1>/;
const heading = html.match(originalHeading);
assert(heading, 'Expected homepage hero heading');
replaceOnce(heading[0], '<h1><span class="neon-text">Car Recovery</span><br><span class="metal-text">&amp; Towing in Dubai</span></h1>');
replaceOnce(
  'Towing, recovery and flatbed transport for standard, luxury and sports cars, plus bike towing, motorcycle transport, breakdown recovery and roadside assistance across Dubai.',
  'Need a tow in Dubai? Call for breakdown or accident recovery, flatbed transport, or a tow to your garage or workshop.'
);
replaceOnce(
  '<p class="hero-condition">Subject to availability and location.</p><p class="hero-vehicle-line">WE RECOVER LUXURY, STANDARD, SPORTS CARS &amp; BIKES</p>',
  '<p class="hero-condition">Phone enquiries 24/7. We confirm availability and your quote before pickup.</p>'
);

const styles = `<style id="homepage-call-path">
  body[data-page="home"] .hero h1 span { display: inline; }
  body[data-page="home"] .hero .hero-description { color: #f7f7f5; }
  body[data-page="home"] .hero .hero-condition { font-size: 13px; color: #f7f7f5; line-height: 1.4; }
  body[data-page="home"] .hero-contact-trio .btn { animation: none; translate: none; }
  body[data-page="home"] .hero-contact-trio a:focus-visible { outline: 3px solid white; outline-offset: 3px; }
  @media (max-width: 699px) {
    body[data-page="home"] .hero .hero-content { position: relative; justify-content: flex-start; padding-top: 104px !important; }
    body[data-page="home"] .hero h1 { font-size: clamp(31px, 8.25vw, 48px) !important; line-height: 1.05; }
    body[data-page="home"] .hero-contact-trio { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    body[data-page="home"] .hero-contact-trio .call { grid-column: 1 / -1; min-height: 56px; }
    body[data-page="home"] .hero-contact-trio .call span { font-size: 18px !important; }
  }
</style>`;
replaceOnce('</head>', `${styles}\n</head>`);

assert.match(html, /<a class="btn call" href="tel:\+971501263137" data-contact="phone">/);
assert.match(html, /<link rel="canonical" href="https:\/\/www\.dubaicarrecovery\.site\/"/);
writeFileSync(file, html);
writeFileSync(`${file}.gz`, gzipSync(html, { level: 9 }));
console.log('Homepage towing description and mobile call hierarchy updated.');
