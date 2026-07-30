import { describe, expect, it } from 'vitest';
import {
  applyScientificFigurePolicy,
  escapeScientificHtml,
  formatScientificNumber,
  SCIENTIFIC_FIGURE_POLICY_VERSION,
} from '@/components/charts/scientificFigurePolicy';

describe('scientific figure policy', () => {
  it('enforces accessible export, log-axis and reduced-motion defaults', () => {
    const option = applyScientificFigurePolicy({
      xAxis: { type: 'log' },
      yAxis: { type: 'value' },
      series: [{ type: 'scatter', data: [[1, 2]] }],
    }, {
      theme: 'light',
      title: 'Test figure',
      exportName: 'test-figure',
      reducedMotion: true,
      dataCount: 1,
    }) as Record<string, unknown>;
    expect(SCIENTIFIC_FIGURE_POLICY_VERSION).toBe('scientific-figure-policy-1.0.0');
    expect(option.animation).toBe(false);
    expect(option.aria).toMatchObject({ enabled: true });
    expect(option.toolbox).toMatchObject({
      feature: { saveAsImage: { name: 'test-figure', pixelRatio: 3 } },
    });
    expect(option.xAxis).toMatchObject({ type: 'log', logBase: 10 });
  });

  it('formats scientific values and escapes tooltip labels', () => {
    expect(formatScientificNumber(0.00001234)).toMatch(/e-/);
    expect(formatScientificNumber(12.3456)).toBe('12.35');
    expect(escapeScientificHtml('<sample & "name">')).toBe('&lt;sample &amp; &quot;name&quot;&gt;');
  });
});
