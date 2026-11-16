import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import type { Product } from '@/types/index';
import type { SimilarityResult } from '@/services/mathUtils';

const observed = vi.hoisted(() => ({ points: [] as Array<Record<string, unknown>> }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ tProp: (key: string) => key }) }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  RadarChart: ({ data, children }: { data: Array<Record<string, unknown>>; children: React.ReactNode }) => {
    observed.points = data;
    return <div data-testid="radar">{children}</div>;
  },
  Radar: () => null, PolarGrid: () => null, PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null, Tooltip: () => null, Legend: () => null,
}));
import { SimilarProductsRadar } from '@/components/charts/SimilarProductsRadar';

function sample(id: string, density: number, unit: string, strength: number): Product {
  return {
    id, gradeName: id, manufacturer: 'Lab', manufacturerId: 'lab', categoryIds: [],
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    properties: {
      density: { value: density, unit, quantity: canonicalizeCoreProperty('density', { value: density, unit }) },
      tensileYield: { value: strength, unit: 'MPa', method: 'ISO 527' },
      flexuralModulus: { value: strength * 100, unit: 'MPa', method: 'ISO 178' },
    },
  };
}
function mount(target: Product, candidate: Product) {
  const similar = [{ product: candidate }] as SimilarityResult[];
  render(<SimilarProductsRadar targetProduct={target} similarProducts={similar} allProducts={[target, candidate]} />);
}
beforeEach(() => { observed.points = []; });
afterEach(cleanup);

describe('similar-products radar observation admission', () => {
  it('uses canonical density so kg/m³ and g/cm³ preserve physical ordering', () => {
    mount(sample('low', 900, 'kg/m³', 20), sample('high', 1.2, 'g/cm³', 40));
    expect(observed.points.find(point => point.fullKey === 'density')).toMatchObject({
      minimum: 0.9, maximum: 1.2, target: 0, candidate_0: 100,
    });
  });

  it.each(['UNKNOWN', 'INVALID'] as const)('never revives %s quantities through raw values', status => {
    const low = sample('low', 900, 'kg/m³', 20);
    low.properties.density.quantity!.status = status;
    delete low.properties.density.quantity!.canonical;
    mount(low, sample('high', 1.2, 'g/cm³', 40));
    expect(screen.queryByTestId('radar')).toBeNull();
    expect(screen.getByText(/At least three finite/)).toBeTruthy();
  });

  it('rejects a valid-labelled quantity that contradicts its declaration', () => {
    const low = sample('low', 900, 'kg/m³', 20);
    low.properties.density.quantity!.canonical!.value = 30;
    mount(low, sample('high', 1.2, 'g/cm³', 40));
    expect(screen.queryByTestId('radar')).toBeNull();
  });

  it('does not compare measurements with incompatible test temperatures', () => {
    const low = sample('low', 900, 'kg/m³', 20);
    const high = sample('high', 1.2, 'g/cm³', 40);
    delete low.properties.density; delete high.properties.density;
    for (const [index, product] of [low, high].entries()) {
      product.properties.mfr = { value: index + 1, unit: 'g/10 min', method: 'ISO 1133', temperature: index ? 230 : 190, load: 2.16 };
    }
    mount(low, high);
    expect(screen.queryByTestId('radar')).toBeNull();
  });
});
