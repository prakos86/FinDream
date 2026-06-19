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
Si el usuario adjunta un documento (el mensaje contendrá "[Documento adjunto:...]") y te pide agregar transacciones, debes extraer TODAS las transacciones individuales que encuentre en el estado de cuenta y emitir una acción "addTransaction" autónoma por cada una en el array "actions". NUNCA digas que no puedes leer el documento, el contenido ya viene de forma íntegra en el mensaje. TU PRIORIDAD ABSOLUTA ES EJECUTAR las acciones para poblar su cuenta. NO te limites a explicar o resumir: debes extraer todo e incluirlo en la lista de acciones JSON.

REGLAS CRÍTICAS PARA INTERPRETAR MONTOS (los estados de cuenta varían según país y banco):
- El campo "monto" en cada "addTransaction" y "editTransaction" DEBE ser un STRING con el valor crudo original (ej. "2.378.260", "146.637" o "5.070") tal como aparece en el documento o como lo indique el usuario. NO intentes parsearlo ni convertirlo tú mismo. El Backend de la aplicación se encargará de normalizarlo y parsearlo.
- Para transacciones internacionales en dólares u otras monedas (ej. Apple, Amazon, Netflix, etc.) que muestren tanto un monto en USD/EUR (ej. "USD 319,9" o "USD 64,9" en el nombre, detalle o descripción de la transacción) como el cobro equivalente en la moneda local (ej. "291.313" o "59.177" CLP), extrae SIEMPRE el monto del cobro equivalente final en la moneda local (ej. "291.313"). IGNORA los montos en moneda extranjera que aparecen dentro de las descripciones.
- Los pesos chilenos (CLP) y colombianos (COP) NO usan centavos decimales. Cualquier "." o "," en el cobro de la moneda local es un separador de miles. Sin embargo, no intentes convertirlo, emítelo como "291.313" o "5.070" (STRING).

CUANDO EL DOCUMENTO ES UN ESTADO DE CUENTA DE TARJETA O BANCO:
- Extrae todas y cada una de las compras/cargos individuales como transacciones (con su fecha, descripción y monto).
- DEBES extraer las compras de TODAS las secciones, incluyendo tanto COMPRAS NACIONALES como COMPRAS INTERNACIONALES u OTROS productos. No omitas ninguna compra.
- Extrae TODO independientemente del mes en que ocurrió la transacción. Por ejemplo, si el estado de cuenta tiene compras de Abril de 2026 o de Diciembre de 2025, debes extraerlas con su fecha correspondiente en el parámetro "fecha" (ej. "2026-04-27" o "2025-12-18"). No las omitas argumentando que son de un mes anterior.
- NO extraigas como gastos: pagos a la tarjeta ("Pago tarjeta", "Pago recibido", montos negativos), abonos/devoluciones, cupo disponible, cupo total, pago mínimo, puntos acumulados ni totales de resumen.
- Ignora líneas marcadas como "Sin Movimientos".
- Usa la fecha de operación individual ("Fecha Operación") de cada transacción para el campo "fecha", no la fecha de emisión general del estado de cuenta. Formatea la fecha de operación siempre como "YYYY-MM-DD" (por ejemplo: si es "27/04/2026" se extrae como "2026-04-27"). Si es del año anterior (como 18/12/2025), ponle "2025-12-18".

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
1. TONO PROFESIONAL: responde siempre en un espanol claro, amable y profesional, como un asesor financiero serio. Adapta el vocabulario al pais del usuario (si es Chile, usa expresiones chilenas profesionales como "al tiro" o "lucas" SOLO cuando ayudan a la naturalidad, sin abusar). PROHIBIDO USAR:
- Interjecciones coloquiales o vulgares: "uta", "ufff", "pucha", "que mala pata", "que lata", "que cacho", "huevon", "wea", "guevon", "carajo", "joder", "uy", "chuta", "chucha", "puta" (en cualquier forma o variante).
- Groserias, vulgaridades o palabras ofensivas en cualquier idioma, modismo o contexto.
- Lenguaje infantil o emojis excesivos.
Si necesitas expresar empatia por un error o problema, usa formulaciones profesionales como: "Lamento que esto haya ocurrido", "Entiendo tu preocupacion", "Veamos como resolverlo". El tono siempre debe ser el de un asesor financiero confiable y respetuoso, NUNCA el de un amigo del barrio.
2. Usa viñetas claras, párrafos breves y negritas para resaltar puntos de acción o consejos de presupuesto.
3. Sé realista con las proyecciones y optimización de gastos.
4. Ofrece ideas basadas en las entidades financieras colombianas (Bancolombia, Nequi, Daviplata, Davivienda, etc.) u otras según el país ${context?.countryName || 'Colombia'}.
5. Mantén tus respuestas de tamaño moderado, fáciles de leer e interactivas para que se adapten a una vista móvil de tipo iOS.
6. MUY IMPORTANTE: SIEMPRE debes retornar ÚNICAMENTE un objeto JSON con el formato establecido en tu schema. "text" debe contener tu respuesta verbal al usuario, y "actions" debe ser un array de acciones para interactuar con el UI.
Tipos de acciones soportadas (puede venir con payload parcial que el UI completará):
- "addTransaction", payload: { "tipo": "Gasto" | "Ingreso", "monto": string, "categoria"?: string, "descripcion"?: string, "formaPago"?: string, "fecha"?: string } // "fecha" es un string en formato "YYYY-MM-DD" (por ej. "2026-04-27") con la fecha del gasto extraído del documento o indicado por el usuario
- "addProduct", payload: { "banco": string, "producto": string, "cupo"?: number, "utilizado"?: number, "alias"?: string }
- "addSueno", payload: { "nombre": string, "meta": number }
- "deleteTransaction", payload: { "id": string }
- "editTransaction", payload: { "id": string, "tipo"?: string, "monto"?: string, "categoria"?: string, "descripcion"?: string }
- "deleteProduct", payload: { "id": string }
- "editProduct", payload: { "id": string, "banco"?: string, "producto"?: string, "cupo"?: number, "utilizado"?: number, "alias"?: string }
- "deleteSueno", payload: { "id": string }
- "editSueno", payload: { "id": string, "nombre"?: string, "meta"?: number }
IMPORTANTE: el campo "monto" en addTransaction y editTransaction debe ser un STRING con el valor crudo tal como aparece en el documento o como lo dicta el usuario.

