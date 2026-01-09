# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Discord経由で承認リクエスト・通知を送信するMCPサーバー。Claude Codeから人間の承認を取得するワークフローを実現する。

## 開発コマンド

```bash
npm install        # 依存関係インストール
npm run build      # TypeScript → dist/ へコンパイル
npm test           # ユニットテスト実行
npm start          # コンパイル済みサーバー実行
npm run dev        # ビルド + 実行
```

## アーキテクチャ

Adapterパターンによるモジュール分割構成:

```
src/
├── index.ts           # エントリポイント（初期化のみ）
├── types.ts           # 型定義（DiscordAdapter, Result型）
├── handlers.ts        # ビジネスロジック（テスト対象）
├── discord-adapter.ts # Discord.js実装
├── mcp-server.ts      # MCPサーバー設定
└── __tests__/
    └── handlers.test.ts  # ユニットテスト（44件）
```

## 環境変数

| 変数 | 説明 |
|-----|-----|
| `DISCORD_BOT_TOKEN` | Discord Bot Token（必須） |
| `DISCORD_CHANNEL_ID` | 通知先チャンネルID（必須） |

## Claude Code設定

`~/.claude.json`:
```json
{
  "mcpServers": {
    "discord-approval": {
      "command": "node",
      "args": ["/path/to/discord-approval-mcp/dist/index.js"],
      "env": {
        "DISCORD_BOT_TOKEN": "your_token",
        "DISCORD_CHANNEL_ID": "your_channel_id"
      }
    }
  }
}
```

---

# MCPツール利用ガイド

## 利用可能なツール

### 1. `request_approval` - 承認リクエスト

人間の明示的な承認が必要な操作の前に使用する。

```
mcp__discord-approval__request_approval
├── message: string  # 承認内容の説明（必須）
└── timeout: number  # タイムアウト秒数（デフォルト300秒）
```

**使用すべき場面:**
- 本番環境へのデプロイ前
- データベースのマイグレーション実行前
- ファイルの一括削除・上書き前
- 外部APIへの破壊的な操作前
- 課金が発生する操作前
- その他、取り消しが困難な操作の前

**レスポンス:**
- 承認時: `承認されました`
- 否認時: `否認されました`
- タイムアウト時: `タイムアウト: ユーザーからの応答がありませんでした`

### 2. `notify` - 通知送信

応答不要の一方向通知。処理の完了報告やステータス更新に使用する。

```
mcp__discord-approval__notify
└── message: string  # 通知メッセージ（必須）
```

**使用すべき場面:**
- 長時間タスク（ビルド、テスト、デプロイ）の完了通知
- エラー発生の報告
- マイルストーン達成の報告
- 定期的な進捗報告

### 3. `ask_question` - 選択肢付き質問

複数の選択肢から1つを選んでもらう場合に使用する。

```
mcp__discord-approval__ask_question
├── question: string    # 質問文（必須）
├── options: string[]   # 選択肢の配列（2〜25個、必須）
└── timeout: number     # タイムアウト秒数（デフォルト300秒）
```

**使用すべき場面:**
- 実装方針の選択（複数のアプローチがある場合）
- 優先度の確認
- 設定値の選択
- 曖昧な指示の明確化

**⚠️ 注意:**
通常のユーザー質問には `ask_question` を直接使用しないこと。
代わりに `schedule_reminder` + `AskUserQuestion` + `cancel_reminder` のフローを使用する。
`ask_question` の直接使用は、CLI が使えない状況や、明示的に Discord 経由での回答が必要な場合に限る。

### 4. `schedule_reminder` - リマインダースケジュール

指定秒数後にDiscordへリマインダーを送信する。AskUserQuestionと併用し、ユーザーが一定時間応答しない場合にDiscordへ通知するために使用。

```
mcp__discord-approval__schedule_reminder
├── message: string       # リマインダーメッセージ（必須）
└── delay_seconds: number # 遅延秒数（1〜3600秒、必須）
```

**戻り値:** `reminder_id` （キャンセル用）

**使い方の例:**
1. `schedule_reminder` で60秒後のリマインダーを予約
2. Claude Code の `AskUserQuestion` でユーザーに質問
3. ユーザーが応答したら → `cancel_reminder` でキャンセル
4. 応答がなければ → 60秒後にDiscordへリマインダーが届く

### 5. `cancel_reminder` - リマインダーキャンセル

スケジュール済みのリマインダーをキャンセルする。

