import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// The production build restores the legacy site from verified archives.
// Retire the service after all HTML has been generated, including the blog.
const retiredRoutes = [
  'services/fuel-delivery',
  'blogs/service-fuel-delivery-dubai',
  'blogs/emergency-fuel-assistance-dubai-clear-service',
];
const retiredOffer = /(?:\/services\/fuel-delivery\/|^Emergency fuel assistance$)/i;
const roadsidePath = path.join('dist', 'services', 'roadside-assistance', 'index.html');
const scopeNote = '<p>Dubai Car Recovery does not deliver fuel. If your vehicle needs to be moved, contact us to discuss <a href="/services/car-towing/">towing</a>.</p>';

function write(filename, content) {
  fs.writeFileSync(filename, content);
  fs.writeFileSync(filename + '.gz', zlib.gzipSync(content, {level: 9}));
}

for (const route of retiredRoutes) {
  const directory = path.resolve('dist', route);
  assert(directory.startsWith(path.resolve('dist') + path.sep));
  for (const name of ['index.html', 'index.html.gz']) {
    fs.rmSync(path.join(directory, name), {force: true});
  }
  if (fs.existsSync(directory)) fs.rmdirSync(directory);
}

const sitemapPath = path.join('dist', 'sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
write(sitemapPath, sitemap.replace(/<url>[^<]*(?:<loc>[^<]+<\/loc>)[\s\S]*?<\/url>/g, entry =>
  retiredRoutes.some(route => entry.includes('/' + route + '/')) ? '' : entry));

const appPath = path.join('dist', 'app.js');
const app = fs.readFileSync(appPath, 'utf8');
const fuelEntry = "'fuel-delivery':'Emergency fuel assistance',";
assert(app.includes(fuelEntry), 'Expected legacy fuel booking map entry');
const updatedApp = app.replace(fuelEntry, '');
write(appPath, updatedApp);
const version = crypto.createHash('sha256').update(updatedApp).digest('hex').slice(0, 12);

function scrubStructuredData(data) {
  if (Array.isArray(data)) {
    return data.filter(value => !retiredOffer.test(value?.itemOffered?.url ?? '') &&
      !retiredOffer.test(value?.itemOffered?.name ?? '')).map(scrubStructuredData);
  }
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) data[key] = scrubStructuredData(value);
  }
  return data;
}

function cleanPage(html, filename) {
  const hadFuelCopy = /fuel[ -](?:assistance|delivery|enquir|requirement|help|option)|fuel and delivery|delivery availability/i.test(
    html.slice(html.indexOf('<main id="main">')));
  html = html
    .replace(/<span class="hero-service-chip codepen-service"><span class="hero-service-label">Emergency fuel assistance<\/span><\/span>/g, '')
    .replace(/<option value="Emergency fuel assistance">Emergency fuel assistance<\/option>/g, '')
    .replace(/<div class="card card-[^"]+"[^>]*><button class="img" type="button" aria-label="Read about Emergency fuel assistance">[^]*?<\/button><\/div>/g, '')
    .replace(/<a class="service-card" href="\/services\/fuel-delivery\/">[^]*?<\/a>/g, '')
    .replace(/<div class="about-service-item"><h3><a href="\/services\/fuel-delivery\/">[^]*?<\/p><\/div>/g, '')
    .replace(/<a class="blog-card" href="\/blogs\/(?:service-fuel-delivery-dubai|emergency-fuel-assistance-dubai-clear-service)\/">[^]*?<\/a>/g, '')
    .replace(/<li><a href="\/services\/fuel-delivery\/">[^<]*<\/a><\/li>/g, '')
    .replace(/<tr><td><a href="\/services\/fuel-delivery\/">[^]*?<\/tr>/g, '')
    .replace(/<p\b[^>]*>[^]*?<\/p>/gi, paragraph => {
      // Offer lists should retain the supported services alongside the removed entry.
      if (/services listed on our site include|services page also lists|site covers enquiries|Other pages focus|corresponding <a href="\/services\/battery-assistance/i.test(paragraph)) {
        return paragraph
          .replace(/,?\s+(?:and\s+|or\s+)?<a href="\/services\/fuel-delivery\/">[^<]+<\/a>(?=[.,;]| or )/gi, '')
          .replace(/, and emergency fuel enquiries|, emergency fuel assistance/g, '')
          .replace(/a battery, tyre or fuel issue/g, 'a battery or tyre issue');
      }
      if (/<a href="\/services\/fuel-delivery\/">|Our site lists .*fuel assistance|emergency fuel enquiries are separate options|team can confirm whether fuel assistance|delivery to (?:your location|the pickup point) must be (?:confirmed|checked)|whether fuel assistance is suitable and available|fuel type and delivery availability|confirm whether (?:an available fuel service|fuel delivery is available)|an on-site fuel option|correct fuel is available for that place|provide a confirmed fuel option|the requested fuel type and location are suitable for an available service/i.test(paragraph)) {
        return '<p>If your vehicle has stopped and needs to be moved, share its location and condition so our team can assess towing options.</p>';
      }
      return paragraph;
    })
    .replace(/<a href="\/services\/fuel-delivery\/">[^<]*<\/a>/g, '<a href="/services/roadside-assistance/">roadside assistance</a>')
    .replace(/<script type="application\/ld\+json">([^<]+)<\/script>/g, (original, json) => {
      if (!retiredOffer.test(json)) return original;
      return '<script type="application/ld+json">' + JSON.stringify(scrubStructuredData(JSON.parse(json))).replaceAll('<', '\\u003c') + '</script>';
    })
    .replace(/src="\/app\.js\?v=[^"]+"/g, 'src="/app.js?v=' + version + '"');

  if (filename === roadsidePath || (filename.startsWith(path.join('dist', 'blogs') + path.sep) && hadFuelCopy)) {
    html = html.replace(/(<h1\b[^>]*>[^]*?<\/h1>)/, '$1' + scopeNote);
  }
  assert(!retiredRoutes.some(route => html.includes('/' + route + '/')), 'Retired link remains in ' + filename);
  return html;
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(filename);
    else if (entry.name === 'index.html') {
      const original = fs.readFileSync(filename, 'utf8');
      const updated = cleanPage(original, filename);
      if (updated !== original) write(filename, updated);
    }
  }
}

walk('dist');
assert(!fs.readFileSync(path.join('dist', 'index.html'), 'utf8').includes('Emergency fuel assistance'));
assert(!fs.readFileSync(path.join('dist', 'book', 'index.html'), 'utf8').includes('Emergency fuel assistance'));
console.log('Fuel delivery removed from service listings, booking, structured data and the sitemap.');
