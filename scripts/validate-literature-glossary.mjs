#!/usr/bin/env node
// Verify contextual glosses and token-level dictionary coverage for daily dialogue essays.
// Older works are reported as migration debt; new works must be complete.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const START_STRICT='20261025';
const TOKEN_REGEX=/[\p{L}]+(?:['’\-][\p{L}]+)*/gu;
const read=(name)=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const failures=[];
const check=(ok,message)=>{if(!ok)failures.push(message);};
const normalize=(w)=>String(w).toLowerCase().replace(/’/g,"'");
const tokens=(s)=>(String(s).match(TOKEN_REGEX)||[]).map(normalize);

const glossaryPaths=[
  'books/happy-prince/lexicon.json','books/happy-prince/extended-glossary.json',
  ...['abcdef','ghijkl','mnopqr','stuv','wxyz','custom','recent']
     .map(s=>'literature/essay-glossary-'+s+'.json')
];
const glossary=new Map();
for(const p of glossaryPaths){
  const entries=read(p);
  check(Array.isArray(entries),p+': should contain an array');
  for(const [i,e] of entries.entries()){
    check(typeof e.word==='string'&&e.word.trim()&&typeof e.ja==='string'&&e.ja.trim(),
      p+'['+i+']: requires word and Japanese meaning');
    if(typeof e.word==='string')glossary.set(normalize(e.word),e);
  }
}
const recent=read('literature/essay-glossary-recent.json');
for(const e of recent){
  check(typeof e.pos==='string'&&e.pos.trim()&&typeof e.lemma==='string'&&e.lemma.trim(),
    'Recent dictionary entry '+e.word+' must have part of speech and lemma');
}
const context=read('literature/essay-context-glossary.json');
const works=read('literature-works.json').filter(w=>/^daily-essay-\d{8}$/.test(w.workId));
const checkedIds=new Set();
let words=0,covered=0,strictWords=0,strictMissing=0,legacyMissing=0,strictCards=0;
const missingDetails=[];
for(const work of works){
  const date=work.workId.slice(-8);
  const strict=date>=START_STRICT;
  const manifest=read(work.manifest);
  check(Array.isArray(manifest)&&manifest.length>0,work.workId+': missing manifest');
  for(const p of manifest){
    const cards=read(p);
    check(Array.isArray(cards),p+': expected cards');
    for(const card of cards){
      check(!checkedIds.has(card.id),card.id+': duplicate card id');
      checkedIds.add(card.id);
      if(strict)strictCards++;
      const annotations=context[card.id];
      if(strict)check(Array.isArray(annotations)&&annotations.length===card.chunks.length,
        card.id+': context entries must align with all chunks');
      for(const [i,ch] of (card.chunks||[]).entries()){
        const chunkTokens=tokens(ch.en);
        const localWords=annotations?.[i]?.words||{};
        const textSet=new Set(chunkTokens);
        if(strict){
          check(Object.keys(localWords).length>0,card.id+' chunk '+(i+1)+': contextual words are missing');
          check(Array.isArray(annotations?.[i]?.phrases)&&annotations[i].phrases.length>0,
            card.id+' chunk '+(i+1)+': missing phrase explanation');
          for(const [word,meaning] of Object.entries(localWords)){
            check(textSet.has(normalize(word)),card.id+' chunk '+(i+1)+': word '+word+' is absent from the English source');
            check(typeof meaning?.ja==='string'&&meaning.ja.trim(),card.id+' chunk '+(i+1)+': '+word+' lacks a Japanese gloss');
          }
          for(const phrase of annotations?.[i]?.phrases||[]){
            check(typeof phrase.en==='string'&&phrase.en.trim()&&typeof phrase.ja==='string'&&phrase.ja.trim(),
              card.id+' chunk '+(i+1)+': invalid phrase definition');
          }
        }
        for(const token of chunkTokens){
          words++;
          if(strict)strictWords++;
          const meaning=localWords[token]||glossary.get(token);
          if(meaning&&typeof meaning.ja==='string'&&meaning.ja.trim()){
            covered++;continue;
          }
          if(strict)strictMissing++;else legacyMissing++;
          missingDetails.push(card.id+' #'+(i+1)+' '+token);
        }
      }
    }
  }
}
for(const key of Object.keys(context)){
  check(checkedIds.has(key),'Context refers to a non-existent card: '+key);
}
check(strictMissing===0,'Strict essay vocabulary has '+strictMissing+' unknown token(s): '+missingDetails.filter(x=>x.startsWith('DE-20261025')||x.startsWith('DE-20261026')).slice(0,40).join(', '));

// Static UI and regression coverage: the page must be able to display morphology,
// prioritize contextual glosses, and fall back to dictionary lemmas.
const html=fs.readFileSync(path.join(ROOT,'literature.html'),'utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
check(Boolean(inline),'literature.html must have an inline script');
if(inline){
  try{new vm.Script(inline,{filename:'literature.html'});}
  catch(e){check(false,'Reader syntax error: '+e.message);}
  check(inline.includes('essay-glossary-recent.json'),'Reader should load the recent lexicon');
  const start=inline.indexOf('function normalizedWord(');
  const end=inline.indexOf('function renderChunk(',start);
  check(start>=0&&end>start,'Reader morphology resolver must exist');
  if(start>=0&&end>start){
    try{
      const resolver=new Function('wordGlossary',
        inline.slice(start,end)+'\nreturn {resolveWordGloss,lemmaCandidates};');
      const helper=resolver(new Map([...glossary,['dog',{word:'dog',ja:'犬'}]]));
      const ctx={usefulness:{ja:'プロ制作での実用性',pos:'名詞'}};
      check(helper.resolveWordGloss('Usefulness',ctx)?.info.ja===ctx.usefulness.ja,
        'Context must override generic vocabulary');
      check(helper.resolveWordGloss('usefulness',{})?.info.pos==='名詞',
        'Exact lexicon must provide word classes');
      check(helper.resolveWordGloss('dogs',{})?.kind==='原形参照',
        'Inflected words should fall back to the lemma');
      check(helper.resolveWordGloss('notaword',{})===null,
        'Unknown vocabulary must stay unknown rather than being guessed');
    }catch(e){check(false,'Reader vocabulary regression error: '+e.message);}
  }
}
console.log('文学カード単語監査: '+checkedIds.size+' cards / '+words+' tokens / '+covered+' direct glosses');
console.log('厳格チェック（'+START_STRICT+'以降）: '+strictCards+' cards / '+strictWords+' tokens / '+strictMissing+' missing');
if(legacyMissing){
  console.warn('旧カードの要補完語: '+legacyMissing+' occurrences (legacy migration warning only)');
  console.warn(missingDetails.filter(x=>!x.startsWith('DE-20261025')&&!x.startsWith('DE-20261026')).slice(0,20).join(', '));
}
if(failures.length){
  console.error('Vocabulary validation failed:\n'+failures.map(x=>' - '+x).join('\n'));
  process.exitCode=1;
}else console.log('Literature glossary validation passed.');
