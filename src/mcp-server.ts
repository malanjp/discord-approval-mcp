import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ToolHandlers, NotificationStatus } from './types.js';

/**
 * MCP サーバーを作成する
 *
 * 注意: Discord への接続は呼び出し元（index.ts）で行うこと
 */
export function createMcpServer(handlers: ToolHandlers): Server {
  const server = new Server(
    { name: 'discord-approval', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'request_approval',
        description:
          'Discordに承認リクエストを送信し、ユーザーの応答（承認/否認）を待つ。ユーザーの確認が必要な操作の前に使用する。',
        inputSchema: {
          type: 'object' as const,
          properties: {
            message: {
              type: 'string',
              description: '確認したい内容（何を承認するのかを明確に記述）',
            },
            timeout: {
              type: 'number',
              description: 'タイムアウト秒数（デフォルト300秒＝5分）',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'notify',
        description:
          'Discordに通知を送信する（応答不要）。処理の完了報告やステータス更新に使用する。',
        inputSchema: {
          type: 'object' as const,
          properties: {
            message: {
              type: 'string',
              description: '通知メッセージ',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'ask_question',
        description:
          'Discordに選択肢付きの質問を送信し、ユーザーの選択を待つ。複数の選択肢から1つを選んでもらう場合に使用する。',
        inputSchema: {
          type: 'object' as const,
          properties: {
            question: {
              type: 'string',
              description: '質問文',
            },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: '選択肢の配列（2〜25個）',
            },
            timeout: {
              type: 'number',
              description: 'タイムアウト秒数（デフォルト300秒＝5分）',
            },
          },
          required: ['question', 'options'],
        },
      },
      {
        name: 'schedule_reminder',
        description:
          '指定秒数後にDiscordへリマインダーを送信する。AskUserQuestionと併用し、一定時間応答がない場合にDiscordへ通知するために使用する。',
        inputSchema: {
          type: 'object' as const,
          properties: {
            message: {
              type: 'string',
              description: 'リマインダーメッセージ',
            },
            delay_seconds: {
              type: 'number',
              description: '遅延秒数（1〜3600秒＝1時間）',
            },
          },
          required: ['message', 'delay_seconds'],
        },
      },
      {
        name: 'cancel_reminder',
        description:
          'スケジュール済みのリマインダーをキャンセルする。ユーザーが応答した場合にリマインダーを取り消すために使用する。',
        inputSchema: {
          type: 'object' as const,
          properties: {
            reminder_id: {
              type: 'string',
              description: 'キャンセルするリマインダーのID（schedule_reminderで取得）',
            },
          },
          required: ['reminder_id'],
        },
      },
      {
        name: 'notify_with_status',
        description:
          'Discordにステータス付き通知を送信する（Embed形式）。処理結果の報告（成功/エラー/警告/情報）に使用する。',
        inputSchema: {
          type: 'object' as const,
          properties: {
            message: {
              type: 'string',
              description: '通知メッセージ（メインの内容）',
            },
            status: {
              type: 'string',
              enum: ['success', 'error', 'warning', 'info'],
              description: 'ステータス（success=緑, error=赤, warning=黄, info=青）',
            },
            details: {
              type: 'string',
              description: '追加の詳細情報（オプション）',
            },
          },
          required: ['message', 'status'],
        },
      },
      {
        name: 'request_text_input',
        description:
          'Discordでテキスト入力を要求する。Modalダイアログでユーザーにテキストを入力してもらう。エラー原因のヒアリング、追加要件の確認、コミットメッセージの修正依頼などに使用する。',
        inputSchema: {
          type: 'object' as const,
          properties: {
            title: {
              type: 'string',
              description: 'Modalのタイトル（45文字以内）',
            },
            prompt: {
              type: 'string',
              description: '入力を促すメッセージ',
            },
            placeholder: {
              type: 'string',
              description: '入力欄のプレースホルダー（100文字以内、省略可）',
            },
            multiline: {
              type: 'boolean',
              description: '複数行入力を許可するか（デフォルトfalse）',
            },
            timeout: {
              type: 'number',
              description: 'タイムアウト秒数（デフォルト300秒、最大900秒）',
            },
          },
          required: ['title', 'prompt'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'request_approval') {
      const { message, timeout = 300 } = args as {
        message: string;
        timeout?: number;
      };
      const result = await handlers.requestApproval(message, timeout);

      let responseText: string;
      if (result.error) {
        responseText = `エラー: ${result.error}`;
      } else if (result.timedOut) {
        responseText = 'タイムアウト: ユーザーからの応答がありませんでした';
      } else {
        responseText = result.approved ? '承認されました' : '否認されました';
      }

      return {
        content: [{ type: 'text', text: responseText }],
      };
    }

    if (name === 'notify') {
      const { message } = args as { message: string };
      const result = await handlers.notify(message);

      return {
        content: [
          {
            type: 'text',
            text: result.success
              ? '通知を送信しました'
              : `通知の送信に失敗: ${result.error}`,
          },
        ],
      };
    }

    if (name === 'ask_question') {
      const { question, options, timeout = 300 } = args as {
        question: string;
        options: string[];
        timeout?: number;
      };
      const result = await handlers.askQuestion(question, options, timeout);

      let responseText: string;
      if (result.error) {
        responseText = `エラー: ${result.error}`;
      } else if (result.timedOut) {
        responseText = 'タイムアウト: ユーザーからの応答がありませんでした';
      } else {
        responseText = `ユーザーの選択: ${result.selected}`;
      }

      return {
        content: [{ type: 'text', text: responseText }],
      };
    }

    if (name === 'schedule_reminder') {
      const { message, delay_seconds } = args as {
        message: string;
        delay_seconds: number;
      };
      const result = await handlers.scheduleReminder(message, delay_seconds);

      if (result.error) {
        return {
          content: [{ type: 'text', text: `エラー: ${result.error}` }],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `リマインダーをスケジュールしました（${delay_seconds}秒後）\nreminder_id: ${result.reminderId}`,
          },
        ],
      };
    }

    if (name === 'cancel_reminder') {
      const { reminder_id } = args as { reminder_id: string };
      const result = await handlers.cancelReminder(reminder_id);

      return {
        content: [
          {
            type: 'text',
            text: result.success
              ? 'リマインダーをキャンセルしました'
              : `キャンセルに失敗: ${result.error}`,
          },
        ],
      };
    }

    if (name === 'notify_with_status') {
      const { message, status, details } = args as {
        message: string;
        status: NotificationStatus;
        details?: string;
      };
      const result = await handlers.notifyWithStatus(message, status, details);

      return {
        content: [
          {
            type: 'text',
            text: result.success
              ? 'ステータス通知を送信しました'
              : `ステータス通知の送信に失敗: ${result.error}`,
          },
        ],
      };
    }

    if (name === 'request_text_input') {
      const { title, prompt, placeholder, multiline = false, timeout = 300 } = args as {
        title: string;
        prompt: string;
        placeholder?: string;
        multiline?: boolean;
        timeout?: number;
      };
      const result = await handlers.requestTextInput(
        title,
        prompt,
        placeholder,
        multiline,
        timeout
      );

      let responseText: string;
      if (result.error) {
        responseText = `エラー: ${result.error}`;
      } else if (result.timedOut) {
        responseText = 'タイムアウト: ユーザーからの応答がありませんでした';
      } else if (result.cancelled) {
        responseText = 'キャンセル: ユーザーが入力をキャンセルしました';
      } else {
        responseText = `入力テキスト:\n${result.text}`;
      }

      return {
        content: [{ type: 'text', text: responseText }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}
