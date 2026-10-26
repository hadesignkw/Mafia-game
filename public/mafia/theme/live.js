/* Live layer: reception smoke and lanterns, farm ambience, and particles on top of the game's events.
   Visual only: never touches game state. Night rule: nothing here plays a sound or vibrates. */
(()=>{
'use strict';
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const rnd=(a,b)=>a+Math.random()*(b-a);
const DPR=()=>Math.min(devicePixelRatio||1,2);
const G=name=>{try{return eval(name)}catch{return undefined}}; // reads the game's top-level st/view
const isNightPhase=()=>{const st=G('st'),v=G('view');return v==='game'&&st&&(st.phase==='night'||st.phase==='night0')};
const audio=()=>{const a=G('receptionAudio');return a&&a.enabled&&!isNightPhase()?a:null};
const sfx=(n,o)=>{const a=audio();if(a)a.play(n,o)};

function sprite(c){const s=document.createElement('canvas');s.width=s.height=64;const g=s.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,c+'ff');gr.addColorStop(.42,c+'70');gr.addColorStop(1,c+'00');g.fillStyle=gr;g.fillRect(0,0,64,64);return s}
const SP={gold:sprite('#ffd98a'),white:sprite('#ffffff'),smoke:sprite('#9aa6b2'),dsmoke:sprite('#3a2226'),green:sprite('#5dffa0'),fire:sprite('#ff9a3c'),star:sprite('#dfe9ff'),rsmoke:sprite('#c9d3dc'),dsmokeL:sprite('#f2efe8')};

/* ================= Reception: smoke, steam, lanterns, fireflies ================= */
const RX={cig:[.562,.353],cup:[.856,.554],cupW:.085,lamps:[[.085,.068],[.942,.112]]};
let rx=null;
function rxMount(){
 const stage=document.querySelector('.rx-stage');
 if(!stage){if(rx){rx.stop();rx=null}return}
 if(rx&&rx.stage===stage)return;
 if(rx)rx.stop();
 const cv=document.createElement('canvas');cv.className='rx-livefx';cv.setAttribute('aria-hidden','true');
 const vig=stage.querySelector('.rx-vignette');stage.insertBefore(cv,vig||stage.querySelector('.rx-topbar'));
 const ctx=cv.getContext('2d');let W=0,H=0,on=true,raf=0,last=performance.now(),t=0,sa=0,ta=0,smoke=[],steam=[],motes=[],motesNight=null;
 const ro=new ResizeObserver(()=>{const r=stage.getBoundingClientRect(),d=DPR();W=r.width;H=r.height;cv.width=Math.round(W*d);cv.height=Math.round(H*d);ctx.setTransform(d,0,0,d,0,0)});ro.observe(stage);
 const night=()=>['night','dawn'].includes(document.body.dataset.receptionTime||'night');
 const seed=n=>{motes=[];motesNight=n;for(let i=0;i<(n?14:22);i++)motes.push(n?{x:rnd(.18,.82),y:rnd(.03,.2),vx:rnd(-.01,.01),vy:rnd(-.006,.006),ph:rnd(0,6.28),s:rnd(.6,1.1)}:{x:rnd(.45,.98),y:rnd(0,.45),vx:rnd(-.004,.004),vy:rnd(.002,.008),ph:rnd(0,6.28),s:rnd(.4,.9)})};
 const arts=()=>stage.querySelectorAll('.rx-art,.rx-reaction');
 function frame(now){
  if(!on)return;raf=requestAnimationFrame(frame);
  if(document.hidden){last=now;return}
  const dt=Math.min((now-last)/1000,.05);last=now;t+=dt;
  const n=night();if(motesNight!==n)seed(n);
  const s=(1.012+.006*Math.sin(t*2*Math.PI/9)).toFixed(4);arts().forEach(a=>a.style.scale=s);cv.style.scale=s;
  ctx.clearRect(0,0,W,H);ctx.globalCompositeOperation='lighter';
  RX.lamps.forEach(([lx,ly],i)=>{const f=.78+.12*Math.sin(t*7.3+i*4)+.07*Math.sin(t*13.1+i*8)+.05*Math.sin(t*23.7+i*12),cx=lx*W,cy=ly*H,R=W*(n?.2:.12)*f,g=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
   g.addColorStop(0,`rgba(255,196,110,${(n?.42:.16)*f})`);g.addColorStop(.35,`rgba(255,160,70,${(n?.16:.05)*f})`);g.addColorStop(1,'rgba(255,140,60,0)');ctx.fillStyle=g;ctx.fillRect(cx-R,cy-R,R*2,R*2)});
  const cx0=RX.cig[0]*W,cy0=RX.cig[1]*H,drag=Math.max(0,Math.sin(t*2*Math.PI/6.5))**6,er=W*(.016+.012*drag),eg=ctx.createRadialGradient(cx0,cy0,0,cx0,cy0,er);
  eg.addColorStop(0,`rgba(255,120,40,${.55+.4*drag})`);eg.addColorStop(1,'rgba(255,80,20,0)');ctx.fillStyle=eg;ctx.fillRect(cx0-er,cy0-er,er*2,er*2);
  motes.forEach(m=>{m.ph+=dt;m.x+=(m.vx+.004*Math.sin(m.ph*.7))*dt;m.y+=(m.vy+.003*Math.cos(m.ph*.9))*dt;
   if(n){if(m.x<.16||m.x>.84)m.vx*=-1;if(m.y<.02||m.y>.21)m.vy*=-1}else if(m.y>.46){m.y=0;m.x=rnd(.45,.98)}
   const a=n?Math.max(0,Math.sin(m.ph*1.6))**2*.9:(.25+.25*Math.sin(m.ph*2))*m.s,r=W*(n?.012:.006)*m.s;ctx.globalAlpha=a;ctx.drawImage(n?SP.gold:SP.white,m.x*W-r,m.y*H-r,r*2,r*2)});
  ctx.globalAlpha=1;ctx.globalCompositeOperation=n?'screen':'source-over';
  sa+=dt;while(sa>.11){sa-=.11;smoke.push({x:0,y:0,vx:rnd(-.004,.012),vy:rnd(-.05,-.034),r:rnd(.006,.01),g:rnd(.012,.02),life:0,max:rnd(4.2,6.2),ph:rnd(0,6.28),k:rnd(1.2,2.2)})}
  ta+=dt;while(ta>.16){ta-=.16;steam.push({x:rnd(-.5,.5)*RX.cupW,y:0,vy:rnd(-.032,-.022),r:rnd(.009,.013),g:rnd(.012,.018),life:0,max:rnd(2.2,3.2),ph:rnd(0,6.28)})}
  const img=n?SP.rsmoke:SP.dsmokeL;
  smoke=smoke.filter(p=>{p.life+=dt;if(p.life>p.max)return false;p.ph+=dt*p.k;p.x+=(p.vx+.012*Math.sin(p.ph))*dt;p.y+=p.vy*dt;p.r+=p.g*dt;
   const u=p.life/p.max,a=(u<.12?u/.12:1-((u-.12)/.88))*(n?.4:.3)*(1+drag*.6),r=p.r*W;ctx.globalAlpha=Math.max(0,a);ctx.drawImage(img,cx0+p.x*W-r,cy0+p.y*W-r,r*2,r*2);return true});
  const sx=RX.cup[0]*W,sy=RX.cup[1]*H;
  steam=steam.filter(p=>{p.life+=dt;if(p.life>p.max)return false;p.ph+=dt*2;p.x+=.006*Math.sin(p.ph)*dt;p.y+=p.vy*dt;p.r+=p.g*dt;
   const u=p.life/p.max,a=(u<.2?u/.2:1-((u-.2)/.8))*(n?.34:.28),r=p.r*W;ctx.globalAlpha=Math.max(0,a);ctx.drawImage(img,sx+p.x*W-r,sy+p.y*W-r,r*2,r*2);return true});
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 }
 raf=requestAnimationFrame(frame);
 rx={stage,stop(){on=false;cancelAnimationFrame(raf);ro.disconnect();cv.remove();arts().forEach(a=>a.style.scale='')}};
}

/* ================= Farm ambience behind the game screens ================= */
const farm=document.createElement('canvas');farm.id='liveFarm';farm.setAttribute('aria-hidden','true');
const fctx=farm.getContext('2d');let FW=0,FH=0,fT=0,fLast=performance.now(),lastDay=null,flash=null;
function fsize(){const d=DPR();FW=innerWidth;FH=innerHeight;farm.width=Math.round(FW*d);farm.height=Math.round(FH*d);fctx.setTransform(d,0,0,d,0,0)}
const WIN=[[.43,.72,.2,.33],[0,.25,.08,.32],[.75,1,.08,.32]];
const stars=Array.from({length:46},(_,i)=>{const w=WIN[i%3];return{fx:rnd(w[0],w[1]),fy:rnd(w[2],w[3]),ph:rnd(0,6.28),sp:rnd(1,2.6),s:rnd(.6,1.4)}});
const dust=Array.from({length:26},()=>({fx:rnd(.25,.8),fy:rnd(.15,.85),ph:rnd(0,6.28),v:rnd(.004,.012)}));
function img2st(fx,fy){const iw=1672,ih=941,s=Math.max(FW/iw,FH/ih),ox=(FW-iw*s)/2,oy=(FH-ih*s)/2;return[ox+fx*iw*s,oy+fy*ih*s]}
function farmFrame(now){
 requestAnimationFrame(farmFrame);
 const active=G('view')==='game'&&!document.body.classList.contains('reception-mode');
 if(document.hidden||!active){fLast=now;if(farm.isConnected&&!active)fctx.clearRect(0,0,FW,FH);return}
 const dt=Math.min((now-fLast)/1000,.05);fLast=now;fT+=dt;
 const day=document.body.dataset.phase==='day';
 if(lastDay!==null&&lastDay!==day)flash={t:0,day};lastDay=day;
 fctx.clearRect(0,0,FW,FH);fctx.globalCompositeOperation='lighter';
 if(!day)stars.forEach(s=>{s.ph+=dt*s.sp;const[x,y]=img2st(s.fx,s.fy);if(x<-5||x>FW+5)return;fctx.globalAlpha=(Math.max(0,Math.sin(s.ph))**3)*.85;const r=3*s.s;fctx.drawImage(SP.star,x-r,y-r,r*2,r*2)});
 else dust.forEach(m=>{m.ph+=dt;m.fy+=m.v*dt;if(m.fy>.9)m.fy=.12;const[x,y]=img2st(m.fx+.01*Math.sin(m.ph*.6),m.fy);fctx.globalAlpha=.28+.28*Math.sin(m.ph*1.7);fctx.drawImage(SP.white,x-2.5,y-2.5,5,5)});
 const f=.06+.03*Math.sin(fT*1.3)+.015*Math.sin(fT*5.1),g=fctx.createRadialGradient(FW*.5,FH*.3,0,FW*.5,FH*.3,Math.max(FW,FH)*.8);
 g.addColorStop(0,`rgba(255,190,110,${day?f*.5:f})`);g.addColorStop(1,'rgba(255,190,110,0)');fctx.globalAlpha=1;fctx.fillStyle=g;fctx.fillRect(0,0,FW,FH);
 if(flash){flash.t+=dt;const u=flash.t/3.6;if(u>=1)flash=null;else{const a=Math.sin(Math.PI*u)*(flash.day?.55:.4),c=flash.day?'255,170,80':'90,120,200',gg=fctx.createRadialGradient(FW*.5,FH*.25,0,FW*.5,FH*.25,Math.max(FW,FH));gg.addColorStop(0,`rgba(${c},${a})`);gg.addColorStop(1,`rgba(${c},0)`);fctx.fillStyle=gg;fctx.fillRect(0,0,FW,FH)}}
 fctx.globalCompositeOperation='source-over';
}

/* ================= Event particles on top of everything ================= */
const fx=document.createElement('canvas');fx.id='liveFx';fx.setAttribute('aria-hidden','true');
const ctx=fx.getContext('2d');let W=0,H=0,parts=[],draws=[],last=performance.now(),running=false;
function size(){const d=DPR();W=innerWidth;H=innerHeight;fx.width=Math.round(W*d);fx.height=Math.round(H*d);ctx.setTransform(d,0,0,d,0,0)}
function add(p){parts.push(Object.assign({vx:0,vy:0,ax:0,ay:0,gr:0,life:0,a:1,mode:'add',kind:'sprite',rot:0,vr:0,fade:'out'},p));wake()}
function draw(f){draws.push(f);wake()}
function burst(x,y,n,o){for(let i=0;i<n;i++){const a=rnd(0,6.283),s=rnd(o.s0||40,o.s1||180);add(Object.assign({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,max:rnd(o.l0||.7,o.l1||1.4),r:rnd(o.r0||2,o.r1||5)},o.p||{}))}}
function wake(){if(running)return;running=true;last=performance.now();requestAnimationFrame(loop)}
function loop(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 ctx.clearRect(0,0,W,H);
 draws=draws.filter(f=>f(dt)!==false);
 parts=parts.filter(p=>{p.life+=dt;if(p.life>=p.max)return false;p.vx+=p.ax*dt;p.vy+=p.ay*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.gr*dt;p.rot+=p.vr*dt;
  const u=p.life/p.max,al=p.a*(p.fade==='inout'?(u<.2?u/.2:1-(u-.2)/.8):p.fade==='none'?1:1-u);
  ctx.globalAlpha=Math.max(0,al);ctx.globalCompositeOperation=p.mode==='add'?'lighter':'source-over';
  if(p.kind==='rect'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.col;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.strokeStyle=p.edge;ctx.lineWidth=1;ctx.strokeRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore()}
  else ctx.drawImage(p.sp,p.x-p.r,p.y-p.r,p.r*2,p.r*2);return true});
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 timerFuse(dt);
 if(parts.length||draws.length||fuseOn){requestAnimationFrame(loop)}else{running=false;ctx.clearRect(0,0,W,H)}
}
const box=el=>{const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}};
let timers=[];const later=(ms,f)=>timers.push(setTimeout(f,ms));
function clearFx(){timers.forEach(clearTimeout);timers=[];parts=[];draws=[]}

