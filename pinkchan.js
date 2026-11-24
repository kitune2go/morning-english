/* ピンクちゃん：読み上げに合わせて口を動かすパーツ人形
   - モデルは assets/pinkchan/（PSDビルダーの .model.zip を展開したもの。model.json と parts/*.png）
   - 描画の仕組みは kitune2go-psd-builder の js/09-stage.js を移植（段の木・ワープ・髪の揺れ・まばたき・口）
   - ページ側の読み上げコードは変えない。speechSynthesis.speak / cancel を包んで、話している間だけ口を動かす
   - 端末が単語の区切り（boundary）を知らせてくれるときは単語ごとに口を開け、来ないときは揺らぎで近似する */
(function(){
'use strict';
if(window.__pinkchan)return;window.__pinkchan=true;
const BASE=(document.currentScript&&document.currentScript.src)?new URL('assets/pinkchan/',document.currentScript.src).href:'assets/pinkchan/';
const KEY='pinkchan-visible';
const store={get(){try{return localStorage.getItem(KEY)}catch(e){return null}},set(v){try{localStorage.setItem(KEY,v)}catch(e){}}};
const cl=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;

/* ---------- 画面の部品 ---------- */
const css=`
.pc-wrap{position:fixed;left:calc(10px + env(safe-area-inset-left));bottom:calc(10px + env(safe-area-inset-bottom));z-index:60;width:96px;height:108px;border-radius:18px;background:radial-gradient(circle at 50% 35%,#fff7fb 0,#fde4ef 70%,#f7cfe0 100%);box-shadow:0 4px 16px rgba(120,40,80,.22);overflow:hidden;transition:transform .25s ease,opacity .25s ease;touch-action:manipulation}
.pc-wrap canvas{width:100%;height:100%;display:block}
.pc-wrap.talking{box-shadow:0 0 0 3px rgba(226,90,150,.55),0 4px 16px rgba(120,40,80,.25)}
.pc-x{position:absolute;top:4px;right:4px;width:22px;height:22px;border:0;border-radius:50%;background:rgba(255,255,255,.85);color:#9a3d68;font:700 13px/22px sans-serif;padding:0;cursor:pointer}
.pc-tab{position:fixed;left:calc(10px + env(safe-area-inset-left));bottom:calc(10px + env(safe-area-inset-bottom));z-index:60;height:34px;padding:0 12px;border:0;border-radius:17px;background:#f7cfe0;color:#9a3d68;font:700 13px/34px sans-serif;box-shadow:0 3px 10px rgba(120,40,80,.2);cursor:pointer}
.pc-hide{display:none!important}
@media print{.pc-wrap,.pc-tab{display:none!important}}`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const wrap=document.createElement('div');wrap.className='pc-wrap';wrap.setAttribute('aria-hidden','true');
const cv=document.createElement('canvas');wrap.appendChild(cv);
const xb=document.createElement('button');xb.className='pc-x';xb.type='button';xb.textContent='×';xb.title='ピンクちゃんをしまう';wrap.appendChild(xb);
const tab=document.createElement('button');tab.className='pc-tab';tab.type='button';tab.textContent='ピンクちゃん';tab.title='ピンクちゃんを出す';
function setVisible(v){wrap.classList.toggle('pc-hide',!v);tab.classList.toggle('pc-hide',v);store.set(v?'1':'0');if(v)fit()}
xb.onclick=e=>{e.stopPropagation();setVisible(false)};tab.onclick=()=>setVisible(true);
// 本人をタップすると、手を振るように首をかしげる
wrap.onclick=()=>{poke=1.2};
function mount(){document.body.appendChild(wrap);document.body.appendChild(tab);setVisible(store.get()!=='0')}
const ctx=cv.getContext('2d');

/* ---------- 動きの状態 ---------- */
const P={ax:0,ay:0,az:0,bx:0,by:0,bz:0,arm:0,al:0,ar:0,ex:0,ey:0,xo:0,mf:0,br:0,ch:1};
const HS={front:{s:0,v:0},back:{s:0,v:0},bangs:{s:0,v:0}};
let W=768,H=768,G=null,L={},NODES=[],PARTNODE={},GLUE={},MAT={},SKIN='#fee3d5',ready=false;
let T=0,eoF=1,moF=0,moT=0,brth=0,nextB=2,bS=-9,poke=0,dpr=1,sc=1,ox=0,oy=0,box=null;
let manualUntil=0,talking=false,boundaryMode=false,pulse=0,jit=0,nextJit=0,talkStart=0;
const D25=.3;
const ORDER=['backHair','body','hairFront','armL','armR','head','cheek','eyeWL','irisL','lidL','eyeClosedL','lashL','eyeWR','irisR','lidR','eyeClosedR','lashR','browL','browR','mouthClosed','mouthOpen','mouthI','mouthU','bangs','acc'];
const DEPTH25={backHair:-.6,hairFront:-.4,body:-.15,armL:-.05,armR:-.05,head:0,cheek:.12,eyeWL:.22,irisL:.25,lidL:.22,eyeClosedL:.22,lashL:.26,eyeWR:.22,irisR:.25,lidR:.22,eyeClosedR:.22,lashR:.26,browL:.3,browR:.3,mouthClosed:.2,mouthOpen:.2,mouthI:.2,mouthU:.2,bangs:.55,acc:.15};
const HEADG=/^(head|cheek|eyeW|iris|lid|eyeClosed|lash|brow|mouth|bangs|acc|backHair|hairFront)/;

/* ---------- モデルの読み込み ---------- */
const loadImg=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error(src));i.src=src});
async function load(){
 const m=await (await fetch(BASE+'model.json')).json();
 if(m.format!=='psd-builder-model'||m.version>1)throw new Error('モデルの形式が違います');
 [W,H]=m.size;G=m.g;SKIN=m.skin||SKIN;
 await Promise.all(m.parts.map(async meta=>{try{L[meta.n]={...meta,img:await loadImg(BASE+'parts/'+meta.n+'.png')}}catch(e){}}));
 const j=m.rig;
 NODES=j.nodes.map(n=>({...n,pv:[n.pv[0]*W,n.pv[1]*H],rx:n.rx!=null?n.rx*W:undefined,ry:n.ry!=null?n.ry*H:undefined,depth:n.depth!=null?n.depth*W:undefined,sx:(n.sx||0)*W,sy:(n.sy||0)*H,drives:(n.drives||[]).map(d=>({...d}))}));
 for(const [id,p,a] of [['armL','al',22],['armR','ar',-22]]){const n=NB(id);if(n&&n.drives&&!n.drives.some(d=>d.p===p))n.drives.push({p,a})}
 for(const n of ORDER){if(!L[n])continue;const a=j.parts&&j.parts[n];PARTNODE[n]=a&&NB(a.node)?a.node:'root';GLUE[n]=!!(a&&a.glue)}
 // 胸から上を写す枠
 const De=G.De,top=L.bangs?L.bangs.y:G.eyeY-2*De;box={x:G.cx-2.35*De,y:top-.1*De,w:4.7*De,h:G.eyeY+2.9*De-(top-.1*De)};
 ready=true;fit();
}
const NB=id=>NODES.find(n=>n.id===id);
const chain=id=>{const o=[];let n=NB(id);while(n){o.unshift(n);n=NB(n.parent)}return o};
const pval=k=>k==='breath'?brth:k==='none'||!k?0:(P[k]||0);

