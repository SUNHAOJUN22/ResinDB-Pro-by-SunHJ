import { describe, expect, it, vi } from 'vitest';
import { uiSmokeNetwork } from '../../scripts/lib/ui-smoke-network.mjs';

describe('UI smoke network fallback', () => {
  it('binds Vite to loopback when the system cannot enumerate interfaces', () => {
    const warn = vi.fn();
    const network = uiSmokeNetwork(4174, {
      uiHost: '',
      getInterfaces: () => { throw new Error('interfaces unavailable'); },
      warn,
    });
    expect(network.host).toBe('127.0.0.1');
    expect(network.healthUrl).toBe('http://127.0.0.1:4174');
    expect(network.appUrlCandidates).toEqual(['http://127.0.0.1:4174', 'http://localhost:4174']);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('retains external IPv4 candidates when interface discovery is available', () => {
    const network = uiSmokeNetwork(4175, {
      uiHost: '',
      getInterfaces: () => ({
        lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
        eth0: [
          { family: 'IPv4', internal: false, address: '192.0.2.10' },
          { family: 'IPv6', internal: false, address: '2001:db8::1' },
        ],
      }),
    });
    expect(network.host).toBe('0.0.0.0');
    expect(network.appUrlCandidates).toEqual([
      'http://127.0.0.1:4175', 'http://localhost:4175', 'http://192.0.2.10:4175',
    ]);
  });

  it('deduplicates an explicit host while preserving its priority', () => {
    const network = uiSmokeNetwork(4176, { uiHost: 'localhost', getInterfaces: () => ({}) });
    expect(network.appUrlCandidates).toEqual(['http://localhost:4176', 'http://127.0.0.1:4176']);
  });

  it.each([0, 65536, 1.5, Number.NaN])('rejects an invalid preview port %s', previewPort => {
    expect(() => uiSmokeNetwork(previewPort, { getInterfaces: () => ({}) })).toThrow(RangeError);
  });
});
