import { Product, PropertyValue } from '@/types/index';
import { logger } from '@/lib/logger';

const PERSISTENT_STORAGE_KEY = 'resindb-ai-api-config';
const SESSION_KEY_STORAGE_KEY = 'resindb-ai-api-session-key';
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_CONTEXT_PRODUCTS = 20;
const MAX_RESPONSE_CHARS = 100_000;
const MAX_PROMPT_CHARS = 80_000;
const MAX_IMAGE_BASE64_CHARS = 12_000_000;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface AiApiConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface AiInsightOptions {
  query?: string;
  isDeepThinking?: boolean;
  imagePart?: { inlineData: { data: string; mimeType: string } };
}

export interface ChemicalSuggestion {
  chemicalName: string;
  replacement: string;
  impact: string;
  confidenceScore: number;
  rationale: string;
  formulaUpdate?: string;
}

export interface AiSuggestionEngineResponse {
  overview: string;
  suggestions: ChemicalSuggestion[];
}

interface RecommendationResponse {
  recommendations: Array<{ id: string; reason: string }>;
}

interface ChatRequestOptions {
  system: string;
  prompt: string;
  temperature?: number;
  imagePart?: AiInsightOptions['imagePart'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPersistentConfig(): Partial<AiApiConfig> {
  if (typeof window === 'undefined') return {};
  try {
    const value = window.localStorage.getItem(PERSISTENT_STORAGE_KEY);
    if (!value) return {};
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return {};
    return {
      endpoint: typeof parsed.endpoint === 'string' ? parsed.endpoint : undefined,
      model: typeof parsed.model === 'string' ? parsed.model : undefined,
    };
  } catch (error) {
    logger.warn('Unable to read persistent AI API configuration', error);
    return {};
  }
}

function readSessionApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(SESSION_KEY_STORAGE_KEY)?.trim() || '';
  } catch (error) {
    logger.warn('Unable to read the session AI API key', error);
    return '';
  }
}

export function getAiConfig(): AiApiConfig {
  const stored = readPersistentConfig();
  return {
    endpoint: stored.endpoint?.trim() || import.meta.env.VITE_AI_API_ENDPOINT?.trim() || '',
    apiKey: readSessionApiKey() || import.meta.env.VITE_AI_API_KEY?.trim() || '',
    model: stored.model?.trim() || import.meta.env.VITE_AI_MODEL?.trim() || '',
  };
}

export function saveAiConfig(config: AiApiConfig): void {
  if (typeof window === 'undefined') return;
  const endpoint = config.endpoint.trim();
  const model = config.model.trim();
  const apiKey = config.apiKey.trim();
  try {
    window.localStorage.setItem(PERSISTENT_STORAGE_KEY, JSON.stringify({ endpoint, model }));
    if (apiKey) {
      window.sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, apiKey);
    } else {
      window.sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
    }
  } catch (error) {
    logger.error('Unable to save AI API configuration in browser storage', error);
    throw new Error('This browser blocked AI settings storage. Allow site storage or use environment configuration.', { cause: error });
  }
}

export function clearAiConfig(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PERSISTENT_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
  } catch (error) {
    logger.error('Unable to clear AI API configuration from browser storage', error);
    throw new Error('This browser blocked clearing AI settings. Check site-storage permissions.', { cause: error });
  }
}

export function isAiConfigured(): boolean {
  const config = getAiConfig();
  return Boolean(config.endpoint && config.model);
}

function requireConfig(): AiApiConfig {
  const config = getAiConfig();
  if (!config.endpoint) {
    throw new Error('AI API endpoint is not configured. Open AI API Settings and enter the full chat-completions endpoint.');
  }
  if (!config.model) {
    throw new Error('AI model is not configured. Open AI API Settings and enter the model identifier required by your provider.');
  }

  let endpoint: URL;
  try {
    endpoint = new URL(config.endpoint);
  } catch {
    throw new Error('AI API endpoint must be a valid absolute URL.');
  }
  const localHost = endpoint.hostname === 'localhost' || endpoint.hostname === '127.0.0.1' || endpoint.hostname === '[::1]';
  if (endpoint.protocol !== 'https:' && !(localHost && endpoint.protocol === 'http:')) {
    throw new Error('AI API endpoint must use HTTPS. HTTP is allowed only for localhost development.');
  }
  if (endpoint.username || endpoint.password) {
    throw new Error('Do not embed credentials in the AI API endpoint URL.');
  }
  return { ...config, endpoint: endpoint.toString() };
}

function summarizeProducts(products: Product[], limit = MAX_CONTEXT_PRODUCTS) {
  return products.slice(0, limit).map((product) => ({
    id: product.id,
    name: product.gradeName,
    manufacturer: product.manufacturer,
    properties: Object.fromEntries(
      Object.entries(product.properties).map(([key, value]) => [
        key,
        `${value?.value ?? ''} ${value?.unit ?? ''}`.trim(),
      ]),
    ),
  }));
}

function stripMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseJson<T>(text: string, fallback: T, context: string): T {
  const cleaned = stripMarkdownFence(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    logger.warn(`Unable to parse ${context} JSON response`, error);
    return fallback;
  }
}


function normalizeImagePart(imagePart: NonNullable<AiInsightOptions['imagePart']>): NonNullable<AiInsightOptions['imagePart']> {
  const mimeType = imagePart.inlineData.mimeType.trim().toLowerCase();
  const data = imagePart.inlineData.data.trim();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error('AI image input must be JPEG, PNG, or WebP.');
  }
  if (data.length > MAX_IMAGE_BASE64_CHARS) {
    throw new Error('AI image input is too large. Reduce the image below approximately 9 MB.');
  }
  if (!data || data.length % 4 !== 0 || !/^[a-z0-9+/]+={0,2}$/i.test(data)) {
    throw new Error('AI image input is not valid Base64 data.');
  }
  return { inlineData: { mimeType, data } };
}

function isRecommendationItem(value: unknown): value is { id: string; reason: string } {
  return isRecord(value) && typeof value.id === 'string' && typeof value.reason === 'string';
}

function normalizeRecommendations(value: unknown): RecommendationResponse {
  if (!isRecord(value) || !Array.isArray(value.recommendations)) return { recommendations: [] };
  return { recommendations: value.recommendations.filter(isRecommendationItem) };
}

function isChemicalSuggestion(value: unknown): value is ChemicalSuggestion {
  return (
    isRecord(value) &&
    typeof value.chemicalName === 'string' &&
    typeof value.replacement === 'string' &&
    typeof value.impact === 'string' &&
    typeof value.rationale === 'string' &&
    (typeof value.confidenceScore === 'number' || typeof value.confidenceScore === 'string') &&
    (value.formulaUpdate === undefined || typeof value.formulaUpdate === 'string')
  );
}

function normalizeChemicalSuggestions(value: unknown): AiSuggestionEngineResponse {
  if (!isRecord(value)) return { overview: '', suggestions: [] };
  const overview = typeof value.overview === 'string' ? value.overview : '';
  const suggestions = Array.isArray(value.suggestions)
    ? value.suggestions.filter(isChemicalSuggestion).slice(0, 3).map((suggestion) => ({
        ...suggestion,
        confidenceScore: Math.max(0, Math.min(100, Number(suggestion.confidenceScore) || 0)),
      }))
    : [];
  return { overview, suggestions };
}

function extractResponseText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as Record<string, unknown>;

  const choices = data.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    const message = first.message as Record<string, unknown> | undefined;
    const content = message?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (!item || typeof item !== 'object') return '';
          const record = item as Record<string, unknown>;
          return typeof record.text === 'string' ? record.text : '';
        })
        .filter(Boolean)
        .join('\n');
    }
    if (typeof first.text === 'string') return first.text;
  }

  if (typeof data.output_text === 'string') return data.output_text;
  if (typeof data.text === 'string') return data.text;
  if (typeof data.response === 'string') return data.response;
  return '';
}

async function requestChat(options: ChatRequestOptions): Promise<string> {
  const config = requireConfig();
  const imagePart = options.imagePart ? normalizeImagePart(options.imagePart) : undefined;
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const userContent: string | Array<Record<string, unknown>> = imagePart
    ? [
        { type: 'text', text: options.prompt },
        {
          type: 'image_url',
          image_url: {
            url: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
          },
        },
      ]
    : options.prompt;

  const promptLength = options.system.length + options.prompt.length;
  if (promptLength > MAX_PROMPT_CHARS) {
    throw new Error('AI request context is too large. Reduce the selected data or shorten the question.');
  }

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        temperature: options.temperature ?? 0.3,
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: userContent },
        ],
      }),
      signal: controller.signal,
    });

    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_CHARS) {
      throw new Error('AI API response is too large to process safely.');
    }
    const responseText = await response.text();
    if (responseText.length > MAX_RESPONSE_CHARS) {
      throw new Error('AI API response is too large to process safely.');
    }
    const raw = responseText;
    if (!response.ok) {
      throw new Error(`AI API request failed (${response.status}): ${raw.slice(0, 500) || response.statusText}`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return raw;
    }

    const text = extractResponseText(payload);
    if (!text) throw new Error('AI API returned no readable text content.');
    return text;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`AI API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`, { cause: error });
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

const MATERIALS_SYSTEM_PROMPT = `You are a materials-informatics assistant for synthetic-resin research.
Analyze only the data supplied by the application. Clearly separate observations, calculations, and hypotheses.
Never claim regulatory, ASTM, ISO, manufacturer, or product-specification certification.
Do not invent laboratory measurements, completed simulations, external-tool execution, or database facts.
When evidence is insufficient, state what data are missing and recommend a validation experiment.
Database-changing actions are suggestions only and require explicit user confirmation.`;

export async function testAiConnection(): Promise<string> {
  return requestChat({
    system: 'You are a connectivity test. Reply with exactly: OK',
    prompt: 'Return OK.',
    temperature: 0,
  });
}

