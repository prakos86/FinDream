import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

let aiClient: any = null;
const getAIClient = () => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Disable server fingerprinting (Information Disclosure prevention)
  app.disable("x-powered-by");

  // Secure HTTP Headers Middleware
  app.use((req, res, next) => {
    // Prevent Clickjacking
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    // Prevent MIME-Sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Prevent legacy XSS attacks
    res.setHeader("X-XSS-Protection", "1; mode=block");
    // Set Referrer Policy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Enforce HSTS (Strict-Transport-Security) for HTTPS
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    // Permissions Policy to secure browser features
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    // High-safety Content Security Policy (CSP) compatible with AI Studio preview frames
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https://referrer.concept.io https://*.google.com; connect-src 'self' ws: wss: https://*.googleapis.com; frame-ancestors 'self' https://ai.studio https://*.run.app;"
    );
    next();
  });

  app.use(express.json({ limit: "50mb" }));

  // In-memory highly efficient rate limiting structure (Denial of Service & API cost-exploit protection)
  const ipLimits = new Map<string, { count: number; resetTime: number }>();
  const customRateLimiter = (limit: number, windowMs: number) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown-client";
      const now = Date.now();
      
      let record = ipLimits.get(ip);
      if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + windowMs };
      }
      
      record.count++;
      ipLimits.set(ip, record);
      
      if (record.count > limit) {
        res.setHeader("Retry-After", Math.ceil((record.resetTime - now) / 1000));
        return res.status(429).json({ 
          error: "Has alcanzado el límite de consultas de seguridad. Intenta de nuevo más tarde para proteger tu sesión." 
        });
      }
      next();
    };
  };

  // Helper function to sanitize user text inputs (cross-site scripting & injection protections)
  const sanitizeInputVal = (str: any): string => {
    if (typeof str !== "string") return "";
    return str
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .trim();
  };

  // API Route for AI Chatbot Insights - Rate-limited to 60 requests per 10 minutes per IP
  app.post("/api/gemini/chat", customRateLimiter(60, 10 * 60 * 1000), async (req, res) => {
    try {
      const { message, history, context } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Secure data sanitization
      const cleanMessage = sanitizeInputVal(message);
      if (!cleanMessage) {
        return res.status(400).json({ error: "Invalid user input message" });
      }

      // Format current profile and transactions summary context
      const sysInstruction = `Eres un asesor financiero experto e inteligente llamado Prako de FinDream.
También actúas como Soporte Técnico de la aplicación Findream, guiando al usuario de forma clara sobre cómo agregar nuevos ingresos/egresos, cómo registrar nuevos productos financieros colombianos en "Mi Cuenta", cómo modificar o crear metas en la pestaña "Sueño", o cómo cambiar el país o el idioma.
Tienes acceso al plan de finanzas y los registros del usuario, Y puedes emitir "acciones" para controlar la aplicación.

Si el usuario te pide registrar o cambiar una transacción, un producto financiero, o un sueño, PUEDES hacerlo generando un objeto JSON con las "actions". Si te dictan un audio como "Agrega un gasto de 50 en comida", debes responder afirmativamente y emitir la acción "addTransaction".

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
1. Responde en el idioma en que te escribieron: si la conversación es en inglés (${context?.language === 'EN' ? 'sí' : 'no'}), responde en inglés; si es en español, responde en español (por defecto es español).
2. Usa viñetas claras, párrafos breves y negritas para resaltar puntos de acción o consejos de presupuesto.
3. Sé realista con las proyecciones y optimización de gastos.
4. Ofrece ideas basadas en las entidades financieras colombianas (Bancolombia, Nequi, Daviplata, Davivienda, etc.) u otras según el país ${context?.countryName || 'Colombia'}.
5. Mantén tus respuestas de tamaño moderado, fáciles de leer e interactivas para que se adapten a una vista móvil de tipo iOS.
6. MUY IMPORTANTE: SIEMPRE debes retornar ÚNICAMENTE un objeto JSON con el formato establecido en tu schema. "text" debe contener tu respuesta verbal al usuario, y "actions" debe ser un array de acciones para interactuar con el UI.
Tipos de acciones soportadas (puede venir con payload parcial que el UI completará):
- "addTransaction", payload: { "tipo": "Gasto" | "Ingreso", "monto": number, "categoria"?: string, "descripcion"?: string, "formaPago"?: string }
- "addProduct", payload: { "banco": string, "producto": string, "cupo"?: number, "utilizado"?: number, "alias"?: string }
- "addSueno", payload: { "nombre": string, "meta": number }`;

      const ai = getAIClient();
      
      const contents = [...(history || []), { role: "user", parts: [{ text: cleanMessage }] }];

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
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
  });

  // API Route for Savings Goal Personalised AI Recommendations - Rate-limited to 30 requests per 10 minutes per IP
  app.post("/api/gemini/recommend-goal", customRateLimiter(30, 10 * 60 * 1000), async (req, res) => {
    try {
      const { totalActivos = 0, totalPasivos = 0, dreamName = "", currentMeta = 0, countryName = "Colombia" } = req.body;

      // Sanitize input texts
      const cleanDreamName = sanitizeInputVal(dreamName);
      const cleanCountryName = sanitizeInputVal(countryName);

      const balanceLibre = Math.max(0, totalActivos - totalPasivos);
      const isEn = req.body.language === 'EN';
      const hasData = totalActivos > 0;

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
5. "bullets" is an array of 3 to 4 specific savings recommendations or tips tailored to<sup>${cleanCountryName}</sup> (e.g., local savings habits like CDT, Nequi pockets, "ahorro hormiga" reduction, etc.).`
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

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
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
  });

  // API Route for Custom Product Search recommendations - Rate-limited to 40 requests per 10 minutes per IP
  app.post("/api/gemini/recommend-custom-products", customRateLimiter(40, 10 * 60 * 1000), async (req, res) => {
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

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
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
  });

  // API Route for Document Extraction (PDF, Image, CSV processing)
  app.post("/api/gemini/extract-document", customRateLimiter(20, 10 * 60 * 1000), async (req, res) => {
    try {
      const { fileBase64, mimeType, textContent } = req.body;
      let parts: any[] = [];
      
      if (fileBase64 && mimeType) {
        parts.push({
          inlineData: {
            data: fileBase64,
            mimeType: mimeType
          }
        });
      }
      
      const systemPrompt = `You are a specialized financial data extractor. You will be provided with a document (PDF, Image, or plain text / CSV) containing transaction receipts, invoices or bank statements. 
Your goal is to extract the details for ALL transactions found in the document.
Extract the following information for each transaction:
- fecha: The date of the transaction in "YYYY-MM-DD" format.
- monto: The financial amount as a pure number (no currency symbols, no thousands separators, decimals allowed).
- nombre: A short description/name of the transaction.
- categoria: Infer the best logical category for the transaction (e.g., Alimentación, Transporte, Compras, Vivienda, Viajes, Mascotas, etc).
- banco: If the document shows a bank logo, entity name, or payment platform, extract its name.

Return ONLY a JSON array of objects with this structure (example):
[
  {
    "fecha": "YYYY-MM-DD",
    "monto": 120000,
    "nombre": "name/description",
    "categoria": "category name",
    "banco": "bank or platform name"
  }
]
If a value cannot be found, return null for that field.

Document text/content:
${textContent ? textContent.substring(0, 50000) : ""}`;

      parts.push({ text: systemPrompt });

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { role: "user", parts }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });
      
      const data = JSON.parse(response.text || "{}");
      return res.json(data);
    } catch (error: any) {
      console.error("Gemini AI Document Extraction Error:", error);
      return res.status(500).json({ error: error.message || "Failed to extract document data" });
    }
  });

  // API Route for Auto Transaction Categorization - Rate-limited to 60 requests per 10 minutes per IP
  app.post("/api/gemini/categorize", customRateLimiter(60, 10 * 60 * 1000), async (req, res) => {
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

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
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
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
