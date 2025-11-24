export const config = {
  // Use local backend in development, production backend in production/Telegram
  apiBaseUrl: import.meta.env.DEV 
    ? 'http://localhost:8787'
    : 'https://task-workflow-backend.kason1000.workers.dev',
  
  // Enable mock auth only in local development
  useMockAuth: import.meta.env.DEV && typeof window.Telegram?.WebApp === 'undefined',
  
  // Your user ID for mock auth
  mockUserId: 8432601826,
  mockRole: 'Admin' as const,
};