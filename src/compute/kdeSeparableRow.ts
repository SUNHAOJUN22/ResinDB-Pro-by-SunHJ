import { probeComputeCapabilities, type ComputeProbeEnvironment } from './capabilityProbe';
import {
  createKdeSeparableRowWasmSession,
  KDE_SEPARABLE_ROW_WASM_BINARY_VERSION,
  type KdeSeparableRowWasmSession,
} from './wasm/kdeSeparableRowWasm';

export const KDE_SEPARABLE_ROW_KERNEL_ID = 'kde-separable-row-accumulation';
export const KDE_SEPARABLE_ROW_KERNEL_VERSION = '1.0.0';
export const KDE_SEPARABLE_ROW_PROTOCOL_VERSION = 'kde-separable-row-f64-1.0.0';

export type KdeSeparableRowBackendPreference = 'auto' | 'typescript' | 'wasm';
export type KdeSeparableRowBackend = 'typescript' | 'wasm';

export interface KdeSeparableRowEvidence {
  kernel: typeof KDE_SEPARABLE_ROW_KERNEL_ID;
  kernelVersion: typeof KDE_SEPARABLE_ROW_KERNEL_VERSION;
  wasmBinaryVersion: typeof KDE_SEPARABLE_ROW_WASM_BINARY_VERSION;
  protocolVersion: typeof KDE_SEPARABLE_ROW_PROTOCOL_VERSION;
  precision: 'f64';
  requestedBackend: KdeSeparableRowBackendPreference;
  backend: KdeSeparableRowBackend;
  selectionReason:
    | 'explicit-typescript'
    | 'explicit-wasm'
    | 'auto-conservative-typescript';
  fallbackUsed: boolean;
  fallbackReason: string | null;
  calls: number;
  xKernelValues: number;
  xKernelBytes: number;
  wasmMemoryBytes: number | null;
  wasmAvailable: boolean;
  wasmSimdAvailable: boolean;
  wasmThreadsAvailable: boolean;
  wasmSimdUsed: false;
  wasmThreadsUsed: false;
}

export interface KdeSeparableRowSession {
  accumulate(yWeights: Float64Array, output: Float64Array): void;
  getEvidence(): KdeSeparableRowEvidence;
}

export interface CreateKdeSeparableRowSessionOptions {
  xKernel: Float64Array;
  observations: number;
  gridSize: number;
  preference?: KdeSeparableRowBackendPreference;
  allowFallback?: boolean;
  probeEnvironment?: ComputeProbeEnvironment;
  createWasmSession?: typeof createKdeSeparableRowWasmSession;
}

function validatePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return value;
}

function validateFinite(values: ArrayLike<number>, name: string): void {
  for (let index = 0; index < values.length; index++) {
    if (!Number.isFinite(values[index])) {
      throw new TypeError(`${name} must contain only finite values`);
    }
  }
}

function validateBuffers(
  xKernel: Float64Array,
  observations: number,
  gridSize: number,
  yWeights: Float64Array,
  output: Float64Array,
): void {
  if (xKernel.length !== observations * gridSize) {
    throw new RangeError('xKernel length must equal observations times gridSize');
  }
  if (yWeights.length !== observations) {
    throw new RangeError('yWeights length must equal observations');
  }
  if (output.length !== gridSize) {
    throw new RangeError('output length must equal gridSize');
  }
}