INSTRUCCIONES PARA AGREGAR (importante, no inventar excusas):
REGLA ABSOLUTA Y OBLIGATORIA SOBRE EL CAMPO monto:
Cuando emitas una accion "addTransaction" o "editTransaction", el
campo "monto" dentro del "payload" es OBLIGATORIO. Si omites el
campo "monto", la accion sera DESCARTADA automaticamente por el
backend y el gasto NO se registrara, fallando completamente la
peticion del usuario.

INCORRECTO (sin monto, se descarta):
{"type":"addTransaction","payload":{
 "tipo":"Gasto",
 "categoria":"Transporte",
 "descripcion":"Uber",
 "fecha":"2026-05-30"
}}

CORRECTO (con monto, se procesa):
{"type":"addTransaction","payload":{
 "tipo":"Gasto",
 "monto":"100000",
 "categoria":"Transporte",
 "descripcion":"Uber",
 "fecha":"2026-05-30"
}}

El campo "monto" SIEMPRE debe ser un STRING con el valor que el
usuario indico, sin importar el formato. Ejemplos validos: "100000",
"100.000", "100,000", "$100000", "100 mil", "100k", "1m". El
backend tiene una funcion normalizarMonto que limpia cualquier
formato.

NUNCA emitas una accion addTransaction o editTransaction sin
el campo "monto" en el payload. Si el usuario no especifico monto,
NO emitas la accion: responde con texto pidiendole el monto.

Cuando el usuario te pida agregar un gasto o ingreso (ej. "agrega un
gasto de 100000 de Uber del 30 de mayo", "registrame 5000 en cafe",
"anota un ingreso de 1.500.000 de sueldo"), DEBES OBLIGATORIAMENTE
emitir UNA accion addTransaction en el array "actions".

NUNCA respondas que el monto tiene un "formato invalido", que "falta
el separador de miles", que "necesita comillas", o cualquier otra
excusa similar. El monto en el payload debe ser un STRING tal como
lo dio el usuario (puede ser "100000", "100.000", "100,000", "$100000",
"100 mil", "100k", "1m", etc.). El backend tiene una funcion
normalizarMonto que limpia y convierte cualquier formato, asi que
NO es tu responsabilidad pedirle al usuario que reformatee.

FORMATO CORRECTO:
{"type": "addTransaction", "payload": {
 "tipo": "Gasto",
 "monto": "100000",
 "categoria": "Transporte",
 "descripcion": "Uber",
 "fecha": "2026-05-30"
}}

NUNCA hagas esto (responder con texto en vez de emitir la accion):
"El gasto no fue agregado porque el formato del monto era invalido..."

