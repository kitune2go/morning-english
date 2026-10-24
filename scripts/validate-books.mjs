#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
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
        }
        if(Array.isArray(detail.expressions))check(detail.expressions.every(x=>typeof x.en==="string"&&x.en&&typeof x.ja==="string"&&x.ja),label+"phrase explanation fields");
        if(Array.isArray(detail.vocabulary))check(detail.vocabulary.every(x=>typeof x.word==="string"&&x.word&&typeof x.ja==="string"&&x.ja&&typeof x.note==="string"&&x.note),label+"vocabulary meaning and usage note");
      });
    }
  }
  console.log(b.id+": "+days.length+" sessions, "+paras+" paragraphs, "+words+" words; translations "+days.filter(x=>x.jp.length).length+" sessions");
}
if(failures)process.exit(1);
console.log("Book validation passed");
