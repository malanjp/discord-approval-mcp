# Discord Approval MCP ツールリファレンス

## 1. request_approval

承認リクエストを送信し、ユーザーの応答を待つ。

```
mcp__discord-approval__request_approval
├── message: string  # 承認内容の説明（必須）
└── timeout: number  # タイムアウト秒数（デフォルト300秒）
```

**使用場面:**
- 本番環境へのデプロイ前
- データベースのマイグレーション実行前
- ファイルの一括削除・上書き前
- 課金が発生する操作前

**レスポンス:**
- 承認時: `承認されました`
- 否認時: `否認されました`
- タイムアウト時: `タイムアウト: ユーザーからの応答がありませんでした`

---

## 2. notify

通知を送信する（応答不要）。

```
mcp__discord-approval__notify
└── message: string  # 通知メッセージ（必須）
```

**使用場面:**
- 長時間タスクの完了通知
- エラー発生の報告
- マイルストーン達成の報告

---

## 3. ask_question

選択肢付きの質問を送信し、ユーザーの選択を待つ。

```
mcp__discord-approval__ask_question
├── question: string    # 質問文（必須）
├── options: string[]   # 選択肢の配列（2〜25個、必須）
└── timeout: number     # タイムアウト秒数（デフォルト300秒）
```

**⚠️ 注意:** 通常の質問には直接使用しない。`schedule_reminder` + `AskUserQuestion` + `cancel_reminder` フローを使用。

---

## 4. schedule_reminder

指定秒数後にDiscordへリマインダーを送信する。

```
mcp__discord-approval__schedule_reminder
├── message: string       # リマインダーメッセージ（必須）
└── delay_seconds: number # 遅延秒数（1〜3600秒、必須）
```

**戻り値:** `reminder_id` （キャンセル用）

---

## 5. cancel_reminder

スケジュール済みのリマインダーをキャンセルする。

```
mcp__discord-approval__cancel_reminder
└── reminder_id: string  # キャンセル対象のID（必須）
```

---

## 6. notify_with_status

Discord Embed 形式でステータス付き通知を送信する。

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

---

## 7. request_text_input

Discord Modal ダイアログでユーザーにテキスト入力を要求する。

```
mcp__discord-approval__request_text_input
├── title: string       # Modalタイトル（必須、45文字以内）
├── prompt: string      # 入力を促すメッセージ（必須）
├── placeholder: string # プレースホルダー（オプション、100文字以内）
├── multiline: boolean  # 複数行入力（オプション、デフォルトfalse）
└── timeout: number     # タイムアウト秒数（オプション、デフォルト300、最大900）
```

**使用場面:**
- エラー原因のヒアリング
- 追加要件の確認
- コミットメッセージの修正依頼

---

## 8. confirm_with_diff

コード変更の差分を表示し、ユーザーに承認を求める。

```
mcp__discord-approval__confirm_with_diff
├── message: string   # 変更内容の説明（必須）
├── diff: string      # 差分テキスト（必須、unified diff 形式推奨）
├── filename: string  # ファイル名（オプション、syntax highlight用）
└── timeout: number   # タイムアウト秒数（オプション、デフォルト300、最大900）
```

**使用場面:**
- ファイル編集前の確認
- 生成されたコード変更のレビュー

---

## 9. poll

複数選択可能な投票を送信し、ユーザーの選択を待つ。

```
mcp__discord-approval__poll
├── question: string       # 質問文（必須）
├── options: string[]      # 選択肢の配列（2〜25個、必須）
├── min_selections: number # 最小選択数（オプション、デフォルト0）
├── max_selections: number # 最大選択数（オプション、デフォルト=選択肢数）
└── timeout: number        # タイムアウト秒数（オプション、デフォルト300、最大900）
```

**使用場面:**
- 実装する機能の複数選択
- 優先的に修正するバグの選択

---

## 10. request_approval_with_reason

承認リクエストを送信し、否認時に理由を取得する。

```
mcp__discord-approval__request_approval_with_reason
├── message: string  # 確認内容（必須）
└── timeout: number  # タイムアウト秒数（オプション、デフォルト300、最大900）
```

**戻り値:**
- 承認時: `承認されました`
- 否認時: `否認されました\n理由: {理由}`
- タイムアウト時: `タイムアウト: ユーザーからの応答がありませんでした`

---

## 11. create_thread

Discordにスレッドを作成する。

```
mcp__discord-approval__create_thread
├── name: string    # スレッド名（必須、100文字以内）
└── message: string # 最初のメッセージ（オプション）
```

**使用場面:**
- 長い作業の進捗をスレッドにまとめる
- 関連する通知のグルーピング

**戻り値:** `thread_id` （後続の通知で使用可能）
