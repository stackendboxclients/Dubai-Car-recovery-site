// Keep the legacy two-second automatic rotation and card classes. Controls
// operate on the same card collection, including cards fetched after load.
export const carouselBlock=`const reviewStage=document.querySelector('.customer-review-stage');
if(reviewStage){
 let reviewCards=[...reviewStage.querySelectorAll('.customer-review-card')];
 let reviewStart=0,reviewTimer=0,pauseUntil=0,dotWindow=-1,dotCount=-1;
 const controls=document.querySelector('#customer-reviews .review-dots');
 const previous=document.createElement('button'),next=document.createElement('button'),track=document.createElement('div');
 previous.type=next.type='button';previous.className=next.className='review-nav-arrow';
 previous.textContent='‹';next.textContent='›';
 previous.setAttribute('aria-label','Previous review');next.setAttribute('aria-label','Next review');
 track.className='review-dot-track';controls.replaceChildren(previous,track,next);
 const announce=()=>document.dispatchEvent(new CustomEvent('customer-reviews-advance',{detail:{index:reviewStart,total:reviewCards.length}}));
 const showReviewSet=()=>{
  for(const [index,card] of reviewCards.entries())card.classList.toggle('is-review-visible',index===reviewStart);
  const count=Math.min(6,reviewCards.length),windowStart=Math.min(Math.max(0,reviewStart-2),Math.max(0,reviewCards.length-count));
  if(windowStart!==dotWindow||count!==dotCount){
   dotWindow=windowStart;dotCount=count;
   track.replaceChildren(...Array.from({length:count},(_,offset)=>{const dot=document.createElement('button');dot.type='button';dot.className='review-dot';dot.setAttribute('aria-label','Show review '+(windowStart+offset+1)+' of '+reviewCards.length);dot.addEventListener('click',()=>goToReview(windowStart+offset));return dot;}));
  }
  for(const [offset,dot] of [...track.children].entries()){
   const active=windowStart+offset===reviewStart;dot.classList.toggle('is-active',active);
   if(active)dot.setAttribute('aria-current','true');else dot.removeAttribute('aria-current');
  }
  previous.disabled=next.disabled=reviewCards.length<2;
 };
 const goToReview=index=>{if(!reviewCards.length)return;reviewStart=(index+reviewCards.length)%reviewCards.length;pauseUntil=Date.now()+8000;showReviewSet();announce();};
 previous.addEventListener('click',()=>goToReview(reviewStart-1));
 next.addEventListener('click',()=>goToReview(reviewStart+1));
 const nextReviewSet=()=>{if(!reviewCards.length||document.hidden||Date.now()<pauseUntil||reviewStage.closest('.motion-dormant')||document.querySelector('.human-review-dialog[open]'))return;reviewStart=(reviewStart+1)%reviewCards.length;showReviewSet();announce();};
 let touchX=null;
 reviewStage.addEventListener('touchstart',event=>{touchX=event.changedTouches[0]?.screenX??null;},{passive:true});
 reviewStage.addEventListener('touchend',event=>{if(touchX===null)return;const delta=(event.changedTouches[0]?.screenX??touchX)-touchX;touchX=null;if(Math.abs(delta)<45)return;goToReview(reviewStart+(delta<0?1:-1));},{passive:true});
 document.addEventListener('customer-reviews-updated',event=>{const visible=reviewCards[reviewStart];reviewCards=[...reviewStage.querySelectorAll('.customer-review-card')];reviewStart=event.detail?.showId?Math.max(0,reviewCards.findIndex(card=>card.dataset.reviewId===event.detail.showId)):Math.max(0,reviewCards.indexOf(visible));dotWindow=-1;dotCount=-1;showReviewSet();});
 showReviewSet();
 if(!matchMedia('(prefers-reduced-motion:reduce)').matches)reviewTimer=setInterval(nextReviewSet,2000);
}`;
