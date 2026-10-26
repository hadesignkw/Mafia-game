/* الصوت بالأون لاين (كلاودفلير Realtime).
   التلفون يرسل المايك بمسارين: "talk" للكلام العام و"mafia" لمكالمة المافيا.
   السيرفر هو اللي يقرر منو يسمع منو، والتلفون بس يفتح ويسكر المايك حسب الدور. */
(()=>{
'use strict';
const G=n=>{try{return eval(n)}catch{return undefined}};
const ICE=[{urls:"stun:stun.cloudflare.com:3478"}];
let V=null;            // جلسة الصوت الحالية
let selfMute=false;
let bar=null;
const MIC_ON=`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8"/></svg>`;
const MIC_OFF=`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 9.3V5a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5.1 2.1M5 10v1a7 7 0 0 0 11.9 5M19 10v1c0 .9-.2 1.8-.5 2.6M12 18v4M8 22h8M3 3l18 18"/></svg>`;

async function api(op,body={}){
  const s=G('sess');if(!s||!s.token)throw new Error("ما فيه جلسة");
  const r=await fetch(`/api/rtc?code=${s.code}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({op,token:s.token,...body})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||("HTTP "+r.status));
  return j;
}
const desc=d=>({type:d.type,sdp:d.sdp});
const E=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);

async function start(){
  if(V)return;
  V={status:"يتصل…",audios:new Map(),subs:new Map(),key:null,busy:null,dead:false};
  paint();
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    const talk=stream.getAudioTracks()[0],mafia=talk.clone();
    talk.enabled=false;mafia.enabled=false;
    Object.assign(V,{stream,talk,mafia});
    // المرسل
    const prod=new RTCPeerConnection({bundlePolicy:"max-bundle",iceServers:ICE});
    const tT=prod.addTransceiver(talk,{direction:"sendonly"}),tM=prod.addTransceiver(mafia,{direction:"sendonly"});
    const offer=await prod.createOffer();await prod.setLocalDescription(offer);
    const pr=await api("producer",{offer:desc(prod.localDescription),tracks:[{mid:tT.mid,name:"talk"},{mid:tM.mid,name:"mafia"}]});
    await prod.setRemoteDescription(pr.answer);
    // ما نقول للسيرفر "اسمعوني" إلا بعد ما المايك يتصل فعلاً بكلاودفلير
    await new Promise((ok,no)=>{if(prod.connectionState==="connected")return ok();const to=setTimeout(()=>no(new Error("المايك ما اتصل")),15000);prod.addEventListener("connectionstatechange",()=>{if(prod.connectionState==="connected"){clearTimeout(to);ok()}else if(prod.connectionState==="failed"){clearTimeout(to);no(new Error("المايك ما اتصل"))}})});
    await api("live");
    // المستقبل
    const cons=new RTCPeerConnection({bundlePolicy:"max-bundle",iceServers:ICE});
    cons.addEventListener("track",e=>{const mid=e.transceiver.mid;if(!mid)return;let a=V.audios.get(mid);if(!a){a=document.createElement("audio");a.autoplay=true;a.setAttribute("playsinline","");a.dataset.mid=mid;document.body.appendChild(a);V.audios.set(mid,a)}a.srcObject=new MediaStream([e.track]);a.play().catch(()=>{})});
    for(const pc of [prod,cons])pc.addEventListener("connectionstatechange",()=>{if(pc.connectionState==="failed"&&V&&!V.dead){V.status="انقطع الصوت، يرجع يتصل…";paint();restart()}});
    await api("consumer");
    Object.assign(V,{prod,cons,status:"الصوت شغال"});
    tick();
  }catch(e){
    const msg=e&&e.name==="NotAllowedError"?"ما سمحت للمايك. اسمح له من إعدادات المتصفح.":"ما اشتغل الصوت: "+(e.message||e);
    stop();V={status:msg,failed:true,audios:new Map()};paint();
  }
}
function stop(){
  if(!V)return;V.dead=true;
  try{V.stream&&V.stream.getTracks().forEach(t=>t.stop());V.mafia&&V.mafia.stop()}catch{}
  try{V.prod&&V.prod.close()}catch{}try{V.cons&&V.cons.close()}catch{}
  (V.audios||new Map()).forEach(a=>a.remove());
  V=null;paint();
}
let restarting=false;
async function restart(){if(restarting)return;restarting=true;stop();await new Promise(r=>setTimeout(r,1200));restarting=false;start()}

// يطلب من السيرفر يحدّث منو نسمع، ويرد على عرض كلاودفلير
async function sync(){
  if(!V||!V.cons||V.dead)return;
  if(V.busy)return V.again=true;
  V.busy=true;
  try{
    do{
      V.again=false;
      const r=await api("sync");
      if(r.offer){await V.cons.setRemoteDescription(r.offer);const ans=await V.cons.createAnswer();await V.cons.setLocalDescription(ans);await api("answer",{answer:desc(V.cons.localDescription)})}
      const keep=new Set((r.subs||[]).map(x=>x.mid));V.subs=new Map((r.subs||[]).map(x=>[x.mid,x.key]));
      V.audios.forEach((a,mid)=>{if(!keep.has(mid)){a.srcObject=null;a.remove();V.audios.delete(mid)}});
    }while(V&&V.again&&!V.dead);
    if(V){V.status="الصوت شغال";V.fails=0}
  }catch(e){if(V){V.fails=(V.fails||0)+1;V.status=V.fails>3?"مشكلة بالصوت: "+e.message:"يتصل…";paint()}}
  if(V){V.busy=false;V.lastSync=Date.now()}
}

function tick(){
  const st=G('st'),view=G('view');
  const active=st&&st.online&&view==="game"&&st.me&&st.me.voice;
  if(!active){if(V)stop();paint();return}
  const v=st.me.voice;
  if(V&&V.talk){
    V.talk.enabled=!!v.talk&&!selfMute;
    V.mafia.enabled=!!v.mafia&&!selfMute;
    if(v.key!==V.key){V.key=v.key;sync()}
    // إذا فيه أحد المفروض نسمعه وما وصلنا صوته، نعيد المحاولة كل شوي
    else if(!V.busy&&(V.subs?V.subs.size:0)<(v.hear||[]).length&&Date.now()-(V.lastSync||0)>2500)sync();
  }
  paint();
}
setInterval(tick,400);

/* الشريط تحت: زر تشغيل الصوت، وحالة المايك، ومنو تسمع */
function paint(){
  const st=G('st'),view=G('view');
  const show=st&&st.online&&view==="game"&&st.me;
  if(!show){if(bar)bar.hidden=true;return}
  if(!bar){
    bar=document.createElement("div");bar.id="voiceBar";bar.setAttribute("role","status");
    bar.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;if(b.dataset.v==="start")start();if(b.dataset.v==="mute"){selfMute=!selfMute;tick()}if(b.dataset.v==="retry")restart()});
    document.body.appendChild(bar);
  }
  bar.hidden=false;
  const v=st.me.voice||{},nm=G('nm')||(id=>id);
  let html;
  if(!v.on)html=`<span class="vb-st">الصوت مو مفعّل بالسيرفر</span>`;
  else if(!V)html=`<button class="vb-go" data-v="start">🎙️ شغّل الصوت</button><span class="vb-st">لازم تشغله عشان تسمع وتتكلم</span>`;
  else if(V.failed)html=`<span class="vb-st">${E(V.status)}</span><button class="vb-btn" data-v="retry">جرّب مرة ثانية</button>`;
  else{
    const open=(v.talk||v.mafia)&&!selfMute;
    const hear=(v.hear||[]).map(id=>E(nm(id))).join("، ");
    const what=v.mafia?"مكالمة المافيا":v.talk?(st.phase==="lobby"||st.phase==="over"?"الكل يسمعك":"دورك، الكل يسمعك"):"مكتوم، مو دورك";
    html=`<span class="vb-mic ${open?"on":""}" aria-hidden="true"></span><span class="vb-st"><b>${selfMute?"كتمت نفسك":what}</b>${hear?`<small>تسمع: ${hear}</small>`:""}${V.status&&V.status!=="الصوت شغال"?`<small>${E(V.status)}</small>`:""}</span>${(v.talk||v.mafia)?`<button class="vb-mute ${selfMute?"off":""}" data-v="mute" aria-pressed="${selfMute}" aria-label="${selfMute?"افتح المايك":"اكتم المايك"}">${selfMute?MIC_OFF:MIC_ON}</button>`:""}`;
  }
  if(bar._h!==html){bar._h=html;bar.innerHTML=html}
}
})();
