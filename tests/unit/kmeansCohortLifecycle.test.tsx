import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKMeansWorker } from '@/hooks/workers/useKMeansWorker';
import { kmeansBackendProfileStore } from '@/compute/kmeansBackendProfileStore';
import { clearKMeansWorkloadSnapshot, getKMeansWorkloadSnapshot } from '@/compute/kmeansWorkloadStore';
const manager = vi.hoisted(() => ({ isCalculating: false, result: null, setResult: vi.fn(), postMessage: vi.fn(), cancel: vi.fn() }));
vi.mock('@/hooks/workers/useWorkerManager', () => ({ useWorkerManager: () => manager }));
const missing = { status: 'missing' as const, profile: null, environment: null, reason: null, savedAt: null, migration: null, migrationHistory: [] };
beforeEach(() => { vi.clearAllMocks(); clearKMeansWorkloadSnapshot(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); clearKMeansWorkloadSnapshot(); });
describe('K-Means cohort lifecycle', () => {
  it('records the real selected cohort and clears workload when inputs clear', async () => {
    vi.spyOn(kmeansBackendProfileStore, 'load').mockResolvedValue(missing);
    const { result } = renderHook(useKMeansWorker);
    await act(async () => result.current.computeKMeans([{ id: 'a', values: { x: 1, y: 2 } }, { id: 'b', values: { x: 3, y: 4 } }], ['x', 'y']));
    expect(getKMeansWorkloadSnapshot()).toMatchObject({ sampleCount: 2, dimensions: 2, maxClusters: 1 });
    expect(manager.postMessage).toHaveBeenCalledTimes(1);
    await act(async () => result.current.computeKMeans([], []));
    expect(manager.cancel).toHaveBeenCalled();
    expect(getKMeansWorkloadSnapshot()).toBeNull();
  });
  it('does not submit stale work after asynchronous profile loading and a clear', async () => {
    let resolveProfile!: (value: typeof missing) => void;
    vi.spyOn(kmeansBackendProfileStore, 'load').mockImplementation(() => new Promise(resolve => { resolveProfile = resolve; }));
    const { result } = renderHook(useKMeansWorker);
    let pending!: Promise<void>;
    act(() => { pending = result.current.computeKMeans([{ id: 'old', values: { x: 1 } }], ['x']); });
    await act(async () => { await result.current.computeKMeans([], []); resolveProfile(missing); await pending; });
    expect(manager.postMessage).not.toHaveBeenCalled();
    expect(getKMeansWorkloadSnapshot()).toBeNull();
  });
});
