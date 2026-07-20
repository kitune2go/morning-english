# morning-english

CEG+ v2.0 English learning cards and literary reading cards.

このリポジトリには、主に2系統のカードがあります。

```txt
1. 毎朝の英語：index.html
2. 文学版：literature.html
```

---

## 1. 毎朝の英語にカードを追加する場合

毎朝の英語は `cards-index.json` が読み込みファイル一覧です。

例：

```json
{
  "cards": [
    "cards.json",
    "cards-extra-4-6.json",
    "cards-extra-20260503.json"
  ]
}
```

新しいカードJSONを作っただけでは反映されません。必ず `cards-index.json` に登録してください。

### 追加手順

```txt
1. 新しいカードJSONを作成する
   例：cards-extra-20260504.json

2. cards-index.json の cards 配列にファイル名を追加する

3. GitHub Pagesで確認する
```

確認URL：

```txt
https://kitune2go.github.io/morning-english/index.html?v=数字
```

キャッシュ回避のため、確認時は `?v=28` のように数字を増やしてください。

---

## 2. 毎朝の英語カードの基本形式

カードファイルは配列形式です。

```json
[
  {
    "_no": 104,
    "_generatedAt": "2026-05-04T10:00:00",
    "sentence": "I notice small changes that appear in daily life, which helps me understand myself more clearly than before.",
    "phonetic": "アイ ノーティス スモール チェンジズ ...",
    "japaneseTranslation": "私は日常生活に現れる小さな変化に気づいている。それが以前よりも自分自身を明確に理解する助けになっている。",
    "theme": "自己理解",
    "coreVerb": "notice",
    "generateLayer": {},
    "explainLayer": {},
    "expandLayer": {},
    "scores": {}
  }
]
```

主要項目：

```txt
_no
_generatedAt
sentence
phonetic
japaneseTranslation
theme
coreVerb
generateLayer
explainLayer
expandLayer
scores
```

`explainLayer.chunks` は以下の形式です。

```json
{
  "text": "I notice",
  "function": "行動",
  "translation": "私は気づく"
}
```

よく使う `function`：

```txt
行動
対象
修飾
時間
結果
比較
接続
場所
目的
理由
様態
内容
状態
```


### 厳格な生成規則

毎朝の英語カードは、必ず [`card-template.json`](card-template.json) を原型として作成してください。既存カードを眺めて形式を推測したり、独自のキーを追加したりしないでください。

#### JSON構造

`generateLayer` の各Phaseは、以下のキーに固定します。

| Phase | 必須キー |
|---|---|
| `phase1` | `sentence`, `translation` |
| `phase2` | `sentence`, `translation`, `addedChunks` |
| `phase3` | `sentence`, `translation`, `connector` |
| `phase4` | `sentence`, `translation`, `comparison` |
| `phase5` | `sentence`, `translation`, `relativizer` |

`phase5.relativizer` は `"that"` に固定します。`pattern` や `connector` など、テンプレートにないキーを `phase5` へ追加してはいけません。

#### 完成文の構造

`sentence` は原則として、次の順序で組み立てます。

```txt
Phase 5の本文（that節を含む）
, which による結果節
than を使った比較表現
```

例：

```txt
I notice small changes that appear in daily life,
which helps me understand myself more clearly than before.
```

完成文の先頭部分は、末尾の句読点を除いて `generateLayer.phase5.sentence` と一致させてください。

#### 追加前後の検証

カードを作成したら、GitHubへ書き込む前に次を実行します。

```bash
node scripts/validate-cards.mjs
```

検証内容：

```txt
card-template.json との全階層のキー・型比較
未定義キーと不足キーの検出
Phase 5 の relativizer: "that"
完成文の that節 / , which節 / than比較
Phase 5 と完成文の接続
カード番号と読み込みファイルの重複
スコア範囲とチャンク分類
cards-index.json に登録された全カードのJSON解析
```

検証に失敗したカードは追加・登録しないでください。GitHub Actionsでも、カード関連ファイルの変更時に同じ検証が自動実行されます。

---

## 3. 文学版にカードを追加する場合

