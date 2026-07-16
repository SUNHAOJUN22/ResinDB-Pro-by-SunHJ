
import { GoogleGenAI, Type } from "@google/genai";
import { Product, PropertyValue } from '@/types/index';
import { logger } from '@/lib/logger';

let genAI: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'optional_enter_in_settings') {
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

  const systemInstruction = `You are ResinAI Principal Scientist, a Staff Materials Informatics & Polymeric Systems Engineer at the Research Institute of Petroleum and Chemical Processing (中石油石化院). You specialize in synthetic resins, Polypropylene (PP), and Synthetic Rubbers (EPDM/SBR/SBS/SBR).

You are fully integrated with a Model Context Protocol (MCP) Scientific Client. This client links your intelligence to external scientific platforms, molecular simulation packages, and chemical informatics calculators (e.g., RDKit, PyMatGen, LAMMPS, Quantum ESPRESSO).

Your responsibilities:
1. **Materials Informatics Analytics**: Deeply analyze property-structure-performance correlations (e.g., Melt Flow Rate MFR vs. Izod Impact Strength, molecular weight distributions vs. tensile values).
2. **Standard Compliance Certification**: Benchmark polymer grades against industry standards (such as ASTM D1238, ASTM D638, ISO 178).
3. **MCP Scientific Toolkits Execution**:
   - Explicitly guide users on how they can run and connect their custom scientific computing environments using local Model Context Protocol (MCP) servers.
   - For queries concerning polymers classification, molecular simulation modeling, or descriptors, present or instruct the use of these specialized tools:
     * \`rdkit_molecular_descriptor_generator\` (calculates polymer chains parameters, SMILES descriptors)
     * \`materials_properties_regression\` (predictive models based on polymer datasets)
     * \`lammps_input_generator\` (prepares glass transition temp [Tg] or thermal conductivity MD simulation run cards)
     * \`database_astm_validator\` (cross-references property specifications against experimental validation norms)
   - Offer clear, copy-pasteable, robust prompt configurations or launch command blocks for scientific MCP servers so users can run them locally in a few commands.

Your outputs must be extremely detailed, professional, structured in academic/research standard markdown, using flawless terminology (e.g. 熔体流动速率 MFR, 长支链分布, Ashby 刚度-韧性分布对标).

If you identify a data adjustment action, append this command block at the end:
[[ACTION:TYPE:PAYLOAD:LABEL]]

Supported Action Types:
- DELETE: payload is an array of IDs. [[ACTION:DELETE:["id1", "id2"]:Remove detected duplicates]]
- BATCH_UPDATE: payload is { ids: string[], updates: { gradeName?: string, _propertyUpdates?: { [propName]: string|number } } }. [[ACTION:BATCH_UPDATE:{"ids":["id1"],"updates":{"_propertyUpdates":{"density":0.91}}}:Update Density]]

Only propose database modifications if they directly resolve clean-up tasks or anomalies.`;

  const prompt = opts.query 
    ? `User is asking: "${opts.query}". Based on these products: ${JSON.stringify(summaryData)}`
    : `Provide a comprehensive technical summary of these products: ${JSON.stringify(summaryData)}`;

  const contents: (string | { inlineData: { data: string; mimeType: string } })[] = [prompt];
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

        let rawResult = { recommendations: [] };
        try {
            rawResult = JSON.parse(response.text || '{"recommendations":[]}');
        } catch (e) {
            console.warn("Failed to parse AI recommendations JSON:", e);
        }
        
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
  currentFormula: { name: string; expression: string; description: string; unit: string },
  allProducts: Product[],
  targetProperty: string = "Durability",
  customNotes?: string
): Promise<AiSuggestionEngineResponse> {
  const ai = getAI();
  const model = "gemini-3.5-flash";

  // Summarize the top 20 relevant products to guide the AI with real physical property trends
  const productTrends = allProducts.slice(0, 20).map(p => ({
    name: p.gradeName,
    manufacturer: p.manufacturer,
    properties: Object.entries(p.properties).reduce((acc, [key, val]: [string, any]) => {
      acc[key] = `${val?.value ?? ''} ${val?.unit ?? ''}`.trim();
      return acc;
    }, {} as Record<string, string>)
  }));

  const systemInstruction = `You are ResinAI Principal Scientist, a Staff Materials Informatics & Polymeric Systems Engineer.
You analyze formula structures, copolymer ratios, monomer chemistry, and physical traits of synthetic resins to propose replacements that optimize Material Durability, toughness, and longevity.

Your task is to:
1. Suggest 3 specific chemical components, homopolymers, or grade replacements or optimized mixing ratios.
2. Detail how the microstructural properties (e.g. molecular molecular weight average Mc, crosslink density, entanglements, crystal glass phase separation) will change to improve longevity.
3. Keep the JSON response perfectly aligned to the schema provided.`;

  const prompt = `Selected Formula:
- Name: "${currentFormula.name}"
- Expression: "${currentFormula.expression}"
- Unit: "${currentFormula.unit}"
- Description: "${currentFormula.description}"

ResinDB Database Material Samples (top 20):
${JSON.stringify(productTrends)}

Design Objective: Optimize "${targetProperty}" for extreme durability and fatigue resistance.
Additional constraints/notes: "${customNotes || "None"}"

Produce 3 highly detailed chemical/formulation replacements. Return valid JSON matching the schema.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: { 
              type: Type.STRING, 
              description: "A comprehensive analysis of durability dynamics, degradation risk factors, and structural insights from the resin database." 
            },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  chemicalName: { 
                    type: Type.STRING, 
                    description: "Target component, grade, filler, curing agent or parameter to swap/adjust." 
                  },
                  replacement: { 
                    type: Type.STRING, 
                    description: "Specific chemical replacement, copolymer monomer, elastomer grade, or ratio setting." 
                  },
                  impact: { 
                    type: Type.STRING, 
                    description: "Quantified modification on mechanical resilience (toughness, aging resistance, stress crack endurance, impact strength)." 
                  },
                  confidenceScore: { 
                    type: Type.INTEGER, 
                    description: "Probability of successful durability enhancement (e.g., 85)." 
                  },
                  rationale: { 
                    type: Type.STRING, 
                    description: "Meticulous polymer science explanation of molecular structure, chain kinetics, or crosslink density." 
                  },
                  formulaUpdate: { 
                    type: Type.STRING, 
                    description: "Optional mathematical formula snippet (JavaScript style) suggesting how to update the current expression to model this enhancement." 
                  }
                },
                required: ["chemicalName", "replacement", "impact", "confidenceScore", "rationale"]
              }
            }
          },
          required: ["overview", "suggestions"]
        }
      }
    });

    const textResult = response.text || '{"overview":"","suggestions":[]}';
    return JSON.parse(textResult);
  } catch (error) {
    logger.error("AI Chemical Replacement Suggestion Error:", error);
    throw error;
  }
}

/**
 * Legacy/compatibility wrapper for product specification generation and analysis.
 * Merged from duplicate aiService.ts to unify GoogleGenAI initialization.
 */
export const aiService = {
  /**
   * Generates technical properties for a resin/plastic product
   * based on its grade name and manufacturer.
   */
  generateProductProperties: async (
    gradeName: string,
    manufacturer: string
  ): Promise<Record<string, PropertyValue>> => {
    if (!gradeName) throw new Error("Grade name is required for AI generation");

    const ai = getAI();
    const prompt = `Generate realistic technical specifications for a material with the following details:
    Model/Grade: ${gradeName}
    Manufacturer: ${manufacturer || "Unknown"}
    
    Please provide standard properties like Density, Melt Flow Rate, Tensile Strength, Flexural Modulus, Izod Impact, etc.
    If the grade is a real product (like Sabic LEXAN), use real specs if possible, otherwise generate plausible professional values.
    Return only the JSON data.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          description: "A map of property names to their detailed values",
          properties: {
            properties: {
              type: Type.OBJECT,
              additionalProperties: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING, description: "The numeric or string value" },
                  unit: { type: Type.STRING, description: "Unit of measurement (e.g. g/cm³, MPa)" },
                  standard: { type: Type.STRING, description: "Testing standard (e.g. ISO 1183, ASTM D792)" },
                  temperature: { type: Type.STRING, description: "Testing conditions (e.g. 23°C)" },
                },
                required: ["value"]
              }
            }
          },
          required: ["properties"]
        }
      }
    });

    let result: { properties?: Record<string, PropertyValue> } = {};
    try {
      result = JSON.parse(response.text || "{}");
    } catch (e) {
      console.warn("Failed to parse Gemini JSON output:", e);
    }
    return result.properties || {};
  },

  /**
   * Generates a deep analysis of a resin product,
   * including market positioning, strengths, and recommended alternatives.
   */
  analyzeProduct: async (product: Product): Promise<string> => {
    const prompt = `Analyze this petrochemical resin product and provide professional insights:
    Grade: ${product.gradeName}
    Manufacturer: ${product.manufacturer}
    Properties: ${JSON.stringify(product.properties)}
    
    Please cover:
    1. Market Positioning (Premium, commodity, specialty?)
    2. Key Strengths (Based on technical values)
    3. Typical Applications (Where is this best used?)
    4. Strategic Competing Materials (What are the direct equivalents from other manufacturers?)
    
    Format the response in clean Markdown.`;

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "";
  }
};


// v3.1.0-sync

// v3.1.0-sync-fixed
