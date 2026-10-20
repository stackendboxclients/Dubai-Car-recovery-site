// Same legacy timing, visibility pause and CSS classes; only the review data
// collection can now be refreshed after published customer submissions load.
export const carouselBlock=`const reviewStage=document.querySelector('.customer-review-stage');
if(reviewStage){
 let reviewCards=[...reviewStage.querySelectorAll('.customer-review-card')];
 let reviewDots=[...document.querySelectorAll('.review-dots span')];
 let reviewStart=0,reviewTimer=0;
 const showReviewSet=()=>{for(const [index,card] of reviewCards.entries())card.classList.toggle('is-review-visible',index===reviewStart);for(const [index,dot] of reviewDots.entries())dot.classList.toggle('is-active',index===reviewStart%reviewDots.length);};
 const nextReviewSet=()=>{if(document.hidden||reviewStage.closest('.motion-dormant')||document.querySelector('.human-review-dialog[open]'))return;reviewStart=(reviewStart+1)%reviewCards.length;showReviewSet();document.dispatchEvent(new CustomEvent('customer-reviews-advance',{detail:{index:reviewStart,total:reviewCards.length}}));};
 let touchX=null;
 reviewStage.addEventListener('touchstart',event=>{touchX=event.changedTouches[0]?.screenX??null;},{passive:true});
 reviewStage.addEventListener('touchend',event=>{if(touchX===null)return;const delta=(event.changedTouches[0]?.screenX??touchX)-touchX;touchX=null;if(Math.abs(delta)<45)return;reviewStart=(reviewStart+(delta<0?1:-1)+reviewCards.length)%reviewCards.length;showReviewSet();document.dispatchEvent(new CustomEvent('customer-reviews-advance',{detail:{index:reviewStart,total:reviewCards.length}}));},{passive:true});
 document.addEventListener('customer-reviews-updated',event=>{const visible=reviewCards[reviewStart];reviewCards=[...reviewStage.querySelectorAll('.customer-review-card')];reviewStart=event.detail?.showId?Math.max(0,reviewCards.findIndex(card=>card.dataset.reviewId===event.detail.showId)):Math.max(0,reviewCards.indexOf(visible));const dots=document.querySelector('.review-dots');dots.replaceChildren(...Array.from({length:Math.min(6,reviewCards.length)},()=>document.createElement('span')));reviewDots=[...dots.querySelectorAll('span')];showReviewSet();});
 showReviewSet();
 if(!matchMedia('(prefers-reduced-motion:reduce)').matches)reviewTimer=setInterval(nextReviewSet,2000);
}`;
