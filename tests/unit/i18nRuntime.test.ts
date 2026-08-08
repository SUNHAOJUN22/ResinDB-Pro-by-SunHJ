import { describe, expect, test } from 'vitest';
import {
  hasCorruptedUnicode,
  humanizeTranslationKey,
  languageTag,
  normalizeLanguage,
  normalizeUiText,
  parseLanguage,
} from '@/i18n/runtime';

describe('Unicode-safe language runtime', () => {
  test('normalizes supported locale aliases without widening the public language type', () => {
    expect(parseLanguage('zh-CN')).toBe('zh');
    expect(parseLanguage('ZH_hans'.replace('_', '-'))).toBe('zh');
    expect(parseLanguage('en-US')).toBe('en');
    expect(parseLanguage('fr-FR')).toBeNull();
    expect(normalizeLanguage('unsupported')).toBe('zh');
    expect(languageTag('zh')).toBe('zh-CN');
    expect(languageTag('en')).toBe('en');
  });

  test('blocks replacement characters, control characters and common mojibake', () => {
    expect(hasCorruptedUnicode('damaged � text')).toBe(true);
    expect(hasCorruptedUnicode('temperature Â°C')).toBe(true);
    expect(hasCorruptedUnicode('safe 中文 and English')).toBe(false);
    expect(normalizeUiText('damaged � text', '安全回退')).toBe('安全回退');
    expect(normalizeUiText('finite scientific label', 'fallback')).toBe('finite scientific label');
  });

  test('renders missing translation keys as readable labels rather than internal tokens', () => {
    expect(humanizeTranslationKey('figureUnavailable')).toBe('Figure Unavailable');
    expect(humanizeTranslationKey('scientific.figure_state')).toBe('Scientific figure state');
  });
});
