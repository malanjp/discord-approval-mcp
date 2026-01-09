import {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  TextChannel,
  ComponentType,
  Events,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { randomUUID } from 'crypto';
import type {
  DiscordAdapter,
  ApprovalResult,
  NotifyResult,
  QuestionResult,
  ReminderResult,
  CancelReminderResult,
} from './types.js';

export type DiscordAdapterConfig = {
  token: string;
  channelId: string;
  /** 接続タイムアウト（ミリ秒）。デフォルト 30000 */
  connectionTimeout?: number;
};

/**
 * Discord Adapter を作成する
 *
 * connect() を呼ぶまで Discord への接続は行われない（遅延初期化）
 */
export function createDiscordAdapter(config: DiscordAdapterConfig): DiscordAdapter {
  let client: Client | null = null;
  let channel: TextChannel | null = null;
  let ready = false;

  const connectionTimeout = config.connectionTimeout ?? 30000;

  // リマインダータイマー管理用
  const reminderTimers = new Map<string, NodeJS.Timeout>();

  return {
    isReady: () => ready,

    async connect(): Promise<void> {
      client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      });

      const connectionPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discord connection timeout'));
        }, connectionTimeout);

        client!.once(Events.ClientReady, (readyClient) => {
          clearTimeout(timeout);
          console.error(`Discord Bot logged in as ${readyClient.user.tag}`);

          const ch = client!.channels.cache.get(config.channelId);
          if (!ch || !(ch instanceof TextChannel)) {
            reject(
              new Error(
                `Channel ${config.channelId} not found or is not a text channel`
              )
            );
            return;
          }

          channel = ch;
          ready = true;
          resolve();
        });

        client!.once(Events.Error, (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      await client.login(config.token);
      await connectionPromise;
    },

    async disconnect(): Promise<void> {
      // すべてのリマインダータイマーをクリア
      for (const [id, timer] of reminderTimers) {
        clearTimeout(timer);
        reminderTimers.delete(id);
      }

      if (client) {
        try {
          client.destroy();
        } catch (error) {
          console.error('Error during disconnect:', error);
        } finally {
          client = null;
          channel = null;
          ready = false;
        }
      }
    },

    async sendApprovalRequest(
      message: string,
      timeoutSec: number
    ): Promise<ApprovalResult> {
      if (!ready || !channel) {
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

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          approveBtn,
          denyBtn
        );

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

          try {
            await interaction.update({
              content: `${approved ? '✅' : '❌'} **${approved ? '承認' : '否認'}済み**\n\n~~${message}~~`,
              components: [],
            });
          } catch (updateError) {
            console.error('Failed to update interaction:', updateError);
          }

          return { approved, timedOut: false };
        } catch (error) {
          // タイムアウトかどうかを判定
          const isTimeout =
            error instanceof Error &&
            (error.message.includes('time') ||
              error.message.includes('Collector'));

          if (isTimeout) {
            try {
              await sent.edit({
                content: `⏰ **タイムアウト**\n\n~~${message}~~`,
                components: [],
              });
            } catch (editError) {
              console.error('Failed to update message after timeout:', editError);
            }
            return { approved: false, timedOut: true };
          }

          // タイムアウト以外のエラー
          console.error('sendApprovalRequest error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return { approved: false, timedOut: false, error: errorMessage };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { approved: false, timedOut: false, error: errorMessage };
      }
    },

    async sendNotification(message: string): Promise<NotifyResult> {
      if (!ready || !channel) {
        return { success: false, error: 'Discord not connected' };
      }

      try {
        await channel.send(`📢 ${message}`);
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },

    async sendQuestion(
      question: string,
      options: string[],
      timeoutSec: number
    ): Promise<QuestionResult> {
      if (!ready || !channel) {
        return { selected: null, timedOut: false, error: 'Discord not connected' };
      }

      try {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('ask_question_select')
          .setPlaceholder('選択してください...')
          .addOptions(
            options.map((option) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(option.slice(0, 100))
                .setValue(option.slice(0, 100))
            )
          );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          selectMenu
        );

        const sent = await channel.send({
          content: `❓ **質問**\n\n${question}`,
          components: [row],
        });

        try {
          const interaction = await sent.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            time: timeoutSec * 1000,
          });

          const selected = interaction.values[0];

          try {
            await interaction.update({
              content: `✅ **回答済み**\n\n${question}\n\n**選択:** ${selected}`,
              components: [],
            });
          } catch (updateError) {
            console.error('Failed to update interaction:', updateError);
          }

          return { selected, timedOut: false };
        } catch (error) {
          // タイムアウトかどうかを判定
          const isTimeout =
            error instanceof Error &&
            (error.message.includes('time') ||
              error.message.includes('Collector'));

          if (isTimeout) {
            try {
              await sent.edit({
                content: `⏰ **タイムアウト**\n\n~~${question}~~`,
                components: [],
              });
            } catch (editError) {
              console.error('Failed to update message after timeout:', editError);
            }
            return { selected: null, timedOut: true };
          }

          // タイムアウト以外のエラー
          console.error('sendQuestion error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return { selected: null, timedOut: false, error: errorMessage };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { selected: null, timedOut: false, error: errorMessage };
      }
    },

    async scheduleReminder(
      message: string,
      delaySeconds: number
    ): Promise<ReminderResult> {
      if (!ready || !channel) {
        return { reminderId: '', success: false, error: 'Discord not connected' };
      }

      const reminderId = randomUUID();
      const channelRef = channel;

      try {
        const timeoutId = setTimeout(async () => {
          try {
            await channelRef.send(`🔔 **リマインダー**\n\n${message}`);
          } catch (error) {
            console.error('Failed to send reminder:', error);
          } finally {
            reminderTimers.delete(reminderId);
          }
        }, delaySeconds * 1000);

        reminderTimers.set(reminderId, timeoutId);
        return { reminderId, success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { reminderId: '', success: false, error: errorMessage };
      }
    },

    async cancelReminder(reminderId: string): Promise<CancelReminderResult> {
      const timeoutId = reminderTimers.get(reminderId);
      if (!timeoutId) {
        return { success: false, error: 'リマインダーが見つかりません' };
      }

      try {
        clearTimeout(timeoutId);
        reminderTimers.delete(reminderId);
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },
  };
}
