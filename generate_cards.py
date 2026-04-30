#!/usr/bin/env python3
"""
CEG+ v2.0 カードバッチ生成スクリプト
==========================================
Claude APIを使って指定された日数分のCEG+カードを生成し、
JSONファイルに保存します。

使い方:
  1. APIキーを環境変数に設定: export ANTHROPIC_API_KEY=sk-ant-...
  2. 必要なライブラリをインストール: pip install anthropic
  3. 実行: python generate_cards.py --count 100 --output cards.json

オプション:
  --count   N    生成枚数（デフォルト: 100）
  --output  PATH 出力ファイル（デフォルト: cards.json）
  --append       既存ファイルに追記（重複動詞は避ける）
  --start   N    開始番号（追記時の連番に使用）
"""

import os
import json
import time
import argparse
import sys
from datetime import datetime
from anthropic import Anthropic

# ── プロンプト（アプリと同一仕様） ─────────────────
PROMPT_TEMPLATE = """あなたはCEG+ v2.0（Concept-Expression-Generation Plus）メソッドのコンテンツジェネレーターです。日本人学習者の毎朝の英語トレーニング用に、1つの核となる動詞から完全な学習カードを生成してください。

【今回の指定】
- 核動詞テーマヒント: {verb_hint}
- これまでに使った動詞（重複避ける）: {used_verbs}
- カード番号: #{card_no}

【CEG+ v2.0 三層構造・15フェーズ】

▼ 生成層（Generate）
- Phase 1: 核生成（I + 動詞）
- Phase 2: チャンク拡張（目的語/時間/場所追加）
- Phase 3: 接続（because/if/and 付加）
- Phase 4: 修飾・比較（more/better/than）
- Phase 5: 構造化（that/which 関係詞追加）
- Phase 6: 完成文（15-25語のPhase 5最終形）

▼ 理解層（Explain）
- Phase 7: チャンク分解（機能タグ付き）
- Phase 8: 文法説明（最低7項目）
- Phase 9: デバッグ（典型エラー）
- Phase 10: 短文化（会話用に圧縮）
- Phase 11: 読解分解（構造ラベル）
- Phase 12: 音読（カタカナ読み）

▼ 拡張層（Expand）★核心
- Phase 13: 接続展開（because → since/as/due to/owing to）
- Phase 14: 構造展開（受動態/分詞構文/従属節先行/名詞化）
- Phase 15: 表現ネットワーク（8-15構文展開）

【出力形式】
JSONのみ出力。前後の説明文・マークダウン記号(```)は不要。

{{
  "sentence": "Phase 6完成文",
  "phonetic": "完成文のカタカナ読み",
  "japaneseTranslation": "自然な日本語訳",
  "theme": "テーマ（学び・創作・成長・発見等）",
  "coreVerb": "核となる動詞",

  "generateLayer": {{
    "phase1": {{"sentence": "I [V].", "translation": "訳"}},
    "phase2": {{"sentence": "L2拡張", "translation": "訳", "addedChunks": "追加要素"}},
    "phase3": {{"sentence": "L3接続", "translation": "訳", "connector": "接続詞"}},
    "phase4": {{"sentence": "L4比較", "translation": "訳", "comparison": "比較表現"}},
    "phase5": {{"sentence": "L5構造化", "translation": "訳", "relativizer": "関係詞"}}
  }},

  "explainLayer": {{
    "chunks": [
      {{"text": "英語チャンク", "function": "機能タグ", "translation": "訳"}}
    ],
    "grammarPoints": [
      {{"category": "カテゴリ", "name": "文法名", "where": "該当箇所", "explanation": "解説", "rule": "ルール"}}
    ],
    "errors": [
      {{"wrong": "間違い", "correct": "正しい形", "why": "理由"}}
    ],
    "variants": [
      {{"text": "会話短文", "translation": "訳"}}
    ],
    "parseTree": "S V O [that ...] のような構造ラベル"
  }},

  "expandLayer": {{
    "causalExpansion": [
      {{"original": "元の接続", "expanded": "展開後", "nuance": "ニュアンス差"}}
    ],
    "structuralShift": [
      {{"type": "変換タイプ", "sentence": "変換文", "translation": "訳", "note": "ポイント"}}
    ],
    "expressionNetwork": {{
      "vocabulary": [{{"original": "元動詞", "alternatives": ["類義語"], "nuance": "差"}}],
      "sentencePatterns": [{{"type": "タイプ", "sentence": "文", "translation": "訳"}}],
      "comparison": [{{"sentence": "文", "translation": "訳"}}],
      "conditional": [{{"sentence": "文", "translation": "訳"}}],
      "emphasis": [{{"sentence": "文", "translation": "訳"}}],
      "compression": [{{"sentence": "文", "translation": "訳"}}]
    }}
  }},

  "scores": {{
    "naturalness": 8,
    "clarity": 9,
    "flexibility": 7,
    "focus": 8,
    "efficiency": 8,
    "comment": "総評（日本語2-3行）"
  }}
}}

【数量要件】
- chunks: 6-8個
- grammarPoints: 7-9項目
- errors: 3個
- variants: 3個
- causalExpansion: 3-4個
- structuralShift: 3-4個
- vocabulary: 1-2項目
- sentencePatterns: 2-3個
- comparison: 1-2個
- conditional: 1-2個
- emphasis: 1-2個
- compression: 1-2個

scoresは必ず整数（"8"でなく8）。完成文は15-25語、自然で意味のある英文。"""

