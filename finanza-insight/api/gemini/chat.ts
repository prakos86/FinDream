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
Si el usuario adjunta un documento (el mensaje contendrá "[Documento adjunto:...]") y te pide agregar transacciones, debes extraer TODAS las transacciones que cumplan con el criterio del usuario y emitir una acción "addTransaction" por cada una en el array "actions". Por ejemplo, si pide solo los últimos 15 días, filtra por fecha antes de emitir las acciones. NUNCA digas que no puedes leer el documento, el contenido ya viene incluido en el mensaje. DEBES OBLIGATORIAMENTE extraer TODAS las transacciones que cumplan con el criterio del usuario y emitir una accion addTransaction por cada una. NO te limites a explicar el documento: tu objetivo es EJECUTAR las acciones.

REGLAS CRÍTICAS PARA INTERPRETAR MONTOS (los estados de cuenta varían según país y banco):
- El monto debe ser un número ENTERO que represente el valor completo en la moneda local, SIN decimales salvo que la moneda realmente use centavos.
- En estados de cuenta de Latinoamérica (Colombia COP, Chile CLP), TANTO el punto "." como la coma "," se usan comúnmente como separadores de MILES. Ejemplo: "2.378.260" = 2378260, "1,250,000" = 1250000.
- Los pesos chilenos (CLP) y colombianos (COP) NO usan centavos decimales. Trata cualquier "." o "," en estos montos como separador de miles, NUNCA como punto decimal.
- Solo trata un separador como decimal si claramente son centavos en una moneda que los usa (USD "12.99", EUR "12,99") con exactamente 2 dígitos finales Y la magnitud tiene sentido.
- Razona siempre sobre la MAGNITUD: si interpretar un separador como decimal produce un monto absurdamente pequeño (un arriendo convertido en "2.4"), es un separador de miles.
- Emite el monto como entero puro: 2378260, nunca 2.378.260 ni 2378260.00.
- IMPORTANTE: el campo "monto" en cada addTransaction debe ser un NUMERO (no string), entero, ya parseado. Por ejemplo: 2378260 (correcto), no "2.378.260", no "$2.378.260", no "2378260.00", no "dos millones". Si tienes duda sobre un monto, omitelo en lugar de inventarlo o mandarlo con formato extrano.

CUANDO EL DOCUMENTO ES UN ESTADO DE CUENTA DE TARJETA O BANCO:
- Extrae cada compra/cargo individual como una transacción (con su fecha, descripción y monto).
- NO extraigas como gastos: pagos a la tarjeta ("Pago tarjeta", "Pago recibido", montos negativos), abonos/devoluciones, cupo disponible, cupo total, pago mínimo, puntos acumulados ni totales de resumen.
- Ignora líneas marcadas como "Sin Movimientos".
- Usa la fecha de operación individual ("Fecha Operación") de cada transacción, no la fecha de emisión del estado de cuenta.

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
        n = Math.round(n);
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
                original: montoOriginal,
                parseado: monto,
                descripcion: action.payload.descripcion
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
          const omissionMsg = `\n\n(Se procesaron con éxito y agregaron ${countAdded} transacciones; ${countOmitted} fueron omitidas por tener un monto inválido).`;
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
}
