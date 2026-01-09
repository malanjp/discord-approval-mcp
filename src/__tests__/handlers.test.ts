import { describe, it, expect, vi } from 'vitest';
import { createToolHandlers } from '../handlers.js';
import type { DiscordAdapter } from '../types.js';

/**
 * モック Discord Adapter を作成するヘルパー
 */
function createMockAdapter(
  overrides: Partial<DiscordAdapter> = {}
): DiscordAdapter {
  return {
    isReady: () => true,
    sendApprovalRequest: vi
      .fn()
      .mockResolvedValue({ approved: true, timedOut: false }),
    sendNotification: vi.fn().mockResolvedValue({ success: true }),
    sendQuestion: vi
      .fn()
      .mockResolvedValue({ selected: 'option1', timedOut: false }),
    scheduleReminder: vi
      .fn()
      .mockResolvedValue({ reminderId: 'test-id-123', success: true }),
    cancelReminder: vi.fn().mockResolvedValue({ success: true }),
    sendStatusNotification: vi.fn().mockResolvedValue({ success: true }),
    sendTextInputRequest: vi
      .fn()
      .mockResolvedValue({ text: 'test input', timedOut: false, cancelled: false }),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createToolHandlers', () => {
  describe('requestApproval', () => {
    it('Discord 未接続時はエラーを返す', async () => {
      const adapter = createMockAdapter({ isReady: () => false });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestApproval('test message');

      expect(result).toEqual({
        approved: false,
        timedOut: false,
        error: 'Discord not connected',
      });
      expect(adapter.sendApprovalRequest).not.toHaveBeenCalled();
    });

    it('承認されたら approved: true を返す', async () => {
      const adapter = createMockAdapter({
        sendApprovalRequest: vi
          .fn()
          .mockResolvedValue({ approved: true, timedOut: false }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestApproval('test message');

      expect(result.approved).toBe(true);
      expect(result.timedOut).toBe(false);
      expect(adapter.sendApprovalRequest).toHaveBeenCalledWith(
        'test message',
        300
      );
    });

    it('否認されたら approved: false を返す', async () => {
      const adapter = createMockAdapter({
        sendApprovalRequest: vi
          .fn()
          .mockResolvedValue({ approved: false, timedOut: false }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestApproval('test message');

      expect(result.approved).toBe(false);
      expect(result.timedOut).toBe(false);
    });

    it('タイムアウト時は timedOut: true を返す', async () => {
      const adapter = createMockAdapter({
        sendApprovalRequest: vi
          .fn()
          .mockResolvedValue({ approved: false, timedOut: true }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestApproval('test message', 60);

      expect(result.timedOut).toBe(true);
      expect(adapter.sendApprovalRequest).toHaveBeenCalledWith(
        'test message',
        60
      );
    });

    it('カスタムタイムアウトが正しく渡される', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      await handlers.requestApproval('test message', 120);

      expect(adapter.sendApprovalRequest).toHaveBeenCalledWith(
        'test message',
        120
      );
    });
  });

  describe('notify', () => {
    it('Discord 未接続時はエラーを返す', async () => {
      const adapter = createMockAdapter({ isReady: () => false });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.notify('test notification');

      expect(result).toEqual({
        success: false,
        error: 'Discord not connected',
      });
      expect(adapter.sendNotification).not.toHaveBeenCalled();
    });

    it('通知送信成功時は success: true を返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.notify('test notification');

      expect(result.success).toBe(true);
      expect(adapter.sendNotification).toHaveBeenCalledWith('test notification');
    });

    it('送信失敗時はエラーを返す', async () => {
      const adapter = createMockAdapter({
        sendNotification: vi
          .fn()
          .mockResolvedValue({ success: false, error: 'Network error' }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.notify('test notification');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('askQuestion', () => {
    it('Discord 未接続時はエラーを返す', async () => {
      const adapter = createMockAdapter({ isReady: () => false });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.askQuestion('質問?', ['A', 'B']);

      expect(result).toEqual({
        selected: null,
        timedOut: false,
        error: 'Discord not connected',
      });
      expect(adapter.sendQuestion).not.toHaveBeenCalled();
    });

    it('選択肢が 2 個未満の場合はエラーを返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.askQuestion('質問?', ['option1']);

      expect(result.error).toBe('選択肢は2個以上必要です');
      expect(adapter.sendQuestion).not.toHaveBeenCalled();
    });

    it('選択肢が 0 個の場合はエラーを返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.askQuestion('質問?', []);

      expect(result.error).toBe('選択肢は2個以上必要です');
    });

    it('選択肢が 25 個を超える場合はエラーを返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);
      const options = Array.from({ length: 26 }, (_, i) => `option${i}`);

      const result = await handlers.askQuestion('質問?', options);

      expect(result.error).toBe('選択肢は25個以下にしてください');
      expect(adapter.sendQuestion).not.toHaveBeenCalled();
    });

    it('選択肢が 25 個ちょうどの場合は正常に動作する', async () => {
      const adapter = createMockAdapter({
        sendQuestion: vi
          .fn()
          .mockResolvedValue({ selected: 'option0', timedOut: false }),
      });
      const handlers = createToolHandlers(adapter);
      const options = Array.from({ length: 25 }, (_, i) => `option${i}`);

      const result = await handlers.askQuestion('質問?', options);

      expect(result.selected).toBe('option0');
      expect(adapter.sendQuestion).toHaveBeenCalled();
    });

    it('正常に選択された場合は selected を返す', async () => {
      const adapter = createMockAdapter({
        sendQuestion: vi
          .fn()
          .mockResolvedValue({ selected: 'A', timedOut: false }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.askQuestion('どちら?', ['A', 'B']);

      expect(result.selected).toBe('A');
      expect(result.timedOut).toBe(false);
      expect(adapter.sendQuestion).toHaveBeenCalledWith('どちら?', ['A', 'B'], 300);
    });

    it('タイムアウト時は timedOut: true を返す', async () => {
      const adapter = createMockAdapter({
        sendQuestion: vi
          .fn()
          .mockResolvedValue({ selected: null, timedOut: true }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.askQuestion('質問?', ['A', 'B'], 60);

      expect(result.selected).toBeNull();
      expect(result.timedOut).toBe(true);
      expect(adapter.sendQuestion).toHaveBeenCalledWith('質問?', ['A', 'B'], 60);
    });

    it('カスタムタイムアウトが正しく渡される', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      await handlers.askQuestion('質問?', ['A', 'B'], 120);

      expect(adapter.sendQuestion).toHaveBeenCalledWith('質問?', ['A', 'B'], 120);
    });
  });

  describe('scheduleReminder', () => {
    it('Discord 未接続時はエラーを返す', async () => {
      const adapter = createMockAdapter({ isReady: () => false });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.scheduleReminder('リマインダー', 60);

      expect(result).toEqual({
        reminderId: '',
        success: false,
        error: 'Discord not connected',
      });
      expect(adapter.scheduleReminder).not.toHaveBeenCalled();
    });

    it('遅延秒数が 1 未満の場合はエラーを返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.scheduleReminder('リマインダー', 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('遅延秒数は1〜3600の範囲で指定してください');
      expect(adapter.scheduleReminder).not.toHaveBeenCalled();
    });

    it('遅延秒数が負の場合はエラーを返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.scheduleReminder('リマインダー', -10);

      expect(result.success).toBe(false);
      expect(result.error).toBe('遅延秒数は1〜3600の範囲で指定してください');
    });

    it('遅延秒数が 3600 を超える場合はエラーを返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.scheduleReminder('リマインダー', 3601);

      expect(result.success).toBe(false);
      expect(result.error).toBe('遅延秒数は1〜3600の範囲で指定してください');
      expect(adapter.scheduleReminder).not.toHaveBeenCalled();
    });

    it('遅延秒数が 3600 ちょうどの場合は正常に動作する', async () => {
      const adapter = createMockAdapter({
        scheduleReminder: vi
          .fn()
          .mockResolvedValue({ reminderId: 'max-delay-id', success: true }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.scheduleReminder('リマインダー', 3600);

      expect(result.success).toBe(true);
      expect(result.reminderId).toBe('max-delay-id');
      expect(adapter.scheduleReminder).toHaveBeenCalledWith('リマインダー', 3600);
    });

    it('正常にスケジュールされた場合は reminderId を返す', async () => {
      const adapter = createMockAdapter({
        scheduleReminder: vi
          .fn()
          .mockResolvedValue({ reminderId: 'uuid-1234', success: true }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.scheduleReminder('テストリマインダー', 60);

      expect(result.success).toBe(true);
      expect(result.reminderId).toBe('uuid-1234');
      expect(adapter.scheduleReminder).toHaveBeenCalledWith(
        'テストリマインダー',
        60
      );
    });
  });

  describe('cancelReminder', () => {
    it('Discord 未接続時はエラーを返す', async () => {
      const adapter = createMockAdapter({ isReady: () => false });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.cancelReminder('test-id');

      expect(result).toEqual({
        success: false,
        error: 'Discord not connected',
      });
      expect(adapter.cancelReminder).not.toHaveBeenCalled();
    });

    it('存在しないリマインダーIDの場合はエラーを返す', async () => {
      const adapter = createMockAdapter({
        cancelReminder: vi
          .fn()
          .mockResolvedValue({ success: false, error: 'リマインダーが見つかりません' }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.cancelReminder('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('リマインダーが見つかりません');
    });

    it('正常にキャンセルされた場合は success: true を返す', async () => {
      const adapter = createMockAdapter({
        cancelReminder: vi.fn().mockResolvedValue({ success: true }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.cancelReminder('valid-id');

      expect(result.success).toBe(true);
      expect(adapter.cancelReminder).toHaveBeenCalledWith('valid-id');
    });
  });

  describe('notifyWithStatus', () => {
    it('Discord 未接続時はエラーを返す', async () => {
      const adapter = createMockAdapter({ isReady: () => false });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.notifyWithStatus('テスト', 'success');

      expect(result).toEqual({
        success: false,
        error: 'Discord not connected',
      });
      expect(adapter.sendStatusNotification).not.toHaveBeenCalled();
    });

    it('success ステータスで通知送信成功', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.notifyWithStatus('ビルド完了', 'success');

      expect(result.success).toBe(true);
      expect(adapter.sendStatusNotification).toHaveBeenCalledWith(
        'ビルド完了',
        'success',
        undefined
      );
    });

    it('error ステータスで通知送信成功', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.notifyWithStatus(
        'ビルド失敗',
        'error',
        'npm install でエラー'
      );

      expect(result.success).toBe(true);
      expect(adapter.sendStatusNotification).toHaveBeenCalledWith(
        'ビルド失敗',
        'error',
        'npm install でエラー'
      );
    });

    it('warning ステータスで通知送信成功', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.notifyWithStatus('非推奨APIの使用', 'warning');

      expect(result.success).toBe(true);
      expect(adapter.sendStatusNotification).toHaveBeenCalledWith(
        '非推奨APIの使用',
        'warning',
        undefined
      );
    });

    it('info ステータスで通知送信成功', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.notifyWithStatus('処理開始', 'info');

      expect(result.success).toBe(true);
      expect(adapter.sendStatusNotification).toHaveBeenCalledWith(
        '処理開始',
        'info',
        undefined
      );
    });

    it('無効なステータスの場合はエラーを返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      // @ts-expect-error 無効なステータスをテスト
      const result = await handlers.notifyWithStatus('テスト', 'invalid');

      expect(result.success).toBe(false);
      expect(result.error).toContain('無効なステータス');
      expect(adapter.sendStatusNotification).not.toHaveBeenCalled();
    });

    it('details パラメータが正しく渡される', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      await handlers.notifyWithStatus(
        'テスト完了',
        'success',
        'すべて25件のテストがパス'
      );

      expect(adapter.sendStatusNotification).toHaveBeenCalledWith(
        'テスト完了',
        'success',
        'すべて25件のテストがパス'
      );
    });

    it('送信失敗時はエラーを返す', async () => {
      const adapter = createMockAdapter({
        sendStatusNotification: vi
          .fn()
          .mockResolvedValue({ success: false, error: 'Network error' }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.notifyWithStatus('テスト', 'success');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('requestTextInput', () => {
    it('Discord 未接続時はエラーを返す', async () => {
      const adapter = createMockAdapter({ isReady: () => false });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestTextInput('タイトル', 'プロンプト');

      expect(result).toEqual({
        text: null,
        timedOut: false,
        cancelled: false,
        error: 'Discord not connected',
      });
      expect(adapter.sendTextInputRequest).not.toHaveBeenCalled();
    });

    it('タイトルが空の場合はエラーを返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestTextInput('', 'プロンプト');

      expect(result.error).toBe('タイトルは必須です');
      expect(adapter.sendTextInputRequest).not.toHaveBeenCalled();
    });

    it('タイトルが45文字を超える場合はエラーを返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);
      const longTitle = 'a'.repeat(46);

      const result = await handlers.requestTextInput(longTitle, 'プロンプト');

      expect(result.error).toBe('タイトルは45文字以内にしてください');
      expect(adapter.sendTextInputRequest).not.toHaveBeenCalled();
    });

    it('プロンプトが空の場合はエラーを返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestTextInput('タイトル', '');

      expect(result.error).toBe('プロンプトは必須です');
      expect(adapter.sendTextInputRequest).not.toHaveBeenCalled();
    });

    it('プレースホルダーが100文字を超える場合はエラーを返す', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);
      const longPlaceholder = 'a'.repeat(101);

      const result = await handlers.requestTextInput(
        'タイトル',
        'プロンプト',
        longPlaceholder
      );

      expect(result.error).toBe('プレースホルダーは100文字以内にしてください');
      expect(adapter.sendTextInputRequest).not.toHaveBeenCalled();
    });

    it('タイムアウトが範囲外の場合はエラーを返す（0秒）', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestTextInput(
        'タイトル',
        'プロンプト',
        undefined,
        false,
        0
      );

      expect(result.error).toBe('タイムアウトは1〜900秒の範囲で指定してください');
      expect(adapter.sendTextInputRequest).not.toHaveBeenCalled();
    });

    it('タイムアウトが範囲外の場合はエラーを返す（901秒）', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestTextInput(
        'タイトル',
        'プロンプト',
        undefined,
        false,
        901
      );

      expect(result.error).toBe('タイムアウトは1〜900秒の範囲で指定してください');
      expect(adapter.sendTextInputRequest).not.toHaveBeenCalled();
    });

    it('正常にテキスト入力された場合は text を返す', async () => {
      const adapter = createMockAdapter({
        sendTextInputRequest: vi.fn().mockResolvedValue({
          text: 'ユーザー入力テキスト',
          timedOut: false,
          cancelled: false,
        }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestTextInput(
        'タイトル',
        'プロンプト',
        'ヒント',
        true,
        120
      );

      expect(result.text).toBe('ユーザー入力テキスト');
      expect(result.timedOut).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(adapter.sendTextInputRequest).toHaveBeenCalledWith(
        'タイトル',
        'プロンプト',
        'ヒント',
        true,
        120
      );
    });

    it('タイムアウト時は timedOut: true を返す', async () => {
      const adapter = createMockAdapter({
        sendTextInputRequest: vi.fn().mockResolvedValue({
          text: null,
          timedOut: true,
          cancelled: false,
        }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestTextInput('タイトル', 'プロンプト');

      expect(result.text).toBeNull();
      expect(result.timedOut).toBe(true);
    });

    it('キャンセル時は cancelled: true を返す', async () => {
      const adapter = createMockAdapter({
        sendTextInputRequest: vi.fn().mockResolvedValue({
          text: null,
          timedOut: false,
          cancelled: true,
        }),
      });
      const handlers = createToolHandlers(adapter);

      const result = await handlers.requestTextInput('タイトル', 'プロンプト');

      expect(result.text).toBeNull();
      expect(result.cancelled).toBe(true);
    });

    it('デフォルト値が正しく使用される', async () => {
      const adapter = createMockAdapter();
      const handlers = createToolHandlers(adapter);

      await handlers.requestTextInput('タイトル', 'プロンプト');

      expect(adapter.sendTextInputRequest).toHaveBeenCalledWith(
        'タイトル',
        'プロンプト',
        undefined,
        false,
        300
      );
    });
  });
});