Si te falta informacion CRITICA (ej. solo dijeron "agrega 5000" sin
mas contexto), puedes preguntar amablemente que falta, pero solo
eso. NUNCA inventes problemas de formato.

Para el campo "fecha", usar formato ISO YYYY-MM-DD. Si el usuario
dice "hoy", usar la fecha de hoy. Si dice "30 de mayo" sin ano,
usar el ano en curso.

REGLA CRITICA SOBRE EL CAMPO id (NO IGNORAR):
Cuando emitas una accion de tipo deleteTransaction, editTransaction,
deleteProduct, editProduct, deleteSueno o editSueno, el "payload"
DEBE OBLIGATORIAMENTE incluir el campo "id" con el valor REAL
tomado del contexto. Un payload vacio {} es INVALIDO y la app NO
podra ejecutar la accion.

FORMATO CORRECTO (con id):
{"type": "deleteTransaction", "payload": {"id": "abc123xyz"}}

FORMATO INCORRECTO (sin id, NO HAGAS ESTO):
{"type": "deleteTransaction", "payload": {}}

Los IDs estan en el contexto que se te entrega arriba (en
Transacciones recientes, Productos, Suenos). Por ejemplo, si el
contexto dice:
 {"id": "tx_abc123", "descripcion": "Netflix", "monto": 12990, ...}
y el usuario pide eliminar ese gasto, tu accion debe ser:
 {"type": "deleteTransaction", "payload": {"id": "tx_abc123"}}