文学版は作品ごとに manifest を持ちます。

『地下鉄のコンヴィヴィウム｜全文翻訳』の作品ID：

```txt
convivium-sentence
```

manifest：

```txt
literature/convivium-sentence/manifest.json
```

例：

```json
[
  "literature/convivium-sentence/sentences-001-010.json",
  "literature/convivium-sentence/sentences-011-020.json"
]
```

文学版も、新しいカードJSONを作っただけでは反映されません。必ず作品の `manifest.json` に登録してください。

確認URL：

```txt
https://kitune2go.github.io/morning-english/literature.html?v=数字
```

---

## 4. 文学版カードの基本形式

```json
{
  "id": "CV-S105",
  "sourceTitle": "地下鉄のコンヴィヴィウム｜全文翻訳",
  "workId": "convivium-sentence",
  "mode": "sentence-translation",
  "chapter": 105,
  "sentence": 105,
  "title": "カードタイトル",
  "jp": "日本語原文。",
  "translationLiteral": "Literal English translation.",
  "translationNatural": "Natural English translation.",
  "imageUrl": "",
  "imageCaption": "後で画像を貼る場合の説明。",
  "imagePrompt": "画像生成用プロンプト。",
  "chunks": [
    { "en": "Natural chunk", "ja": "自然なチャンク訳" }
  ],
  "grammar": [
    "文法説明。"
  ],
  "translationNote": "翻訳上の注意。",
  "readingPoint": "読解ポイント。",
  "keywords": ["keyword"]
}
```

画像なしで運用する場合は、以下のようにします。

```json
"imageUrl": ""
```

`imagePrompt` と `imageCaption` は残して構いません。後で画像を追加するときに使えます。

---

## 5. 文学版の現在の機能

`literature.html` には以下の機能があります。

```txt
作品選択
Chapter選択
全文カード表示
英語読み上げ
日本語読み上げ
チャンクごとの EN / JA 読み上げ
画像表示枠
Image Prompt 折りたたみ表示
作品ごとのしおり機能
```

しおりはブラウザの `localStorage` に保存されます。GitHub側のデータ変更は不要です。

---

## 6. よくある失敗

### 失敗1：カードJSONだけ作って index / manifest に登録しない

```txt
毎朝の英語 → cards-index.json に登録
文学版 → literature/作品ID/manifest.json に登録
```

### 失敗2：GitHub Pagesのキャッシュ

確認URLは必ず数字を上げます。

```txt
index.html?v=29
literature.html?v=29
```

### 失敗3：文学版と毎朝の英語を混同する

```txt
毎朝の英語：cards-index.json
文学版：literature/作品ID/manifest.json
```

### 失敗4：カード形式が違う

毎朝の英語：

```txt
sentence
japaneseTranslation
generateLayer
explainLayer
expandLayer
scores
```

文学版：

```txt
jp
translationLiteral
translationNatural
chunks
grammar
readingPoint
```

---

## 7. 依頼テンプレート

### 毎朝の英語に追加したい場合

```txt
kitune2go/morning-english の毎朝の英語にカードを3枚追加してください。
新規ファイル cards-extra-YYYYMMDD.json を作成し、
cards-index.json に必ず登録してください。
確認URLは index.html?v=数字 で出してください。
```

### 文学版に追加したい場合

```txt
kitune2go/morning-english の文学版にカードを追加してください。
作品IDは convivium-sentence です。
新規ファイルを literature/convivium-sentence/ に作成し、
literature/convivium-sentence/manifest.json に必ず登録してください。
確認URLは literature.html?v=数字 で出してください。
```

---

## 8. 現在の安全運用方針

```txt
画像は当面なし
imageUrl は空文字
imagePrompt は残す
本文カードと音声・しおりを優先
画像は後から WebP / JPG を VSCode でPushして差し替え
```

---

## 9. 確認用URL

毎朝の英語：

```txt
https://kitune2go.github.io/morning-english/index.html?v=数字
```

文学版：

```txt
https://kitune2go.github.io/morning-english/literature.html?v=数字
```
