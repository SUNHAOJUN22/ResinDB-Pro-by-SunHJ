import { describe, expect, it, vi } from 'vitest';
import {
  accumulateKdeSeparableRowTypeScript,
  createKdeSeparableRowSession,
} from '@/compute/kdeSeparableRow';
import { createKdeSeparableRowWasmSession } from '@/compute/wasm/kdeSeparableRowWasm';

const xKernel = new Float64Array([
  1, 0.8, 0.2, 0.1,
  0.5, 1, 0.7, 0.2,
  0.1, 0.4, 1, 0.9,
]);
const yWeights = new Float64Array([0.25, 0.5, 0.75]);

function output() {
  return new Float64Array(4);
}

describe('FP64 KDE separable-row backends', () => {
  it('matches the TypeScript reference output exactly', () => {
    const reference = output();
    const candidate = output();
    accumulateKdeSeparableRowTypeScript(xKernel, 3, 4, yWeights, reference);
    const wasm = createKdeSeparableRowWasmSession(xKernel, 3, 4);
    wasm.accumulate(yWeights, candidate);
    expect([...candidate]).toEqual([...reference]);
    expect(wasm.memoryBytes).toBeGreaterThanOrEqual(131_072);
  });

  it('uses explicit WASM and reports versioned FP64 evidence', () => {
    const session = createKdeSeparableRowSession({
      xKernel,
      observations: 3,
      gridSize: 4,
      preference: 'wasm',
      allowFallback: false,
    });
    session.accumulate(yWeights, output());
    expect(session.getEvidence()).toMatchObject({
      kernel: 'kde-separable-row-accumulation',
      kernelVersion: '1.0.0',
      protocolVersion: 'kde-separable-row-f64-1.0.0',
      precision: 'f64',
      requestedBackend: 'wasm',
      backend: 'wasm',
      selectionReason: 'explicit-wasm',
      fallbackUsed: false,
      calls: 1,
      wasmSimdUsed: false,
      wasmThreadsUsed: false,
    });
  });

  it('keeps auto conservative until a device-local KDE profile exists', () => {
    const session = createKdeSeparableRowSession({
      xKernel,
      observations: 3,
      gridSize: 4,
      preference: 'auto',
    });
    session.accumulate(yWeights, output());
    expect(session.getEvidence()).toMatchObject({
      requestedBackend: 'auto',
      backend: 'typescript',
      selectionReason: 'auto-conservative-typescript',
      wasmMemoryBytes: null,
    });
  });

  it('falls back to TypeScript after initialization or runtime failures', () => {
    const initializationFallback = createKdeSeparableRowSession({
      xKernel,
      observations: 3,
      gridSize: 4,
      preference: 'wasm',
      allowFallback: true,
      createWasmSession: () => {
        throw new Error('synthetic KDE WASM initialization failure');
      },
    });
    const initializationOutput = output();
    initializationFallback.accumulate(yWeights, initializationOutput);
    const reference = output();
    accumulateKdeSeparableRowTypeScript(xKernel, 3, 4, yWeights, reference);
    expect([...initializationOutput]).toEqual([...reference]);
    expect(initializationFallback.getEvidence()).toMatchObject({
      backend: 'typescript',
      fallbackUsed: true,
      fallbackReason: 'synthetic KDE WASM initialization failure',
    });

    const runtimeFallback = createKdeSeparableRowSession({
      xKernel,
      observations: 3,
      gridSize: 4,
      preference: 'wasm',
      allowFallback: true,
      createWasmSession: () => ({
        memoryBytes: 131_072,
        accumulate(_weights, candidate) {
          candidate.fill(Number.NaN);
          throw new Error('synthetic KDE WASM runtime failure');
        },
      }),
    });
    const runtimeOutput = output();
    runtimeFallback.accumulate(yWeights, runtimeOutput);
    expect([...runtimeOutput]).toEqual([...reference]);
    expect(runtimeFallback.getEvidence()).toMatchObject({
      backend: 'typescript',
      fallbackUsed: true,
      fallbackReason: 'synthetic KDE WASM runtime failure',
    });
  });

  it('rejects strict unavailable WASM and non-finite inputs', () => {
    vi.stubGlobal('WebAssembly', undefined);
    try {
      expect(() => createKdeSeparableRowSession({
        xKernel,
        observations: 3,
        gridSize: 4,
        preference: 'wasm',
        allowFallback: false,
      })).toThrow('WebAssembly was requested but is unavailable');
    } finally {
      vi.unstubAllGlobals();
    }

    expect(() => createKdeSeparableRowSession({
      xKernel: new Float64Array([1, Number.NaN]),
      observations: 1,
      gridSize: 2,
    })).toThrow('xKernel must contain only finite values');
    expect(() => accumulateKdeSeparableRowTypeScript(
      xKernel,
      3,
      4,
      new Float64Array([1, Number.POSITIVE_INFINITY, 1]),
      output(),
    )).toThrow('yWeights must contain only finite values');
  });
});
