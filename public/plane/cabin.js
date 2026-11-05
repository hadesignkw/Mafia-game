/* كابينة طيران الزفت: مبنية بالكود على رسومات ChatGPT (كريمي، كحلي، أصفر، أرضية خضرا مزرقة، شبابيك بيضاوية) */
import * as T from "./three.min.js";
export const C={cream:0xf2e8d5,cream2:0xe6dac3,navy:0x1f2d52,yellow:0xf2b134,teal:0x2a7a7a,teal2:0x3a8a8a,seat:0x2f4d8a,seat2:0x3b5ea8,red:0xd94c3d,sky:0x8ec5f0,grey:0x9a9aa0,dark:0x2b2b30};
const M=(c)=>new T.MeshLambertMaterial({color:c});
const B=(c)=>new T.MeshBasicMaterial({color:c});
export function box(w,h,d,c,x,y,z,parent,mat){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat||M(c));m.position.set(x,y,z);parent.add(m);return m}
function rbox(w,h,d,r,c,x,y,z,parent){ // صندوق بحواف مدورة (بالشكل)
  const sh=new T.Shape();const hw=w/2,hh=h/2;sh.moveTo(-hw+r,-hh);sh.lineTo(hw-r,-hh);sh.quadraticCurveTo(hw,-hh,hw,-hh+r);sh.lineTo(hw,hh-r);sh.quadraticCurveTo(hw,hh,hw-r,hh);sh.lineTo(-hw+r,hh);sh.quadraticCurveTo(-hw,hh,-hw,hh-r);sh.lineTo(-hw,-hh+r);sh.quadraticCurveTo(-hw,-hh,-hw+r,-hh);
  const g=new T.ExtrudeGeometry(sh,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);const m=new T.Mesh(g,M(c));m.position.set(x,y,z);parent.add(m);return m}
function oval(w,h,c,x,y,z,parent,mat,flat){const g=new T.CylinderGeometry(1,1,.04,24);const m=new T.Mesh(g,mat||M(c));if(flat){m.scale.set(w/2,1,h/2)}else{m.scale.set(h/2,1,w/2);m.rotation.z=Math.PI/2}m.position.set(x,y,z);parent.add(m);return m}
export function mkLabelTex(text,bg,fg,w=256,h=96,font="700 44px 'Readex Pro',Tahoma,sans-serif"){const cv=document.createElement("canvas");cv.width=w;cv.height=h;const x=cv.getContext("2d");x.fillStyle=bg;x.beginPath();x.roundRect(0,0,w,h,18);x.fill();x.fillStyle=fg;x.font=font;x.textAlign="center";x.textBaseline="middle";x.direction="rtl";x.fillText(text,w/2,h/2,w-16);const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;return t}
export function mkSeat(x,z,parent,pilot){const g=new T.Group();g.position.set(x,0,z);
  const c=pilot?C.navy:C.seat;
  rbox(.62,.16,.6,.06,C.cream,0,.44,0,g);                       // القاعدة الكريمية
  rbox(.58,.12,.5,.05,c,0,.54,0,g);                             // الوسادة
  const back=rbox(.6,.8,.16,.08,c,0,.85,.24,g);back.rotation.x=-.12; // الظهر
  rbox(.5,.18,.12,.05,C.cream,0,1.2,.27,g);                      // مسند الراس
  for(const s of[-1,1]){rbox(.08,.1,.5,.03,C.cream,s*.32,.68,.02,g);box(.06,.08,.3,C.yellow,s*.32,.74,.02,g)} // أيدي
  for(const s of[-1,1])box(.08,.36,.08,C.cream2,s*.2,.18,0,g);
  box(.5,.03,.06,C.yellow,0,.52,-.24,g);
  if(pilot)g.rotation.y=Math.PI;parent.add(g);return g}
