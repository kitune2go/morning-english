# Already Burnin’｜もう燃え上がってる

2026年11月25日の対話で制作した英語オリジナル歌詞。既存楽曲の転載ではない。
英語原詞を正本とし、繰り返しを含む全10セクションを収録した。
日本語欄は訳文。既存カード形式の `translationLiteral` と
`translationNatural` はともに同じ英語原詞を保持する。
`originalLanguage: "en"` により、画面と質問文では英語原詞・日本語訳を区別する。

## 対訳・文脈の校閲

- 各チャンクを原詞から訳し、原詞・日本語訳・文脈注釈を照合した。
- `pavement’s` / `Driver’s` / `owner’s` の is / has を後続語から判別した。
- 父親・息子・店主・女性の代名詞を局所的に特定した。場面をまたぐ女性の同一性は断定しない。
- 仕事の終了は暗示として扱い、メッセージに書かれていない解雇理由を足さない。
- `burnin’` は熱・不満の比喩として読めることを説明し、火災の断定は避けた。
- `quarter` は硬貨、`station` は放送局、`kill his engine` はエンジン停止とした。
- `reaches for` から実際のつまみ操作を補わず、`could’ve` と `didn’t have to` の過去の可能性・不要性を区別した。
- 最初のサビの否定疑問が最後のサビの平叙文に変わること、末尾の現在完了進行形の省略を確認した。
- 発音を写した綴りと原詞の改行を保持。読書画面のトークン抽出に合わせ、末尾アポストロフィを除く辞書キーにも定義を付けた。

## 制作時のStyle

Smoldering psychedelic soul and gritty funk, 84 BPM, deep syncopated bass groove,
loose drums sitting behind the beat, dry snare, ticking hi-hats, muted wah-wah guitar,
warm Rhodes, low Hammond organ, occasional tense horn stabs. Intimate, slightly raspy
male lead vocal with conversational phrasing, simmering frustration, and restrained
grit. Gospel-rooted backing vocals answer “Already burnin’” in the chorus. Dusty analog
warmth, subtle tape saturation, close room sound. Verses stay sparse; choruses build
through layered voices and stronger rhythmic pressure. Stripped-down call-and-response
breakdown, then a communal final chorus. End with bass, organ, and fading voices.
Mood: everyday exhaustion reaching a breaking point, quiet solidarity, heat rising
beneath routine.

## 検証

- `node scripts/validate-literature-glossary.mjs`: PASS（全文語彙の欠落なし）
- `node scripts/validate-books.mjs`: PASS
- `node scripts/validate-essay-translations.mjs`: PASS
- インラインJavaScript構文、新規全10章のHTML生成・質問文、既存日本語原文エッセイの表示分岐: PASS
- 公開後のブラウザー（幅1363px）で作品選択・全10章の索引・原詞の改行・日本語訳ラベル・質問リンク・文脈単語帳の読込完了・横はみ出しなしを確認した。
- ローカルでの390px / 1280px実画面検査は未実施。Chromium本体がなく取得も403で、クラウドブラウザーからローカルプレビューにも接続できなかった。
- `build-lazy-indexes.mjs --check` は既存 `index.html` の外部 pinkchan.js とインラインscriptをまとめて数え「exactly one inline script」で失敗する。この作品追加に起因せず、生成索引の差分もない。