```
mcp__discord-approval__cancel_reminder
└── reminder_id: string  # キャンセル対象のID（必須）
```

### 6. `notify_with_status` - ステータス付き通知

Discord Embed 形式でステータス付き通知を送信する。色分け表示で視認性が高い。

```
mcp__discord-approval__notify_with_status
├── message: string  # 通知メッセージ（必須）
├── status: string   # ステータス（必須）: success/error/warning/info
└── details: string  # 追加詳細（オプション）
```

**ステータスと表示:**
| ステータス | 色 | 絵文字 | 用途 |
|-----------|-----|-------|------|
| `success` | 緑 | ✅ | タスク成功、デプロイ完了 |
| `error` | 赤 | ❌ | エラー発生、失敗 |
| `warning` | 黄 | ⚠️ | 警告、注意が必要 |
| `info` | 青 | ℹ️ | 一般的な情報 |

**使用すべき場面:**
- ビルド・テスト・デプロイの結果報告
- エラー発生時の通知（詳細をdetailsに含める）
- 重要な情報の強調表示

### 7. `request_text_input` - テキスト入力リクエスト

Discord Modal ダイアログでユーザーにテキスト入力を要求する。

```
mcp__discord-approval__request_text_input
├── title: string       # Modalタイトル（必須、45文字以内）
├── prompt: string      # 入力を促すメッセージ（必須）
├── placeholder: string # プレースホルダー（オプション、100文字以内）
├── multiline: boolean  # 複数行入力（オプション、デフォルトfalse）
└── timeout: number     # タイムアウト秒数（オプション、デフォルト300、最大900）
```

**レスポンス:**
- 入力時: `入力テキスト:\n{入力内容}`
- キャンセル時: `キャンセル: ユーザーが入力をキャンセルしました`
- タイムアウト時: `タイムアウト: ユーザーからの応答がありませんでした`

**使用すべき場面:**
- エラー原因のヒアリング
- 追加要件の確認
- コミットメッセージの修正依頼
- 自由記述のフィードバック収集

**⚠️ 技術的な注意:**
Discord Modal は Button クリックへの応答としてのみ表示可能。
そのため、ボタン付きメッセージ → ボタンクリック → Modal表示 の2段階フローで実装されている。

## ベストプラクティス

### メッセージの書き方

```markdown
# 良い例
「本番環境（production）にデプロイします。対象: api-server v2.1.0」

# 悪い例
「デプロイしていいですか？」
```

**ポイント:**
- 何をするのかを具体的に記述
- 対象（環境、ファイル、バージョン等）を明記
- 影響範囲がわかるように記述

### タイムアウトの設定

| 操作の種類 | 推奨タイムアウト |
|-----------|----------------|
| 緊急性の高い承認 | 60秒 |
| 通常の承認 | 300秒（デフォルト） |
| 複雑な判断が必要 | 600秒 |
| 質問への回答 | 300秒 |

### エラーハンドリング

タイムアウトや否認時の対応:

```
1. タイムアウト → ユーザーに再度確認するか、操作を中止
2. 否認 → 操作を中止し、理由を確認（ask_questionで）
3. エラー → notify でエラー内容を報告
```

## discord approval mcp を積極的に使うシーン

- 承認が必要な操作の前（`request_approval`）
- 長時間タスク完了時（`notify` または `notify_with_status`）
- ビルド・テスト結果の報告（`notify_with_status` で色分け表示）
- エラー発生時の詳細報告（`notify_with_status` + details）
- 自由記述が必要な質問（`request_text_input`）
- **選択肢付き質問は下記フローを使用**

## ユーザーへの質問フロー（重要）

ユーザーに質問する際は、以下のフローを **必ず** 使用すること：

1. `schedule_reminder` で60秒後のリマインダーを予約
2. Claude Code の `AskUserQuestion` でユーザーに質問
3. ユーザーが応答したら → `cancel_reminder` でキャンセル
4. 応答がなければ → 60秒後にDiscordへリマインダーが届く

**禁止事項:**
- `ask_question` を直接使用してユーザーに質問しない
- `ask_question` は `AskUserQuestion` のタイムアウト後のフォローアップとしてのみ使用可

**コード例:**
```
// Step 1: リマインダー予約
reminder = schedule_reminder("質問への回答をお待ちしています", 60)

// Step 2: CLI で質問
answer = AskUserQuestion("どの方法で実装しますか？", options)

// Step 3: 応答があればキャンセル
cancel_reminder(reminder.reminder_id)
```

