import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// The immutable source archives contain an old Al Quoz location claim. The
// owner's e-License instead lists these registered premises. The business
// serves Dubai, and the registered premises are not a walk-in office.
const registeredAddress = 'Business Centre, Floor 3, Building A3, Business Park, Dubai, United Arab Emirates';
const replacements = [
  ['Based in Al Quoz Industrial Area. Tell us your exact pickup location', 'Serving customers across Dubai. Tell us your exact pickup location'],
  ['Based in Al Quoz.', 'Serving Dubai.'],
  ['Learn about Dubai Car Recovery in Al Quoz:', 'Learn about Dubai Car Recovery serving Dubai:'],
  ['Contact DubaiCarRecovery.site in Al Quoz for availability', 'Contact DubaiCarRecovery.site in Dubai for availability'],
  ['Our stated local area is Al Quoz Industrial Area, and we discuss suitable requests across Dubai.', 'We discuss suitable requests across Dubai.'],
  ['Dubai Car Recovery lists Al Quoz Industrial Area as a local area', 'Dubai Car Recovery serves requests across Dubai'],
  ['Dubai Car Recovery lists Al Quoz Industrial Area as its local area', 'Dubai Car Recovery serves requests across Dubai'],
  ['Our stated local area is Al Quoz Industrial Area, Dubai, with enquiries considered across Dubai.', 'Our service area is Dubai, with each enquiry assessed for availability.'],
  ['Its stated local area is Al Quoz Industrial Area.', 'Its stated service area is Dubai.'],
  ['Al Quoz Industrial Area is the published local area', 'Dubai is the published service area'],
  ['The site identifies Al Quoz as its local area', 'The site identifies Dubai as its service area'],
  ['Al Quoz and industrial areas', 'Dubai industrial areas'],
  ['our Al Quoz branch', 'a workshop in Dubai'],
  ['Al Quoz, Dubai | DubaiCarRecovery.site', 'Dubai | DubaiCarRecovery.site'],
  ['Al Quoz, Dubai', 'Dubai'],
  ['Dubai Marina, Al Quoz, Business Bay', 'Dubai Marina, Business Bay'],
  ['Our local area', 'Service area'],
  ['Al Quoz Industrial Area, Dubai, United Arab Emirates', 'Dubai, United Arab Emirates'],
];

let changed = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(filename); continue; }
    if (entry.name !== 'index.html') continue;
    const html = fs.readFileSync(filename, 'utf8');
    let updated = html;
    for (const [oldText, newText] of replacements) updated = updated.replaceAll(oldText, newText);
    // Remaining mentions are geographic examples in older articles. The
    // owner asked to remove this old area name throughout public content.
    updated = updated.replaceAll('Al Quoz Industrial Area', 'Dubai')
      .replaceAll('Al Quoz', 'Dubai')
      .replaceAll('Dubai, Dubai', 'Dubai')
      .replaceAll('Dubai Industrial Area', 'Dubai industrial areas');
    // Keep the service-area value Dubai-only, while displaying the license
    // premises separately and accurately as a registered address.
    updated = updated.replaceAll(
      '<p>Dubai, United Arab Emirates</p><p class="muted">24/7 assistance',
      `<p>Registered business address: ${registeredAddress}</p><p class="muted">24/7 assistance`,
    );
    if (filename === path.join('dist', 'contact', 'index.html')) {
      updated = updated.replace(
        '<h2>Service area</h2><p>Dubai, United Arab Emirates</p><p class="muted">Contact us for exact pickup coverage. A public premises address has not been supplied.</p>',
        `<h2>Service area</h2><p>Dubai, United Arab Emirates</p><p>Registered business address: ${registeredAddress}</p><p class="muted">No walk-in customer office. Contact us for exact pickup coverage.</p>`,
      );
    }
    if (updated.includes('Al Quoz')) throw new Error(`Old location remains in ${filename}`);
    if (updated === html) continue;
    fs.writeFileSync(filename, updated);
    if (fs.existsSync(`${filename}.gz`)) fs.writeFileSync(`${filename}.gz`, zlib.gzipSync(updated, { level: 9 }));
    changed++;
  }
}
walk('dist');
if (changed !== 68) throw new Error(`Expected to align 68 public pages; updated ${changed}`);
console.log(`Registered address and Dubai service-area wording aligned across ${changed} pages.`);
