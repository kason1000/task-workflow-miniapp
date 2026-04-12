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
      <button data-testid="set-noir" onClick={() => setTheme('noir')}>Noir</button>
      <button data-testid="set-aurora" onClick={() => setTheme('aurora')}>Aurora</button>
      <button data-testid="set-classic" onClick={() => setTheme('classic')}>Classic</button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to classic theme', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('classic');
  });

  it('has 10 themes available', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('count').textContent).toBe('10');
  });

  it('switches to noir theme', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    act(() => { screen.getByTestId('set-noir').click(); });
    expect(screen.getByTestId('theme').textContent).toBe('noir');
    expect(document.documentElement.getAttribute('data-theme')).toBe('noir');
  });

  it('switches to aurora theme', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    act(() => { screen.getByTestId('set-aurora').click(); });
    expect(screen.getByTestId('theme').textContent).toBe('aurora');
    expect(document.documentElement.getAttribute('data-theme')).toBe('aurora');
  });

  it('persists theme to sessionStorage', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    act(() => { screen.getByTestId('set-noir').click(); });
    expect(sessionStorage.getItem('app_theme')).toBe('noir');
  });

  it('reads theme from sessionStorage on mount', () => {
    sessionStorage.setItem('app_theme', 'aurora');
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('aurora');
  });

  it('falls back to classic for invalid stored theme', () => {
    sessionStorage.setItem('app_theme', 'invalid');
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('classic');
  });

  it('switches back to classic', () => {
    render(<ThemeProvider><ThemeTestConsumer /></ThemeProvider>);
    act(() => { screen.getByTestId('set-noir').click(); });
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
