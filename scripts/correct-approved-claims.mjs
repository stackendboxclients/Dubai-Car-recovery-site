import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';

// Approved copy corrections only; keep contact links, layout, services and SEO tags.
const neutral='Need vehicle towing or recovery in Dubai? Call with your vehicle details, pickup location and destination to confirm service availability and a quote.';
const roadsideScope='If a flat tyre or mechanical fault makes your vehicle unsafe to drive, call to arrange towing to your chosen garage. We provide vehicle transport. For on-site repairs, contact a repair provider.';
const additionalOffers=['Battery boost assistance','Tyre assistance','Commercial vehicle recovery','Vehicle passing transport assistance'];
const additionalOfferPaths=['/services/battery-assistance/','/services/tyre-assistance/','/services/truck-recovery/','/services/passing-assistance/'];

function limitHomepageOffers(html) {
 for(const offer of additionalOffers){
  html=html.replaceAll(`<span class="hero-service-chip codepen-service"><span class="hero-service-label">${offer}</span></span>`,'');
  html=html.replaceAll(`<option value="${offer}">${offer}</option>`,'');
  html=html.replace(new RegExp(`<div class="card card-[^"]+"[^>]*><button class="img" type="button" aria-label="Read about ${offer}">[^]*?</button></div>`,'g'),'');
 }
 return html.replace(/<script type="application\/ld\+json">([^<]+)<\/script>/g,(original,json)=>{
  if(!additionalOfferPaths.some(route=>json.includes(route)))return original;
  const data=JSON.parse(json);
  const removeOffers=value=>{
   if(Array.isArray(value))return value.filter(item=>!additionalOffers.includes(item?.itemOffered?.name)&&!additionalOfferPaths.some(route=>item?.itemOffered?.url?.endsWith(route))).map(removeOffers);
   if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))value[key]=removeOffers(item);
   return value;
  };
  return '<script type="application/ld+json">'+JSON.stringify(removeOffers(data)).replaceAll('<','\\u003c')+'</script>';
 });
}
const replacements=new Map([
 ['Car Recovery Dubai | 24/7 Car &amp; Bike Towing','Car Recovery Dubai | Car &amp; Bike Towing'],
 ['Car Recovery Dubai | 24/7 Car & Bike Towing','Car Recovery Dubai | Car & Bike Towing'],
 ['data-shimmer="24/7 ">24/7 ','data-shimmer="CALL 24/7 ">CALL 24/7 '],
 ['From pickup to drop-off, every vehicle is carefully loaded, securely strapped, transported with professional recovery equipment, and handled with the attention it deserves.',neutral],
 ['Your Vehicle. Handled With Care.','Discuss Your Vehicle Transport.'],
 ['SAFE VEHICLE TRANSPORT','VEHICLE TRANSPORT ENQUIRIES'],
 ['Secure Loading <span>•</span> Proper Strapping <span>•</span> Careful Handling <span>•</span> Professional Recovery','Vehicle details <span>•</span> Pickup location <span>•</span> Destination <span>•</span> Confirm availability'],
 ['<h3>Fast Response</h3><p>Quick arrival across Dubai when you need help most.</p>','<h3>Pickup Availability</h3><p>Call with your pickup point to confirm availability.</p>'],
 ['<h3>Safe &amp; Secure Towing</h3><p>Vehicles are secured with belts and safety care before transport.</p>','<h3>Vehicle Details</h3><p>Tell us your vehicle type and condition before arrangements.</p>'],
 ['<h3>Careful Vehicle Handling</h3><p>Your car is loaded, moved, and unloaded with full caution.</p>','<h3>Handling Requirements</h3><p>Discuss loading and handling requirements before collection.</p>'],
 ['<h3>Modern Recovery Trucks</h3><p>Clean, reliable flatbeds and recovery vehicles for safe transport.</p>','<h3>Transport Suitability</h3><p>Discuss your vehicle and pickup access requirements with our team.</p>'],
 ['<h3>24/7 Reliable Service</h3><p>Day or night, our team is ready to assist you.</p>','<h3>24/7 Telephone Contact</h3><p>Call our team any time to discuss availability and a quote.</p>'],
 ['<h3>Professional Support</h3><p>Smooth service, clear communication, and dependable handling.</p>','<h3>Recovery Enquiries</h3><p>Call or WhatsApp with your pickup point and destination.</p>'],
 ['*24/7 assistance is subject to availability and location. Arrival estimates are confirmed when you contact us.','Telephone enquiries are answered 24/7. Service availability and timing are confirmed for each request.'],
 ['24/7 assistance, subject to availability and location','24/7 telephone enquiries; service availability confirmed individually']
]);
let changed=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);if(entry.isDirectory()){walk(file);continue;}
 if(!entry.name.endsWith('.html'))continue;
 const original=fs.readFileSync(file,'utf8');let html=original;
 // Shared footer wording must not imply guaranteed round-the-clock dispatch.
 html=html.replaceAll('24/7 assistance, subject to availability and location','24/7 telephone enquiries; service availability confirmed individually');
 if(file===path.join('dist','index.html')){
  for(const [from,to] of replacements)html=html.replaceAll(from,to);
  html=limitHomepageOffers(html)
   .replace('Collection and transport to your chosen garage, home or destination.','Vehicle collection for drivers, garages and workshops. Call to arrange towing to your chosen destination.')
   .replace('Describe the problem so we can discuss assistance or vehicle transport.',roadsideScope);
  html=html.replace(/<div class="transport-caption"><h3>([\s\S]*?)<\/h3><p>[\s\S]*?<\/p><\/div>/g,(_,title)=>{
   const heading=title.replace('Safe &amp; Secure Vehicle Towing','Vehicle Towing').replace('Professional Vehicle Recovery','Vehicle Recovery').replace('Careful Loading &amp; Handling','Loading Requirements').replace('Secure Flatbed Transport','Flatbed Transport').replace('Secure Motorcycle Transport','Motorcycle Transport');
   return `<div class="transport-caption"><h3>${heading}</h3><p>Illustrative image. Discuss vehicle requirements and availability before booking.</p></div>`;
  });
  assert(!/4\.5 Rating|Example review|Robin Varghese|Quick arrival|Modern Recovery Trucks/.test(html),'Unapproved homepage claim remains');
  assert(html.includes(neutral));
  assert(html.includes('href="tel:+971501263137"')&&html.includes('href="https://wa.me/971501263137"'));
  assert(html.includes('id="share-your-experience"')&&html.includes('customer-review-stage'));
  assert(html.includes('Vehicle collection for drivers, garages and workshops.')&&html.includes(roadsideScope));
  assert(!additionalOffers.some(offer=>html.includes(offer)),'An offer outside the campaign scope remains on the ad destination');
 }
 if(html!==original){fs.writeFileSync(file,html);fs.writeFileSync(file+'.gz',zlib.gzipSync(html,{level:9}));changed++;}
}}
walk('dist');
console.log(`Approved review and service-claim corrections applied; ${changed} pages retain their existing structure.`);
