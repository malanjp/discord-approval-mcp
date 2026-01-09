import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ToolHandlers } from './types.js';

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

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}
