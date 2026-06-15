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
    const { frames, country } = req.body;
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      res.status(400).json({ error: 'Se requiere array de frames' });
      return;
    }
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    const moneda = country === 'CL'
      ? 'Chile (CLP)' : 'Colombia (COP)';
    const prompt =
      'Estas son capturas de un video de movimientos bancarios en '
      + moneda + '. '
      + 'Extrae TODAS las transacciones visibles. '
      + 'Para cada una: fecha (YYYY-MM-DD, si no aparece usa hoy), '
      + 'monto (STRING exacto como aparece en pantalla, ej: "146.637", "$2.378.260"), '
      + 'descripcion (nombre del comercio o descripcion), '
      + 'tipo (Gasto o Ingreso), '
      + 'categoria (DEBES usar EXACTAMENTE uno de estos nombres, respetando tildes y mayúsculas/minúsculas: Vivienda, Alimentación, Transporte, Compras, Viajes, Cuidado Personal y Entretenimiento, Mascotas, Moda y Estilo, Otros. Si ninguno aplica exactamente, usa Otros), '
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
      res.status(500).json({ error: 'Error parseando respuesta' });
      return;
    }
    res.status(200).json(parsed);
  } catch (err: any) {
    console.error('[extract-video] Error:', err.message);
    res.status(500).json({
      error: 'Error procesando frames', detail: err.message
    });
  }
}
