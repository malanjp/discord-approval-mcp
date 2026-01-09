import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, TextChannel, ComponentType, Events, } from 'discord.js';
// 環境変数チェック
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
    console.error('Error: DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID are required');
    process.exit(1);
}
// Discord クライアント初期化
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});
let channel = null;
let isReady = false;
// Discord 接続完了を待つ Promise
const discordReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
        reject(new Error('Discord connection timeout'));
    }, 30000);
    client.once(Events.ClientReady, (readyClient) => {
        clearTimeout(timeout);
        console.error(`Discord Bot logged in as ${readyClient.user.tag}`);
        const ch = client.channels.cache.get(DISCORD_CHANNEL_ID);
        if (!ch || !(ch instanceof TextChannel)) {
            reject(new Error(`Channel ${DISCORD_CHANNEL_ID} not found or is not a text channel`));
            return;
        }
        channel = ch;
        isReady = true;
        resolve();
    });
    client.once(Events.Error, (error) => {
        clearTimeout(timeout);
        reject(error);
    });
});
// Discord にログイン
client.login(DISCORD_BOT_TOKEN).catch((error) => {
    console.error('Failed to login to Discord:', error);
    process.exit(1);
});
/**
 * 承認リクエストを送信し、ユーザーの応答を待つ
 */
async function requestApproval(message, timeoutSec = 300) {
    if (!isReady || !channel) {
        return { approved: false, timedOut: false, error: 'Discord not connected' };
    }
    try {
        const approveBtn = new ButtonBuilder()
            .setCustomId('approve')
            .setLabel('✅ 承認')
            .setStyle(ButtonStyle.Success);
        const denyBtn = new ButtonBuilder()
            .setCustomId('deny')
            .setLabel('❌ 否認')
            .setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);
        const sent = await channel.send({
            content: `🔔 **承認リクエスト**\n\n${message}`,
            components: [row],
        });
        try {
            const interaction = await sent.awaitMessageComponent({
                componentType: ComponentType.Button,
                time: timeoutSec * 1000,
            });
            const approved = interaction.customId === 'approve';
            await interaction.update({
                content: `${approved ? '✅' : '❌'} **${approved ? '承認' : '否認'}済み**\n\n~~${message}~~`,
                components: [],
            });
            return { approved, timedOut: false };
        }
        catch {
            // タイムアウト
            await sent.edit({
                content: `⏰ **タイムアウト**\n\n~~${message}~~`,
                components: [],
            });
            return { approved: false, timedOut: true };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { approved: false, timedOut: false, error: errorMessage };
    }
}
/**
 * 通知を送信（応答不要）
 */
async function notify(message) {
    if (!isReady || !channel) {
        return { success: false, error: 'Discord not connected' };
    }
    try {
        await channel.send(`📢 ${message}`);
        return { success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}
// MCP サーバー設定
const server = new Server({ name: 'discord-approval', version: '1.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'request_approval',
            description: 'Discordに承認リクエストを送信し、ユーザーの応答（承認/否認）を待つ。ユーザーの確認が必要な操作の前に使用する。',
            inputSchema: {
                type: 'object',
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
            description: 'Discordに通知を送信する（応答不要）。処理の完了報告やステータス更新に使用する。',
            inputSchema: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                        description: '通知メッセージ',
                    },
                },
                required: ['message'],
            },
        },
    ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Discord 接続を待つ
    await discordReady;
    const { name, arguments: args } = request.params;
    if (name === 'request_approval') {
        const { message, timeout = 300 } = args;
        const result = await requestApproval(message, timeout);
        let responseText;
        if (result.error) {
            responseText = `エラー: ${result.error}`;
        }
        else if (result.timedOut) {
            responseText = 'タイムアウト: ユーザーからの応答がありませんでした';
        }
        else {
            responseText = result.approved ? '承認されました' : '否認されました';
        }
        return {
            content: [{ type: 'text', text: responseText }],
        };
    }
    if (name === 'notify') {
        const { message } = args;
        const result = await notify(message);
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
    throw new Error(`Unknown tool: ${name}`);
});
// エラーハンドリング
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});
// MCP サーバー起動
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('MCP Discord Approval Server started');
