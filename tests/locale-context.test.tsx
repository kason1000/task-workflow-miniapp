import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LocaleProvider, useLocale } from '../src/i18n/LocaleContext';
import React from 'react';

// Test component that uses the locale context
function TestConsumer() {
  const { locale, setLocale, t, formatDate } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="translated">{t('common.loading')}</span>
      <span data-testid="formatted">{formatDate('2025-06-15T10:30:00Z', { year: 'numeric' })}</span>
      <button data-testid="switch-zh" onClick={() => setLocale('zh')}>ZH</button>
      <button data-testid="switch-en" onClick={() => setLocale('en')}>EN</button>
    </div>
  );
}

describe('LocaleContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should default to "en" locale', () => {
    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('should translate strings using the current locale', () => {
    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );
    expect(screen.getByTestId('translated').textContent).toBe('Loading...');
  });

  it('should format dates using the current locale', () => {
    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );
    expect(screen.getByTestId('formatted').textContent).toContain('2025');
  });

  it('should switch locale when setLocale is called', () => {
    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    act(() => {
      screen.getByTestId('switch-zh').click();
    });

    expect(screen.getByTestId('locale').textContent).toBe('zh');
    expect(screen.getByTestId('translated').textContent).toBe('加载中…');
  });

  it('should persist locale to sessionStorage', () => {
    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    act(() => {
      screen.getByTestId('switch-zh').click();
    });

    expect(sessionStorage.getItem('user_locale')).toBe('zh');
  });

  it('should read locale from sessionStorage on mount', () => {
    sessionStorage.setItem('user_locale', 'zh');

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('zh');
  });

  it('should fall back to "en" for invalid stored locale', () => {
    sessionStorage.setItem('user_locale', 'invalid');

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('should switch back to English from Chinese', () => {
    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    act(() => {
      screen.getByTestId('switch-zh').click();
    });
    expect(screen.getByTestId('locale').textContent).toBe('zh');

    act(() => {
      screen.getByTestId('switch-en').click();
    });
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('translated').textContent).toBe('Loading...');
  });
});

describe('useLocale — outside provider', () => {
  it('should throw error when used outside LocaleProvider', () => {
    function BadConsumer() {
      useLocale();
      return null;
    }

    // Suppress the expected error output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<BadConsumer />);
    }).toThrow('useLocale must be used within LocaleProvider');

    spy.mockRestore();
  });
});
