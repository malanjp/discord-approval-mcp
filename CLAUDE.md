# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Discord経由で承認リクエスト・通知を送信するMCPサーバー。Claude Codeから人間の承認を取得するワークフローを実現する。

## 開発コマンド

```bash
npm install        # 依存関係インストール
npm run build      # TypeScript → dist/ へコンパイル
npm start          # コンパイル済みサーバー実行
npm run dev        # ビルド + 実行
```

## アーキテクチャ

単一ファイル構成（`src/index.ts`）で以下を統合:

1. **Discord接続管理**: `discordReady` Promiseで接続完了を待機（30秒タイムアウト）
2. **MCPツール**:
   - `request_approval`: ボタン付きメッセージで承認/否認を取得（`awaitMessageComponent`）
   - `notify`: 単方向通知送信
   - `ask_question`: SelectMenu付きメッセージで複数選択肢から回答を取得
3. **MCPサーバー**: stdio transportでClaude Codeと通信

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
      "args": ["/path/to/mcp-discord-approval/dist/index.js"],
      "env": {
        "DISCORD_BOT_TOKEN": "your_token",
        "DISCORD_CHANNEL_ID": "your_channel_id"
      }
    }
  }
}
```
