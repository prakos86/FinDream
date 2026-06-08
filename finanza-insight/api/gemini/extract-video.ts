import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' }); return;
  }

  try {
    const { videoBase64, mimeType, country } = req.body;
    if (!videoBase64 || !mimeType) {
      res.status(400).json({ error: 'videoBase64 y mimeType son requeridos' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const moneda = country === 'CL' ? 'Chile (CLP)' : 'Colombia (COP)';

    const prompt =
      'Analiza este video que muestra movimientos bancarios. ' +
      'Extrae TODAS las transacciones visibles en los fotogramas del video. ' +
      'Para cada transaccion extrae: ' +
      'fecha (formato YYYY-MM-DD, si no aparece usa la fecha de hoy), ' +
      'monto (valor exacto como STRING tal como aparece en pantalla, ej. "146.637", "$2.378.260"), ' +
      'descripcion (nombre del comercio o descripcion del movimiento), ' +
      'tipo ("Gasto" o "Ingreso"). ' +
      'Pais: ' + moneda + '. El punto es separador de miles, NO decimal. ' +
      'Ignora pagos a tarjeta, cupos, totales y resumenes. ' +
      'Si el mismo movimiento aparece en varios fotogramas, registralo solo una vez. ' +
      'Responde SOLO con JSON valido sin markdown: ' +
      '{ "transacciones": [{ "fecha":"...","monto":"...","descripcion":"...","tipo":"Gasto"}] }';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: videoBase64, mimeType } },
          { text: prompt }
        ]
      }]
    });

    const raw = (response.text || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    res.status(200).json(parsed);
  } catch (err: any) {
    console.error('[extract-video] Error:', err.message);
    res.status(500).json({ error: 'Error procesando el video', detail: err.message });
  }
}
