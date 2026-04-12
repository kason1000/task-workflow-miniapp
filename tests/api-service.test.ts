import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @twa-dev/sdk before importing the api module
vi.mock('@twa-dev/sdk', () => ({
  default: {
    ready: vi.fn(),
    initData: '',
    initDataUnsafe: {},
  },
}));

// Mock the config
vi.mock('../src/config', () => ({
  config: {
    apiBaseUrl: 'https://test-api.example.com',
    useMockAuth: false,
    mockUserId: 0,
    mockRole: 'Member',
  },
}));

// Import after mocks
import { api } from '../src/services/api';

describe('ApiService', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    // Clear sessionStorage
    sessionStorage.clear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('request — response handling', () => {
    it('should handle { success: true, data: ... } response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { task: { id: '1' } } }),
      });

      const result = await api.request<any>('/tasks/1');
      expect(result).toEqual({ task: { id: '1' } });
    });

    it('should handle direct response format (no success wrapper)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1', title: 'Test' }),
      });

      const result = await api.request<any>('/tasks/1');
      expect(result).toEqual({ id: '1', title: 'Test' });
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ code: 'NOT_FOUND', message: 'Task not found' }),
      });

      await expect(api.request('/tasks/nonexistent')).rejects.toThrow('Task not found');
    });

    it('should throw on { success: false } response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: { message: 'Validation failed' } }),
      });

      await expect(api.request('/tasks')).rejects.toThrow('Validation failed');
    });

    it('should throw generic error when JSON parse fails on error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('invalid json')),
      });

      await expect(api.request('/tasks')).rejects.toThrow('Internal Server Error');
    });
  });

  describe('request — auth headers', () => {
    it('should use session token when available', async () => {
      sessionStorage.setItem('auth_token', 'my-session-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tasks: [] }),
      });

      await api.request('/tasks');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer my-session-token');
    });

    it('should include Content-Type header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tasks: [] }),
      });

      await api.request('/tasks');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('getTasks', () => {
    it('should build URL with query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { tasks: [], pagination: { totalCount: 0 } },
        }),
      });

      await api.getTasks('Received', false, 0, 50);

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/tasks?');
      expect(url).toContain('status=Received');
      expect(url).toContain('page=0');
      expect(url).toContain('pageSize=50');
    });

    it('should include submittedMonth and doneBy params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { tasks: [], pagination: { totalCount: 0 } },
        }),
      });

      await api.getTasks(undefined, true, 0, 50, 'submittedAt', 'desc', '2025-06', 42);

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('archived=true');
      expect(url).toContain('submittedMonth=2025-06');
      expect(url).toContain('doneBy=42');
    });
  });

  describe('transitionTask', () => {
    it('should POST with status in body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { task: { id: '1', status: 'Received' } } }),
      });

      await api.transitionTask('task_1', 'Received');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/tasks/task_1/transition');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ status: 'Received' });
    });
  });

  describe('deleteTask', () => {
    it('should send DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.deleteTask('task_1');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/tasks/task_1');
      expect(options.method).toBe('DELETE');
    });
  });

  describe('groups API', () => {
    it('getGroups should call /groups', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { groups: [] } }),
      });

      await api.getGroups();

      expect(mockFetch.mock.calls[0][0]).toContain('/groups');
    });

    it('createGroup should POST with name and color', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { group: { id: 'g1', name: 'Test' } },
        }),
      });

      await api.createGroup('Test', [1], undefined, '#ff0000');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.name).toBe('Test');
      expect(body.color).toBe('#ff0000');
    });
  });

  describe('logout', () => {
    it('should clear session storage on logout', async () => {
      sessionStorage.setItem('auth_token', 'token');
      sessionStorage.setItem('user_role', 'Admin');
      sessionStorage.setItem('user_id', '1');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.logout();

      expect(sessionStorage.getItem('auth_token')).toBeNull();
      expect(sessionStorage.getItem('user_role')).toBeNull();
      expect(sessionStorage.getItem('user_id')).toBeNull();
    });

    it('should clear session even if API call fails', async () => {
      sessionStorage.setItem('auth_token', 'token');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await api.logout();

      expect(sessionStorage.getItem('auth_token')).toBeNull();
    });
  });
});
