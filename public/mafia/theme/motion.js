/* موشن اللعبة (شكل بس، ما يلمس حالة اللعبة). اللعبة تنادي هالدوال من index.html. */
(()=>{
'use strict';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* مشاهد المغيب والشروق: صورة + طبقة ظلام/نور + شمس أو قمر */
const sky=kind=>kind==='dusk'
  ?`<div class="mvl ph"></div><div class="mvl sunglow"></div><div class="mvl dk"></div><i class="mvmoon"></i>`
  :`<div class="mvl ph"></div><div class="mvl dk"></div><i class="mvsun"></i><div class="mvl lt"></div>`;

/* الاغتيال: منظار، فلاش الطلقة، والاسم يتشقق ويطيح */
const scope=who=>`<div class="mvscope" aria-hidden="true"><div class="ret"><i></i></div></div><div class="mvflash" aria-hidden="true"></div>
  <div class="mvname" aria-hidden="true"><b class="h1">${esc(who)}</b><b class="h2">${esc(who)}</b>
  <svg viewBox="0 0 420 90" preserveAspectRatio="none"><path d="M0 52 L60 47 L95 58 L140 44 L175 52 L210 40 L240 55 L262 48 L300 54 L340 42 L380 50 L420 45"/><path d="M175 52 L168 72 L178 86M262 48 L272 30 L266 16M95 58 L88 74"/></svg></div>`;

const life=()=>`<div class="mvlife" aria-hidden="true"></div>`;

const cigar=()=>`<div class="mvsmoke" aria-hidden="true">${[0,1,2,3,4,5].map(i=>`<i style="animation-delay:${(1.4+i*.75).toFixed(2)}s"></i>`).join('')}</div>
  <div class="mvcigar" aria-hidden="true"><svg viewBox="0 0 150 60"><rect x="10" y="22" width="118" height="18" rx="9" fill="#6b3f1f"/><rect x="10" y="22" width="118" height="6" rx="3" fill="#8a5730" opacity=".7"/>
  <rect x="36" y="21" width="16" height="20" fill="#b8322c"/><rect x="36" y="21" width="16" height="20" fill="none" stroke="#e9c46a" stroke-width="1.5"/><rect x="122" y="23" width="12" height="16" rx="4" fill="#9a9a9a"/><circle class="tip" cx="136" cy="31" r="7"/></svg></div>`;

/* ألعاب نارية للشعب */
function fireworks(host){
  if(reduced())return null;
  const c=document.createElement('canvas');host.prepend(c);const x=c.getContext('2d');
  const dpr=Math.min(2,devicePixelRatio||1);let W,H;const size=()=>{W=c.width=innerWidth*dpr;H=c.height=innerHeight*dpr};size();
  const cols=['#ffd36b','#d4e2f4','#72b096','#ff8f7a','#f4ffef','#b8cadd'];
  const parts=[],rockets=[];let raf,on=true,last=0;
  const launch=()=>rockets.push({x:W*(.15+Math.random()*.7),y:H,vy:-(H/55)*(.8+Math.random()*.3),ty:H*(.15+Math.random()*.3),col:cols[Math.floor(Math.random()*cols.length)]});
  const burst=r=>{const n=60+Math.floor(Math.random()*30);for(let i=0;i<n;i++){const a=Math.PI*2*i/n,s=(2+Math.random()*3.5)*dpr;parts.push({x:r.x,y:r.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,col:Math.random()<.2?'#fff':r.col})}};
  (function loop(t){if(!on)return;
    if(t-last>520){last=t;launch();if(Math.random()<.4)launch()}
    x.globalCompositeOperation='destination-out';x.fillStyle='rgba(0,0,0,.22)';x.fillRect(0,0,W,H);x.globalCompositeOperation='lighter';
    for(let i=rockets.length-1;i>=0;i--){const r=rockets[i];r.y+=r.vy;r.vy*=.985;x.fillStyle=r.col;x.beginPath();x.arc(r.x,r.y,2.2*dpr,0,7);x.fill();if(r.y<=r.ty){burst(r);rockets.splice(i,1)}}
    for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.06*dpr;p.vx*=.985;p.vy*=.985;p.life-=.012;
      if(p.life<=0){parts.splice(i,1);continue}x.globalAlpha=Math.max(0,p.life);x.fillStyle=p.col;x.beginPath();x.arc(p.x,p.y,1.8*dpr,0,7);x.fill()}
    x.globalAlpha=1;raf=requestAnimationFrame(loop)})(0);
  return()=>{on=false;cancelAnimationFrame(raf);c.remove()};
}

/* ترتيب كروت الأصوات يتحرك بنعومة بدل ما ينط */
function flipBefore(){const m=new Map();document.querySelectorAll('.vcard[data-id]').forEach(e=>m.set(e.dataset.id,e.getBoundingClientRect().top));return m}
function flipAfter(m){
  if(!m||!m.size||reduced())return;
  document.querySelectorAll('.vcard[data-id]').forEach(e=>{const o=m.get(e.dataset.id);if(o==null)return;const d=o-e.getBoundingClientRect().top;if(Math.abs(d)<2)return;
    e.animate([{transform:`translateY(${d}px)`},{transform:'none'}],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)'})});
}

/* الكرت يطير لتلفونك بعد ما تسكر شاشة "توزعت الكروت" */
function flyCard(){const f=document.querySelector('.flip');if(!f||reduced())return;f.classList.remove('fly');void f.offsetWidth;f.classList.add('fly');setTimeout(()=>f.classList.remove('fly'),1200)}

window.MV={sky,scope,life,cigar,fireworks,flipBefore,flipAfter,flyCard,reduced};
})();
