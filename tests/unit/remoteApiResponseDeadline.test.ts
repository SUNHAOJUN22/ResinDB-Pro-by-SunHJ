// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemoteAPIProductAdapter } from '@/lib/adapters/RemoteAPIProductAdapter';
import type { Product } from '@/types/index';

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const realFetch = globalThis.fetch;
const product: Product = {
  id: 'deadline-product', gradeName: 'Reference grade', manufacturerId: 'maker',
  manufacturer: 'Reference maker', categoryIds: [], properties: {},
  createdAt: '2026-11-21', updatedAt: '2026-11-21',
};

const cases = [
  { name: 'authoritative read', body: JSON.stringify([product]), expected: [product], run: (adapter: RemoteAPIProductAdapter) => adapter.readAuthoritative() },
  { name: 'create', body: JSON.stringify(product), expected: product, run: (adapter: RemoteAPIProductAdapter) => adapter.create(product) },
  { name: 'update', body: JSON.stringify(product), expected: product, run: (adapter: RemoteAPIProductAdapter) => adapter.update(product) },
  { name: 'batch create', body: JSON.stringify([product]), expected: [product], run: (adapter: RemoteAPIProductAdapter) => adapter.batchCreate([product]) },
  { name: 'report export', body: 'grade,value\nreference,42\n', expected: 'grade,value\nreference,42\n', run: async (adapter: RemoteAPIProductAdapter) => (await adapter.exportReport([product], 'csv')).text() },
];

let server: Server | undefined;

async function startServer(body: string, stalled: boolean): Promise<string> {
  server = createServer((request, response) => {
    request.resume();
    response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    response.write(body.slice(0, 1));
    if (!stalled) response.end(body.slice(1));
  });
  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject);
    server!.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (server) {
    const active = server;
    server = undefined;
    const closed = new Promise<void>((resolve, reject) => active.close(error => error ? reject(error) : resolve()));
    active.closeAllConnections();
    await closed;
  }
});

describe('Remote API deadlines cover response bodies', () => {
  it.each(cases)('times out a stalled $name body after real HTTP headers arrive', async ({ body, run }) => {
    const base = await startServer(body, true);
    let headersArrived!: () => void;
    const headers = new Promise<void>(resolve => { headersArrived = resolve; });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args) => {
      const response = await realFetch(...args);
      headersArrived();
      return response;
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const outcome = run(new RemoteAPIProductAdapter(base, false)).then(
      value => ({ state: 'resolved' as const, value }),
      error => ({ state: 'rejected' as const, error }),
    );
    await headers;
    await nextTurn();
    await vi.advanceTimersByTimeAsync(15_000);
    let guard: ReturnType<typeof realSetTimeout> | undefined;
    try {
      const settled = await Promise.race([
        outcome,
        new Promise<{ state: 'still-pending' }>(resolve => {
          guard = realSetTimeout(() => resolve({ state: 'still-pending' }), 250);
        }),
      ]);
      expect(settled.state).toBe('rejected');
      if (settled.state === 'rejected') {
        expect(settled.error).toBeInstanceOf(Error);
        expect(settled.error.message).toMatch(/timed out after 15000 ms/);
      }
    } finally {
      if (guard !== undefined) realClearTimeout(guard);
    }
  });

  it.each(cases)('preserves a complete $name response', async ({ body, expected, run }) => {
    const base = await startServer(body, false);
    await expect(run(new RemoteAPIProductAdapter(base, false))).resolves.toEqual(expected);
  });
});
