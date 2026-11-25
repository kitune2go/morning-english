// 寸劇モード（skit/）の設定と台本を点検する。node scripts/validate-skit.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skit = path.join(root, 'skit');
const errors = [];
const TYPES = new Set(['pinkchan-mirror', 'image', 'emoji']);
const TRIGGERS = new Set(['cardOpen', 'idle', 'dismiss']);
const REASONS = new Set(['read', 'speechEnd', 'button']);
const PLACES = new Set(['textRight', 'textLeft', 'textTop', 'textBottom', 'overText', 'edgeLeft', 'edgeRight', 'offLeft', 'offRight', 'screen', 'random']);
const ACTS = new Set(['bounce', 'shake', 'spin', 'hop', 'wobble', 'sleep', 'poke', 'flip', 'still']);
const STYLES = new Set(['shout', 'whisper']);
const STEP_KEYS = new Set(['who', 'char', 'say', 'style', 'dur', 'async', 'enter', 'as', 'at', 'scale', 'flip', 'tint', 'exit', 'keep', 'move', 'sec', 'act', 'swarm', 'count', 'every', 'tints', 'wait', 'react']);

async function readJson(p) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); }
  catch (e) { errors.push(path.relative(root, p) + ': 読めない／JSONが壊れている: ' + e.message); return null; }
}
const exists = p => fs.access(p).then(() => true, () => false);

const cfg = await readJson(path.join(skit, 'config.json'));
const charIds = [];
if (cfg) {
  for (const [i, c] of (cfg.characters || []).entries()) {
    const at = `config.json characters[${i}]`;
    if (!c.id || !/^[a-z][a-z-]*$/.test(c.id)) errors.push(`${at}: id は英小文字で（数字は分身の番号に使うため不可）`);
    if (charIds.includes(c.id)) errors.push(`${at}: id "${c.id}" が重複`);
    charIds.push(c.id);
    if (!TYPES.has(c.type)) errors.push(`${at}: type "${c.type}" は使えない（${[...TYPES].join(' / ')}）`);
    if (c.type === 'image' && !(c.src && await exists(path.join(skit, c.src)))) errors.push(`${at}: 画像 ${c.src} が見つからない`);
    if (c.defaultAt && !PLACES.has(c.defaultAt)) errors.push(`${at}: defaultAt "${c.defaultAt}" は使えない`);
  }
}
if (cfg?.growth) {
  const g = cfg.growth;
  if (!Array.isArray(g.chars) || !g.chars.length) errors.push('config.json growth.chars が空');
  for (const c of g.chars || []) if (!charIds.includes(c)) errors.push(`config.json growth.chars "${c}" に合うキャラがない`);
  for (const k of ['after', 'every', 'count']) if (g[k] != null && !(typeof g[k] === 'number' && g[k] > 0)) errors.push(`config.json growth.${k} は正の数`);
}
const known = id => typeof id === 'string' && (id === 'any' || charIds.some(c => id.startsWith(c)));

function checkScenes(file, data) {
  if (!data || !Array.isArray(data.scenes)) { errors.push(file + ': scenes 配列がない'); return; }
  for (const [i, sc] of data.scenes.entries()) {
    const at = `${file} scenes[${i}]${sc.id ? '(' + sc.id + ')' : ''}`;
    const w = sc.when || {};
    if (!TRIGGERS.has(w.trigger)) errors.push(`${at}: when.trigger は ${[...TRIGGERS].join(' / ')}`);
    if (w.trigger === 'idle' && !(typeof w.after === 'number' && w.after > 0)) errors.push(`${at}: idle には after（秒）が要る`);
    if (w.reason && !REASONS.has(w.reason)) errors.push(`${at}: reason "${w.reason}" は使えない`);
    if (!Array.isArray(sc.steps) || !sc.steps.length) { errors.push(`${at}: steps が空`); continue; }
    for (const [j, s] of sc.steps.entries()) {
      const sa = `${at} steps[${j}]`;
      for (const k of Object.keys(s)) if (!STEP_KEYS.has(k)) errors.push(`${sa}: 知らないキー "${k}"`);
      for (const k of ['who', 'enter', 'swarm']) if (s[k] != null && !known(s[k])) errors.push(`${sa}: ${k} "${s[k]}" に合うキャラが config.json にない`);
      for (const k of ['at', 'move']) if (s[k] != null && !PLACES.has(s[k])) errors.push(`${sa}: ${k} "${s[k]}" は使えない`);
      if (s.act != null && !ACTS.has(s.act)) errors.push(`${sa}: act "${s.act}" は使えない`);
      if (s.style != null && !STYLES.has(s.style)) errors.push(`${sa}: style "${s.style}" は使えない`);
      if (s.say != null && !(typeof s.say === 'string' || (Array.isArray(s.say) && s.say.every(x => typeof x === 'string')))) errors.push(`${sa}: say は文字列か文字列の配列`);
      const doesSomething = ['say', 'enter', 'exit', 'move', 'act', 'swarm', 'wait', 'react'].some(k => s[k] != null);
      if (!doesSomething) errors.push(`${sa}: 何もしない行`);
    }
  }
}

for (const p of cfg?.scripts || []) checkScenes('skit/' + p, await readJson(path.join(skit, p)));
const cardsDir = path.join(skit, 'cards');
if (await exists(cardsDir)) {
  for (const f of (await fs.readdir(cardsDir)).filter(f => f.endsWith('.json'))) checkScenes('skit/cards/' + f, await readJson(path.join(cardsDir, f)));
}

if (errors.length) { console.error('寸劇の点検でエラー：\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('寸劇の設定と台本：問題なし');
