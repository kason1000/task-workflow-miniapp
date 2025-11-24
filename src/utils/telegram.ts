// Check if running in Telegram
const isTelegram = () => {
  return typeof window !== 'undefined' && window.Telegram?.WebApp;
};

// Mock WebApp for development
const createMockWebApp = () => ({
  ready: () => {},
  expand: () => {},
  enableClosingConfirmation: () => {},
  setHeaderColor: () => {},
  initData: '',
  initDataUnsafe: {
    user: {
      id: 8432601826,
      first_name: 'Test User',
      username: 'testuser',
    },
  },
  HapticFeedback: {
    impactOccurred: () => {},
    notificationOccurred: () => {},
  },
  showAlert: (msg: string) => alert(msg),
  showConfirm: (msg: string, callback: (confirmed: boolean) => void) => {
    callback(confirm(msg));
  },
});

export const initTelegramWebApp = () => {
  if (!isTelegram()) {
    console.warn('Not running in Telegram, using mock WebApp');
    return createMockWebApp();
  }

  const WebApp = window.Telegram!.WebApp;
  WebApp.ready();
  WebApp.expand();
  WebApp.enableClosingConfirmation();
  WebApp.setHeaderColor('#2481cc');
  
  return WebApp;
};

export const getTelegramUser = () => {
  if (!isTelegram()) {
    return {
      id: 8432601826,
      first_name: 'Test User',
      username: 'testuser',
    };
  }
  return window.Telegram!.WebApp.initDataUnsafe.user;
};

export const showAlert = (message: string) => {
  if (!isTelegram()) {
    alert(message);
    return;
  }
  window.Telegram!.WebApp.showAlert(message);
};

export const showConfirm = (message: string): Promise<boolean> => {
  if (!isTelegram()) {
    return Promise.resolve(confirm(message));
  }
  
  return new Promise((resolve) => {
    window.Telegram!.WebApp.showConfirm(message, resolve);
  });
};

export const hapticFeedback = {
  light: () => {
    if (isTelegram()) window.Telegram!.WebApp.HapticFeedback.impactOccurred('light');
  },
  medium: () => {
    if (isTelegram()) window.Telegram!.WebApp.HapticFeedback.impactOccurred('medium');
  },
  heavy: () => {
    if (isTelegram()) window.Telegram!.WebApp.HapticFeedback.impactOccurred('heavy');
  },
  success: () => {
    if (isTelegram()) window.Telegram!.WebApp.HapticFeedback.notificationOccurred('success');
  },
  warning: () => {
    if (isTelegram()) window.Telegram!.WebApp.HapticFeedback.notificationOccurred('warning');
  },
  error: () => {
    if (isTelegram()) window.Telegram!.WebApp.HapticFeedback.notificationOccurred('error');
  },
};

// TypeScript declarations
declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}