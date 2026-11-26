/* 寸劇モード：本文の横でキャラが寸劇を始め、放っておくと増えて画面を埋め、学習の邪魔をする演出
   - 本文（index.html）のコードには手を入れない。DOMを見てカードの切り替え・音読・読み上げを拾う
   - キャラ・演出の設定は skit/config.json、台本は skit/scripts/*.json（カード別は skit/cards/<No>.json）
   - キャラを足すときは config.json の characters に1件足すだけ。台本の書き方は skit/README.md
   - ピンクちゃんの分身は pinkchan.js の描画をそのまま写す（同じ体を共有しているので口や瞬きは揃う） */
(function(){
'use strict';
if(window.__skit)return;window.__skit=true;
const BASE=(document.currentScript&&document.currentScript.src)?new URL('./',document.currentScript.src).href:'skit/';
const KEY='skit-mode';
const LIT=!!document.getElementById('workSelect');
let activeArticle=null, cardLoadVersion=0, loadingCard=false;
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- 見た目 ---------- */
const css=`
.sk-layer{position:absolute;left:0;top:0;width:0;height:0;z-index:55;pointer-events:none}
.sk-actor{position:absolute;pointer-events:auto;touch-action:manipulation;transition:left var(--sk-mv,.6s) ease-in-out,top var(--sk-mv,.6s) ease-in-out,opacity .3s ease;will-change:left,top}
.sk-actor>.sk-body{width:100%;height:100%;transform-origin:50% 100%}
.sk-actor canvas{-webkit-mask-image:linear-gradient(#000 82%,transparent);mask-image:linear-gradient(#000 82%,transparent)}
.sk-actor canvas,.sk-actor img{width:100%;height:100%;display:block;pointer-events:none;-webkit-user-drag:none;user-select:none}
.sk-actor.flip>.sk-body>*{transform:scaleX(-1)}
.sk-enter>.sk-body{animation:sk-pop .35s cubic-bezier(.3,1.6,.5,1) both}
.sk-bounce>.sk-body{animation:sk-bounce .5s ease 2}
.sk-shake>.sk-body{animation:sk-shake .4s linear 2}
.sk-spin>.sk-body{animation:sk-spin .7s ease}
.sk-hop>.sk-body{animation:sk-hop .45s ease 3}
.sk-wobble>.sk-body{animation:sk-wobble 1.2s ease-in-out infinite}
.sk-sleep>.sk-body{animation:sk-sleep 2.4s ease-in-out infinite}
.sk-poke>.sk-body{animation:sk-poke .35s ease 3}
.sk-exit{opacity:0!important}.sk-exit>.sk-body{animation:sk-out .45s ease-in both}
@keyframes sk-pop{from{transform:scale(.1) translateY(30%)}to{transform:none}}
@keyframes sk-bounce{0%,100%{transform:none}40%{transform:translateY(-18%) scaleY(1.05)}60%{transform:translateY(0) scaleY(.92)}}
@keyframes sk-shake{0%,100%{transform:none}25%{transform:translateX(-6%) rotate(-4deg)}75%{transform:translateX(6%) rotate(4deg)}}
@keyframes sk-spin{to{transform:rotate(360deg)}}
@keyframes sk-hop{0%,100%{transform:none}50%{transform:translateY(-25%)}}
@keyframes sk-wobble{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes sk-sleep{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.95)}}
@keyframes sk-poke{0%,100%{transform:none}50%{transform:translateX(-10%) rotate(-8deg)}}
@keyframes sk-out{to{transform:translateY(-40%) scale(.3) rotate(25deg)}}
.sk-bubble{position:absolute;width:max-content;max-width:min(240px,70vw);padding:7px 11px;border-radius:14px;background:#fff;color:#2a0b18;border:2px solid var(--sk-c,#ff8fbf);font:700 14px/1.45 system-ui,-apple-system,"Hiragino Sans",sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.15);pointer-events:none;opacity:0;transform:translateY(6px) scale(.9);transition:opacity .18s ease,transform .18s ease;white-space:pre-wrap;z-index:2}
.sk-bubble.on{opacity:1;transform:none}
.sk-bubble.shout{font-size:18px;background:#fff1f6}
.sk-bubble.whisper{font-weight:500;font-size:12px;opacity:.85;border-style:dashed}
.sk-stop{position:fixed;right:calc(10px + env(safe-area-inset-right));bottom:calc(10px + env(safe-area-inset-bottom));z-index:200;min-height:40px;padding:0 14px;border:2px solid #1c1917;border-radius:20px;background:#1c1917;color:#FEF3C7;font:700 13px/36px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}
.sk-hide{display:none!important}
.sk-toggle[aria-pressed="true"]{background:#be185d;color:#fff;border-color:#be185d}
@media (prefers-reduced-motion:reduce){.sk-actor{transition:none}.sk-actor>.sk-body{animation:none!important}}
@media print{.sk-layer,.sk-stop,.sk-toggle{display:none!important}}`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const layer=document.createElement('div');layer.className='sk-layer';layer.setAttribute('aria-hidden','true');
const stopBtn=document.createElement('button');stopBtn.type='button';stopBtn.className='sk-stop sk-hide';stopBtn.textContent='📖 勉強に戻る';
const toggle=document.createElement('button');toggle.type='button';toggle.className='btn sk-toggle';
const voiceToggle=document.createElement('button');voiceToggle.type='button';voiceToggle.className='btn sk-toggle';

/* ---------- 状態 ---------- */
let CFG=null,CHARS={},SCENES=[],CARD_SCENES=[],enabled=false;
try{enabled=localStorage.getItem(KEY)==='1'}catch(e){}
const actors=new Map();     // id -> {id,char,el,body,canvas,x,y,w,h}
let runToken=0,running=null,queue=[],cardNo=null,cardInfo={},clock0=0,firedIdle=new Set(),cooldownUntil=0,playedOnce=new Set();

/* ---------- 設定と台本の読み込み ---------- */
async function getJson(path){const r=await fetch(new URL(path,BASE).href,{cache:'no-cache'});if(!r.ok)throw new Error(path+' '+r.status);return r.json()}
async function loadAll(){
 CFG=await getJson('config.json');
 CHARS={};for(const c of CFG.characters||[])CHARS[c.id]=c;
 SCENES=[];for(const p of CFG.scripts||[]){try{const s=await getJson(p);for(const sc of s.scenes||[])SCENES.push({...sc,_src:p})}catch(e){console.warn('寸劇の台本を読めませんでした',p,e)}}
}
async function loadCardScenes(no){
 const version=++cardLoadVersion;CARD_SCENES=[];if(!CFG||!CFG.perCard||no==null)return;
 try{const s=await getJson(CFG.perCard.replace('{no}',encodeURIComponent(no)));if(version===cardLoadVersion)CARD_SCENES=(s.scenes||[]).map(sc=>({...sc,_src:'card'}))}catch(e){/* カード別の台本は無くてよい */}
}

/* ---------- 本文から拾う情報（台本の {coreVerb} などに入る） ---------- */
function literatureArticle(){
 const cards=[...document.querySelectorAll('#content article.card[id^="card-"]')];
 if(!cards.length)return null;
 const target=innerHeight*.35;
 return cards.reduce((best,el)=>{const distance=e=>{const r=e.getBoundingClientRect();return Math.max(r.top-target,target-r.bottom,0)};return distance(el)<distance(best)?el:best},cards[0]);
}
function readCard(){
 if(LIT){activeArticle=literatureArticle();if(!activeArticle)return {no:null,sentence:''};const get=sel=>(activeArticle.querySelector(sel)?.textContent||'').trim();const sent=get('.en-main'),words=sent.match(/[A-Za-z][A-Za-z’'-]+/g)||[],long=words.filter(w=>w.length>=6);return {no:activeArticle.id.slice(5),sentence:sent,theme:get('.title'),coreVerb:'',word:pick(long.length?long:words.length?words:['English']),firstWords:words.slice(0,3).join(' '),trans:get('.jp')};}

 const sent=(document.querySelector('.hero-sentence')||{}).textContent||'';
 const tag=((document.querySelector('.hero .tag-mini.gray')||{}).textContent||'').split('·').map(s=>s.trim());
 const words=sent.match(/[A-Za-z][A-Za-z'’-]+/g)||[];
 const long=words.filter(w=>w.length>=6);
 const no=((document.getElementById('numInfo')||{}).textContent||'').replace(/^No\./,'').trim();
 return{no,sentence:sent,theme:tag[0]||'',coreVerb:tag[1]||'',word:(long.length?pick(long):pick(words.length?words:['English'])),firstWords:words.slice(0,3).join(' '),trans:((document.querySelector('.hero-trans')||{}).textContent||'').trim()};
}
const fill=t=>String(t).replace(/\{(\w+)\}/g,(m,k)=>cardInfo[k]!=null&&cardInfo[k]!==''?cardInfo[k]:m==='{word}'?'これ':'');

/* ---------- 立ち位置 ---------- */
function textRect(){const el=(LIT&&activeArticle?.querySelector('.en-main'))||document.querySelector('.hero-sentence')||document.querySelector('.hero')||document.getElementById('content');
 if(!el)return{left:20,top:scrollY+120,width:innerWidth-40,height:120};const r=el.getBoundingClientRect();return{left:r.left+scrollX,top:r.top+scrollY,width:r.width,height:r.height}}
function viewRect(){const w=document.documentElement.clientWidth||innerWidth;return{left:scrollX,top:scrollY,width:w,height:innerHeight}}
function place(at,w,h){
 const t=textRect(),v=viewRect(),pad=6;let x,y;
 switch(at){
  case 'textRight':x=t.left+t.width-w*.55;y=t.top+t.height/2-h*.6;break;
  case 'textLeft':x=t.left-w*.45;y=t.top+t.height/2-h*.6;break;
  case 'textTop':x=t.left+rnd(.1,.7)*t.width;y=t.top-h*.85;break;
  case 'textBottom':x=t.left+rnd(.1,.7)*t.width;y=t.top+t.height-h*.3;break;
  case 'overText':x=t.left+rnd(0,1)*(t.width-w);y=t.top+rnd(-.2,.6)*t.height;break;
  case 'edgeLeft':x=v.left-w*.2;y=v.top+rnd(.3,.75)*v.height;break;
  case 'edgeRight':x=v.left+v.width-w*.8;y=v.top+rnd(.3,.75)*v.height;break;
  case 'offLeft':x=v.left-w*1.2;y=t.top+t.height/2-h/2;break;
  case 'offRight':x=v.left+v.width+w*.2;y=t.top+t.height/2-h/2;break;
  case 'screen':x=v.left+rnd(0,1)*(v.width-w);y=v.top+rnd(0,1)*(v.height-h);break;
  default:x=v.left+rnd(0,1)*(v.width-w);y=v.top+rnd(.1,.9)*(v.height-h);
 }
 if(!/^off/.test(at))x=cl(x,v.left-w*.3,v.left+v.width-w*.7);
 return{x,y:Math.max(pad,y)};
}

/* ---------- 役者 ---------- */
function charOf(id,explicit){if(explicit&&CHARS[explicit])return CHARS[explicit];if(CHARS[id])return CHARS[id];
 const ks=Object.keys(CHARS).filter(k=>id.startsWith(k)).sort((a,b)=>b.length-a.length);return ks.length?CHARS[ks[0]]:null}
function newId(base){let i=2;while(actors.has(base+i))i++;return base+i}
function enter(id,o={}){
 if(actors.has(id))return actors.get(id);
 if(actors.size>=(CFG.maxActors||30))return null;
 const ch=charOf(id,o.char);if(!ch){console.warn('寸劇：知らないキャラ',id);return null}
 const scale=o.scale||rnd(ch.scaleRange?ch.scaleRange[0]:1,ch.scaleRange?ch.scaleRange[1]:1);
 const w=Math.round((ch.size||100)*scale),h=Math.round(w*(ch.aspect||1));
 const el=document.createElement('div');el.className='sk-actor sk-enter';el.dataset.id=id;el.style.width=w+'px';el.style.height=h+'px';
 const body=document.createElement('div');body.className='sk-body';el.appendChild(body);
 let canvas=null;
 if(ch.type==='pinkchan-mirror'){canvas=document.createElement('canvas');const k=Math.min(actors.size>8?1.25:2,devicePixelRatio||1);canvas.width=Math.round(w*k);canvas.height=Math.round(h*k);body.appendChild(canvas)}
 else if(ch.type==='image'){const img=document.createElement('img');img.src=new URL(ch.src,BASE).href;img.alt='';img.draggable=false;body.appendChild(img)}
 else{body.textContent=ch.emoji||'?';body.style.font=Math.round(h*.8)+'px/1 sans-serif'}
 if(ch.filter)body.style.filter=ch.filter;
 if(o.tint)body.style.filter=(body.style.filter+' hue-rotate('+o.tint+'deg)').trim();
 if(o.flip||(o.flip==null&&Math.random()<(ch.flipChance||0)))el.classList.add('flip');
 const p=o.at==='keep'&&o.pos?o.pos:place(o.at||ch.defaultAt||'textRight',w,h);
 el.style.left=p.x+'px';el.style.top=p.y+'px';
 const a={id,char:ch,el,body,canvas,x:p.x,y:p.y,w,h};actors.set(id,a);layer.appendChild(el);
 setTimeout(()=>el.classList.remove('sk-enter'),400);
 el.addEventListener('click',e=>{e.stopPropagation();if(CFG.tapToPop!==false)pop(id)});
 syncStop();return a;
}
function exit(id,quick){const a=actors.get(id);if(!a)return;actors.delete(id);a.el.classList.add('sk-exit');setTimeout(()=>a.el.remove(),quick?250:480);syncStop()}
function exitAll(quick){for(const id of [...actors.keys()])exit(id,quick)}
function pop(id){const a=actors.get(id);if(!a)return;const line=a.char.popLines&&a.char.popLines.length?pick(a.char.popLines):null;if(line)void sayLine(a,fill(line),{dur:900});setTimeout(()=>exit(id),line?350:0)}
function move(a,at,sec){const p=place(at,a.w,a.h);a.el.style.setProperty('--sk-mv',(sec||.6)+'s');a.x=p.x;a.y=p.y;a.el.style.left=p.x+'px';a.el.style.top=p.y+'px';
 if(at==='offRight'||at==='edgeRight')a.el.classList.remove('flip');else if(at==='offLeft'||at==='edgeLeft')a.el.classList.add('flip')}
function act(a,name){const cls='sk-'+name;if(name==='flip'){a.el.classList.toggle('flip');return}
 if(name==='still'){for(const c of [...a.el.classList])if(/^sk-(wobble|sleep)$/.test(c))a.el.classList.remove(c);return}
 a.el.classList.remove(cls);void a.el.offsetWidth;a.el.classList.add(cls);
 if(!/^(wobble|sleep)$/.test(name))setTimeout(()=>a.el.classList.remove(cls),1600)}

/* ---------- 寸劇の音声（本文を優先） ---------- */
const SS=window.speechSynthesis, voiceSupported=!!(SS&&window.SpeechSynthesisUtterance);
let voiceEnabled=true, ownSpeech=null, studyUntil=0, externalSpeech=null, voiceStatus='未確認';
const voiceTest=document.createElement('button');voiceTest.type='button';voiceTest.className='btn sk-toggle';voiceTest.textContent='🔈 音声テスト';
const voiceInfo=document.createElement('span');voiceInfo.setAttribute('role','status');voiceInfo.style.cssText='font-size:11px;max-width:100%;overflow-wrap:anywhere';
function reportVoice(status){voiceStatus=status;voiceInfo.textContent='寸劇音声：'+status;}
try{voiceEnabled=localStorage.getItem('skit-voice')!=='0'}catch(e){}
const ownUtterances=new WeakSet();
function renderVoice(){voiceToggle.textContent='🔊 寸劇音声：'+(voiceEnabled?'オン':'オフ');voiceToggle.setAttribute('aria-pressed',String(voiceEnabled));voiceToggle.disabled=!voiceSupported;voiceToggle.title=voiceSupported?'寸劇だけの音声を切り替え':'この端末は音声合成に非対応'}
function stopSkitVoice(){const own=ownSpeech;if(!own)return;own.finish();if(!externalSpeech&&SS)SS.cancel()}
function yieldToStudy(){studyUntil=performance.now()+900;stopSkitVoice()}
function speakLine(a,text,test=false){
 if(!voiceSupported||!voiceEnabled||(!test&&!enabled)||a.char.canSpeak===false||!text.trim()||externalSpeech||(!test&&performance.now()<studyUntil)||SS.speaking||SS.pending)return null;
 const v=a.char.voice||{},u=new SpeechSynthesisUtterance(text),jp=/[\u3040-\u30ff\u4e00-\u9fff]/.test(text);
 u.lang=v.lang||(jp?'ja-JP':'en-US');u.rate=cl(Number(v.rate)||1.05,.5,2);
 const n=Number(a.id.match(/\d+$/)?.[0]||1);u.pitch=cl((Number(v.pitch)||1.15)+((n-1)%5-2)*.07,0,2);u.volume=cl(v.volume==null?.85:Number(v.volume),0,1);
 const voices=SS.getVoices(),normalize=x=>String(x||'').toLowerCase().replace(/_/g,'-'),lang=normalize(u.lang);
 const chosen=voices.find(x=>v.name&&x.name===v.name&&normalize(x.lang).startsWith(lang.split('-')[0]))||voices.find(x=>normalize(x.lang)===lang)||voices.find(x=>normalize(x.lang).startsWith(lang.split('-')[0]));if(chosen)u.voice=chosen;
 ownUtterances.add(u);
 return new Promise(resolve=>{let timer,finished=false;
 const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);if(ownSpeech?.u===u)ownSpeech=null;resolve()};
 ownSpeech={u,finish};reportVoice('再生要求');u.addEventListener('start',()=>reportVoice('再生中'),{once:true});u.addEventListener('end',()=>{if(ownSpeech?.u===u)reportVoice('再生完了');finish()},{once:true});u.addEventListener('error',e=>{if(ownSpeech?.u===u)reportVoice('失敗：'+(e.error||'unknown'));finish()},{once:true});
 timer=setTimeout(()=>{if(ownSpeech?.u===u){reportVoice('応答なし／タイムアウト');stopSkitVoice()}else finish()},Math.max(8000,text.length*260+4000));
 try{SS.speak(u)}catch(e){reportVoice('例外：'+e.message);finish()}
 });
}
function installSpeechPriority(){if(!voiceSupported)return;
 const speak=SS.speak.bind(SS),cancel=SS.cancel.bind(SS);
 SS.speak=function(u){if(!ownUtterances.has(u)){yieldToStudy();externalSpeech=u;const done=e=>{if(externalSpeech===u){externalSpeech=null;studyUntil=performance.now()+500;if(e?.type==='end'&&!LIT&&CFG&&(CFG.dismissOn||[]).includes('speechEnd'))dismiss('speechEnd')}};u.addEventListener('end',done,{once:true});u.addEventListener('error',done,{once:true});try{return speak(u)}catch(e){done();throw e}}return speak(u)};
 SS.cancel=function(){const own=ownSpeech;if(own)own.finish();externalSpeech=null;return cancel()};
}
function testVoice(){if(!voiceSupported){reportVoice('非対応');return}if(externalSpeech||(SS.speaking&&!ownSpeech)||(SS.pending&&!ownSpeech)){reportVoice('本文読み上げ中');return}stopSkitVoice();if(!voiceEnabled){voiceEnabled=true;try{localStorage.setItem('skit-voice','1')}catch(e){}renderVoice()}const a={id:'pink',char:CHARS.pink||{}};const result=speakLine(a,'ピンクちゃんです。寸劇の音声テストです。',true);if(!result)reportVoice('再生できません：音声エンジン使用中');}
voiceTest.onclick=testVoice;
voiceToggle.onclick=()=>{voiceEnabled=!voiceEnabled;try{localStorage.setItem('skit-voice',voiceEnabled?'1':'0')}catch(e){}if(!voiceEnabled){stopSkitVoice();reportVoice('消音')}renderVoice();if(voiceEnabled)testVoice()};
async function sayLine(a,text,o={}){if(!a)return;const audio=speakLine(a,text);const display=bubble(a,text,{...o,audio:!!audio});if(audio){await Promise.all([audio,sleep(display.dur*.85)]);display.close()}else await sleep(o.async?150:display.dur*.85)}
/* ---------- 吹き出し ---------- */
function bubble(a,text,o={}){
 const b=document.createElement('div');b.className='sk-bubble'+(o.style?' '+o.style:'');b.textContent=text;b.style.setProperty('--sk-c',a.char.color||'#ff8fbf');
 layer.appendChild(b);
 const v=viewRect(),bw=b.offsetWidth,bh=b.offsetHeight;
 let x=a.x+a.w/2-bw/2,y=a.y-bh-4;if(y<v.top+4)y=a.y+a.h+4;
 b.style.left=cl(x,v.left+6,v.left+v.width-bw-6)+'px';b.style.top=y+'px';
 requestAnimationFrame(()=>b.classList.add('on'));
 const dur=o.dur||Math.max(1200,(CFG.secPerChar||.09)*1000*text.length+900);
 const close=()=>{b.classList.remove('on');setTimeout(()=>b.remove(),250)};if(!o.audio)setTimeout(close,dur);
 if(!o.audio&&a.char.type==='pinkchan-mirror'&&window.Pinkchan&&a.char.canSpeak!==false)window.Pinkchan.talk(Math.min(dur,6000)/1000);
 return {dur,close};
}

/* ---------- 台本の実行 ---------- */
// 1行（step）の種類：say / enter / exit / move / act / swarm / wait / react / escalate はなし（場面の when で段階を組む）
async function runSteps(steps,token){
 for(const s of steps){if(token!==runToken)return;let entered=null;
  if(s.wait!=null){await sleep(s.wait*1000);continue}
  if(s.enter){const base=s.enter.replace(/\d+$/,'');const id=s.as||(actors.has(s.enter)?newId(base):s.enter);enter(id,{char:s.char||base,at:s.at,scale:s.scale,flip:s.flip,tint:s.tint});if(s.say==null){await sleep(250);continue}entered=id}
  if(s.swarm){const n=s.count||6;for(let i=0;i<n&&token===runToken;i++){const base=s.swarm;const ch=charOf(base);const tints=s.tints||(ch&&ch.tints)||[0];enter(newId(base),{char:base,at:s.at||pick(['overText','screen','screen','textTop','textBottom']),scale:s.scale||rnd(.7,1.25),tint:pick(tints)});await sleep((s.every||.25)*1000)}
   if(s.say&&token===runToken){const ids=[...actors.keys()].filter(k=>k.startsWith(s.swarm));await sayLine(actors.get(pick(ids))||actors.values().next().value,fill(Array.isArray(s.say)?pick(s.say):s.say),{style:s.style})}continue}
  if(s.exit){if(s.exit==='all')exitAll();else if(s.exit==='others'){for(const id of [...actors.keys()])if(id!==s.keep)exit(id)}else exit(s.exit);await sleep(300);continue}
  if(s.react){if(window.Pinkchan)window.Pinkchan.react(s.react);if(s.say==null){await sleep(400);continue}}
  const talkers=[...actors.values()].filter(x=>x.char.canSpeak!==false).map(x=>x.id);
  const who=s.who==='any'?(talkers.length?pick(talkers):[...actors.keys()][0]):(s.who||entered);
  let a=who&&actors.get(who);
  if(!a&&who&&(s.say!=null||s.act||s.move))a=enter(who,{char:s.char,at:s.at});
  if(!a)continue;
  if(s.move){move(a,s.move,s.sec);if(s.say==null&&!s.act){await sleep((s.sec||.6)*1000);continue}}
  if(s.act)act(a,s.act);
  if(s.say!=null){const t=fill(Array.isArray(s.say)?pick(s.say):s.say);await sayLine(a,t,{style:s.style,dur:s.dur&&s.dur*1000,async:s.async})}
  else if(s.act)await sleep(450);
 }
}
function scenesFor(trigger){const own=CARD_SCENES.filter(s=>s.when&&s.when.trigger===trigger);return own.length?own:SCENES.filter(s=>s.when&&s.when.trigger===trigger)}
async function play(scene,{preempt}={}){
 if(!scene)return;
 if(running&&!preempt){queue.push(scene);return}if(preempt)stopSkitVoice();
 const token=++runToken;running=scene;
 try{await runSteps(scene.steps||[],token)}catch(e){console.warn('寸劇の実行で失敗',e)}
 if(token===runToken){running=null;if(scene.clearAfter)exitAll();const next=queue.shift();if(next)play(next)}
}
function fire(trigger){if(!enabled||!CFG)return;const list=scenesFor(trigger);if(!list.length)return;
 const fresh=list.filter(s=>!s.once||!playedOnce.has(s.id||s._src+trigger));const sc=pick(fresh.length?fresh:list);if(sc.once)playedOnce.add(sc.id||sc._src+trigger);play(sc)}

/* ---------- 追い払う ---------- */
async function dismiss(reason){
 if(!enabled||!actors.size)return;
 stopSkitVoice();queue=[];const token=++runToken;running=null;
 const list=scenesFor('dismiss').filter(s=>!s.when.reason||s.when.reason===reason);
 if(list.length){running=pick(list);try{await runSteps(running.steps||[],token)}catch(e){}if(token!==runToken)return;running=null}
 exitAll();restartClock((CFG.cooldownAfterDismiss||45)*1000);
}
let lastGrow=0;
function restartClock(delay){clock0=performance.now()+(delay||0);firedIdle=new Set();lastGrow=0}

/* ---------- 時間で段階を上げる（when.trigger="idle" の after 秒） ---------- */
setInterval(()=>{if(!enabled||!CFG||document.hidden||running||loadingCard||cardNo==null)return;const t=(performance.now()-clock0)/1000;if(t<0)return;
 const groups={};for(const s of [...SCENES,...CARD_SCENES])if(s.when&&s.when.trigger==='idle')(groups[s.when.after]=groups[s.when.after]||[]).push(s);
 for(const k of Object.keys(groups).map(Number).sort((a,b)=>a-b)){if(t>=k&&!firedIdle.has(k)){firedIdle.add(k);const own=groups[k].filter(s=>s._src==='card');play(pick(own.length?own:groups[k]));return}}
 // 最後の段階のあとも止まらずに増え続ける（config.json の growth）
 const g=CFG.growth;if(!g||t<(g.after||60)||actors.size>=(CFG.maxActors||30))return;
 const now=performance.now();if(now-lastGrow<(g.every||3)*1000)return;lastGrow=now;
 const step={swarm:pick(g.chars||['pink']),count:g.count||2,every:g.spawnEvery||.12,at:'screen'};
 if(g.say&&g.say.length&&Math.random()<(g.sayChance==null?.6:g.sayChance))step.say=g.say;
 play({steps:[step]});
},500);

/* ---------- 分身の描画：ピンクちゃんの絵を写す ---------- */
let mirrorFrame=0;
function mirrorLoop(){requestAnimationFrame(mirrorLoop);if(!actors.size||document.hidden)return;
 // 数が多いときは間引いて描く（分身が増えても重くならないように）
 mirrorFrame++;if(actors.size>12&&mirrorFrame%2)return;if(actors.size>36&&mirrorFrame%3)return;
 const src=window.Pinkchan&&window.Pinkchan.canvas&&window.Pinkchan.canvas();if(!src||!src.width)return;
 for(const a of actors.values()){if(!a.canvas)continue;const c=a.canvas,g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);
  const s=Math.min(c.width/src.width,c.height/src.height),w=src.width*s,h=src.height*s;g.drawImage(src,(c.width-w)/2,c.height-h,w,h)}}
requestAnimationFrame(mirrorLoop);

/* ---------- 本文の動きを拾う ---------- */
function onCardMaybeChanged(){const info=readCard();if(info.no!==cardNo)stopSkitVoice();if(!info.sentence){if(cardNo!==null){cardNo=null;cardLoadVersion++;loadingCard=false;CARD_SCENES=[];queue=[];runToken++;running=null;exitAll(true)}return;}
 if(info.no===cardNo){cardInfo={...info,word:cardInfo.word||info.word};return}
 cardNo=info.no;cardInfo=info;exitAll(true);queue=[];runToken++;running=null;playedOnce=new Set();
 loadingCard=true;const pending=loadCardScenes(info.no),version=cardLoadVersion;pending.then(()=>{if(version!==cardLoadVersion)return;loadingCard=false;if(!enabled)return;restartClock((CFG.openDelay||2)*1000);setTimeout(()=>{if(enabled&&cardNo===info.no&&version===cardLoadVersion)fire('cardOpen')},(CFG.openDelay||2)*1000)})}
function watch(){const c=document.getElementById('content');if(c)new MutationObserver(onCardMaybeChanged).observe(c,{childList:true});if(LIT){let timer;const refresh=()=>{clearTimeout(timer);timer=setTimeout(onCardMaybeChanged,120)};window.addEventListener('scroll',refresh,{passive:true});window.addEventListener('resize',refresh)}onCardMaybeChanged()}
// 音読ボタン・読み上げの終わりで追い払う（config.json の dismissOn）
document.addEventListener('literature:speech-end',()=>{if(LIT&&CFG&&(CFG.dismissOn||[]).includes('speechEnd'))dismiss('speechEnd')});
document.addEventListener('click',e=>{if(e.target.closest?.('.speech-action,[data-act="speak"],[data-act="read"]'))yieldToStudy();const b=e.target.closest&&e.target.closest('[data-act]');if(!b)return;
 if(b.dataset.act==='read'&&(CFG&&(CFG.dismissOn||[]).includes('read')))dismiss('read');
},true);
stopBtn.onclick=e=>{e.stopPropagation();dismiss('button')};
function syncStop(){stopBtn.classList.toggle('sk-hide',!enabled||actors.size<(CFG&&CFG.stopButtonFrom||1))}

/* ---------- オン・オフ ---------- */
function renderToggle(){toggle.textContent='🎭 寸劇：'+(enabled?'オン':'オフ');toggle.setAttribute('aria-pressed',String(enabled));toggle.title='キャラが本文の横で寸劇を始めて、だんだん邪魔をしてきます'}
function setEnabled(v){enabled=v;try{localStorage.setItem(KEY,v?'1':'0')}catch(e){}renderToggle();
 if(window.Pinkchan&&window.Pinkchan.keepAlive)window.Pinkchan.keepAlive(v);
 if(!v){stopSkitVoice();queue=[];runToken++;running=null;exitAll(true)}else{cardNo=null;onCardMaybeChanged()}syncStop()}
toggle.onclick=()=>setEnabled(!enabled);

async function mount(){
 document.body.appendChild(layer);document.body.appendChild(stopBtn);
 const nav=(LIT&&document.querySelector('header .nav'))||document.querySelector('nav[aria-label="読書コンテンツ"]')||document.querySelector('header');
 renderToggle();renderVoice();if(nav){nav.appendChild(toggle);nav.appendChild(voiceToggle);nav.appendChild(voiceTest);nav.appendChild(voiceInfo)}installSpeechPriority();reportVoice(voiceSupported?(voiceEnabled?'未確認（音声テストを押してください）':'消音'):'非対応');
 try{await loadAll()}catch(e){console.warn('寸劇の設定を読めませんでした',e);toggle.remove();voiceToggle.remove();voiceTest.remove();voiceInfo.remove();return}
 if(window.Pinkchan&&window.Pinkchan.keepAlive)window.Pinkchan.keepAlive(enabled);
 watch();
}
window.Skit={on:()=>setEnabled(true),off:()=>setEnabled(false),fire,dismiss,enter,exit,exitAll,reload:async()=>{await loadAll();await loadCardScenes(cardNo)},actors:()=>[...actors.keys()],play:steps=>play({steps},{preempt:true})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
