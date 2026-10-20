import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {services} from '../reviews/server/core.mjs';
import {carouselBlock} from '../reviews/server/carousel-block.mjs';
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let section=fs.readFileSync('reviews/client/section.html','utf8').replace('__SERVICE_OPTIONS__',services.map(service=>`<option value="${escape(service)}">${escape(service)}</option>`).join('')).replace('__RATING_INPUTS__',[1,2,3,4,5].map(rating=>`<label><input type="radio" name="rating" value="${rating}" required aria-label="${rating} ${rating===1?'star':'stars'}" aria-describedby="human-rating-error"><span aria-hidden="true">★</span></label>`).join(''));
const css=fs.readFileSync('reviews/client/reviews.css'),js=fs.readFileSync('reviews/client/reviews.js');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
const assets=`<link rel="stylesheet" href="/customer-reviews.css?v=${hash(css)}"><script defer src="/customer-reviews.js?v=${hash(js)}"></script>`;
const baseline=fs.readFileSync('dist/index.html','utf8');
const original=baseline.match(/<section class="section reviews-section"[\s\S]*?<\/section>/)?.[0];
assert(original,'Existing animated review section must exist.');
assert(!baseline.includes('id="share-your-experience"'),'Feature already injected: run the full build first.');
const compact=original.replace(/<a class="btn whatsapp review-cta"[\s\S]*?<\/a>/,'').replace('aria-label="4.5 out of 5 rating"','aria-label="Illustrative 4.5 rating for example reviews"').replace('role="img" aria-label="Four full gold stars and one half gold star"','aria-hidden="true"').replace('Reviews supplied by the business for publication. Dates are shown exactly as provided.','Example reviews and illustrative rating supplied by the business. Customer submissions publish automatically.').replace(/(<article class="customer-review-card[^"]*"[\s\S]*?<\/blockquote>)/g,'$1<span class="example-review-label">Example review</span>');
assert(compact.includes('customer-review-stage')&&!compact.includes('review-cta'));
for(const target of ['dist/app.js','source/app.js']){
 const app=fs.readFileSync(target,'utf8');
 const pattern=/const reviewStage=document\.querySelector\('\.customer-review-stage'\);[\s\S]*?(?=\n\n\/\/ Our Services cards)/;
 assert(pattern.test(app),'Expected original carousel script');
 fs.writeFileSync(target,app.replace(pattern,carouselBlock));
}
const appVersion=hash(fs.readFileSync('dist/app.js'));
const updated=baseline.replace(original,compact+section).replace('</head>',assets+'</head>').replace(/src="\/app\.js\?v=[^"]+"/,`src="/app.js?v=${appVersion}"`);
fs.writeFileSync('dist/index.html',updated);fs.writeFileSync('dist/index.html.gz',zlib.gzipSync(updated,{level:9}));
fs.writeFileSync('dist/customer-reviews.css',css);fs.writeFileSync('dist/customer-reviews.js',js);
// Add only the new review privacy disclosure. Existing privacy content stays intact.
let privacy=fs.readFileSync('dist/privacy/index.html','utf8');
const disclosure='<section class="wrap prose" id="customer-review-privacy"><h2>Customer review privacy</h2><p>When you submit a review, we store your display name, rating, review text and submission date in our review database. A valid review is published automatically and appears publicly with those details. Please avoid including phone numbers, addresses, email addresses or other private information in your review.</p><p>All ratings and honest criticism are welcome. Automated checks limit spam and duplicate submissions. The server uses a keyed hash of your IP address for temporary rate limiting; the raw IP address is not stored in the review database. If enabled, Cloudflare Turnstile processes a security check under its privacy terms. Contact dubaicarrecoverhelp@gmail.com to request removal of your review.</p></section>';
privacy=privacy.replace('</main>',disclosure+'</main>');fs.writeFileSync('dist/privacy/index.html',privacy);fs.writeFileSync('dist/privacy/index.html.gz',zlib.gzipSync(privacy,{level:9}));
fs.writeFileSync('dist/customer-reviews.css.gz',zlib.gzipSync(css,{level:9}));fs.writeFileSync('dist/customer-reviews.js.gz',zlib.gzipSync(js,{level:9}));
fs.writeFileSync('dist/app.js.gz',zlib.gzipSync(fs.readFileSync('dist/app.js'),{level:9}));
console.log('Compact review form and existing carousel connected to published customer reviews.');