/* ---------- 段の木（09-stage.js の移植） ---------- */
function computeMats(){MAT={};const done=new Set();const go=n=>{if(done.has(n.id))return;const par=n.parent&&NB(n.parent);if(par)go(par);
 const pm=par?MAT[par.id]:new DOMMatrix();let m=pm;
 if(n.type==='rot'){let deg=0;for(const d of n.drives||[])deg+=(P[d.p]||0)*(+d.a||0);m=pm.translate((n.sx||0)*P.ax,(n.sy||0)*P.ay+(n.breath?-brth*.006*G.De:0)).translate(n.pv[0],n.pv[1]).rotate(deg).scale(1,n.breath?1+brth*.004:1).translate(-n.pv[0],-n.pv[1])}
 MAT[n.id]=m;done.add(n.id)};NODES.forEach(go)}
function warpOff(nodeId,x,y,d){let ox=0,oy=0,any=false;for(const n of chain(nodeId)){if(n.type!=='warp')continue;const b0=Math.max(0,1-((x-n.pv[0])/n.rx)**2-((y-n.pv[1])/n.ry)**2),bs=n.base||0,b=b0>0?bs+(1-bs)*b0:0;const hx=pval(n.px||'ax'),hy=pval(n.py||'ay');if((n.px||'ax')==='ax')any=true;ox+=hx*n.depth*b;oy+=hy*n.depth*.7*b}if(any&&d){ox+=P.ax*d;oy+=P.ay*d*.6}return [ox,oy]}
const underWarp=id=>chain(id).some(n=>n.type==='warp');
function swayOff(p,x,y){if(!p.hair)return [0,0];const h=HS[p.hair];const root=p.hair==='bangs'?p.y+p.h*.25:G.eyeY,len=p.hair==='bangs'?p.h*.75:Math.max(1,p.y+p.h-G.eyeY);const t=cl((y-root)/len,0,1);const s=(h.s+Math.sin(T*1.6+x*.02)*.01*G.De*t)*t**1.5;return [s,-Math.abs(s)*.08*t]}
function depthOff(n){const z=DEPTH25[n];if(z==null)return [0,0];const De=G.De,hd=HEADG.test(n);return [z*De*D25*((hd?P.ax*.32:0)+P.bx*.18),z*De*D25*((hd?P.ay*.16:0)+P.by*.08)]}
function vtx(p,x,y){const id=PARTNODE[p.n]||'root',n=NB(id)||NODES[0];const w0=warpOff(id,x,y,p.d||0),s0=swayOff(p,x,y),z0=depthOff(p.n);const X=x+w0[0]+s0[0]+z0[0],Y=y+w0[1]+s0[1]+z0[1];let q=MAT[n.id].transformPoint({x:X,y:Y});
 if(GLUE[p.n]&&n.parent){const w=cl(1-(y-n.pv[1])/(2.2*G.De),0,1);const q2=MAT[n.parent].transformPoint({x:X,y:Y});q={x:lerp(q2.x,q.x,w),y:lerp(q2.y,q.y,w)}}return [q.x,q.y]}
