/**
 * Centralized display data layer for tasks.
 * ALL computed display values live here — UI files are pure rendering.
 * No UI file should contain business logic, name resolution, or data computation.
 */
import { Task, TaskStatus, Group } from '../../types';
import { canTransitionTo } from './transitionHelpers';

// ============================================================
// Types — pre-computed display data for UI components
// ============================================================

export interface TaskCardDisplay {
  id: string;
  title: string;
  status: TaskStatus;
  statusBadgeClass: string;
  hasVideo: boolean;
  isArchived: boolean;

  // Group
  groupName?: string;
  groupColor?: string;

  // Progress
  completedSets: number;
  requireSets: number;
  progressPercent: number;
  progressLabel: string; // e.g. "2/3"

  // Names — always real names, never "User 123..."
  submitterName?: string;  // only set if doneBy exists AND has a real name
  createdByName?: string;  // real name of creator

  // Dates
  createdAt: string;
  lastModifiedAt?: string;
  submittedAt?: string;

  // Media
  thumbnailFileId?: string;
}

export interface TaskDetailDisplay {
  id: string;
  title: string;
  status: TaskStatus;
  statusBadgeClass: string;
  hasVideo: boolean;
  isArchived: boolean;

  // Group
  groupName?: string;
  groupColor?: string;
  groupIsDefault?: boolean;
  groupLeadCount?: number;
  groupMemberCount?: number;
  groupHasChat?: boolean;

  // Progress
  completedSets: number;
  requireSets: number;
  progressPercent: number;
  progressLabel: string;

  // Names — always real names, never "User 123..."
  createdByName?: string;
  submitterName?: string;
  uploaderNames: string[];  // list of unique uploader real names

  // Dates
  createdAt: string;
  submittedAt?: string;
  completedAt?: string;
  archivedAt?: string;

  // Lock
  isLocked: boolean;
  lockedToName?: string;

  // Media
  createdPhotoFileId?: string;
  totalMediaCount: number;

  // Sets info
  sets: Array<{
    photos: Array<{ fileId: string; uploaderName?: string }>;
    video?: { fileId: string; uploaderName?: string };
    isComplete: boolean;
  }>;

  // Permissions
  canDeleteMedia: boolean;

  // Transitions — which statuses can the current user transition to
  availableTransitions: string[];
}

// ============================================================
// Status badge CSS classes
// ============================================================

const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  New: 'badge-new',
  Received: 'badge-received',
  Submitted: 'badge-submitted',
  Redo: 'badge-redo',
  Completed: 'badge-completed',
  Archived: 'badge-archived',
};

// ============================================================
// Name resolution — NEVER returns "User 123..."
// ============================================================

function resolveName(
  userId: number | null | undefined,
  userNames: Record<number, string>,
  fallbackName?: string | null,
): string | undefined {
  if (!userId) return undefined;
  const fromApi = userNames[userId];
  if (fromApi && !fromApi.startsWith('User ')) return fromApi;
  if (fallbackName && !fallbackName.startsWith('User ')) return fallbackName;
  return undefined;
}

// ============================================================
// prepareTaskCard — compute all display values for a task card
// ============================================================

export function prepareTaskCard(
  task: Task,
  userNames: Record<number, string>,
  groups: Group[],
): TaskCardDisplay {
  const group = groups.find(g => g.id === task.groupId);
  const completedSets = task.sets?.filter(set => {
    const hasPhotos = (set.photos?.length || 0) >= 3;
    const hasVideo = task.labels?.video ? !!set.video : true;
    return hasPhotos && hasVideo;
  }).length || 0;
  const requireSets = task.requireSets || 1;
  const progressPercent = requireSets > 0 ? Math.round((completedSets / requireSets) * 100) : 0;

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    statusBadgeClass: STATUS_BADGE_CLASSES[task.status] || 'badge-new',
    hasVideo: !!task.labels?.video,
    isArchived: task.status === 'Archived',
    groupName: group?.name,
    groupColor: group?.color,
    completedSets,
    requireSets,
    progressPercent,
    progressLabel: `${completedSets}/${requireSets}`,
    submitterName: resolveName(task.doneBy, userNames, task.doneByName),
    createdByName: resolveName(task.createdBy, userNames),
    createdAt: task.createdAt,
    lastModifiedAt: task.lastModifiedAt,
    submittedAt: task.submittedAt,
    thumbnailFileId: task.createdPhoto?.file_id,
  };
}

