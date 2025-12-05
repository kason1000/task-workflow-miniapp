// Check if running in Telegram
const isTelegram = () => {
  return typeof window !== 'undefined' && 
         window.Telegram?.WebApp?.initData &&
         window.Telegram?.WebApp?.initData.length > 0;
};

// Mock WebApp for development
const createMockWebApp = () => ({
  ready: () => {},
  expand: () => {},
  enableClosingConfirmation: () => {},
  setHeaderColor: () => {},
  close: () => {},
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
  
  // Check if method is supported
  try {
    window.Telegram!.WebApp.showAlert(message);
  } catch (error) {
    console.warn('showAlert not supported, using fallback');
    alert(message);
  }
};

// ✅ FIX: Update showConfirm to handle browser mode properly
export const showConfirm = (message: string): Promise<boolean> => {
  if (!isTelegram()) {
    return Promise.resolve(confirm(message));
  }
  
  return new Promise((resolve) => {
    try {
      // Check if showConfirm is supported
      if (typeof window.Telegram!.WebApp.showConfirm === 'function') {
        window.Telegram!.WebApp.showConfirm(message, resolve);
      } else {
        // Fallback to browser confirm
        console.warn('showConfirm not supported, using browser confirm');
        resolve(confirm(message));
      }
    } catch (error) {
      console.warn('showConfirm error, using browser confirm:', error);
      resolve(confirm(message));
    }
  });
};

export const hapticFeedback = {
  light: () => {
    if (isTelegram()) {
      try {
        window.Telegram!.WebApp.HapticFeedback.impactOccurred('light');
      } catch (e) {
        // Silently fail if not supported
      }
    }
  },
  medium: () => {
    if (isTelegram()) {
      try {
        window.Telegram!.WebApp.HapticFeedback.impactOccurred('medium');
      } catch (e) {
        // Silently fail
      }
    }
  },
  heavy: () => {
    if (isTelegram()) {
      try {
        window.Telegram!.WebApp.HapticFeedback.impactOccurred('heavy');
      } catch (e) {
        // Silently fail
      }
    }
  },
  success: () => {
    if (isTelegram()) {
      try {
        window.Telegram!.WebApp.HapticFeedback.notificationOccurred('success');
      } catch (e) {
        // Silently fail
      }
    }
  },
  warning: () => {
    if (isTelegram()) {
      try {
        window.Telegram!.WebApp.HapticFeedback.notificationOccurred('warning');
      } catch (e) {
        // Silently fail
      }
    }
  },
  error: () => {
    if (isTelegram()) {
      try {
        window.Telegram!.WebApp.HapticFeedback.notificationOccurred('error');
      } catch (e) {
        // Silently fail
      }
    }
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