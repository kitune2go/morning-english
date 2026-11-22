#!/usr/bin/env node
// literature-works.json の各作品に addedAt（アップロード日時・JST）を付ける。
// 既に addedAt がある作品はそのまま。無い作品は、その作品の manifest.json が
// 最初にコミットされた日時を使い、まだコミットされていなければ現在時刻を使う。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILE = 'literature-works.json';
const works = JSON.parse(fs.readFileSync(FILE, 'utf8'));

function toJst(date) {
  const t = new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 19);
  return `${t}+09:00`;
}

function firstCommitDate(path) {
  try {
    const out = execFileSync('git', ['log', '--reverse', '--diff-filter=A', '--format=%cI', '--', path], { encoding: 'utf8' }).trim();
    const first = out.split('\n')[0];
    return first ? new Date(first) : null;
  } catch {
    return null;
  }
}

let changed = 0;
for (const w of works) {
  if (w.addedAt) continue;
  const d = (w.manifest && firstCommitDate(w.manifest)) || new Date();
  w.addedAt = toJst(d);
  changed++;
}

if (changed) {
  fs.writeFileSync(FILE, JSON.stringify(works, null, 2) + '\n');
  console.log(`addedAt を ${changed} 件に付けました。`);
} else {
  console.log('すべての作品に addedAt があります。');
}
