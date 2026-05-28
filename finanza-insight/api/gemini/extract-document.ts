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
- monto: The transaction amount as a STRING representing the raw value exactly as it appears in the document (e.g. "2.378.260", "146.637" or "$2.378.260"). Do NOT try to parse or convert it to a number. Just output the exact raw sequence of characters/digits.

  CRITICAL RULES FOR EXTRACTING AMOUNTS:
  * In Latin American statements (Colombia COP, Chile CLP), a period "." is often a thousands separator.
  * You MUST extract the raw characters (like "2.378.260" or "146.637") as a string. Do NOT convert them to float or standard integers yourself, as that will corrupt the value.
  * Output exactly what you see in the text/document for the amount.
- nombre: A short description/name of the transaction.
- categoria: Infer the best logical category for the transaction (e.g., Alimentación, Transporte, Compras, Vivienda, Viajes, Mascotas, etc).
- banco: If the document shows a bank logo, entity name, or payment platform, extract its name.

When the document is a CREDIT CARD or BANK STATEMENT:
* Extract individual purchase/charge line items as transactions (with their date, description and amount).
* DO NOT extract as expenses: payments to the card ("Pago tarjeta", "Pago recibido", negative amounts), credits/refunds (abonos), available balance, total limit, minimum payment, accumulated points, or summary totals.
* Ignore lines marked "Sin Movimientos".
* Use each individual operation date ("Fecha Operación") for the transaction's fecha, not the statement issue date.

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
