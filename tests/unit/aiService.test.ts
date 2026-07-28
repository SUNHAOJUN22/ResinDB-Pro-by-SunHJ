import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types/index';
import {
  clearAiConfig,
  getAiConfig,
  getAiInsights,
  getChemicalReplacementSuggestions,
  getSmartRecommendations,
  saveAiConfig,
  testAiConnection,
} from '@/services/aiService';

function product(id: string): Product {
  return {
    id,
    gradeName: `PP-${id}`,
    manufacturerId: 'm-1',
    manufacturer: 'Maker',
    categoryIds: ['cat_pp'],
    properties: { Density: { value: 0.9 } },
    createdAt: '2026-07-28',
    updatedAt: '2026-07-28',
  };
}

function aiResponse(content: string, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('AI service trust boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    saveAiConfig({
      endpoint: 'https://ai.example.test/v1/chat/completions',
      apiKey: 'session-secret',
      model: 'model-1',
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('persists endpoint/model locally but keeps the API key session-only', () => {
    expect(JSON.parse(localStorage.getItem('resindb-ai-api-config') || '{}')).toEqual({
      endpoint: 'https://ai.example.test/v1/chat/completions',
      model: 'model-1',
    });
    expect(localStorage.getItem('resindb-ai-api-config')).not.toContain('session-secret');
    expect(sessionStorage.getItem('resindb-ai-api-session-key')).toBe('session-secret');
    expect(getAiConfig().apiKey).toBe('session-secret');
    clearAiConfig();
    expect(getAiConfig()).toMatchObject({ endpoint: '', apiKey: '', model: '' });
  });

  it('reports browser storage failures instead of crashing silently', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => saveAiConfig({ endpoint: 'https://x.test', apiKey: '', model: 'm' }))
      .toThrow(/blocked AI settings storage/);
    spy.mockRestore();
  });

  it('rejects insecure or credential-bearing endpoints before fetch', async () => {
    saveAiConfig({ endpoint: 'http://remote.example.test/v1', apiKey: '', model: 'm' });
    await expect(testAiConnection()).rejects.toThrow(/must use HTTPS/);
    saveAiConfig({ endpoint: 'https://user:pass@example.test/v1', apiKey: '', model: 'm' });
    await expect(testAiConnection()).rejects.toThrow(/Do not embed credentials/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects unsupported, malformed and oversized image input before fetch', async () => {
    await expect(getAiInsights([], {
      imagePart: { inlineData: { mimeType: 'image/gif', data: 'AAAA' } },
    })).rejects.toThrow(/JPEG, PNG, or WebP/);
    await expect(getAiInsights([], {
      imagePart: { inlineData: { mimeType: 'image/png', data: 'not base64!' } },
    })).rejects.toThrow(/valid Base64/);
    await expect(getAiInsights([], {
      imagePart: { inlineData: { mimeType: 'image/png', data: 'A'.repeat(12_000_004) } },
    })).rejects.toThrow(/too large/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an announced oversized response without consuming it', async () => {
    vi.mocked(fetch).mockResolvedValue(aiResponse('OK', { 'Content-Length': '100001' }));
    await expect(testAiConnection()).rejects.toThrow(/response is too large/);
  });

  it('filters recommendations to known candidate ids and valid shapes', async () => {
    vi.mocked(fetch).mockResolvedValue(aiResponse(JSON.stringify({ recommendations: [
      { id: 'p-2', reason: 'same category' },
      { id: 'outside', reason: 'invented id' },
      { id: 'p-3', reason: 42 },
    ] })));
    await expect(getSmartRecommendations(product('p-1'), [product('p-1'), product('p-2'), product('p-3')]))
      .resolves.toEqual({ recommendations: [{ id: 'p-2', reason: 'same category' }] });
  });

  it('normalizes malformed chemical suggestions and clamps confidence', async () => {
    vi.mocked(fetch).mockResolvedValue(aiResponse(JSON.stringify({
      overview: 'Hypotheses only',
      suggestions: [
        { chemicalName: 'A', replacement: 'B', impact: 'test', confidenceScore: 120, rationale: 'screening' },
        { chemicalName: 'bad' },
      ],
    })));
    await expect(getChemicalReplacementSuggestions(
      { name: 'f', expression: 'x', description: '', unit: '' },
      [product('p-1')],
    )).resolves.toEqual({
      overview: 'Hypotheses only',
      suggestions: [{
        chemicalName: 'A', replacement: 'B', impact: 'test', confidenceScore: 100, rationale: 'screening',
      }],
    });
  });
});