function cracks(x,y,len,stillOn){
 const lines=[];for(let i=0;i<9;i++){let a=rnd(0,6.283),px=x,py=y;const pts=[[x,y]];for(let s=0;s<5;s++){a+=rnd(-.5,.5);const l=len/5*rnd(.6,1.3);px+=Math.cos(a)*l;py+=Math.sin(a)*l;pts.push([px,py])}lines.push(pts)}
 let k=0;draw(dt=>{if(!stillOn())return false;k=Math.min(1,k+dt*5);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.lineCap='round';
  lines.forEach(pts=>{const n=Math.max(1,Math.floor((pts.length-1)*k));ctx.beginPath();ctx.moveTo(...pts[0]);for(let i=1;i<=n;i++)ctx.lineTo(...pts[i]);ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.6;ctx.stroke();ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=.8;ctx.stroke()})});
}

const fxEl=()=>document.getElementById('fx');
const showing=cls=>()=>{const f=fxEl();return f&&!f.hidden&&f.classList.contains(cls)&&!f.classList.contains('fx-leave')};
let lastFxKey='';
function onFx(){
 const f=fxEl();if(!f)return;
 if(f.hidden||f.classList.contains('fx-leave')){if(lastFxKey){lastFxKey='';clearFx()}return}
 const key=f.className.split(' ').filter(c=>c.startsWith('fx-')&&c!=='fx-enter').join(' ')+'|'+f.innerHTML.length;
 if(key===lastFxKey)return;lastFxKey=key;clearFx();
 const has=c=>f.classList.contains(c);
 if(has('fx-kill')){
  later(450,()=>{const ph=f.querySelector('.pola .ph');if(!ph)return;const r=box(ph),ix=r.x+r.w*.15,iy=r.y-r.h*.12;
   cracks(ix,iy,r.w*.6,showing('fx-kill'));burst(ix,iy,26,{s0:80,s1:240,r0:1.5,r1:3,l0:.3,l1:.6,p:{sp:SP.white,ay:320}});
   for(let i=0;i<34;i++)later(i*50,()=>add({x:ix+rnd(-10,10),y:iy,vx:rnd(-15,15),vy:rnd(-50,-25),r:rnd(8,14),gr:rnd(18,32),max:rnd(1.8,2.8),sp:SP.smoke,a:.4,mode:'over',fade:'inout'}))});
 }
 else if(has('fx-saved')){
  const c=f.querySelector('.cross')||f;later(300,()=>{const r=box(c);let n=0;const ring=()=>{if(n++>=4||!showing('fx-saved')())return;let rr=r.w*.4,a=.9;draw(dt=>{rr+=dt*Math.max(r.w,80)*1.6;a-=dt*.8;if(a<=0)return false;ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1;ctx.strokeStyle=`rgba(93,255,160,${a})`;ctx.lineWidth=4;ctx.beginPath();ctx.arc(r.x,r.y,rr,0,6.283);ctx.stroke()});later(600,ring)};ring();
   for(let i=0;i<60;i++)later(200+i*35,()=>add({x:r.x+rnd(-W*.3,W*.3),y:r.y+rnd(40,120),vy:rnd(-130,-60),vx:rnd(-12,12),r:rnd(2,4.5),max:rnd(1,1.8),sp:SP.green,a:.9}))});
 }
 else if(has('fx-cast')){
  const v=f.querySelector('.voter'),t=f.querySelector('.target');if(!v||!t)return;
  later(150,()=>{const a=box(v),b=box(t);let k=0,rot=0;draw(dt=>{k+=dt/.65;rot+=dt*9;if(k>=1){burst(b.x,b.y,14,{s0:40,s1:120,r0:2,r1:3.5,l0:.4,l1:.8,p:{sp:SP.gold}});return false}
   const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2,x=a.x+(b.x-a.x)*e,y=a.y+(b.y-a.y)*e-Math.sin(Math.PI*e)*90;
   ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.translate(x,y);ctx.rotate(rot);ctx.fillStyle='#f2e6cc';ctx.shadowColor='#0008';ctx.shadowBlur=6;ctx.fillRect(-13,-9,26,18);ctx.restore()});sfx('whoosh',{gain:.35})});
 }
 else if(has('fx-out')){
  later(500,()=>{const p=f.querySelector('.pola');if(!p)return;const r=box(p);draw(()=>{if(!showing('fx-out')())return false;const g=ctx.createRadialGradient(r.x,r.y,0,r.x,r.y,r.w*1.6);g.addColorStop(0,'rgba(255,230,170,.28)');g.addColorStop(1,'rgba(255,230,170,0)');ctx.globalAlpha=1;ctx.globalCompositeOperation='lighter';ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(r.x-24,0);ctx.lineTo(r.x+24,0);ctx.lineTo(r.x+r.w*1.1,r.y+r.h*.7);ctx.lineTo(r.x-r.w*1.1,r.y+r.h*.7);ctx.closePath();ctx.fill()});
   burst(r.x,r.y+r.h*.5,30,{s0:30,s1:120,r0:2,r1:4,l0:.8,l1:1.5,p:{sp:SP.white,a:.5,ay:-20}})});
 }
 else if(has('fx-win-town')){
  const cols=['#ffd98a','#8fd3ff','#ff8fa3','#a6ff9e','#ffffff'];
  for(let i=0;i<12;i++)later(300+i*520,()=>{if(!showing('fx-win-town')())return;const x=rnd(W*.12,W*.88),y=rnd(H*.08,H*.38),sp=sprite(cols[i%cols.length]);
   add({x,y:H,vx:(x-W/2)*.1,vy:-(H-y)*1.6,ay:(H-y)*1.6,r:3,max:.62,sp,fade:'none'});
   later(600,()=>{sfx('chips',{gain:.35,rate:.7});burst(x,y,55,{s0:40,s1:200,r0:1.6,r1:3.2,l0:1,l1:1.8,p:{sp,ay:55}})})});
 }
 else if(has('fx-win-mafia')){
  for(let i=0;i<40;i++)later(i*70,()=>add({x:rnd(0,W),y:H+20,vx:rnd(-10,10),vy:rnd(-60,-30),r:rnd(30,55),gr:20,max:rnd(3,4.5),sp:SP.dsmoke,a:.55,mode:'over',fade:'inout'}));
  later(500,()=>{for(let i=0;i<18;i++)later(i*90,()=>add({kind:'rect',x:rnd(W*.2,W*.8),y:H*.6,vx:rnd(-240,240),vy:rnd(-560,-320),ay:640,w:30,h:42,col:'#141a22',edge:'#d9b878',rot:rnd(0,3),vr:rnd(-8,8),max:2.2,mode:'over',fade:'none'}))});
 }
 else if(has('fx-deal')){
  later(500,()=>{const fan=f.querySelector('.fan')||f;const r=box(fan);burst(r.x,r.y,60,{s0:60,s1:260,r0:2,r1:5,l0:.8,l1:1.6,p:{sp:SP.gold,ay:60}})});
 }
}

