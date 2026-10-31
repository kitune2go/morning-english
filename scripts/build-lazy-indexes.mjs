#!/usr/bin/env node
// Generate the compact reading indexes without changing the source lesson JSON.
// Usage: node scripts/build-lazy-indexes.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const check=process.argv.includes('--check');
let differences=0;
function read(relative){return JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));}
function output(relative,data){
  const destination=path.join(root,relative);
  const body=JSON.stringify(data,null,2)+'\n';
  if(check){
    if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==body){
      console.error('Outdated lazy-loading file:',relative);
      differences++;
    }
  }else{
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==body){
      fs.writeFileSync(destination,body);
      console.log('Updated',relative);
    }
  }
}
function key(card){
  if(card&&card._no!=null&&card._no!=='')return 'no:'+card._no;
  if(card?.sentence)return 'sentence:'+card.sentence+'|'+(card.coreVerb||'');
  return 'json:'+JSON.stringify(card);
}
const cardFiles=read('cards-index.json').cards;
if(!Array.isArray(cardFiles)||!cardFiles.length)throw Error('cards-index.json must list lesson files');
const seen=new Set();
const cardEntries=[];
for(const file of [...new Set(cardFiles)]){
  for(const card of read(file)){
    const id=key(card);
    if(seen.has(id))continue;
    seen.add(id);
    cardEntries.push({
      _no:card._no??null,
      sentence:card.sentence||'',
      coreVerb:card.coreVerb||'',
      theme:card.theme||'',
      _sourceFile:file
    });
  }
}
cardEntries.sort((a,b)=>Number(a._no)-Number(b._no));
output('cards-catalog.json',{version:1,files:cardFiles,cards:cardEntries});

const books=read('books-manifest.json');
for(const book of books.filter(b=>b.dayIndex&&b.dayBase)){
  const days=read(book.data);
  const metadata=[];
  for(const item of days){
    if(!Number.isInteger(item.day)||!Array.isArray(item.paragraphs)||!item.paragraphs.length)
      throw Error('Invalid day in '+book.data);
    metadata.push({day:item.day,title:item.title,wordCount:item.wordCount,paragraphCount:item.paragraphs.length});
    output(book.dayBase+String(item.day).padStart(2,'0')+'.json',item);
  }
  output(book.dayIndex,metadata);
}
if(check){
  for(const filename of ['index.html','literature.html','books.html']){
    const content=fs.readFileSync(path.join(root,filename),'utf8');
    const matches=[...content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    if(matches.length!==1)throw Error(filename+' should contain exactly one inline script');
    try{new vm.Script(matches[0][1],{filename});}
    catch(error){console.error('Script syntax failed:',filename,error);differences++;}
  }
  if(differences)process.exit(1);
  console.log('Lazy-loading catalog, book chapters, and page JavaScript syntax validated.');
}else{
  console.log('Generated '+cardEntries.length+' card metadata entries and book chapter indexes.');
}
