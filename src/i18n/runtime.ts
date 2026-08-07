import type { Language } from '@/types/index';

export const LANGUAGE_STORAGE_KEY = 'resindb-language';

const LANGUAGE_ALIASES: Readonly<Record<string, Language>> = {
  zh: 'zh',
  'zh-cn': 'zh',
  'zh-hans': 'zh',
  chinese: 'zh',
  中文: 'zh',
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  english: 'en',
};

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const MOJIBAKE_PATTERN = /\uFFFD|Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â[\u0080-\u00BF]{1,2}|ðŸ|ï»¿|锟斤拷/u;

export function parseLanguage(value: unknown): Language | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().toLowerCase();
  return LANGUAGE_ALIASES[normalized] ?? null;
}

export function normalizeLanguage(value: unknown, fallback: Language = 'zh'): Language {
  return parseLanguage(value) ?? fallback;
}

export function languageTag(language: Language): 'zh-CN' | 'en' {
  return language === 'zh' ? 'zh-CN' : 'en';
}

export function hasCorruptedUnicode(value: string): boolean {
  return CONTROL_CHARACTER_PATTERN.test(value) || MOJIBAKE_PATTERN.test(value);
}

export function normalizeUiText(value: unknown, fallback = ''): string {
  const candidate = typeof value === 'string' ? value.normalize('NFC') : '';
  if (!candidate.trim() || hasCorruptedUnicode(candidate)) {
    const safeFallback = fallback.normalize('NFC');
    return hasCorruptedUnicode(safeFallback) ? '' : safeFallback;
  }
  return candidate;
}

export function humanizeTranslationKey(key: string): string {
  const normalized = key
    .normalize('NFKC')
    .replace(/[._-]+/gu, ' ')
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
