/**
 * Status transition helpers — determines which transitions are available
 * based on current status and user role.
 */

const TRANSITIONS: Record<string, Record<string, string[]>> = {
  'New': { 'Received': ['Member', 'Lead', 'Admin'] },
  'Received': {
    'New': ['Lead', 'Admin'],
    'Submitted': ['Member', 'Lead', 'Admin'],
  },
  'Submitted': {
    'Redo': ['Lead', 'Admin'],
    'Completed': ['Lead', 'Admin'],
    'Archived': ['Lead', 'Admin', 'Viewer'],
  },
  'Redo': {
    'Received': ['Member', 'Lead', 'Admin'],
    'Submitted': ['Member', 'Lead', 'Admin'],
  },
  'Completed': {
    'Submitted': ['Lead', 'Admin'],
    'Archived': ['Lead', 'Admin', 'Viewer'],
  },
};

export function canTransitionTo(fromStatus: string, role: string): string[] {
  if (role === 'Admin') {
    // Admin can do any defined transition
    const targets = TRANSITIONS[fromStatus];
    return targets ? Object.keys(targets) : [];
  }
  const targets = TRANSITIONS[fromStatus];
  if (!targets) return [];
  return Object.entries(targets)
    .filter(([, roles]) => roles.includes(role))
    .map(([status]) => status);
}

export const STATUS_LABELS: Record<string, string> = {
  New: 'New',
  Received: 'Received',
  Submitted: 'Submitted',
  Redo: 'Redo',
  Completed: 'Completed',
  Archived: 'Archived',
};

export const STATUS_SHORT: Record<string, string> = {
  New: 'NEW',
  Received: 'RCV',
  Submitted: 'SUB',
  Redo: 'RDO',
  Completed: 'CMP',
  Archived: 'ARC',
};
