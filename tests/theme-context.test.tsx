import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import React from 'react';

function ThemeTestConsumer() {
  const { theme, setTheme, themes } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="count">{themes.length}</span>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>Dark</button>
      <button data-testid="set-ocean" onClick={() => setTheme('ocean')}>Ocean</button>
      <button data-testid="set-classic" onClick={() => setTheme('classic')}>Classic</button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to classic theme', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('classic');
  });

  it('has 12 themes available', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('count').textContent).toBe('12');
  });

  it('switches to dark theme', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    act(() => { screen.getByTestId('set-dark').click(); });
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('switches to ocean theme', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    act(() => { screen.getByTestId('set-ocean').click(); });
    expect(screen.getByTestId('theme').textContent).toBe('ocean');
    expect(document.documentElement.getAttribute('data-theme')).toBe('ocean');
  });

  it('persists theme to localStorage', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    act(() => { screen.getByTestId('set-dark').click(); });
    expect(localStorage.getItem('taskflow_theme')).toBe('dark');
  });

  it('reads theme from localStorage on mount', () => {
    localStorage.setItem('taskflow_theme', 'ocean');
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('ocean');
  });

  it('falls back to classic for invalid stored theme', () => {
    localStorage.setItem('taskflow_theme', 'invalid');
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('classic');
  });

  it('switches back to classic', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    act(() => { screen.getByTestId('set-dark').click(); });
    act(() => { screen.getByTestId('set-classic').click(); });
    expect(screen.getByTestId('theme').textContent).toBe('classic');
    expect(document.documentElement.getAttribute('data-theme')).toBe('classic');
  });

  it('throws when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ThemeTestConsumer />)).toThrow('useTheme must be used within ThemeProvider');
    spy.mockRestore();
  });
});
