/* Visual theme only. Kuwait solar cycle; never writes Mafia data-phase. */
(() => {
'use strict';
const root=document.documentElement, lat=29.3759, lon=47.9774;
const labels={dawn:'الفجر',sunrise:'الشروق',day:'النهار',sunset:'الغروب',night:'الليل'};
const locale='ar-KW-u-nu-latn', zone='Asia/Kuwait';
const time=new Intl.DateTimeFormat(locale,{timeZone:zone,hour:'numeric',minute:'2-digit',hour12:true});
const date=new Intl.DateTimeFormat(locale,{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric'});
const dayKey=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
let weather=null, timer;
const bar=document.createElement('aside');bar.className='diwan-clock';bar.setAttribute('aria-label','توقيت الكويت');
bar.innerHTML='<div><time class="diwan-time"></time><span class="diwan-date"></span></div><span class="diwan-context"></span>';
// Score pages keep their fixed viewport; a compact row lives inside main.
const container=document.querySelector('main')||document.body;
container.prepend(bar);
const scene=document.createElement('div');scene.className='diwan-scene';scene.setAttribute('aria-hidden','true');
scene.innerHTML='<div class="diwan-photo day"></div><div class="diwan-photo sunset"></div><div class="diwan-photo night"></div><div class="diwan-atmosphere"></div><div class="diwan-rain"></div>';
document.body.prepend(scene);
const rain=scene.querySelector('.diwan-rain');
for(let i=0;i<45;i++){const drop=document.createElement('i');drop.style.cssText=`left:${(i*37.3)%100}%;animation-delay:-${i*.17}s;animation-duration:${.65+(i%7)*.08}s`;rain.append(drop);}
// NOAA solar approximation, local minutes. Dawn is astronomical (-18 degrees),
// a visual stage rather than an official prayer timetable.
function solar(now){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,+p.value]));
 const n=(Date.UTC(parts.year,parts.month-1,parts.day)-Date.UTC(parts.year,0,0))/86400000;
 const g=2*Math.PI/365*(n-1), d=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
 const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
 const noon=720-4*lon-eq+180, r=Math.PI/180;
 const arc=angle=>Math.acos((Math.sin(angle*r)-Math.sin(lat*r)*Math.sin(d))/(Math.cos(lat*r)*Math.cos(d)))/r*4;
 return {dawn:noon-arc(-18),rise:noon-arc(-.833),set:noon+arc(-.833)};
}
function tick(){
 const now=new Date(), parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const m=+parts.hour*60 + +parts.minute, s=solar(now);
 const phase=m<s.dawn?'night':m<s.rise-15?'dawn':m<s.rise+40?'sunrise':m<s.set-40?'day':m<s.set+35?'sunset':'night';
 root.dataset.diwanTime=phase;
 root.style.setProperty('--dawn-light',String(Math.max(0,Math.min(1,(m-s.dawn)/(s.rise-s.dawn)))));
 const fresh=weather&&Date.now()-weather.at<30*60*1000;
 root.dataset.diwanRain=fresh&&weather.rain?'true':'false';
 root.dataset.diwanCloud=fresh&&weather.cloud>65?'true':'false';
 bar.querySelector('time').textContent=time.format(now);bar.querySelector('time').dateTime=now.toISOString();
 {const [y,mo,d]=dayKey.format(now).split('-');bar.querySelector('.diwan-date').textContent=`${d}/${mo}/${y}`;}
 bar.querySelector('.diwan-context').textContent=`الكويت · ${labels[phase]}${fresh?' · '+(weather.rain?'مطر':weather.cloud>65?'غائم':'جو هادي')+' · '+weather.temp+'°':''}`;
 bar.title=fresh?'آخر تحديث للطقس '+time.format(new Date(weather.at)):'الطقس غير متاح حاليًا — الأجواء حسب الوقت';
}
async function updateWeather(){
 try{
  const response=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,rain,showers,cloud_cover,weather_code&timezone=Asia%2FKuwait&forecast_days=1',{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('weather');
  const data=await response.json(), c=data.current;
  // Do not present old API data as live conditions.
  const stamp=Date.parse(c.time+'+03:00');
  if(!Number.isFinite(stamp)||Math.abs(Date.now()-stamp)>60*60*1000||!Number.isFinite(c.temperature_2m)||!Number.isFinite(c.rain)||!Number.isFinite(c.showers)||!Number.isFinite(c.cloud_cover))throw Error('stale');
  weather={at:Date.now(),rain:c.rain+c.showers>0,cloud:c.cloud_cover,temp:Math.round(c.temperature_2m)};
  try{localStorage.setItem('diwan.weather.v1',JSON.stringify(weather))}catch{}
 }catch{/* No invented rain when offline. */}
 tick();
}
try{const cached=JSON.parse(localStorage.getItem('diwan.weather.v1'));if(cached&&Number.isFinite(cached.at)&&Date.now()-cached.at>=0&&Date.now()-cached.at<30*60*1000)weather=cached}catch{}
tick();timer=setInterval(tick,15000);updateWeather();setInterval(updateWeather,15*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();if(!weather||Date.now()-weather.at>15*60*1000)updateWeather()}});
// Attribution required by the weather provider, unobtrusive and accessible.
if(document.body.dataset.diwanPage==='home'){
 const credit=document.createElement('a');credit.className='diwan-credit';credit.href='https://open-meteo.com/';credit.target='_blank';credit.rel='noopener noreferrer';credit.textContent='الطقس: Open-Meteo';container.append(credit);
}
})();
