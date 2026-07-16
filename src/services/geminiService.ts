import { GoogleGenAI, Type } from '@google/genai';
import { Product, PropertyValue } from '@/types/index';
import { logger } from '@/lib/logger';

const FAST_MODEL = import.meta.env.VITE_GEMINI_FAST_MODEL || 'gemini-3.5-flash';
const REASONING_MODEL =
  import.meta.env.VITE_GEMINI_REASONING_MODEL || 'gemini-3.1-pro-preview';
const MAX_CONTEXT_PRODUCTS = 20;

let genAI: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (genAI) return genAI;

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'optional_enter_in_settings') {
    throw new Error(
      'Gemini is not configured. Set VITE_GEMINI_API_KEY for local demonstration, or use a server-side proxy in production.',
    );
  }

  genAI = new GoogleGenAI({ apiKey });
  return genAI;
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

function parseJson<T>(text: string | undefined, fallback: T, context: string): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    logger.warn(`Unable to parse ${context} JSON response`, error);
    return fallback;
  }
}

export interface AiInsightOptions {
  query?: string;
  isDeepThinking?: boolean;
  imagePart?: { inlineData: { data: string; mimeType: string } };
}

export async function getAiInsights(
  products: Product[],
  options: AiInsightOptions | string,
): Promise<string> {
  const opts = typeof options === 'string' ? { query: options } : options;
  const ai = getAI();
  const model = opts.isDeepThinking || opts.imagePart ? REASONING_MODEL : FAST_MODEL;
  const summaryData = summarizeProducts(products, 10);

  const systemInstruction = `You are a materials-informatics assistant for synthetic-resin research.
Analyze only the data supplied by the application. Clearly separate observations, calculations, and hypotheses.
Never claim regulatory, ASTM, ISO, or product-specification certification. Standards may be discussed only as validation references.
Do not invent laboratory measurements, manufacturer specifications, MCP connections, or completed simulations.
When evidence is insufficient, state the missing fields and recommend a validation experiment.
Database-changing actions are suggestions only and require explicit user confirmation.

Optional action syntax:
[[ACTION:DELETE:["id1"]:Remove confirmed duplicate]]
[[ACTION:BATCH_UPDATE:{"ids":["id1"],"updates":{"_propertyUpdates":{"density":0.91}}}:Apply reviewed correction]]`;

  const prompt = opts.query
    ? `Question: ${opts.query}\n\nAvailable product data:\n${JSON.stringify(summaryData)}`
    : `Provide a concise technical summary of the available product data:\n${JSON.stringify(summaryData)}`;

  const contents: Array<
    string | { inlineData: { data: string; mimeType: string } }
  > = [prompt];
  if (opts.imagePart) contents.push(opts.imagePart);

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.35,
      },
    });
    return response.text || '';
  } catch (error) {
    logger.error('AI insight request failed', error);
    throw error;
  }
}

interface RecommendationResponse {
  recommendations: Array<{ id: string; reason: string }>;
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
    const response = await getAI().models.generateContent({
      model: FAST_MODEL,
      contents: `Select at most three technically relevant alternatives to the target material.
Use only candidate IDs from the supplied data. Explain the property-based rationale in one sentence.
Target: ${JSON.stringify(summarizeProducts([currentProduct], 1)[0])}
Candidates: ${JSON.stringify(summarizeProducts(candidates))}`,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['id', 'reason'],
              },
            },
          },
          required: ['recommendations'],
        },
      },
    });

    const parsed = parseJson<RecommendationResponse>(
      response.text,
      { recommendations: [] },
      'recommendations',
    );
    const candidateIds = new Set(candidates.map((product) => product.id));
    return {
      recommendations: parsed.recommendations
        .filter(
          (item) =>
            candidateIds.has(item.id) &&
            typeof item.reason === 'string' &&
            item.reason.trim().length > 0,
        )
        .slice(0, 3),
    };
  } catch (error) {
    logger.error('AI recommendation request failed', error);
    return { recommendations: [] };
  }
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

export async function getChemicalReplacementSuggestions(
  currentFormula: {
    name: string;
    expression: string;
    description: string;
    unit: string;
  },
  allProducts: Product[],
  targetProperty = 'Durability',
  customNotes?: string,
): Promise<AiSuggestionEngineResponse> {
  const response = await getAI().models.generateContent({
    model: REASONING_MODEL,
    contents: `Propose up to three testable formulation hypotheses for the selected formula.
Do not present predicted improvements as measured facts. Include mechanisms, trade-offs, and required validation tests.
Selected formula: ${JSON.stringify(currentFormula)}
Target property: ${targetProperty}
Constraints: ${customNotes || 'None supplied'}
Reference database samples: ${JSON.stringify(summarizeProducts(allProducts))}`,
    config: {
      temperature: 0.35,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overview: { type: Type.STRING },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                chemicalName: { type: Type.STRING },
                replacement: { type: Type.STRING },
                impact: { type: Type.STRING },
                confidenceScore: { type: Type.INTEGER },
                rationale: { type: Type.STRING },
                formulaUpdate: { type: Type.STRING },
              },
              required: [
                'chemicalName',
                'replacement',
                'impact',
                'confidenceScore',
                'rationale',
              ],
            },
          },
        },
        required: ['overview', 'suggestions'],
      },
    },
  });

  const parsed = parseJson<AiSuggestionEngineResponse>(
    response.text,
    { overview: '', suggestions: [] },
    'chemical suggestions',
  );

  return {
    overview: parsed.overview,
    suggestions: parsed.suggestions.slice(0, 3).map((suggestion) => ({
      ...suggestion,
      confidenceScore: Math.max(0, Math.min(100, Number(suggestion.confidenceScore) || 0)),
    })),
  };
}

export const aiService = {
  generateProductProperties: async (
    gradeName: string,
    manufacturer: string,
  ): Promise<Record<string, PropertyValue>> => {
    if (!gradeName.trim()) {
      throw new Error('Grade name is required for AI generation');
    }

    const response = await getAI().models.generateContent({
      model: FAST_MODEL,
      contents: `Create a clearly labelled AI-estimated property draft for a resin material.
Do not claim the values are official manufacturer specifications or certified test results.
Grade: ${gradeName}
Manufacturer: ${manufacturer || 'Unknown'}
Return common polymer properties with value, unit, test-condition note, and standard only when appropriate.`,
      config: {
        temperature: 0.25,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            properties: {
              type: Type.OBJECT,
              additionalProperties: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  unit: { type: Type.STRING },
                  standard: { type: Type.STRING },
                  temperature: { type: Type.STRING },
                },
                required: ['value'],
              },
            },
          },
          required: ['properties'],
        },
      },
    });

    const result = parseJson<{ properties?: Record<string, PropertyValue> }>(
      response.text,
      {},
      'generated properties',
    );
    return result.properties || {};
  },

  analyzeProduct: async (product: Product): Promise<string> => {
    const response = await getAI().models.generateContent({
      model: FAST_MODEL,
      contents: `Analyze this resin record using only supplied fields.
Separate observed properties from hypotheses, identify missing validation data, and avoid unsupported market or competitor claims.
Product: ${JSON.stringify(summarizeProducts([product], 1)[0])}`,
      config: { temperature: 0.3 },
    });
    return response.text || '';
  },
};
