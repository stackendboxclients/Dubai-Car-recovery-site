(() => {
 'use strict';
 const list=document.getElementById('reviews'),filter=document.getElementById('filter'),status=document.getElementById('status'),more=document.getElementById('more');let cursor=null,busy=false;
 const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
 async function api(url,options={}) {const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to complete the request.');return data;}
 async function load(append=false) {
  if(busy)return;busy=true;more.disabled=true;filter.disabled=true;list.setAttribute('aria-busy','true');status.textContent='Loading…';
  try {
   const result=await api('/api/admin-reviews?format=json&status='+filter.value+(append&&cursor?'&cursor='+encodeURIComponent(cursor):''));
   if(!append)list.replaceChildren();
   for(const review of result.reviews) {
    const card=el('article','');card.append(el('h2',review.customer_name),el('p',`${review.rating}/5 stars · ${new Date(review.created_at).toLocaleString('en-GB')} · ${review.status}`),el('blockquote',review.review_text),el('p',`Service: ${review.service||'Not specified'} · Private email: ${review.email||'Not provided'}`));
    const actions=el('div','');actions.className='actions';
    for(const [label,action] of [['Approve','approved'],['Reject spam / abuse','rejected'],['Remove','removed'],['Return to pending','pending']]) {
     if(action===review.status)continue;const button=el('button',label);button.type='button';
     button.addEventListener('click',async()=>{const buttons=[...actions.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);status.textContent='Saving moderation…';try{await api('/api/admin-reviews',{method:action==='removed'?'DELETE':'PATCH',body:JSON.stringify({id:review.id,status:action})});card.remove();status.textContent='Review updated. '+(action==='approved'?'It is now eligible for public display.':'');}catch(error){status.textContent=error.message;buttons.forEach(b=>b.disabled=false);}});actions.append(button);
    }
    card.append(actions);list.append(card);
   }
   cursor=result.nextCursor;more.hidden=!cursor;more.textContent='Load more';status.textContent=result.reviews.length?'Loaded customer submissions.':cursor?'No matching submissions on this page. Use Load more to continue.':'No submissions in this status.';
  }catch(error){status.textContent=error.message;more.hidden=false;more.textContent='Retry';}
  finally{busy=false;more.disabled=false;filter.disabled=false;list.setAttribute('aria-busy','false');}
 }
 filter.addEventListener('change',()=>{cursor=null;load();});more.addEventListener('click',()=>load(Boolean(cursor)));load();
})();
