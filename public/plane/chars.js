/* شخصيات طيران الزفت: مبنية بالكود قطعة قطعة من رسومات الشخصيات.
   كل شخصية: راس كبير، جسم قصير، أطراف قصيرة، ألوان مسطحة. الوجه يتغير (عادي، خايف، دايخ، معصب، يصيح، يضحك). */
import * as T from "./three.min.js";
const SKIN={light:0xf0c8a0,tan:0xe2a877,med:0xd1946a,dark:0xb87a52};
const M=(c)=>new T.MeshLambertMaterial({color:c});
const geo={sph:new T.SphereGeometry(1,18,14),box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,14),cap:new T.CapsuleGeometry(1,1,4,12),tor:new T.TorusGeometry(1,.28,8,20),arc:new T.TorusGeometry(1,.22,8,16,Math.PI),ring:new T.TorusGeometry(1,.12,8,24)};
function mesh(g,c,x=0,y=0,z=0,sx=1,sy=1,sz=1,p){const m=new T.Mesh(geo[g],M(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);if(p)p.add(m);return m}
export const KINDS={
  captain:{n:"الكابتن",skin:"light",shirt:0x1f2d52,pants:0x1f2d52,shoes:0x111,hat:"cap",glasses:"sun",beard:"goatee",mustache:true,wide:1.1},
  steward:{n:"المضيف",skin:"tan",shirt:0xf3efe4,vest:0x1f2d52,pants:0x1f2d52,shoes:0x111,hair:0x222,bow:0xd4a23c,wide:1},
  stewardess:{n:"المضيفة",skin:"light",shirt:0x1f2d52,pants:0x1f2d52,shoes:0x111,hat:"hijab",glasses:"round",female:true,wide:1},
  guard:{n:"الأمن",skin:"tan",shirt:0x16161a,pants:0x16161a,shoes:0x111,hat:"beret",mustache:true,wide:1.65,headScale:.8,belt:0x333},
  mechanic:{n:"الفني",skin:"tan",shirt:0xf3efe4,overall:0x1f2d52,pants:0x1f2d52,shoes:0x111,hat:"ghutra",mustache:true,wide:1.15},
  cleaner:{n:"عامل النظافة",skin:"med",shirt:0x1f2d52,pants:0x1f2d52,shoes:0xf0c419,hat:"ghutra",gloves:0xf0c419,mustache:true,wide:1.05},
  amm:{n:"العم",skin:"tan",dishdasha:0xf1ede3,shoes:0x6b4a2e,hat:"ghutra",mustache:0xcfcfcf,brows:0x777,wide:1},
  yadda:{n:"اليدة",skin:"med",abaya:0x1b1b1f,shoes:0x111,hat:"shayla",glasses:"big",female:true,wide:1.45,bag:0x5a3a2e},
  kid:{n:"الياهل",skin:"light",shirt:0xf08a2a,pants:0x1f8a8a,shoes:0x2aa0a0,hair:0x3b2416,scale:.75,wide:1},
  snap:{n:"السنابي",skin:"light",shirt:0xb48cd6,pants:0x2a2a30,shoes:0x8ad0d0,hair:0x4a2c1a,phone:true,wide:1},
  sleep:{n:"النايم",skin:"tan",shirt:0x6b7a58,pants:0x6b7a58,shoes:0xdddddd,hair:0x3b2416,mask:true,pillow:0xd94c3d,mustache:true,wide:1.1},
  bags:{n:"بوشنط",skin:"tan",shirt:0xd9c9a8,pants:0xd9c9a8,shoes:0x6b4a2e,hat:"ghutra",mustache:true,backpack:0x2f6b5a,pot:0x9a9a9a,wide:1.1},
  gym:{n:"بوجيم",skin:"light",shirt:0xd9533f,pants:0x1f5a5a,shoes:0x2aa0a0,hair:0x222,tank:true,wide:1.3},
  biz:{n:"بزنس",skin:"med",shirt:0x2a2a2e,pants:0x2a2a2e,shoes:0x111,hair:0x111,tie:0x7a1f2e,mustache:true,angry:true,wide:1.15},
  nerv:{n:"المتوتر",skin:"light",shirt:0x5a9a6a,pants:0xf1ede3,shoes:0x6b4a2e,hat:"ghutra",sweat:true,wide:1},
  tour:{n:"السايح",skin:"tan",shirt:0xf08a2a,pants:0xd9c9a8,shoes:0x6b4a2e,hat:"sunhat",mustache:true,camera:true,sunburn:true,wide:1.15},
  khala:{n:"الخالة",skin:"tan",abaya:0x3a2a4a,shoes:0x111,hat:"shayla",female:true,wide:1.3},
  sebha:{n:"بوسبحة",skin:"med",dishdasha:0xf1ede3,shoes:0x6b4a2e,hat:"ghutra",mustache:0x222,wide:1.05},
  sheep:{n:"خروف",animal:"sheep"},falcon:{n:"صقر",animal:"falcon"},croc:{n:"تمساح",animal:"croc"},
};
export const FACES=["n","scared","dizzy","angry","cry","laugh","sleep"];
export function makeChar(kind,opts={}){
  const K={...(KINDS[kind]||KINDS.steward),...opts};
  if(K.animal)return makeAnimal(K,kind);
  const g=new T.Group();const skin=SKIN[K.skin]||SKIN.tan;const W=K.wide||1;
  const parts={};
  /* ---- الرجول ---- */
  const legY=.34;
  for(const s of[-1,1]){const hip=new T.Group();hip.position.set(s*.13*W,legY,0);g.add(hip);
    mesh("cyl",K.dishdasha||K.abaya?(K.dishdasha||K.abaya):K.pants,0,-.16,0,.1*W,.32,.1,hip);
    mesh("box",K.shoes||0x111,0,-.33,.03,.19,.09,.26,hip);
    parts[s<0?"legL":"legR"]=hip}
  /* ---- الجسم ---- */
  const torso=new T.Group();torso.position.y=legY;g.add(torso);parts.torso=torso;
  if(K.dishdasha||K.abaya){const col=K.dishdasha||K.abaya;const b=mesh("cyl",col,0,.3,0,.3*W,.9,.26,torso);b.geometry=new T.CylinderGeometry(.9,1.15,1,16);b.position.y=.25;b.scale.set(.33*W,.95,.3);
    if(K.abaya){const sh=mesh("sph",col,0,.55,0,.36*W,.4,.33,torso)}}
  else{const b=mesh("cap",K.shirt,0,.38,0,.28*W,.26,.22,torso);b.geometry=new T.CapsuleGeometry(1,.9,4,12);
    if(K.vest){mesh("box",K.vest,0,.36,0,.46*W,.56,.2,torso).position.z=.03;mesh("box",K.vest,0,.36,-.1,.5*W,.56,.3,torso)}
    if(K.overall){mesh("box",K.overall,0,.3,.0,.5*W,.5,.46,torso);for(const s of[-1,1])mesh("box",K.overall,s*.14*W,.6,.12,.08,.3,.05,torso)}
    if(K.tank){mesh("box",K.shirt,0,.4,0,.44*W,.5,.4,torso)}
    if(K.tie)mesh("box",K.tie,0,.5,.25,.08,.3,.03,torso);
    if(K.bow){mesh("box",K.bow,-.07,.66,.24,.1,.08,.03,torso);mesh("box",K.bow,.07,.66,.24,.1,.08,.03,torso)}
    if(K.belt)mesh("box",K.belt,0,.1,0,.6*W,.08,.5,torso);
    mesh("sph",K.shirt,0,.1,0,.3*W,.18,.26,torso)}
  if(K.backpack){mesh("box",K.backpack,0,.4,-.32,.5,.6,.25,torso);mesh("cyl",0x7a2a3a,0,.75,-.32,.12,.5,.12,torso).rotation.z=Math.PI/2}
  if(K.pillow){const t=mesh("tor",K.pillow,0,.78,0,.22,.22,.22,torso);t.rotation.x=Math.PI/2}
  /* ---- الأيدي ---- */
  for(const s of[-1,1]){const sh=new T.Group();sh.position.set(s*.3*W,.68,0);torso.add(sh);
    const sleeve=K.dishdasha||K.abaya?(K.dishdasha||K.abaya):(K.tank?skin:K.shirt);
    mesh("cyl",sleeve,0,-.17,0,.08,.34,.08,sh);mesh("sph",K.gloves||skin,0,-.37,0,.09,.09,.09,sh);
    parts[s<0?"armL":"armR"]=sh}
  /* ---- الراس ---- */
  const neck=new T.Group();neck.position.y=.8;torso.add(neck);parts.neck=neck;
  const hs=(K.headScale||1)*1.25;const head=new T.Group();head.scale.setScalar(hs);neck.add(head);parts.head=head;
  const R=.31;mesh("sph",skin,0,R*.95,0,R,R*1.05,R*.95,head);
  for(const s of[-1,1])mesh("sph",skin,s*R*.95,R*.9,0,.06,.07,.04,head);      // الأذان
  mesh("sph",K.sunburn?0xe0705a:skin,0,R*.78,R*.9,.06,.05,.06,head);              // الأنف
  if(K.sunburn)mesh("sph",0xe0705a,0,R*.7,R*.55,.2,.12,.14,head);
  // العيون
  const face={eyes:[],pupils:[],brows:[]};
  for(const s of[-1,1]){const e=mesh("sph",0xffffff,s*.11,R*1.02,R*.8,.075,.085,.05,head);const p=mesh("sph",0x111,s*.11,R*1.02,R*.83,.035,.04,.03,head);face.eyes.push(e);face.pupils.push(p);
    const b=mesh("box",K.brows||0x222,s*.11,R*1.4,R*.82,.16,.035,.03,head);face.brows.push(b)}
  if(K.glasses==="sun"){mesh("box",0x111,0,R*1.02,R*.9,.42,.11,.03,head);mesh("box",0xd4a23c,0,R*1.1,R*.9,.44,.015,.02,head)}
  if(K.glasses==="big"||K.glasses==="round"){const big=K.glasses==="big";for(const s of[-1,1])mesh("ring",big?0x6a2a5a:0x222,s*.115,R*1.02,R*.92,big?.1:.085,big?.1:.085,.05,head);mesh("box",big?0x6a2a5a:0x222,0,R*1.02,R*.92,.06,.02,.02,head)}
  if(K.mask){mesh("box",0x222,0,R*1.02,R*.86,.46,.14,.04,head)}
  // الفم
  face.mouth={};
  face.mouth.n=mesh("box",0x5a2a2a,0,R*.5,R*.92,.14,.03,.02,head);
  face.mouth.smile=mesh("arc",0x5a2a2a,0,R*.58,R*.92,.08,.06,.03,head);face.mouth.smile.rotation.z=Math.PI;
  face.mouth.open=mesh("sph",0x4a1a1a,0,R*.5,R*.9,.08,.1,.04,head);
  face.mouth.frown=mesh("arc",0x5a2a2a,0,R*.42,R*.92,.08,.05,.03,head);
  face.mouth.laugh=mesh("sph",0x4a1a1a,0,R*.5,R*.9,.12,.07,.04,head);
  face.teeth=mesh("box",0xffffff,0,R*.54,R*.94,.14,.04,.02,head);
  face.tears=[];for(const s of[-1,1])face.tears.push(mesh("sph",0x6ec6ff,s*.14,R*.8,R*.85,.035,.06,.03,head));
  face.sweat=mesh("sph",0x9fd8ff,R*.8,R*1.3,R*.5,.04,.06,.03,head);
  face.spiral=[];for(const s of[-1,1]){const t=mesh("tor",0x111,s*.11,R*1.02,R*.86,.05,.05,.02,head);t.scale.set(.05,.05,.015);face.spiral.push(t)}
  face.zz=mesh("box",0x000,0,0,0,0,0,0,head);
  if(K.mustache){const c=typeof K.mustache==="number"?K.mustache:0x222;mesh("box",c,0,R*.66,R*.95,.2,.05,.03,head).rotation.z=0;mesh("sph",c,-.09,R*.66,R*.95,.05,.03,.03,head);mesh("sph",c,.09,R*.66,R*.95,.05,.03,.03,head)}
  if(K.beard==="goatee")mesh("box",0x222,0,R*.3,R*.92,.1,.1,.03,head);
  if(K.angry){face.brows[0].rotation.z=-.5;face.brows[1].rotation.z=.5}
  /* ---- الشعر والغطا ---- */
  if(K.hair){mesh("sph",K.hair,0,R*1.25,-.03,R*.98,R*.65,R*.98,head);if(kind==="snap"||kind==="gym")mesh("sph",K.hair,0,R*1.75,.05,.16,.12,.16,head);if(kind==="kid")mesh("sph",K.hair,-.12,R*1.8,.02,.1,.1,.1,head)}
  if(K.hat==="cap"){mesh("cyl",0x1f2d52,0,R*1.85,0,R*1.05,.1,R*1.05,head);mesh("sph",0x1f2d52,0,R*1.95,-.04,R*1.15,.16,R*1.15,head);mesh("box",0x111,0,R*1.78,R*.95,.5,.03,.3,head);mesh("cyl",0xd4a23c,0,R*1.98,R*.9,.07,.02,.07,head).rotation.x=Math.PI/2.4;mesh("box",0xd4a23c,0,R*1.82,R*1.02,.5,.02,.03,head)}
  if(K.hat==="beret"){mesh("cyl",0x111,0,R*1.85,0,R*1.0,.08,R*1.0,head);mesh("sph",0x111,0,R*1.9,0,R*1.05,.14,R*1.05,head)}
  if(K.hat==="ghutra"){const w=0xf7f5ef;mesh("sph",w,0,R*1.0,-.02,R*1.06,R*1.08,R*1.06,head).geometry=new T.SphereGeometry(1,18,14,0,Math.PI*2,0,Math.PI*.42);
    const back=mesh("box",w,0,R*.45,-R*.85,.62,1.0,.1,head);back.rotation.x=.12;for(const s of[-1,1]){const f=mesh("box",w,s*R*.92,R*.45,-R*.72,.06,.85,.22,head);f.rotation.y=s*.3}
    for(const y of[R*1.72,R*1.58]){const ag=mesh("ring",0x111,0,y,0,R*1.04,R*1.04,R*1.04,head);ag.rotation.x=Math.PI/2}}
  if(K.hat==="shayla"||K.hat==="hijab"){const c=K.hat==="hijab"?0x1f2d52:(K.abaya||0x111);const h=mesh("sph",c,0,R*1.0,-.08,R*1.1,R*1.15,R*1.05,head);h.geometry=new T.SphereGeometry(1,18,14,Math.PI*.15,Math.PI*1.7,0,Math.PI*.7);h.rotation.y=Math.PI/2;
    const col=mesh("cyl",c,0,R*.2,-.12,R*1.08,.45,R*.95,head);col.geometry=new T.CylinderGeometry(1,1,1,16,1,false,Math.PI*.15,Math.PI*1.7);col.rotation.y=Math.PI/2;if(K.hat==="hijab")mesh("box",0xd4a23c,0,R*1.55,R*.95,.3,.03,.02,head)}
  if(K.hat==="sunhat"){mesh("cyl",0xf0e2c0,0,R*1.9,0,R*.9,.25,R*.9,head);mesh("cyl",0xf0e2c0,0,R*1.8,0,R*1.6,.03,R*1.6,head);mesh("cyl",0x6b4a2e,0,R*1.85,0,R*.92,.05,R*.92,head)}
  /* ---- أغراض باليد ---- */
  if(K.phone){const ph=mesh("box",0x111,0,-.42,.1,.09,.16,.02,parts.armR);mesh("box",0xfffc00,0,-.42,.115,.07,.13,.01,parts.armR);parts.armR.rotation.x=-1.4;parts.armR.rotation.z=-.5;parts.propArm=true}
  if(K.camera)mesh("box",0x222,0,.42,.26,.16,.1,.08,torso);
  if(K.bag){const b=mesh("box",K.bag,0,-.5,.05,.22,.18,.1,parts.armR);mesh("tor",K.bag,0,-.38,.05,.08,.08,.03,parts.armR)}
  if(K.pot){mesh("cyl",K.pot,0,R*2.1,0,R*.9,.3,R*.9,head);mesh("sph",0x555,0,R*2.3,0,.05,.05,.05,head)}
  g.userData.parts=parts;g.userData.face=face;g.userData.kind=kind;g.userData.K=K;
  if(K.scale)g.scale.setScalar(K.scale);
  setFace(g,K.angry?"angry":"n");
  return g;
}
function makeAnimal(K,kind){const g=new T.Group();const parts={};
  if(kind==="sheep"){mesh("sph",0xf3eee2,0,.45,0,.42,.36,.5,g);mesh("sph",0xf3eee2,0,.62,.1,.3,.25,.3,g);const h=mesh("sph",0x4a3426,0,.6,.5,.2,.2,.22,g);mesh("sph",0xf3eee2,0,.78,.45,.18,.12,.16,g);
    for(const s of[-1,1]){mesh("sph",0x4a3426,s*.2,.62,.45,.1,.05,.14,g);const e=mesh("sph",0xffffff,s*.08,.66,.68,.05,.05,.03,g);mesh("sph",0x111,s*.08,.66,.7,.025,.025,.02,g)}
    for(const x of[-1,1])for(const z of[-1,1]){const l=new T.Group();l.position.set(x*.2,.25,z*.25);g.add(l);mesh("cyl",0x4a3426,0,-.12,0,.05,.25,.05,l);parts["leg"+x+z]=l}}
  if(kind==="falcon"){mesh("sph",0x8a6a3a,0,.4,0,.22,.3,.3,g);mesh("sph",0xf0c050,0,.72,.08,.17,.2,.17,g);mesh("sph",0xd4a23c,0,.9,.08,.05,.08,.05,g);mesh("box",0xf0c050,0,.83,.26,.06,.05,.1,g);
    for(const s of[-1,1]){const w=new T.Group();w.position.set(s*.2,.45,0);g.add(w);mesh("box",0x6a4a2a,s*.2,0,0,.4,.06,.3,w);parts[s<0?"wingL":"wingR"]=w;mesh("cyl",0xf0c050,s*.08,.12,.05,.03,.2,.03,g)}
    mesh("box",0x6a4a2a,0,.3,-.3,.2,.04,.3,g)}
  if(kind==="croc"){mesh("sph",0x7a9a3a,0,.3,0,.3,.22,.6,g);mesh("sph",0xc9d48a,0,.22,0,.28,.14,.55,g);const hd=mesh("box",0x7a9a3a,0,.3,.75,.4,.22,.5,g);mesh("box",0xc9d48a,0,.22,.8,.38,.06,.45,g);
    for(const s of[-1,1]){mesh("sph",0xffffff,s*.12,.45,.6,.07,.07,.05,g);mesh("sph",0x111,s*.12,.45,.64,.035,.035,.02,g);mesh("sph",0x7a9a3a,s*.12,.5,.55,.08,.08,.08,g)}
    for(let i=0;i<4;i++)mesh("box",0xffffff,-.15+i*.1,.2,1.0,.04,.06,.03,g);
    const tail=mesh("cyl",0x7a9a3a,0,.28,-.7,.2,.6,.2,g);tail.rotation.x=Math.PI/2;tail.geometry=new T.CylinderGeometry(.05,.25,1,10);parts.tail=tail;
    for(let i=0;i<5;i++)mesh("box",0x4a6a2a,0,.52,-.3+i*.2,.08,.08,.08,g);
    for(const x of[-1,1])for(const z of[-1,1]){const l=new T.Group();l.position.set(x*.28,.15,z*.35);g.add(l);mesh("cyl",0x7a9a3a,0,-.07,0,.06,.15,.06,l);parts["leg"+x+z]=l}}
  g.scale.setScalar(kind==="croc"?1.3:1.25);g.userData.parts=parts;g.userData.kind=kind;g.userData.K=K;g.userData.animal=true;return g}
export function setFace(g,f){const F=g.userData.face;if(!F)return;const K=g.userData.K;
  const show=(m,v)=>{m.visible=!!v};
  for(const k in F.mouth)show(F.mouth[k],false);show(F.teeth,false);F.tears.forEach(t=>show(t,false));show(F.sweat,!!K.sweat);F.spiral.forEach(t=>show(t,false));
  F.pupils.forEach(p=>show(p,true));F.eyes.forEach(e=>{show(e,true);e.scale.set(.075,.085,.05)});F.pupils.forEach(p=>p.scale.set(.035,.04,.03));
  F.brows.forEach((b,i)=>{b.rotation.z=0;b.position.y=.31*1.4});
  if(K.mask||f==="sleep"){F.eyes.forEach(e=>show(e,K.mask?false:true));F.pupils.forEach(p=>show(p,false));F.eyes.forEach(e=>e.scale.set(.075,.015,.05));show(F.mouth.n,true);return}
  if(f==="scared"){F.eyes.forEach(e=>e.scale.set(.1,.12,.05));F.pupils.forEach(p=>p.scale.set(.025,.03,.03));show(F.mouth.open,true);F.brows.forEach((b,i)=>{b.position.y=.31*1.55;b.rotation.z=(i?1:-1)*.3})}
  else if(f==="dizzy"){F.pupils.forEach(p=>show(p,false));F.spiral.forEach(t=>show(t,true));show(F.mouth.frown,true);F.mouth.frown.rotation.z=.3}
  else if(f==="angry"){F.brows.forEach((b,i)=>{b.rotation.z=(i?.55:-.55);b.position.y=.31*1.25});show(F.mouth.frown,true);show(F.teeth,true);F.teeth.position.y=.31*.46}
  else if(f==="cry"){F.brows.forEach((b,i)=>{b.rotation.z=(i?-.4:.4);b.position.y=.31*1.5});show(F.mouth.open,true);F.tears.forEach(t=>show(t,true));F.eyes.forEach(e=>e.scale.set(.08,.05,.05))}
  else if(f==="laugh"){F.eyes.forEach(e=>e.scale.set(.075,.02,.05));show(F.mouth.laugh,true);show(F.teeth,true);F.teeth.position.y=.31*.58}
  else{show(K.angry?F.mouth.frown:F.mouth.smile,true);if(K.angry){F.brows.forEach((b,i)=>{b.rotation.z=(i?.5:-.5)})}}
}
/* الحركة: walk / run / idle / rag / carried / seated — t بالثواني */
export function pose(g,anim,t){const P=g.userData.parts;if(!P)return;
  if(g.userData.animal){const k=g.userData.kind;const w=anim==="walk"||anim==="rag"?Math.sin(t*10):0;for(const n in P){if(n.startsWith("leg"))P[n].rotation.x=w*(n.endsWith("1")?.6:-.6)}if(P.wingL){const f=anim==="rag"?Math.sin(t*25)*1.2:Math.sin(t*2)*.1;P.wingL.rotation.z=f;P.wingR.rotation.z=-f}if(P.tail)P.tail.rotation.y=Math.sin(t*3)*.2;return}
  const {armL,armR,legL,legR,torso,neck,head}=P;const propArm=P.propArm;
  const set=(o,x,y,z)=>{o.rotation.x=x;o.rotation.y=y;o.rotation.z=z};
  torso.position.y=.34;torso.rotation.set(0,0,0);neck.rotation.set(0,0,0);
  if(anim==="walk"||anim==="run"){const sp=anim==="run"?14:10,am=anim==="run"?1.1:.7;const s=Math.sin(t*sp);set(legL,s*am,0,0);set(legR,-s*am,0,0);set(armL,-s*am*.8,0,.12);if(!propArm)set(armR,s*am*.8,0,-.12);torso.position.y=.34+Math.abs(Math.cos(t*sp))*.04;neck.rotation.z=Math.sin(t*sp*.5)*.04}
  else if(anim==="rag"){const f=Math.sin(t*18);set(legL,.6+f*.4,0,.5);set(legR,-.4-f*.4,0,-.5);set(armL,-2.6+f*.3,0,.9);set(armR,-2.6-f*.3,0,-.9);neck.rotation.x=-.3}
  else if(anim==="carried"){set(legL,.3,0,.3);set(legR,.3,0,-.3);set(armL,-2.4,0,.4);set(armR,-2.4,0,-.4);neck.rotation.x=.4}
  else if(anim==="seated"){torso.position.y=.1;set(legL,-1.5,0,.05);set(legR,-1.5,0,-.05);set(armL,-.4,0,.3);if(!propArm)set(armR,-.4,0,-.3);neck.rotation.x=Math.sin(t*1.5)*.03}
  else{const b=Math.sin(t*2);set(legL,0,0,.04);set(legR,0,0,-.04);set(armL,b*.05,0,.15);if(!propArm)set(armR,-b*.05,0,-.15);torso.position.y=.34+b*.01;neck.rotation.y=Math.sin(t*.7)*.15}
}
