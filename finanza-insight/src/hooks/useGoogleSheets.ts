import { useState } from 'react';
import { Transaccion, Categoria } from '../types';

interface UseGoogleSheetsOptions {
  categorias: Categoria[];
  getMergedPaymentMethods: () => string[];
  selectedLanguage: string;
  triggerDynamicIsland: (text: string, subtext: string, isPositive: boolean) => void;
  requestConfirmation: (title: string, message: string, onConfirm: () => void) => void;
  setIsAddingOpen: (open: boolean) => void;
  isMuted: boolean;
  playTone: (soundType: any, muted: boolean) => void;
  onImportSuccess: (newTxList: Transaccion[]) => void;
}

export function useGoogleSheets({
  categorias,
  getMergedPaymentMethods,
  selectedLanguage,
  triggerDynamicIsland,
  requestConfirmation,
  setIsAddingOpen,
  isMuted,
  playTone,
  onImportSuccess,
}: UseGoogleSheetsOptions) {
  const [isImportingSheets, setIsImportingSheets] = useState(false);

  const formatLocalYYYYMMDD = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const importFromSheets = async () => {
    try {
      setIsImportingSheets(true);
      triggerDynamicIsland("Conectando", selectedLanguage === 'ES' ? "Abriendo Google Sheets..." : "Opening Google Sheets...", true);
      const { getGoogleAccessToken } = await import('../firebase');
      const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/spreadsheets.readonly']);
      
      const spreadsheetId = window.prompt(selectedLanguage === 'ES' ? "Pega el enlace o ID de tu Google Sheet:" : "Paste the link or ID of your Google Sheet:");
      if (!spreadsheetId) {
         setIsImportingSheets(false);
         triggerDynamicIsland("Cancelado", selectedLanguage === 'ES' ? "Operación cancelada" : "Operation canceled", false);
         return;
      }
      
      let realId = spreadsheetId;
      if (spreadsheetId.includes('/d/')) {
         realId = spreadsheetId.split('/d/')[1].split('/')[0];
      }
      
      triggerDynamicIsland("Leyendo", selectedLanguage === 'ES' ? "Analizando hoja con IA..." : "Analyzing sheet with AI...", true);
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${realId}/values/A1:Z500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
         throw new Error('Error reading from Google Sheets');
      }
      const result = await response.json();
      const rows = result.values || [];
      
      let textContent = rows.map((r: any[]) => r.join(',')).join('\n');
      
      const responseBackend = await fetch('/api/gemini/extract-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ textContent })
      });

      if (!responseBackend.ok) {
        throw new Error('Error extracting document via backend');
      }

      const parsedDataArray = await responseBackend.json();
      
      const parsedArray = Array.isArray(parsedDataArray) ? parsedDataArray : [parsedDataArray];
      
      const newTxList = parsedArray.map(parsedData => {
        let cat = 'Otros';
        if (parsedData.categoria) {
          let matchedCat = categorias.find(c => c.nombre.toLowerCase() === parsedData.categoria.toLowerCase());
          if (!matchedCat) {
            matchedCat = categorias.find(c => parsedData.categoria.toLowerCase().includes(c.nombre.toLowerCase()) || 
                                             c.nombre.toLowerCase().includes(parsedData.categoria.toLowerCase()));
          }
          if (matchedCat) cat = matchedCat.nombre;
        }
        
        let forma = getMergedPaymentMethods()[0];
        if (parsedData.banco) {
          const pms = getMergedPaymentMethods();
          let matchedPm = pms.find(pm => pm.toLowerCase().includes(parsedData.banco.toLowerCase()) || parsedData.banco.toLowerCase().includes(pm.toLowerCase()));
          if (matchedPm) forma = matchedPm;
        }
        
        const tx: Transaccion = {
          id: Math.random().toString(36).substring(2, 9),
          tipo: 'Gasto',
          monto: Number(parsedData.monto) || 0,
          categoria: cat,
          fecha: parsedData.fecha || formatLocalYYYYMMDD(new Date()),
          descripcion: parsedData.nombre || `Gasto en ${cat}`,
          formaPago: forma
        };
        return tx;
      });
      
      setIsAddingOpen(false);
      
      requestConfirmation(
        selectedLanguage === 'ES' ? "Confirmar importación" : "Confirm import",
        selectedLanguage === 'ES' 
          ? `Se encontraron ${newTxList.length} movimientos por un total de $${newTxList.reduce((acc, t) => acc + t.monto, 0).toLocaleString()}. ¿Deseas agregarlos?` 
          : `Found ${newTxList.length} transactions totaling $${newTxList.reduce((acc, t) => acc + t.monto, 0).toLocaleString()}. Do you want to add them?`,
        () => {
          onImportSuccess(newTxList);
          triggerDynamicIsland("Completado", selectedLanguage === 'ES' ? `Se agregaron ${newTxList.length} movimientos.` : `${newTxList.length} transactions added.`, true);
          playTone('success', isMuted);
        }
      );
    } catch(e) {
      console.error(e);
      triggerDynamicIsland("Error", selectedLanguage === 'ES' ? "No se pudo leer de Google Sheets" : "Could not read from Google Sheets", false);
    } finally {
      setIsImportingSheets(false);
    }
  };

  return {
    importFromSheets,
    isImportingSheets
  };
}
