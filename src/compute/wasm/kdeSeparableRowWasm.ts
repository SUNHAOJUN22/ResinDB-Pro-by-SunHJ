export const KDE_SEPARABLE_ROW_WASM_BINARY_VERSION =
  'kde-separable-row-wasm-f64-1.0.0';

const WASM_PAGE_BYTES = 65_536;

const KDE_SEPARABLE_ROW_WASM_BYTES = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 10, 1, 96, 5, 127, 127, 127, 127, 127, 1,
  127, 3, 2, 1, 0, 5, 5, 1, 1, 2, 128, 32, 6, 15, 2, 127, 1, 65, 128, 136, 4,
  11, 127, 0, 65, 128, 136, 4, 11, 7, 41, 3, 6, 109, 101, 109, 111, 114, 121, 2,
  0, 14, 97, 99, 99, 117, 109, 117, 108, 97, 116, 101, 95, 114, 111, 119, 0, 0,
  11, 95, 95, 104, 101, 97, 112, 95, 98, 97, 115, 101, 3, 1, 10, 175, 1, 1,
  172, 1, 3, 3, 127, 1, 124, 3, 127, 65, 127, 33, 5, 2, 64, 32, 0, 69, 13,
  0, 32, 1, 69, 13, 0, 32, 2, 69, 13, 0, 32, 3, 65, 1, 72, 13, 0, 32, 4,
  65, 1, 72, 13, 0, 32, 4, 65, 3, 116, 33, 6, 65, 0, 33, 5, 65, 0, 33,
  7, 3, 64, 32, 7, 32, 4, 70, 13, 1, 68, 0, 0, 0, 0, 0, 0, 0, 0, 33,
  8, 32, 1, 33, 9, 32, 0, 33, 10, 32, 3, 33, 11, 3, 64, 2, 64, 32, 11,
  13, 0, 32, 2, 32, 7, 65, 3, 116, 106, 32, 8, 57, 3, 0, 32, 0, 65, 8,
  106, 33, 0, 32, 7, 65, 1, 106, 33, 7, 12, 2, 11, 32, 11, 65, 127, 106,
  33, 11, 32, 10, 43, 3, 0, 32, 9, 43, 3, 0, 162, 32, 8, 160, 33, 8, 32,
  9, 65, 8, 106, 33, 9, 32, 10, 32, 6, 106, 33, 10, 12, 0, 11, 11, 11,
  32, 5, 11,
]);

interface KdeSeparableRowWasmExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  accumulate_row(
    xKernelPointer: number,
    yWeightsPointer: number,
    outputPointer: number,
    observations: number,
    gridSize: number,
  ): number;
  __heap_base: WebAssembly.Global;
}

export interface KdeSeparableRowWasmSession {
  readonly memoryBytes: number;
  accumulate(yWeights: Float64Array, output: Float64Array): void;
}

function align(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

function ensureMemory(memory: WebAssembly.Memory, requiredBytes: number): void {
  const missingBytes = requiredBytes - memory.buffer.byteLength;
  if (missingBytes <= 0) return;
  memory.grow(Math.ceil(missingBytes / WASM_PAGE_BYTES));
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

export function supportsKdeSeparableRowWasm(
  webAssembly: typeof WebAssembly | undefined =
    typeof WebAssembly === 'undefined' ? undefined : WebAssembly,
): boolean {
  if (!webAssembly) return false;
  try {
    return webAssembly.validate(KDE_SEPARABLE_ROW_WASM_BYTES);
  } catch {
    return false;
  }
}

export function createKdeSeparableRowWasmSession(
  xKernel: Float64Array,
  observations: number,
  gridSize: number,
  webAssembly: typeof WebAssembly | undefined =
    typeof WebAssembly === 'undefined' ? undefined : WebAssembly,
): KdeSeparableRowWasmSession {
  const observationCount = validatePositiveInteger(observations, 'observations');
  const columns = validatePositiveInteger(gridSize, 'gridSize');
  if (xKernel.length !== observationCount * columns) {
    throw new RangeError('xKernel length must equal observations times gridSize');
  }
  validateFinite(xKernel, 'xKernel');
  if (!webAssembly || !supportsKdeSeparableRowWasm(webAssembly)) {
    throw new Error('FP64 KDE separable-row WebAssembly kernel is unavailable');
  }

  const module = new webAssembly.Module(KDE_SEPARABLE_ROW_WASM_BYTES);
  const instance = new webAssembly.Instance(module, {});
  const exports = instance.exports as KdeSeparableRowWasmExports;
  const heapBase = Number(exports.__heap_base.value);
  if (!Number.isInteger(heapBase) || heapBase < 0) {
    throw new Error('WebAssembly heap base is invalid');
  }

  let pointer = align(heapBase, Float64Array.BYTES_PER_ELEMENT);
  const xKernelPointer = pointer;
  pointer += xKernel.byteLength;
  pointer = align(pointer, Float64Array.BYTES_PER_ELEMENT);
  const yWeightsPointer = pointer;
  pointer += observationCount * Float64Array.BYTES_PER_ELEMENT;
  pointer = align(pointer, Float64Array.BYTES_PER_ELEMENT);
  const outputPointer = pointer;
  pointer += columns * Float64Array.BYTES_PER_ELEMENT;

  ensureMemory(exports.memory, pointer);
  new Float64Array(exports.memory.buffer, xKernelPointer, xKernel.length).set(xKernel);

  return {
    get memoryBytes() {
      return exports.memory.buffer.byteLength;
    },
    accumulate(yWeights, output) {
      if (yWeights.length !== observationCount) {
        throw new RangeError('yWeights length must equal observations');
      }
      if (output.length !== columns) {
        throw new RangeError('output length must equal gridSize');
      }
      validateFinite(yWeights, 'yWeights');
      const yView = new Float64Array(
        exports.memory.buffer,
        yWeightsPointer,
        observationCount,
      );
      const outputView = new Float64Array(exports.memory.buffer, outputPointer, columns);
      yView.set(yWeights);
      outputView.fill(0);
      const status = exports.accumulate_row(
        xKernelPointer,
        yWeightsPointer,
        outputPointer,
        observationCount,
        columns,
      );
      if (status !== 0) {
        throw new Error(`WebAssembly KDE row kernel failed with status ${status}`);
      }
      output.set(outputView);
      validateFinite(output, 'WebAssembly KDE output');
    },
  };
}
