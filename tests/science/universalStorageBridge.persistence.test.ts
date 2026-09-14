import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialRecord } from '@/lib/adapters/types';
import { UniversalStorageBridge } from '@/lib/adapters/UniversalStorageBridge';

const LAB_KEY = 'resindb_pro_my_lab_data';
const OPEN_KEY = 'resindb_pro_open_market_data';

function record(overrides: Partial<MaterialRecord> = {}): MaterialRecord {
  return {
    id: 'lab-1', source: 'my_lab', category: 'PP', grade: 'PP-LAB-1',
    manufacturer: 'Synthetic storage regression',
    properties: { density: { value: 0.91, unit: 'g/cm³' } },
    timestamp: 0,
    ...overrides,
  };
}

// Synthetic records exercise persistence failures, not new laboratory measurements.
for (const source of ['my_lab', 'open_market'] as const) {
  describe(`${source} non-destructive persistence`, () => {
    const key = source === 'my_lab' ? LAB_KEY : OPEN_KEY;
    const read = () => source === 'my_lab'
      ? UniversalStorageBridge.getLabRecords()
      : UniversalStorageBridge.getOpenMarketRecords();
    const save = (item: MaterialRecord) => source === 'my_lab'
      ? UniversalStorageBridge.saveLabRecord(item)
      : UniversalStorageBridge.saveOpenMarketRecord(item);
    const original = () => record({ id: 'keep', grade: 'KEEP', source, properties: {
      density: { value: 910, unit: 'kg/m³' },
    } });
    const added = () => record({ id: 'new', grade: 'NEW', source });

    beforeEach(() => {
      localStorage.clear();
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it('returns governed views without rewriting the original stored declarations', () => {
      const raw = JSON.stringify([original()], null, 3);
      localStorage.setItem(key, raw);
      const write = vi.spyOn(Storage.prototype, 'setItem');
      expect(read()[0].properties.density?.canonical?.value).toBe(0.91);
      expect(localStorage.getItem(key)).toBe(raw);
      expect(write).not.toHaveBeenCalled();
    });

    it('keeps readable user data available when writes are unavailable', () => {
      localStorage.setItem(key, JSON.stringify([original()]));
      const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
      });
      expect(read().some((item) => item.id === 'keep')).toBe(true);
      expect(write).not.toHaveBeenCalled();
    });

    it('reads missing-key seed data without initializing storage', () => {
      const write = vi.spyOn(Storage.prototype, 'setItem');
      read();
      expect(localStorage.getItem(key)).toBeNull();
      expect(write).not.toHaveBeenCalled();
    });

    it.each([
      ['broken JSON', '{broken'],
      ['empty text', ''],
      ['unsupported root', '{}'],
      ['partially invalid collection', JSON.stringify([record({ id: 'keep' }), null])],
    ])('refuses to overwrite %s during a save', (_name, raw) => {
      localStorage.setItem(key, raw);
      const write = vi.spyOn(Storage.prototype, 'setItem');
      expect(() => save(added())).toThrow();
      expect(localStorage.getItem(key)).toBe(raw);
      expect(write).not.toHaveBeenCalled();
    });

    it('does not use display fallback after an underlying storage-read failure', () => {
      localStorage.setItem(key, JSON.stringify([original()]));
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Synthetic read failure', 'SecurityError');
      });
      const write = vi.spyOn(Storage.prototype, 'setItem');
      expect(() => save(added())).toThrow();
      expect(write).not.toHaveBeenCalled();
    });

    it('changes only the requested record instead of migrating the whole collection', () => {
      const keep = original();
      localStorage.setItem(key, JSON.stringify([keep]));
      const write = vi.spyOn(Storage.prototype, 'setItem');
      save(added());
      const persisted: MaterialRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
      expect(persisted.find((item) => item.id === 'keep')).toEqual(keep);
      expect(persisted.some((item) => item.id === 'new')).toBe(true);
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('reports a failed write without changing the stored source', () => {
      const raw = JSON.stringify([original()]);
      localStorage.setItem(key, raw);
      const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
      });
      expect(() => save(added())).toThrow();
      expect(localStorage.getItem(key)).toBe(raw);
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('never persists the display fallback or a silently shortened collection', () => {
      const raw = JSON.stringify([original(), null]);
      localStorage.setItem(key, raw);
      const write = vi.spyOn(Storage.prototype, 'setItem');
      read();
      expect(localStorage.getItem(key)).toBe(raw);
      expect(write).not.toHaveBeenCalled();
    });
  });
}

describe('laboratory deletion failure semantics', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('propagates a failed deletion and preserves the original record', () => {
    const raw = JSON.stringify([record()]);
    localStorage.setItem(LAB_KEY, raw);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
    });
    expect(() => UniversalStorageBridge.deleteLabRecord('lab-1')).toThrow();
    expect(localStorage.getItem(LAB_KEY)).toBe(raw);
  });

  it('refuses to delete from a corrupt collection rather than replacing it', () => {
    const raw = '{broken';
    localStorage.setItem(LAB_KEY, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(() => UniversalStorageBridge.deleteLabRecord('lab-1')).toThrow();
    expect(localStorage.getItem(LAB_KEY)).toBe(raw);
    expect(write).not.toHaveBeenCalled();
  });

  it('removes only the requested record and preserves unrelated raw values', () => {
    const keep = record({ id: 'keep', properties: { density: { value: 910, unit: 'kg/m³' } } });
    localStorage.setItem(LAB_KEY, JSON.stringify([record(), keep]));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    UniversalStorageBridge.deleteLabRecord('lab-1');
    expect(JSON.parse(localStorage.getItem(LAB_KEY) || '[]')).toEqual([keep]);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
