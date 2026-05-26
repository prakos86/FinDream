import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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
    const { fileBase64, mimeType, textContent } = req.body;
    const parts: any[] = [];
    
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
}
