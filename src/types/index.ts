export type Role = 'Admin' | 'Lead' | 'Member' | 'Viewer';

export type TaskStatus = 'New' | 'Received' | 'Submitted' | 'Redo' | 'Completed' | 'Archived';

export interface Upload {
  file_id: string;
  kind: 'image' | 'video';
  by: number;
}

export interface TaskSet {
  photos: Array<{ file_id: string; by: number }>;
  video?: { file_id: string; by: number };
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  labels: { video: boolean };
  requireSets: number;
  sets: TaskSet[];
  createdPhoto: { file_id: string; locked: true; by: number };
  uploads: Upload[];
  createdBy: number;
  doneBy: number | null;
  createdAt: string;
  archived: boolean;
  version: number;
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
