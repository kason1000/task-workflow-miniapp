import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the telegram utils which check window.Telegram
// In jsdom, window exists but window.Telegram doesn't

describe('Telegram utils — browser/non-Telegram mode', () => {
  beforeEach(() => {
    // Ensure no Telegram on window
    delete (window as any).Telegram;
  });

  it('isTelegram-like check: returns false when no Telegram on window', async () => {
    // Import fresh each time
    const { initTelegramWebApp, getTelegramUser, getTelegramLanguageCode, showAlert, showConfirm, hapticFeedback } = await import('../src/utils/telegram');

    // initTelegramWebApp returns mock in non-Telegram environment
    const app = initTelegramWebApp();
    expect(app).toBeDefined();
    expect(app.initData).toBe('');
    expect(typeof app.ready).toBe('function');
    expect(typeof app.expand).toBe('function');
    expect(typeof app.close).toBe('function');
  });

  it('getTelegramUser returns mock user outside Telegram', async () => {
    const { getTelegramUser } = await import('../src/utils/telegram');
    const user = getTelegramUser();
    expect(user).toBeDefined();
    expect(user.id).toBe(8432601826);
    expect(user.first_name).toBe('Test User');
  });

  it('getTelegramLanguageCode returns undefined outside Telegram', async () => {
    const { getTelegramLanguageCode } = await import('../src/utils/telegram');
    const lang = getTelegramLanguageCode();
    expect(lang).toBeUndefined();
  });

  it('showAlert falls back to browser alert', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { showAlert } = await import('../src/utils/telegram');
    showAlert('test message');
    expect(alertSpy).toHaveBeenCalledWith('test message');
    alertSpy.mockRestore();
  });

  it('showConfirm falls back to browser confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { showConfirm } = await import('../src/utils/telegram');
    const result = await showConfirm('Are you sure?');
    expect(result).toBe(true);
    expect(confirmSpy).toHaveBeenCalledWith('Are you sure?');
    confirmSpy.mockRestore();
  });

  it('showConfirm returns false when user cancels', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { showConfirm } = await import('../src/utils/telegram');
    const result = await showConfirm('Cancel this?');
    expect(result).toBe(false);
    confirmSpy.mockRestore();
  });

  it('hapticFeedback methods do not throw outside Telegram', async () => {
    const { hapticFeedback } = await import('../src/utils/telegram');
    // None of these should throw
    expect(() => hapticFeedback.light()).not.toThrow();
    expect(() => hapticFeedback.medium()).not.toThrow();
    expect(() => hapticFeedback.heavy()).not.toThrow();
    expect(() => hapticFeedback.success()).not.toThrow();
    expect(() => hapticFeedback.warning()).not.toThrow();
    expect(() => hapticFeedback.error()).not.toThrow();
  });
});

describe('Telegram utils — with Telegram environment', () => {
  const mockHaptic = {
    impactOccurred: vi.fn(),
    notificationOccurred: vi.fn(),
  };

  beforeEach(() => {
    (window as any).Telegram = {
      WebApp: {
        initData: 'query_id=test&user=%7B%22id%22%3A123%7D',
        initDataUnsafe: {
          user: {
            id: 123,
            first_name: 'Real User',
            username: 'realuser',
            language_code: 'zh',
          },
        },
        ready: vi.fn(),
        expand: vi.fn(),
        enableClosingConfirmation: vi.fn(),
        setHeaderColor: vi.fn(),
        close: vi.fn(),
        showAlert: vi.fn(),
        showConfirm: vi.fn((msg: string, cb: (ok: boolean) => void) => cb(true)),
        HapticFeedback: mockHaptic,
      },
    };
  });

  afterEach(() => {
    delete (window as any).Telegram;
    vi.resetModules();
  });

  it('initTelegramWebApp calls WebApp methods', async () => {
    // Must re-import after setting up window.Telegram
    const mod = await import('../src/utils/telegram');
    const app = mod.initTelegramWebApp();
    expect(app.ready).toHaveBeenCalled();
    expect(app.expand).toHaveBeenCalled();
    expect(app.enableClosingConfirmation).toHaveBeenCalled();
    expect(app.setHeaderColor).toHaveBeenCalledWith('#2481cc');
  });

  it('getTelegramUser returns real user in Telegram', async () => {
    const mod = await import('../src/utils/telegram');
    const user = mod.getTelegramUser();
    expect(user.id).toBe(123);
    expect(user.first_name).toBe('Real User');
  });

  it('getTelegramLanguageCode returns language code', async () => {
    const mod = await import('../src/utils/telegram');
    const lang = mod.getTelegramLanguageCode();
    expect(lang).toBe('zh');
  });

  it('showAlert uses WebApp.showAlert', async () => {
    const mod = await import('../src/utils/telegram');
    mod.showAlert('Telegram alert');
    expect(window.Telegram!.WebApp.showAlert).toHaveBeenCalledWith('Telegram alert');
  });

  it('showConfirm uses WebApp.showConfirm and resolves', async () => {
    const mod = await import('../src/utils/telegram');
    const result = await mod.showConfirm('Confirm?');
    expect(result).toBe(true);
    expect(window.Telegram!.WebApp.showConfirm).toHaveBeenCalled();
  });

  it('hapticFeedback calls WebApp methods', async () => {
    const mod = await import('../src/utils/telegram');
    mod.hapticFeedback.light();
    expect(mockHaptic.impactOccurred).toHaveBeenCalledWith('light');

    mod.hapticFeedback.success();
    expect(mockHaptic.notificationOccurred).toHaveBeenCalledWith('success');
  });
});
