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
      check(nodes.chapterList.innerHTML.includes("段落 3 から再開")&&rerenders===0,
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

if(failures)process.exit(1);
console.log("Book validation passed");
