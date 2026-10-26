import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataVisualizer } from '@/components/charts/DataVisualizer';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LANGUAGE_STORAGE_KEY } from '@/i18n/runtime';
import type { Product } from '@/types/index';

const calculate = vi.hoisted(() => vi.fn());
vi.mock('@/components/charts/ScientificEChart', () => ({ ScientificEChart: () => null }));
vi.mock('@/hooks/workers/useArrheniusWorker', () => ({ useArrheniusWorker: () => ({
  isCalculating: false, arrheniusResult: null, error: null,
  calculateArrhenius: calculate, getPredictedLife: () => null,
}) }));

function mount(properties: Product['properties']) {
  const product: Product = { id: 'series', gradeName: 'Synthetic aging series', manufacturer: 'Fixture', manufacturerId: 'fixture', categoryIds: [], createdAt: '', updatedAt: '', properties };
  const view = render(<LanguageProvider><ThemeProvider><DataVisualizer data={[product]} formulas={[]} /></ThemeProvider></LanguageProvider>);
  fireEvent.click(view.container.querySelector('[data-chart-mode="arrhenius"]')!);
  return view;
}
beforeEach(() => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
  calculate.mockClear();
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => { cleanup(); window.localStorage.clear(); vi.restoreAllMocks(); });

describe('actual Arrhenius extraction and run controls', () => {
  it('sends converted hours from an explicit test series through the real button handlers', () => {
    const properties = Object.fromEntries([[110, 120, 2], [130, 60, 1]].map(([tempC, minutes, hours]) => {
      const raw = { value: minutes, unit: 'min', method: 'fixture aging protocol',
        conditions: { observationKind: 'time-to-failure', temperatureC: tempC, failureCriterion: '50% retention', agingSeriesId: 'fixture-series' } };
      return [`failure_${tempC}C`, { value: minutes, unit: 'min', method: raw.method,
        quantity: { raw, status: 'VALID' as const, canonical: { value: hours, unit: 'h', dimension: 'time' }, reasonCodes: [], provenanceRefs: ['fixture'] } }];
    }));
    mount(properties);
    fireEvent.click(screen.getByText('Smart Extract from Attributes', { selector: 'button' }));
    fireEvent.click(screen.getByText('Run Lifetime Decay Model', { selector: 'button' }));
    expect(calculate).toHaveBeenCalledWith([{ tempC: 110, time: 2 }, { tempC: 130, time: 1 }]);
    expect(window.alert).not.toHaveBeenCalled();
  });
  it.each(['OIT', 'Strength'])('refuses %s temperature attributes as automatic lifetime input', key => {
    mount({ [`${key}_110C`]: { value: 8500, unit: key === 'OIT' ? 'min' : 'MPa' }, [`${key}_130C`]: { value: 2200, unit: key === 'OIT' ? 'min' : 'MPa' } });
    fireEvent.click(screen.getByText('Smart Extract from Attributes', { selector: 'button' }));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Extraction failed:'));
    expect(calculate).not.toHaveBeenCalled();
  });
});
