# Discord Approval MCP 機能追加 TODO

## 追加機能候補

### 高優先度

- [x] **`request_text_input`** - 自由記述入力 ✅
  - Discord Modal (TextInput) を使用
  - パラメータ: `title`, `prompt`, `placeholder?`, `multiline?`, `timeout?`
  - 用途: エラー原因のヒアリング、追加要件の確認、コミットメッセージ修正依頼

- [x] **`notify_with_status`** - ステータス付き通知 ✅
  - Discord Embed を使用
  - パラメータ: `message`, `status` (success/error/warning/info), `details?`
  - 表示: 色分けされた Embed (緑/赤/黄/青)

### 中優先度

- [x] **`confirm_with_diff`** - Diff 付き確認 ✅
  - Embed + コードブロック
  - パラメータ: `message`, `diff`, `filename?`, `timeout?`
  - 用途: コード変更の承認時に差分を表示

- [x] **`poll`** - 複数回答可能な投票 ✅
  - StringSelectMenu (minValues/maxValues 設定)
  - パラメータ: `question`, `options`, `min_selections?`, `max_selections?`, `timeout?`
  - 用途: リリース機能選択、優先バグ選択

### 低優先度

- [ ] **`request_approval_with_reason`** - 理由付き承認
  - Button + Modal の組み合わせ
  - 戻り値: `{ approved, reason?, timedOut }`
  - 用途: 否認時の理由取得

- [ ] **`create_thread`** - スレッド作成
  - channel.threads.create()
  - 戻り値: `{ thread_id }`
  - 用途: 長い作業の進捗をスレッドにまとめる

- [x] **`schedule_reminder`** - リマインダー設定 ✅
  - setTimeout / 外部スケジューラ
  - 注意: プロセス再起動で失われる

## プラグイン化

- [ ] **Claude Code プラグインとしてパッケージ化**
  - plugin.json でMCPサーバー設定を自動化
  - hooks/ で UserPromptSubmit, Stop hooks を内包
  - skills/ で利用ガイドを提供
  - 環境変数の設定方法をドキュメント化
  - `claude plugins:add` で一発インストール可能に

### プラグイン構成案

```
discord-approval-plugin/
├── plugin.json           # MCP設定・メタデータ
├── hooks/
│   ├── stop.md           # タスク完了時の notify 促進
│   └── user-prompt.md    # MCP利用ガイド挿入
├── skills/
│   └── usage-guide.md    # 詳細な利用ガイド
└── README.md
```

## 実装時の注意事項

- 既存の Adapter パターンに従う
- types.ts に新しい Result 型を追加
- handlers.ts にバリデーションロジック
- discord-adapter.ts に Discord.js 実装
- mcp-server.ts にツール定義追加
- ユニットテストを追加
