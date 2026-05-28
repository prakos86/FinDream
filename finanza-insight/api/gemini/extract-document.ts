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
- monto: The transaction amount as an INTEGER number representing the full value in the local currency's main unit, WITHOUT decimals unless the currency genuinely uses cents in that statement.

  CRITICAL RULES FOR PARSING AMOUNTS (statements vary by country and bank):
  * In Latin American statements (Colombia COP, Chile CLP), BOTH a period "." and a comma "," are commonly used as THOUSANDS separators. Example: "2.378.260" = 2378260, "1,250,000" = 1250000.
  * Chilean (CLP) and Colombian (COP) pesos DO NOT use decimal cents. Treat any "." or "," in these amounts as a thousands separator, NEVER as a decimal point.
  * Only treat a separator as a decimal when it is clearly cents in a currency that uses them (e.g. USD "12.99", EUR "12,99") with exactly 2 trailing digits AND the magnitude makes sense.
  * Always reason about the MAGNITUDE: if interpreting a separator as decimal produces an absurdly tiny amount (a rent payment becoming "2.4"), it is a thousands separator.
  * Return monto as a plain integer: 2378260, never 2.378.260 or 2378260.00.
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