# ── 多様性のための動詞バンク ────────────────────────
VERB_THEMES = [
    "study", "work", "read", "write", "make", "think", "listen", "speak",
    "build", "grow", "practice", "create", "explore", "imagine", "discover",
    "observe", "share", "understand", "learn", "design", "invent", "improve",
    "develop", "achieve", "express", "communicate", "analyze", "remember",
    "forget", "wonder", "believe", "doubt", "trust", "respect", "appreciate",
    "value", "cherish", "celebrate", "embrace", "accept", "welcome",
    "challenge", "question", "investigate", "research", "experiment",
    "construct", "compose", "perform", "rehearse", "train", "exercise",
    "meditate", "reflect", "contemplate", "consider", "evaluate", "judge",
    "decide", "choose", "select", "prefer", "enjoy", "love", "feel",
    "experience", "encounter", "meet", "connect", "collaborate", "support",
    "help", "guide", "teach", "mentor", "lead", "follow", "inspire",
    "motivate", "encourage", "empower", "transform", "change", "evolve",
    "adapt", "adjust", "balance", "focus", "concentrate", "dedicate",
    "commit", "promise", "pursue", "seek", "search", "find", "uncover",
    "reveal", "expose", "share", "publish", "release", "present",
    "demonstrate", "showcase", "exhibit", "display"
]

def generate_card(client, card_no, used_verbs):
    """1枚のCEG+カードをAPIで生成"""
    # 動詞ヒントを循環的に選ぶ
    verb_hint = VERB_THEMES[card_no % len(VERB_THEMES)]
    used_str = ", ".join(used_verbs[-30:]) if used_verbs else "（なし）"

    prompt = PROMPT_TEMPLATE.format(
        verb_hint=verb_hint,
        used_verbs=used_str,
        card_no=card_no
    )

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=6000,
        messages=[{"role": "user", "content": prompt}]
    )

    text = "".join(block.text for block in response.content if hasattr(block, 'text')).strip()
    text = text.replace("```json", "").replace("```", "").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end+1]

    return json.loads(text)


def main():
    parser = argparse.ArgumentParser(description="CEG+ v2.0 バッチ生成")
    parser.add_argument("--count", type=int, default=100, help="生成枚数（デフォルト100）")
    parser.add_argument("--output", default="cards.json", help="出力ファイル")
    parser.add_argument("--append", action="store_true", help="既存ファイルに追記")
    parser.add_argument("--start", type=int, default=1, help="開始番号")
    parser.add_argument("--delay", type=float, default=2.0, help="API呼び出し間隔(秒)")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: 環境変数 ANTHROPIC_API_KEY が設定されていません")
        print("実行例: export ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    client = Anthropic(api_key=api_key)

    # 既存データの読み込み
    existing_cards = []
    used_verbs = []
    if args.append and os.path.exists(args.output):
        with open(args.output, 'r', encoding='utf-8') as f:
            existing_cards = json.load(f)
        used_verbs = [c.get("coreVerb", "") for c in existing_cards if c.get("coreVerb")]
        print(f"既存ファイル読み込み: {len(existing_cards)}枚")
        start_no = len(existing_cards) + 1
    else:
        start_no = args.start

    print(f"\n=== CEG+ v2.0 バッチ生成 ===")
    print(f"生成枚数: {args.count}")
    print(f"開始番号: #{start_no}")
    print(f"出力先  : {args.output}")
    print(f"モード  : {'追記' if args.append else '新規'}")
    print(f"")

    new_cards = []
    failed = []
    for i in range(args.count):
        card_no = start_no + i
        progress = f"[{i+1}/{args.count}]"

        try:
            print(f"{progress} #{card_no} 生成中...", end=" ", flush=True)
            card = generate_card(client, card_no, used_verbs + [c.get("coreVerb", "") for c in new_cards])
            card["_no"] = card_no
            card["_generatedAt"] = datetime.now().isoformat()
            new_cards.append(card)
            print(f"✓ {card.get('coreVerb', '?'):12s} | {card.get('theme', '?')}")

            # 進捗を都度保存（中断耐性）
            if (i + 1) % 5 == 0:
                save_cards(args.output, existing_cards + new_cards)
                print(f"   → 中間保存（合計 {len(existing_cards) + len(new_cards)}枚）")

        except json.JSONDecodeError as e:
            print(f"✗ JSON parse error: {e}")
            failed.append(card_no)
        except Exception as e:
            print(f"✗ Error: {e}")
            failed.append(card_no)

        # API レート制限対策
        if i < args.count - 1:
            time.sleep(args.delay)

    # 最終保存
    all_cards = existing_cards + new_cards
    save_cards(args.output, all_cards)

    print(f"\n=== 完了 ===")
    print(f"生成成功: {len(new_cards)}枚")
    print(f"失敗   : {len(failed)}枚")
    if failed:
        print(f"失敗番号: {failed}")
    print(f"合計   : {len(all_cards)}枚")
    print(f"保存先  : {args.output}")
    print(f"\n次のステップ: cards.json を Webアプリと同じディレクトリに置いてください")


def save_cards(path, cards):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
