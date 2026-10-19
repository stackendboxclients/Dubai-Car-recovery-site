(() => {
 'use strict';
 const section=document.getElementById('share-your-experience');
 if(!section)return;
 const form=section.querySelector('form'),submit=form.querySelector('[type=submit]'),status=document.getElementById('human-review-status'),list=document.getElementById('human-review-list'),more=document.getElementById('human-load-more'),loadStatus=document.getElementById('human-load-status');
 const stars=[...form.querySelectorAll('[name=rating]')];
 let settings=null,widget=null,nextCursor=null,requestId=crypto.randomUUID(),previousPayload='',loading=false;
 const message=(text,kind='')=>{status.textContent=text;status.dataset.kind=kind;};
 const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
 async function api(url,options={}) {
  const response=await fetch(url,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},signal:AbortSignal.timeout(15000)});
  let data;
  try{data=await response.json();}catch{throw new Error('We could not connect to the review service. Please try again.');}
  if(!response.ok){const error=new Error(data.error||'Unable to complete your request. Please try again.');error.fields=data.errors;throw error;}
  return data;
 }
 function fieldErrors(errors={}) {
  let first=null;
  for(const key of ['name','rating','text','service','email']) {
   document.getElementById('human-'+key+'-error').textContent=errors[key]||'';
   const inputs=key==='rating'?stars:[form.elements[key]];
   for(const input of inputs) {input.setAttribute('aria-invalid',String(Boolean(errors[key])));if(errors[key]&&!first)first=input;}
  }
  first?.focus();
 }
 function validate(data) {
  const errors={};
  if(data.name.trim().length<2||data.name.trim().length>80)errors.name='Enter a name between 2 and 80 characters.';
  if(!data.rating)errors.rating='Choose a rating from 1 to 5 stars.';
  if(data.text.trim().length<10||data.text.trim().length>3000)errors.text='Write between 10 and 3,000 characters.';
  if(data.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))errors.email='Enter a valid email address or leave it blank.';
  return errors;
 }
 function updateStars() {
  const rating=Number(form.elements.rating.value);
  stars.forEach(input=>input.closest('label').classList.toggle('is-selected',Number(input.value)<=rating));
  document.getElementById('human-rating-value').textContent=rating?`${rating} out of 5 stars`:'Choose 1–5 stars';
 }
 stars.forEach(input=>input.addEventListener('change',updateStars));
 function loadTurnstile() {
  if(window.turnstile)return Promise.resolve();
  return new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('The security check could not load. Please check your connection and try again.'));};document.head.append(script);
  });
 }
 async function configure() {
  settings=await api('/api/review-config');
  if(settings.siteKey&&widget===null) {
   await loadTurnstile();
   widget=window.turnstile.render('#human-security-check',{sitekey:settings.siteKey,action:'customer_review',theme:'dark',size:'flexible','error-callback':()=>message('The security check could not load. Please retry.','error'),'expired-callback':()=>message('The security check expired. Please complete it again.','error')});
  }
  submit.disabled=false;
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(submit.disabled||!settings)return;
  const data=Object.fromEntries(new FormData(form));data.rating=Number(data.rating||0);
  const errors=validate(data);fieldErrors(errors);
  if(Object.keys(errors).length){message('Please check the highlighted fields.','error');return;}
  const payload=JSON.stringify([data.name,data.rating,data.text,data.service,data.email]);
  if(previousPayload&&previousPayload!==payload)requestId=crypto.randomUUID();previousPayload=payload;
  submit.disabled=true;submit.textContent='Submitting…';form.setAttribute('aria-busy','true');message('Saving your review…');
  try {
   const result=await api('/api/reviews',{method:'POST',body:JSON.stringify({...data,requestId,challenge:settings.challenge,turnstileToken:widget!==null?window.turnstile.getResponse(widget):''})});
   if(result.saved!==true)throw new Error('We could not confirm that your review was saved. Please retry.');
   form.reset();updateStars();requestId=crypto.randomUUID();previousPayload='';
   message('Thank you for sharing your experience! Your review has been submitted and will appear after approval.','success');
  }catch(error){fieldErrors(error.fields);message(error.message||'Your review could not be saved. Please try again.','error');}
  finally {
   if(widget!==null)window.turnstile.reset(widget);
   submit.textContent='Submit Review ↗';form.removeAttribute('aria-busy');
   // Refresh expired/IP-bound form tokens without discarding customer input.
   try{await configure();}catch{settings=null;message('The review service is unavailable. Your text is still here. Please use Retry Connection.','error');showRetry();}
  }
 });
 function showRetry() {
  if(form.querySelector('.human-retry'))return;
  const retry=el('button','btn human-retry','Retry Connection');retry.type='button';
  retry.addEventListener('click',async()=>{retry.disabled=true;try{await configure();message('All ratings are welcome. Required fields are marked *.');retry.remove();}catch(error){message(error.message,'error');retry.disabled=false;}});
  form.querySelector('.human-review-actions').append(retry);
 }
 function renderReview(review) {
  const card=el('article','human-customer-card'),top=el('div','human-card-top'),initial=el('span','human-customer-initial',Array.from(review.customer_name)[0]?.toUpperCase()||'');initial.setAttribute('aria-hidden','true');
  const person=el('div');person.append(el('h3','',review.customer_name));const time=el('time','',new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dubai'}).format(new Date(review.created_at)));time.dateTime=review.created_at;person.append(time);top.append(initial,person);
  const rating=el('p','human-card-stars','★'.repeat(review.rating)+'☆'.repeat(5-review.rating));rating.setAttribute('aria-label',`${review.rating} out of 5 stars`);
  card.append(top,rating,el('blockquote','',review.review_text));if(review.service)card.append(el('span','human-service-tag',review.service));return card;
 }
 async function loadReviews(append=false) {
  if(loading)return;loading=true;more.disabled=true;list.setAttribute('aria-busy','true');loadStatus.textContent='';
  try {
   const data=await api('/api/reviews'+(append&&nextCursor?'?cursor='+encodeURIComponent(nextCursor):''));
   if(!Array.isArray(data.reviews))throw new Error('Reviews could not be loaded. Please try again.');
   if(!append)list.replaceChildren();
   for(const review of data.reviews)list.append(renderReview(review));
   if(!list.childElementCount){const empty=el('div','human-review-empty');empty.append(el('strong','',data.nextCursor?'More feedback may be on the next page.':'Be the first to share your experience.'),el('p','',data.nextCursor?'No published reviews on this page. Select Load More Reviews to continue.':'No approved customer reviews yet. Your feedback could help the next customer.'));list.append(empty);}
   nextCursor=data.nextCursor;more.hidden=!nextCursor;more.textContent='Load More Reviews';more.dataset.retry='';
   if(append)loadStatus.textContent=`${data.reviews.length} more reviews loaded.`;
  }catch(error){loadStatus.textContent=error.message;if(!append){list.replaceChildren(el('p','human-review-empty','Customer reviews could not be loaded right now. Please try again.'));}more.hidden=false;more.textContent='Retry Loading Reviews';more.dataset.retry=append?'append':'initial';}
  finally{loading=false;more.disabled=false;list.setAttribute('aria-busy','false');}
 }
 more.addEventListener('click',()=>loadReviews(more.dataset.retry!=='initial'));
 async function start() {
  loadReviews();
  try{await configure();message('All ratings are welcome. Required fields are marked *.');}
  catch(error){message(error.message,'error');showRetry();}
 }
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();start();}},{rootMargin:'500px'});observer.observe(section);}else start();
})();