const meshOf=p=>p.mesh||(!/^(eyeW|iris|lid|eyeClosed|mouth|lash|brow|cheek|acc)/.test(p.n)&&(underWarp(PARTNODE[p.n])||GLUE[p.n])&&p.w*p.h>(.6*G.De)**2?[6,6]:null);
function tri(img,A,B,D){const cx=(A[0]+B[0]+D[0])/3,cy=(A[1]+B[1]+D[1])/3;ctx.save();ctx.beginPath();for(const q of [A,B,D]){const vx=q[0]-cx,vy=q[1]-cy,l=Math.hypot(vx,vy)||1;ctx.lineTo(q[0]+vx/l*1.1/sc,q[1]+vy/l*1.1/sc)}ctx.closePath();ctx.clip();
 const [x0,y0,u0,v0]=A,[x1,y1,u1,v1]=B,[x2,y2,u2,v2]=D;const du1=u1-u0,dv1=v1-v0,du2=u2-u0,dv2=v2-v0,den=du1*dv2-du2*dv1;if(!den){ctx.restore();return}
 const dx1=x1-x0,dx2=x2-x0,dy1=y1-y0,dy2=y2-y0;const a=(dx1*dv2-dx2*dv1)/den,c=(du1*dx2-du2*dx1)/den,b=(dy1*dv2-dy2*dv1)/den,d=(du1*dy2-du2*dy1)/den;ctx.transform(a,b,c,d,x0-a*u0-c*v0,y0-b*u0-d*v0);ctx.drawImage(img,0,0);ctx.restore()}
function drawMesh(p,mesh){const [c,r]=mesh,V=[];for(let j=0;j<=r;j++)for(let i=0;i<=c;i++){const x=p.x+p.w*i/c,y=p.y+p.h*j/r,d=vtx(p,x,y);V.push([d[0],d[1],p.w*i/c,p.h*j/r])}const q=(i,j)=>V[j*(c+1)+i];
 for(let j=0;j<r;j++)for(let i=0;i<c;i++){tri(p.img,q(i,j),q(i+1,j),q(i,j+1));tri(p.img,q(i+1,j),q(i+1,j+1),q(i,j+1))}}
