import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const allowedChunkFunctions = new Set([
  '行動', '対象', '修飾', '時間', '結果', '比較', '接続',
  '場所', '目的', '理由', '様態', '内容', '状態'
]);

async function readJson(relativePath) {
  try {
    const text = await fs.readFile(path.join(root, relativePath), 'utf8');
    return JSON.parse(text);
  } catch (error) {
    errors.push(relativePath + ': 読み込みまたはJSON解析に失敗しました: ' + error.message);
    return null;
  }
}

function typeName(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function validateShape(template, value, location) {
  const expectedType = typeName(template);
  const actualType = typeName(value);

  if (expectedType !== actualType) {
    errors.push(location + ': 型が不一致です（期待: ' + expectedType + ', 実際: ' + actualType + '）');
    return;
  }

  if (expectedType === 'array') {
    if (value.length === 0) {
      errors.push(location + ': 配列を空にできません');
      return;
    }
    if (template.length > 0) {
      value.forEach((item, index) => validateShape(template[0], item, location + '[' + index + ']'));
    }
    return;
  }

  if (expectedType === 'object') {
    const expectedKeys = Object.keys(template).sort();
    const actualKeys = Object.keys(value).sort();
    const missing = expectedKeys.filter((key) => !actualKeys.includes(key));
    const extra = actualKeys.filter((key) => !expectedKeys.includes(key));

    if (missing.length > 0) errors.push(location + ': 不足キー: ' + missing.join(', '));
    if (extra.length > 0) errors.push(location + ': 未定義キー: ' + extra.join(', '));

    expectedKeys.forEach((key) => {
      if (Object.hasOwn(value, key)) validateShape(template[key], value[key], location + '.' + key);
    });
  }
}

function validateCard(card, location) {
  if (!Number.isInteger(card._no) || card._no <= 0) {
    errors.push(location + '._no: 正の整数にしてください');
  }
  if (typeof card._generatedAt !== 'string' || Number.isNaN(Date.parse(card._generatedAt))) {
    errors.push(location + '._generatedAt: 有効な日時文字列にしてください');
  }

  const completed = card.sentence || '';
  if (!/\bthat\b/i.test(completed)) {
    errors.push(location + '.sentence: that節が必要です');
  }
  if (!/,\s*which\b/i.test(completed)) {
    errors.push(location + '.sentence: 「, which」による結果節が必要です');
  }
  if (!/\bthan\b/i.test(completed)) {
    errors.push(location + '.sentence: thanを使った比較表現が必要です');
  }

  const phase5 = card.generateLayer && card.generateLayer.phase5;
  if (!phase5 || phase5.relativizer !== 'that') {
    errors.push(location + '.generateLayer.phase5.relativizer: "that" に固定してください');
  }
  if (!phase5 || !/\bthat\b/i.test(phase5.sentence || '')) {
    errors.push(location + '.generateLayer.phase5.sentence: that節が必要です');
  }

  const phase5Base = phase5 ? String(phase5.sentence || '').replace(/[.!?]\s*$/, '') : '';
  if (phase5Base && !completed.startsWith(phase5Base)) {
    errors.push(location + '.sentence: Phase 5の文を先頭部分として完成文を組み立ててください');
  }

  const scores = card.scores || {};
  ['naturalness', 'clarity', 'flexibility', 'focus', 'efficiency'].forEach((key) => {
    const score = scores[key];
    if (typeof score !== 'number' || score < 0 || score > 10) {
      errors.push(location + '.scores.' + key + ': 0〜10の数値にしてください');
    }
  });

  const chunks = card.explainLayer && card.explainLayer.chunks;
  if (Array.isArray(chunks)) {
    chunks.forEach((chunk, index) => {
      if (!allowedChunkFunctions.has(chunk.function)) {
        errors.push(location + '.explainLayer.chunks[' + index + '].function: 未定義の分類です: ' + chunk.function);
      }
    });
  }
}

const indexData = await readJson('cards-index.json');
const templateData = await readJson('card-template.json');

if (!indexData || !templateData) {
  console.error(errors.join('\n'));
  process.exit(1);
}
if (!Array.isArray(indexData.cards) || indexData.cards.length === 0) {
  errors.push('cards-index.json: cardsは空でない配列にしてください');
}
if (!Array.isArray(templateData) || templateData.length !== 1) {
  errors.push('card-template.json: 1枚だけを含む配列にしてください');
}

const templateCard = Array.isArray(templateData) ? templateData[0] : null;
const seenFiles = new Set();
const seenNumbers = new Set();
let previousNumber = null;
let totalCards = 0;

if (Array.isArray(indexData.cards) && templateCard) {
  for (const file of indexData.cards) {
    if (seenFiles.has(file)) {
      errors.push('cards-index.json: 重複ファイルがあります: ' + file);
      continue;
    }
    seenFiles.add(file);

    const cards = await readJson(file);
    if (!Array.isArray(cards) || cards.length === 0) {
      errors.push(file + ': 空でないカード配列にしてください');
      continue;
    }

    cards.forEach((card, index) => {
      const location = file + '[' + index + ']';
      validateShape(templateCard, card, location);
      validateCard(card, location);

      if (seenNumbers.has(card._no)) {
        errors.push(location + '._no: 番号が重複しています: ' + card._no);
      }
      if (Number.isInteger(card._no)) {
        const expectedNumber = previousNumber === null ? 1 : previousNumber + 1;
        if (card._no !== expectedNumber) {
          errors.push(location + '._no: 連番にしてください（期待: ' + expectedNumber + ', 実際: ' + card._no + '）');
        }
        previousNumber = card._no;
      }
      seenNumbers.add(card._no);
      totalCards += 1;
    });
  }
}

if (errors.length > 0) {
  console.error('カード検証に失敗しました:\n\n' + errors.map((error) => '- ' + error).join('\n'));
  process.exit(1);
}

console.log('カード検証成功: ' + seenFiles.size + 'ファイル / ' + totalCards + '枚');
