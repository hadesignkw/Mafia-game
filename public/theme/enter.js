/* حركات الدخول (شكل بس، ما تلمس أي بيانات):
   1) افتتاحية ديوان المدلل: مرة وحدة بكل جلسة، وتنتخطى بلمسة.
   2) صفحة الألعاب: كرت المافيا يتقلب ويكبر لين يملا الشاشة، وبعدها تفتح اللعبة.
   3) صفحة المافيا: نفس لون الكرت يفتح عن الاستقبال. */
(()=>{
'use strict';
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const ss={get:k=>{try{return sessionStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{v==null?sessionStorage.removeItem(k):sessionStorage.setItem(k,v)}catch{}}};
const page=document.body&&document.body.dataset.diwanPage;
const NS='http://www.w3.org/2000/svg';

/* ---------- 1) الافتتاحية ---------- */
function intro(){
  const root=document.documentElement;root.classList.add('dw-intro-on');
  // نقشة السدو على المسند
  let zig='';for(let x=40,u=0;x<=320;x+=14,u^=1)zig+=(x===40?'M':'L')+x+' '+(u?316:332);
  let dia='';for(let x=47;x<320;x+=28)dia+=`<path d="M${x} 324l7-7 7 7-7 7z" fill="#f0e6d2"/>`;
  const cards=[[-30,'b'],[-15,'h'],[0,'s'],[15,'d'],[30,'b']].map(([r,k],i)=>{
    const face=k==='b'?`<rect x="184" y="290" width="32" height="46" rx="4" fill="#3a1513" stroke="#c9a35b" stroke-width="1.4"/><path d="M190 296h20v34h-20z" fill="none" stroke="#c9a35b" stroke-opacity=".45"/>`
      :`<rect x="184" y="290" width="32" height="46" rx="4" fill="#f3e9d2" stroke="#c9a35b" stroke-width="1"/><text x="200" y="320" text-anchor="middle" font-size="18" fill="${k==='h'||k==='d'?'#b8322c':'#1d1408'}">${{h:'♥',s:'♠',d:'♦'}[k]}</text>`;
    return`<g class="card" style="transform:rotate(${r}deg);animation-delay:${(1.05+i*.08).toFixed(2)}s">${face}</g>`}).join('');
  const el=document.createElement('div');el.className='dw-intro';el.setAttribute('aria-hidden','true');
  el.innerHTML=`<svg viewBox="0 0 360 380" xmlns="${NS}">
    <defs>
      <linearGradient id="dwGold" x1="0" x2="1"><stop offset="0" stop-color="#8a6122"/><stop offset=".35" stop-color="#f5d58a"/><stop offset=".6" stop-color="#c9973f"/><stop offset="1" stop-color="#6e4c1a"/></linearGradient>
      <radialGradient id="dwGlow"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".35"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
      <clipPath id="dwCup"><path d="M244 284h36l-6 16q-12 6-24 0z"/></clipPath>
    </defs>
    <ellipse class="glow" cx="190" cy="250" rx="190" ry="150" fill="url(#dwGlow)"/>
    <g class="base">
      <ellipse cx="180" cy="352" rx="160" ry="12" fill="#000" opacity=".45"/>
      <rect x="30" y="300" width="300" height="48" rx="14" fill="#8f1d1a"/>
      <rect x="30" y="300" width="300" height="48" rx="14" fill="none" stroke="#5e0f0d" stroke-width="2"/>
      <path d="M40 307h280M40 341h280" stroke="#1a0b08" stroke-width="3"/><path d="M40 311h280M40 337h280" stroke="#f0e6d2" stroke-width="1.5"/>
      <path d="${zig}" fill="none" stroke="#e8902f" stroke-width="3" stroke-linejoin="round"/>${dia}
      <g stroke="#c9a35b" stroke-width="2" stroke-linecap="round"><path d="M32 306l-8-6M32 342l-8 6M328 306l8-6M328 342l8 6"/></g>
    </g>
    ${cards}
    <g class="base">
      <path d="M244 284h36l-6 16q-12 6-24 0z" fill="#f3e9d2"/>
      <g clip-path="url(#dwCup)"><rect class="fill" x="240" y="287" width="44" height="20" fill="#a8743a"/></g>
      <path d="M243 284h38" stroke="#c9a35b" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <g class="steam"><path d="M254 276q-6-8 0-16t0-16"/><path d="M262 278q6-8 0-16t0-16"/><path d="M270 276q-6-8 0-16t0-16"/></g>
    <path class="stream" d="M257 211Q259 250 261 288" fill="none" stroke="#b07a3a" stroke-width="3.2" stroke-linecap="round"/>
    <g class="base"><g class="dallah"><g transform="translate(132 300)">
      <path d="M-36-20Q-74-44-24-98" fill="none" stroke="url(#dwGold)" stroke-width="7" stroke-linecap="round"/>
      <path d="M28-30Q66-44 74-100L82-104Q76-40 30-16Z" fill="url(#dwGold)"/>
      <path d="M-35 0Q-46-30-38-50Q-22-80-16-92L-26-104Q0-112 26-104L16-92Q22-80 38-50Q46-30 35 0Z" fill="url(#dwGold)"/>
      <path d="M-30-6h60" stroke="#6e4c1a" stroke-width="3"/><path d="M-17-90h34" stroke="#6e4c1a" stroke-width="2.5"/>
      <path d="M-22-106Q0-140 22-106Z" fill="url(#dwGold)"/><path d="M0-122v-10" stroke="#c9973f" stroke-width="3"/><circle cy="-136" r="5" fill="#f5d58a"/>
      <path class="sheen" d="M-24-60Q-20-30-26-8" fill="none" stroke="#fff6d8" stroke-width="5" stroke-linecap="round"/>
    </g></g></g>
  </svg><div class="t">ديوان المدلل</div><div class="s">حياكم، القهوة جاهزة</div><div class="skip">دوس عشان تتخطى</div>`;
  document.body.appendChild(el);
  let done=false;
  const finish=()=>{if(done)return;done=true;el.classList.add('out');root.classList.remove('dw-intro-on');setTimeout(()=>el.remove(),750)};
  el.addEventListener('click',finish);
  setTimeout(finish,2900);
}

/* ---------- 2) كرت المافيا ينقلب ويكبر ---------- */
function zoomLinks(){
  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a.poster[href^="/mafia"]');
    if(!a||e.defaultPrevented||e.button>0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    e.preventDefault();
    const r=a.getBoundingClientRect(),img=a.querySelector('img');
    const z=document.createElement('div');z.className='dw-zoom';z.setAttribute('aria-hidden','true');
    z.style.cssText=`top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px`;
    z.innerHTML=`<div class="in"><div class="f">${img?`<img src="${img.getAttribute('src')}" alt="">`:''}</div><div class="b"><svg viewBox="0 0 64 64" fill="#c9a35b"><path d="M8 40c6-3 14-4 24-4s18 1 24 4c-2 4-10 6-24 6S10 44 8 40z"/><path d="M16 38c0-12 4-22 16-22s16 10 16 22c-5 1-10 1-16 1s-11 0-16-1z"/><path d="M17 33c8 2 22 2 30 0v4c-8 2-22 2-30 0z" fill="#b8322c"/></svg></div></div>`;
    document.body.appendChild(z);void z.offsetWidth;
    z.classList.add('go');z.style.cssText='top:0;left:0;width:100vw;height:100vh';
    ss.set('dw.arrive','1');
    setTimeout(()=>{location.href=a.href},680);
  });
  addEventListener('pageshow',()=>document.querySelectorAll('.dw-zoom').forEach(x=>x.remove()));
}

/* ---------- 3) وصول صفحة المافيا ---------- */
function arrive(){
  if(ss.get('dw.arrive')!=='1')return;ss.set('dw.arrive',null);
  const d=document.createElement('div');d.className='dw-arrive';d.setAttribute('aria-hidden','true');
  document.body.appendChild(d);setTimeout(()=>d.remove(),1000);
}

if(page==='home'){if(ss.get('dw.intro')!=='1'){ss.set('dw.intro','1');intro()}}
else if(page==='games')zoomLinks();
else if(location.pathname.startsWith('/mafia'))arrive();
})();
