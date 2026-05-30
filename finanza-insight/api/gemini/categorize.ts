import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

const sanitizeInputVal = (str: any): string => {
  if (typeof str !== "string") return "";
  return str
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .trim();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { description, categories } = req.body;
    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }

    const cleanDesc = sanitizeInputVal(description);
    const safeCategories = Array.isArray(categories) ? categories.map(c => sanitizeInputVal(c)) : [];

    const systemPrompt = `You are an intelligent financial categorization assistant.
Given a transaction description: "${cleanDesc}", classify it into exactly ONE of the following active category names:
${JSON.stringify(safeCategories)}

Respond ONLY with a JSON object containing a "category" key, holding the exact string name of the matched category.
If nothing fits, default to the one that represents general/miscellaneous expenses or "Otros".

Example Output:
{ "category": "Alimentación" }`;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Classive this transaction details into a category.",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: "The exact name of the category matching the list provided" }
          },
          required: ["category"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (e: any) {
    console.error("Auto categorize error:", e);
    return res.json({ category: "Otros" });
  }
}
