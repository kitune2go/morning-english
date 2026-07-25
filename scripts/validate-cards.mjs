import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const allowedChunkFunctions = new Set([
  '行動', '対象', '修飾', '時間', '結果', '比較', '接続',
  '場所', '目的', '理由', '様態', '内容', '状態'
]);
const allowedRelativizers = new Set([
  'that', 'which', 'who', 'whom', 'whose', 'where', 'when', 'none'
]);
const requiredExpressionGroups = [
  'vocabulary', 'sentencePatterns', 'comparison',
  'conditional', 'emphasis', 'compression'
];
const suspiciousPhonetics = [
  ['コピーッド', 'copied の誤読候補'],
  ['リライイング', 'relying の誤読候補'],
  ['ケアフリー', 'carefully と carefree の混同候補']
];

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
      value.forEach((item, index) =>
        validateShape(template[0], item, location + '[' + index + ']')
      );
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
      if (Object.hasOwn(value, key)) {
        validateShape(template[key], value[key], location + '.' + key);
      }
    });
  }
}

function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function requireArrayLength(value, min, max, location) {
  if (!Array.isArray(value)) return;
  if (value.length < min || (max !== null && value.length > max)) {
    const range = max === null ? min + '件以上' : min + '〜' + max + '件';
    errors.push(location + ': ' + range + 'にしてください（実際: ' + value.length + '件）');
  }
}

function validateCard(card, location) {
  if (!Number.isInteger(card._no) || card._no <= 0) {
    errors.push(location + '._no: 正の整数にしてください');
  }
  if (typeof card._generatedAt !== 'string' || Number.isNaN(Date.parse(card._generatedAt))) {
    errors.push(location + '._generatedAt: 有効な日時文字列にしてください');
  }

  const completed = String(card.sentence || '').trim();
  if (!completed) errors.push(location + '.sentence: 空にできません');

  const phase5 = card.generateLayer && card.generateLayer.phase5;
  const relativizer = phase5 && String(phase5.relativizer || '').toLowerCase();
  if (!phase5 || !allowedRelativizers.has(relativizer)) {
    errors.push(
      location +
      '.generateLayer.phase5.relativizer: that / which / who / whom / whose / where / when / none のいずれかにしてください'
    );
  }
  if (phase5 && relativizer !== 'none') {
    const pattern = new RegExp('\\b' + relativizer + '\\b', 'i');
    if (!pattern.test(String(phase5.sentence || ''))) {
      errors.push(
        location +
        '.generateLayer.phase5.sentence: relativizer "' +
        relativizer +
        '" が文中にありません'
      );
    }
  }

  const phase5Base = phase5
    ? String(phase5.sentence || '').replace(/[.!?]\s*$/, '')
    : '';
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
        errors.push(
          location +
          '.explainLayer.chunks[' +
          index +
          '].function: 未定義の分類です: ' +
          chunk.function
        );
      }
    });
  }

  // No.34以降は、自動生成カードの内容量と最低品質も検査する。
  if (Number.isInteger(card._no) && card._no >= 34) {
    if (wordCount(completed) > 35) {
      errors.push(location + '.sentence: 35語以内を目安に簡潔化してください');
    }
    if (scores.naturalness < 8 || scores.clarity < 8) {
      errors.push(location + '.scores: naturalness と clarity は8以上にしてください');
    }

    requireArrayLength(card.explainLayer && card.explainLayer.chunks, 4, 7, location + '.explainLayer.chunks');
    requireArrayLength(card.explainLayer && card.explainLayer.grammarPoints, 5, null, location + '.explainLayer.grammarPoints');
    requireArrayLength(card.explainLayer && card.explainLayer.errors, 3, null, location + '.explainLayer.errors');
    requireArrayLength(card.explainLayer && card.explainLayer.variants, 3, null, location + '.explainLayer.variants');
    requireArrayLength(card.expandLayer && card.expandLayer.causalExpansion, 3, null, location + '.expandLayer.causalExpansion');
    requireArrayLength(card.expandLayer && card.expandLayer.structuralShift, 3, null, location + '.expandLayer.structuralShift');

    const network = card.expandLayer && card.expandLayer.expressionNetwork;
    requiredExpressionGroups.forEach((key) => {
      if (!network || !Array.isArray(network[key]) || network[key].length === 0) {
        errors.push(location + '.expandLayer.expressionNetwork.' + key + ': 空にできません');
      }
    });

    suspiciousPhonetics.forEach(([pattern, reason]) => {
      if (String(card.phonetic || '').includes(pattern)) {
        errors.push(location + '.phonetic: ' + reason + '（' + pattern + '）');
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
let previousNumber = -Infinity;
let totalCards = 0;
const displayNumbers = new Set();

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
      if (Number.isInteger(card._no) && card._no <= previousNumber) {
        errors.push(location + '._no: cards-index.jsonの順序で昇順にしてください');
      }
      seenNumbers.add(card._no);
      if (Number.isInteger(card._no)) {
        previousNumber = card._no;
        displayNumbers.add(card._no);
      }
      totalCards += 1;
    });
  }
}

const manifestData = await readJson('cards-manifest.json');
if (!Array.isArray(manifestData) || manifestData.length === 0) {
  errors.push('cards-manifest.json: 空でない配列にしてください');
} else {
  const manifestFiles = new Set();
  for (const file of manifestData) {
    if (manifestFiles.has(file)) {
      errors.push('cards-manifest.json: 重複ファイルがあります: ' + file);
      continue;
    }
    manifestFiles.add(file);

    const cards = await readJson(file);
    if (!Array.isArray(cards) || cards.length === 0) {
      errors.push(file + ': 空でないカード配列にしてください');
      continue;
    }
    cards.forEach((card) => {
      if (Number.isInteger(card && card._no)) displayNumbers.add(card._no);
    });
  }
}

const orderedDisplayNumbers = [...displayNumbers].sort((a, b) => a - b);
orderedDisplayNumbers.forEach((number, index) => {
  const expectedNumber = index + 1;
  if (number !== expectedNumber) {
    errors.push(
      'クライアント表示番号: 連番にしてください（期待: ' +
      expectedNumber +
      ', 実際: ' +
      number +
      '）'
    );
  }
});

if (errors.length > 0) {
  console.error(
    'カード検証に失敗しました:\n\n' +
    errors.map((error) => '- ' + error).join('\n')
  );
  process.exit(1);
}

console.log('カード検証成功: ' + seenFiles.size + 'ファイル / ' + totalCards + '枚');
