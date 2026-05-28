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
2. "banco": Real bank name in ${cleanCountry} (e.g., Chase, Amex for US; Santander, BancoEstado, Tenpo, MACH for Chile; Bancolombia, Nubank for Colombia)
3. "producto": Exact name of the financial product
4. "costoMensual": Estimated monthly handling fee. (e.g., "$0 COP" or "$0 CLP", match local currency format)
5. "beneficios": Array of 3 to 4 key bullet advantages representing why this product is unique.
6. "razon": 1 clear sentence showing how this product directly answers the user's query: "${cleanQuery}".`
      : `Eres un asesor financiero experto e inteligente. Basado en el requerimiento o búsqueda del usuario: "${cleanQuery}", sugiérele productos financieros reales y altamente recomendados disponibles en ${cleanCountry}.
Tus sugerencias deben ser realistas, asociadas con bancos y fintechs destacados de ${cleanCountry}.
Analiza con cautela qué productos se adaptan mejor a su consulta (CDT, tarjetas de crédito, de débito, cuentas de ahorro, créditos o inversiones digitales).
Genera exactamente 2 o 3 sugerencias de productos financieros.

Reglas para el objeto JSON que devolverás:
Debe contener un arreglo "products". Cada producto en el arreglo DEBE tener:
1. "id": cadena aleatoria o secuencial como "custom-rec-1", "custom-rec-2".
2. "banco": Nombre real de una entidad de ${cleanCountry} (P. ej., BancoEstado, Santander, Tenpo, CMR Falabella para Chile; Bancolombia, Nubank para Colombia).
3. "producto": Nombre exacto del producto financiero.
4. "costoMensual": Cuota de manejo estimada (P. ej., "$0 CLP" o "$15.000 COP", según la moneda del país).
5. "beneficios": Arreglo de 3 a 4 strings cortos (bullets) mostrando los mayores beneficios.
6. "razon": 1 frase clara explicando por qué este producto específico es perfecto para su consulta "${cleanQuery}".
Si te escriben desde Chile, responde usando un tono natural, profesional pero amigable ("cachai", etc. si aporta).`;

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
