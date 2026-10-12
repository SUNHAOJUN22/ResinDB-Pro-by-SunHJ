import { act, render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { WeibullChart } from '@/components/charts/WeibullChart';
import type { EChartsOption } from '@/lib/echarts';

const state = vi.hoisted(() => ({ option: null as EChartsOption | null, aria: '', description: '', error: null as string | null, dataCount: 0 }));
vi.mock('@/components/charts/ScientificEChart', () => ({
  ScientificEChart: (props: { option: EChartsOption | null; ariaLabel: string; description: string; error: string | null; dataCount: number }) => {
    state.option = props.option; state.aria = props.ariaLabel; state.description = props.description; state.error = props.error; state.dataCount = props.dataCount;
    return null;
  },
}));
afterEach(() => { cleanup(); localStorage.removeItem('resindb-language'); });
const props = { points: [{ value: 1, x: 0, y: -2, p: 0.1 }, { value: 2, x: Math.log(2), y: -1, p: 0.3 }, { value: 3, x: Math.log(3), y: 0, p: 0.6 }], m: 2, eta: 3, rSquared: 0.99, safeValue95: 0.68, targetKey: '<img src=x onerror=alert(1)>', theme: 'light' as const };

describe('Weibull language and interpretation boundary', () => {
  it('updates title, description and legends after a language change', () => {
    localStorage.setItem('resindb-language', 'zh');
    render(<LanguageProvider><WeibullChart {...props} /></LanguageProvider>);
    expect(state.aria).toBe('双参数 Weibull 概率图');
    expect(state.description).toContain('不是安全保证');
    expect(JSON.stringify(state.option?.legend)).toContain('中位秩观测值');
    act(() => { window.dispatchEvent(new CustomEvent('resindb-language-change', { detail: 'en' })); });
    expect(state.aria).toBe('Two-parameter Weibull probability plot');
    expect(state.description).toContain('not a safety guarantee');
    expect(JSON.stringify(state.option?.legend)).toContain('Median-rank observations');
  });

  it.each(['zh', 'en'] as const)('rejects an invalid fit and recovers after correction in %s', (language) => {
    localStorage.setItem('resindb-language', language);
    const view = render(<LanguageProvider><WeibullChart {...props} eta={0} /></LanguageProvider>);
    expect(state.option).toBeNull();
    expect(state.dataCount).toBe(0);
    expect(state.error).toContain(language === 'zh' ? '拟合结果无效' : 'Invalid inputs or fit');
    view.rerender(<LanguageProvider><WeibullChart {...props} /></LanguageProvider>);
    expect(state.option).not.toBeNull();
    expect(state.error).toBeNull();
    expect(state.dataCount).toBe(5);
  });

  it.each(['zh', 'en'] as const)('escapes user-provided property names in the %s tooltip', (language) => {
    localStorage.setItem('resindb-language', language);
    render(<LanguageProvider><WeibullChart {...props} /></LanguageProvider>);
    const tooltip = state.option?.tooltip as { formatter: (item: unknown) => string };
    const html = tooltip.formatter({ seriesType: 'scatter', data: [0, -2, 1, 0.1] });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain(language === 'zh' ? '累积失效概率' : 'Cumulative failure');
    expect(tooltip.formatter({ seriesType: 'line' })).toContain(language === 'zh' ? '非极大似然估计' : 'not MLE');
  });
});
