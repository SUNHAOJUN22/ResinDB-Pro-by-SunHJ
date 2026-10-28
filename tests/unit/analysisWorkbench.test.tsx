import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import katex from 'katex';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LANGUAGE_STORAGE_KEY } from '@/i18n/runtime';
import { AnalysisModeNavigation } from '@/components/charts/AnalysisModeNavigation';
import { AnalysisMethodPanel, ANALYSIS_METHOD_FORMULAS } from '@/components/charts/AnalysisMethodPanel';
import { ANALYSIS_MODES } from '@/components/charts/analysisModes';
beforeEach(() => window.localStorage.clear());
afterEach(cleanup);
it('registers each of the existing 23 methods once', () => {
  expect(ANALYSIS_MODES).toHaveLength(23);
  expect(new Set(ANALYSIS_MODES.map(mode => mode.id)).size).toBe(23);
});
describe.each(['zh', 'en'] as const)('method navigation in %s', language => {
  it('groups all methods without removing existing selection hooks', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    const select = vi.fn();
    const { container } = render(<LanguageProvider><AnalysisModeNavigation active="radar" onSelect={select} /></LanguageProvider>);
    expect(container.querySelectorAll('[data-chart-mode]')).toHaveLength(23);
    expect(container.querySelector('[data-chart-mode="radar"]')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(container.querySelector('[data-chart-mode="copula"]')!);
    expect(select).toHaveBeenCalledWith('copula');
    const search = screen.getByRole('searchbox');
    expect(search).toHaveAccessibleName(language === 'en' ? 'Find an analysis method' : '查找分析方法');
    fireEvent.change(search, { target: { value: 'mahalanobis' } });
    expect(container.querySelectorAll('[data-chart-mode]')).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'zzzz-no-method' } });
    expect(screen.getByRole('status')).toHaveTextContent(language === 'en' ? 'No matching method' : '没有匹配');
    fireEvent.change(search, { target: { value: '' } });
    expect(container.querySelectorAll('[data-chart-mode]')).toHaveLength(23);
  });
  it('binds displayed math to the method without presenting record counts as valid samples', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    const { container, rerender } = render(<LanguageProvider><AnalysisMethodPanel mode="rsm" records={27} /></LanguageProvider>);
    expect(screen.getByText(language === 'en' ? '27 filtered records' : '27 条筛选记录')).toBeInTheDocument();
    expect(container.textContent).toContain(language === 'en' ? 'not the fitted sample size' : '不等于实际拟合样本数');
    expect(container.querySelector('math')).not.toBeNull();
    rerender(<LanguageProvider><AnalysisMethodPanel mode="gpc" records={27} /></LanguageProvider>);
    expect(container.querySelector('math')).toBeNull();
  });
});
it('updates labels when the running application changes language', () => {
  render(<LanguageProvider><AnalysisModeNavigation active="radar" onSelect={() => {}} /></LanguageProvider>);
  act(() => window.dispatchEvent(new CustomEvent('resindb-language-change', { detail: 'en' })));
  expect(screen.getByRole('searchbox')).toHaveAccessibleName('Find an analysis method');
});
it.each(Object.entries(ANALYSIS_METHOD_FORMULAS))('renders the %s method formula with strict KaTeX', (_mode, formula) => {
  expect(() => katex.renderToString(formula, { throwOnError: true, strict: 'error', trust: false })).not.toThrow();
});
