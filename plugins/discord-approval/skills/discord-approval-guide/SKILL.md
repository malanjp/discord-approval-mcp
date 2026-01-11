---
name: discord-approval-guide
description: Discord Approval MCP の使い方ガイド。「discord approval の使い方」「Discord で通知」「承認リクエスト」「Discord 承認」などのキーワードでトリガー。
version: 1.0.0
---

# Discord Approval MCP 利用ガイド

Discord経由で承認リクエスト・通知を送信するMCPサーバーの使い方。

## 利用可能なツール

### 承認系
| ツール | 説明 |
|--------|------|
| `request_approval` | 承認/否認を待つ |
| `request_approval_with_reason` | 否認時に理由を取得 |
| `confirm_with_diff` | Diff付き承認 |

### 通知系
| ツール | 説明 |
|--------|------|
| `notify` | シンプルな通知 |
| `notify_with_status` | ステータス付き通知（色分け） |

### 質問系
| ツール | 説明 |
|--------|------|
| `ask_question` | 選択肢から1つ選択 |
| `poll` | 複数選択可能な投票 |
| `request_text_input` | 自由記述入力 |

### その他
| ツール | 説明 |
|--------|------|
| `schedule_reminder` | リマインダー予約 |
| `cancel_reminder` | リマインダーキャンセル |
| `create_thread` | スレッド作成 |

## ベストプラクティス

### ユーザーへの質問フロー

**重要:** `ask_question` を直接使用せず、以下のフローを使用：

```
1. schedule_reminder で60秒後のリマインダーを予約
2. AskUserQuestion でユーザーに質問
3. 応答があれば cancel_reminder でキャンセル
4. 応答がなければ Discord にリマインダーが届く
```

### タスク完了時

長時間タスク（ビルド、テスト、デプロイ）完了時は `notify_with_status` で通知：

| status | 色 | 用途 |
|--------|-----|------|
| `success` | 緑 | 成功 |
| `error` | 赤 | エラー |
| `warning` | 黄 | 警告 |
| `info` | 青 | 情報 |

### 承認が必要な操作

以下の操作前には `request_approval` を使用：
- 本番環境へのデプロイ
- データベースマイグレーション
- ファイルの一括削除
- その他、取り消しが難しい操作

## 詳細リファレンス

各ツールの詳細なパラメータについては `references/tools-reference.md` を参照。
