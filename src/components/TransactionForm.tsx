import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, DollarSign } from 'lucide-react';
import { TipoMovimiento, Categoria, Transaccion } from '../types';

interface TransactionFormProps {
  onSave: (t: Omit<Transaccion, "id">) => void;
  onCancel: () => void;
  initialTransaction?: Transaccion;
  getMergedPaymentMethods: () => string[];
  CATEGORIAS_PREDEFINIDAS: any[];
  categorias: Omit<Categoria, 'monto'>[];
  COLOMBIAN_PRODUCTS: string[];
  translateProduct: (pm: string, lang: string) => string | undefined;
  selectedLanguage: string;
  renderCategoriaIcon: (iconName: string, color: string, className?: string) => React.ReactNode;
  triggerDynamicIsland: (title: string, subtext: string, isPositive: boolean) => void;
  playTone: (type: 'tap' | 'success' | 'delete' | 'voice', isMuted: boolean) => void;
  isMuted: boolean;
  formatLocalYYYYMMDD: (d: Date) => string;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  onSave, onCancel, initialTransaction, getMergedPaymentMethods, CATEGORIAS_PREDEFINIDAS,
  categorias, COLOMBIAN_PRODUCTS, translateProduct, selectedLanguage,
  renderCategoriaIcon, triggerDynamicIsland, playTone, isMuted, formatLocalYYYYMMDD
}) => {
  const [popupTipo, setPopupTipo] = useState<TipoMovimiento>(initialTransaction?.tipo || 'Gasto');
  const [popupMonto, setPopupMonto] = useState(initialTransaction?.monto?.toString() || '');
  const [popupCategoria, setPopupCategoria] = useState(initialTransaction?.categoria || (categorias.length > 0 ? categorias[0].nombre : 'Otros'));
  const [popupDescripcion, setPopupDescripcion] = useState(initialTransaction?.descripcion || '');
  const [popupFormaPago, setPopupFormaPago] = useState(initialTransaction?.formaPago || 'Efectivo');
  const [popupFecha, setPopupFecha] = useState(() => {
    if (initialTransaction?.fecha) {
      return initialTransaction.fecha.includes('T') ? initialTransaction.fecha.split('T')[0] : initialTransaction.fecha;
    }
    return new Date().toISOString().substring(0, 10);
  });
  
  const [popupCuotasTotal, setPopupCuotasTotal] = useState<number | undefined>(initialTransaction?.cuotasTotal);
  const [popupEsAutomatica, setPopupEsAutomatica] = useState<boolean>(initialTransaction?.esAutomatica || false);
  
  const [isListening, setIsListening] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  const handleTap = () => {
    playTone('tap', isMuted);
  };

  const extractNumberFromString = (str: string): number => {
    const spanishNumbers: Record<string, number> = {
      'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
      'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
      'veinte': 20, 'treinta': 30, 'cuarenta': 40, 'cincuenta': 50,
      'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90,
      'cien': 100, 'ciento': 100, 'doscientos': 200, 'quinientos': 500,
      'mil': 1000
    };
    const digitsOnly = str.match(/\d+(\.\d+)?/);
    if (digitsOnly) return parseFloat(digitsOnly[0]);
    const words = str.toLowerCase().split(/\s+/);
    let total = 0;
    for (const w of words) if (spanishNumbers[w]) total += spanishNumbers[w];
    return total;
  };

  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        playTone('success', isMuted);
      }
      return;
    }

    playTone('voice', isMuted);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRecognitionError("Tu navegador no soporta reconocimiento de voz.");
      triggerDynamicIsland("Error Micrófono", "Navegador incompatible", false);
      return;
    }

    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    rec.lang = selectedLanguage === 'ES' ? 'es-ES' : 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => { setIsListening(true); setRecognitionError(null); };
    rec.onerror = (e: any) => { console.error(e); setIsListening(false); setRecognitionError("No se pudo detectar el audio"); };
    rec.onend = () => { setIsListening(false); recognitionRef.current = null; };
    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setPopupDescripcion(text);
      const parsedAmount = extractNumberFromString(text);
      if (parsedAmount > 0) {
        setPopupMonto(parsedAmount.toString());
        triggerDynamicIsland("Voz Detectada!", `+$${parsedAmount} • "${text}"`, true);
      } else {
        triggerDynamicIsland("Voz Transcrita", `"${text}"`, true);
      }

      const lower = text.toLowerCase();
      if (lower.includes('comida') || lower.includes('super') || lower.includes('piza') || lower.includes('hamburguesa') || lower.includes('restaurante') || lower.includes('cena')) {
        setPopupCategoria('Alimentación');
      } else if (lower.includes('casa') || lower.includes('alquiler') || lower.includes('mueble') || lower.includes('recibo') || lower.includes('luz')) {
        setPopupCategoria(categorias.length > 0 ? categorias[0].nombre : 'Otros');
      } else if (lower.includes('taxi') || lower.includes('uber') || lower.includes('gasolina') || lower.includes('coche') || lower.includes('metro') || lower.includes('autobus')) {
        setPopupCategoria('Transporte');
      } else if (lower.includes('compra') || lower.includes('ropa') || lower.includes('regalo') || lower.includes('tienda')) {
        setPopupCategoria('Compras');
      } else if (lower.includes('viaje') || lower.includes('avion') || lower.includes('hotel') || lower.includes('vacaciones')) {
        setPopupCategoria('Viajes');
      }
    };

    rec.start();
  };

  const handleGuardarMovimiento = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const num = parseFloat(popupMonto);
    if (!num || num <= 0) return;

    let finalCategory = popupCategoria;
    if (popupTipo === 'Gasto' && (!finalCategory || finalCategory === 'Otros' || finalCategory === '')) {
      const desc = popupDescripcion.trim();
      if (desc) {
        setIsSyncing(true);
        triggerDynamicIsland("Categorizando IA...", "Asignando categoría inteligente", true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch('/api/gemini/categorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: desc,
              categories: categorias.map(c => c.nombre)
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (response.ok) {
            const data = await response.json();
            finalCategory = data?.category || 'Otros';
          } else {
            finalCategory = 'Otros';
          }
        } catch (err) {
          finalCategory = 'Otros';
        } finally {
          setIsSyncing(false);
        }
      } else {
        finalCategory = 'Otros';
      }
    }

    const nueva: Omit<Transaccion, "id"> & { cuotasTotal?: number; esAutomatica?: boolean } = {
      tipo: popupTipo,
      monto: num,
      categoria: popupTipo === 'Gasto' ? finalCategory : undefined,
      fecha: popupFecha || formatLocalYYYYMMDD(new Date()),
      descripcion: popupDescripcion.trim() || (popupTipo === 'Gasto' ? `Gasto en ${finalCategory}` : 'Ingreso manual'),
      formaPago: popupFormaPago || (popupTipo === 'Ingreso' ? 'Efectivo' : getMergedPaymentMethods()[0]) || 'Efectivo',
      cuotasTotal: popupTipo === 'Gasto' ? popupCuotasTotal : undefined,
      esAutomatica: popupTipo === 'Gasto' ? popupEsAutomatica : undefined,
    };

    playTone('success', isMuted);
    triggerDynamicIsland(
      popupTipo === 'Ingreso' ? "¡Ingreso Añadido!" : "¡Gasto Registrado!", 
      `${popupTipo === 'Ingreso' ? '+' : '-'}$${num.toLocaleString('es-ES')}`, 
      popupTipo === 'Ingreso'
    );
    
    onSave(nueva);
    
    // reset form inside
    setPopupMonto('');
    setPopupDescripcion('');
    setPopupCategoria(categorias.length > 0 ? categorias[0].nombre : 'Otros');
    setPopupFecha(new Date().toISOString().substring(0, 10));
    setPopupCuotasTotal(undefined);
    setPopupEsAutomatica(false);
  };

  return (
    <form onSubmit={handleGuardarMovimiento} className="flex-1 flex flex-col overflow-hidden min-h-0 text-left">
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 no-scrollbar pb-3">
        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1 block">Tipo de Flujo</label>
          <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-xl">
            <button
              id="btn-popup-gasto"
              type="button"
              onClick={() => { 
                handleTap(); 
                setPopupTipo('Gasto'); 
                setPopupFormaPago(getMergedPaymentMethods()[0]); 
              }}
              className={`py-2 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${popupTipo === 'Gasto' ? 'bg-[#312E81] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Gasto (Pasivo)
            </button>
            <button
              id="btn-popup-ingreso"
              type="button"
              onClick={() => { 
                handleTap(); 
                setPopupTipo('Ingreso'); 
                setPopupFormaPago('Efectivo');
              }}
              className={`py-2 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${popupTipo === 'Ingreso' ? 'bg-[#10B981] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Ingreso (Activo)
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1 block">Monto total ($)</label>
          <div className="relative flex items-center">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10">
              <DollarSign className="w-5 h-5 text-indigo-600/70 stroke-[2.5]" />
            </div>
            <input
              id="input-monto"
              type="number"
              required
              placeholder="0"
              value={popupMonto}
              onChange={(e) => setPopupMonto(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-10 pr-12 text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />

            <button
              id="btn-mic-recognition"
              type="button"
              onClick={toggleSpeechRecognition}
              className={`absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg cursor-pointer transition-all ${isListening ? 'bg-indigo-500 text-white animate-pulse' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'}`}
              title="Hablar para capturar monto"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          {isListening && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-indigo-600 mt-2 font-semibold flex flex-col gap-1.5 p-3 rounded-lg bg-indigo-50/50 border border-indigo-100"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
                Escuchando voz...
              </span>
              <span className="text-[9px] text-indigo-500 font-normal">
                Di un monto y detalle. Ejemplo: "Cincuenta en almuerzo hoy" o simplemente "Cien".
              </span>
              <div className="flex gap-1 items-end h-3 mt-1 justify-center">
                <span className="w-1 h-2 bg-indigo-500 animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-1 h-3 bg-indigo-600 animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1 h-1 bg-indigo-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
                <span className="w-1 h-2.5 bg-indigo-600 animate-bounce" style={{ animationDelay: '0.45s' }} />
              </div>
              
              <button
                type="button"
                onClick={() => {
                  handleTap();
                  toggleSpeechRecognition();
                }}
                className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all rounded-lg text-white font-black uppercase tracking-wider shadow-sm flex items-center justify-center gap-1"
              >
                <span className="w-2 h-2 bg-white rounded-sm mr-1"></span>
                {selectedLanguage === 'ES' ? 'Finalizar Audio' : 'Stop Audio'}
              </button>
            </motion.div>
          )}
          {recognitionError && (
            <p className="text-[10px] text-rose-500 mt-1 font-semibold">{recognitionError}</p>
          )}
        </div>

        {popupTipo === 'Gasto' && (
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-black block">
                {selectedLanguage === 'ES' ? 'Modificar Categoría' : 'Modify Category'}
              </label>
              <span className="text-[9px] text-teal-700 font-bold bg-teal-50 px-1 rounded animate-pulse">✨ Deja vacío/Otros para usar IA</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-1.5 bg-slate-100 rounded-xl border border-slate-300">
              {categorias.map((c) => {
                const isSel = popupCategoria === c.nombre;
                return (
                  <button
                    id={`btn-popup-cat-${c.nombre}`}
                    key={c.nombre}
                    type="button"
                    onClick={() => { handleTap(); setPopupCategoria(c.nombre); }}
                    className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isSel ? 'border-[#312E81] bg-indigo-200/90 shadow-md ring-1 ring-[#312E81] font-black text-[#2e2a77] scale-102' : 'border-slate-300 bg-white hover:bg-slate-200 text-slate-900 font-black hover:border-slate-400'}`}
                  >
                    {renderCategoriaIcon(c.icon, c.color, "w-5.5 h-5.5 mb-1")}
                    <span className="text-[9.5px] font-black block truncate max-w-full text-slate-950">{c.nombre}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1 block">
            {popupTipo === 'Ingreso' ? 'Tipo de Producto (Destino)' : 'Forma de Pago Vinculada'}
          </label>
          <select
            id="select-forma-pago"
            value={popupFormaPago}
            onChange={(e) => { handleTap(); setPopupFormaPago(e.target.value); }}
            className="w-full bg-slate-50 border border-slate-205 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
          >
            {popupTipo === 'Ingreso' ? (
              ['Efectivo', ...COLOMBIAN_PRODUCTS].map((pm, idx) => (
                <option key={`prod-${idx}`} value={pm}>
                  {translateProduct(pm, selectedLanguage) || pm}
                </option>
              ))
            ) : (
              getMergedPaymentMethods().map((pm, idx) => (
                <option key={`pm-${idx}`} value={pm}>
                  {pm}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1 block">Descripción (Opcional)</label>
          <input
            id="input-descripcion"
            type="text"
            maxLength={40}
            placeholder={popupTipo === 'Gasto' ? 'Ej: Supermercado, Alquiler...' : 'Ej: Pago de servicios, Nómina...'}
            value={popupDescripcion}
            onChange={(e) => setPopupDescripcion(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1 block">Fecha del Movimiento</label>
          <input
            id="input-fecha-movimiento"
            type="date"
            value={popupFecha}
            onChange={(e) => { handleTap(); setPopupFecha(e.target.value); }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        {popupTipo === 'Gasto' && (
          <div className="space-y-3.5 pt-1.5 border-t border-dashed border-slate-250">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1 block">
                {selectedLanguage === 'ES' ? 'Cuotas totales (Opcional)' : 'Total Installments (Optional)'}
              </label>
              <input
                type="number"
                min="1"
                max="24"
                placeholder={selectedLanguage === 'ES' ? 'Ej: 3 (Sin cuotas si vacío)' : 'e.g. 3 (Leave empty for no installments)'}
                value={popupCuotasTotal || ''}
                onChange={(e) => {
                  handleTap();
                  setPopupCuotasTotal(e.target.value ? parseInt(e.target.value) : undefined);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {popupCuotasTotal !== undefined && popupCuotasTotal > 1 && (
              <div className="flex items-center gap-2.5 bg-indigo-50/50 p-3 border border-indigo-100/30 rounded-xl">
                <input
                  type="checkbox"
                  id="chk-es-automatica"
                  checked={popupEsAutomatica}
                  onChange={(e) => {
                    handleTap();
                    setPopupEsAutomatica(e.target.checked);
                  }}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="chk-es-automatica" className="text-[10.5px] font-black text-slate-700 cursor-pointer select-none">
                  {selectedLanguage === 'ES' ? '¿Carga automática mes a mes?' : 'Automatic charge month to month?'}
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2.5 pt-3 border-t border-slate-100 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)] mt-auto flex-shrink-0">
        <button
          id="btn-popup-cancel"
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-250 rounded-xl cursor-pointer text-center border border-slate-200"
        >
          Cancelar
        </button>
        <button
          id="btn-popup-save"
          type="submit"
          disabled={isSyncing}
          className={`flex-1 py-3 text-xs font-black text-white ${isSyncing ? 'bg-indigo-300 cursor-not-allowed' : 'bg-[#312E81] hover:bg-[#252361] shadow-md shadow-indigo-150 cursor-pointer'} rounded-xl text-center`}
        >
          {isSyncing ? 'Guardando...' : 'Guardar Movimiento'}
        </button>
      </div>
    </form>
  );
};
