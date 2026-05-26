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
    const { query, country = "Colombia", language = "ES" } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Secure data sanitization before processing in LLM Prompt
    const cleanQuery = sanitizeInputVal(query);
    const cleanCountry = sanitizeInputVal(country);

    if (!cleanQuery) {
      return res.status(400).json({ error: "Invalid user input query" });
    }

    const isEn = language === 'EN';
    const systemPrompt = isEn
      ? `You are an expert financial personal advisor. Based on the user's search intent: "${cleanQuery}", suggest high-quality financial products available in ${cleanCountry}.
Your suggestions must be highly realistic and helpful, matched with top banks and fintechs in ${cleanCountry}.
Evaluate carefully what kind of products fit the query (CDT, credit card, debit card, digital investment, savings account).
Provide exactly 2 or 3 product suggestions.
 
Rules for the JSON output:
The response MUST be a JSON object containing a "products" array. Each product has:
1. "id": uniquely generated string (e.g. "custom-rec-1", "custom-rec-2")
2. "banco": Real bank name in ${cleanCountry} (examples: Chase, Capital One, Amex for US; Santander, BBVA for Spain/Mexico; Bancolombia, Scotiabank Colpatria, Davivienda, Nubank for Colombia/Mexico, etc.)
3. "producto": Exact name of the financial product
4. "costoMensual": Estimated monthly handling fee. (e.g., "$0 COP" or "$15 USD", match local currency format)
5. "beneficios": Array of 3 to 4 key bullet advantages representing why this product is unique.
6. "razon": 1 clear sentence showing how this product directly answers the user's query: "${cleanQuery}".`
      : `Eres un asesor financiero experto e inteligente. Basado en el requerimiento o búsqueda del usuario: "${cleanQuery}", sugiérele productos financieros reales y altamente recomendados disponibles en ${cleanCountry}.
Tus sugerencias deben ser realistas, asociadas con bancos y fintechs destacados de ${cleanCountry}.
Analiza con cautela qué productos se adaptan mejor a su consulta (CDT, tarjetas de crédito, de débito, cuentas de ahorro, créditos o inversiones digitales).
Genera exactamente 2 o 3 sugerencias de productos financieros.
 
Reglas para la propuesta en formato JSON:
La respuesta DEBE ser un objeto JSON con la clave "products" que contiene un array de productos. Cada producto tiene:
1. "id": cadena única generada (ej: "custom-rec-1", "custom-rec-2")
2. "banco": Nombre de una entidad financiera real en ${cleanCountry} (ejemplos para Colombia: Bancolombia, Nequi, Davivienda, Daviplata, Scotiabank Colpatria, Banco de Bogotá, BBVA, Nubank, Banco Falabella, etc.)
3. "producto": Nombre aproximado o exacto del producto financiero
4. "costoMensual": Cuota de manejo mensual estimada (ej: "$0 COP" o "$15.000 COP", ajustado a la moneda del país)
5. "beneficios": Array de 3 o 4 viñetas cortas con beneficios atractivos y específicos
6. "razon": Una frase de 1 sola línea explicando por qué este producto responde perfectamente a su necesidad: "${cleanQuery}".`;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: isEn ? `Based on: "${cleanQuery}" specify the recommended financial products.` : `Basado en: "${cleanQuery}", genera las recomendaciones de productos financieros.`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  banco: { type: Type.STRING },
                  producto: { type: Type.STRING },
                  costoMensual: { type: Type.STRING },
                  beneficios: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  razon: { type: Type.STRING }
                },
                required: ["id", "banco", "producto", "costoMensual", "beneficios", "razon"]
              }
            }
          },
          required: ["products"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return res.json(data);
  } catch (error: any) {
    console.error("Gemini AI Custom Product Recommendation Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate custom product recommendations" });
  }
}
