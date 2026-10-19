(() => {
 'use strict';
 const section=document.getElementById('share-your-experience'),stage=document.querySelector('.customer-review-stage');
 if(!section||!stage)return;
 const form=section.querySelector('form'),submit=form.querySelector('[type=submit]'),status=document.getElementById('human-review-status'),stars=[...form.querySelectorAll('[name=rating]')];
 const description=document.querySelector('.reviews-heading>p:last-child');
 let settings=null,widget=null,nextCursor=null,requestId=crypto.randomUUID(),previousPayload='',loading=false,hasRealReviews=false;
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
  try {
   const result=await api('/api/reviews',{method:'POST',body:JSON.stringify({...data,requestId,challenge:settings.challenge,turnstileToken:widget!==null?window.turnstile.getResponse(widget):''})});
   if(result.saved!==true)throw new Error('We could not confirm that your review was saved. Please retry.');
   form.reset();updateStars();requestId=crypto.randomUUID();previousPayload='';message('Thank you for sharing your experience! Your review has been submitted and will appear after approval.','success');
  }catch(error){fieldErrors(error.fields);message(error.message||'Your review could not be saved. Please try again.','error');}
  finally {
   if(widget!==null)window.turnstile.reset(widget);submit.textContent='Submit Review ↗';form.removeAttribute('aria-busy');
   try{await configure();}catch{settings=null;message('The review service is unavailable. Your text is still here. Please use Retry Connection.','error');showRetry();}
  }
 });
 function showRetry(){if(form.querySelector('.human-retry'))return;const retry=el('button','btn human-retry','Retry Connection');retry.type='button';retry.addEventListener('click',async()=>{retry.disabled=true;try{await configure();message('');retry.remove();}catch(error){message(error.message,'error');retry.disabled=false;}});form.querySelector('.human-review-actions').append(retry);}
 const dialog=el('dialog','human-review-dialog');
 const dialogTitle=el('h2','','Customer review'),dialogText=el('p'),close=el('button','','Close review');close.type='button';dialogTitle.id='human-full-review-title';dialog.setAttribute('aria-labelledby',dialogTitle.id);close.addEventListener('click',()=>dialog.close());dialog.append(dialogTitle,dialogText,close);document.body.append(dialog);
 function renderReview(review) {
  const card=el('article','customer-review-card real-customer-review'),person=el('div','review-person'),initial=el('span','review-avatar real-review-initial',Array.from(review.customer_name)[0]?.toUpperCase()||'');initial.setAttribute('aria-hidden','true');
  const identity=el('div');identity.append(el('h3','',review.customer_name),el('p','','Customer review · '+new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dubai'}).format(new Date(review.created_at))));person.append(initial,identity);
  const rating=el('div','review-stars','★'.repeat(review.rating)+'☆'.repeat(5-review.rating));rating.setAttribute('aria-label',`${review.rating} out of 5 stars`);
  const long=review.review_text.length>230;card.append(person,rating,el('blockquote','',long?review.review_text.slice(0,230)+'…':review.review_text));
  if(long){const read=el('button','real-review-read','Read full review');read.type='button';read.addEventListener('click',()=>{dialogTitle.textContent=review.customer_name+' · '+review.rating+'/5 stars';dialogText.textContent=review.review_text;dialog.showModal();});card.append(read);}
  return card;
 }
 async function loadReviews() {
  if(loading)return;loading=true;
  try {
   const data=await api('/api/reviews'+(nextCursor?'?cursor='+encodeURIComponent(nextCursor):''));if(!Array.isArray(data.reviews))throw new Error('Reviews could not be loaded.');
   if(data.reviews.length) {
    if(!hasRealReviews){hasRealReviews=true;description.textContent='Business-supplied examples and approved customer submissions. The animated 4.5 rating is illustrative.';}
    stage.append(...data.reviews.map(renderReview));
    document.dispatchEvent(new CustomEvent('customer-reviews-updated'));
   }
   nextCursor=data.nextCursor;
   // Removed reviews can leave an empty marker page. Continue until a real
   // review is found, without ever exposing pending or removed content.
   if(!hasRealReviews&&nextCursor){loading=false;return loadReviews();}
  }catch{description.textContent=hasRealReviews?'Business-supplied examples and approved submissions. The 4.5 rating is illustrative. More feedback could not be loaded right now.':'Example reviews and illustrative rating supplied by the business. Customer submissions are temporarily unavailable.';}
  finally{loading=false;}
 }
 document.addEventListener('customer-reviews-advance',event=>{if(nextCursor&&event.detail.index>=event.detail.total-2)loadReviews();});
 async function start(){loadReviews();try{await configure();message('');}catch(error){message(error.message,'error');showRetry();}}
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();start();}},{rootMargin:'500px'});observer.observe(document.querySelector('#customer-reviews'));}else start();
})();
