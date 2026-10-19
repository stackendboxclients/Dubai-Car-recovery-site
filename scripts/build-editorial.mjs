import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {posts} from '../editorial/posts.mjs';

const domain='https://www.dubaicarrecovery.site';
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const serviceNames={
  'car-towing':'car towing','flatbed-towing':'flatbed towing','luxury-car-transport':'luxury and sports car transport',
  'emergency-recovery':'breakdown recovery','accident-recovery':'accident recovery','roadside-assistance':'roadside assistance',
  'battery-assistance':'battery boost assistance','tyre-assistance':'tyre assistance','fuel-delivery':'emergency fuel assistance',
  'desert-recovery':'desert and off-road recovery','motorcycle-towing':'motorcycle transport',
  'truck-recovery':'commercial vehicle recovery','passing-assistance':'vehicle passing transport assistance'
};
const imageAlt={
  'recovery-03.webp':'Illustrative orange sports car on a recovery truck at night in Dubai',
  'blog-flatbed-towing.webp':'Illustrative car being loaded onto a flatbed truck at night in Dubai',
  'package-luxury-flatbed-transport-dubai.webp':'Illustrative sports car on a flatbed truck near a Dubai property',
  'dubai-breakdown-recovery.webp':'Illustrative car on a recovery truck near the Dubai skyline',
  'blog-accident-recovery.webp':'Illustrative damaged car beside a recovery truck in Dubai',
  'dubai-roadside-assistance.webp':'Illustrative roadside assistance beside a stopped car in Dubai',
  'dubai-battery-assistance.webp':'Illustrative technician looking at a car battery in Dubai',
  'dubai-tyre-assistance.webp':'Illustrative technician assisting with a car tyre in Dubai',
  'dubai-emergency-fuel-help.webp':'Illustrative technician discussing a fuel problem beside a car in Dubai',
  'package-dubai-desert-sand-recovery.webp':'Illustrative off-road vehicle and recovery truck in Dubai desert sand',
  'package-motorcycle-transport-dubai.webp':'Illustrative motorcycle secured on a flatbed truck in Dubai',
  'dubai-commercial-vehicle-transport.webp':'Illustrative white commercial van on a recovery truck in Dubai',
  'dubai-vehicle-passing-transport.webp':'Illustrative red car on a recovery truck beside a vehicle inspection centre',
  'dubai-basement-pickup-assessment.webp':'Illustrative parked car and person in an underground garage',
  'dubai-night-recovery-enquiry.webp':'Illustrative driver beside a stopped car at night in Dubai',
  'blog-external-transport.webp':'Illustrative car on a recovery truck outside a workshop',
  'recovery-07.webp':'Illustrative yellow sports car on a flatbed truck in Dubai',
  'recovery-16.webp':'Illustrative motorcycle on a recovery truck in Dubai',
  'blog-breakdown-checklist.webp':'Illustrative car and recovery truck in Dubai at dusk',
  'recovery-02.webp':'Illustrative car on a recovery truck in Dubai at night',
  'dubai-accident-vehicle-transport.webp':'Illustrative damaged car on a recovery truck at night',
  'recovery-12.webp':'Illustrative off-road recovery truck helping a vehicle in sand',
  'blog-commercial-recovery.webp':'Illustrative commercial vans and recovery truck in Dubai',
  'blog-guide-transport.webp':'Illustrative car on a recovery truck at a receiving property',
  'blog-guide-recovery.webp':'Illustrative recovery truck transporting a car in Dubai'
};
const write=(filename,contents)=>{fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,contents);fs.writeFileSync(filename+'.gz',zlib.gzipSync(contents,{level:9}));};
const template=fs.readFileSync('dist/blogs/dubai-breakdown-recovery-checklist/index.html','utf8');
const bodyStart=template.slice(template.indexOf('</head>')+7,template.indexOf('<main id="main">'));
const bodyEnd=template.slice(template.lastIndexOf('</main>')+7);
const assets=template.slice(template.indexOf('<link rel="icon"'),template.indexOf('</head>'));
const templateGraph=JSON.parse(template.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1]||'{}')['@graph'];
assert(templateGraph,'Existing article schema missing');
const baseGraph=templateGraph.filter(item=>['LocalBusiness','WebSite'].includes(item['@type']));
assert.equal(baseGraph.length,2);
const seenSlugs=new Set(),seenImages=new Set(),seenTitles=new Set(),seenSummaries=new Set();
assert.equal(posts.length,25,'Editorial release must contain exactly 25 distinct company posts');

