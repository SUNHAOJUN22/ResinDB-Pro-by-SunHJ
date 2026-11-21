import { setImmediate as nextTurn } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { ComputeAbortError, createComputeEngine } from '@/compute';

async function withoutLateRejections(action: () => Promise<void>): Promise<void> {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    await action();
    await nextTurn();
    await nextTurn();
    expect(unhandled).toEqual([]);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}

describe('compute cancellation during synchronous kernel startup', () => {
  it('contains the backend rejection when a kernel aborts before returning', async () => {
    await withoutLateRejections(async () => {
      const controller = new AbortController();
      const engine = createComputeEngine().register<number, number>({
        id: 'cancel-before-return',
        version: '1.0.0',
        execute: (value) => {
          controller.abort('cancelled during startup');
          return value;
        },
      });

      await expect(engine.run({
        kernel: 'cancel-before-return', input: 7, signal: controller.signal,
      })).rejects.toBeInstanceOf(ComputeAbortError);
    });
  });

  it('contains a later kernel rejection after cancellation during startup', async () => {
    await withoutLateRejections(async () => {
      const controller = new AbortController();
      const engine = createComputeEngine().register<void, number>({
        id: 'cancel-before-reject',
        version: '1.0.0',
        execute: async () => {
          controller.abort('cancelled during startup');
          await nextTurn();
          throw new Error('kernel cleanup failed');
        },
      });

      await expect(engine.run({
        kernel: 'cancel-before-reject', input: undefined, signal: controller.signal,
      })).rejects.toBeInstanceOf(ComputeAbortError);
    });
  });

  it('preserves an ordinary kernel rejection when no cancellation occurs', async () => {
    await withoutLateRejections(async () => {
      const failure = new Error('ordinary kernel failure');
      const engine = createComputeEngine().register<void, number>({
        id: 'ordinary-rejection',
        version: '1.0.0',
        execute: async () => { throw failure; },
      });
      await expect(engine.run({ kernel: 'ordinary-rejection', input: undefined }))
        .rejects.toBe(failure);
    });
  });

  it('preserves successful kernel output and evidence without cancellation', async () => {
    await withoutLateRejections(async () => {
      const engine = createComputeEngine().register<number, number>({
        id: 'ordinary-success', version: '1.0.0', execute: (value) => value * 2,
      });
      const result = await engine.run<number, number>({ kernel: 'ordinary-success', input: 7 });
      expect(result.output).toBe(14);
      expect(result.evidence.kernel).toBe('ordinary-success');
    });
  });
});
