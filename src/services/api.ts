import WebApp from '@twa-dev/sdk';
import { config } from '../config';

class ApiService {
  private getHeaders(): HeadersInit {
    if (config.useMockAuth) {
      console.log('Using mock authentication');
      return {
        'Content-Type': 'application/json',
        'X-Test-Auth': `${config.mockUserId}:${config.mockRole}`,
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

    const data = await response.json();
    return data.success ? data.data : data;
  }

  // Tasks
  async getTasks(status?: string, archived?: boolean) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (archived !== undefined) params.append('archived', archived.toString());
    
    return this.request<{ tasks: any[] }>(`/tasks?${params.toString()}`);
  }

  async getTask(taskId: string) {
    return this.request<{ task: any }>(`/tasks/${taskId}`);
  }

  async transitionTask(taskId: string, status: string) {
    return this.request<{ task: any }>(`/tasks/${taskId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async deleteTask(taskId: string) {
    return this.request<void>(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  // Roles
  async getMyRole() {
    return this.request<{ userId: number; role: string }>('/roles/me');
  }

  async getAllRoles() {
    return this.request<{ roles: any[] }>('/roles');
  }

  async setRole(userId: number, role: string) {
    return this.request<any>('/roles', {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
  }

  // Media
  async getMediaUrl(fileId: string) {
    return this.request<{ url: string }>(`/media?fileId=${fileId}`);
  }

  async getProxiedMediaUrl(fileId: string) {
    const proxyUrl = `${config.apiBaseUrl}/media/proxy/${fileId}`;
    return { fileUrl: proxyUrl };
  }
}

export const api = new ApiService();