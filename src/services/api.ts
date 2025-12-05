import WebApp from '@twa-dev/sdk';
import { config } from '../config';
import { Group, Task } from '../types';

class ApiService {
  private getHeaders(): HeadersInit {
    // Check for session token (browser)
    const sessionToken = sessionStorage.getItem('auth_token');
    if (sessionToken) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      };
    }

    // Mock auth (development)
    if (config.useMockAuth) {
      console.log('Using mock authentication');
      return {
        'Content-Type': 'application/json',
        'X-Test-Auth': `${config.mockUserId}:${config.mockRole}`,
      };
    }

    // Telegram auth
    const initData = WebApp.initData;
    
    return {
      'Content-Type': 'application/json',
      'X-Telegram-InitData': initData,
    };
  }

  // Add logout method
  async logout() {
    const sessionToken = sessionStorage.getItem('auth_token');
    
    if (sessionToken) {
      try {
        await this.request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ sessionToken })
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_role');
    sessionStorage.removeItem('user_id');
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
    return { tasks: response.tasks || response };
  }

  async getTask(taskId: string) {
    const response = await this.request<any>(`/tasks/${taskId}`);
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

  async deleteUpload(taskId: string, fileId: string) {
    return this.request<any>(`/tasks/${taskId}/uploads/${fileId}`, {
      method: 'DELETE',
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

  async sendTaskToChat(taskId: string) {
    return this.request<any>(`/tasks/${taskId}/send-to-chat`, {
      method: 'POST',
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

  // Groups
  async getGroups() {
    return this.request<{ groups: Group[] }>('/groups');
  }

  async getGroup(groupId: string) {
    return this.request<{ group: Group }>(`/groups/${groupId}`);
  }

  async getMyLedGroups() {
    return this.request<{ groups: Group[] }>('/groups/my-led');
  }

  async createGroup(name: string, leadUserIds?: number[], telegramChatId?: number) {
    return this.request<{ group: Group }>('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, leadUserIds, telegramChatId }),
    });
  }

  async updateGroup(groupId: string, updates: Partial<Group>) {
    return this.request<{ group: Group }>(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteGroup(groupId: string) {
    return this.request<{ success: boolean }>(`/groups/${groupId}`, {
      method: 'DELETE',
    });
  }

  async addGroupMember(groupId: string, userId: number, role: 'Lead' | 'Member' | 'Viewer') {
    return this.request<{ success: boolean }>(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
  }

  async removeGroupMember(groupId: string, userId: number) {
    return this.request<{ success: boolean }>(`/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  async addGroupLead(groupId: string, userId: number) {
    return this.request<{ success: boolean }>(`/groups/${groupId}/leads`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async removeGroupLead(groupId: string, userId: number) {
    return this.request<{ success: boolean }>(`/groups/${groupId}/leads/${userId}`, {
      method: 'DELETE',
    });
  }

  async linkTelegramChat(groupId: string, chatId: number) {
    return this.request<{ success: boolean }>(`/groups/${groupId}/link-chat`, {
      method: 'POST',
      body: JSON.stringify({ chatId }),
    });
  }

  async getGroupTasks(groupId: string) {
    return this.request<{ tasks: Task[] }>(`/groups/${groupId}/tasks`);
  }

  // Media
  async getMediaUrl(fileId: string): Promise<{ fileUrl: string }> {
    try {
      // Check if in browser mode (has session token)
      const sessionToken = sessionStorage.getItem('auth_token');
      const isInBrowser = !!sessionToken;
      
      if (isInBrowser) {
        // In browser mode, ALWAYS use proxy and fetch as blob
        console.log('Browser mode: Fetching media as blob for', fileId);
        return await this.getProxiedMediaAsBlob(fileId);
      }
      
      // In Telegram mode, get direct URL
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
      throw error;
    }
  }
  // NEW: Fetch media as blob and create object URL
  async getProxiedMediaAsBlob(fileId: string): Promise<{ fileUrl: string }> {
    const proxyUrl = `${config.apiBaseUrl}/media/proxy/${fileId}`;
    
    const response = await fetch(proxyUrl, {
      headers: this.getHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.status}`);
    }
    
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    
    console.log('Created object URL for', fileId);
    
    return { fileUrl: objectUrl };
  }

  async getProxiedMediaUrl(fileId: string): Promise<{ fileUrl: string }> {
    const proxyUrl = `${config.apiBaseUrl}/media/proxy/${fileId}`;
    console.log('Using proxied URL:', proxyUrl);
    return { fileUrl: proxyUrl };
  }
  
  async getUserNames(userIds: number[]) {
    if (userIds.length === 0) return { userNames: {} };
    
    const idsParam = userIds.join(',');
    return this.request<{ userNames: Record<number, string> }>(`/tasks/user-names?userIds=${idsParam}`);
  }
}

export const api = new ApiService();