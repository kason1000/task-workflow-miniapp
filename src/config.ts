import type { Role } from './types';

const isDevelopment = import.meta.env.DEV;

const isInTelegram = () => {
  return typeof window !== 'undefined' && window.Telegram?.WebApp?.initData;
};

const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const envMockUserId = Number(import.meta.env.VITE_MOCK_USER_ID);
const envMockRole = import.meta.env.VITE_MOCK_ROLE as Role | undefined;
const validMockRoles: Role[] = ['Admin', 'Lead', 'Member', 'Viewer'];

export const config = {
  apiBaseUrl: envApiBaseUrl || (isDevelopment
    ? 'http://localhost:8787'
    : 'https://task-workflow-backend.kason1000.workers.dev'),

  useMockAuth: isDevelopment && !isInTelegram(),
  mockUserId: Number.isFinite(envMockUserId) ? envMockUserId : 1,
  mockRole: envMockRole && validMockRoles.includes(envMockRole) ? envMockRole : 'Admin',
};
