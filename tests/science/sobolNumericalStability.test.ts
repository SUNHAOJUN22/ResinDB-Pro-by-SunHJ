import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types/index';
import type { SobolResponse } from '@/workers/sobolWorker';

const product: Product = {
  id: 'sensitivity-sample', gradeName: 'Sensitivity sample',
  manufacturerId: 'test', manufacturer: 'Test', categoryIds: [],
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
  properties: { A: { value: 10 }, B: { value: 5 } },
};

afterEach(() => vi.unstubAllGlobals());

async function sensitivity(expression: string, source = product, unit = '-') {
  vi.resetModules();
  const replies: SobolResponse[] = [];
  const scope: { onmessage?: (event: MessageEvent) => void; postMessage: (reply: SobolResponse) => void } = {
    postMessage: (reply) => replies.push(reply),
  };
  vi.stubGlobal('self', scope);
  await import('@/workers/sobolWorker');
  scope.onmessage!({ data: {
    type: 'RUN_SOBOL',
    payload: {
      targetFormulaId: 'result',
      formulas: [{ id: 'result', name: 'Result', expression, unit }],
      product: source, variances: { A: 10, B: 10 },
      iterations: 1024, seed: 'sensitivity-affine-invariance',
    },
  } } as MessageEvent);
  return replies.at(-1)!;
}

function indices(response: SobolResponse) {
  expect(response.type, response.error).toBe('SOBOL_COMPLETE');
  return {
    first: Object.fromEntries(response.payload!.firstOrder.map(({ name, value }) => [name, value])),
    total: Object.fromEntries(response.payload!.totalEffect.map(({ name, value }) => [name, value])),
  };
}

describe('Sobol physical and numerical invariants', () => {
  it.each([
    ['1e-200', '0', 10],
    ['1e200', '0', 10],
    ['-1e200', '0', 10],
    ['1', '1e12', 4],
  ] as const)('preserves indices under y = %s f + %s', async (scale, offset, digits) => {
    const expression = "Props['A'] + 2 * Props['B']";
    const reference = indices(await sensitivity(expression));
    const transformed = indices(await sensitivity(`${scale} * (${expression}) + ${offset}`));
    for (const name of ['A', 'B']) {
      expect(transformed.first[name]).toBeCloseTo(reference.first[name], digits);
      expect(transformed.total[name]).toBeCloseTo(reference.total[name], digits);
      // Independent linear inputs have equal analytical variance contributions.
      expect(reference.total[name]).toBeCloseTo(0.5, 1);
    }
  });

  it('preserves physical contributions when an input is expressed in a compatible unit', async () => {
    const first: Product = { ...product, properties: {
      A: { value: 1, unit: 'MPa' }, B: { value: 1, unit: 'MPa' },
    } };
    const second: Product = { ...product, properties: {
      A: { value: 1, unit: 'MPa' }, B: { value: 1000, unit: 'kPa' },
    } };
    const reference = indices(await sensitivity("Props['A'] + Props['B']", first, 'MPa'));
    const converted = indices(await sensitivity("Props['A'] + Props['B']", second, 'MPa'));
    for (const name of ['A', 'B']) {
      expect(converted.first[name]).toBeCloseTo(reference.first[name], 10);
      expect(converted.total[name]).toBeCloseTo(reference.total[name], 10);
    }
  });

  it('handles opposite-sign finite outputs whose anchor differences overflow', async () => {
    const reference = indices(await sensitivity("sin(Props['A'])"));
    const scaled = indices(await sensitivity("1e308 * sin(Props['A'])"));
    for (const name of ['A', 'B']) {
      expect(scaled.first[name]).toBeCloseTo(reference.first[name], 10);
      expect(scaled.total[name]).toBeCloseTo(reference.total[name], 10);
    }
  });

  it('still rejects a truly constant output', async () => {
    const response = await sensitivity('4');
    expect(response.type).toBe('ERROR');
    expect(response.error).toMatch(/variance.*zero/i);
  });
});