/* Card reveal: the same golden dust for every role */
let cardWasOpen;
function onCards(){
 const el=document.querySelector('.flip');if(!el){cardWasOpen=undefined;return}
 const open=el.classList.contains('open');
 if(open&&cardWasOpen===false)setTimeout(()=>{const c=document.querySelector('.flip');if(!c)return;const r=box(c);burst(r.x,r.y-r.h*.1,70,{s0:60,s1:260,r0:2,r1:5,l0:.8,l1:1.6,p:{sp:SP.gold,ay:60}})},450);
 cardWasOpen=open;
}

/* Lobby: light a lantern for each new player (once per name) */
const litNames=new Set();
function onSeats(){
 const seats=[...document.querySelectorAll('.seat:not(.live-lit)')];if(!seats.length)return;
 const fresh=seats.filter(s=>!litNames.has((s.querySelector('.sn')||{}).textContent));
 const quiet=fresh.length>2;
 seats.forEach(s=>{if(!fresh.includes(s))s.classList.add('live-lit')});
 fresh.forEach((s,i)=>{litNames.add((s.querySelector('.sn')||{}).textContent);setTimeout(()=>{const cur=[...document.querySelectorAll('.seat')].find(x=>(x.querySelector('.sn')||{}).textContent===(s.querySelector('.sn')||{}).textContent)||s;cur.classList.add('live-lit');const a=cur.querySelector('.av');if(!a)return;const r=box(a);burst(r.x,r.y,14,{s0:20,s1:70,r0:2,r1:3.5,l0:.4,l1:.8,p:{sp:SP.gold,ay:-30}});if(!quiet)sfx('door',{gain:.3})},(quiet?i*90:250))});
}

