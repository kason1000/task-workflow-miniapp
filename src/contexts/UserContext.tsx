import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import type { Role } from '../types';

interface UserContextValue {
  userId: number | null;
  role: Role | null;
  loading: boolean;
  authenticated: boolean;
  setAuth: (userId: number, role: Role) => void;
  clearAuth: () => void;
  refreshRole: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<number | null>(() => {
    const stored = sessionStorage.getItem('user_id');
    return stored ? parseInt(stored) : null;
  });
  const [role, setRole] = useState<Role | null>(() => {
    const stored = sessionStorage.getItem('user_role');
    return stored as Role | null;
  });
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(!!sessionStorage.getItem('auth_token'));

  const setAuth = useCallback((newUserId: number, newRole: Role) => {
    setUserId(newUserId);
    setRole(newRole);
    setAuthenticated(true);
  }, []);

  const clearAuth = useCallback(() => {
    setUserId(null);
    setRole(null);
    setAuthenticated(false);
  }, []);

  const refreshRole = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getMyRole();
      setRole(data.role as Role);
      if (data.userId) setUserId(data.userId);
      setAuthenticated(true);
    } catch {
      // Keep existing role if refresh fails
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<UserContextValue>(() => ({
    userId,
    role,
    loading,
    authenticated,
    setAuth,
    clearAuth,
    refreshRole,
  }), [userId, role, loading, authenticated, setAuth, clearAuth, refreshRole]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