const TMP={};const tmp=(k,w,h)=>{let c=TMP[k];if(!c){c=TMP[k]=document.createElement('canvas')}if(c.width!==w||c.height!==h){c.width=w;c.height=h}return c};
function drawEye(s){const w=L['eyeW'+s],ir=L['iris'+s],lid=L['lid'+s],ce=L['eyeClosed'+s];if(!w||!ir)return;
 if(ce&&eoF<.4){ctx.drawImage(ce.img,ce.x,ce.y);return}
 const c=tmp('e'+s,w.w,w.h),g=c.getContext('2d');g.globalCompositeOperation='source-over';g.clearRect(0,0,w.w,w.h);g.drawImage(w.img,0,0);g.globalCompositeOperation='source-atop';g.drawImage(ir.img,ir.x-w.x+(P.ex*.096+P.ax*.02)*G.De,ir.y-w.y+(P.ey*.055+P.ay*.015)*G.De);g.globalCompositeOperation='source-over';ctx.drawImage(c,w.x,w.y);
 if(eoF<.98&&lid){const lc=tmp('l'+s,lid.w,lid.h),lg=lc.getContext('2d');lg.globalCompositeOperation='source-over';lg.clearRect(0,0,lid.w,lid.h);lg.drawImage(lid.img,0,0);lg.globalCompositeOperation='source-in';const top=w.y-lid.y,cut=top+(w.h+2)*(1-eoF)*.92;lg.fillStyle=SKIN;lg.fillRect(0,0,lid.w,eoF<.12?lid.h:cut);lg.globalCompositeOperation='source-over';ctx.drawImage(lc,lid.x,lid.y)}}
function drawLayer(p){const n=p.n;
 if(n==='eyeWL'){drawEye('L');return}if(n==='eyeWR'){drawEye('R');return}if(n.startsWith('iris')||n.startsWith('lid')||n.startsWith('eyeClosed'))return;
 if(n==='mouthClosed'||n==='mouthI'||n==='mouthU')return;
 if(p.kind==='lash'){const ce=L['eyeClosed'+n.slice(-1)];if(ce&&eoF<.4)return;ctx.translate(0,(1-eoF)*(p.eh||10)*.8);ctx.drawImage(p.img,p.x,p.y);return}
 if(p.kind==='brow'){ctx.translate(0,-P.br*.06*G.De);ctx.drawImage(p.img,p.x,p.y);return}
 if(p.kind==='cheek'){ctx.globalAlpha*=cl(P.ch,0,1);ctx.drawImage(p.img,p.x,p.y);return}
 if(n==='mouthOpen'){const a=cl(moF*3,0,1);if(a<.01)return;if(P.mf>.35&&L.mouthI)p=L.mouthI;else if(P.mf<-.35&&L.mouthU)p=L.mouthU;ctx.save();ctx.globalAlpha=a;const top=(p.top||p.y)+2;ctx.translate(0,top);ctx.scale(1,.35+.65*moF);ctx.translate(0,-top);ctx.drawImage(p.img,p.x,p.y);ctx.restore();return}
 ctx.drawImage(p.img,p.x,p.y)}
function fit(){if(!box)return;dpr=Math.min(2,window.devicePixelRatio||1);const w=wrap.clientWidth||96,h=wrap.clientHeight||108;cv.width=Math.max(1,w*dpr|0);cv.height=Math.max(1,h*dpr|0);sc=Math.max(w/box.w,h/box.h);ox=(w-box.w*sc)/2-box.x*sc;oy=(h-box.h*sc)-box.y*sc}
window.addEventListener('resize',fit);
function render(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);const k=dpr*sc;ctx.setTransform(k,0,0,k,dpr*ox,dpr*oy);
 computeMats();const base=ctx.getTransform();
 for(const n of ORDER){const p=L[n];if(!p)continue;const mesh=meshOf(p);ctx.save();
  if(mesh)drawMesh(p,mesh);else{const id=PARTNODE[n]||'root',nd=NB(id)||NODES[0];const pa=p.kind==='lash'&&L['eyeW'+n.slice(-1)]||p,cxp=pa.x+pa.w/2,cyp=pa.y+pa.h/2,o=warpOff(id,cxp,cyp,pa.d||0),z0=depthOff(p.kind==='lash'?'eyeW'+n.slice(-1):n);ctx.setTransform(base.multiply(MAT[nd.id]));ctx.translate(o[0]+z0[0],o[1]+z0[1]);drawLayer(p)}ctx.restore()}}

