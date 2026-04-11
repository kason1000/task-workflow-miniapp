import type { Locale, TParams } from './types';
import { en, type Dictionary } from './locales/en';
import { zh } from './locales/zh';

export type { Locale, TParams } from './types';
export type { Dictionary } from './locales/en';

const DICTIONARIES: Record<Locale, Dictionary> = { en, zh };

export function resolveLocaleFromLanguageCode(languageCode?: string | null): Locale {
  if (!languageCode) return 'en';
  const lc = languageCode.toLowerCase();
  if (lc === 'zh' || lc.startsWith('zh-') || lc.startsWith('zh_')) return 'zh';
  return 'en';
}

function lookup(dict: any, key: string): string | undefined {
  const parts = key.split('.');
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const v = params[name];
    return v === undefined || v === null ? `{${name}}` : String(v);
  });
}

export function t(locale: Locale, key: string, params?: TParams): string {
  const dict = DICTIONARIES[locale] || DICTIONARIES.en;
  let template = lookup(dict, key);
  if (template === undefined) {
    template = lookup(DICTIONARIES.en, key);
    if (template === undefined) {
      if (import.meta.env?.DEV) {
        console.warn(`[i18n] missing translation key: ${key}`);
      }
      return key;
    }
  }
  return interpolate(template, params);
}

export function formatDate(locale: Locale, date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', options).format(d);
}
