# MCP Discord Approval Server

[English](../README.md) | 日本語

Claude CodeからDiscord経由で承認リクエスト・通知を送信するMCPサーバー。

## セットアップ

### 1. Discord Bot 作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. **New Application** → アプリ名を入力
3. **Bot** タブ → **Reset Token** → トークンをコピー
4. **Bot** タブ → **MESSAGE CONTENT INTENT** を有効化（任意）
5. **OAuth2** → **URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Read Message History`
6. 生成されたURLでBotをサーバーに招待

### 2. チャンネルID取得

1. Discord設定 → 詳細設定 → **開発者モード** を有効化
2. 通知を受け取りたいチャンネルを右クリック → **IDをコピー**

### 3. ビルド

```bash
npm install
npm run build
```

### 4. Claude Code設定

`~/.claude.json` に追加:

```json
{
  "mcpServers": {
    "discord-approval": {
      "command": "node",
      "args": ["/path/to/mcp-discord-approval/dist/index.js"],
      "env": {
        "DISCORD_BOT_TOKEN": "your_bot_token",
        "DISCORD_CHANNEL_ID": "your_channel_id"
      }
    }
  }
}
```

## 使用可能なツール

### `request_approval`

承認リクエストを送信し、ユーザーの応答を待つ。

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| message | string | ✅ | 確認したい内容 |
| timeout | number | - | タイムアウト秒数（デフォルト: 300） |

**戻り値**: `承認されました` / `否認されました` / `タイムアウト`

### `notify`

通知を送信する（応答不要）。

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| message | string | ✅ | 通知メッセージ |

## 使用例

Claude Codeで:

```
本番環境にデプロイする前にユーザーの承認を取得してください
```

→ Discordにボタン付きメッセージが送信され、承認/否認を待機

## ライセンス

MIT
