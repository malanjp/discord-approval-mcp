import type {
  DiscordAdapter,
  ApprovalResult,
  NotifyResult,
  QuestionResult,
  ToolHandlers,
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
  };
}