/* ---------- 動かし方 ---------- */
function step(dt){T+=dt;
 brth=Math.sin(T*2*Math.PI/3.6);
 // まばたき
 if(T>nextB){bS=T;nextB=T+2.2+Math.random()*3.2}const bt=(T-bS)/.16;eoF=bt<0||bt>2?1:bt<1?1-bt:bt-1;
 // ふだんの揺れ。話している間は少し大きく、相手を見るように
 const amp=talking?1:.6;
 const tAx=Math.sin(T*.7)*.18*amp+(talking?Math.sin(T*2.3)*.08:0),tAy=Math.sin(T*.53+1)*.12*amp-(talking?.05:0),tAz=Math.sin(T*.41+2)*.25*amp+poke*Math.sin(T*9)*.6;
 P.ax=lerp(P.ax,tAx,.08);P.ay=lerp(P.ay,tAy,.08);P.az=lerp(P.az,tAz,.1);P.bx=lerp(P.bx,Math.sin(T*.37)*.15,.05);P.bz=lerp(P.bz,Math.sin(T*.29+1)*.12,.05);
 P.ex=lerp(P.ex,Math.sin(T*.9)*.3,.05);P.ey=lerp(P.ey,Math.sin(T*.6+2)*.15,.05);P.br=lerp(P.br,talking?.25+.15*Math.sin(T*3):0,.1);
 P.ar=lerp(P.ar,poke>0?Math.sin(T*10)*.5:0,.15);poke=Math.max(0,poke-dt);
 // 口
 if(talking){if(boundaryMode){pulse=Math.max(0,pulse-dt*4.2);moT=cl(pulse*1.05+(pulse>0?.15:0),0,1)}
  else{if(T>nextJit){jit=Math.random()<.18?.05:.35+Math.random()*.65;nextJit=T+.07+Math.random()*.1;P.mf=(Math.random()-.5)*1.2}moT=jit}}
 else{moT=0;P.mf=lerp(P.mf,0,.2)}
 moF=lerp(moF,moT,talking?.45:.25);
 // 髪のばね
 for(const [k,h] of Object.entries(HS)){const tg=-(P.az*.5+P.ax*.3)*.08*G.De*(k==='bangs'?.4:1);h.v+=(tg-h.s)*.08;h.v*=.86;h.s+=h.v}
 wrap.classList.toggle('talking',talking);
}
let last=performance.now();
function loop(now){requestAnimationFrame(loop);if(!ready||document.hidden||wrap.classList.contains('pc-hide')){last=now;return}const raw=(now-last)/1000;if(raw<(talking?1/60:1/30)-.002)return;last=now;step(Math.min(.05,raw));render()}

/* ---------- 読み上げとつなぐ ---------- */
const SS=window.speechSynthesis;
function startTalk(){talking=true;talkStart=T;boundaryMode=false;pulse=.8}
function stopTalk(){talking=false}
if(SS&&!SS.__pinkchan){SS.__pinkchan=true;
 const speak0=SS.speak.bind(SS),cancel0=SS.cancel.bind(SS);
 SS.speak=function(u){try{
   u.addEventListener('start',startTalk);
   u.addEventListener('boundary',e=>{if(e.name&&e.name!=='word')return;boundaryMode=true;pulse=1});
   u.addEventListener('end',()=>{setTimeout(()=>{if(!SS.speaking&&!SS.pending)stopTalk()},120)});
   u.addEventListener('error',()=>{setTimeout(()=>{if(!SS.speaking)stopTalk()},120)});
  }catch(e){}return speak0(u)};
 SS.cancel=function(){stopTalk();return cancel0()};
 // end が来ない端末向けの見張り
 setInterval(()=>{if(talking&&!SS.speaking&&!SS.pending&&T>manualUntil)stopTalk();else if(!talking&&SS.speaking&&!SS.paused)startTalk()},400);
}
window.Pinkchan={state:()=>({talking,moF:+moF.toFixed(2),boundaryMode}),talk:(sec=3)=>{manualUntil=T+sec;startTalk()},stop:()=>{manualUntil=0;stopTalk()},show:()=>setVisible(true),hide:()=>setVisible(false)};
if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount);
load().then(()=>requestAnimationFrame(loop)).catch(e=>{console.warn('ピンクちゃんを読み込めませんでした',e);wrap.remove();tab.remove()});
})();
