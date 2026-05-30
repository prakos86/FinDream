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
}
