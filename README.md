# morning-english

CEG+ v2.1 English learning cards and literary reading cards.

このリポジトリには、主に2系統のカードがあります。

```txt
1. 毎朝の英語：index.html
2. 文学版：literature.html
```

---

## 1. 毎朝の英語にカードを追加する場合

毎朝の英語は `cards-index.json` が読み込みファイル一覧です。新しいカードJSONを作成しただけでは反映されません。必ず `cards-index.json` の `cards` 配列へ登録してください。

```txt
1. cards-extra-YYYYMMDD.json を作成
2. cards-index.json にファイル名を追加
3. node scripts/validate-cards.mjs を実行
4. GitHub Pagesで確認
```

確認URL：

```txt
https://kitune2go.github.io/morning-english/index.html?v=数字
```

---

## 2. 毎朝の英語カードの基本形式

カードファイルは配列形式です。新規カードは必ず [`card-template.json`](card-template.json) のキー・階層・型を維持してください。

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

`generateLayer` の各Phaseで使うキーは固定です。

| Phase | 必須キー |
|---|---|
| `phase1` | `sentence`, `translation` |
| `phase2` | `sentence`, `translation`, `addedChunks` |
| `phase3` | `sentence`, `translation`, `connector` |
| `phase4` | `sentence`, `translation`, `comparison` |
| `phase5` | `sentence`, `translation`, `relativizer` |

キー名は固定ですが、**that / which / than を毎回使う必要はありません**。

- `phase3.connector`：使わない場合は `"none"`
- `phase4.comparison`：比較を使わない場合は `"none"`
- `phase5.relativizer`：関係詞を使わない場合は `"none"`
- 関係詞を使う場合は `that`, `which`, `who`, `whom`, `whose`, `where`, `when` のいずれか

### 完成文の生成原則

完成文は `generateLayer.phase5.sentence` を先頭部分として使います。ただし、同じテンプレート構文を機械的に繰り返してはいけません。

避ける例：

```txt
Phase 5のthat節
, whichによる結果節
thanによる比較
```

を題材に関係なく全カードへ押し込むこと。

推奨：

- 題材に合う文型を選ぶ
- 一文が重くなる場合は二文に分ける
- 原則35語以内
- 主語、動作主体、代名詞の参照、比較対象を明確にする
- 日本語訳と意味・時制・因果・比較を一致させる
- 専門分野では内容の正確さを優先する

3枚を同時生成する場合、完成文の主構造を少なくとも2種類以上に分けてください。

例：

```txt
1枚目：分詞・時間節
2枚目：while / whereasによる対照
3枚目：比較文 + 独立した補足文
```

---

## 3. 内容量と品質基準

No.34以降の新規カードでは、最低限次を満たしてください。

```txt
explainLayer.chunks：4〜7件
grammarPoints：5件以上
errors：3件以上
variants：3件以上
causalExpansion：3件以上
structuralShift：3件以上
```

`expressionNetwork` の以下はすべて空にできません。

```txt
vocabulary
sentencePatterns
comparison
conditional
emphasis
compression
```

`errors` には文法・語法・語順・一致など、**英語上の誤り**だけを入れてください。内容上の反論や事実訂正を入れてはいけません。

`scores.naturalness` と `scores.clarity` は8以上を合格条件とします。ただし、欠点がある案へ機械的に9〜10点を付けてはいけません。基準未達なら英文を修正してから再評価してください。

カタカナ発音は綴りの機械変換を避け、別の英単語に聞こえる表記を残さないでください。

---

## 4. 検証

追加前に実行：

```bash
node scripts/validate-cards.mjs
```

検証内容：

```txt
card-template.json との全階層のキー・型一致
未定義キーと不足キー
phase5.relativizer の許可値と本文対応
Phase 5 と完成文の接続
No.34以降の内容量
完成文の語数
naturalness / clarity
発音の既知の誤変換
カード番号とファイルの重複
表示番号の連番
スコア範囲
チャンク分類
```

検証スクリプトはJSON構造と機械的に確認できる品質だけを扱います。英文の自然さ、専門内容の正確さ、日本語訳との意味一致は、書き込み前に別工程で必ず監査してください。

---

## 5. 文学版にカードを追加する場合

文学版は作品ごとにmanifestを持ちます。

例：

```txt
literature/convivium-sentence/manifest.json
literature/daily-essay-YYYYMMDD/manifest.json
```

新しいカードJSONを作成しただけでは反映されません。作品の `manifest.json` と、必要に応じて `literature-works.json` へ登録してください。

文学版カードの基本項目：

```txt
id
sourceTitle
workId
mode
chapter
sentence
title
jp
translationLiteral
translationNatural
imageUrl
imageCaption
imagePrompt
chunks
grammar
translationNote
readingPoint
keywords
```

画像なしで運用する場合：

```json
"imageUrl": ""
```

確認URL：

```txt
https://kitune2go.github.io/morning-english/literature.html?v=数字
```

---

## 6. よくある失敗

### カードJSONだけ作って索引へ登録しない

```txt
毎朝の英語 → cards-index.json
文学版 → 作品のmanifest.jsonとliterature-works.json
```

### that / which / than を全カードへ強制する

構造条件を満たしても、英文の意味関係や比較対象が崩れていれば不合格です。文型は題材から選びます。

### GitHub Pagesのキャッシュ

確認URLの `v` を更新してください。

### 文学版と毎朝の英語を混同する

```txt
毎朝の英語：sentence / generateLayer / explainLayer / expandLayer
文学版：jp / translationLiteral / translationNatural / chunks / grammar
```

---

## 7. 現在の安全運用方針

```txt
画像は当面なし
imageUrl は空文字
imagePrompt は残す
本文カードと音声・しおりを優先
```

---

## 8. 洋書読書（Books）

入口：`books.html`（`index.html` と `literature.html` にリンクあり）

- `books-manifest.json` に作品を登録し、各作品の `data` に分割された読書データJSONを指定します。
- 初期教材は Oscar Wilde『The Happy Prince（幸福な王子）』全文。21回・85段落・3,471語を段落単位で収録しています。原文はProject Gutenberg eBook #902（GITenbergテキスト）に基づきます。
- 冒頭Day 1〜3には段落対訳・チャンク・文法解説・読解ポイントがあり、Day 4〜21には原文と語彙補助があります。**Day 4以降の全文和訳は未登録**であり、自動生成・外部翻訳サービス送信もしていません。
- 日本語訳は初期状態で非表示です。段落・全体のブラウザーTTS音声、速度選択、しおりに相当する前回閲覧位置、読了進捗を備えます。
- 閲覧位置と既読状態は`localStorage`に作品別保存。ブラウザー/端末間の同期、日付による閲覧制限、通知の自動配信は行いません。
- `node scripts/validate-books.mjs` でmanifest/連番/本文/単語数/対訳対応を検査します。`.github/workflows/validate-books.yml` にCIを登録しています。

閲覧URL：`https://kitune2go.github.io/morning-english/books.html`

**新作登録方法：** `books/slug/days.json` を作り、`books-manifest.json` に `id/title/titleJa/author/description/data/sourceUrl` を登録。日次データは `{day,title,wordCount,paragraphs,jp,chunks,grammar,vocabulary,readingPoint}`。翻訳がない日は`jp: []`とします。著作権・原文の利用条件は作品ごとに確認してください。
