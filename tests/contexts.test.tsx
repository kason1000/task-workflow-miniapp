import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { UserProvider, useUser } from '../src/contexts/UserContext';
import { GroupProvider, useGroups } from '../src/contexts/GroupContext';
import React from 'react';

// Mock the api module
vi.mock('../src/services/api', () => ({
  api: {
    getMyRole: vi.fn().mockResolvedValue({ userId: 1, role: 'Admin' }),
    getGroups: vi.fn().mockResolvedValue({ groups: [
      { id: 'g1', name: 'Group 1', leadUserIds: [], members: [], createdBy: 1, createdAt: '2025-01-01' },
      { id: 'g2', name: 'Group 2', leadUserIds: [], members: [], createdBy: 1, createdAt: '2025-01-01' },
    ]}),
  },
}));

// ============================================================
// UserContext
// ============================================================
function UserTestConsumer() {
  const { userId, role, authenticated, setAuth, clearAuth } = useUser();
  return (
    <div>
      <span data-testid="userId">{userId ?? 'null'}</span>
      <span data-testid="role">{role ?? 'null'}</span>
      <span data-testid="auth">{authenticated ? 'yes' : 'no'}</span>
      <button data-testid="setAuth" onClick={() => setAuth(42, 'Lead')}>Set</button>
      <button data-testid="clearAuth" onClick={() => clearAuth()}>Clear</button>
    </div>
  );
}

describe('UserContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should default to null values when no session', () => {
    render(
      <UserProvider><UserTestConsumer /></UserProvider>
    );
    expect(screen.getByTestId('userId').textContent).toBe('null');
    expect(screen.getByTestId('role').textContent).toBe('null');
    expect(screen.getByTestId('auth').textContent).toBe('no');
  });

  it('should read initial values from sessionStorage', () => {
    sessionStorage.setItem('user_id', '7');
    sessionStorage.setItem('user_role', 'Member');
    sessionStorage.setItem('auth_token', 'tok');

    render(
      <UserProvider><UserTestConsumer /></UserProvider>
    );
    expect(screen.getByTestId('userId').textContent).toBe('7');
    expect(screen.getByTestId('role').textContent).toBe('Member');
    expect(screen.getByTestId('auth').textContent).toBe('yes');
  });

  it('setAuth updates state', () => {
    render(
      <UserProvider><UserTestConsumer /></UserProvider>
    );

    act(() => {
      screen.getByTestId('setAuth').click();
    });

    expect(screen.getByTestId('userId').textContent).toBe('42');
    expect(screen.getByTestId('role').textContent).toBe('Lead');
    expect(screen.getByTestId('auth').textContent).toBe('yes');
  });

  it('clearAuth resets state', () => {
    sessionStorage.setItem('user_id', '7');
    sessionStorage.setItem('user_role', 'Admin');
    sessionStorage.setItem('auth_token', 'tok');

    render(
      <UserProvider><UserTestConsumer /></UserProvider>
    );

    act(() => {
      screen.getByTestId('clearAuth').click();
    });

    expect(screen.getByTestId('userId').textContent).toBe('null');
    expect(screen.getByTestId('auth').textContent).toBe('no');
  });

  it('throws when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<UserTestConsumer />)).toThrow('useUser must be used within UserProvider');
    spy.mockRestore();
  });
});

// ============================================================
// GroupContext
// ============================================================
function GroupTestConsumer() {
  const { groups, loading, fetchGroups, getGroupById } = useGroups();
  return (
    <div>
      <span data-testid="count">{groups.length}</span>
      <span data-testid="loading">{loading ? 'yes' : 'no'}</span>
      <span data-testid="found">{getGroupById('g1')?.name ?? 'none'}</span>
      <button data-testid="fetch" onClick={() => fetchGroups()}>Fetch</button>
    </div>
  );
}

describe('GroupContext', () => {
  it('should start with empty groups', () => {
    render(
      <GroupProvider><GroupTestConsumer /></GroupProvider>
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('should fetch and populate groups', async () => {
    render(
      <GroupProvider><GroupTestConsumer /></GroupProvider>
    );

    await act(async () => {
      screen.getByTestId('fetch').click();
    });

    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('getGroupById returns correct group after fetch', async () => {
    render(
      <GroupProvider><GroupTestConsumer /></GroupProvider>
    );

    await act(async () => {
      screen.getByTestId('fetch').click();
    });

    expect(screen.getByTestId('found').textContent).toBe('Group 1');
  });

  it('throws when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<GroupTestConsumer />)).toThrow('useGroups must be used within GroupProvider');
    spy.mockRestore();
  });
});
