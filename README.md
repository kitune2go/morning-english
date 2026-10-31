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
- **全21回・全85段落に全文チャンク分解・段落単位の語彙と語法メモ・重要表現解説・読解メモを付与**しました（全406チャンク、段落別語彙解説487件、重要表現202件）。各段落の直下で展開・折りたたみできます。チャンクは原文の全テキストを順番に復元できるよう厳密に対応させています。**全406チャンクに自然な日本語訳を追加し、全3,472語相当の語形に意味・用法解説を付けました（異なり語889語）。** 冠詞・前置詞・助動詞も省略せず、各チャンクの「このチャンクの全単語」から確認できます。従来の構文読解ヒントは別項目として保持しています。
- 冒頭Day 1〜3にはさらに段落全体の日本語対訳と追加文法解説があります。**Day 4以降の段落単位の自然な全文対訳は未登録**ですが、全段落の全チャンクには日本語訳と全単語の意味・語法解説が付いています。
### 日次対話エッセイの読書管理（文学読解カード）

- `literature.html` で、`daily-essay-YYYYMMDD` の日付別作品も洋書リーダーに近い操作で学習できます。各Chapterの**既読／未読**、作品ごとの進捗一覧・進捗バーを追加しました。既読は手動切替で、移動しただけでは付きません。
- 従来の文学カードの**しおり**を読みかけチェックとして引き継ぎます。日次エッセイを再び開くと、記録したChapterのカードへ自動移動します。既読状態としおりは別に管理します。
- 各カードにChatGPTへの質問欄とコピー機能を追加。作品名・Chapter・英文・日本語原文を質問に添付できます。**既存の日次対話エッセイ23作品・88Chapterに登場する全1,899種類の語形について、和訳と用法メモを登録済み**。6,314語相当のチャンク内単語を原文順に確認できます。難しい語義の文脈確認用ChatGPT質問リンクも残しています。一般語義は英和辞典由来のため、個別の文章に最もふさわしい訳語が必ず先頭にあるとは限りません。
- **文学カードの文脈単語帳**：`literature/essay-context-glossary.json` に `card.id → chunk index → words / phrases` で作品固有の訳語と慣用句を定義します。読書画面では文脈上の意味を「文脈訳」、未注釈語の一般辞典訳を「一般語義」として明示的に区別します。重要表現には自然な訳と語法・構文メモを付け、単語単体からは読み取れない意味を補います。
- 現時点の個別文脈注釈：`DE-20261023-001〜003` と `DE-20261024-001〜004` の合計7 Chapter（語義217件、重要表現43件）。**その他の Chapter は辞典訳を一般語義として表示**します。文脈注釈を追加する際は本文に実在する語形・表現のみ指定し、`node scripts/validate-books.mjs` で検証します。
- 英語辞典の追加データは `literature/essay-glossary-{abcdef,ghijkl,mnopqr,stuv,wxyz}.json` と `literature/essay-glossary-custom.json`。語義の多くは [ejdict-hand](https://github.com/kujirahand/EJDict)（CC0・パブリックドメイン）由来で、変化形は辞典見出し語から補い、技術語・作品固有語には個別の補足を追加。既存『幸福な王子』の2辞典も再利用し、作品別補足が最後に優先されます。
- `node scripts/validate-books.mjs` は既存の23作品のソースJSONを直接巡回して全語形の登録を検査し、**新しいエッセイに未登録語が増えたらCIを失敗**させます。
- ChatGPTリンクは訪問者が自分のChatGPTで開きます。公開サイトにOpenAI APIキーは置きません。既読・しおりはブラウザーの `localStorage` 内に作品別保存（端末間同期なし）。

- **各段落に「チャッピーに質問」リンク**を設置。クリックすると作品名・作者・Day・段落番号・その段落の英文を含む日本語の質問文を ChatGPT の新しい会話に引き継げます。質問欄へ「for eyes の構文が分からない」などと入力すると、そこを優先して質問します。
- 質問リンクは `https://chatgpt.com/?prompt=...` 形式を使います。ChatGPT のブラウザー版やモバイルアプリによっては自動入力されない場合があるため、**「質問文をコピー」**を併設しました。会話が自動送信されることは想定せず、ChatGPT側で確認して送信してください。APIキーは不要で、読書ページから英文を別サーバーへ自動送信しません。
- 日本語訳は初期状態で非表示です。段落・全体のブラウザーTTS音声、速度選択、しおりに相当する前回閲覧位置、読了進捗を備えます。
- **チャプター（Day）別の既読管理**：チャプター選択欄に「✓ 既読／○ 未読」を表示。「チャプター一覧・既読管理」を開くと各回を一覧で確認でき、直接移動・既読付与・既読解除ができます。現在の回にも状態を表示し、既読数を進捗バーへ反映。既存の「読了にする」記録をそのまま引き継ぎます。次の回へ移動しただけでは既読扱いにしません。
- **段落の読みかけチェック・自動再開**：各段落の「□ ここから再開」を押すと「✓ しおり済み」になり、作品別・チャプター別にその段落を保存します。次回ページを開くと最後にチェックしたDay・段落へ自動移動します。チャプター一覧にも「↪ 段落 N から再開」を表示し、その回を選ぶとしおりの位置へ移動。「読みかけの段落へ」ボタンでいつでも最後の位置に戻れます。しおりは再タップで解除。**段落のしおりはチャプターの「既読」と独立**しており、付けても読了扱いにはなりません。既存の読了履歴はそのまま引き継ぎます。
- 閲覧位置と既読状態は`localStorage`に作品別保存。ブラウザー/端末間の同期、日付による閲覧制限、通知の自動配信は行いません。
- `node scripts/validate-books.mjs` でmanifest/連番/本文/単語数/対訳対応に加え、全段落の注釈有無・全チャンク連結時の原文一致・日本語訳の存在・各チャンク内の全文語彙（順番・語形・意味・語法）の網羅を検査します。`.github/workflows/validate-books.yml` にCIを登録しています。

閲覧URL：`https://kitune2go.github.io/morning-english/books.html`

**収録作品：ルキアノス『神々の対話』** — ファウラー兄弟の1905年英訳に収録された19篇・238発言・585チャンクに**チャンク単位の日本語対訳を全件登録**。対訳は章ごとに `books/lucian-dialogues-of-the-gods/chunk-translations/day-NN.json` に保管し、`books.html` の「解説を表示」で各英文の直下に対応訳・全単語と用法メモを表示します。段落全体の日本語訳も従来どおり利用できます。全1,752種類の語形を網羅する辞書は一般的な語義も含むため、読み取りの際は文脈に照らしてください。英語原文の復元と原集26篇中7篇の未収録という制約は従来どおりです。

**新作登録方法：** `books/slug/days.json` を作り、`books-manifest.json` に `id/title/titleJa/author/description/data/sourceUrl` を登録。日次データは `{day,title,wordCount,paragraphs,jp,chunks,grammar,vocabulary,readingPoint,paragraphDetails}`。翻訳がない日は`jp: []`とします。著作権・原文の利用条件は作品ごとに確認してください。

### 全段落注釈のデータ設計

- `books/happy-prince/paragraph-guides.json` — 85段落の文脈メモと202件の重要表現・語法
- `books/happy-prince/lexicon.json` — 作品の重要語に対する意味と用法の辞典
- `books/happy-prince/extended-glossary.json` — 全語網羅のための機能語・活用語形・固有名詞の補充辞書（571件）
- `books/happy-prince/chunk-translations.json` — 85段落・406チャンクの日本語訳
- `books/happy-prince/days.json` の `paragraphDetails[]` — 段落番号に揃えた `summary/chunks/expressions/vocabulary`
- `paragraphDetails[i].chunks[].en` を順番に連結すると必ず `paragraphs[i]` とバイト単位で一致。`chunks[].ja` はチャンク全体の日本語訳です。従来の解説は `chunks[].hint` に保持します。`chunks[].words[]` はチャンクの英文から抽出した全語形を原文順に収録し、各語の `word/ja/note`（形・意味・用法）を備えます。

**注意：** 英文の文体・古風な用法や歴史的語句（原文の綴り上の誤りも含む）は原文を尊重して保持しています。訳文と文法メモは教材として継続的に校正してください。


---

## 読み込み高速化（2026-11）

- 通常英語カード：`cards-catalog.json` に全カードの軽量メタ情報と元ファイルを記録。起動時はカード一覧と当日分の本文だけを取得し、履歴選択時に他の本文を読み込みます。日次追加で `cards-index.json` に新ファイルが増えた場合、軽量索引の次回更新前でも新ファイルを自動検出します。
- 文学版：必要なChapterだけを初期表示。辞書群は「文脈単語帳」を開くまでダウンロードしません。
- 洋書版：`books-manifest.json` の `dayIndex` / `dayBase` がある作品は、軽量な章索引と閲覧中のDayだけを読み込みます。『幸福な王子』は21日分に分割。ルキアノスのチャンク対訳も現在のDay単位で読み込みます。
- 手動でカード・『幸福な王子』本文を更新した場合、コミット前に `node scripts/build-lazy-indexes.mjs` を実行して生成ファイルを同期してください。
- 検証：`node scripts/build-lazy-indexes.mjs --check`（自動CIにも組み込み）。既読・しおりは従来のブラウザ保存キーを継続して使います。


### 日次更新時の軽量索引自動同期

`.github/workflows/refresh-reading-indexes.yml` は `main` の `cards-index.json`、`cards-extra-*.json`、洋書の元データ等への変更を検出し、`cards-catalog.json` と分割した洋書データを自動再生成してコミットします。手動実行も可能です。GitHub Actionsが持つ `GITHUB_TOKEN` によるコミットだけでは通常、新しいPagesビルドは起動しないため、生成索引の公開反映は次の通常コミットによるPagesデプロイ時になります。その間も画面側が索引未収録の新規カードファイルを検出します。
