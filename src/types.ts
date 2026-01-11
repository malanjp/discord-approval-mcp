/**
 * 承認リクエストの結果
 */
export type ApprovalResult = {
  approved: boolean;
  timedOut: boolean;
  error?: string;
};

/**
 * 通知送信の結果
 */
export type NotifyResult = {
  success: boolean;
  error?: string;
};

/**
 * 選択肢質問の結果
 */
export type QuestionResult = {
  selected: string | null;
  timedOut: boolean;
  error?: string;
};

/**
 * リマインダースケジュールの結果
 */
export type ReminderResult = {
  reminderId: string;
  success: boolean;
  error?: string;
};

/**
 * リマインダーキャンセルの結果
 */
export type CancelReminderResult = {
  success: boolean;
  error?: string;
};

/**
 * ステータス通知のステータス種別
 */
export type NotificationStatus = 'success' | 'error' | 'warning' | 'info';

/**
 * テキスト入力リクエストの結果
 */
export type TextInputResult = {
  text: string | null;
  timedOut: boolean;
  cancelled: boolean;
  error?: string;
};

/**
 * Diff 付き確認リクエストの結果
 */
export type DiffConfirmResult = {
  approved: boolean;
  timedOut: boolean;
  error?: string;
};

/**
 * 複数選択投票の結果
 */
export type PollResult = {
  selected: string[];
  timedOut: boolean;
  error?: string;
};

/**
 * Discord 操作を抽象化するアダプター
 *
 * テスト時にはモック実装を注入することで、
 * 実際の Discord 接続なしでビジネスロジックをテストできる
 */
export type DiscordAdapter = {
  /** Discord に接続済みかどうか */
  isReady: () => boolean;

  /** 承認リクエストを送信し、ユーザーの応答を待つ */
  sendApprovalRequest: (
    message: string,
    timeoutSec: number
  ) => Promise<ApprovalResult>;

  /** 通知を送信（応答不要） */
  sendNotification: (message: string) => Promise<NotifyResult>;

  /** 選択肢付きの質問を送信し、ユーザーの選択を待つ */
  sendQuestion: (
    question: string,
    options: string[],
    timeoutSec: number
  ) => Promise<QuestionResult>;

  /** リマインダーをスケジュールする */
  scheduleReminder: (
    message: string,
    delaySeconds: number
  ) => Promise<ReminderResult>;

  /** スケジュール済みリマインダーをキャンセルする */
  cancelReminder: (reminderId: string) => Promise<CancelReminderResult>;

  /** ステータス付き通知を送信（Embed形式） */
  sendStatusNotification: (
    message: string,
    status: NotificationStatus,
    details?: string
  ) => Promise<NotifyResult>;

  /** テキスト入力をリクエストし、ユーザーの入力を待つ */
  sendTextInputRequest: (
    title: string,
    prompt: string,
    placeholder: string | undefined,
    multiline: boolean,
    timeoutSec: number
  ) => Promise<TextInputResult>;

  /** Diff 付き確認リクエストを送信し、ユーザーの応答を待つ */
  sendDiffConfirmRequest: (
    message: string,
    diff: string,
    filename: string | undefined,
    timeoutSec: number
  ) => Promise<DiffConfirmResult>;

  /** 複数選択可能な投票を送信し、ユーザーの選択を待つ */
  sendPoll: (
    question: string,
    options: string[],
    minSelections: number,
    maxSelections: number,
    timeoutSec: number
  ) => Promise<PollResult>;

  /** Discord に接続する */
  connect: () => Promise<void>;

  /** Discord から切断する */
  disconnect: () => Promise<void>;
};

/**
 * ツールハンドラーの型
 */
export type ToolHandlers = {
  requestApproval: (
    message: string,
    timeout?: number
  ) => Promise<ApprovalResult>;
  notify: (message: string) => Promise<NotifyResult>;
  askQuestion: (
    question: string,
    options: string[],
    timeout?: number
  ) => Promise<QuestionResult>;
  scheduleReminder: (
    message: string,
    delaySeconds: number
  ) => Promise<ReminderResult>;
  cancelReminder: (reminderId: string) => Promise<CancelReminderResult>;
  notifyWithStatus: (
    message: string,
    status: NotificationStatus,
    details?: string
  ) => Promise<NotifyResult>;
  requestTextInput: (
    title: string,
    prompt: string,
    placeholder?: string,
    multiline?: boolean,
    timeout?: number
  ) => Promise<TextInputResult>;
  confirmWithDiff: (
    message: string,
    diff: string,
    filename?: string,
    timeout?: number
  ) => Promise<DiffConfirmResult>;
  poll: (
    question: string,
    options: string[],
    minSelections?: number,
    maxSelections?: number,
    timeout?: number
  ) => Promise<PollResult>;
};
