import { describe, it, expect } from 'vitest';
import { t, resolveLocaleFromLanguageCode, formatDate } from '../src/i18n/index';

describe('i18n — edge cases', () => {
  describe('resolveLocaleFromLanguageCode — edge cases', () => {
    it('should handle empty string', () => {
      expect(resolveLocaleFromLanguageCode('')).toBe('en');
    });

    it('should handle upper case ZH', () => {
      expect(resolveLocaleFromLanguageCode('ZH')).toBe('zh');
    });

    it('should handle mixed case zh-Hant', () => {
      expect(resolveLocaleFromLanguageCode('zh-Hant')).toBe('zh');
    });

    it('should handle zh_Hant_TW', () => {
      expect(resolveLocaleFromLanguageCode('zh_Hant_TW')).toBe('zh');
    });

    it('should return "en" for unrecognized languages', () => {
      expect(resolveLocaleFromLanguageCode('ko')).toBe('en');
      expect(resolveLocaleFromLanguageCode('ar')).toBe('en');
      expect(resolveLocaleFromLanguageCode('ru')).toBe('en');
    });

    it('should handle whitespace', () => {
      expect(resolveLocaleFromLanguageCode(' ')).toBe('en');
    });
  });

  describe('t() — edge cases', () => {
    it('should handle single-level key', () => {
      // Test a key that exists at root level (shouldn't, but test gracefully)
      const result = t('en', 'nonexistent');
      expect(result).toBe('nonexistent');
    });

    it('should handle deeply nested key that partially exists', () => {
      // common exists, but common.nonexistent doesn't
      const result = t('en', 'common.nonexistent.deep');
      expect(result).toBe('common.nonexistent.deep');
    });

    it('should handle empty key', () => {
      const result = t('en', '');
      expect(result).toBe('');
    });

    it('should handle key with dots but no match', () => {
      const result = t('en', 'a.b.c.d.e');
      expect(result).toBe('a.b.c.d.e');
    });

    it('interpolation should handle boolean param', () => {
      const result = t('en', 'common.userFallback', { id: true as any });
      expect(result).toBe('User true');
    });

    it('interpolation should handle 0 as param', () => {
      const result = t('en', 'common.userFallback', { id: 0 });
      expect(result).toBe('User 0');
    });

    it('interpolation should handle empty string param', () => {
      const result = t('en', 'common.userFallback', { id: '' });
      expect(result).toBe('User ');
    });

    it('should handle multiple params in one template', () => {
      // common.errorGeneric uses {error}
      const result = t('en', 'common.errorGeneric', { error: 'test error' });
      expect(result).toContain('test error');
    });

    it('extra params should be ignored', () => {
      const result = t('en', 'common.loading', { extra: 'ignored' });
      expect(result).toBe('Loading...');
    });
  });

  describe('formatDate — edge cases', () => {
    it('should handle ISO string with timezone', () => {
      const result = formatDate('en', '2025-12-31T23:59:59+08:00');
      expect(result).toBeDefined();
    });

    it('should handle Date object', () => {
      const result = formatDate('en', new Date(2025, 0, 1));
      expect(result).toContain('2025');
    });

    it('should handle minimal options', () => {
      const result = formatDate('en', '2025-06-15');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format differently for en vs zh', () => {
      const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
      const en = formatDate('en', '2025-06-15T10:00:00Z', opts);
      const zh = formatDate('zh', '2025-06-15T10:00:00Z', opts);
      // They should differ due to locale
      expect(en).not.toBe(zh);
    });
  });
});
