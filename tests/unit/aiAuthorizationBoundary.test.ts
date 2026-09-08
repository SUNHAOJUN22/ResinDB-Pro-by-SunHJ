import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  governedAiFetch,
  validateAiAuthorization,
  type AiAuthorization,
  type AiPurpose,
} from '@/services/aiGovernance';

const authorization: AiAuthorization = {
  requestId: '123e4567-e89b-42d3-a456-426614174000',
  purpose: 'connectivity',
  authorizedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-01T00:01:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('AI authorization runtime boundaries', () => {
  it('rejects invalid clocks', () => {
    expect(() => validateAiAuthorization(authorization, new Date(NaN))).toThrow(/clock/);
  });

  it('rejects unsupported runtime purposes', () => {
    const unsupported = { ...authorization, purpose: 'unapproved' as AiPurpose };
    expect(() => validateAiAuthorization(unsupported, new Date('2026-01-01T00:00:30Z')))
      .toThrow(/purpose/);
  });

  it('does not transmit when authorization expires during hashing', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:30Z'));
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(async () => {
      vi.setSystemTime(new Date(authorization.expiresAt));
      return new ArrayBuffer(32);
    });
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(governedAiFetch({
      model: 'test-model',
      purpose: 'connectivity',
      payload: { probe: true },
      authorization,
      fetchImpl,
    })).rejects.toThrow(/expired/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
