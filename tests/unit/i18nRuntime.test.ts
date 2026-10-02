import { afterEach, describe, expect, test } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { WelcomeBanner, Breadcrumbs } from '@/components/features/Dashboard/DashboardComponents';
import { TreeSidebar } from '@/components/layout/TreeSidebar';
import {
  LANGUAGE_STORAGE_KEY,
  hasCorruptedUnicode,
  humanizeTranslationKey,
  languageTag,
  normalizeLanguage,
  normalizeUiText,
  parseLanguage,
} from '@/i18n/runtime';

const codepoints = (...values: number[]) => String.fromCodePoint(...values);

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

  test.each(['constructor', '__proto__', 'CONSTRUCTOR', '  __proto__  '])(
    'rejects inherited object keys as language values: %s', (value) => {
      expect(parseLanguage(value)).toBeNull();
      expect(normalizeLanguage(value)).toBe('zh');
    },
  );

  test('blocks replacement characters, control characters and common mojibake', () => {
    const replacement = codepoints(0xfffd);
    const latin1Degree = codepoints(0x00c2, 0x00b0);
    expect(hasCorruptedUnicode(`damaged ${replacement} text`)).toBe(true);
    expect(hasCorruptedUnicode(`temperature ${latin1Degree}C`)).toBe(true);
    expect(hasCorruptedUnicode('safe 中文 and English')).toBe(false);
    expect(normalizeUiText(`damaged ${replacement} text`, '安全回退')).toBe('安全回退');
    expect(normalizeUiText('finite scientific label', 'fallback')).toBe('finite scientific label');
  });

  test('renders missing translation keys as readable labels rather than internal tokens', () => {
    expect(humanizeTranslationKey('figureUnavailable')).toBe('Figure Unavailable');
    expect(humanizeTranslationKey('scientific.figure_state')).toBe('Scientific figure state');
  });
});

describe('dashboard language-mode rendering', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  const Screen = () => {
    const { toggleLanguage, tProp } = useLanguage();
    return createElement('div', null,
      createElement('button', { onClick: toggleLanguage }, 'Toggle test language'),
      createElement('p', { 'data-testid': 'metadata' }, `${tProp('gradeName')} / ${tProp('manufacturer')}`),
      createElement(WelcomeBanner, { userName: 'Researcher', onDismiss: () => undefined }),
      createElement(Breadcrumbs, { view: 'dashboard' }),
      createElement(TreeSidebar, {
        categories: [], selectedCategoryIds: new Set<string>(),
        onToggleCategory: () => undefined, onClearCategories: () => undefined,
        minCompleteness: 0, onMinCompletenessChange: () => undefined,
      }),
    );
  };

  test('renders Chinese metadata, welcome text, breadcrumbs and quality controls', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'zh');
    const view = render(createElement(LanguageProvider, null, createElement(Screen)));
    expect(view.getByTestId('metadata')).toHaveTextContent('牌号名称 / 生产厂家');
    expect(view.getByText('本地工作区')).toBeInTheDocument();
    expect(view.getByRole('button', { name: '进入工作区' })).toBeInTheDocument();
    expect(view.getByRole('button', { name: '关闭欢迎提示' })).toBeInTheDocument();
    expect(view.getByText('数据中心')).toBeInTheDocument();
    expect(view.getByRole('slider', { name: '数据质量' })).toBeInTheDocument();
    expect(view.getByText('不限')).toBeInTheDocument();
    expect(view.queryByText('Local workspace')).not.toBeInTheDocument();
    expect(view.queryByText('DATA WAREHOUSE / 数据中心')).not.toBeInTheDocument();
  });

  test('switches mounted components in both directions and persists the locale', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'zh');
    const view = render(createElement(LanguageProvider, null, createElement(Screen)));
    fireEvent.click(view.getByRole('button', { name: 'Toggle test language' }));
    expect(view.getByTestId('metadata')).toHaveTextContent('Grade Name / Manufacturer');
    expect(view.getByText('Local workspace')).toBeInTheDocument();
    expect(view.getByText('Data warehouse')).toBeInTheDocument();
    expect(view.getByRole('slider', { name: 'Data quality' })).toBeInTheDocument();
    expect(view.queryByText('数据中心')).not.toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    fireEvent.click(view.getByRole('button', { name: 'Toggle test language' }));
    expect(view.getByText('本地工作区')).toBeInTheDocument();
    expect(view.getByText('不限')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh');
  });
});
