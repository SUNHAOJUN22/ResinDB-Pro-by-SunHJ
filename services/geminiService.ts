
import { GoogleGenAI, Type } from "@google/genai";
import { Product } from "../types";
import { logger } from '../lib/logger';

let genAI: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please configure it in settings.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export interface AiInsightOptions {
  query?: string;
  isDeepThinking?: boolean;
  imagePart?: { inlineData: { data: string; mimeType: string } };
}

export async function getAiInsights(products: Product[], options: AiInsightOptions | string) {
  const opts = typeof options === 'string' ? { query: options } : options;
  const ai = getAI();
  // Image analysis usually works better with the pro model, and deep thinking requires it.
  const model = opts.isDeepThinking || opts.imagePart ? "gemini-3-pro-preview" : "gemini-3-flash-preview";
  
  // Format data for AI
  const summaryData = products.slice(0, 10).map(p => ({
    name: p.gradeName,
    manufacturer: p.manufacturer,
    properties: Object.entries(p.properties).reduce((acc, [key, val]: [string, unknown]) => {
      const v = val as { value?: string | number; unit?: string };
      acc[key] = `${v?.value ?? ''} ${v?.unit ?? ''}`.trim();
      return acc;
    }, {} as Record<string, string>)
  }));

  const systemInstruction = `You are an expert scientist specializing in polymer materials, specifically Polypropylene (PP) and Synthetic Rubber (EPDM/SBR).
Your task is to analyze the provided resin database records and provide technical insights.
Focus on:
1. Performance correlations (e.g., MFR vs. Impact Strength).
2. Material suitability for specific applications (e.g., automotive bumpers, thin-wall packaging).
3. Competitive comparison between manufacturers.
4. Identification of "Outlier" or "Star" products with exceptional property combinations.

Output should be in high-quality markdown. Use professional terminology. If query is provided, focus on that.

If you identify a necessary action (e.g., deleting duplicates, fixing data, or batch updates), you can append a command at the end of your response using this EXACT format:
[[ACTION:TYPE:PAYLOAD:LABEL]]

Supported Types:
- DELETE: payload is an array of IDs. [[ACTION:DELETE:["id1", "id2"]:Remove detected duplicates]]
- BATCH_UPDATE: payload is { ids: string[], updates: { gradeName?: string, _propertyUpdates?: { [propName]: string|number } } }. [[ACTION:BATCH_UPDATE:{"ids":["id1"],"updates":{"_propertyUpdates":{"density":0.91}}}:Update Density]]

Only suggest an action if it directly helps the user based on their query or clear data anomalies.`;

  const prompt = opts.query 
    ? `User is asking: "${opts.query}". Based on these products: ${JSON.stringify(summaryData)}`
    : `Provide a comprehensive technical summary of these products: ${JSON.stringify(summaryData)}`;

  const contents: unknown[] = [prompt];
  if (opts.imagePart) {
    contents.push(opts.imagePart);
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text;
  } catch (error) {
    logger.error("AI Insight Error:", error);
    throw error;
  }
}

export async function getSmartRecommendations(currentProduct: Product, allProducts: Product[]) {
    const ai = getAI();
    // Similar to similarity engine but using AI reasoning
    // We'll use a simpler prompt to keep it fast
    const model = "gemini-3-flash-preview";
    
    const context = {
        target: { name: currentProduct.gradeName, properties: currentProduct.properties },
        candidates: allProducts.filter(p => p.id !== currentProduct.id).slice(0, 20).map(p => ({
            id: p.id,
            name: p.gradeName,
            manufacturer: p.manufacturer,
            properties: p.properties
        }))
    };

    const prompt = `Based on the target material, identify the 3 most relevant alternatives from the candidates.
    Explain WHY they are relevant in 1 short sentence each.
    Return JSON format: { recommendations: [{ id: string, reason: string }] }
    
    Context: ${JSON.stringify(context)}`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        recommendations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    reason: { type: Type.STRING }
                                },
                                required: ["id", "reason"]
                            }
                        }
                    },
                    required: ["recommendations"]
                }
            }
        });

        const rawResult = JSON.parse(response.text || '{"recommendations":[]}');
        
        // Reliability check: Ensure the returned recommendations have valid IDs that exist in our context
        const candidateIds = new Set(context.candidates.map(p => p.id));
        const validatedRecommendations = (rawResult.recommendations || [])
            .filter((rec: { id: string }) => candidateIds.has(rec.id))
            .slice(0, 3); // Cap at 3 as per prompt

        return { recommendations: validatedRecommendations };
    } catch (error) {
        logger.error("AI Recommendation Error:", error);
        return { recommendations: [] };
    }
}
