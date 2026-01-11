import type {
  DiscordAdapter,
  ApprovalResult,
  NotifyResult,
  QuestionResult,
  ReminderResult,
  CancelReminderResult,
  ToolHandlers,
  NotificationStatus,
  TextInputResult,
  DiffConfirmResult,
  PollResult,
} from './types.js';

/**
 * ツールハンドラーを作成する
 *
 * Discord Adapter を受け取り、ビジネスロジックを実装したハンドラーを返す。
 * Adapter をテスト時にモックに差し替えることで、ユニットテストが可能になる。
 */
export function createToolHandlers(adapter: DiscordAdapter): ToolHandlers {
  return {
    /**
     * 承認リクエストを送信し、ユーザーの応答を待つ
     */
    async requestApproval(
      message: string,
      timeout = 300
    ): Promise<ApprovalResult> {
      if (!adapter.isReady()) {
        return { approved: false, timedOut: false, error: 'Discord not connected' };
      }
      return adapter.sendApprovalRequest(message, timeout);
    },

    /**
     * 通知を送信（応答不要）
     */
    async notify(message: string): Promise<NotifyResult> {
      if (!adapter.isReady()) {
        return { success: false, error: 'Discord not connected' };
      }
      return adapter.sendNotification(message);
    },

    /**
     * 選択肢付きの質問を送信し、ユーザーの選択を待つ
     */
    async askQuestion(
      question: string,
      options: string[],
      timeout = 300
    ): Promise<QuestionResult> {
      if (!adapter.isReady()) {
        return { selected: null, timedOut: false, error: 'Discord not connected' };
      }

      // バリデーション
      if (options.length < 2) {
        return { selected: null, timedOut: false, error: '選択肢は2個以上必要です' };
      }
      if (options.length > 25) {
        return {
          selected: null,
          timedOut: false,
          error: '選択肢は25個以下にしてください',
        };
      }

      return adapter.sendQuestion(question, options, timeout);
    },

    /**
     * 指定秒数後にリマインダーを送信するようスケジュールする
     */
    async scheduleReminder(
      message: string,
      delaySeconds: number
    ): Promise<ReminderResult> {
      if (!adapter.isReady()) {
        return { reminderId: '', success: false, error: 'Discord not connected' };
      }

      // バリデーション: 1〜3600秒（1時間）
      if (delaySeconds < 1 || delaySeconds > 3600) {
        return {
          reminderId: '',
          success: false,
          error: '遅延秒数は1〜3600の範囲で指定してください',
        };
      }

      return adapter.scheduleReminder(message, delaySeconds);
    },

    /**
     * スケジュール済みのリマインダーをキャンセルする
     */
    async cancelReminder(reminderId: string): Promise<CancelReminderResult> {
      if (!adapter.isReady()) {
        return { success: false, error: 'Discord not connected' };
      }

      return adapter.cancelReminder(reminderId);
    },

    /**
     * ステータス付き通知を送信（Embed形式）
     */
    async notifyWithStatus(
      message: string,
      status: NotificationStatus,
      details?: string
    ): Promise<NotifyResult> {
      if (!adapter.isReady()) {
        return { success: false, error: 'Discord not connected' };
      }

      const validStatuses: NotificationStatus[] = ['success', 'error', 'warning', 'info'];
      if (!validStatuses.includes(status)) {
        return {
          success: false,
          error: `無効なステータスです。有効な値: ${validStatuses.join(', ')}`,
        };
      }

      return adapter.sendStatusNotification(message, status, details);
    },

    /**
     * テキスト入力をリクエストし、ユーザーの入力を待つ
     */
    async requestTextInput(
      title: string,
      prompt: string,
      placeholder?: string,
      multiline = false,
      timeout = 300
    ): Promise<TextInputResult> {
      if (!adapter.isReady()) {
        return {
          text: null,
          timedOut: false,
          cancelled: false,
          error: 'Discord not connected',
        };
      }

      // バリデーション
      if (!title || title.trim().length === 0) {
        return {
          text: null,
          timedOut: false,
          cancelled: false,
          error: 'タイトルは必須です',
        };
      }
      if (title.length > 45) {
        return {
          text: null,
          timedOut: false,
          cancelled: false,
          error: 'タイトルは45文字以内にしてください',
        };
      }
      if (!prompt || prompt.trim().length === 0) {
        return {
          text: null,
          timedOut: false,
          cancelled: false,
          error: 'プロンプトは必須です',
        };
      }
      if (placeholder && placeholder.length > 100) {
        return {
          text: null,
          timedOut: false,
          cancelled: false,
          error: 'プレースホルダーは100文字以内にしてください',
        };
      }
      if (timeout < 1 || timeout > 900) {
        return {
          text: null,
          timedOut: false,
          cancelled: false,
          error: 'タイムアウトは1〜900秒の範囲で指定してください',
        };
      }

      return adapter.sendTextInputRequest(title, prompt, placeholder, multiline, timeout);
    },

    /**
     * Diff 付き確認リクエストを送信し、ユーザーの応答を待つ
     */
    async confirmWithDiff(
      message: string,
      diff: string,
      filename?: string,
      timeout = 300
    ): Promise<DiffConfirmResult> {
      if (!adapter.isReady()) {
        return { approved: false, timedOut: false, error: 'Discord not connected' };
      }

      // バリデーション
      if (!message || message.trim().length === 0) {
        return { approved: false, timedOut: false, error: 'メッセージは必須です' };
      }
      if (!diff || diff.trim().length === 0) {
        return { approved: false, timedOut: false, error: 'diff は必須です' };
      }
      if (timeout < 1 || timeout > 900) {
        return {
          approved: false,
          timedOut: false,
          error: 'タイムアウトは1〜900秒の範囲で指定してください',
        };
      }

      return adapter.sendDiffConfirmRequest(message, diff, filename, timeout);
    },

    /**
     * 複数選択可能な投票を送信し、ユーザーの選択を待つ
     */
    async poll(
      question: string,
      options: string[],
      minSelections = 0,
      maxSelections?: number,
      timeout = 300
    ): Promise<PollResult> {
      if (!adapter.isReady()) {
        return { selected: [], timedOut: false, error: 'Discord not connected' };
      }

      // バリデーション: 選択肢の数
      if (options.length < 2) {
        return { selected: [], timedOut: false, error: '選択肢は2個以上必要です' };
      }
      if (options.length > 25) {
        return { selected: [], timedOut: false, error: '選択肢は25個以下にしてください' };
      }

      // maxSelections のデフォルト値は選択肢の数
      const effectiveMaxSelections = maxSelections ?? options.length;

      // バリデーション: minSelections
      if (minSelections < 0) {
        return {
          selected: [],
          timedOut: false,
          error: 'min_selectionsは0以上で指定してください',
        };
      }
      if (minSelections > options.length) {
        return {
          selected: [],
          timedOut: false,
          error: 'min_selectionsは選択肢の数以下にしてください',
        };
      }

      // バリデーション: maxSelections
      if (effectiveMaxSelections < 1) {
        return {
          selected: [],
          timedOut: false,
          error: 'max_selectionsは1以上で指定してください',
        };
      }
      if (effectiveMaxSelections > options.length) {
        return {
          selected: [],
          timedOut: false,
          error: 'max_selectionsは選択肢の数以下にしてください',
        };
      }

      // バリデーション: min <= max
      if (minSelections > effectiveMaxSelections) {
        return {
          selected: [],
          timedOut: false,
          error: 'min_selectionsはmax_selections以下にしてください',
        };
      }

      return adapter.sendPoll(question, options, minSelections, effectiveMaxSelections, timeout);
    },
  };
}