for(const post of posts){
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug));
  assert(!seenSlugs.has(post.slug)&&!seenImages.has(post.image)&&!seenTitles.has(post.title)&&!seenSummaries.has(post.summary));
  seenSlugs.add(post.slug);seenImages.add(post.image);seenTitles.add(post.title);seenSummaries.add(post.summary);
  assert(imageAlt[post.image]&&serviceNames[post.service]);
  assert(post.sections.length>=3&&post.faqs.length>=3);
  assert(fs.existsSync(`dist/media/recovery/${post.image}`),`Missing image: ${post.image}`);
  const pageDir=`dist/blogs/${post.slug}`;assert(!fs.existsSync(pageDir),`Existing route would be overwritten: ${post.slug}`);
  const url=`${domain}/blogs/${post.slug}/`,image=`${domain}/media/recovery/${post.image}`;
  const title=`${post.title} | DubaiCarRecovery.site`;
  const wordCount=(post.intro+' '+post.sections.flat().join(' ')+post.faqs.flat().join(' ')).replace(/<[^>]+>/g,' ').trim().split(/\s+/).length;
  const graph=[...baseGraph,
    {'@type':'WebPage','@id':url+'#webpage',url,name:post.title,description:post.summary,isPartOf:{'@id':domain+'/#website'},about:{'@id':domain+'/#business'},inLanguage:'en'},
    {'@type':'BreadcrumbList','@id':url+'#breadcrumbs',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:domain+'/'},{'@type':'ListItem',position:2,name:'Blogs',item:domain+'/blogs/'},{'@type':'ListItem',position:3,name:post.title,item:url}]},
    {'@type':'BlogPosting','@id':url+'#article',headline:post.title,description:post.summary,datePublished:'2026-10-19',dateModified:'2026-10-19',author:{'@id':domain+'/#business'},publisher:{'@id':domain+'/#business'},image,mainEntityOfPage:{'@id':url+'#webpage'},wordCount,inLanguage:'en'}
  ];
  const jsonLd=JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c');
  const head=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#151e2e"><meta name="color-scheme" content="dark only"><meta name="description" content="${esc(post.summary)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:site_name" content="DubaiCarRecovery.site"><meta property="og:title" content="${esc(post.title)}"><meta property="og:description" content="${esc(post.summary)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="og:image:alt" content="${esc(imageAlt[post.image])}"><meta property="article:published_time" content="2026-10-19"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(post.title)}"><meta name="twitter:description" content="${esc(post.summary)}"><meta name="twitter:image" content="${image}"><script type="application/ld+json">${jsonLd}</script><title>${esc(title)}</title>${assets}</head>`;
  const [width,height]=post.image.startsWith('package-')?[768,512]:post.image.startsWith('dubai-')?[1536,1024]:[1672,941];
  const content=`<main id="main"><section class="page-intro wrap"><p class="eyebrow red">${esc(post.category)}</p><h1>${esc(post.title)}</h1><p class="intro-copy">${esc(post.summary)}</p></section><div class="wrap blog-layout"><p class="blog-meta">Published 19 October 2026 · By Dubai Car Recovery</p><figure class="blog-cover"><img src="/media/recovery/${esc(post.image)}" width="${width}" height="${height}" alt="${esc(imageAlt[post.image])}" decoding="async" fetchpriority="high"><figcaption>Illustrative scene; it does not depict a documented customer job or actual fleet vehicle.</figcaption></figure><article class="blog-article" aria-label="${esc(post.title)}"><p>${post.intro}</p>${post.sections.map(([heading,paragraph])=>`<section><h2>${esc(heading)}</h2><p>${paragraph}</p></section>`).join('')}<section><h2>Questions customers ask</h2>${post.faqs.map(([question,answer])=>`<h3>${esc(question)}</h3><p>${answer}</p>`).join('')}</section><section><h2>Talk with Dubai Car Recovery</h2><p>Tell us about your vehicle, pickup and intended destination so we can discuss a suitable arrangement. Call <a href="tel:+971501263137">+971 50 126 3137</a>, email <a href="mailto:dubaicarrecoverhelp@gmail.com">dubaicarrecoverhelp@gmail.com</a> or <a href="/book/">prepare an enquiry</a>. Availability, location, equipment, timing and the quote are confirmed for the actual request.</p></section></article><aside class="blog-callout"><h2>Explore the service</h2><p>See our <a href="/services/${post.service}/">${serviceNames[post.service]} service</a>, browse <a href="/services/">all services</a>, or read more <a href="/blogs/">Dubai Car Recovery articles</a>. You can also return to the <a href="/">homepage</a>.</p></aside></div></main>`;
  write(`${pageDir}/index.html`,head+bodyStart+content+bodyEnd);
}

let index=fs.readFileSync('dist/blogs/index.html','utf8');
assert(!index.includes('id="company-service-stories"'),'Editorial section already added');
index=index.replace('<h1>Practical guides for your next pickup.</h1>','<h1>Dubai Car Recovery services, in our own words.</h1>')
  .replace('Service guides, provider comparisons, booking questions, and clear advice for arranging vehicle transport.','Read how we approach towing, roadside assistance and vehicle transport in Dubai. Explore our company articles and detailed service guides.');
const cards=posts.map(post=>`<a class="blog-card" href="/blogs/${post.slug}/"><img src="/media/recovery/${esc(post.image)}" alt="${esc(imageAlt[post.image])}" loading="lazy" decoding="async"><div><p class="eyebrow red">${esc(post.category)}</p><h3>${esc(post.title)}</h3><p>${esc(post.summary)}</p><span>Read our perspective →</span></div></a>`).join('');
const newSection=`<section class="blog-category" id="company-service-stories" aria-labelledby="company-stories-heading"><h2 id="company-stories-heading">Our services and the way we work</h2><p>Our team’s perspective on careful vehicle recovery, clear enquiries and practical handovers in Dubai. These company articles describe our services; customer feedback appears separately on our homepage.</p><div class="blog-grid">${cards}</div></section>`;
const insert=index.indexOf('<section class="blog-category"',index.indexOf('<div class="wrap blog-index">'));
assert(insert>0,'Blog hub structure changed');
index=index.slice(0,insert)+newSection+index.slice(insert);write('dist/blogs/index.html',index);
let sitemap=fs.readFileSync('dist/sitemap.xml','utf8');assert(sitemap.endsWith('</urlset>'));
sitemap=sitemap.replace('</urlset>',posts.map(post=>`<url><loc>${domain}/blogs/${post.slug}/</loc></url>`).join('')+'</urlset>');fs.writeFileSync('dist/sitemap.xml',sitemap);
console.log(`Published ${posts.length} company blog posts with ${seenImages.size} unique illustrative images.`);
