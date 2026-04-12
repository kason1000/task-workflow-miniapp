import { describe, it, expect } from 'vitest';
import type { Role, TaskStatus, Task, Group, GroupMember } from '../src/types/index';

// Type-level tests to verify our types are correct and can be used as expected

describe('Type definitions', () => {
  describe('Role type', () => {
    it('should accept valid roles', () => {
      const roles: Role[] = ['Admin', 'Lead', 'Member', 'Viewer'];
      expect(roles).toHaveLength(4);
    });
  });

  describe('TaskStatus type', () => {
    it('should accept valid statuses', () => {
      const statuses: TaskStatus[] = ['New', 'Received', 'Submitted', 'Redo', 'Completed', 'Archived'];
      expect(statuses).toHaveLength(6);
    });
  });

  describe('Task interface', () => {
    it('should accept a well-formed task object', () => {
      const task: Task = {
        id: 'task_1',
        title: 'Test Task',
        status: 'New',
        labels: { video: false },
        requireSets: 1,
        completedSets: 0,
        sets: [{ photos: [], video: undefined }],
        groupId: 'group_1',
        createdPhoto: { file_id: 'f1', by: 1 },
        createdBy: 1,
        doneBy: null,
        createdAt: '2025-01-01T00:00:00Z',
        version: 1,
      };

      expect(task.id).toBe('task_1');
      expect(task.status).toBe('New');
      expect(task.doneBy).toBeNull();
    });

    it('should support optional fields', () => {
      const task: Task = {
        id: 'task_2',
        title: 'Full Task',
        status: 'Submitted',
        labels: { video: true },
        requireSets: 2,
        completedSets: 1,
        sets: [],
        groupId: 'group_1',
        createdPhoto: { file_id: 'f1', by: 1 },
        createdBy: 1,
        doneBy: 42,
        doneByName: 'Test User',
        createdAt: '2025-01-01T00:00:00Z',
        version: 3,
        lastModifiedBy: 42,
        lastModifiedAt: '2025-01-02T00:00:00Z',
        submittedAt: '2025-01-02T00:00:00Z',
        lockedTo: 42,
        lockedAt: '2025-01-01T12:00:00Z',
        lockedByRole: 'Member',
      };

      expect(task.doneBy).toBe(42);
      expect(task.lockedTo).toBe(42);
      expect(task.submittedAt).toBeDefined();
    });
  });

  describe('Group interface', () => {
    it('should accept a well-formed group', () => {
      const group: Group = {
        id: 'group_1',
        name: 'Test Group',
        leadUserIds: [1, 2],
        members: [
          { userId: 1, role: 'Lead', joinedAt: '2025-01-01T00:00:00Z', invitedBy: 1 },
          { userId: 3, role: 'Member', joinedAt: '2025-01-01T00:00:00Z', invitedBy: 1 },
        ],
        createdBy: 1,
        createdAt: '2025-01-01T00:00:00Z',
      };

      expect(group.members).toHaveLength(2);
      expect(group.leadUserIds).toContain(1);
    });

    it('should support optional fields', () => {
      const group: Group = {
        id: 'group_2',
        name: 'Colored Group',
        leadUserIds: [],
        members: [],
        createdBy: 1,
        createdAt: '2025-01-01T00:00:00Z',
        isDefault: true,
        color: '#3B82F6',
        telegramChatId: -123456,
      };

      expect(group.color).toBe('#3B82F6');
      expect(group.isDefault).toBe(true);
    });
  });

  describe('GroupMember interface', () => {
    it('should accept valid member roles', () => {
      const members: GroupMember[] = [
        { userId: 1, role: 'Lead', joinedAt: '2025-01-01', invitedBy: 0 },
        { userId: 2, role: 'Member', joinedAt: '2025-01-01', invitedBy: 1 },
        { userId: 3, role: 'Viewer', joinedAt: '2025-01-01', invitedBy: 1 },
      ];

      expect(members).toHaveLength(3);
      expect(members.map(m => m.role)).toEqual(['Lead', 'Member', 'Viewer']);
    });
  });
});
