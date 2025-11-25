import WebApp from '@twa-dev/sdk';
import { config } from '../config';

class ApiService {
  private getHeaders(): HeadersInit {
    // In development, use mock auth
    if (config.useMockAuth) {
      console.log('Using mock authentication');
      return {
        'Content-Type': 'application/json',
        'X-Test-Auth': `test:${config.mockUserId}:${config.mockRole}`,
      };
    }

    const initData = WebApp.initData;
    
    return {
      'Content-Type': 'application/json',
      'X-Telegram-InitData': initData,
    };
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${config.apiBaseUrl}${endpoint}`;
    
    console.log('API Request:', url);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    console.log('API Response:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        code: 'UNKNOWN_ERROR',
        message: response.statusText 
      }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // Tasks
  async getTasks(status?: string, archived?: boolean) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (archived !== undefined) params.append('archived', archived.toString());
    
    return this.request<{ tasks: any[]; count: number }>(
      `/tasks?${params.toString()}`
    );
  }

  async getTask(taskId: string) {
    return this.request<any>(`/tasks/${taskId}`);
  }

  async createTask(data: {
    title: string;
    labels: { video: boolean };
    requireSets: number;
    createdPhotoFileId: string;
  }) {
    return this.request<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addPhotoToSet(taskId: string, setIndex: number, fileId: string) {
    return this.request<any>(`/tasks/${taskId}/sets/${setIndex}/photos`, {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId }),
    });
  }

  async addVideoToSet(taskId: string, setIndex: number, fileId: string) {
    return this.request<any>(`/tasks/${taskId}/sets/${setIndex}/video`, {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId }),
    });
  }

  async transitionTask(taskId: string, toStatus: string) {
    return this.request<any>(`/tasks/${taskId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ to: toStatus }),
    });
  }

  async archiveTask(taskId: string) {
    return this.request<any>(`/tasks/${taskId}/archive`, {
      method: 'POST',
    });
  }

  async restoreTask(taskId: string) {
    return this.request<any>(`/tasks/${taskId}/restore`, {
      method: 'POST',
    });
  }

  async deleteTask(taskId: string) {
    return this.request<any>(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  async deleteUpload(taskId: string, fileId: string) {
    return this.request<any>(`/tasks/${taskId}/uploads/${fileId}`, {
      method: 'DELETE',
    });
  }

  // Roles
  async getMyRole() {
    return this.request<{ userId: number; role: string }>('/roles/me');
  }

  async getMySubmissions() {
    return this.request<{ userId: number; submissionCount: number }>(
      '/roles/me/submissions'
    );
  }

  async getAllRoles() {
    return this.request<{ roles: any[]; count: number }>('/roles');
  }

  async setUserRole(userId: number, role: string) {
    return this.request<any>(`/roles/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  }

  async getSubmissionAnalytics() {
    return this.request<any>('/roles/analytics/submissions');
  }

  async getMediaUrl(fileId: string) {
    return this.request<{ fileUrl: string; filePath: string }>(`/media?fileId=${fileId}`);
  }
}

export const api = new ApiService();