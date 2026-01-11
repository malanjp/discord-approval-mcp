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
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { randomUUID } from 'crypto';
import type {
  DiscordAdapter,
  ApprovalResult,
  NotifyResult,
  QuestionResult,
  ReminderResult,
  CancelReminderResult,
  NotificationStatus,
  TextInputResult,
  DiffConfirmResult,
  PollResult,
} from './types.js';

/**
 * ステータスと色・絵文字のマッピング
 */
const STATUS_CONFIG: Record<
  NotificationStatus,
  { color: number; emoji: string; title: string }
> = {
  success: { color: 0x57f287, emoji: '✅', title: '成功' },
  error: { color: 0xed4245, emoji: '❌', title: 'エラー' },
  warning: { color: 0xfee75c, emoji: '⚠️', title: '警告' },
  info: { color: 0x5865f2, emoji: 'ℹ️', title: '情報' },
};

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

    async sendStatusNotification(
      message: string,
      status: NotificationStatus,
      details?: string
    ): Promise<NotifyResult> {
      if (!ready || !channel) {
        return { success: false, error: 'Discord not connected' };
      }

      try {
        const config = STATUS_CONFIG[status];

        const embed = new EmbedBuilder()
          .setColor(config.color)
          .setTitle(`${config.emoji} ${config.title}`)
          .setDescription(message)
          .setTimestamp();

        if (details) {
          embed.addFields({ name: '詳細', value: details });
        }

        await channel.send({ embeds: [embed] });
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    },

    async sendTextInputRequest(
      title: string,
      prompt: string,
      placeholder: string | undefined,
      multiline: boolean,
      timeoutSec: number
    ): Promise<TextInputResult> {
      if (!ready || !channel) {
        return {
          text: null,
          timedOut: false,
          cancelled: false,
          error: 'Discord not connected',
        };
      }

      const interactionId = randomUUID();

      try {
        // Step 1: 入力ボタン付きメッセージを送信
        const inputBtn = new ButtonBuilder()
          .setCustomId(`text_input_${interactionId}`)
          .setLabel('📝 入力する')
          .setStyle(ButtonStyle.Primary);

        const cancelBtn = new ButtonBuilder()
          .setCustomId(`text_input_cancel_${interactionId}`)
          .setLabel('キャンセル')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(inputBtn, cancelBtn);

        const sent = await channel.send({
          content: `📝 **テキスト入力リクエスト**\n\n${prompt}`,
          components: [row],
        });

        try {
          // Step 2: ボタンのクリックを待つ
          const buttonInteraction = await sent.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: timeoutSec * 1000,
          });

          // キャンセルボタンが押された場合
          if (buttonInteraction.customId === `text_input_cancel_${interactionId}`) {
            await buttonInteraction.update({
              content: `❌ **キャンセル**\n\n~~${prompt}~~`,
              components: [],
            });
            return { text: null, timedOut: false, cancelled: true };
          }

          // Step 3: Modalを表示
          const modal = new ModalBuilder()
            .setCustomId(`text_input_modal_${interactionId}`)
            .setTitle(title.slice(0, 45));

          const textInput = new TextInputBuilder()
            .setCustomId('text_input_value')
            .setLabel(prompt.slice(0, 45))
            .setStyle(multiline ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(true);

          if (placeholder) {
            textInput.setPlaceholder(placeholder.slice(0, 100));
          }

          const modalRow = new ActionRowBuilder<TextInputBuilder>().addComponents(textInput);
          modal.addComponents(modalRow);

          await buttonInteraction.showModal(modal);

          // Step 4: Modal送信を待つ
          const modalSubmit = await buttonInteraction.awaitModalSubmit({
            time: timeoutSec * 1000,
            filter: (i) => i.customId === `text_input_modal_${interactionId}`,
          });

          const text = modalSubmit.fields.getTextInputValue('text_input_value');

          // Modal送信への応答（必須）
          await modalSubmit.deferUpdate();

          // 元のメッセージを更新
          await sent.edit({
            content: `✅ **入力完了**\n\n${prompt}\n\n**入力内容:**\n\`\`\`\n${text.slice(0, 500)}${text.length > 500 ? '...' : ''}\n\`\`\``,
            components: [],
          });

          return { text, timedOut: false, cancelled: false };
        } catch (error) {
          const isTimeout =
            error instanceof Error &&
            (error.message.includes('time') || error.message.includes('Collector'));

          if (isTimeout) {
            try {
              await sent.edit({
                content: `⏰ **タイムアウト**\n\n~~${prompt}~~`,
                components: [],
              });
            } catch (editError) {
              console.error('Failed to update message after timeout:', editError);
            }
            return { text: null, timedOut: true, cancelled: false };
          }

          console.error('sendTextInputRequest error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return { text: null, timedOut: false, cancelled: false, error: errorMessage };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { text: null, timedOut: false, cancelled: false, error: errorMessage };
      }
    },

    async sendDiffConfirmRequest(
      message: string,
      diff: string,
      filename: string | undefined,
      timeoutSec: number
    ): Promise<DiffConfirmResult> {
      if (!ready || !channel) {
        return { approved: false, timedOut: false, error: 'Discord not connected' };
      }

      const interactionId = randomUUID();
      const MAX_DIFF_LENGTH = 1500;
      const isTruncated = diff.length > MAX_DIFF_LENGTH;
      const displayDiff = isTruncated
        ? diff.slice(0, MAX_DIFF_LENGTH) + '\n... (truncated)'
        : diff;

      try {
        // Embed を作成
        const embed = new EmbedBuilder()
          .setColor(0x5865f2) // Discord Blurple
          .setTitle('📝 コード変更の確認')
          .setDescription(message)
          .setTimestamp();

        // ファイル名がある場合はフィールドに追加
        if (filename) {
          embed.addFields({ name: 'ファイル', value: `\`${filename}\``, inline: true });
        }

        // diff の言語ヒント（syntax highlight 用）
        const lang = filename ? getLanguageFromFilename(filename) : 'diff';
        embed.addFields({
          name: 'Diff',
          value: `\`\`\`${lang}\n${displayDiff}\n\`\`\``,
        });

        if (isTruncated) {
          embed.setFooter({
            text: `差分が長いため一部省略されています（全${diff.length}文字）`,
          });
        }

        // ボタンを作成
        const approveBtn = new ButtonBuilder()
          .setCustomId(`diff_approve_${interactionId}`)
          .setLabel('✅ 承認')
          .setStyle(ButtonStyle.Success);

        const denyBtn = new ButtonBuilder()
          .setCustomId(`diff_deny_${interactionId}`)
          .setLabel('❌ 否認')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, denyBtn);

        const sent = await channel.send({
          embeds: [embed],
          components: [row],
        });

        try {
          const interaction = await sent.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: timeoutSec * 1000,
            filter: (i) =>
              i.customId === `diff_approve_${interactionId}` ||
              i.customId === `diff_deny_${interactionId}`,
          });

          const approved = interaction.customId === `diff_approve_${interactionId}`;

          // 結果を反映して更新
          const resultEmbed = EmbedBuilder.from(embed)
            .setColor(approved ? 0x57f287 : 0xed4245)
            .setTitle(approved ? '✅ 承認済み' : '❌ 否認済み');

          await interaction.update({
            embeds: [resultEmbed],
            components: [],
          });

          return { approved, timedOut: false };
        } catch (error) {
          const isTimeout =
            error instanceof Error &&
            (error.message.includes('time') || error.message.includes('Collector'));

          if (isTimeout) {
            const timeoutEmbed = EmbedBuilder.from(embed)
              .setColor(0x99aab5) // Gray
              .setTitle('⏰ タイムアウト');

            await sent.edit({
              embeds: [timeoutEmbed],
              components: [],
            });
            return { approved: false, timedOut: true };
          }

          console.error('sendDiffConfirmRequest error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return { approved: false, timedOut: false, error: errorMessage };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { approved: false, timedOut: false, error: errorMessage };
      }
    },

    async sendPoll(
      question: string,
      options: string[],
      minSelections: number,
      maxSelections: number,
      timeoutSec: number
    ): Promise<PollResult> {
      if (!ready || !channel) {
        return { selected: [], timedOut: false, error: 'Discord not connected' };
      }

      try {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('poll_select')
          .setPlaceholder(
            minSelections > 0
              ? `${minSelections}〜${maxSelections}個選択してください...`
              : `最大${maxSelections}個選択できます...`
          )
          .setMinValues(minSelections)
          .setMaxValues(maxSelections)
          .addOptions(
            options.map((option) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(option.slice(0, 100))
                .setValue(option.slice(0, 100))
            )
          );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        const sent = await channel.send({
          content: `📊 **投票**\n\n${question}\n\n_${minSelections > 0 ? `${minSelections}〜` : ''}${maxSelections}個まで選択可能_`,
          components: [row],
        });

        try {
          const interaction = await sent.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            time: timeoutSec * 1000,
          });

          const selected = interaction.values;

          try {
            await interaction.update({
              content: `✅ **回答済み**\n\n${question}\n\n**選択 (${selected.length}件):**\n${selected.map((s) => `・${s}`).join('\n')}`,
              components: [],
            });
          } catch (updateError) {
            console.error('Failed to update interaction:', updateError);
          }

          return { selected, timedOut: false };
        } catch (error) {
          const isTimeout =
            error instanceof Error &&
            (error.message.includes('time') || error.message.includes('Collector'));

          if (isTimeout) {
            try {
              await sent.edit({
                content: `⏰ **タイムアウト**\n\n~~${question}~~`,
                components: [],
              });
            } catch (editError) {
              console.error('Failed to update message after timeout:', editError);
            }
            return { selected: [], timedOut: true };
          }

          console.error('sendPoll error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return { selected: [], timedOut: false, error: errorMessage };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { selected: [], timedOut: false, error: errorMessage };
      }
    },
  };
}

/**
 * ファイル拡張子から言語を判定するヘルパー
 */
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
  };
  return langMap[ext || ''] || 'diff';
}
