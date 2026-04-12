import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import type { Group } from '../types';

interface GroupContextValue {
  groups: Group[];
  loading: boolean;
  fetchGroups: () => Promise<void>;
  getGroupById: (id: string) => Group | undefined;
}

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getGroups();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getGroupById = useCallback((id: string) => {
    return groups.find(g => g.id === id);
  }, [groups]);

  const value = useMemo<GroupContextValue>(() => ({
    groups,
    loading,
    fetchGroups,
    getGroupById,
  }), [groups, loading, fetchGroups, getGroupById]);

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroups(): GroupContextValue {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroups must be used within GroupProvider');
  return ctx;
}
