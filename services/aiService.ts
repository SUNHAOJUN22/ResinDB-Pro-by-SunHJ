import { GoogleGenAI, Type } from "@google/genai";
import { PropertyValue, Product } from "../types";

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

    const result = JSON.parse(response.text || "{}");
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

    return response.text;
  }
};
