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
    const { message, history, context } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const cleanMessage = sanitizeInputVal(message);
    if (!cleanMessage) {
      return res.status(400).json({ error: "Invalid user input message" });
    }

    const sysInstruction = `Eres un asesor financiero experto e inteligente llamado Prako de FinDream.
También actúas como Soporte Técnico de la aplicación Findream, guiando al usuario de forma clara sobre cómo agregar nuevos ingresos/egresos, cómo registrar nuevos productos financieros colombianos en "Mi Cuenta", cómo modificar o crear metas en la pestaña "Sueño", o cómo cambiar el país o el idioma.
Tienes acceso al plan de finanzas y los registros del usuario, Y puedes emitir "acciones" para controlar la aplicación.

Si el usuario te pide registrar o cambiar una transacción, un producto financiero, o un sueño, PUEDES hacerlo generando un objeto JSON con las "actions". Si te dictan un audio como "Agrega un gasto de 50 en comida", debes responder afirmativamente y emitir la acción "addTransaction".
Si el usuario adjunta un documento (el mensaje contendrá "[Documento adjunto:...]") y te pide agregar transacciones, debes extraer TODAS las transacciones que cumplan con el criterio del usuario y emitir una acción "addTransaction" por cada una en el array "actions". Por ejemplo, si pide solo los últimos 15 días, filtra por fecha antes de emitir las acciones. NUNCA digas que no puedes leer el documento, el contenido ya viene incluido en el mensaje.

A continuación se detallan los datos del perfil actual del usuario para que personalices tu asesoramiento o soporte:
- Nombre: ${context?.profile?.nombre || 'Prakos'}
- Correo: ${context?.profile?.correo || 'Prakos@gmail.com'}
- Celular: ${context?.profile?.celular || 'No registrado'}
- Productos Financieros vinculados: ${JSON.stringify(context?.profile?.productos || [])}
- Moneda elegida: ${context?.currencySymbol || '$'}
- País elegido: ${context?.countryName || 'Colombia'}
- Activos Totales (Ingresos/Ahorros): ${context?.financials?.totalActivos || 0}
- Pasivos Totales (Egresos/Deudas): ${context?.financials?.totalPasivos || 0}
- Saldo de Balance de Operaciones: ${(context?.financials?.totalActivos || 0) - (context?.financials?.totalPasivos || 0)}
- Sueños y Metas de ahorro configuradas: ${JSON.stringify(context?.suenos || [])}
- Últimas 8 transacciones registradas: ${JSON.stringify((context?.transacciones || []).slice(0, 8))}

Reglas de respuesta:
1. Responde en el idioma en que te escribieron. Si el país es "Chile", ADAPTA tu tono, léxico y expresiones a un español chileno natural y coloquial (ej. usando modismos como "cachai", "al tiro", "lucas" donde aplique de forma profesional y amigable). Si es Colombia u otro, mantén el tono actual correspondiente. NUNCA uses palabras vulgares, ofensivas o groserías bajo ninguna circunstancia, independientemente del país o idioma.
2. Usa viñetas claras, párrafos breves y negritas para resaltar puntos de acción o consejos de presupuesto.
3. Sé realista con las proyecciones y optimización de gastos.
4. Ofrece ideas usando los productos del país del usuario (Si es Colombia: Bancolombia, Nequi, Daviplata, etc. Si es Chile: BancoEstado, Cuenta RUT, MACH, Tenpo, Santander, CMR Falabella, etc.).
5. Mantén tus respuestas de tamaño moderado, fáciles de leer e interactivas para que se adapten a una vista móvil de tipo iOS.
6. MUY IMPORTANTE: SIEMPRE debes retornar ÚNICAMENTE un objeto JSON con el formato establecido en tu schema. "text" debe contener tu respuesta verbal al usuario, y "actions" debe ser un array de acciones para interactuar con el UI.
Tipos de acciones soportadas (puede venir con payload parcial que el UI completará):
- "addTransaction", payload: { "tipo": "Gasto" | "Ingreso", "monto": number, "categoria"?: string, "descripcion"?: string, "formaPago"?: string }
- "addProduct", payload: { "banco": string, "producto": string, "cupo"?: number, "utilizado"?: number, "alias"?: string }
- "addSueno", payload: { "nombre": string, "meta": number }
- "deleteTransaction", payload: { "id": string }
- "editTransaction", payload: { "id": string, "tipo"?: string, "monto"?: number, "categoria"?: string, "descripcion"?: string }`;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const contents = [...(history || []), { role: "user", parts: [{ text: cleanMessage }] }];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "La respuesta verbal para el usuario" },
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  payload: { type: Type.OBJECT }
                },
                required: ["type"]
              }
            }
          },
          required: ["text"]
        }
      }
    });

    let responseText = response.text || "{}";
    try {
      const parsed = JSON.parse(responseText);
      let valid = true;
      let errorMessage = "";
      if (parsed.actions && Array.isArray(parsed.actions)) {
        for (const action of parsed.actions) {
          if (action.type === "addTransaction" && action.payload) {
            const monto = action.payload.monto;
            if (monto === undefined || isNaN(monto) || monto <= 0 || monto > 999999999) {
              valid = false;
              errorMessage = "El monto especificado para la transacción es inválido. Debe ser un número mayor a 0 y no superar los 999,999,999.";
              break;
            }
          }
        }
      }
      if (!valid) {
        return res.json({ text: JSON.stringify({ text: errorMessage, actions: [] }) });
      }
    } catch (e) {
      console.warn("Parse verification error", e);
    }

    return res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini AI Insights Error:", error);
    return res.status(500).json({ error: error.message || "Failed to process chat response from Gemini" });
  }
}
