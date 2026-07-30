import { describe, expect, it, vi } from 'vitest';

interface WorkerScope {
  onmessage?: (event: MessageEvent) => void;
  postMessage(value: unknown): void;
}

async function runKde(payload: Record<string, unknown>) {
  vi.resetModules();
  const replies: unknown[] = [];
  const scope: WorkerScope = { postMessage: (value) => replies.push(value) };
  vi.stubGlobal('self', scope);
  await import('@/workers/kdeWorker');
  expect(scope.onmessage).toBeTypeOf('function');
  scope.onmessage!({ data: { type: 'CALCULATE_KDE', payload } } as MessageEvent);
  const response = [...replies].reverse().find((value) => (
    value !== null
    && typeof value === 'object'
    && (value as { type?: unknown }).type === 'KDE_CALCULATED'
  )) as { payload?: Record<string, unknown> } | undefined;
  vi.unstubAllGlobals();
  expect(response?.payload).toBeDefined();
  return response!.payload!;
}

const points = Array.from({ length: 40 }, (_, index) => ({
  x: Math.sin(index * 0.17) * 3 + index * 0.02,
  y: Math.cos(index * 0.11) * 2 - index * 0.015,
}));

describe('KDE FP64 WebAssembly worker integration', () => {
  it('matches the TypeScript grid exactly for the same inputs', async () => {
    const common = { points, gridSize: 24, allowFallback: false };
    const typescript = await runKde({ ...common, backend: 'typescript' });
    const wasm = await runKde({ ...common, backend: 'wasm' });

    expect(wasm.grid).toEqual(typescript.grid);
    expect(wasm.minX).toBe(typescript.minX);
    expect(wasm.maxX).toBe(typescript.maxX);
    expect(wasm.minY).toBe(typescript.minY);
    expect(wasm.maxY).toBe(typescript.maxY);
    expect(wasm.minZ).toBe(typescript.minZ);
    expect(wasm.maxZ).toBe(typescript.maxZ);
    expect(wasm.bandwidth).toEqual(typescript.bandwidth);
    expect(wasm.observations).toBe(typescript.observations);
    expect(wasm.performance).toMatchObject({
      kernelStrategy: 'separable-precomputed-x',
      accumulationKernel: {
        kernel: 'kde-separable-row-accumulation',
        requestedBackend: 'wasm',
        backend: 'wasm',
        precision: 'f64',
        fallbackUsed: false,
        calls: 24,
      },
    });
  });

  it('keeps product auto execution conservative and versioned', async () => {
    const automatic = await runKde({ points, gridSize: 12 });
    expect(automatic.performance).toMatchObject({
      accumulationKernel: {
        requestedBackend: 'auto',
        backend: 'typescript',
        selectionReason: 'auto-conservative-typescript',
        calls: 12,
      },
    });
  });
});
