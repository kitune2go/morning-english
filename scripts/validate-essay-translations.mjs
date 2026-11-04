#!/usr/bin/env node
// Structural coverage checks only. Semantic fidelity is reviewed independently.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
const STRICT_FROM='20261101';
const errors=[];
const check=(condition,message)=>{if(!condition)errors.push(message);};
const works=read('literature-works.json').filter(w=>/^daily-essay-\d{8}$/.test(w.workId));
const ids=new Set();
let checked=0,legacyMismatches=0;

for(const work of works){
  const strict=work.workId.slice(-8)>=STRICT_FROM;
  const manifest=read(work.manifest);
  check(Array.isArray(manifest)&&manifest.length>0,work.workId+': invalid manifest');
  if(!Array.isArray(manifest))continue;
  for(const source of manifest){
    const cards=read(source);
    check(Array.isArray(cards)&&cards.length>0,source+': no cards');
    if(!Array.isArray(cards))continue;
    for(const card of cards){
      const label=card.id||source;
      check(!ids.has(card.id),label+': duplicate ID');
      ids.add(card.id);
      if(!strict)continue;
      checked++;
      for(const key of ['jp','translationLiteral','translationNatural','translationNote'])
        check(typeof card[key]==='string'&&normalize(card[key]).length>0,label+': missing '+key);
      check(card.mode==='essay-translation',label+': incorrect mode');
      check(Array.isArray(card.chunks)&&card.chunks.length>=3&&card.chunks.length<=7,label+': 3-7 chunks required');
      if(!Array.isArray(card.chunks))continue;
      for(const [index,chunk] of card.chunks.entries()){
        check(typeof chunk.en==='string'&&normalize(chunk.en)!=='',label+': empty English in chunk '+(index+1));
        check(typeof chunk.ja==='string'&&normalize(chunk.ja)!=='',label+': empty Japanese in chunk '+(index+1));
        check(normalize(chunk.en)!==normalize(chunk.ja),label+': same language content in chunk '+(index+1));
      }
      const joined=normalize(card.chunks.map(c=>c.en).join(' '));
      check(joined===normalize(card.translationNatural),label+': chunks omit/reorder/alter natural English');
    }
  }
}
console.log('Daily essay translation integrity: '+checked+' recent cards checked (strict since '+STRICT_FROM+').');
console.log('NOTE: Matching English chunks does NOT prove Japanese-English semantic equivalence; apply docs/DAILY_ESSAY_TRANSLATION_QA.md before publication.');
if(errors.length){
  console.error('Translation integrity failures:\n'+errors.map(e=>' - '+e).join('\n'));
  process.exitCode=1;
}else console.log('Daily essay translation structural validation passed.');
