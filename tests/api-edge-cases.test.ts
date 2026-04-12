import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@twa-dev/sdk', () => ({
  default: {
    ready: vi.fn(),
    initData: '',
    initDataUnsafe: {},
  },
}));

vi.mock('../src/config', () => ({
  config: {
    apiBaseUrl: 'https://test-api.example.com',
    useMockAuth: false,
    mockUserId: 0,
    mockRole: 'Member',
  },
}));

import { api } from '../src/services/api';

describe('ApiService — edge cases', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    sessionStorage.clear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('request — network failures', () => {
    it('should propagate network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await expect(api.request('/tasks')).rejects.toThrow('Failed to fetch');
    });

    it('should handle timeout-like errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('AbortError'));
      await expect(api.request('/tasks')).rejects.toThrow('AbortError');
    });
  });

  describe('request — edge response formats', () => {
    it('should handle empty success response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: null }),
      });
      const result = await api.request('/tasks');
      expect(result).toBeNull();
    });

    it('should handle success:false without error.message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: {} }),
      });
      await expect(api.request('/tasks')).rejects.toThrow('Request failed');
    });

    it('should handle success:false without error object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false }),
      });
      await expect(api.request('/tasks')).rejects.toThrow('Request failed');
    });
  });

  describe('getTasks — query building edge cases', () => {
    it('should handle no params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { tasks: [] } }),
      });

      await api.getTasks();
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/tasks?');
    });

    it('should handle archived=false explicitly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { tasks: [] } }),
      });

      await api.getTasks(undefined, false);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('archived=false');
    });

    it('should handle page=0 correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { tasks: [] } }),
      });

      await api.getTasks(undefined, undefined, 0);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('page=0');
    });
  });

  describe('getTask', () => {
    it('should handle response with task wrapper', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { task: { id: 't1', title: 'Test' } } }),
      });

      const result = await api.getTask('t1');
      expect(result.task.id).toBe('t1');
    });

    it('should handle direct task response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 't2', title: 'Direct' }),
      });

      const result = await api.getTask('t2');
      // api.getTask accesses response.task || response
      expect(result.task).toBeDefined();
    });
  });

  describe('archiveTask / restoreTask', () => {
    it('archiveTask sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.archiveTask('t1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/tasks/t1/archive');
      expect(opts.method).toBe('POST');
    });

    it('restoreTask sends POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.restoreTask('t1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/tasks/t1/restore');
      expect(opts.method).toBe('POST');
    });
  });

  describe('deleteUpload', () => {
    it('should send DELETE with correct URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.deleteUpload('t1', 'file123');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/tasks/t1/uploads/file123');
      expect(opts.method).toBe('DELETE');
    });
  });

  describe('group operations — edge cases', () => {
    it('updateGroup sends PUT with correct body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { group: { id: 'g1' } } }),
      });

      await api.updateGroup('g1', { name: 'Updated', color: '#FF0000' });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/groups/g1');
      expect(opts.method).toBe('PUT');
      const body = JSON.parse(opts.body);
      expect(body.name).toBe('Updated');
      expect(body.color).toBe('#FF0000');
    });

    it('deleteGroup sends DELETE', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.deleteGroup('g1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/groups/g1');
      expect(opts.method).toBe('DELETE');
    });

    it('addGroupMember validates role in body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.addGroupMember('g1', 42, 'Lead');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.userId).toBe(42);
      expect(body.role).toBe('Lead');
    });

    it('removeGroupMember sends DELETE with userId in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.removeGroupMember('g1', 42);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/groups/g1/members/42');
      expect(opts.method).toBe('DELETE');
    });
  });

  describe('media operations', () => {
    it('getMediaUrl in Telegram mode gets direct URL', async () => {
      // No session token = Telegram mode
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { url: 'https://telegram.org/file.jpg' } }),
      });

      const result = await api.getMediaUrl('file123');
      expect(result.fileUrl).toBe('https://telegram.org/file.jpg');
    });

    it('getMediaUrl handles fileUrl response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { fileUrl: 'https://example.com/file.jpg' } }),
      });

      const result = await api.getMediaUrl('file123');
      expect(result.fileUrl).toBe('https://example.com/file.jpg');
    });

    it('getMediaUrl in browser mode fetches blob', async () => {
      sessionStorage.setItem('auth_token', 'token');

      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await api.getMediaUrl('file123');
      // Should create a blob URL
      expect(result.fileUrl).toMatch(/^blob:/);
    });

    it('getProxiedMediaUrl returns proxy URL', async () => {
      const result = await api.getProxiedMediaUrl('file123');
      expect(result.fileUrl).toBe('https://test-api.example.com/media/proxy/file123');
    });
  });

  describe('getUserNames', () => {
    it('returns empty for empty array', async () => {
      const result = await api.getUserNames([]);
      expect(result).toEqual({ userNames: {} });
    });

    it('sends comma-separated IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { userNames: { 1: 'Alice', 2: 'Bob' } },
        }),
      });

      await api.getUserNames([1, 2]);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('userIds=1,2');
    });
  });

  describe('auth header priority', () => {
    it('session token takes priority over Telegram initData', async () => {
      sessionStorage.setItem('auth_token', 'my-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'ok' }),
      });

      await api.request('/test');
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer my-token');
      // Should NOT have X-Telegram-InitData
      expect(headers['X-Telegram-InitData']).toBeUndefined();
    });
  });

  describe('roles API', () => {
    it('getMyRole calls /roles/me', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { userId: 1, role: 'Admin' } }),
      });

      const result = await api.getMyRole();
      expect(result.role).toBe('Admin');
      expect(mockFetch.mock.calls[0][0]).toContain('/roles/me');
    });

    it('setRole sends POST with userId and role', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.setRole(42, 'Lead');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.userId).toBe(42);
      expect(body.role).toBe('Lead');
    });
  });
});
