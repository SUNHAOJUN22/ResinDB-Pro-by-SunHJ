import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataVisualizer } from '@/components/charts/DataVisualizer';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LANGUAGE_STORAGE_KEY } from '@/i18n/runtime';
import type { Language, Product } from '@/types/index';

// Only the browser canvas host is isolated. Product admission, chart-data
// preparation, statistical calculations, translations and report UI are real.
vi.mock('@/components/charts/ScientificEChart', () => ({ ScientificEChart: () => null }));

const products = (pairs: [number, number][]): Product[] => pairs.map(([density, mfr], index) => ({
  id: `observation-${index}`,
  gradeName: `Observation ${index + 1}`,
  manufacturer: 'Observed cohort',
  properties: {
    密度: { value: density, unit: 'g/cm³' },
    熔体质量流动速率: { value: mfr, unit: 'g/10min' },
  },
}) as Product);

function mount(language: Language, pairs: [number, number][]) {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  return render(<LanguageProvider><ThemeProvider>
    <DataVisualizer data={products(pairs)} formulas={[]} initialChartType="mfr_density" />
  </ThemeProvider></LanguageProvider>);
}

async function reportText() {
  const report = await screen.findByText((_, node) => node?.tagName === 'P'
    && (node.textContent?.includes('Pearson r') ?? false));
  return report.textContent ?? '';
}

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); window.localStorage.clear(); vi.restoreAllMocks(); });

describe.each(['zh', 'en'] as const)('actual correlation-report UI in %s', (language) => {
  it('preserves a negative direction and recognizes the same association magnitude as positive r', async () => {
    mount(language, [[0.9, 6], [0.92, 5], [0.94, 4], [0.96, 3], [0.98, 2], [1, 1]]);
    const text = await reportText();
    expect(text).toContain('Pearson r): -1.0000');
    expect(text).toContain(language === 'zh' ? '观察到负相关' : 'Observed negative correlation');
    expect(text).not.toContain(language === 'zh' ? '观察到正相关' : 'Observed positive correlation');
    expect(text).toContain(language === 'zh' ? '当前样本呈较强统计关联' : 'Strong statistical association in this sample');
  });

  it('reports positive association without treating correlation as predictive or causal validation', async () => {
    mount(language, [[0.9, 1], [0.92, 2], [0.94, 3], [0.96, 4], [0.98, 5], [1, 6]]);
    const text = await reportText();
    expect(text).toContain('Pearson r): 1.0000');
    expect(text).toContain(language === 'zh' ? '观察到正相关' : 'Observed positive correlation');
    expect(text).toContain(language === 'zh' ? '独立数据核验预测误差' : 'Validate prediction error on independent data');
    expect(text).not.toMatch(/具备高度物理预测力|直接用于牌号配方反推|high physical predictive capability|directly used for backing out formulations/);
    expect(text).toContain(language === 'zh' ? '决定系数 (R²)' : 'Coefficient of determination (R²)');
  });

  it('does not call a symmetric two-point sample normally distributed', async () => {
    mount(language, [[0.9, 1], [0.9, 1], [0.9, 1], [1.1, 5], [1.1, 5], [1.1, 5]]);
    const text = await reportText();
    expect(text).toMatch(language === 'zh' ? /样本偏度（描述性）: -?0\.00/ : /Sample skewness \(descriptive\): -?0\.00/);
    expect(text).toContain(language === 'zh' ? '不能单独判定正态分布' : 'does not establish normality');
    expect(text).not.toMatch(/符合正态分布|Conforms to Normal Distribution/);
  });

  it.each([
    ['empty', []],
    ['non-finite', [[Number.NaN, 1], [0.95, Number.POSITIVE_INFINITY], [Number.NEGATIVE_INFINITY, 2], [0.98, Number.NaN]]],
  ] as [string, [number, number][]][])('does not manufacture a regression report for %s observations', (_, pairs) => {
    const view = mount(language, pairs);
    expect(view.container.textContent).not.toContain('Pearson r');
    expect(view.container.textContent).not.toMatch(/NaN|Infinity|符合正态分布|Conforms to Normal Distribution/);
  });

  it('excludes non-finite observations before report statistics and significance', async () => {
    const valid: [number, number][] = [[0.9, 4], [0.92, 1], [0.94, 3], [0.96, 8], [0.98, 5], [1, 9]];
    const first = mount(language, valid);
    const expected = await reportText();
    first.unmount();
    mount(language, [...valid, [Number.NaN, 100], [0.96, Number.POSITIVE_INFINITY]]);
    expect(await reportText()).toBe(expected);
  });
});
