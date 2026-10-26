/* Visual time only; never modifies data-phase, game state, audio, or room input. */
(()=>{
'use strict';

function period(){
 const now=new Date(),p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kuwait',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,+x.value]));
 const n=(Date.UTC(p.year,p.month-1,p.day)-Date.UTC(p.year,0,0))/86400000,g=2*Math.PI/365*(n-1),r=Math.PI/180;
 const d=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
 const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
 const noon=720-4*47.9774-eq+180;
 const arc=angle=>Math.acos((Math.sin(angle*r)-Math.sin(29.3759*r)*Math.sin(d))/(Math.cos(29.3759*r)*Math.cos(d)))/r*4;
 const dawn=noon-arc(-18),rise=noon-arc(-.833),set=noon+arc(-.833),m=p.hour*60+p.minute;
 return m<dawn?'night':m<rise-15?'dawn':m<rise+40?'sunrise':m<set-40?'day':m<set+35?'sunset':'night';
}
const variant=(time=period())=>['night','dawn'].includes(time)?'night':'day';
window.RxTime={period,variant};

const preloaded=new Set();
function preload(v){if(preloaded.has(v))return;preloaded.add(v);for(const state of ['reception','welcome','wrong']){const image=new Image();image.src='/mafia/art/'+state+'-'+v+'.webp';}}
function sync(){
 const time=period();document.body.dataset.receptionTime=time;
 const v=variant(time);
 const base='/mafia/art/',src=base+'reception-'+v+'.webp';
 window.RECEPTION_REACTIONS={wrong:base+'wrong-'+v+'.webp',welcome:base+'welcome-'+v+'.webp'};
 if(typeof RX_ASSETS!=='undefined')RX_ASSETS.scene=src;
 const img=document.querySelector('.rx-art');if(!img||img.getAttribute('src')===src)return;
 preload(v);
 const active=typeof reception!=='undefined'?reception:null;
 if(active)active.setArtwork(src);else img.src=src;
 const state=document.querySelector('.rx-shell')?.dataset.state;
 const key=state==='wrong'?'wrong':['welcome','open'].includes(state)?'welcome':null;
 if(key){const reaction=document.querySelector('.rx-reaction');if(reaction)reaction.src=window.RECEPTION_REACTIONS[key];}
}
function start(){const app=document.querySelector('#app');if(app)new MutationObserver(sync).observe(app,{childList:true});sync();setInterval(sync,60000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
