// Same legacy timing, visibility pause and CSS classes; only the review data
// collection can now be refreshed after approved customer submissions load.
export const carouselBlock=`const reviewStage=document.querySelector('.customer-review-stage');
if(reviewStage){
 let reviewCards=[...reviewStage.querySelectorAll('.customer-review-card')];
 let reviewDots=[...document.querySelectorAll('.review-dots span')];
 let reviewStart=0,reviewTimer=0;
 const showReviewSet=()=>{for(const [index,card] of reviewCards.entries())card.classList.toggle('is-review-visible',index===reviewStart);for(const [index,dot] of reviewDots.entries())dot.classList.toggle('is-active',index===reviewStart%reviewDots.length);};
 const nextReviewSet=()=>{if(document.hidden||reviewStage.closest('.motion-dormant')||document.querySelector('.human-review-dialog[open]'))return;reviewStart=(reviewStart+1)%reviewCards.length;showReviewSet();document.dispatchEvent(new CustomEvent('customer-reviews-advance',{detail:{index:reviewStart,total:reviewCards.length}}));};
 document.addEventListener('customer-reviews-updated',()=>{reviewCards=[...reviewStage.querySelectorAll('.customer-review-card')];reviewStart=Math.min(reviewStart,Math.max(0,reviewCards.length-1));const dots=document.querySelector('.review-dots');dots.replaceChildren(...Array.from({length:Math.min(6,reviewCards.length)},()=>document.createElement('span')));reviewDots=[...dots.querySelectorAll('span')];showReviewSet();});
 showReviewSet();
 if(!matchMedia('(prefers-reduced-motion:reduce)').matches)reviewTimer=setInterval(nextReviewSet,2000);
}`;
