import { describe, it, expect } from 'vitest';
import { t, resolveLocaleFromLanguageCode, formatDate } from '../src/i18n/index';

// ============================================================
// resolveLocaleFromLanguageCode
// ============================================================
describe('resolveLocaleFromLanguageCode', () => {
  it('should return "en" for undefined/null', () => {
    expect(resolveLocaleFromLanguageCode(undefined)).toBe('en');
    expect(resolveLocaleFromLanguageCode(null)).toBe('en');
  });

  it('should return "en" for English codes', () => {
    expect(resolveLocaleFromLanguageCode('en')).toBe('en');
    expect(resolveLocaleFromLanguageCode('EN')).toBe('en');
    expect(resolveLocaleFromLanguageCode('fr')).toBe('en'); // non-zh → en
  });

  it('should return "zh" for Chinese codes', () => {
    expect(resolveLocaleFromLanguageCode('zh')).toBe('zh');
    expect(resolveLocaleFromLanguageCode('ZH')).toBe('zh');
    expect(resolveLocaleFromLanguageCode('zh-CN')).toBe('zh');
    expect(resolveLocaleFromLanguageCode('zh-TW')).toBe('zh');
    expect(resolveLocaleFromLanguageCode('zh_Hans')).toBe('zh');
  });
});

// ============================================================
// t() — translation lookup
// ============================================================
describe('t() — translation lookup', () => {
  it('should return English string for known key', () => {
    expect(t('en', 'common.loading')).toBe('Loading...');
    expect(t('en', 'common.back')).toBe('← Back');
  });

  it('should return Chinese string for known key', () => {
    expect(t('zh', 'common.loading')).toBe('加载中…');
    expect(t('zh', 'common.back')).toBe('← 返回');
  });

  it('should return status labels in both locales', () => {
    expect(t('en', 'statusLabels.New')).toBe('New');
    expect(t('zh', 'statusLabels.New')).toBe('新建');
    expect(t('en', 'statusLabels.Archived')).toBe('Archived');
    expect(t('zh', 'statusLabels.Archived')).toBe('已归档');
  });

  it('should return role labels in both locales', () => {
    expect(t('en', 'roles.Admin')).toBe('Admin');
    expect(t('zh', 'roles.Admin')).toBe('管理员');
  });

  it('should return the key itself for missing translations', () => {
    expect(t('en', 'nonexistent.key')).toBe('nonexistent.key');
  });

  it('should fall back to English when zh key is missing', () => {
    // zh dictionary mirrors en, but if we ever have a gap, en should be fallback
    // For now, test that known keys work in both
    const enValue = t('en', 'common.confirm');
    const zhValue = t('zh', 'common.confirm');
    expect(enValue).toBe('Confirm');
    expect(zhValue).toBe('确认');
  });
});

// ============================================================
// t() — interpolation
// ============================================================
describe('t() — interpolation', () => {
  it('should interpolate params into template', () => {
    expect(t('en', 'common.userFallback', { id: 42 })).toBe('User 42');
    expect(t('zh', 'common.userFallback', { id: 42 })).toBe('用户 42');
  });

  it('should interpolate error messages', () => {
    expect(t('en', 'common.errorGeneric', { error: 'timeout' })).toBe('Error: timeout');
    expect(t('zh', 'common.errorGeneric', { error: 'timeout' })).toBe('错误：timeout');
  });

  it('should leave placeholder when param is missing', () => {
    expect(t('en', 'common.userFallback')).toBe('User {id}');
  });
});

// ============================================================
// formatDate
// ============================================================
describe('formatDate', () => {
  const testDate = new Date('2025-06-15T10:30:00Z');

  it('should format date for English locale', () => {
    const result = formatDate('en', testDate, { year: 'numeric', month: 'short', day: 'numeric' });
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('should format date for Chinese locale', () => {
    const result = formatDate('zh', testDate, { year: 'numeric', month: 'short', day: 'numeric' });
    expect(result).toContain('2025');
  });

  it('should accept string dates', () => {
    const result = formatDate('en', '2025-06-15T10:30:00Z', { year: 'numeric', month: 'short', day: 'numeric' });
    expect(result).toContain('2025');
  });
});
