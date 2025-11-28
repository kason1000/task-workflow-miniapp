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
    
    // Handle both {success: true, data: ...} and direct response
    if (data.success !== undefined) {
      if (!data.success) {
        throw new Error(data.error?.message || 'Request failed');
      }
      return data.data;
    }
    
    return data;
  }

  // Tasks
  async getTasks(status?: string, archived?: boolean) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (archived !== undefined) params.append('archived', archived.toString());
    
    const response = await this.request<any>(`/tasks?${params.toString()}`);
    // Handle both {tasks: [...]} and direct array
    return { tasks: response.tasks || response };
  }

  async getTask(taskId: string) {
    const response = await this.request<any>(`/tasks/${taskId}`);
    // Handle both {task: ...} and direct object
    return { task: response.task || response };
  }

  async transitionTask(taskId: string, status: string) {
    return this.request<any>(`/tasks/${taskId}/transition`, {
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
  async getMediaUrl(fileId: string): Promise<{ fileUrl: string }> {
    try {
      const response = await this.request<any>(`/media?fileId=${fileId}`);
      console.log('Media URL response:', response);
      
      // Handle different response formats
      if (response.url) {
        return { fileUrl: response.url };
      }
      if (response.fileUrl) {
        return { fileUrl: response.fileUrl };
      }
      
      throw new Error('Invalid media URL response');
    } catch (error) {
      console.error('Failed to get media URL for', fileId, error);
      // Fallback: return direct Telegram URL
      return { 
        fileUrl: `https://api.telegram.org/file/bot${config.telegramBotToken}/photos/${fileId}.jpg` 
      };
    }
  }

  async getProxiedMediaUrl(fileId: string): Promise<{ fileUrl: string }> {
    const proxyUrl = `${config.apiBaseUrl}/media/proxy/${fileId}`;
    console.log('Using proxied URL:', proxyUrl);
    return { fileUrl: proxyUrl };
  }
}

export const api = new ApiService();