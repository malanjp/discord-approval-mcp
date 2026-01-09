import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDiscordAdapter } from './discord-adapter.js';
import { createToolHandlers } from './handlers.js';
import { createMcpServer } from './mcp-server.js';

/**
 * 設定を読み込む
 */
function loadConfig(): { token: string; channelId: string } {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    throw new Error('DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID are required');
  }

  return { token, channelId };
}

/**
 * メイン関数
 */
async function main(): Promise<void> {
  // 設定を読み込む
  const config = loadConfig();

  // Discord Adapter を作成
  const adapter = createDiscordAdapter(config);

  // ツールハンドラーを作成
  const handlers = createToolHandlers(adapter);

  // MCP サーバーを作成
  const server = createMcpServer(handlers);

  // Discord に接続
  await adapter.connect();

  // MCP サーバーを起動
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Discord Approval Server started');
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// メイン関数を実行
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
