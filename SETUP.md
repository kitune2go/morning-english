# 毎朝の英語 — セットアップガイド

このZIPには、スマホのホーム画面に追加して毎朝起動できる**英語学習アプリ一式**が含まれています。

---

## 📦 ZIPの中身

```
morning-english/
  ├── index.html          ← アプリ本体（PCで開けば即動作）
  ├── manifest.json       ← PWA設定（ホーム画面追加用）
  ├── cards.json          ← サンプル3枚（後で100枚に置き換え）
  ├── icon-192.svg        ← アプリアイコン
  ├── icon-512.svg        ← アプリアイコン（高解像度）
  ├── icon-maskable.svg   ← Androidマスカブルアイコン
  ├── generate_cards.py   ← カード生成スクリプト（PCで実行）
  └── SETUP.md            ← このファイル
```

---

## 🚀 最短セットアップ（15分）

### ① ZIPを解凍
ZIPを解凍。フォルダごとデスクトップなど好きな場所へ。

### ② VSCodeで開く
VSCodeの「File」→「Open Folder」で `morning-english` フォルダを開く。

### ③ PCで動作確認
VSCodeのターミナルで:
```bash
python3 -m http.server 8000
```
ブラウザで `http://localhost:8000` を開いてアプリが動くか確認 → `Ctrl+C`で停止。

### ④ Gitで初期化
```bash
git init
git add .
git commit -m "Initial commit"
```

### ⑤ GitHubにリポジトリ作成
1. [github.com](https://github.com) にログイン → 右上「+」→ 「New repository」
2. **Repository name**: `morning-english`
3. **Public** を選択
4. README/.gitignore等のチェックは**全部外す**
5. 「Create repository」

### ⑥ ローカルとGitHubを連携
GitHubに表示されたコマンドをコピーして実行（だいたいこんな感じ）:
```bash
git remote add origin https://github.com/あなたのID/morning-english.git
git branch -M main
git push -u origin main
```

⚠️ Push時に認証エラーが出たら:
- GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
- スコープに `repo` を選択して生成
- 生成されたトークンをパスワード代わりに入力

### ⑦ GitHub Pagesを有効化
1. リポジトリ画面の上部 → 「**Settings**」
2. 左サイドバー → 「**Pages**」
3. **Source**: 「Deploy from a branch」
4. **Branch**: 「main」/「(root)」
5. 「**Save**」

数分待つと:
```
Your site is live at https://あなたのID.github.io/morning-english/
```
が表示される。

### ⑧ スマホでホーム画面に追加

**iPhone (Safari)**:
1. Safariで `https://あなたのID.github.io/morning-english/` を開く
2. 共有ボタン → 「ホーム画面に追加」 → 「追加」

**Android (Chrome)**:
1. Chromeで上記URLを開く
2. 右上 ︙ メニュー → 「ホーム画面に追加」 / 「アプリをインストール」

✅ 完了！ ホーム画面に「朝」アイコン

---

## 🎴 本番カードを生成する

サンプルは3枚しかないので、100日分のカードを自分で生成します。

### 必要なもの
- Python 3.8以上
- Anthropic APIキー（[console.anthropic.com](https://console.anthropic.com)で取得、約$1で100枚）

### 生成手順

```bash
# 1. ライブラリのインストール
pip install anthropic

# 2. APIキー設定
export ANTHROPIC_API_KEY=sk-ant-...
# (Windowsの場合: set ANTHROPIC_API_KEY=sk-ant-...)

# 3. 100枚生成（30〜60分かかる）
python3 generate_cards.py --count 100 --output cards.json
```

### 生成後にGitHub Pagesに反映

```bash
git add cards.json
git commit -m "Add 100 cards"
git push
```

数分後、スマホからアクセスすると新カードが反映されます。

---

## 🔄 100日後のカード追加

```bash
# 既存ファイルに50枚追加
python3 generate_cards.py --count 50 --output cards.json --append

# GitHubに反映
git add cards.json
git commit -m "Add 50 more cards"
git push
```

---

## 🛠 よくある詰まりどころ

### ホーム画面追加が出ない
→ Safari/Chrome本体で開いてください（LINEなどの内蔵ブラウザでは出ない）

### Push時に "authentication failed"
→ Personal Access Tokenを使用（手順⑥参照）

### Pages有効化したのに404
→ 5-10分待ってからリロード。Settings → Pages で main が選択されているか確認

### カード更新が反映されない
→ スマホ側でブラウザキャッシュをクリア、またはアプリを一度削除して再追加

### `cards.json` が読み込めない（PCでローカルテスト時）
→ `file://` では動きません。必ず `python3 -m http.server 8000` などのローカルサーバー経由で

---

## 💡 コマンドオプション

```bash
python3 generate_cards.py [options]
```

| オプション | 説明 | デフォルト |
|---|---|---|
| `--count N` | 生成枚数 | 100 |
| `--output PATH` | 出力ファイル名 | cards.json |
| `--append` | 既存ファイルに追記 | false |
| `--start N` | 開始番号 | 1 |
| `--delay SEC` | API呼び出し間隔 | 2.0 |

---

## 📊 アプリ機能

- **CEG+ v2.0完全対応** — 15フェーズ・3層構造
- **層フィルタタブ** — 全層/生成層/理解層/拡張層
- **音声合成** — タップで英文読み上げ
- **音読カウンタ** — 3回タップで完了マーク
- **画像保存** — カードをPNG画像として保存
- **漫画化プロンプト** — ChatGPT用のマンガ生成プロンプトを自動生成
- **履歴ライブラリ** — 全カードを一覧から呼び出し
- **完全オフライン動作** — cards.jsonが手元にあれば動く

---

## ❓ サポート

困ったらこのZIPを送ってきた会話で質問してください。