export async function getAiInsights(
  products: Product[],
  options: AiInsightOptions | string,
): Promise<string> {
  const opts = typeof options === 'string' ? { query: options } : options;
  const summaryData = summarizeProducts(products, 10);
  const prompt = opts.query
    ? `Question: ${opts.query}\n\nAvailable product data:\n${JSON.stringify(summaryData)}`
    : `Provide a concise technical summary of the available product data:\n${JSON.stringify(summaryData)}`;

  return requestChat({
    system: MATERIALS_SYSTEM_PROMPT,
    prompt,
    temperature: opts.isDeepThinking ? 0.25 : 0.35,
    imagePart: opts.imagePart,
  });
}

export async function getSmartRecommendations(
  currentProduct: Product,
  allProducts: Product[],
): Promise<RecommendationResponse> {
  const candidates = allProducts
    .filter((product) => product.id !== currentProduct.id)
    .slice(0, MAX_CONTEXT_PRODUCTS);
  if (candidates.length === 0) return { recommendations: [] };

  try {
    const text = await requestChat({
      system: `${MATERIALS_SYSTEM_PROMPT}\nReturn only valid JSON with the shape {"recommendations":[{"id":"...","reason":"..."}]}.`,
      prompt: `Select at most three technically relevant alternatives. Use only candidate IDs from the supplied data.\nTarget: ${JSON.stringify(summarizeProducts([currentProduct], 1)[0])}\nCandidates: ${JSON.stringify(summarizeProducts(candidates))}`,
      temperature: 0.2,
    });
    const parsed = normalizeRecommendations(parseJson<unknown>(text, {}, 'recommendations'));
    const candidateIds = new Set(candidates.map((product) => product.id));
    return {
      recommendations: parsed.recommendations
        .filter((item) => candidateIds.has(item.id) && typeof item.reason === 'string' && item.reason.trim())
        .slice(0, 3),
    };
  } catch (error) {
    logger.error('AI recommendation request failed', error);
    return { recommendations: [] };
  }
}

export async function getChemicalReplacementSuggestions(
  currentFormula: { name: string; expression: string; description: string; unit: string },
  allProducts: Product[],
  targetProperty = 'Durability',
  customNotes?: string,
): Promise<AiSuggestionEngineResponse> {
  const text = await requestChat({
    system: `${MATERIALS_SYSTEM_PROMPT}\nReturn only valid JSON with keys overview and suggestions. Each suggestion must include chemicalName, replacement, impact, confidenceScore, rationale, and optional formulaUpdate.`,
    prompt: `Propose up to three testable formulation hypotheses. Do not present predicted improvements as measured facts.\nSelected formula: ${JSON.stringify(currentFormula)}\nTarget property: ${targetProperty}\nConstraints: ${customNotes || 'None supplied'}\nReference database samples: ${JSON.stringify(summarizeProducts(allProducts))}`,
    temperature: 0.3,
  });

  return normalizeChemicalSuggestions(
    parseJson<unknown>(text, {}, 'chemical suggestions'),
  );
}

function normalizeGeneratedProperties(value: unknown): Record<string, PropertyValue> {
  if (!isRecord(value)) return {};
  const result: Record<string, PropertyValue> = {};
  for (const [key, property] of Object.entries(value)) {
    if (!key.trim() || !isRecord(property)) continue;
    if (typeof property.value !== 'string' && !(typeof property.value === 'number' && Number.isFinite(property.value))) continue;
    result[key] = {
      value: property.value,
      ...(typeof property.unit === 'string' ? { unit: property.unit } : {}),
      ...(typeof property.standard === 'string' ? { standard: property.standard } : {}),
      ...(typeof property.temperature === 'string' ? { temperature: property.temperature } : {}),
    };
  }
  return result;
}

export const aiService = {
  generateProductProperties: async (
    gradeName: string,
    manufacturer: string,
  ): Promise<Record<string, PropertyValue>> => {
    if (!gradeName.trim()) throw new Error('Grade name is required for AI generation');

    const text = await requestChat({
      system: `${MATERIALS_SYSTEM_PROMPT}\nReturn only valid JSON with the shape {"properties":{"Property":{"value":"...","unit":"...","standard":"...","temperature":"..."}}}.`,
      prompt: `Create a clearly labelled AI-estimated property draft. Do not claim values are official specifications or certified results.\nGrade: ${gradeName}\nManufacturer: ${manufacturer || 'Unknown'}`,
      temperature: 0.25,
    });
    const result = parseJson<{ properties?: Record<string, PropertyValue> }>(
      text,
      {},
      'generated properties',
    );
    return normalizeGeneratedProperties(result.properties);
  },

  analyzeProduct: async (product: Product): Promise<string> =>
    requestChat({
      system: MATERIALS_SYSTEM_PROMPT,
      prompt: `Analyze this resin record using only supplied fields. Separate observations from hypotheses and identify missing validation data.\nProduct: ${JSON.stringify(summarizeProducts([product], 1)[0])}`,
      temperature: 0.3,
    }),
};