/* Timer fuse: sparks from the tip of the ring in the last ten seconds */
let fuseOn=false,fuseSec=null;
function timerFuse(){
 const el=document.getElementById('timer');fuseOn=false;
 if(!el||el.hidden||el.classList.contains('end')){if(el)el.classList.remove('live-hot','live-crit');return}
 const st=G('st'),off=G('offset')||0;if(!st||!st.timer)return;
 const left=Math.max(0,(st.timer.endsAt-(Date.now()+off))/1000);
 el.classList.toggle('live-hot',left<=10&&left>0);el.classList.toggle('live-crit',left<=5&&left>0);
 if(left>10||left<=0){if(left<=0&&fuseSec!==st.timer.id){fuseSec=st.timer.id;const ring=el.querySelector('.ring');if(ring){const r=box(ring);burst(r.x,r.y,50,{s0:80,s1:280,r0:2,r1:4,l0:.5,l1:1,p:{sp:SP.fire,ay:220}})}}return}
 fuseOn=true;const ring=el.querySelector('.ring');if(!ring)return;
 const r=box(ring),R=r.w*26/62,frac=left/st.timer.dur,a=-Math.PI/2+2*Math.PI*frac,x=r.x+Math.cos(a)*R,y=r.y+Math.sin(a)*R;
 if(y<-20||y>H+20)return;
 for(let i=0;i<(left<=5?3:2);i++)parts.push({x,y,vx:rnd(-90,90),vy:rnd(-120,20),ax:0,ay:260,gr:0,life:0,a:1,mode:'add',kind:'sprite',rot:0,vr:0,fade:'out',r:rnd(1.5,3.2),max:rnd(.3,.7),sp:SP.fire});
 ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.9;ctx.drawImage(SP.fire,x-14,y-14,28,28);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}
setInterval(()=>{const el=document.getElementById('timer');if(el&&!el.hidden)wake()},250);

/* ================= Wiring ================= */
function start(){
 document.body.appendChild(farm);document.body.appendChild(fx);fsize();size();
 addEventListener('resize',()=>{fsize();size()});
 requestAnimationFrame(farmFrame);
 const app=document.getElementById('app');
 if(app)new MutationObserver(()=>{rxMount();onCards();onSeats()}).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 const f=fxEl();if(f)new MutationObserver(onFx).observe(f,{attributes:true,attributeFilter:['class','hidden'],childList:true});
 rxMount();onCards();onSeats();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
