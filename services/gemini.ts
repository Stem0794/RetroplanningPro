import { GoogleGenAI, Type } from "@google/genai";
import { Phase, PhaseType } from "../types";

export const generatePlanFromDescription = async (description: string, startDate: string): Promise<Omit<Phase, 'id'>[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemPrompt = `
    You are an expert Project Manager. Create a retroplanning (Gantt chart phases) based on the user's project description.
    The start date of the project is ${startDate}.
    Return a list of phases.
    The allowed Phase Types are: CONCEPTION, DEVELOPMENT, TESTS, PUSH_TO_PROD, OTHER.
    Estimate reasonable duration for each phase.
    Ensure phases are sequential where logical, but can overlap if typical (e.g., Development and Tests).
    Return strict JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: description,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the task/phase" },
              startDate: { type: Type.STRING, description: "YYYY-MM-DD" },
              endDate: { type: Type.STRING, description: "YYYY-MM-DD" },
              type: { 
                type: Type.STRING, 
                enum: [
                  "CONCEPTION",
                  "DEVELOPMENT",
                  "TESTS",
                  "PUSH_TO_PROD",
                  "OTHER"
                ] 
              },
              details: { type: Type.STRING, description: "Short description of what happens in this phase" }
            },
            required: ["name", "startDate", "endDate", "type"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const data = JSON.parse(text);
    // Validate enum mapping just in case
    return data.map((item: any) => ({
        ...item,
        type: PhaseType[item.type as keyof typeof PhaseType] || PhaseType.OTHER
    }));

  } catch (error) {
    console.error("Gemini generation error:", error);
    throw error;
  }
};