NUNCA inventes un id. NUNCA dejes el payload vacio. Si no encuentras
el id en el contexto, NO emitas la accion: responde con texto
pidiendo al usuario que sea mas especifico.`;

      const ai = getAIClient();
      
      const contents = [...(history || []), { role: "user", parts: [{ text: cleanMessage }] }];

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
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
                    payload: {
                      type: Type.OBJECT,
                      properties: {
                        // Comunes
                        id: { type: Type.STRING },
                        // addTransaction / editTransaction
                        tipo: { type: Type.STRING },
                        monto: { type: Type.STRING },
                        categoria: { type: Type.STRING },
                        descripcion: { type: Type.STRING },
                        formaPago: { type: Type.STRING },
                        fecha: { type: Type.STRING },
                        // addProduct / editProduct
                        banco: { type: Type.STRING },
                        producto: { type: Type.STRING },
                        cupo: { type: Type.NUMBER },
                        utilizado: { type: Type.NUMBER },
                        alias: { type: Type.STRING },
                        // addSueno / editSueno
                        nombre: { type: Type.STRING },
                        meta: { type: Type.NUMBER }
                      }
                    }
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
        // Safe JSON parsing with markdown code fence cleaning
        let cleanedJSONString = responseText.trim();
        if (cleanedJSONString.startsWith("```")) {
          cleanedJSONString = cleanedJSONString.replace(/^```(json)?\s*/i, "");
        }
        if (cleanedJSONString.endsWith("```")) {
          cleanedJSONString = cleanedJSONString.replace(/\s*```$/, "");
        }
        cleanedJSONString = cleanedJSONString.trim();

        const parsed = JSON.parse(cleanedJSONString);
        let countAdded = 0;
        let countOmitted = 0;
        
        const normalizarMonto = (valor: any): number => {
          if (valor === null || valor === undefined) return NaN;
          if (typeof valor === "number") {
            if (!isFinite(valor)) return NaN;
            return Math.round(valor);
          }
          if (typeof valor !== "string") {
            valor = String(valor);
          }
          let raw = valor.trim();
          if (!raw) return NaN;

          const lowercase = raw.toLowerCase();
          // Detect multipliers
          let multiplier = 1;
          if (lowercase.includes('mill') || lowercase.includes('mm') || (lowercase.includes('m') && !lowercase.includes('mil'))) {
            multiplier = 1000000;
          } else if (lowercase.includes('k') || lowercase.includes('mil')) {
            multiplier = 1000;
          }

          const esNegativo = /^\(.*\)$/.test(raw) || /^-/.test(raw);
          // quita TODO menos digitos, punto y coma
          let s = raw.replace(/[^0-9.,]/g, "");
          if (!s) return NaN;
          
          if (s.includes(".") && s.includes(",")) {
            if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
              s = s.replace(/\./g, "").replace(",", ".");
            } else {
              s = s.replace(/,/g, "");
            }
          } else if (s.includes(".")) {
            const parts = s.split(".");
            // Si hay mas de un punto -> todos son miles
            if (parts.length > 2) s = s.replace(/\./g, "");
            // Si el ultimo grupo tiene 3 digitos exactos -> separador de miles
            else if (parts[parts.length - 1].length === 3) s = s.replace(/\./g, "");
          } else if (s.includes(",")) {
            const parts = s.split(",");
            if (parts.length > 2) s = s.replace(/,/g, "");
            else if (parts[parts.length - 1].length === 3) s = s.replace(/,/g, "");
            else s = s.replace(",", ".");
          }
          let n = parseFloat(s);
          if (isNaN(n)) {
            // ultimo recurso: extraer solo digitos
            const soloDigitos = raw.replace(/\D/g, "");
            if (soloDigitos) n = parseInt(soloDigitos, 10);
          }
          if (isNaN(n)) return NaN;
          n = Math.round(n * multiplier);
          if (esNegativo) n = -Math.abs(n);
          return n;
        };

        if (parsed.actions && Array.isArray(parsed.actions)) {
          const filteredActions: any[] = [];
          for (const action of parsed.actions) {
            if (action.type === "addTransaction" && action.payload) {
              const montoOriginal = action.payload.monto;
              const monto = normalizarMonto(montoOriginal);
              if (monto === undefined || isNaN(monto) || monto <= 0 || monto > 999999999999) {
                console.warn("[chat.ts] Monto omitido:", JSON.stringify({
                  original: montoOriginal === undefined ? "UNDEFINED" : montoOriginal,
                  originalType: typeof montoOriginal,
                  parseado: monto,
                  payloadCompleto: action.payload,
                  descripcion: action.payload?.descripcion
                }));
                countOmitted++;
                continue;
              }
              action.payload.monto = monto;
              countAdded++;
              filteredActions.push(action);
            } else {
              filteredActions.push(action);
            }
          }
          parsed.actions = filteredActions;
          if (countOmitted > 0) {
            const omissionMsg = `\n\n(Se procesaron con éxito y agregaron ${countAdded} transacciones; ${countOmitted} fueron omitidas. Por favor especifica el monto claramente en tu mensaje - ej. "agrega 100000 de Uber").`;
            parsed.text = (parsed.text || "") + omissionMsg;
          }
          responseText = JSON.stringify(parsed);
        }
      } catch (e) {
        console.warn("Parse verification error", e);
      }

      return res.json({ text: responseText });
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
        model: "gemini-3.5-flash",
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
- monto: The transaction amount as a STRING representing the raw value exactly as it appears in the document (e.g. "2.378.260", "146.637" or "$2.378.260"). Do NOT try to parse or convert it to a number. Just output the exact raw sequence of characters/digits.

  CRITICAL RULES FOR EXTRACTING AMOUNTS:
  * In Latin American statements (Colombia COP, Chile CLP), a period "." is a thousands separator, and cents/decimals are NEVER used.
  * FOR INSTALLMENT TRANSACTIONS / DEFERRED PURCHASES ("Compras en Cuotas"): In credit card statements where a purchase is split into multiple monthly installments (indicated by fractional indices such as "06/12", "01/01", "02/03", etc.), there is usually a total operation/purchase amount listed (e.g., "762.392") AND a monthly installment amount currently billed inside the statement (e.g., "63.532" as the "Valor Cuota Mensual" or "Cargo del mes"). You MUST ALWAYS extract the individual MONTHLY installment amount currently billed (e.g., "63.532") as the "monto", NOT the total original purchase amount (e.g., "762.392"). Extracting the total original purchase amount for an active installment will inflate the user's monthly billing sums incorrectly.
  * For international or foreign currency transactions (e.g. Cupertino, Seattle, Amazon, Apple, Netflix) which display BOTH a foreign amount (like "USD 319,9" or "USD 64,9" in the description) and a local currency equivalent amount (like "291.313" or "59.177" listed as the charged value), you MUST ALWAYS extract the final local currency charged amount (e.g., "291.313" or "59.177"). NEVER extract the foreign amount (USD, EUR, etc.) listed inside descriptions or auxiliary columns!
  * You MUST extract the raw characters of the local currency amount (like "291.313" or "5.070") EXACTLY as a string. Do NOT convert them to float or standard integers yourself, and do NOT truncate trailing zeros (e.g. keep "5.070" exactly, do NOT output "5.07").
  * Output exactly what you see in the text/document for the local currency billed amount.
- nombre: A short description/name of the transaction.
- categoria: Infer the best logical category for the transaction (e.g., Alimentación, Transporte, Compras, Vivienda, Viajes, Mascotas, etc).
- banco: If the document shows a bank logo, entity name, or payment platform, extract its name.

When the document is a CREDIT CARD or BANK STATEMENT:
* Extract individual purchase/charge line items as transactions (with their date, description and amount).
* DO NOT extract as expenses: payments to the card ("Pago tarjeta", "Pago recibido", negative amounts), credits/refunds (abonos), available balance, total limit, minimum payment, accumulated points, or summary totals.
* Ignore lines marked "Sin Movimientos".
* Use the individual operation date ("Fecha Operación") for each transaction's fecha, not the statement date.

Return ONLY a JSON array of objects with this structure (example):
[
  {
    "fecha": "YYYY-MM-DD",
    "monto": "2.378.260",
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
        model: "gemini-3.5-flash",
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

  // API Route for Video Extraction
  app.post("/api/gemini/extract-video", customRateLimiter(20, 10 * 60 * 1000), async (req, res) => {
    try {
      const { frames, country } = req.body;
      if (!frames || !Array.isArray(frames) || frames.length === 0) {
        return res.status(400).json({ error: 'Se requiere el array de frames' });
      }
      const ai = getAIClient();
      const moneda = country === 'CL' ? 'Chile (CLP)' : 'Colombia (COP)';
      const prompt =
        'Estas son capturas de un video de movimientos bancarios en '
        + moneda + '. '
        + 'Extrae TODAS las transacciones visibles. '
        + 'Para cada una: '
        + 'fecha (YYYY-MM-DD, si no aparece usa hoy), '
        + 'monto (STRING exacto como aparece en pantalla, ej: "146.637"), '
        + 'descripcion (nombre del comercio), tipo (Gasto o Ingreso), '
        + 'categoria (Una categoria sugerida, ej: Alimentación, Transporte, Servicios, Suscripciones, Compras, Entretenimiento, Salud, Educación, Transferencias, Otros), '
        + 'banco (El nombre del banco o emisor, ej: CMR, Falabella, Bancolombia, etc.). '
        + 'El año actual es 2026. Usa siempre 2026 en las fechas. '
        + 'La fecha de cada transaccion es la que aparece '
        + 'junto al movimiento, NO la del encabezado de seccion. '
        + 'Si un movimiento dice Pendiente sin fecha clara, '
        + 'usa la fecha de hoy en formato YYYY-MM-DD. '
        + 'El punto es separador de miles, NUNCA decimal. '
        + 'Ignora pagos a tarjeta, cupos y totales. '
        + 'Si el mismo movimiento aparece varias veces, registralo una sola vez. '
        + 'Responde SOLO con JSON valido sin markdown: '
        + '{"transacciones":[{"fecha":"...","monto":"...","descripcion":"...","tipo":"Gasto","categoria":"...","banco":"..."}]}';
      
      const parts: any[] = frames.map((f: string) => ({
        inlineData: { data: f, mimeType: 'image/jpeg' }
      }));
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }]
      });
      
      const raw = (response.text || '')
        .replace(/```json|```/g, '').trim();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error('[extract-video] parse error:', raw.slice(0, 200));
        return res.status(500).json({ error: 'Error parseando respuesta' });
      }
      res.status(200).json(parsed);
    } catch (err: any) {
      console.error('[extract-video] Error:', err.message);
      res.status(500).json({ error: 'Error procesando frames', detail: err.message });
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
  });

  // API Route for Expense Loading Review (silent checker for duplicates, categories, amounts, unusual dates)
  app.post("/api/gemini/review-expense", customRateLimiter(60, 10 * 60 * 1000), async (req, res) => {
    try {
      const {
        nuevoGasto, // { monto, descripcion, categoria, fecha, formaPago } - modo single
        nuevosGastos, // [{ id, monto, descripcion, categoria, fecha, formaPago }] - modo batch
        transaccionesRecientes = [], // ultimas ~30 transacciones del usuario
        categoriasUsuario = [],
        language = "ES",
        country = "CO" // 'CO' | 'CL' - para contexto del agente
      } = req.body;

      const moneda = country === 'CL' ? 'pesos chilenos (CLP)' : 'pesos colombianos (COP)';

      // Acepta modo single (formulario manual) o modo batch (importacion). Todo se procesa como batch.
      const gastosARevisarRaw = Array.isArray(nuevosGastos) && nuevosGastos.length > 0
        ? nuevosGastos
        : (nuevoGasto ? [{ id: "tmp-0", ...nuevoGasto }] : []);

      if (gastosARevisarRaw.length === 0) {
        return res.status(400).json({ alertas: [] });
      }

      // Sanitize input texts
      const gastosARevisar = gastosARevisarRaw.map((g: any) => ({
        id: sanitizeInputVal(g.id || ""),
        monto: Number(g.monto),
        descripcion: sanitizeInputVal(g.descripcion || ""),
        categoria: sanitizeInputVal(g.categoria || ""),
        fecha: sanitizeInputVal(g.fecha || ""),
        formaPago: sanitizeInputVal(g.formaPago || "")
      }));

      const sysInstruction = `Eres un revisor silencioso de gastos para una app de finanzas personales
en ${country === 'CL' ? 'Chile' : 'Colombia'}. Los montos son en ${moneda}.
Tu unico trabajo es detectar POSIBLES errores en un gasto recien cargado, comparandolo
contra el historial reciente del usuario. NUNCA decides ni corriges nada - solo detectas
y generas una pregunta breve y respetuosa para que el USUARIO decida.

Revisa estos 4 tipos de inconsistencia, en este orden de prioridad:

1. DUPLICADO SEMANTICO: el nuevo gasto podria ser el mismo que uno ya existente en
 transaccionesRecientes, aunque la descripcion no sea identica letra por letra
 (ej: "Gopass" vs "GOPASS SAS PEAJE BOGOTA" el mismo dia y monto). Si encuentras
 una coincidencia de monto + fecha (mismo dia o +-1) + descripcion semanticamente
 similar, marca tipo "duplicado_semantico" e incluye el id de la transaccion existente.
2. CATEGORIA INCONSISTENTE: la categoria asignada no calza con la descripcion
 (ej: "Netflix" categorizado como "Transporte"). Compara contra categoriasUsuario
 y el patron de categorias que el usuario usa normalmente para descripciones similares
 en transaccionesRecientes.
3. MONTO SOSPECHOSO: el monto es muy distinto (10x o mas) al rango habitual para
 gastos con descripcion o categoria similar en transaccionesRecientes. Util para
 detectar errores de digitacion (ej: $4.500.000 en vez de $4.500 en un cafe).
4. FECHA INUSUAL: la fecha es futura, o es muy anterior (mas de 60 dias) sin que
 el usuario lo haya indicado explicitamente.

Si NO detectas ninguna inconsistencia real, devuelve un array vacio. NO inventes
alertas por inventar - el silencio es la respuesta correcta la mayoria de las veces.
Se conservador: solo alerta cuando hay una senal clara, no ante cualquier diferencia menor.

Responde en idioma: ${language === 'EN' ? 'English' : 'Espanol'}.
Si revisas varios gastos a la vez, evalua cada uno de forma independiente. Para cada
alerta que generes, incluye el campo idGastoRevisado con el "id" del gasto correspondiente
de la lista que recibiste, para que el sistema sepa a cual gasto especifico aplica.`;

      const userPrompt = `Gastos nuevos a revisar (revisa CADA UNO por separado, puedes generar multiples alertas si encuentras mas de un problema):
${JSON.stringify(gastosARevisar)}

Transacciones recientes del usuario (para comparar):
${JSON.stringify(transaccionesRecientes.slice(0, 30).map((t: any) => ({
        id: sanitizeInputVal(t.id),
        monto: Number(t.monto),
        descripcion: sanitizeInputVal(t.descripcion),
        categoria: sanitizeInputVal(t.categoria),
        fecha: sanitizeInputVal(t.fecha)
      })))}

Categorias que usa el usuario:
${JSON.stringify(categoriasUsuario.map((c: any) => sanitizeInputVal(c)))}`;

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: sysInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              alertas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tipo: {
                      type: Type.STRING,
                      enum: ["duplicado_semantico", "categoria_inconsistente", "monto_sospechoso", "fecha_inusual"]
                    },
                    mensaje: { type: Type.STRING },
                    idGastoRevisado: { type: Type.STRING, nullable: true },
                    idTransaccionRelacionada: { type: Type.STRING, nullable: true },
                    categoriaSugerida: { type: Type.STRING, nullable: true }
                  },
                  required: ["tipo", "mensaje"]
                }
              }
            },
            required: ["alertas"]
          }
        }
      });

      const data = JSON.parse(response.text || '{"alertas":[]}');
      return res.json(data);
    } catch (error) {
      console.error("Review expense error:", error);
      return res.json({ alertas: [] });
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
