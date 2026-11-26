# 寸劇モード（skit/）

毎朝の英語（index.html）で、キャラが本文の横で寸劇を始め、放っておくと分身が増えて画面を埋め、学習の邪魔をしてくる演出です。
ヘッダーの「🎭 寸劇」ボタンでオン・オフを切り替えます（初期値はオフ。端末ごとに記憶）。

本文のコードからは切り離してあります。**キャラ・演出・台本はこのフォルダのJSONを書き換えるだけで変えられます。**

```txt
skit/
  skit.js              ← 演出エンジン（ふだんは触らない）
  config.json          ← キャラと演出の設定
  characters/          ← キャラの画像（cat.svg など）
  scripts/default.json ← 全カード共通の台本
  cards/<No>.json      ← カード別の台本（任意。あればそのカードでは共通台本より優先）
```

点検：`node scripts/validate-skit.mjs`（GitHub Actions でも自動で走ります）

---

## 追い払い方

- 「音読」ボタンを押す → 撤収（`dismissOn` に `read`）
- 読み上げ（🔊）を最後まで聞く → 撤収（`dismissOn` に `speechEnd`）
- 右下の「📖 勉強に戻る」 → 撤収（キャラが1体でもいれば常に出る）
- キャラをタップ → その1体だけ消える（`tapToPop`）

撤収後は `cooldownAfterDismiss` 秒たつと、また最初から段階が進みます。

標準の流れ：開く（寸劇）→10秒 黒猫→20秒 口論→32秒 増殖→45秒 総出→55秒以降は2.5秒ごとに3体ずつ増え続ける（最大60体）。

---

## config.json

| キー | 意味 |
|---|---|
| `maxActors` | 同時に出せる最大数 |
| `openDelay` | カードを開いてから最初の場面までの秒数 |
| `secPerChar` | 吹き出しの表示時間（1文字あたり秒） |
| `tapToPop` | タップで1体消せるか |
| `cooldownAfterDismiss` | 撤収後、再び出てくるまでの秒数 |
| `dismissOn` | 撤収のきっかけ（`read` / `speechEnd`） |
| `growth` | 最後の段階のあとも増え続ける設定。`after` 秒から `every` 秒ごとに `count` 体ずつ、`chars` から選んで湧く。`say` の中からときどき1体がしゃべる（`sayChance`）。`maxActors` で止まる |
| `characters` | キャラの一覧（下） |
| `scripts` | 共通台本のファイル |
| `perCard` | カード別台本の場所。`{no}` がカード番号になる |

### キャラを足す

`characters` に1件足すだけです。`id` は英小文字（数字は分身の番号に使うので入れない）。

```json
{
  "id": "boy",
  "name": "赤い帽子の少年",
  "type": "image",
  "src": "characters/boy.png",
  "size": 90,
  "aspect": 1.2,
  "color": "#d33",
  "defaultAt": "textLeft",
  "scaleRange": [0.9, 1.1],
  "popLines": ["うわっ"]
}
```

| type | 中身 |
|---|---|
| `pinkchan-mirror` | ピンクちゃんの絵をそのまま写す分身（体を共有しているので口・瞬きは全員そろう） |
| `image` | 画像（SVG / PNG / GIF）。`src` は skit/ からの相対パス |
| `emoji` | 絵文字1文字（`"emoji": "🐸"`）。素材がないときの仮置き用 |

そのほか：`canSpeak: false`（しゃべらない。`who: "any"` で選ばれない）、`tints`（分身の色違い。色相の度数）、`flipChance`（左右反転で出てくる確率）、`filter`（CSSのfilter）。

---

## 台本

台本は「場面（scene）」の集まりです。場面は `when` で始まるタイミングが決まり、`steps` を上から順に演じます。

```json
{
  "scenes": [
    {
      "id": "open-a",
      "when": { "trigger": "cardOpen" },
      "steps": [
        { "enter": "pink", "at": "textRight" },
        { "who": "pink", "say": "今日の動詞は {coreVerb} だって" },
        { "enter": "pink2", "at": "textLeft", "flip": true },
        { "who": "pink2", "say": "読まないに一票", "act": "bounce" }
      ]
    }
  ]
}
```

### when（きっかけ）

| trigger | いつ |
|---|---|
| `cardOpen` | カードを開いたとき |
| `idle` + `after: 秒` | カードを開いて（または撤収して）から何秒たったか。秒数の小さい順に1回ずつ。**段階を上げる演出はここで組む** |
| `dismiss` + `reason` | 撤収するとき（`read` / `speechEnd` / `button`）。捨て台詞を言ってから全員消える |

同じきっかけの場面が複数あるときは、ランダムに1つ選ばれます。`"once": true` を付けると、同じカードでは一度しか選ばれません。

### steps（1行ずつ）

| 書き方 | 動き |
|---|---|
| `{ "who": "pink", "say": "…" }` | しゃべる（吹き出し）。いなければその場に出てくる |
| `"say": ["A", "B"]` | どれか1つをランダムに |
| `"style": "shout"` / `"whisper"` | 大声／小声の吹き出し |
| `{ "enter": "pink2", "at": "textLeft" }` | 登場。`pink2` `pink3` …が分身。同じ名前がもういれば次の番号で出る |
| `"tint": 20` / `"flip": true` / `"scale": 1.2` | 登場時の色違い・反転・大きさ |
| `{ "who": "cat", "move": "overText", "sec": 2 }` | 移動 |
| `{ "who": "pink", "act": "shake" }` | 動き：`bounce` `shake` `spin` `hop` `poke` `flip`、続けるもの `wobble` `sleep`（止めるのは `still`） |
| `{ "swarm": "pink", "count": 10, "every": 0.2 }` | 大量発生（`say` を付けると誰か1体がしゃべる） |
| `{ "exit": "pink2" }` / `"all"` / `"others"` | 退場 |
| `{ "react": "surprise" }` | 本体ピンクちゃんのリアクション（`nod` `happy` `surprise` `wave` `excited`） |
| `{ "wait": 1.5 }` | 間（秒） |
| `"who": "any"` | いる中から誰か（しゃべれるキャラ優先） |

### 立ち位置（at / move）

`textRight` `textLeft` `textTop` `textBottom`（本文の周り）、`overText`（本文の上）、`edgeLeft` `edgeRight`（画面の端）、`offLeft` `offRight`（画面の外。歩いて入ってくるとき）、`screen`（見えている画面のどこか）

### 差し込み（セリフの中で使える）

`{coreVerb}` 今日の動詞　`{theme}` テーマ　`{word}` 本文から拾った長めの単語　`{firstWords}` 本文の最初の3語　`{no}` カード番号　`{trans}` 和訳

---

## カード別の台本を自動生成するとき

`skit/cards/<カード番号>.json` に同じ形式で置くだけです（例：`skit/cards/218.json`）。
そのカードでは、置いた場面のきっかけ（`cardOpen` など）だけが共通台本より優先され、無いきっかけは共通台本が使われます。
作ったら `node scripts/validate-skit.mjs` で点検してください。

## 文学版（literature.html）

共通エンジンとON/OFF設定を共有します。個別台本は `skit/cards/<文学カードID>.json`（例：`skit/cards/DE-20261126-001.json`）に同じ scenes 形式で保存します。全Chapter表示時は画面上部から35%付近のカードを対象にします。`{no}` は文学カードID、`{theme}` はカードタイトル、`{trans}` は日本語本文です。文学版では `{coreVerb}` は空になるため個別台本では使用を避けてください。読み上げ（本文・チャンク）の正常終了で撤収します。台本がなければ共通台本にフォールバックします。
