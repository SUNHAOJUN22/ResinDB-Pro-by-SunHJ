import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import {
  buildGovernedAiEnvelope,
  governedAiFetch,
  type AiAuditRecord,
} from '@/services/aiGovernance';

afterEach(() => vi.restoreAllMocks());

describe('immutable AI request bytes', () => {
  it('detaches nested caller-owned data', () => {
    const payload = { data: { density: 0.9 } };
    const envelope = buildGovernedAiEnvelope({
      model: 'test-model', purpose: 'material-summary', payload,
    });
    payload.data.density = 9;
    expect(envelope.payload).toEqual({ data: { density: 0.9 } });
  });

  it('audits exactly the body sent even when the caller mutates its input', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const payload: { data: Record<string, unknown> } = { data: { density: 0.9 } };
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}'));
    const pending = governedAiFetch({
      model: 'test-model', purpose: 'material-summary', payload, fetchImpl,
    });
    payload.data.manufacturer = 'SYNTHETIC_TEST_ONLY';
    payload.data.density = 9;
    await pending;
    expect(fetchImpl).toHaveBeenCalledOnce();
    const body = fetchImpl.mock.calls[0][1].body as string;
    const audit = info.mock.calls[0][1] as AiAuditRecord;
    const bytes = new TextEncoder().encode(body);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    expect(audit.payloadSha256).toBe(hex);
    expect(audit.payloadBytes).toBe(bytes.byteLength);
    expect(JSON.parse(body).payload).toEqual({ data: { density: 0.9 } });
    expect(body).not.toContain('SYNTHETIC_TEST_ONLY');
  });
});
