#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const root=path.resolve(import.meta.dirname,"..");
const file=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
let failures=0;
function check(ok,msg){if(!ok){console.error("FAIL: "+msg);failures++;}}
const works=file("books-manifest.json");
check(Array.isArray(works)&&works.length>0,"manifest must contain works");
const used=new Set();
for(const b of works){
  check(typeof b.id==="string"&&!used.has(b.id),"unique book id");
  used.add(b.id);
  check(typeof b.title==="string"&&!!b.title,"book title");
  check(/^https:\/\//.test(b.sourceUrl),"source URL");
  check(/^books\/[a-z0-9-]+\/[a-z0-9-]+\.json$/.test(b.data),"safe book data path");
  let days;
  try{days=file(b.data);}catch(e){check(false,"cannot read "+b.data+": "+e.message);continue;}
  check(Array.isArray(days)&&days.length>0,"nonempty book: "+b.id);
  if(!Array.isArray(days))continue;
  let words=0,paras=0;
  for(let i=0;i<days.length;i++){
    const d=days[i];
    const prefix=b.id+"/Day "+(i+1)+": ";
    check(d.day===i+1,prefix+"sequential day");
    check(typeof d.title==="string"&&d.title.trim().length>0,prefix+"title");
    check(Array.isArray(d.paragraphs)&&d.paragraphs.length>0,prefix+"paragraphs");
    if(!Array.isArray(d.paragraphs))continue;
    check(d.paragraphs.every(x=>typeof x==="string"&&x.trim().length>0),prefix+"no empty paragraphs");
    const count=d.paragraphs.reduce((sum,x)=>sum+x.trim().split(/\s+/).length,0);
    check(d.wordCount===count,prefix+"wordCount must match paragraphs");
    words+=count;paras+=d.paragraphs.length;
    check(Array.isArray(d.jp)&&(d.jp.length===0||d.jp.length===d.paragraphs.length),prefix+"translation aligns to all paragraphs or none");
    check(Array.isArray(d.chunks)&&Array.isArray(d.grammar)&&Array.isArray(d.vocabulary),prefix+"annotation arrays");
    check(d.vocabulary.every(x=>typeof x.word==="string"&&typeof x.ja==="string"),prefix+"vocabulary entries");
    const requireParagraphDetails=b.id==="happy-prince";
    const details=d.paragraphDetails;
    if(requireParagraphDetails)check(Array.isArray(details),prefix+"paragraph details must exist");
    if(Array.isArray(details)){
      check(details.length===d.paragraphs.length,prefix+"paragraph annotation count");
      details.forEach((detail,pi)=>{
        const label=prefix+"paragraph "+(pi+1)+": ";
        check(typeof detail.summary==="string"&&detail.summary.trim().length>0,label+"reading guide");
        check(Array.isArray(detail.chunks)&&detail.chunks.length>0,label+"chunks");
        check(Array.isArray(detail.expressions)&&detail.expressions.length>0,label+"phrase explanations");
        check(Array.isArray(detail.vocabulary)&&detail.vocabulary.length>0,label+"vocabulary notes");
        if(Array.isArray(detail.chunks)){
          check(detail.chunks.every(x=>typeof x.en==="string"&&x.en.trim()&&typeof x.ja==="string"&&x.ja.trim()&&typeof x.role==="string"&&x.role.trim()),label+"chunk fields");
          check(detail.chunks.map(x=>x.en).join("")===d.paragraphs[pi],label+"chunks must reconstruct original paragraph verbatim");
          if(b.id==="happy-prince"){
            for(const [ci,chunk] of detail.chunks.entries()){
              const field=label+"chunk "+(ci+1)+": ";
              check(typeof chunk.ja==="string"&&chunk.ja.trim().length>0&&!chunk.ja.includes("語句："),field+"must contain a natural Japanese translation");
              check(typeof chunk.hint==="string"&&chunk.hint.trim().length>0,field+"retain reading hint");
              const tokens=chunk.en.match(/[\p{L}]+(?:['’\-][\p{L}]+)*/gu)||[];
              check(Array.isArray(chunk.words)&&chunk.words.length===tokens.length,field+"all word tokens must be glossed");
              if(Array.isArray(chunk.words)){
                chunk.words.forEach((w,wi)=>{
                  check(w.word===tokens[wi],field+"word "+(wi+1)+" must match source order");
                  check(typeof w.ja==="string"&&w.ja.trim().length>0,field+"word "+(wi+1)+" meaning");
                  check(typeof w.note==="string"&&w.note.trim().length>0,field+"word "+(wi+1)+" usage explanation");
                });
              }
            }
          }
        }
        if(Array.isArray(detail.expressions))check(detail.expressions.every(x=>typeof x.en==="string"&&x.en&&typeof x.ja==="string"&&x.ja),label+"phrase explanation fields");
        if(Array.isArray(detail.vocabulary))check(detail.vocabulary.every(x=>typeof x.word==="string"&&x.word&&typeof x.ja==="string"&&x.ja&&typeof x.note==="string"&&x.note),label+"vocabulary meaning and usage note");
      });
    }
  }
  console.log(b.id+": "+days.length+" sessions, "+paras+" paragraphs, "+words+" words; translations "+days.filter(x=>x.jp.length).length+" sessions");
}

// Regression checks for per-paragraph ChatGPT question links.
const readerHtml=fs.readFileSync(path.join(root,"books.html"),"utf8");
const scriptMatch=readerHtml.match(/<script>([\s\S]*?)<\/script>/);
check(!!scriptMatch,"book reader must have an inline script");
if(scriptMatch){
  try{new vm.Script(scriptMatch[1],{filename:"books.html inline script"});}
  catch(err){check(false,"book reader JavaScript syntax: "+err.message);}
  for(const control of ["data-ask-link","data-ask-copy","data-ask-input"]){
    check(readerHtml.includes(control),"reader must expose "+control);
  }
  const code=scriptMatch[1];
  for(const elementId of ["chapterIndex","chapterList","chapterIndexCount","dayReadStatus"]){
    check(readerHtml.includes('id="'+elementId+'"'),"reader includes "+elementId);
  }
  for(const action of ["data-go-day","data-toggle-chapter"]){
    check(readerHtml.includes(action),"reader includes "+action);
  }
  const progressStart=code.indexOf("function completedDaySet(");
  const progressEnd=code.indexOf("function askDraftKey(",progressStart);
  check(progressStart!==-1&&progressEnd>progressStart,"chapter read logic exists");
  if(progressStart!==-1&&progressEnd>progressStart){
    try{
      const days=[{day:1,title:"Part One",wordCount:120},{day:2,title:"Part Two",wordCount:200},{day:3,title:"Part Three",wordCount:90}];
      const nodes={};
      const saved={completed:[1,"2",2,999,"garbage"]};
      const node=id=>nodes[id]??(nodes[id]={});
      let renderCount=0;
      const make=new Function("sessions","current","bookState","validDay","updateState","render","$","safe","paragraphMarkFor",
        code.slice(progressStart,progressEnd)+"\nreturn {completedDaySet,toggleChapterRead,renderChapterIndex};");
      const model=make(days,2,()=>saved,n=>Number.isInteger(n)&&n>=1&&n<=days.length,
        patch=>Object.assign(saved,patch),()=>renderCount++,node,x=>String(x).replace(/</g,"&lt;"),()=>null);
      let completed=model.completedDaySet();
      check([...completed].sort().join(",")==="1,2","legacy read chapters preserved and invalid/duplicate values removed");
      model.renderChapterIndex(completed);
      check(nodes.daySelect.innerHTML.includes("✓ Day 01")&&nodes.daySelect.innerHTML.includes("○ Day 03"),
        "chapter picker shows read/unread badges");
      check(nodes.daySelect.value==="2"&&nodes.chapterList.innerHTML.includes('aria-current="page"'),
        "current chapter stays selected");
      check(nodes.chapterList.innerHTML.includes('aria-pressed="true"')&&nodes.chapterList.innerHTML.includes('aria-pressed="false"'),
        "chapter index has accessible read toggles");
      model.toggleChapterRead(3);
      check(saved.completed.join(",")==="1,2,3"&&renderCount===1,"marking one chapter persists and rerenders");
      model.toggleChapterRead(2);
      check(saved.completed.join(",")==="1,3"&&renderCount===2,"unmarking a chapter persists and rerenders");
      model.toggleChapterRead(99);
      check(renderCount===2&&saved.completed.join(",")==="1,3","invalid chapter does not alter read progress");
    }catch(err){check(false,"chapter read regression test: "+err.message);}
  }

  // Bookmark regression: previous chapter completion must survive; paragraph resume remains independent.
  for(const elementId of ["resumeBar","resumeLabel","jumpToResume"]){
    check(readerHtml.includes('id="'+elementId+'"'),"resume UI includes "+elementId);
  }
  check(readerHtml.includes('data-mark-paragraph'),"each paragraph has bookmark controls");
  check(readerHtml.includes('id="reader-paragraph-'),"each paragraph is an accessible scroll destination");
  check(code.includes("if(resume)scheduleParagraphJump(resume.day,resume.paragraph)"),
    "opening saved book schedules an automatic jump to the bookmarked paragraph");
  const markStart=code.indexOf("function validParagraph(");
  const markEnd=code.indexOf("function askDraftKey(",markStart);
  check(markStart>=0&&markEnd>markStart,"paragraph bookmark logic exists");
  if(markStart>=0&&markEnd>markStart){
    try{
      const days=[{day:1,paragraphs:["A","B","C"]},{day:2,paragraphs:["D","E"]}];
      const state={lastDay:1,completed:[1],paragraphMarks:{},resume:null};
      const scrolled=[],changed=[],nodes={
        resumeBar:{hidden:true},resumeLabel:{textContent:""},
        daySelect:{},chapterIndexCount:{},chapterList:{},
        textContent:{querySelectorAll:()=>[]},
        "reader-paragraph-2":{scrollIntoView:opts=>scrolled.push(opts)}
      };
      let rerenders=0,frames=0;
      const modelFactory=new Function("sessions","current","bookState","updateState","completedDaySet","renderChapterIndex",
        "$","requestAnimationFrame","changeDay","validDay","book","safe",
        code.slice(markStart,markEnd)+
          "\nreturn {validParagraph,paragraphMarkFor,resumeMark,toggleParagraphMark,scrollToParagraph,scheduleParagraphJump,jumpToResume};");
      const model=modelFactory(days,1,()=>state,patch=>Object.assign(state,patch),
        ()=>new Set(state.completed),()=>{},
        id=>nodes[id]||null,
        callback=>{frames++;callback();},
        (day,paragraph)=>changed.push([day,paragraph]),
        day=>Number.isInteger(day)&&day>=1&&day<=days.length,
        {id:"test-book"},x=>String(x).replace(/</g,"&lt;"));
      check(model.resumeMark()===null&&model.paragraphMarkFor(1)===null,"legacy progress has no phantom bookmark");
      model.toggleParagraphMark(1,2);
      check(state.completed.join(",")==="1"&&state.paragraphMarks[1]===2&&state.resume.day===1&&state.resume.paragraph===2,
        "mark paragraph without changing chapter completed status");
      check(model.paragraphMarkFor(1)===2,"saved paragraph is retrievable after state reload");
      model.scheduleParagraphJump(1,2);
      check(frames===2&&scrolled.length===1&&scrolled[0].block==="start","bookmark auto-scroll targets exact paragraph");
      model.toggleParagraphMark(1,3);
      check(state.paragraphMarks[1]===3&&state.resume.paragraph===3,"changing bookmark moves chapter checkpoint");
      model.toggleParagraphMark(2,1);
      check(state.paragraphMarks[1]===3&&state.paragraphMarks[2]===1&&state.resume.day===2,
        "each chapter keeps its own bookmark and latest resume points to last marked");
      model.jumpToResume();
      check(changed.length===1&&changed[0][0]===2&&changed[0][1]===1,
        "resume navigates to bookmarked chapter and paragraph");
      model.toggleParagraphMark(2,1);
      check(state.paragraphMarks[1]===3&&state.paragraphMarks[2]===undefined&&model.resumeMark()===null,
        "unchecking latest bookmark removes it but preserves other chapter bookmarks");
      check(!model.validParagraph(1,0)&&!model.validParagraph(2,3)&&!model.validParagraph(4,1),
        "invalid paragraph bookmarks are rejected");
      check(nodes.chapterList.innerHTML.includes("段落 3から再開")&&rerenders===0,
        "bookmarked chapters stay visible without rerendering reading notes");
    }catch(err){check(false,"paragraph bookmarks test: "+err.message);}
  }

  const start=code.indexOf("function askPrompt("),end=code.indexOf("async function copyAskPrompt(",start);
  check(start>=0&&end>start,"reader prompt and URL functions exist");
  if(start>=0&&end>start){
    try{
      const functions=new Function("book","current","getDay",code.slice(start,end)+"\nreturn {askPrompt,askUrl};");
      const example=functions({title:"The Happy Prince",author:"Oscar Wilde"},7,()=>({paragraphs:["First paragraph.","He said something unusual."]}));
      const link=example.askUrl(1,"What does unusual mean?");
      check(link.startsWith("https://chatgpt.com/?prompt="),"link uses ChatGPT prompt URL");
      const prompt=decodeURIComponent(link.split("?prompt=")[1]);
      check(prompt.includes("The Happy Prince")&&prompt.includes("Oscar Wilde"),"prompt includes work metadata");
      check(prompt.includes("Day 7")&&prompt.includes("段落 2"),"prompt includes paragraph location");
      check(prompt.includes("He said something unusual."),"prompt includes complete paragraph");
      check(prompt.includes("What does unusual mean?"),"prompt includes custom question");
      check(example.askPrompt(0).includes("First paragraph."),"default prompt contains paragraph without custom question");
    }catch(err){check(false,"reader prompt test: "+err.message);}
  }
}


// Daily dialogue essay: preserve existing literary source cards and test reader controls.
const litHtml=fs.readFileSync(path.join(root,"literature.html"),"utf8");
const litMatch=litHtml.match(/<script>([\s\S]*?)<\/script>/);
check(!!litMatch,"literary reader must contain its client script");
const dailyWorks=JSON.parse(fs.readFileSync(path.join(root,"literature-works.json"),"utf8")).filter(w=>/^daily-essay-\d{8}$/.test(w.workId));
check(dailyWorks.length>0,"daily dialogue essay works exist");
if(dailyWorks.length){
  const first=dailyWorks[0];
  const manifest=JSON.parse(fs.readFileSync(path.join(root,first.manifest),"utf8"));
  check(manifest.length>0,"daily essay has registered JSON files");
  const cards=manifest.flatMap(p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8")));
  check(cards.length>0,"daily essay has readable chapter cards");
  check(cards.every(c=>typeof c.id==="string"&&c.jp&&c.translationNatural&&Array.isArray(c.chunks)&&c.chunks.length>0),
    "daily essay retains source, translation and annotated chunks");
}
if(litMatch){
  const source=litMatch[1];
  try{new vm.Script(source,{filename:"literature.html inline script"});}
  catch(e){check(false,"literary reader JS syntax: "+e.message);}
  for(const elementId of ["readingProgress","progressCount","readProgressBar","chapterIndex","chapterList"]){
    check(litHtml.includes('id="'+elementId+'"'),"literary reader includes "+elementId);
  }
  for(const action of ["data-read-card","data-open-chapter","data-bookmark-card","data-ask-link","data-ask-copy","data-ask-input"]){
    check(litHtml.includes(action),"literary reader includes "+action);
  }
  check(source.includes("if(currentWork.mode==='essay-translation'&&resume)"),
    "previous literary bookmarks automatically restore essay reading position");
  const start=source.indexOf("const READER_PROGRESS_KEY=");
  const end=source.indexOf("async function copyReadingQuestion(",start);
  check(start>=0&&end>start,"reading progress and essay question helpers exist");
  if(start>=0&&end>start){
    try{
      const saved={};
      const storage={
        getItem:k=>saved[k]||null,
        setItem:(k,v)=>{saved[k]=v;}
      };
      const essay={workId:"daily-essay-20260724",title:"言葉の季節が遅れてくる",mode:"essay-translation"};
      const cards=[
        {id:"DE-1",chapter:1,title:"First",translationNatural:"A bird flies.",jp:"鳥が飛ぶ。"},
        {id:"DE-2",chapter:2,title:"Second",translationNatural:"The sun rises.",jp:"太陽が昇る。"}
      ];
      let selectCalls=0,renderCalls=0;
      const helpers=new Function("localStorage","currentWork","allCards","buildChapterSelect","renderCards","getBookmarkedCard",
        "selectedChapter","document","requestAnimationFrame","scrollToCard","fetchJson",
        source.slice(start,end)+"\nreturn {readChapterSet,toggleChapterRead,askPrompt,askChatUrl};");
      const api=helpers(storage,essay,cards,()=>selectCalls++,()=>renderCalls++,()=>null,"all",{},()=>{},()=>{},()=>{});
      check(api.readChapterSet().size===0,"essay starts without completed chapters");
      api.toggleChapterRead("DE-1");
      check(api.readChapterSet().has("DE-1")&&selectCalls===1&&renderCalls===1,
        "chapter completion is independently persisted and refreshes the view");
      api.toggleChapterRead("DE-1");
      check(api.readChapterSet().size===0,"reading check can be removed");
      api.toggleChapterRead("invalid");
      check(selectCalls===2&&renderCalls===2,"unknown chapter cannot change progress");
      const url=api.askChatUrl(cards[1],"What does rises mean?");
      check(url.startsWith("https://chatgpt.com/?prompt="),"essay questions use unauthenticated ChatGPT links");
      const prompt=decodeURIComponent(url.split("?prompt=")[1]);
      check(prompt.includes(essay.title)&&prompt.includes("Chapter 2")&&prompt.includes("The sun rises."),
        "essay question includes work, chapter and English passage");
      check(prompt.includes("太陽が昇る")&&prompt.includes("What does rises mean?"),
        "essay question includes Japanese original and custom question");
      check(prompt.includes("\n\n"),"essay question uses readable line breaks");
      check(!url.includes("api_key")&&!url.includes("Bearer"),"essay link does not expose API credentials");
    }catch(e){check(false,"daily essay reader behavior: "+e.message);}
  }
}


// Avoid the mobile glossary overlap regression reported on a narrow Android browser.
if(litMatch){
  const source=litMatch[1];
  check(litHtml.includes('.word-head{display:flex;align-items:baseline;flex-wrap:wrap'),
    "mobile vocabulary rows must wrap instead of using fixed/intrinsic grid columns");
  check(litHtml.includes('overflow-wrap:anywhere')&&litHtml.includes('.word-ask{'),
    "long vocabulary, meanings and question buttons must wrap without overlap");
  check(!litHtml.includes('grid-template-columns:60px minmax(0,1fr)'),
    "old cramped glossary grid must not be used");
  check(!litHtml.includes('共通語彙辞典には未登録'),
    "unknown word labels must not repeat a full sentence on every row");
  const start=source.indexOf('function normalizedWord(');
  const end=source.indexOf('function renderCard(',start);
  check(start>=0&&end>start,"chunk renderer exists for glossary layout test");
  if(start>=0&&end>start){
    try{
      const chunkFn=new Function('wordGlossary','contextGlossary','askChatUrl','escapeHtml','escapeAttr','speakButton',
        source.slice(start,end)+'\nreturn renderChunk;');
      const glossary=new Map([['inside',{ja:'内側に',note:'前置詞、位置を示す'}]]);
      const render=chunkFn(glossary,{},()=>'https://chatgpt.com/?prompt=example',
        x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;'),
        x=>String(x),()=>'<button>▶</button>');
      const placeholder=render({en:'Departments inside different organizations',ja:'複数の組織内の部署'},0,{id:'example'});
      check(placeholder.includes('data-gloss-card="example"')&&
        placeholder.includes('文脈単語帳（開くと読み込みます）')&&
        !placeholder.includes('class="word-line"'),
        "collapsed glossary defers expensive word rendering until opened");
      const output=render({en:'Departments inside different organizations',ja:'複数の組織内の部署'},0,{id:'example'},true);
      check(output.includes('<strong class="word-en" lang="en">Departments</strong>')&&
        output.includes('意味を質問 ↗')&&output.includes('<span class="word-meaning unlisted" lang="ja">未登録</span>'),
        "unknown words show a distinct compact button instead of oversized inline hyperlinks");
      check(output.includes('内側に')&&output.includes('前置詞、位置を示す')&&output.includes('一般語義'),
        "dictionary words show meaning and note in separate, wrapping lines");
      check(output.includes('文脈単語帳（4語・文脈訳0語）')&&
        (output.match(/class="word-line"/g)||[]).length===4,
        "word list retains the full original token order");
    }catch(e){check(false,"mobile glossary rendering test: "+e.message);}
  }
}


// Contextual senses must be tied to the actual card/chunk, not just to a dictionary headword.
const contextPath=path.join(root,"literature/essay-context-glossary.json");
check(fs.existsSync(contextPath),"contextual vocabulary file exists");
if(fs.existsSync(contextPath)){
  const context=JSON.parse(fs.readFileSync(contextPath,"utf8"));
  const cardLookup=new Map();
  for(const w of dailyWorks){
    const manifests=JSON.parse(fs.readFileSync(path.join(root,w.manifest),"utf8"));
    for(const source of manifests){
      for(const card of JSON.parse(fs.readFileSync(path.join(root,source),"utf8")))
        cardLookup.set(card.id,card);
    }
  }
  for(const [id,chunkList] of Object.entries(context)){
    const card=cardLookup.get(id);
    check(!!card,"context annotations refer to an existing card: "+id);
    if(!card)continue;
    check(Array.isArray(chunkList)&&chunkList.length<=card.chunks.length,"context matches chunk structure: "+id);
    if(!Array.isArray(chunkList))continue;
    chunkList.forEach((chunk,i)=>{
      if(!chunk)return;
      const source=card.chunks[i]?.en||"";
      const tokens=new Set((source.match(/[\p{L}]+(?:['’\-][\p{L}]+)*/gu)||[]).map(t=>t.toLowerCase().replace(/’/g,"'")));
      for(const [word,definition] of Object.entries(chunk.words||{})){
        check(tokens.has(word),"contextual word exists in its chunk: "+id+"/"+i+"/"+word);
        check(typeof definition.ja==="string"&&definition.ja.trim().length>0,"contextual Japanese meaning: "+id+"/"+i+"/"+word);
      }
      for(const phrase of chunk.phrases||[]){
        check(typeof phrase.en==="string"&&source.toLowerCase().includes(phrase.en.toLowerCase()),"phrase exists in its chunk: "+id+"/"+i+"/"+phrase.en);
        check(typeof phrase.ja==="string"&&phrase.ja.trim().length>0&&typeof phrase.note==="string"&&phrase.note.trim().length>0,
          "phrase has a contextual translation and grammar note: "+id+"/"+i);
      }
    });
  }
}

// Ensure every token in all *current* daily dialogue essays has a Japanese meaning.
// Regenerate coverage dynamically from the registered essay manifests, not from a stale index.
const essayGlossaryPaths=[
  "books/happy-prince/lexicon.json",
  "books/happy-prince/extended-glossary.json",
  "literature/essay-glossary-abcdef.json",
  "literature/essay-glossary-ghijkl.json",
  "literature/essay-glossary-mnopqr.json",
  "literature/essay-glossary-stuv.json",
  "literature/essay-glossary-wxyz.json",
  "literature/essay-glossary-custom.json",
  "literature/essay-glossary-recent.json",
  "literature/essay-glossary-legacy-gapfill.json"
];
const glossaryWords=new Map();
for(const file of essayGlossaryPaths){
  const full=path.join(root,file);
  check(fs.existsSync(full),"essay glossary exists: "+file);
  if(!fs.existsSync(full))continue;
  const records=JSON.parse(fs.readFileSync(full,"utf8"));
  check(Array.isArray(records)&&records.length>0,"essay glossary contains records: "+file);
  const local=new Set();
  for(const entry of records){
    const key=typeof entry.word==="string"?entry.word.toLowerCase().replace(/’/g,"'"):"";
    check(!!key&&!local.has(key),"valid unique glossary headword "+file+" / "+key);
    local.add(key);
    check(typeof entry.ja==="string"&&/[\u3040-\u30ff\u3400-\u9fff]/u.test(entry.ja)&&
      !/未登録|意味を質問/.test(entry.ja),"Japanese glossary translation: "+file+" / "+key);
    check(typeof entry.note==="string"&&entry.note.trim().length>0,
      "Japanese glossary usage note: "+file+" / "+key);
    glossaryWords.set(key,entry);
  }
}
const dailyTokenForms=new Set();
let dailyTokens=0,dailyCards=0;
for(const w of dailyWorks){
  const manifestPath=path.join(root,w.manifest);
  check(fs.existsSync(manifestPath),"daily essay manifest exists: "+w.workId);
  if(!fs.existsSync(manifestPath))continue;
  const chapters=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
  for(const file of chapters){
    const full=path.join(root,file);
    check(fs.existsSync(full),"daily essay source exists: "+file);
    if(!fs.existsSync(full))continue;
    const cards=JSON.parse(fs.readFileSync(full,"utf8"));
    for(const card of cards){
      dailyCards++;
      for(const chunk of card.chunks||[]){
        const tokens=(chunk.en||"").match(/[\p{L}]+(?:['’\-][\p{L}]+)*/gu)||[];
        for(const word of tokens){
          dailyTokens++;
          dailyTokenForms.add(word.toLowerCase().replace(/’/g,"'"));
        }
      }
    }
  }
}
const missingGlosses=[...dailyTokenForms].filter(word=>!glossaryWords.has(word)).sort();
check(missingGlosses.length===0,
  "all daily essay words have Japanese definitions; missing: "+missingGlosses.join(", "));
check(dailyWorks.length>=23&&dailyCards>=88&&dailyTokens>=6314,
  "all 23 existing daily essays and 88 chapters are indexed in coverage validation");
check(litHtml.includes("literature/essay-glossary-custom.json")&&
  litHtml.includes("literature/essay-glossary-mnopqr.json"),
  "literary reader loads complete supplemental glossary");
check(litHtml.includes("https://github.com/kujirahand/EJDict"),
  "literary reader attributes the CC0 glossary provider");
console.log("Daily essay glossary coverage: "+dailyWorks.length+" works, "+dailyCards+
  " chapters, "+dailyTokens+" tokens, "+dailyTokenForms.size+
  " unique word forms, "+missingGlosses.length+" missing definitions");


// Lucian reader: check dynamically built paragraph chunks and the book-specific glossary.
const lucianBook=works.find(w=>w.id==="lucian-dialogues-of-the-gods");
check(!!lucianBook&&!!lucianBook.glossaryData,"Lucian is registered with a contextual glossary");
if(lucianBook?.glossaryData){
  const textDays=file(lucianBook.data);
  const lex=file(lucianBook.glossaryData);
  const lookup=new Map();
  for(const entry of lex){
    const key=entry.word?.toLowerCase().replace(/’/g,"'");
    check(!!key&&!lookup.has(key),"Lucian unique vocabulary entry "+key);
    check(typeof entry.ja==="string"&&entry.ja.trim().length>0&&typeof entry.note==="string"&&entry.note.trim().length>0,
      "Lucian vocabulary has a Japanese meaning and a note: "+key);
    lookup.set(key,entry);
  }
  // Regression: "us" in "to vex us" is the object pronoun, never the U.S. abbreviation.
  const usEntry=lookup.get("us");
  check(!!usEntry&&usEntry.ja.includes("私たち")&&!/United States|合衆国/i.test(usEntry.ja),
    "Lucian us must mean first-person plural object pronoun, not United States");
  // Semantic regression: dictionary-form stemming must not replace the actual word in context.
  // These entries previously displayed e.g. 'tis as a musical note and sees as a chemical symbol.
  const expectedLucianMeanings = [
    ["tis", /it is/i], ["twill", /it will/i],
    ["may", /助動詞|かもしれない|してよい/], ["sees", /見る|見えて/],
    ["lies", /横たわ/], ["meted", /報い/], ["muses", /ムーサ/],
    ["fairer", /美しい/], ["fairest", /美しい/],
    ["finer", /優れた|立派な/], ["dames", /婦人|女性/],
    ["cares", /気にかける|愛情/], ["dotes", /溺愛/],
    ["mater", /脳軟膜/], ["pipes", /笛/], ["car", /馬車|戦車/],
    ["irons", /拘束具|鎖/], ["tithe", /十分の一|一割/],
  ];
  for(const [word,pattern] of expectedLucianMeanings){
    check(pattern.test(lookup.get(word)?.ja||""),
      "Lucian contextual meaning regression for "+word);
  }
  // A semantic layer on top of token-coverage checks: a word with a Japanese
  // translation is not necessarily translated correctly (e.g. "liver" once
  // resolved to "resident", or "Rhea" to the South American bird).
  const lucianSenseRegressions = new Map([
    ["liver", /肝臓/], ["rhea", /女神/], ["stole", /盗んだ/],
    ["argos", /地名/], ["atlas", /巨神/], ["paris", /トロイア/],
    ["bolt", /雷/], ["artillery", /弓矢/], ["conceives", /妊娠|身ごも/],
    ["assume", /変身|姿/], ["content", /満足/], ["cross", /不機嫌|腹を立て/],
    ["dashed", /打ちつけ|叩きつけ/], ["directly", /すぐ/],
    ["flashing", /光/], ["following", /取り巻き/], ["figure", /体つき/],
    ["manes", /たてがみ/], ["locks", /髪/], ["lodged", /矢/],
    ["marshalling", /魂/], ["masquerading", /変装|扮装/],
    ["overreached", /出し抜/], ["pastures", /放牧/], ["plumes", /羽飾り/],
    ["pressed", /頼んだ|迫った/], ["presents", /贈り物/],
    ["quack", /やぶ医者/], ["quiver", /矢筒/], ["riveted", /固定|縛り/],
    ["rushing", /走り回る|突進/], ["singed", /焼け焦げ/],
    ["slaves", /奴隷/], ["scot", /罰/], ["scrapes", /厄介/],
    ["smacked", /叩いた|たたいた/], ["stole", /盗んだ/], ["stormed", /怒鳴/],
    ["tripped", /転ばせた/], ["tricked", /着飾/], ["wound", /傷/],
    ["waves", /波/], ["wheels", /車輪/], ["worked", /計算/],
    ["ap", /アポロン/], ["ar", /アレス/], ["ma", /マイア/],
    ["par", /パリス/], ["prom", /プロメテウス/],
  ]);
  for(const [word,sense] of lucianSenseRegressions)
    check(sense.test(lookup.get(word)?.ja||""),
      "Lucian semantic glossary regression: "+word);
  check(textDays.length===19,"Lucian consists of 19 dialogues from the English source edition");
  const source=scriptMatch?.[1]||"";
  const start=source.indexOf("function splitDialogueChunks(");
  const end=source.indexOf("function render(){",start);
  check(start>=0&&end>start,"Lucian chunk and vocabulary helpers are available");
  if(start>=0&&end>start){
    try{
      const funcs=new Function(source.slice(start,end)+"\nreturn {buildDialogueParagraphDetails,dialogueContextKey};")();
      const build=funcs.buildDialogueParagraphDetails;
      let paragraphs=0,chunks=0,tokens=0,complete=0,pending=0;
      const forms=new Set();
      check(!!lucianBook.chunkTranslationBase,"Lucian chapter-level chunk translation directory is configured");
      const context=file(lucianBook.contextGlossaryData);
      check(context.version===1&&Array.isArray(context.entries),
        "Lucian context dictionary schema version 1");
      const contextLookup=new Map();
      const sourceToken=/[\p{L}]+(?:['’\-][\p{L}]+)*/gu;
      for(const entry of context.entries||[]){
        const source=textDays[entry.day-1]?.paragraphs?.[entry.paragraph-1];
        check(Number.isInteger(entry.day)&&Number.isInteger(entry.paragraph)&&!!source,
          "Context day and paragraph must exist");
        if(!source)continue;
        const word=String(entry.word||"").toLowerCase().replace(/’/g,"'");
        const found=(source.match(sourceToken)||[]).filter(x=>x.toLowerCase().replace(/’/g,"'")===word);
        check(Number.isInteger(entry.occurrence)&&entry.occurrence>0&&entry.occurrence<=found.length,
          "Context word occurrence must exist: "+entry.day+"/"+entry.paragraph+"/"+word);
        check(typeof entry.quote==="string"&&entry.quote.includes(found[entry.occurrence-1]||"")&&source.includes(entry.quote),
          "Context excerpt must still exist in source: "+entry.day+"/"+entry.paragraph+"/"+word);
        check(typeof entry.ja==="string"&&!!entry.ja.trim()&&typeof entry.note==="string"&&!!entry.note.trim(),
          "Context meaning and usage note must exist: "+word);
        const key=funcs.dialogueContextKey(entry.day,entry.paragraph,word,entry.occurrence);
        check(!contextLookup.has(key),"Context key must be unique: "+key);
        contextLookup.set(key,entry);
      }
      check(context.entries.length>=55,"At least 55 grounded contextual word senses");
      for(const day of textDays){
        const path=lucianBook.chunkTranslationBase+"/day-"+String(day.day).padStart(2,"0")+".json";
        const alignment=file(path);
        check(alignment.day===day.day&&alignment.paragraphs.length===day.paragraphs.length,
          "Lucian Day "+day.day+" aligned translation data exists");
        day.chunkTranslations=alignment.paragraphs;
        const details=build(day,lookup,contextLookup);
        check(details.length===day.paragraphs.length,"Lucian Day "+day.day+" paragraph coverage");
        details.forEach((detail,i)=>{
          paragraphs++;
          check(detail.chunks.length>0&&detail.chunks.map(c=>c.en).join("")===day.paragraphs[i],
            "Lucian Day "+day.day+" paragraph "+(i+1)+" exact source reconstruction");
          check(detail.summary&&detail.expressions.length>0&&detail.vocabulary.length>0,
            "Lucian Day "+day.day+" paragraph "+(i+1)+" reading notes");
          check(day.chunkTranslations[i].length===detail.chunks.length,
            "Lucian Day "+day.day+" paragraph "+(i+1)+" exact chunk alignment");
          for(const [ci,c] of detail.chunks.entries()){
            chunks++;
            check(c.translationStatus==="complete"&&c.ja===day.chunkTranslations[i][ci]&&c.ja.trim().length>0,
              "Lucian Day "+day.day+" paragraph "+(i+1)+" chunk "+(ci+1)+" has its exact Japanese translation");
            const words=c.en.match(/[\p{L}]+(?:['’\-][\p{L}]+)*/gu)||[];
            check(c.words.length===words.length&&c.words.every((w,j)=>w.word===words[j]&&w.ja&&w.note),
              "Lucian Day "+day.day+" paragraph "+(i+1)+" full token glossary");
            if(c.translationStatus==="complete")complete++;
            else pending++;
            for(const word of words){tokens++;forms.add(word.toLowerCase().replace(/’/g,"'"));}
          }
        });
      }
      check(paragraphs===238,"Lucian 238 dialogue paragraphs after restoring lost lines and speaker turns");
      check(chunks===585,"Lucian has exactly 585 translated English chunks");
      check(tokens===8612,"Lucian 8,612 full-source tokens");
      check(forms.size===1752&&lookup.size===1752,"All 1,752 unique forms are glossed");
      check(complete===585&&pending===0,"All 585 chunks have explicit aligned Japanese translations");
      check(textDays.every(day=>day.jp.length===day.paragraphs.length),"All 19 Lucian dialogues have complete Japanese paragraph translations");
      for(const entry of context.entries){
        const details=build(textDays[entry.day-1],lookup,contextLookup);
        const words=details[entry.paragraph-1].chunks.flatMap(x=>x.words)
          .filter(x=>x.word.toLowerCase().replace(/’/g,"'")===entry.word);
        const actual=words[entry.occurrence-1];
        check(actual?.contextual===true&&actual.ja===entry.ja&&actual.note===entry.note,
          "Context override applied: "+entry.day+"/"+entry.paragraph+"/"+entry.word);
      }
      function sense(day,paragraph,word,occurrence=1){
        const words=build(textDays[day-1],lookup,contextLookup)[paragraph-1].chunks.flatMap(x=>x.words)
          .filter(x=>x.word.toLowerCase().replace(/’/g,"'")===word);
        return words[occurrence-1]?.ja;
      }
      check(sense(15,32,"fair",1)==="美しい人"&&sense(15,32,"fair",2)==="公平な",
        "Fair has two distinct senses in the same paragraph");
      check(sense(4,15,"will",1)==="～するだろう"&&sense(4,15,"will",3)==="欲望・意志",
        "Will auxiliary and noun receive distinct senses");
      check(sense(1,11,"bound")==="～へ行くところだ"&&sense(13,2,"bound")==="縛られた",
        "Bound changes meaning across dialogues");
      check(sense(1,4,"tithe")===lookup.get("tithe").ja,
        "Other words retain the original dictionary fallback");
      check(build(textDays[0],lookup,contextLookup)[10].vocabulary.some(w=>w.word==="bound"&&w.ja==="～へ行くところだ"),
        "Important word list must reuse passage-specific translation");
      const ninth=build(textDays[8],lookup);
      check(ninth[7]?.chunks[0]?.words[0]?.ja.startsWith("ヘラクレス"),"Her. is Heracles in dialogue XIII");
      const sixth=build(textDays[5],lookup);
      check(sixth[0]?.chunks[0]?.words[0]?.ja.startsWith("ヘパイストス"),"Restored opening speaker in dialogue VIII");
      const first=build(textDays[0],lookup)[0].chunks[0];
      check(first.words[0].ja.startsWith("プロメテウス"),"Prom. is a character, not a high-school dance");
      console.log("Lucian glossary validation: "+paragraphs+" paragraphs, "+chunks+" chunks, "+tokens+
        " glossed tokens, "+forms.size+" forms; "+complete+" complete and "+pending+" pending chunk translations");
    }catch(e){check(false,"Lucian paragraph reader regression: "+e.message);}
  }
}

if(failures)process.exit(1);
console.log("Book validation passed");
