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
    └── handlers.test.ts  # ユニットテスト（16件）
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

## 使用例

### デプロイ前の承認フロー

```
1. request_approval: 「本番環境にデプロイします。変更内容: ログイン機能の修正」
2. 承認された場合 → デプロイ実行
3. notify: 「デプロイ完了しました。URL: https://...」
```

### 実装方針の確認

```
1. ask_question: 「認証方式をどちらにしますか？」
   options: ["JWT（推奨）", "セッションベース", "OAuth2.0"]
2. 選択結果に基づいて実装
```

### 長時間タスクの完了通知

```
1. テスト実行開始
2. （テスト完了後）
3. notify: 「テスト完了: 156件中156件成功 ✅」
```