export function accumulateKdeSeparableRowTypeScript(
  xKernel: Float64Array,
  observations: number,
  gridSize: number,
  yWeights: Float64Array,
  output: Float64Array,
): void {
  const observationCount = validatePositiveInteger(observations, 'observations');
  const columns = validatePositiveInteger(gridSize, 'gridSize');
  validateBuffers(xKernel, observationCount, columns, yWeights, output);
  validateFinite(xKernel, 'xKernel');
  validateFinite(yWeights, 'yWeights');
  for (let column = 0; column < columns; column++) {
    let sum = 0;
    for (let observation = 0; observation < observationCount; observation++) {
      sum += xKernel[observation * columns + column] * yWeights[observation];
    }
    output[column] = sum;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createKdeSeparableRowSession(
  options: CreateKdeSeparableRowSessionOptions,
): KdeSeparableRowSession {
  const observations = validatePositiveInteger(options.observations, 'observations');
  const gridSize = validatePositiveInteger(options.gridSize, 'gridSize');
  if (options.xKernel.length !== observations * gridSize) {
    throw new RangeError('xKernel length must equal observations times gridSize');
  }
  validateFinite(options.xKernel, 'xKernel');
  const requestedBackend = options.preference ?? 'auto';
  if (requestedBackend !== 'auto' && requestedBackend !== 'typescript' && requestedBackend !== 'wasm') {
    throw new TypeError('KDE row backend must be auto, typescript, or wasm');
  }
  const selectionReason = requestedBackend === 'wasm'
    ? 'explicit-wasm' as const
    : requestedBackend === 'typescript'
      ? 'explicit-typescript' as const
      : 'auto-conservative-typescript' as const;
  const selectedBackend: KdeSeparableRowBackend = requestedBackend === 'wasm'
    ? 'wasm'
    : 'typescript';
  const allowFallback = options.allowFallback ?? true;
  const capabilities = probeComputeCapabilities(options.probeEnvironment);
  const wasmFactory = options.createWasmSession ?? createKdeSeparableRowWasmSession;
  let backend: KdeSeparableRowBackend = 'typescript';
  let wasmSession: KdeSeparableRowWasmSession | null = null;
  let fallbackUsed = false;
  let fallbackReason: string | null = null;
  let calls = 0;

  if (selectedBackend === 'wasm') {
    if (!capabilities.wasm) {
      if (!allowFallback) throw new Error('WebAssembly was requested but is unavailable');
      fallbackUsed = true;
      fallbackReason = 'WebAssembly capability is unavailable';
    } else {
      try {
        wasmSession = wasmFactory(options.xKernel, observations, gridSize);
        backend = 'wasm';
      } catch (error) {
        if (!allowFallback) throw error;
        fallbackUsed = true;
        fallbackReason = errorMessage(error);
      }
    }
  }

  const switchToTypeScript = (error: unknown): void => {
    if (!allowFallback) throw error;
    backend = 'typescript';
    wasmSession = null;
    fallbackUsed = true;
    fallbackReason = errorMessage(error);
  };

  return {
    accumulate(yWeights, output) {
      validateBuffers(options.xKernel, observations, gridSize, yWeights, output);
      validateFinite(yWeights, 'yWeights');
      calls += 1;
      if (backend === 'wasm' && wasmSession) {
        try {
          wasmSession.accumulate(yWeights, output);
          return;
        } catch (error) {
          switchToTypeScript(error);
        }
      }
      accumulateKdeSeparableRowTypeScript(
        options.xKernel,
        observations,
        gridSize,
        yWeights,
        output,
      );
    },
    getEvidence() {
      return {
        kernel: KDE_SEPARABLE_ROW_KERNEL_ID,
        kernelVersion: KDE_SEPARABLE_ROW_KERNEL_VERSION,
        wasmBinaryVersion: KDE_SEPARABLE_ROW_WASM_BINARY_VERSION,
        protocolVersion: KDE_SEPARABLE_ROW_PROTOCOL_VERSION,
        precision: 'f64',
        requestedBackend,
        backend,
        selectionReason,
        fallbackUsed,
        fallbackReason,
        calls,
        xKernelValues: options.xKernel.length,
        xKernelBytes: options.xKernel.byteLength,
        wasmMemoryBytes: wasmSession?.memoryBytes ?? null,
        wasmAvailable: capabilities.wasm,
        wasmSimdAvailable: capabilities.wasmSimd,
        wasmThreadsAvailable: capabilities.wasmThreads,
        wasmSimdUsed: false,
        wasmThreadsUsed: false,
      } satisfies KdeSeparableRowEvidence;
    },
  };
}