export function buildCabin(cabin,CAB,SEATS,PILOT){
  const L=CAB.z1-CAB.z0,zc=(CAB.z0+CAB.z1)/2,hw=CAB.w/2,H=CAB.h;
  // الأرضية
  box(CAB.w,.1,L,C.teal,0,-.05,zc,cabin);
  for(const s of[-1,1])box(.12,.012,L,C.yellow,s*2.0,.006,zc,cabin);          // خطوط الممر
  // الجدران: كريمي، قاعدة كحلية، خط أصفر
  for(const side of[-1,1]){
    for(let z=CAB.z0;z<CAB.z1;z+=1){const isDoor=side<0&&z>=CAB.door.z0-.2&&z<CAB.door.z1-.2;if(isDoor)continue;
      box(.14,H,1.02,C.cream,side*(hw+.07),H/2,z+.5,cabin);
      box(.16,.5,1.02,C.navy,side*(hw+.07),.25,z+.5,cabin);box(.17,.05,1.02,C.yellow,side*(hw+.07),.52,z+.5,cabin);
      // شباك بيضاوي بين كل صفين
      if(Math.floor(z)%2===0&&z>CAB.z0+1&&z<CAB.z1-3){const wx=side*(hw-.01);oval(.62,.92,C.cream2,wx,1.5,z+.5,cabin);oval(.46,.74,0,wx-side*.035,1.5,z+.5,cabin,B(C.sky));
        const cl=oval(.18,.1,0,wx-side*.05,1.42,z+.4,cabin,B(0xffffff));box(.05,.04,.14,C.yellow,wx+side*.04,1.86,z+.5,cabin)}}
    if(side<0){const dz=(CAB.door.z0+CAB.door.z1)/2,dw=CAB.door.z1-CAB.door.z0;
      box(.14,H-2.05,dw+.2,C.cream,side*(hw+.07),2.05+(H-2.05)/2,dz,cabin);
      // إطار الباب الأحمر المقوس
      box(.12,2.1,.12,C.red,side*(hw+.06),1.05,CAB.door.z0-.26,cabin);box(.12,2.1,.12,C.red,side*(hw+.06),1.05,CAB.door.z1-.14,cabin);box(.12,.14,dw+.3,C.red,side*(hw+.06),2.08,dz,cabin);
      // الباب نفسه مفتوح برا
      const door=rbox(dw-.1,2.0,.1,.12,C.red,0,1.0,0,cabin);door.position.set(side*(hw+.5),1.0,CAB.door.z1-.1);door.rotation.y=Math.PI/2+.9;box(.03,.08,.5,C.yellow,0,0,0,door);
      box(.14,.1,dw+.2,C.teal,side*(hw+.07),.0,dz,cabin)}
    // الرفوف العلوية (كريمي مع يد صفرا)
    for(let z=CAB.z0+4;z<CAB.z1-3;z+=2.2){const bx=side*(hw-.55);const b=rbox(.95,.5,2.0,.12,C.cream,bx,H-.42,z,cabin);b.rotation.y=Math.PI/2;b.rotation.x=0;
      box(.2,.05,.3,C.yellow,bx-side*.5,H-.6,z,cabin);box(.98,.04,2.0,C.navy,bx,H-.15,z,cabin)}
  }
  // السقف: كريمي، شريط كحلي بالنص فيه لمبات
  box(CAB.w,.1,L,C.cream,0,H,zc,cabin);box(2.6,.04,L,C.navy,0,H-.05,zc,cabin);
  for(let z=CAB.z0+2;z<CAB.z1;z+=2.5)oval(.5,.9,0,0,H-.08,z,cabin,B(0xfff1c2),true);
  // الجدار الخلفي + المطبخ (يسار) + الحمام (يمين)
  box(CAB.w,H,.15,C.cream,0,H/2,CAB.z1+.07,cabin);box(CAB.w,.5,.17,C.navy,0,.25,CAB.z1+.07,cabin);
  // الحمام
  box(.1,H,2.2,C.cream,2.3,H/2,CAB.z1-1.1,cabin);box(1.3,H,.1,C.cream,3.6,H/2,CAB.z1-2.2,cabin);
  const bd=rbox(.8,1.9,.08,.3,C.cream2,2.9,1.0,CAB.z1-2.24,cabin);box(.6,1.5,.02,C.cream,2.9,1.0,CAB.z1-2.29,cabin);
  const occ=new T.Mesh(new T.PlaneGeometry(.42,.14),new T.MeshBasicMaterial({map:mkLabelTex("مشغول",'#d94c3d','#fff',256,80)}));occ.position.set(2.9,1.65,CAB.z1-2.3);occ.rotation.y=Math.PI;cabin.add(occ);
  box(.05,.14,.05,C.grey,2.6,1.0,CAB.z1-2.3,cabin);
  // المطبخ على اليسار ورا
  box(1.6,.9,.6,C.navy,-3.5,.45,CAB.z1-.4,cabin);box(1.7,.08,.7,C.cream,-3.5,.94,CAB.z1-.4,cabin);box(1.6,.6,.3,C.cream,-3.5,2.1,CAB.z1-.15,cabin);
  for(let i=0;i<3;i++)box(.1,.22,.1,[C.yellow,C.teal,C.red][i],-3.9+i*.3,1.09,CAB.z1-.45,cabin);
  // الكابينة قدام: جدار كحلي، زجاج مقسم، كونسول ملون، كرسيين
  box(CAB.w,H,.15,C.cream,0,H/2,CAB.z0-.07,cabin);box(CAB.w,.9,.17,C.navy,0,.45,CAB.z0-.07,cabin);box(CAB.w,.06,.18,C.yellow,0,.92,CAB.z0-.07,cabin);
  for(let i=-1;i<=1;i++){const g=new T.Mesh(new T.PlaneGeometry(1.5,1.0),B(C.sky));g.position.set(i*1.65,1.75,CAB.z0+.01);cabin.add(g);box(.08,1.1,.03,C.cream2,i*1.65+.8,1.75,CAB.z0+.015,cabin)}
  for(const s of[-1,1]){const cl=oval(.5,.28,0,s*1.2+.3,1.9,CAB.z0+.02,cabin,B(0xffffff),true);cl.rotation.x=Math.PI/2}
  const con=rbox(4.6,.5,.7,.1,C.navy,0,.9,CAB.z0+.5,cabin);con.rotation.x=-.3;
  const cols=[C.red,C.yellow,0x3bb273,C.teal2,0xf08a2a];for(let i=0;i<14;i++)for(let r=0;r<2;r++){const bt=box(.14,.05,.12,cols[(i+r)%5],-2.0+i*.31,1.14-r*.12,CAB.z0+.35+r*.22,cabin);bt.rotation.x=-.3}
  const scr=box(.8,.4,.04,0,0,1.22,CAB.z0+.3,cabin,B(C.teal2));scr.rotation.x=-.3;
  for(const s of[-1,1]){box(.05,.3,.05,C.grey,s*.35,1.2,CAB.z0+.72,cabin);const kn=new T.Mesh(new T.SphereGeometry(.06,10,8),M(C.red));kn.position.set(s*.35,1.36,CAB.z0+.72);cabin.add(kn)}
  mkSeat(PILOT.x,PILOT.z,cabin,true);mkSeat(PILOT.x+1.3,PILOT.z,cabin,true);
  for(const s of SEATS)mkSeat(s.x,s.z,cabin,false);
}
/* الأغراض: شنط ودفل وقدر وصناديق */
export const PROP_KINDS=["case_navy","case_yellow","case_teal","duffel","pot","crate_croc","crate_sheep","ext","plunger"];
export function makeProp(kind){const g=new T.Group();
  if(kind.startsWith("case")){const c={case_navy:C.navy,case_yellow:C.yellow,case_teal:C.teal2}[kind];rbox(.36,.44,.22,.05,c,0,.22,0,g);box(.3,.02,.2,C.cream,0,.1,0,g);box(.3,.02,.2,C.cream,0,.34,0,g);box(.16,.05,.06,C.cream,0,.47,0,g);for(const s of[-1,1])box(.06,.06,.06,C.dark,s*.13,.03,.07,g);g.userData.box=[.36,.44,.22]}
  else if(kind==="duffel"){const m=new T.Mesh(new T.CapsuleGeometry(.14,.3,4,10),M(0x6a3a8a));m.rotation.z=Math.PI/2;m.position.y=.14;g.add(m);box(.2,.03,.06,C.cream,0,.3,0,g);g.userData.box=[.58,.28,.28]}
  else if(kind==="pot"){const p=new T.Mesh(new T.CylinderGeometry(.22,.2,.26,16),M(C.navy));p.position.y=.13;g.add(p);const lid=new T.Mesh(new T.CylinderGeometry(.23,.23,.04,16),M(C.grey));lid.position.y=.28;g.add(lid);const kn=new T.Mesh(new T.SphereGeometry(.04,8,6),M(C.dark));kn.position.y=.32;g.add(kn);for(const s of[-1,1])box(.08,.04,.03,C.grey,s*.25,.2,0,g);g.userData.box=[.5,.34,.44]}
  else if(kind==="crate_croc"){rbox(.5,.4,.36,.04,C.navy,0,.2,0,g);const lb=new T.Mesh(new T.PlaneGeometry(.34,.14),new T.MeshBasicMaterial({map:mkLabelTex("أكيد مو تمساح",'#f2e8d5','#1f2d52',256,96,"700 40px 'Readex Pro',Tahoma,sans-serif")}));lb.position.set(0,.2,.185);g.add(lb);for(const s of[-1,1])box(.52,.03,.38,C.grey,0,.2+s*.15,0,g);g.userData.box=[.5,.4,.36]}
  else if(kind==="crate_sheep"){for(let i=0;i<4;i++){box(.5,.06,.02,0xc9a26a,0,.06+i*.11,.18,g);box(.5,.06,.02,0xc9a26a,0,.06+i*.11,-.18,g)}box(.5,.42,.34,0xe8d7b8,0,.21,0,g).scale.set(.96,1,.9);box(.02,.42,.36,0xc9a26a,.25,.21,0,g);box(.02,.42,.36,0xc9a26a,-.25,.21,0,g);g.userData.box=[.5,.42,.36]}
  else if(kind==="ext"){const b=new T.Mesh(new T.CylinderGeometry(.08,.08,.4,12),M(C.red));b.position.y=.2;g.add(b);box(.06,.06,.06,C.dark,0,.44,0,g);box(.03,.12,.03,C.grey,.06,.42,0,g);g.userData.box=[.16,.46,.16]}
  else{const st=new T.Mesh(new T.CylinderGeometry(.015,.015,.4,6),M(0xc9a26a));st.position.y=.3;g.add(st);const cup=new T.Mesh(new T.SphereGeometry(.1,10,8,0,Math.PI*2,0,Math.PI/2),M(C.red));cup.rotation.x=Math.PI;cup.position.y=.1;g.add(cup);g.userData.box=[.2,.5,.2]}
  return g}
