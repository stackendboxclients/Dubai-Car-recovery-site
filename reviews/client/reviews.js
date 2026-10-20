(() => {
 'use strict';
 const section=document.getElementById('share-your-experience'),stage=document.querySelector('.customer-review-stage');
 if(!section||!stage)return;
 const form=section.querySelector('form'),submit=form.querySelector('[type=submit]'),status=document.getElementById('human-review-status'),stars=[...form.querySelectorAll('[name=rating]')];
 const description=document.querySelector('.reviews-heading>p:last-child');
 let settings=null,widget=null,nextCursor=null,requestId=crypto.randomUUID(),previousPayload='',loading=false,hasRealReviews=false;
 const loadedIds=new Set();
 const message=(text,kind='')=>{status.textContent=text;status.dataset.kind=kind;};
 const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
 async function api(url,options={}) {
  const response=await fetch(url,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},signal:AbortSignal.timeout(30000)});
  let data;try{data=await response.json();}catch{throw new Error('We could not connect to the review service. Please try again.');}
  if(!response.ok){const error=new Error(data.error||'Unable to complete your request. Please try again.');error.fields=data.errors;throw error;}return data;
 }
 function fieldErrors(errors={}) {
  let first=null;
  for(const key of ['name','rating','text']) {
   document.getElementById('human-'+key+'-error').textContent=errors[key]||'';
   for(const input of key==='rating'?stars:[form.elements[key]]){input.setAttribute('aria-invalid',String(Boolean(errors[key])));if(errors[key]&&!first)first=input;}
  }
  first?.focus();
 }
 function validate(data) {
  const errors={};if(data.name.trim().length<2||data.name.trim().length>80)errors.name='Enter a name between 2 and 80 characters.';
  if(!data.rating)errors.rating='Choose a rating from 1 to 5 stars.';
  if(data.text.trim().length<10||data.text.trim().length>3000)errors.text='Write between 10 and 3,000 characters.';
  return errors;
 }
 function updateStars(){const rating=Number(form.elements.rating.value);stars.forEach(input=>input.closest('label').classList.toggle('is-selected',Number(input.value)<=rating));document.getElementById('human-rating-value').textContent=rating?`${rating} out of 5 stars`:'Choose 1–5 stars';}
 stars.forEach(input=>input.addEventListener('change',updateStars));
 async function configure() {
  settings=await api('/api/review-config');
  if(settings.siteKey&&widget===null) {
   if(!window.turnstile)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('The security check could not load. Please retry.'));};document.head.append(script);});
   widget=window.turnstile.render('#human-security-check',{sitekey:settings.siteKey,action:'customer_review',theme:'dark',size:'flexible'});
  }
  submit.disabled=false;
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(submit.disabled||!settings)return;
  const data=Object.fromEntries(new FormData(form));data.rating=Number(data.rating||0);const errors=validate(data);fieldErrors(errors);
  if(Object.keys(errors).length){message('Please check the highlighted fields.','error');return;}
  const payload=JSON.stringify([data.name,data.rating,data.text]);if(previousPayload&&previousPayload!==payload)requestId=crypto.randomUUID();previousPayload=payload;
  submit.disabled=true;submit.textContent='Submitting…';form.setAttribute('aria-busy','true');message('Saving your review…');
  let posted=false;
  try {
   const result=await api('/api/reviews',{method:'POST',body:JSON.stringify({...data,requestId,challenge:settings.challenge,turnstileToken:widget!==null?window.turnstile.getResponse(widget):''})});
   if(result.saved!==true)throw new Error('We could not confirm that your review was saved. Please retry.');
   if(!result.review?.id)throw new Error('We could not confirm that your review was saved. Please retry.');
   addReviews([result.review],true);updateStats(result.stats);form.reset();updateStars();requestId=crypto.randomUUID();previousPayload='';posted=true;message('Thank you for sharing your experience! Your review is now published.','success');
  }catch(error){fieldErrors(error.fields);message(error.message||'Your review could not be saved. Please try again.','error');}
  finally {
   if(widget!==null)window.turnstile.reset(widget);submit.textContent='Submit Review ↗';form.removeAttribute('aria-busy');
   try{await configure();}catch{settings=null;if(!posted)message('The review service is unavailable. Your text is still here. Please use Retry Connection.','error');showRetry();}
  }
 });
 function showRetry(){if(form.querySelector('.human-retry'))return;const retry=el('button','btn human-retry','Retry Connection');retry.type='button';retry.addEventListener('click',async()=>{retry.disabled=true;try{await configure();message('');retry.remove();}catch(error){message(error.message,'error');retry.disabled=false;}});form.querySelector('.human-review-actions').append(retry);}
 function updateStats(stats) {
  if(!stats||!Number.isFinite(Number(stats.count)))return;
  const rating=document.querySelector('#customer-reviews .feedback-rating'),label=rating?.querySelector('.feedback-rating-label'),gold=rating?.querySelector('.rating-gold-fill');
  if(!rating||!label||!gold)return;
  if(stats.count>0){
   const average=Math.max(0,Math.min(5,Number(stats.average)||0));
   rating.dataset.hasRealReviews='true';rating.setAttribute('aria-label',`${average.toFixed(1)} out of 5 average from ${stats.count} customer reviews`);
   gold.setAttribute('width',String(Math.round(average*90)));
   label.textContent=`${average.toFixed(1)} Rating · ${stats.count} ${stats.count===1?'customer review':'customer reviews'}`;
   description.textContent='Example cards are labelled. The rating uses genuine customer submissions only.';
  }else{
   rating.dataset.hasRealReviews='false';
   description.textContent='Example reviews and illustrative rating supplied by the business. Be the first to share your experience.';
  }
 }
 function renderReview(review) {
  const card=el('article','customer-review-card real-customer-review'),person=el('div','review-person'),initial=el('span','review-avatar real-review-initial',Array.from(review.customer_name)[0]?.toUpperCase()||'');initial.setAttribute('aria-hidden','true');card.dataset.reviewId=review.id;
  const identity=el('div');identity.append(el('h3','',review.customer_name),el('p','','Customer review · '+new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dubai'}).format(new Date(review.created_at))));person.append(initial,identity);
  const rating=el('div','review-stars','★'.repeat(review.rating)+'☆'.repeat(5-review.rating));rating.setAttribute('aria-label',`${review.rating} out of 5 stars`);
  card.append(person,rating,el('blockquote','',review.review_text));return card;
 }
 function addReviews(reviews,focus=false) {
  const fresh=reviews.filter(review=>review?.id&&!loadedIds.has(review.id));
  if(!fresh.length)return;
  fresh.forEach(review=>loadedIds.add(review.id));
  if(focus){for(const review of [...fresh].reverse())stage.insertBefore(renderReview(review),stage.firstChild);}
  else{const firstExample=stage.querySelector('.customer-review-card:not(.real-customer-review)');for(const review of fresh)stage.insertBefore(renderReview(review),firstExample);}
  hasRealReviews=true;
  document.dispatchEvent(new CustomEvent('customer-reviews-updated',{detail:focus?{showId:fresh[0].id}:{}}));
 }
 async function loadReviews() {
  if(loading)return;loading=true;
  try {
   const data=await api('/api/reviews'+(nextCursor?'?cursor='+encodeURIComponent(nextCursor):''));
   if(!Array.isArray(data.reviews))throw new Error('Reviews could not be loaded.');
   addReviews(data.reviews);updateStats(data.stats);nextCursor=data.nextCursor;
  }catch{description.textContent='Customer reviews could not be loaded right now. Please try again later.';}
  finally{loading=false;}
 }
 document.addEventListener('customer-reviews-advance',event=>{if(nextCursor&&event.detail.index>=event.detail.total-2)loadReviews();});
 async function start(){loadReviews();try{await configure();message('');}catch(error){message(error.message,'error');showRetry();}}
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();start();}},{rootMargin:'500px'});observer.observe(document.querySelector('#customer-reviews'));}else start();
})();
