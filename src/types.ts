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
};