// ============================================================
// prepareTaskDetail — compute all display values for task detail
// ============================================================

export function prepareTaskDetail(
  task: Task,
  userNames: Record<number, string>,
  taskGroup: Group | null,
  userRole: string,
): TaskDetailDisplay {
  const completedSets = task.sets?.filter(set => {
    const hasPhotos = (set.photos?.length || 0) >= 3;
    const hasVideo = task.labels?.video ? !!set.video : true;
    return hasPhotos && hasVideo;
  }).length || 0;
  const requireSets = task.requireSets || 1;
  const progressPercent = requireSets > 0 ? Math.round((completedSets / requireSets) * 100) : 0;

  // Collect unique uploader names (real names only)
  const uploaderIds = new Set<number>();
  task.sets?.forEach(set => {
    set.photos?.forEach(p => uploaderIds.add(p.by));
    if (set.video) uploaderIds.add(set.video.by);
  });
  const uploaderNames = Array.from(uploaderIds)
    .map(id => resolveName(id, userNames))
    .filter((n): n is string => !!n);

  // Total media count
  let totalMediaCount = 0;
  task.sets?.forEach(set => {
    totalMediaCount += set.photos?.length || 0;
    if (set.video) totalMediaCount++;
  });

  // Sets info
  const sets = (task.sets || []).map(set => ({
    photos: (set.photos || []).map(p => ({
      fileId: p.file_id,
      uploaderName: resolveName(p.by, userNames),
    })),
    video: set.video ? {
      fileId: set.video.file_id,
      uploaderName: resolveName(set.video.by, userNames),
    } : undefined,
    isComplete: (() => {
      const hasPhotos = (set.photos?.length || 0) >= 3;
      const hasVideo = task.labels?.video ? !!set.video : true;
      return hasPhotos && hasVideo;
    })(),
  }));

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    statusBadgeClass: STATUS_BADGE_CLASSES[task.status] || 'badge-new',
    hasVideo: !!task.labels?.video,
    isArchived: task.status === 'Archived',
    groupName: taskGroup?.name,
    groupColor: taskGroup?.color,
    groupIsDefault: taskGroup?.isDefault,
    groupLeadCount: taskGroup?.leadUserIds?.length,
    groupMemberCount: taskGroup?.members?.length,
    groupHasChat: !!taskGroup?.telegramChatId,
    completedSets,
    requireSets,
    progressPercent,
    progressLabel: `${completedSets}/${requireSets}`,
    createdByName: resolveName(task.createdBy, userNames),
    submitterName: resolveName(task.doneBy, userNames, task.doneByName),
    uploaderNames,
    createdAt: task.createdAt,
    submittedAt: task.submittedAt,
    completedAt: (task as any).completedAt,
    archivedAt: (task as any).archivedAt,
    isLocked: task.lockedTo !== undefined && task.lockedTo !== null,
    lockedToName: task.lockedTo ? resolveName(task.lockedTo, userNames) : undefined,
    createdPhotoFileId: task.createdPhoto?.file_id,
    totalMediaCount,
    sets,
    canDeleteMedia: userRole === 'Admin' || userRole === 'Lead' || userRole === 'Member',
    availableTransitions: canTransitionTo(task.status, userRole),
  };
}

// ============================================================
// Filter display helpers
// ============================================================

export function getStatusFilterOptions(userRole: string): Array<{ key: string; label: string }> {
  const allOption = { key: 'all', label: 'All' };

  if (userRole === 'Viewer') {
    return [allOption, { key: 'Completed', label: 'Completed' }];
  }

  const statuses: TaskStatus[] =
    userRole === 'Member'
      ? ['Redo', 'Received', 'New', 'Submitted', 'Completed']
      : ['Submitted', 'Redo', 'Received', 'New', 'Completed']; // Admin/Lead

  return [allOption, ...statuses.map(s => ({ key: s, label: s }))];
}

export function getMonthFilterOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

export function getSubmitterFilterOptions(
  submitterCounts: Record<string, number>,
  userNames: Record<number, string>,
): Array<{ userId: number; name: string; count: number }> {
  return Object.entries(submitterCounts)
    .map(([id, count]) => {
      const userId = parseInt(id);
      const name = resolveName(userId, userNames) || `#${userId}`;
      return { userId, name, count };
    })
    .sort((a, b) => b.count - a.count);
}

// Re-export for convenience
export { resolveName as resolveUserName };
