export type Role = 'Admin' | 'Lead' | 'Member' | 'Viewer';
export type TaskStatus = 'New' | 'Received' | 'Submitted' | 'Redo' | 'Completed' | 'Archived';

export interface TaskSet {
  photos: Array<{ 
    file_id: string; 
    by: number;
    uploadedAt?: string;
  }>;
  video?: { 
    file_id: string; 
    by: number;
    uploadedAt?: string;
  };
}

export interface Group {
  id: string;
  name: string;
  leadUserIds: number[];
  members: GroupMember[];
  telegramChatId?: number;
  createdBy: number;
  createdAt: string;
  isDefault?: boolean;
}

export interface GroupMember {
  userId: number;
  role: 'Lead' | 'Member' | 'Viewer';
  joinedAt: string;
  invitedBy: number;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  labels: { video: boolean };
  requireSets: number;
  completedSets: number;
  sets: TaskSet[];
  groupId: string;  // NEW
  createdInGroupChat?: boolean;  // NEW
  
  // Created photo is the TASK PHOTO (locked, cannot be deleted)
  createdPhoto: { 
    file_id: string; 
    by: number;
  };
  
  createdBy: number;
  doneBy: number | null;
  doneByName?: string;
  createdAt: string;
  version: number;
  
  // Optional fields
  lastModifiedBy?: number;
  lastModifiedAt?: string;
  telegramChatId?: number;
  telegramMessageId?: number;
  telegramCards?: Record<string, {
    chatId: number;
    messageId: number;
    createdAt: string;
    type: string;
  }>;
  lockedTo?: number;
  lockedAt?: string;
  lockedByRole?: string;
}

export interface User {
  userId: number;
  role: Role;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}