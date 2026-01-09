# Discord Approval Server MCP

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
      "args": ["/path/to/discord-approval-mcp/dist/index.js"],
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

### `ask_question`

選択肢付きの質問を送信し、ユーザーの選択を待つ。

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| question | string | ✅ | 質問文 |
| options | string[] | ✅ | 選択肢の配列（2〜25個） |
| timeout | number | - | タイムアウト秒数（デフォルト: 300） |

**戻り値**: 選択された選択肢 / `タイムアウト`

### `schedule_reminder`

指定秒数後にDiscordへリマインダーを送信する。AskUserQuestionと併用し、ユーザーが一定時間応答しない場合にDiscordへ通知するために使用。

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| message | string | ✅ | リマインダーメッセージ |
| delay_seconds | number | ✅ | 遅延秒数（1〜3600秒） |

**戻り値**: `{ reminder_id: string }` キャンセル用ID

### `cancel_reminder`

スケジュール済みのリマインダーをキャンセルする。

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| reminder_id | string | ✅ | キャンセル対象のID |

**戻り値**: 成功 / エラーメッセージ

### `notify_with_status`

ステータス付き通知を送信する（Discord Embed形式、色分け表示）。

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| message | string | ✅ | 通知メッセージ |
| status | string | ✅ | ステータス: `success`(緑), `error`(赤), `warning`(黄), `info`(青) |
| details | string | - | 追加の詳細情報（任意） |

**戻り値**: 成功 / エラーメッセージ

### `request_text_input`

Discord Modalダイアログでユーザーにテキスト入力を要求する。

| パラメータ | 型 | 必須 | 説明 |
|-----------|------|------|------|
| title | string | ✅ | Modalのタイトル（45文字以内） |
| prompt | string | ✅ | 入力を促すメッセージ |
| placeholder | string | - | 入力欄のプレースホルダー（100文字以内） |
| multiline | boolean | - | 複数行入力を許可（デフォルト: false） |
| timeout | number | - | タイムアウト秒数（デフォルト: 300、最大: 900） |

**戻り値**: 入力されたテキスト / `キャンセル` / `タイムアウト`

## 使用例

Claude Codeで:

```
本番環境にデプロイする前にユーザーの承認を取得してください
```

→ Discordにボタン付きメッセージが送信され、承認/否認を待機

## CLAUDE.md 設定

Claude Code が自動的にこれらのツールを使用するよう、`~/.claude/CLAUDE.md` に以下を追加してください:

```markdown
### discord-approval

以下の場面では `mcp__discord-approval__request_approval` ツールで承認を取得してください:
- 本番環境へのデプロイ前
- データベースのマイグレーション実行前
- ファイルの一括削除前
- その他、取り消しが難しい操作の前

以下の場面では `mcp__discord-approval__ask_question` ツールで選択肢から選んでもらってください:
- 実装方針の選択
- 曖昧な指示の明確化
- 設定値の選択

長時間タスク（ビルド、テスト実行など）が完了したら `mcp__discord-approval__notify` で通知してください。

ステータス付きのリッチな通知には `mcp__discord-approval__notify_with_status` を使用してください:
- 成功通知（緑）: タスク完了時
- エラー通知（赤）: 失敗時
- 警告通知（黄）: 潜在的な問題の報告
- 情報通知（青）: 一般的な情報

自由記述のテキスト入力が必要な場合は `mcp__discord-approval__request_text_input` を使用してください:
- エラーの詳細をユーザーから収集
- 追加要件の確認
- コミットメッセージの修正依頼

## discord approval mcp を積極的に使うシーン

- ユーザに確認を促すとき
- ユーザに質問をするとき
- タスク完了時
```

## ライセンス

MIT
