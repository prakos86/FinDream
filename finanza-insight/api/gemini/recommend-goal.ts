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
    const { totalActivos = 0, totalPasivos = 0, dreamName = "", currentMeta = 0, countryName = "Colombia" } = req.body;

    // Sanitize input texts
    const cleanDreamName = sanitizeInputVal(dreamName);
    const cleanCountryName = sanitizeInputVal(countryName);

    const balanceLibre = Math.max(0, totalActivos - totalPasivos);
    const isEn = req.body.language === 'EN';

    const systemPrompt = isEn 
      ? `You are an expert financial advisor. First, evaluate if the user's monthly financial data (Income & Expenses) is sufficient to make a structured savings recommendation.
- Monthly Income: $${totalActivos}
- Monthly Expenses: $${totalPasivos}
- Net Monthly Free Balance: $${balanceLibre}
- Name of their Dream: "${cleanDreamName}"
- User's Initial Target Goal: $${currentMeta}
 
If the Monthly Income is 0, close to 0, or you feel there is not enough context to build an accurate personal financial assessment, you MUST set "sufficientInfo" to false, and in "explanation" ask the user to input their monthly income and expenses so you can guide them. Do not try to make up a budget if income is 0.
 
Rules for the JSON output:
1. "sufficientInfo": true if Income is registered and > 0, false if Income is 0 or too low/insufficient to analyze.
2. "recommendedMeta" should be a realistic total sum for "${cleanDreamName}". If currentMeta is empty or too small, adjust to a typical cost. If their income is low, keep it attainable.
3. "recommendedMonthlyAhorro" is the recommended monthly amount to save. It must be comfortable (usually 10% to 40% of their free balance). If free balance is $0, recommend a modest effort like $50 or $100.
4. "explanation" is a brief (1 sentence), encouraging summary. If sufficientInfo is false, tell the user politely that we don't have enough data yet and ask them to input their regular income/expenses.
5. "bullets" is an array of 3 to 4 specific savings recommendations or tips tailored to ${cleanCountryName} (e.g., local savings habits like CDT, Nequi pockets, "ahorro hormiga" reduction, etc.).`
      : `Eres un asesor financiero experto e inteligente. Primero determina si los datos financieros mensuales provistos (Ingresos y Egresos) son suficientes para dar una asesoría de ahorro estructurada y realista.
- Ingresos mensuales: $${totalActivos}
- Egresos mensuales: $${totalPasivos}
- Excedente o saldo libre al mes: $${balanceLibre}
- Nombre del sueño del usuario: "${cleanDreamName}"
- Meta estimada por el usuario inicialmente: $${currentMeta}
 
MUY IMPORTANTE: Si los ingresos mensuales son 0, casi 0, o determinas que NO cuentas con suficiente información registrada en la app para sugerir un plan realista de ahorro, DEBES fijar "sufficientInfo" en false. En la "explanation", invita cordialmente al usuario a proporcionar sus ingresos y egresos mensuales estimados en los campos que aparecerán, para que puedas recomendarle el plan perfecto. No inventes excedentes ficticios de ahorro si el ingreso es $0.
 
Reglas para la propuesta en formato JSON:
1. "sufficientInfo": true si cuentas con datos financieros de ingresos reales > 0; false si los ingresos son 0 o no hay suficiente información para un plan coherente.
2. "recommendedMeta": Es el valor recomendado total para alcanzar "${cleanDreamName}". Si la meta inicial del usuario es razonable, apóyala o ajústala con base en el costo habitual para ese tipo de sueños.
3. "recommendedMonthlyAhorro": Ahorro planificado mensual recomendado. Debe ser viable respecto a su excedente real de $${balanceLibre} (lo ideal es abonar entre un 15% y 40% de este excedente para no asfixiar su economía habitual. Si el excedente es de $0 o los datos son insuficientes, propón un esfuerzo bajo representativo de mínimo $50 o $100).
4. "explanation": Un análisis muy breve y motivador (máximo 1 oración de introducción). Si sufficientInfo es false, explica amablemente que necesitas que te digan cuántos son sus ingresos y gastos.
5. "bullets": Una lista (array de 3 o 4 strings) de recomendaciones concretas de ahorro y tips colombianos o locales de su país (ej. recortes de "gastos hormiga", optimización de suscripciones, aprovechamiento de cajillas de ahorro como Nequi/Daviplata, CDTs de alta rentabilidad, exención del 4x1000, etc.) adaptados a ${cleanCountryName}.`;

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
      contents: isEn ? "Analyze these constraints and propose the dream metadata." : "Analiza los datos fiscales y genera la recomendación para el sueño.",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sufficientInfo: { type: Type.BOOLEAN, description: "Whether the registered financial parameters are sufficient to recommend a plan (income > 0)" },
            recommendedMeta: { type: Type.INTEGER, description: "Recommended overall savings goal sum as integer" },
            recommendedMonthlyAhorro: { type: Type.INTEGER, description: "Suggested monthly saved rate as integer" },
            explanation: { type: Type.STRING, description: "Engaging and motivating short intro statement (max 1 sentence)" },
            bullets: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of 3-4 highly specific financial tips or actions tailored to the selected country"
             }
          },
          required: ["sufficientInfo", "recommendedMeta", "recommendedMonthlyAhorro", "explanation", "bullets"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return res.json(data);
  } catch (error: any) {
    console.error("Gemini AI Recommend Goal Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate savings recommendation" });
  }
}
