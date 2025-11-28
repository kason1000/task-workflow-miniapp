// Detect if we're in development mode
const isDevelopment = (() => {
  try {
    return import.meta.env.DEV;
  } catch {
    return false;
  }
})();

// Detect if running in Telegram
const isInTelegram = () => {
  return typeof window !== 'undefined' && window.Telegram?.WebApp?.initData;
};

export const config = {
  // Use local backend in development, production backend in production/Telegram
  apiBaseUrl: isDevelopment
    ? 'http://localhost:8787'
    : 'https://task-workflow-backend.kason1000.workers.dev',
  
  // Enable mock auth only in local development and not in Telegram
  useMockAuth: isDevelopment && !isInTelegram(),
  
  // Your user ID for mock auth
  mockUserId: 8432601826,
  mockRole: 'Admin' as const,
  
  // Telegram bot token (only used for fallback in development, optional)
  // In production, all media URLs come from the backend API
  telegramBotToken: '',
};