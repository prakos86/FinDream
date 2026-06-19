import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const {
      nuevoGasto, // { monto, descripcion, categoria, fecha, formaPago } - modo single
      nuevosGastos, // [{ id, monto, descripcion, categoria, fecha, formaPago }] - modo batch
      transaccionesRecientes = [],
      categoriasUsuario = [],
      language = "ES"
    } = req.body;

    // Acepta modo single (formulario manual) o modo batch (importacion). Todo se procesa como batch.
    const gastosARevisar = Array.isArray(nuevosGastos) && nuevosGastos.length > 0
      ? nuevosGastos
      : (nuevoGasto ? [{ id: "tmp-0", ...nuevoGasto }] : []);

    if (gastosARevisar.length === 0) {
      return res.status(400).json({ alertas: [] });
    }

    const sysInstruction = `Eres un revisor silencioso de gastos para una app de finanzas personales.
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
${JSON.stringify(transaccionesRecientes.slice(0, 30))}

Categorias que usa el usuario:
${JSON.stringify(categoriasUsuario)}`;

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
}
