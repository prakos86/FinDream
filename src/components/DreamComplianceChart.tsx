import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, Calendar, TrendingUp, Plus, Trash2, Check, ArrowRight, X, MoreHorizontal, Expand, History, PlusCircle } from 'lucide-react';
import { Sueno, Transaccion, HistoricoAvance, UserProfile } from '../types';
import { DreamSavingsInsights } from './DreamSavingsInsights';

interface DreamComplianceChartProps {
  suenos: Sueno[];
  activeSuenoId: string;
  realAhorroNeto: number;
  totalActivos: number;
  totalPasivos: number;
  selectedCountry: 'CO' | 'US' | 'ES' | 'MX';
  selectedLanguage: string;
  onSelectSueno: (id: string) => void;
  onAddSueno: (nombre: string, meta: number, manualRate: number, usarReal: boolean) => void;
  onUpdateSueno: (sueno: Sueno) => void;
  onDeleteSueno: (id: string) => void;
  transacciones: Transaccion[];
  userProfile?: UserProfile;
  saveUserProfileData?: (updated: UserProfile) => void;
}

export const DreamComplianceChart: React.FC<DreamComplianceChartProps> = ({
  suenos,
  activeSuenoId,
  realAhorroNeto,
  totalActivos,
  totalPasivos,
  selectedCountry,
  selectedLanguage,
  onSelectSueno,
  onAddSueno,
  onUpdateSueno,
  onDeleteSueno,
  transacciones,
  userProfile,
  saveUserProfileData,
}) => {
  const [distribucion, setDistribucion] =
    React.useState<{ [id: string]: number }>(() => {
      if (suenos.length === 0) return {};
      const base = Math.floor(100 / suenos.length);
      const resto = 100 - base * suenos.length;
      return suenos.reduce((acc, s, i) => ({
        ...acc,
        [s.id]: base + (i === 0 ? resto : 0),
      }), {});
    });

  React.useEffect(() => {
    setDistribucion(prev => {
      const next: { [id: string]: number } = {};
      const ids = suenos.map(s => s.id);
      let asignado = 0;
      ids.forEach((id, i) => {
        if (i < ids.length - 1) {
          next[id] = prev[id] ?? Math.floor(100 / ids.length);
          asignado += next[id];
        } else {
          next[id] = Math.max(0, 100 - asignado);
        }
      });
      return next;
    });
  }, [suenos.length]);

  const handleDistribucionChange = (idCambiado: string, nuevoPct: number) => {
    const pct = Math.min(100, Math.max(0, Math.round(nuevoPct)));
    const otrosIds = suenos.map(s => s.id).filter(id => id !== idCambiado);
    if (otrosIds.length === 0) return;
    const restante = 100 - pct;
    const totalOtros = otrosIds.reduce(
      (sum, id) => sum + (distribucion[id] || 0), 0
    );
    const next: { [id: string]: number } = { [idCambiado]: pct };
    otrosIds.forEach((id, i) => {
      if (i < otrosIds.length - 1) {
        const prop = totalOtros > 0
          ? Math.round((distribucion[id] / totalOtros) * restante)
          : Math.floor(restante / otrosIds.length);
        next[id] = prop;
      } else {
        const yaAsignado = Object.keys(next).reduce((sum, key) => sum + (next[key] || 0), 0);
        next[id] = Math.max(0, 100 - yaAsignado);
      }
    });
    setDistribucion(next);
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSuenoId, setEditingSuenoId] = useState<string | null>(null);
  const [aporteInputs, setAporteInputs] = useState<{ [key: string]: string }>({});
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null);
  const [newDreamName, setNewDreamName] = useState('');
  const [newDreamMeta, setNewDreamMeta] = useState<number>(10000);
  const [newDreamRate, setNewDreamRate] = useState<number>(800);
  const [newDreamUseReal, setNewDreamUseReal] = useState<boolean>(false);

  // AI recommendations state
  const [chartViewMode, setChartViewMode] = useState<'all' | 'selected'>('all');
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendTargetMode, setRecommendTargetMode] = useState<'exist' | 'new'>('exist');
  const [aiRecommendationMsg, setAiRecommendationMsg] = useState<{
    sufficientInfo: boolean;
    recommendedMeta: number;
    recommendedMonthlyAhorro: number;
    explanation: string;
    bullets?: string[];
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- INICIO DE DETECTORES Y CÁLCULOS DETERMINISTAS (FASE 1) ---
  const getMonthsOfHistoryDet = () => {
    if (!transacciones || transacciones.length === 0) return 0;
    const uniqueMonths = new Set<string>();
    transacciones.forEach(t => {
      if (t.fecha) {
        const yyyymm = t.fecha.substring(0, 7);
        if (yyyymm && yyyymm.length === 7) {
          uniqueMonths.add(yyyymm);
        }
      }
    });
    return uniqueMonths.size;
  };

  const calculateDeterministicIntelligence = () => {
    const historicalMonthsCount = getMonthsOfHistoryDet();

    const monthlySurpluses: { [month: string]: number } = {};
    const monthlyIngresos: { [month: string]: number } = {};
    const monthlyGastos: { [month: string]: number } = {};
    const categoryTotals: { [category: string]: number } = {};

    transacciones.forEach(t => {
      const date = t.fecha || new Date().toISOString().split('T')[0];
      const month = date.substring(0, 7);
      
      if (!monthlyIngresos[month]) monthlyIngresos[month] = 0;
      if (!monthlyGastos[month]) monthlyGastos[month] = 0;

      if (t.tipo === 'Ingreso') {
        monthlyIngresos[month] += t.monto;
      } else {
        monthlyGastos[month] += t.monto;
        if (t.categoria) {
          const cat = t.categoria;
          categoryTotals[cat] = (categoryTotals[cat] || 0) + t.monto;
        }
      }
    });

    const uniqueMonths = Object.keys(monthlyIngresos);
    let totalSurplusSum = 0;
    uniqueMonths.forEach(m => {
      totalSurplusSum += (monthlyIngresos[m] - (monthlyGastos[m] || 0));
    });

    const averageSurplus = uniqueMonths.length > 0 
      ? Math.round(totalSurplusSum / uniqueMonths.length)
      : 0;

    let maxCatName = '';
    let maxCatAmount = 0;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > maxCatAmount) {
        maxCatAmount = amt;
        maxCatName = cat;
      }
    });

    const monthlyAverageForMaxCat = uniqueMonths.length > 0 
      ? Math.round(maxCatAmount / uniqueMonths.length)
      : maxCatAmount;

    const allocationPercentage = 60;
    const recommendedMonthlyAllocation = Math.max(10, Math.round(averageSurplus * (allocationPercentage / 100)));

    return {
      historicalMonthsCount,
      averageSurplus,
      recommendedMonthlyAllocation,
      maxCatName: maxCatName || (selectedLanguage === 'ES' ? 'Gastos Varios' : 'General Expenses'),
      monthlyAverageForMaxCat,
      allocationPercentage
    };
  };

  const getProjectedDateStr = (months: number) => {
    if (months === Infinity || isNaN(months) || months <= 0) return '';
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    const monthsNamesEs = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthsNamesEn = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const isEs = selectedLanguage === 'ES';
    const monthName = isEs ? monthsNamesEs[date.getMonth()] : monthsNamesEn[date.getMonth()];
    return `${monthName} ${date.getFullYear()}`;
  };

  const handleSuggestFeedback = (recommendationId: string, feedbackType: 'util' | 'noutil') => {
    if (!saveUserProfileData || !userProfile) return;
    const currentFeedback = userProfile.ia_feedback || {};
    const updatedFeedback = {
      ...currentFeedback,
      [recommendationId]: feedbackType
    };
    saveUserProfileData({
      ...userProfile,
      ia_feedback: updatedFeedback
    });
  };
  // --- FIN DE DETECTORES Y CÁLCULOS DETERMINISTAS (FASE 1) ---

  // Manual inputs for the "Insufficient Info" path (Camino 2)
  const [manualIncomeInput, setManualIncomeInput] = useState<string>('');
  const [manualExpenseInput, setManualExpenseInput] = useState<string>('');

  // Helper formatting values
  const formatMoney = (val: number) => {
    return val.toLocaleString('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const getMonthsOfHistory = () => {
    if (!transacciones || transacciones.length === 0) return 0;
    const uniqueMonths = new Set<string>();
    transacciones.forEach(t => {
      if (t.fecha) {
        const yyyymm = t.fecha.substring(0, 7); // e.g. "2026-05"
        if (yyyymm && yyyymm.length === 7) {
          uniqueMonths.add(yyyymm);
        }
      }
    });
    return uniqueMonths.size;
  };

  const handleAiRecommend = async (
    targetMode: 'exist' | 'new',
    overrideIncome?: number,
    overrideExpense?: number
  ) => {
    setIsRecommending(true);
    setErrorMsg(null);
    setRecommendTargetMode(targetMode);

    const dreamName = targetMode === 'new' ? newDreamName : (activeSueno ? activeSueno.nombre : '');
    const currentMeta = targetMode === 'new' ? newDreamMeta : (activeSueno ? activeSueno.meta : 10000);

    const monthsOfHistory = getMonthsOfHistory();

    // Challenge condition: < 3 months of history AND no manual input provided yet
    if (monthsOfHistory < 3 && overrideIncome === undefined && overrideExpense === undefined) {
      setAiRecommendationMsg({
        sufficientInfo: false,
        recommendedMeta: currentMeta || 10005,
        recommendedMonthlyAhorro: 500,
        explanation: selectedLanguage === 'ES' 
          ? "No contamos con suficiente información en tu historial (mínimo 3 meses) para calcular automáticamente tu capacidad de ahorro. Por favor, indícanos tus ingresos y egresos promedios mensuales para realizar la recomendación inteligente."
          : "Your active account history is insufficient (minimum 3 months of logs) to perform automatic trend calculations. Please tell us your actual average monthly income and expenses to formulate a high-fidelity intelligent recommendation.",
        bullets: []
      });
      setIsRecommending(false);
      return;
    }

    const finalIncomes = overrideIncome !== undefined ? overrideIncome : (manualIncomeInput ? Number(manualIncomeInput) : totalActivos);
    const finalExpenses = overrideExpense !== undefined ? overrideExpense : (manualExpenseInput ? Number(manualExpenseInput) : totalPasivos);

    if (targetMode === 'new' && !dreamName.trim()) {
      setErrorMsg("Por favor, escribe primero el nombre de lo que sueñas lograr para calcular la recomendación.");
      setIsRecommending(false);
      return;
    }

    try {
      const response = await fetch("/api/gemini/recommend-goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalActivos: finalIncomes,
          totalPasivos: finalExpenses,
          dreamName: dreamName,
          currentMeta: currentMeta,
          countryName: selectedCountry === 'CO' ? 'Colombia' : selectedCountry === 'US' ? 'United States' : selectedCountry === 'ES' ? 'Spain' : 'Mexico',
          language: selectedLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo obtener la recomendación de la IA.");
      }

      const data = await response.json();
      if (data && data.hasOwnProperty('sufficientInfo')) {
        setAiRecommendationMsg({
          sufficientInfo: true, // Force to true here because custom inputs were filled OR we have >= 3 months history
          recommendedMeta: Number(data.recommendedMeta),
          recommendedMonthlyAhorro: Number(data.recommendedMonthlyAhorro),
          explanation: data.explanation || "",
          bullets: data.bullets || [],
        });

        setManualIncomeInput(String(finalIncomes));
        setManualExpenseInput(String(finalExpenses));
      } else {
        throw new Error("Respuesta inválida de la IA.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Ocurrió un error.");
    } finally {
      setIsRecommending(false);
    }
  };

  const applyRecommendation = () => {
    if (!aiRecommendationMsg) return;
    if (recommendTargetMode === 'exist' && activeSueno) {
      onUpdateSueno({
        ...activeSueno,
        meta: aiRecommendationMsg.recommendedMeta,
        ahorroManual: aiRecommendationMsg.recommendedMonthlyAhorro,
        usarReal: false
      });
    } else {
      setNewDreamMeta(aiRecommendationMsg.recommendedMeta);
      setNewDreamRate(aiRecommendationMsg.recommendedMonthlyAhorro);
      setNewDreamUseReal(false);
    }
    setAiRecommendationMsg(null);
  };

  // Find the selected dream or default to the first one
  const activeSueno = suenos.find(s => s.id === activeSuenoId) || suenos[0];

  if (!activeSueno) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-250 text-left space-y-4">
          <div className="border-b border-slate-200 pb-2.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#008B81] flex items-center gap-1">
              <Sparkles className="w-4 h-4 animate-pulse" /> PLAN DE SUEÑOS
            </span>
            <h3 className="text-base font-black text-slate-900 mt-1">Registrar tu Primer Sueño</h3>
            <p className="text-[11px] text-slate-505 font-medium leading-relaxed">
              Comienza ingresando aquello que deseas lograr sin pre-cargar datos ficticios.
            </p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (!newDreamName.trim()) return;
              onAddSueno(newDreamName.trim(), newDreamMeta || 10000, newDreamRate || 800, newDreamUseReal);
              setNewDreamName('');
            }}
            className="space-y-4"
          >
            {/* Dream name input */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10.5px] font-black text-slate-800 uppercase tracking-wide block">¿Qué sueñas lograr?</label>
              <input
                type="text"
                required
                placeholder="Ej: Deudas, Comprar mi Carro, Maestría..."
                value={newDreamName}
                onChange={(e) => setNewDreamName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-400 rounded-xl p-3 text-xs font-bold text-slate-950 focus:outline-[#008B81] focus:ring-1 focus:ring-[#008B81] placeholder:text-slate-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* Meta input */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center h-5">
                  <label className="text-[10.5px] font-black text-slate-800 uppercase tracking-wide block">Meta Total ($)</label>
                </div>
                <input
                  type="number"
                  min="100"
                  required
                  value={newDreamMeta}
                  onChange={(e) => setNewDreamMeta(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-400 rounded-xl p-3 text-xs font-black text-slate-950 focus:outline-[#008B81] focus:ring-1 focus:ring-[#008B81] transition-all"
                />
              </div>

              {/* Saving rate manual input with IA recomendar */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center h-5">
                  <label className="text-[10.5px] font-black text-slate-800 uppercase tracking-wide block">Ahorro Mensual ($)</label>
                  <button
                    type="button"
                    disabled={isRecommending}
                    onClick={() => handleAiRecommend('new')}
                    title="Sugerir cuota de ahorro con IA"
                    className="flex items-center justify-center p-0.5 bg-teal-50 hover:bg-teal-100 disabled:opacity-50 text-teal-700 rounded-md transition-all cursor-pointer border border-teal-200/50 hover:scale-105"
                  >
                    {isRecommending && recommendTargetMode === 'new' ? (
                      <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-teal-650 border-t-transparent rounded-full" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                    )}
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  required
                  value={newDreamRate}
                  onChange={(e) => setNewDreamRate(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-400 rounded-xl p-3 text-xs font-black text-slate-950 focus:outline-[#008B81] focus:ring-1 focus:ring-[#008B81] transition-all"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">{errorMsg}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-[#00897B] hover:bg-[#00796B] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition active:scale-98 cursor-pointer text-center"
            >
              + Guardar mi Sueño
            </button>
          </form>
        </div>

        {/* --- DETAILED BULLETED AI INSIGHT CARD --- */}
        {aiRecommendationMsg && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-teal-100 text-left space-y-4 bg-gradient-to-br from-teal-50/20 to-indigo-50/25"
          >
            <div className="flex items-center gap-2 pb-2.5 border-b border-indigo-50">
              <Sparkles className="w-4.5 h-4.5 text-[#008B81] animate-pulse" strokeWidth={2.5} stroke="currentColor" />
              <span className="text-[11.5px] font-black text-slate-800 uppercase tracking-wider">
                Asesoría de Ahorro IA • {recommendTargetMode === 'new' ? (newDreamName || 'Nuevo Sueño') : ''}
              </span>
            </div>

            {!aiRecommendationMsg.sufficientInfo ? (
              /* Insufficient Info Pathway (Camino 2) */
              <div className="space-y-4">
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-250/60 text-[11px] leading-relaxed text-amber-900 font-bold">
                  ⚠️ <strong className="text-amber-955 block mb-1">Información Financiera Insuficiente:</strong>
                  <p className="font-semibold text-slate-755">
                    {aiRecommendationMsg.explanation}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-white/70 p-4 rounded-2xl border border-slate-250 shadow-sm">
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-black text-slate-900 uppercase tracking-wide block">Ingresos Estimados ($ / mes)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ej: 3000"
                      value={manualIncomeInput}
                      onChange={(e) => setManualIncomeInput(e.target.value)}
                      className="w-full bg-white rounded-xl border border-slate-400 px-3 py-2 text-xs font-bold text-slate-950 focus:outline-[#008B81] focus:ring-1 focus:ring-[#008B81]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-black text-slate-900 uppercase tracking-wide block">Egresos / Deudas ($ / mes)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ej: 1800"
                      value={manualExpenseInput}
                      onChange={(e) => setManualExpenseInput(e.target.value)}
                      className="w-full bg-white rounded-xl border border-slate-400 px-3 py-2 text-xs font-bold text-slate-950 focus:outline-[#008B81] focus:ring-1 focus:ring-[#008B81]"
                    />
                  </div>
                </div>

                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    disabled={isRecommending || !manualIncomeInput || Number(manualIncomeInput) <= 0}
                    onClick={() => handleAiRecommend(recommendTargetMode, Number(manualIncomeInput), Number(manualExpenseInput))}
                    className="flex-1 py-3 bg-[#008B81] hover:bg-[#00766e] disabled:opacity-50 text-white font-black text-xs rounded-xl cursor-pointer transition active:scale-97 flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    {isRecommending ? (
                      <>
                        <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                        <span>Evaluando Datos...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        <span>Calcular con estos Datos 🪄</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiRecommendationMsg(null)}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer transition"
                  >
                    Omitir
                  </button>
                </div>
              </div>
            ) : (
              /* Sufficient Info Pathway (Camino 1) */
              <>
                <div className="text-[11px] leading-relaxed text-slate-705 bg-white border border-teal-50 rounded-xl p-3 shadow-xs font-semibold">
                  💡 <strong className="text-slate-800">Propuesta IA:</strong> Meta de <strong className="text-slate-950">${formatMoney(aiRecommendationMsg.recommendedMeta)}</strong> con ahorro mensual de <strong className="text-indigo-900">${formatMoney(aiRecommendationMsg.recommendedMonthlyAhorro)}</strong>.
                  {getMonthsOfHistory() >= 3 ? (
                    <div className="mt-1.5 pl-2 border-l-2 border-teal-500 text-[10px] text-[#00796B] font-bold bg-teal-50/55 py-1 px-1.5 rounded-r">
                      ℹ️ Esta recomendación ha sido calculada de forma personalizada con base en el historial acumulado de tus movimientos reales ({getMonthsOfHistory()} meses).
                    </div>
                  ) : (
                    <div className="mt-1.5 pl-2 border-l-2 border-indigo-505 text-[10px] text-indigo-800 font-bold bg-indigo-50/55 py-1 px-1.5 rounded-r">
                      ℹ️ Esta recomendación ha sido calculada con base en los promedios mensuales de ingresos y egresos ingresados.
                    </div>
                  )}
                  <div className="text-[10.5px] text-slate-605 mt-1.5 font-semibold leading-normal font-sans">
                    {aiRecommendationMsg.explanation}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Plan de Acción Recomendado:</span>
                  <ul className="space-y-1.5 font-sans">
                    {aiRecommendationMsg.bullets && aiRecommendationMsg.bullets.length > 0 ? (
                      aiRecommendationMsg.bullets.map((bullet, idx) => (
                        <li key={idx} className="text-[11px] text-slate-600 flex items-start gap-2 leading-relaxed font-semibold">
                          <span className="text-[#008B81] text-xs font-black mt-0.5">✔</span>
                          <span>{bullet}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[11px] text-slate-600 flex items-start gap-2 leading-relaxed font-semibold">
                        <span className="text-[#008B81] text-xs font-black mt-0.5">✔</span>
                        <span>Optimiza tu presupuesto reduciendo el gasto discrecional no esencial en un 15%.</span>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={applyRecommendation}
                    className="flex-1 py-2.5 bg-[#008B81] hover:bg-[#00766e] text-white font-black text-xs rounded-xl cursor-pointer transition active:scale-97 flex items-center justify-center gap-1.5 shadow-xs animate-pulse hover:animate-none"
                  >
                    <Check className="w-4 h-4 stroke-[3px]" />
                    <span>Aplicar recomendación ✅</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiRecommendationMsg(null)}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer transition"
                  >
                    Omitir
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    );
  }

  // Calculated active savings rate
  const activeAhorroNeto = activeSueno.usarReal ? Math.max(0, realAhorroNeto) : activeSueno.ahorroManual;

  // Month of compliance
  const activeRemainingMeta = Math.max(0, activeSueno.meta - (activeSueno.ahorroAcumulado || 0));
  const mesCumplimientoReal = activeAhorroNeto > 0 ? activeRemainingMeta / activeAhorroNeto : 0;

  // Dimensions of SVG Chart representation
  const width = 340;
  const height = 190;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 15;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate scaling factors
  const computeXMax = () => {
    let maxMonths = 12; // Minimum 1 year view length
    const dreamsToChart = chartViewMode === 'selected' ? [activeSueno] : suenos;
    dreamsToChart.forEach(s => {
      const sAhorro = s.usarReal ? Math.max(0, realAhorroNeto) : s.ahorroManual;
      const sRemaining = Math.max(0, s.meta - (s.ahorroAcumulado || 0));
      if (sRemaining > 0 && sAhorro > 0) {
        const monthsRequired = Math.ceil(sRemaining / sAhorro);
        maxMonths = Math.max(maxMonths, monthsRequired);
      } else if (sRemaining > 0 && sAhorro === 0) {
        maxMonths = Math.max(maxMonths, 36);
      }
    });
    return Math.min(maxMonths, 120); // Cap at 10 years to prevent infinite stretching
  };
  const xMax = computeXMax();

  const computeYMax = () => {
    if (chartViewMode === 'selected') {
      const activeAhorro = activeSueno.usarReal ? Math.max(0, realAhorroNeto) : activeSueno.ahorroManual;
      return Math.max(activeSueno.meta, (activeSueno.ahorroAcumulado || 0) + (activeAhorro * xMax), 100);
    } else {
      let maxVal = 100;
      suenos.forEach(s => {
        const sAhorro = s.usarReal ? Math.max(0, realAhorroNeto) : s.ahorroManual;
        maxVal = Math.max(maxVal, s.meta, (s.ahorroAcumulado || 0) + (sAhorro * xMax));
      });
      return maxVal;
    }
  };
  const yMax = computeYMax();

  // Map month m (0-xMax) and value y ($) to SVG coordinates
  const getX = (m: number) => paddingLeft + (m / xMax) * chartWidth;
  const getY = (y: number) => {
    const pct = Math.min(1, Math.max(0, y / yMax));
    return (height - paddingBottom) - pct * chartHeight;
  };

  // Points path for the projection line
  const activeAccumulated = activeSueno.ahorroAcumulado || 0;
  const p0_x = getX(0);
  const p0_y = getY(activeAccumulated);
  const pxMax_x = getX(xMax);
  const pxMax_y = getY(activeAccumulated + activeAhorroNeto * xMax);

  const isFulfilledInChart = mesCumplimientoReal > 0 && mesCumplimientoReal <= xMax && activeRemainingMeta > 0;
  const dotX = isFulfilledInChart ? getX(mesCumplimientoReal) : null;
  const dotY = isFulfilledInChart ? getY(activeSueno.meta) : null;

  // Generate SVG path coordinate strings
  const projectionLinePath = `M ${p0_x} ${p0_y} L ${pxMax_x} ${pxMax_y}`;
  const projectionAreaPath = `M ${p0_x} ${p0_y} L ${pxMax_x} ${pxMax_y} L ${pxMax_x} ${height - paddingBottom} L ${p0_x} ${height - paddingBottom} Z`;

  // Horizontal Grid Labels & Lines (0%, 50%, 100% of yMax)
  const gridLevels = [0, 0.5, 1.0];

  const handleAgregarAporte = (s: Sueno, e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const aporteVal = Number(aporteInputs[s.id] || 0);
    if (aporteVal <= 0) return;

    const currentAcumulado = s.ahorroAcumulado || 0;
    const newAcumulado = currentAcumulado + aporteVal;
    const newHistoryEntry: HistoricoAvance = {
      id: Math.random().toString(36).substr(2, 9),
      fecha: new Date().toISOString(),
      monto: aporteVal,
    };

    const newHistory = [...(s.historialAvances || []), newHistoryEntry];
    onUpdateSueno({ ...s, ahorroAcumulado: newAcumulado, historialAvances: newHistory });

    setAporteInputs(prev => ({ ...prev, [s.id]: '' }));
  };

  const handleCreateDreamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDreamName.trim()) return;
    onAddSueno(newDreamName.trim(), newDreamMeta, newDreamRate, newDreamUseReal);
    setNewDreamName('');
    setShowAddForm(false);
  };

  const intelGlobal = calculateDeterministicIntelligence();
  const ahorroPotencialGlobal = intelGlobal.averageSurplus;

  return (
    <div className="space-y-5">
      {/* --- SUEÑOS SELECTOR RAIL --- */}
      <div className="bg-white rounded-[25px] p-5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] border border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl flex-shrink-0 animate-pulse border border-indigo-100/50">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-widest block">Mis Sueños Activos</h4>
              <p className="text-[10px] text-slate-400 font-semibold leading-tight mt-0.5">({suenos.length}) registrados</p>
            </div>
          </div>
        </div>

        {suenos.length > 1 && ahorroPotencialGlobal > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-teal-100 shadow-xs mb-4 text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <p className="text-[11px] font-black uppercase text-slate-800 tracking-wider">
                  {selectedLanguage === 'ES' ? 'Distribuye tu ahorro' : 'Distribute savings'}
                </p>
              </div>
              <span className="text-sm font-black text-teal-600">
                ${ahorroPotencialGlobal.toLocaleString(
                  selectedLanguage === 'ES' ? 'es-CO' : 'en-US'
                )}/mes
              </span>
            </div>

            <div className="space-y-3">
              {suenos.map((s) => {
                const pct = distribucion[s.id] ?? Math.floor(100 / suenos.length);
                const monto = Math.round(ahorroPotencialGlobal * pct / 100);
                return (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-700 w-24 truncate text-left">
                        {s.nombre}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={pct}
                        onChange={e => handleDistribucionChange(s.id, Number(e.target.value))}
                        className="w-14 text-center text-[12px] font-black border border-slate-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                      <span className="text-[11px] text-slate-400 font-bold">%</span>
                      <span className="ml-auto text-[11px] font-black text-teal-600 font-mono">
                        ${monto.toLocaleString(
                          selectedLanguage === 'ES' ? 'es-CO' : 'en-US'
                        )}/mes
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={e => handleDistribucionChange(s.id, Number(e.target.value))}
                      className="w-full accent-teal-500 h-1.5 cursor-pointer"
                    />
                  </div>
                );
              })}

              <div className="flex justify-end pt-1">
                {(() => {
                  const total = Object.keys(distribucion).reduce((sum, key) => sum + (distribucion[key] || 0), 0);
                  return (
                    <span className={`text-[10px] font-black ${
                      total === 100 ? 'text-emerald-600' : 'text-rose-500'
                    }`}>
                      Total: {total}% {total === 100 ? '✓' : '⚠️'}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Existing dreams list selection with quick status */}
        <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1 no-scrollbar">
          {suenos.map((s) => {
            const pctSueno = distribucion[s.id] ?? Math.floor(100 / suenos.length);
            const ahorroPotencialSueno = Math.round(ahorroPotencialGlobal * pctSueno / 100);
            const isSelected = s.id === activeSueno.id;
            const sAhorro = s.usarReal ? Math.max(0, realAhorroNeto) : s.ahorroManual;
            const progressPct = Math.min(100, Math.round(((s.ahorroAcumulado || 0) / s.meta) * 100));
            return (
              <div key={s.id} className="p-0.5 border border-transparent space-y-2">
                <div
                  onClick={() => onSelectSueno(s.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 relative group hover:scale-[1.01] ${
                    isSelected
                      ? 'bg-gradient-to-tr from-[#1E1B4B] to-[#312E81] text-white border-transparent shadow-md shadow-indigo-150/50'
                      : 'bg-slate-50 text-slate-800 border-slate-200/80 hover:bg-slate-100/90'
                  }`}
                >
                <div className="flex justify-between items-center w-full">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-teal-400 animate-pulse' : 'bg-slate-400'}`} />
                    <span className="font-extrabold text-sm">{s.nombre}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-black">
                    <span className={isSelected ? "text-teal-300" : "text-indigo-650"}>Meta: ${formatMoney(s.meta)}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-teal-400 stroke-[3.5px] mr-1" />}
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSuenoId(editingSuenoId === s.id ? null : s.id);
                      }}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                        isSelected 
                          ? 'text-indigo-200 hover:text-white hover:bg-indigo-500/30' 
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                      }`}
                      title={selectedLanguage === 'ES' ? 'Editar sueño' : 'Edit dream'}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSueno(s.id);
                      }}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                        isSelected 
                          ? 'text-rose-300 hover:text-white hover:bg-rose-500/20' 
                          : 'text-rose-400 hover:text-rose-600 hover:bg-rose-100/50'
                      }`}
                      title={selectedLanguage === 'ES' ? 'Eliminar sueño' : 'Delete dream'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-[10.5px] font-medium pb-1.5 pt-1">
                  <span className="text-slate-600">Plan: <strong className={isSelected ? "text-teal-200" : "text-indigo-900"}>${formatMoney(sAhorro)}/mes</strong></span>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-slate-600 flex items-center gap-1 font-extrabold text-[11px]">
                      Avance: <span className={isSelected ? "text-white" : "text-teal-700"}>${formatMoney(s.ahorroAcumulado || 0)}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isSelected ? 'bg-teal-500/30 text-teal-100' : 'bg-teal-100 text-teal-800'}`}>
                        {progressPct}%
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex justify-between mt-1 mb-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>+ Aportar: $</span>
                    <input
                      type="number"
                      value={aporteInputs[s.id] || ''}
                      placeholder="0"
                      onChange={(e) => setAporteInputs(prev => ({ ...prev, [s.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAgregarAporte(s, e);
                      }}
                      className={`w-20 bg-transparent border-b ${isSelected ? 'border-teal-400 text-white placeholder:text-teal-200/50 focus:border-white' : 'border-slate-400 text-teal-800 placeholder:text-slate-400 focus:border-teal-600'} font-bold focus:outline-none px-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors max-w-[80px] text-[11px]`} 
                    />
                    <button
                      type="button"
                      onClick={(e) => handleAgregarAporte(s, e)}
                      disabled={!aporteInputs[s.id] || Number(aporteInputs[s.id]) <= 0}
                      className={`p-1 rounded-full p-0.5 disabled:opacity-50 transition-all cursor-pointer ${isSelected ? 'bg-teal-400 text-indigo-900 hover:bg-teal-300' : 'bg-teal-600 text-white hover:bg-teal-500'}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHistoryId(showHistoryId === s.id ? null : s.id);
                    }}
                    className={`flex items-center gap-1 text-[9.5px] font-bold px-2 py-1 rounded-lg transition-all ${isSelected ? 'bg-indigo-800/50 text-indigo-200 hover:bg-indigo-700/50' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <History className="w-3 h-3" />
                  </button>
                </div>

                <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    className={`h-full rounded-full ${isSelected ? 'bg-teal-400' : 'bg-teal-500'}`} 
                  />
                </div>

                <AnimatePresence>
                  {showHistoryId === s.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 text-left" onClick={(e) => e.stopPropagation()}>
                        <h5 className={`text-[9.5px] font-black uppercase tracking-wider mb-2 ${isSelected ? 'text-indigo-300' : 'text-slate-500'}`}>Histórico de Avances</h5>
                        {(!s.historialAvances || s.historialAvances.length === 0) ? (
                          <div className={`p-2 rounded-lg text-center text-[10px] ${isSelected ? 'bg-indigo-900/30 text-indigo-200/60' : 'bg-slate-50 text-slate-400'}`}>
                            Sin aportes registrados aún.
                          </div>
                        ) : (
                          <div className="max-h-[100px] overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                            {[...s.historialAvances].reverse().map((h) => (
                              <div key={h.id} className={`flex justify-between items-center p-1.5 rounded-lg text-[10px] ${isSelected ? 'bg-indigo-800/40 text-indigo-100' : 'bg-slate-50 border border-slate-100 text-slate-700'}`}>
                                <span className={isSelected ? 'text-indigo-300' : 'text-slate-400'}>
                                  {new Date(h.fecha).toLocaleDateString(selectedLanguage === 'ES' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short' })}
                                </span>
                                <span className="font-extrabold">+${formatMoney(h.monto)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {editingSuenoId === s.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-slate-200/20 space-y-3 font-sans text-left" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1">
                          <label className={`text-[10px] font-black uppercase tracking-wide ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>Nombre del sueño (¿Qué deseas lograr?)</label>
                          <input
                            type="text"
                            value={s.nombre}
                            onChange={(e) => onUpdateSueno({ ...s, nombre: e.target.value })}
                            className={`w-full rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-none transition-colors shadow-inner ${isSelected ? 'bg-indigo-900/40 text-white placeholder:text-indigo-300 border-indigo-400/30 border' : 'bg-white text-slate-800 border border-slate-300 focus:border-indigo-400'}`}
                          />
                          <p className={`text-[9px] font-medium px-1 ${isSelected ? 'text-indigo-200/70' : 'text-slate-450'}`}>Ej: Pagar mis Deudas, Comprar Computadora</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 font-sans text-left">
                          <div className="space-y-1">
                            <label className={`text-[10px] font-black uppercase tracking-wide ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>Meta Total ($)</label>
                            <input
                              type="number"
                              value={s.meta || ''}
                              onChange={(e) => onUpdateSueno({ ...s, meta: Math.max(1, Number(e.target.value)) })}
                              className={`w-full rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-none transition-colors shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isSelected ? 'bg-indigo-900/40 text-white placeholder:text-indigo-300 border-indigo-400/30 border' : 'bg-white text-slate-800 border border-slate-300 focus:border-indigo-400'}`}
                            />
                            <p className={`text-[9px] font-medium px-1 ${isSelected ? 'text-indigo-200/70' : 'text-slate-450'}`}>Monto total a acumular</p>
                          </div>
                          <div className="space-y-1">
                            <label className={`text-[10px] font-black uppercase tracking-wide ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>Ahorro / Mes ($)</label>
                            <input
                              type="number"
                              value={s.ahorroManual || ''}
                              onChange={(e) => onUpdateSueno({ ...s, ahorroManual: Math.max(1, Number(e.target.value)) })}
                              className={`w-full rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-none transition-colors shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isSelected ? 'bg-indigo-900/40 text-white placeholder:text-indigo-300 border-indigo-400/30 border' : 'bg-white text-slate-800 border border-slate-300 focus:border-indigo-400'}`}
                            />
                            <p className={`text-[9px] font-medium px-1 ${isSelected ? 'text-indigo-200/70' : 'text-slate-450'}`}>Tu cuota mensual planificada</p>
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setEditingSuenoId(null); }} 
                            className={`text-[10px] uppercase font-black tracking-wider px-3.5 py-1.5 rounded-lg transition-all ${isSelected ? 'bg-indigo-500/40 hover:bg-indigo-500/60 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                          >
                            Listo
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                </div>
                <DreamSavingsInsights
                  dream={s}
                  transacciones={transacciones}
                  selectedLanguage={selectedLanguage === 'ES' ? 'ES' : 'EN'}
                  ahorroPotencial={ahorroPotencialSueno}
                />
              </div>
            );
          })}
        </div>

              </div>

      {/* --- NUEVO SUEÑO SECTION --- */}
      <div className={`bg-white rounded-[25px] p-5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col justify-center transition-all ${showAddForm ? 'ring-2 ring-[#008B81]/20' : ''}`}>
        <div className="flex justify-between items-center cursor-pointer group" onClick={() => setShowAddForm(!showAddForm)}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${showAddForm ? 'bg-[#008B81] text-white' : 'bg-teal-50 text-teal-700'}`}>
               <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[14px] font-black text-slate-900 group-hover:text-[#008B81] transition-colors">Crear Nuevo Sueño</h3>
              <span className="text-[10px] font-bold text-slate-400 block mt-0.5">Establecer meta orientada</span>
            </div>
          </div>
          <div
            className={`p-2 rounded-full transition-all flex items-center justify-center ${
              showAddForm ? 'bg-rose-100 text-rose-500 hover:bg-rose-200' : 'bg-slate-100 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600'
            }`}
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </div>
        </div>

        <AnimatePresence>
          {showAddForm && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleCreateDreamSubmit}
              className="mt-4 pt-4 border-t border-slate-100 space-y-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
               <div className="space-y-1.5 text-left">
                <label className="text-xs font-black text-slate-950 block">🏷️ Nombre del sueño (¿Qué deseas lograr?)</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Deudas, Viaje a París, Pagar Inversión..."
                  value={newDreamName}
                  onChange={(e) => setNewDreamName(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl border-2 border-slate-200 p-3 text-sm font-bold text-slate-950 focus:outline-none focus:border-[#008B81] focus:ring-2 focus:ring-[#008B81]/20 placeholder:text-slate-400 font-sans shadow-inner transition-all"
                />
                <p className="text-[9.5px] text-slate-500 font-medium px-1">Indica qué objetivo deseas financiar (p. ej. "Deudas" es muy recomendado como primera meta).</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left font-sans">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-950 block">🎯 Meta de Ahorro ($)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Total a juntar"
                    value={newDreamMeta || ''}
                    onChange={(e) => setNewDreamMeta(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-50 rounded-xl border-2 border-slate-200 p-3 text-sm font-black text-slate-950 focus:outline-none focus:border-[#008B81] focus:ring-2 focus:ring-[#008B81]/20 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                  />
                  <p className="text-[9.5px] text-slate-500 font-medium px-1">Monto total de dinero requerido.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-950 block">📅 Al Mes ($)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Dinero por mes"
                    value={newDreamRate || ''}
                    onChange={(e) => setNewDreamRate(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-50 rounded-xl border-2 border-slate-200 p-3 text-sm font-black text-slate-950 focus:outline-[#008B81]/60 focus:ring-2 focus:ring-[#008B81]/20 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                  />
                  <p className="text-[9.5px] text-slate-500 font-medium px-1">El monto que vas a apartar cada mes.</p>
                </div>
              </div>

              <button
                type="button"
                disabled={isRecommending || !newDreamName.trim()}
                onClick={() => handleAiRecommend('new')}
                className="w-full py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 disabled:opacity-50 text-[#008B81] text-xs font-black uppercase tracking-wider transition-all border-2 border-teal-200/60 flex items-center justify-center gap-2 cursor-pointer duration-200"
              >
                {isRecommending && recommendTargetMode === 'new' ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full" />
                    <span>Calculando con IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-teal-650 animate-pulse" />
                    <span>Sugerir cuota con IA ✨</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#008B81] hover:bg-[#007e75] text-white text-xs font-black uppercase tracking-wider transition-all active:scale-98 shadow-md shadow-[#008B81]/20 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3px]" /> Confirmar Alta
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* CARD DE METAS DE AHORRO INTELIGENTES (FASE 1) */}
      {(() => {
        const isEs = selectedLanguage === 'ES';
        const intel = calculateDeterministicIntelligence();
        const remainingMeta = activeSueno ? Math.max(0, activeSueno.meta - (activeSueno.ahorroAcumulado || 0)) : 0;
        
        // --- FIX BUG 2: acotar meses cuando superavit <= 0 ---
        const surplusEsNegativo = intel.averageSurplus <= 0;
        const monthsToAchieve = (!surplusEsNegativo && intel.recommendedMonthlyAllocation > 0)
          ? Math.ceil(remainingMeta / intel.recommendedMonthlyAllocation)
          : 0;
        const projectedDate = monthsToAchieve > 0
          ? getProjectedDateStr(monthsToAchieve)
          : '';
        // --- FIN FIX BUG 2 ---
        
        // Calculate "palanca de ahorro" (e.g. cutting 20% of dominant spending category)
        const extraMonthlySavings = Math.round(intel.monthlyAverageForMaxCat * 0.20);
        const newAllocation = intel.recommendedMonthlyAllocation + extraMonthlySavings;
        const newMonthsToAchieve = newAllocation > 0 ? Math.ceil(remainingMeta / newAllocation) : 0;
        const monthsFaster = Math.max(1, monthsToAchieve - newMonthsToAchieve);

        const recId = activeSueno ? `recommend-sueno-${activeSueno.id}` : 'general';
        const existingFeedback = userProfile?.ia_feedback?.[recId];

        // Format localized strings and messages
        let badgeText = '';
        let badgeStyle = '';
        let descText = '';

        // --- FIX: superavit negativo = sin ingresos registrados ---
        if (surplusEsNegativo && intel.historicalMonthsCount >= 1) {
          badgeText = isEs ? '⚠️ Estimación Preliminar' : '⚠️ Preliminary Estimate';
          badgeStyle = 'bg-indigo-50 text-indigo-800 border-indigo-200/50';
          descText = isEs
            ? `Tus gastos superan tus ingresos registrados este periodo — tu superávit actual es $${intel.averageSurplus.toLocaleString('es-CO')}. Registra tus ingresos reales para obtener una proyección precisa.`
            : `Your expenses exceed your recorded income this period — current surplus is $${intel.averageSurplus.toLocaleString('en-US')}. Add your real income to unlock an accurate projection.`;
          // No mostrar proyeccion ni palanca de ahorro
          return (
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-3xl p-5 border border-indigo-200/60 shadow-xs text-left space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-indigo-100 border-dashed">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-tr from-teal-500 to-indigo-600 rounded-xl text-white">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-[12px] font-black text-slate-800 uppercase tracking-widest">
                    {isEs ? "Meta de Ahorro Inteligente" : "Smart Savings advice"}
                  </span>
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border self-start ${badgeStyle}`}>
                  {badgeText}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-700 leading-relaxed font-bold">{descText}</p>
            </div>
          );
        }

        if (intel.historicalMonthsCount === 0) {
          badgeText = isEs ? "Sigue registrando para metas personalizadas" : "Record more for personalized goals";
          badgeStyle = "bg-amber-50 text-amber-800 border-amber-200/50";
          descText = isEs 
            ? "Aún no posees transacciones suficientes registradas en el mes actual. Registra tus ingresos y gastos para que Prako IA calcule tu superávit mensual real." 
            : "You don't have enough transactions registered yet. Record your income and expenses to unlock real-time monthly surplus calculations.";
        } else if (intel.historicalMonthsCount >= 1 && intel.historicalMonthsCount <= 2) {
          badgeText = isEs ? "⚡ Estimación Preliminar" : "⚡ Preliminary Estimate";
          badgeStyle = "bg-indigo-50 text-indigo-800 border-indigo-200/50";
          const savingsPercent = intel.averageSurplus > 0 ? Math.round((intel.recommendedMonthlyAllocation / intel.averageSurplus) * 100) : 0;
          descText = isEs
            ? `¡Hola! Con base en una estimación preliminar de tus finanzas (${intel.historicalMonthsCount} mes/es registrados), tu superávit promedio mensual estimado es de $${intel.averageSurplus.toLocaleString('es-CO')}. Te propongo ahorrar $${intel.recommendedMonthlyAllocation.toLocaleString('es-CO')} al mes (un ${savingsPercent}% de tu superávit). Siguiendo este plan preliminar, lograrás '${activeSueno?.nombre || ''}' en ${monthsToAchieve} meses (${projectedDate || 'pronto'}).`
            : `Hello! Based on a preliminary scan of your finances (${intel.historicalMonthsCount} month(s) recorded), your estimated average monthly surplus is $${intel.averageSurplus.toLocaleString('en-US')}. I suggest allocating $${intel.recommendedMonthlyAllocation.toLocaleString('en-US')} monthly (around ${savingsPercent}% of your surplus). Under this plan, you will reach '${activeSueno?.nombre || ''}' in ${monthsToAchieve} months (${projectedDate || 'soon'}).`;
        } else {
          badgeText = isEs ? "🏆 Recomendación Firme" : "🏆 Firm Recommendation";
          badgeStyle = "bg-teal-50 text-teal-800 border-teal-200/50";
          const savingsPercent = intel.averageSurplus > 0 ? Math.round((intel.recommendedMonthlyAllocation / intel.averageSurplus) * 100) : 0;
          descText = isEs
            ? `¡Hola! Tras analizar con detalle tu historial completo de ${intel.historicalMonthsCount} meses, tu superávit real promedio mensual es de $${intel.averageSurplus.toLocaleString('es-CO')}. Te sugiero asignar con firmeza una cuota mensual de $${intel.recommendedMonthlyAllocation.toLocaleString('es-CO')} (60% de tu superávit). Alcanzarás '${activeSueno?.nombre || ''}' en ${monthsToAchieve} meses, proyectado para ${projectedDate}.`
            : `Hello! After thoroughly analyzing your complete historical data of ${intel.historicalMonthsCount} months, your real average monthly surplus stands at $${intel.averageSurplus.toLocaleString('en-US')}. I strongly suggest setting a monthly savings quota of $${intel.recommendedMonthlyAllocation.toLocaleString('en-US')} (60% of your surplus). You'll reach '${activeSueno?.nombre || ''}' in ${monthsToAchieve} months, projected for ${projectedDate}.`;
        }

        const reductionActionText = isEs
          ? `Al recortar un 20% de tu gasto mensual en '${intel.maxCatName}' (un ahorro adicional de $${extraMonthlySavings.toLocaleString('es-CO')}/mes), ¡lo lograrás ${monthsFaster} ${monthsFaster === 1 ? 'mes' : 'meses'} antes!`
          : `By trimming 20% of your monthly spend on '${intel.maxCatName}' (saving an extra $${extraMonthlySavings.toLocaleString('en-US')}/mo), you'll reach it ${monthsFaster} ${monthsFaster === 1 ? 'month' : 'months'} sooner!`;

        return (
          <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-3xl p-5 border border-indigo-200/60 shadow-xs text-left space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-indigo-100 border-dashed">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-tr from-teal-500 to-indigo-600 rounded-xl text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-[12px] font-black text-slate-800 uppercase tracking-widest">
                  {isEs ? "Meta de Ahorro Inteligente" : "Smart Savings advice"}
                </span>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border self-start ${badgeStyle}`}>
                {badgeText}
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-[11.5px] text-slate-700 leading-relaxed font-bold">
                {descText}
              </p>

              {intel.historicalMonthsCount > 0 && intel.monthlyAverageForMaxCat > 0 && monthsToAchieve > 1 && (
                <div className="p-3 bg-teal-50/60 border border-teal-150 rounded-2xl flex items-start gap-2">
                  <span className="text-[#008B81] text-xs font-black mt-0.5">💡</span>
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-[#00695C] block">
                      {isEs ? "Palanca de Ahorro Activa" : "Savings leverage tool"}
                    </span>
                    <span className="text-[11.5px] text-[#004D40] font-bold leading-normal">
                      {reductionActionText}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Voting Feedback Buttons under users/{userId} persistence */}
            <div className="pt-2 border-t border-indigo-100 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                {isEs ? "¿Te fue útil esta meta?" : "Was this target helpful?"}
              </span>
              
              {existingFeedback ? (
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-slate-250">
                  {existingFeedback === 'util' ? (
                    <>👍 <span className="text-teal-600 font-black">{isEs ? "Marcada como útil" : "Marked as helpful"}</span></>
                  ) : (
                    <>👎 <span className="text-rose-500 font-black">{isEs ? "Descartada por no útil" : "Marked as not helpful"}</span></>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSuggestFeedback(recId, existingFeedback === 'util' ? 'noutil' : 'util')}
                    className="text-[9px] underline text-slate-400 ml-1.5 hover:text-slate-600 font-extrabold"
                  >
                    {isEs ? "(Cambiar)" : "(Change)"}
                  </button>
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSuggestFeedback(recId, 'util')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-teal-700 hover:text-teal-850 text-xs font-black rounded-xl border border-slate-200 transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>👍 {isEs ? "Sí, útil" : "Yes, helpful"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSuggestFeedback(recId, 'noutil')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-rose-500 hover:text-rose-650 text-xs font-black rounded-xl border border-slate-200 transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>👎 {isEs ? "No me sirve" : "Not helpful"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* --- CURVA DE CUMPLIMIENTO CHART --- */}
      <div className="bg-white rounded-[25px] p-5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col items-center">
        <h4 className="text-[13px] font-black text-slate-900 tracking-tight flex items-center gap-1.5 justify-center">
          <TrendingUp className="w-4 h-4 text-indigo-600 animate-pulse" />
          CURVA DE CUMPLIMIENTO
        </h4>
        <span className="text-[9px] text-slate-500 mt-0.5 tracking-wider font-extrabold uppercase mb-3">TIEMPO ESTIMADO EN MESES</span>

        {/* View Mode Toggle Switch */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full max-w-[280px] mb-4">
          <button
            type="button"
            onClick={() => setChartViewMode('all')}
            className={`flex-1 text-center py-1.5 text-[10.5px] font-black rounded-lg cursor-pointer transition-all ${
              chartViewMode === 'all'
                ? 'bg-[#1E1B4B] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos los sueños ({suenos.length}) 📊
          </button>
          <button
            type="button"
            onClick={() => setChartViewMode('selected')}
            className={`flex-1 text-center py-1.5 text-[10.5px] font-black rounded-lg cursor-pointer transition-all ${
              chartViewMode === 'selected'
                ? 'bg-[#1E1B4B] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sólamente seleccionado ⭐
          </button>
        </div>

        {/* Core Chart Window */}
        <div id="compliance-chart-canvas" className="w-full mt-2 flex items-center justify-center relative overflow-visible">
          <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="overflow-visible"
            style={{ maxWidth: '100%' }}
          >
            {/* Gradients */}
            <defs>
              <linearGradient id="indigo-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Grid Line render correspond specifically to FlGridData */}
            {gridLevels.map((lvl) => {
              const yVal = lvl * yMax;
              const y_pixel = getY(yVal);
              return (
                <g key={`grid-line-${lvl}`}>
                  <line
                    x1={paddingLeft}
                    y1={y_pixel}
                    x2={width - paddingRight}
                    y2={y_pixel}
                    stroke="#F1F5F9"
                    strokeWidth="1.2"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y_pixel + 3.5}
                    textAnchor="end"
                    className="font-mono text-[9px] fill-slate-500 font-extrabold"
                  >
                    ${Math.round(yVal).toLocaleString('es-ES', { notation: 'compact', compactDisplay: 'short' })}
                  </text>
                </g>
              );
            })}

            {/* Vertical grid lines representing months (AxisTitles) */}
            {(() => {
              const ticks = Array.from({ length: Math.ceil(xMax / 12) + 1 }).map((_, i) => i * 12).filter(m => m <= xMax);
              if (!ticks.includes(xMax)) ticks.push(xMax);
              
              return ticks.map((month) => {
                const x_pixel = getX(month);
                return (
                  <g key={`v-grid-${month}`}>
                    <line
                      x1={x_pixel}
                      y1={paddingTop}
                      x2={x_pixel}
                      y2={height - paddingBottom}
                      stroke="#F1F5F9"
                      strokeWidth="1.2"
                      strokeDasharray={month > 0 && month < xMax ? "2 2" : undefined}
                    />
                    <text
                      x={x_pixel}
                      y={height - 10}
                      textAnchor="middle"
                      className="font-mono text-[9.5px] fill-slate-500 font-extrabold"
                    >
                      {Math.round(month)}
                    </text>
                  </g>
                );
              });
            })()}

            {/* AREA UNDER PATH (BelowBarData with capacity grad fill) - only for active/selected to keep chart clean */}
            {activeAhorroNeto > 0 && (
              <path
                d={projectionAreaPath}
                fill="url(#indigo-grad)"
              />
            )}

            {/* DRAW ALL VISIBLE DREAMS PROJECTION CURVES & COMPLIANCE DOTS */}
            {(chartViewMode === 'selected' ? [activeSueno] : suenos).map((s) => {
              const isSelected = s.id === activeSueno.id;
              const sAhorro = s.usarReal ? Math.max(0, realAhorroNeto) : s.ahorroManual;
              const sAccumulated = s.ahorroAcumulado || 0;
              const sRemainingMeta = Math.max(0, s.meta - sAccumulated);
              const sMesCumplimientoReal = sAhorro > 0 ? sRemainingMeta / sAhorro : 0;
              const sSavingsAtMonthMax = sAccumulated + (sAhorro * xMax);

              const sp0_x = getX(0);
              const sp0_y = getY(sAccumulated);
              const spMax_x = getX(xMax);
              const spMax_y = getY(sSavingsAtMonthMax);

              const sLinePath = `M ${sp0_x} ${sp0_y} L ${spMax_x} ${spMax_y}`;
              const sMetaY_px = getY(s.meta);
              const sIsFulfilledInChart = sMesCumplimientoReal > 0 && sMesCumplimientoReal <= xMax && sRemainingMeta > 0;
              const sDotX = sIsFulfilledInChart ? getX(sMesCumplimientoReal) : null;
              const sDotY = sIsFulfilledInChart ? getY(s.meta) : null;

              const strokeColor = isSelected ? '#4F46E5' : '#94A3B8';
              const strokeWidth = isSelected ? 4.5 : 2;
              const opacity = isSelected ? 1 : 0.55;
              const strokeDash = isSelected ? undefined : '3 3';

              return (
                <g key={`dream-curve-${s.id}`} className="transition-all duration-300">
                  {/* Meta Goal horizontal limit line */}
                  <line
                    x1={paddingLeft}
                    y1={sMetaY_px}
                    x2={width - paddingRight}
                    y2={sMetaY_px}
                    stroke={isSelected ? '#4F46E5' : '#CBD5E1'}
                    strokeWidth={isSelected ? 1.8 : 0.8}
                    strokeDasharray={isSelected ? '4 4' : '2 2'}
                    opacity={opacity}
                  />

                  {/* Meta label indicator on active curve */}
                  {isSelected && (
                    <text
                      x={width - paddingRight - 4}
                      y={sMetaY_px - 4}
                      textAnchor="end"
                      className="fill-indigo-900 text-[8.5px] font-black tracking-tight uppercase bg-white px-1"
                    >
                      {s.nombre}: ${formatMoney(s.meta)}
                    </text>
                  )}

                  {/* Main curve line */}
                  {sAhorro > 0 ? (
                    <path
                      d={sLinePath}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      opacity={opacity}
                      strokeLinecap="round"
                    />
                  ) : (
                    <line
                      x1={sp0_x}
                      y1={sp0_y}
                      x2={spMax_x}
                      y2={sp0_y}
                      stroke="#CBD5E1"
                      strokeWidth="1.5"
                      opacity="0.3"
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Current progress dot */}
                  {isSelected && (
                    <g opacity={opacity}>
                      {/* Vertical line at Month 0 to indicate Starting Point / Today */}
                      <line
                        x1={sp0_x}
                        y1={paddingTop}
                        x2={sp0_x}
                        y2={height - paddingBottom}
                        stroke="#00897B"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        className="opacity-60"
                      />
                      <circle
                        cx={sp0_x}
                        cy={sp0_y}
                        r={8}
                        className="fill-teal-550 animate-pulse opacity-20"
                      />
                      <circle
                        cx={sp0_x}
                        cy={sp0_y}
                        r={4.5}
                        className="fill-teal-550 stroke-white stroke-[1.5]"
                      />
                      
                      {/* Beautiful Tooltip/Badge for "Estás aquí" */}
                      <g transform={`translate(${sp0_x + 10}, ${Math.max(paddingTop + 10, sp0_y - 12)})`}>
                        <rect
                          width="112"
                          height="24"
                          rx="6"
                          fill="#0D1E2D"
                          stroke="#00897B"
                          strokeWidth="1"
                        />
                        <text
                          x="8"
                          y="15"
                          className="fill-teal-400 text-[8.5px] font-black tracking-widest"
                        >
                          ESTÁS AQUÍ
                        </text>
                        <text
                          x="68"
                          y="15"
                          className="fill-white text-[8.5px] font-black font-mono"
                        >
                          ${formatMoney(sAccumulated)}
                        </text>
                      </g>
                    </g>
                  )}

                  {/* Compliance dot */}
                  {sIsFulfilledInChart && sDotX !== null && sDotY !== null && (
                    <g opacity={opacity}>
                      <circle
                        cx={sDotX}
                        cy={sDotY}
                        r={isSelected ? 9 : 6.5}
                        className={`${isSelected ? 'fill-indigo-500/25 animate-pulse' : 'fill-slate-400/20'}`}
                      />
                      <circle
                        cx={sDotX}
                        cy={sDotY}
                        r={isSelected ? 5.5 : 4}
                        className={`fill-white stroke-[2] ${isSelected ? 'stroke-[#4F46E5]' : 'stroke-[#94A3B8]'}`}
                      />
                      <circle
                        cx={sDotX}
                        cy={sDotY}
                        r={isSelected ? 3 : 2}
                        className={isSelected ? 'fill-[#4F46E5]' : 'fill-[#94A3B8]'}
                      />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Under-chart compliance banner */}
        <div className="w-full text-center mt-3 pt-3 border-t border-slate-100 space-y-1.5">
          {activeAhorroNeto <= 0 ? (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-250">
              <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider flex items-center justify-center gap-1">
                ⚠️ Plan de ahorro Suspendido
              </span>
              <p className="text-[11px] text-amber-900 mt-1 leading-relaxed font-bold">
                Necesitas tener un <strong>ahorro mensual mayor a $0</strong> para proyectar la curva. Registra ingresos o pasa a plan personalizado.
              </p>
            </div>
          ) : (
            <>
              {isFulfilledInChart ? (
                <div className="space-y-1">
                  <span className="text-[13px] text-indigo-850 font-black block uppercase tracking-wide">
                    ¡CUMPLIDO: Mes {Math.round(mesCumplimientoReal)}!
                  </span>
                  
                  <p className="text-xs text-slate-800 font-bold leading-relaxed">
                    Con tu plan de ahorro mensual de <strong className="text-indigo-700">${formatMoney(activeAhorroNeto)}</strong> lograrás el sueño de <strong className="text-slate-900">"{activeSueno.nombre}"</strong> en el mes <strong className="text-indigo-700">{Math.round(mesCumplimientoReal)}</strong>.
                  </p>

                  <div className="flex items-center justify-center gap-1.5 mt-2 bg-indigo-50 px-3 py-2 rounded-xl text-[11px] text-indigo-700 font-black max-w-[260px] mx-auto border border-indigo-150">
                    <Trophy className="w-3.5 h-3.5 text-indigo-650 animate-bounce" />
                    Completo en {Math.floor(mesCumplimientoReal / 12)} {Math.floor(mesCumplimientoReal / 12) === 1 ? 'año' : 'años'} y {Math.round(mesCumplimientoReal % 12)} {Math.round(mesCumplimientoReal % 12) === 1 ? 'mes' : 'meses'}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <span className="text-[11.5px] text-amber-700 font-black block uppercase tracking-wider">
                    Tomará más tiempo del esperado
                  </span>
                  <p className="text-[11px] text-slate-805 max-w-[280px] mx-auto leading-relaxed font-bold">
                    Al ritmo actual de <strong className="text-slate-900">${formatMoney(activeAhorroNeto)}/mes</strong>, lograrás reunir el remanente en <strong className="text-amber-700">{Math.round(mesCumplimientoReal)} meses</strong>.
                  </p>
                  <p className="text-[10.5px] text-[#008B81] font-bold leading-relaxed bg-teal-50 p-2.5 rounded-xl border border-teal-150">
                    💡 <strong>Prueba esto:</strong> Aumenta tu cuota a <strong className="text-[#008B81]">${formatMoney(Math.round((activeSueno.meta - (activeSueno.ahorroAcumulado || 0)) / 12))} al mes</strong> para completarlo exactamente en 1 año.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* --- DETAILED BULLETED AI INSIGHT CARD --- */}
      {aiRecommendationMsg && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-teal-100 text-left space-y-4 bg-gradient-to-br from-teal-50/20 to-indigo-50/25"
        >
          <div className="flex items-center gap-2 pb-2.5 border-b border-indigo-50">
            <Sparkles className="w-4.5 h-4.5 text-[#008B81] animate-pulse" strokeWidth={2.5} />
            <span className="text-[11.5px] font-black text-slate-800 uppercase tracking-wider">
              Asesoría de Ahorro IA • {recommendTargetMode === 'new' ? (newDreamName || 'Nuevo Sueño') : activeSueno.nombre}
            </span>
          </div>

          {!aiRecommendationMsg.sufficientInfo ? (
            /* Insufficient Info Pathway (Camino 2) */
            <div className="space-y-4">
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-250/60 text-[11px] leading-relaxed text-amber-900 font-bold leading-normal">
                ⚠️ <strong className="text-amber-950">Información Financiera Insuficiente:</strong>
                <p className="mt-1 font-semibold text-slate-700">
                  {aiRecommendationMsg.explanation || "No posees ingresos registrados en tu balance actual. Por favor ingresa tus montos mensuales estimados abajo para que la IA proponga tu cuota óptima:"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-white/70 p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-black text-slate-900 uppercase tracking-wide block">Ingresos Estimados ($ / mes)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ej: 3000"
                    value={manualIncomeInput}
                    onChange={(e) => setManualIncomeInput(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-400 px-3 py-2 text-xs font-bold text-slate-950 focus:outline-[#008B81] focus:ring-1 focus:ring-[#008B81] sm:text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-black text-slate-900 uppercase tracking-wide block">Egresos / Deudas ($ / mes)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej: 1800"
                    value={manualExpenseInput}
                    onChange={(e) => setManualExpenseInput(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-400 px-3 py-2 text-xs font-bold text-slate-950 focus:outline-[#008B81] focus:ring-1 focus:ring-[#008B81] sm:text-sm"
                  />
                </div>
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  disabled={isRecommending || !manualIncomeInput || Number(manualIncomeInput) <= 0}
                  onClick={() => handleAiRecommend(recommendTargetMode, Number(manualIncomeInput), Number(manualExpenseInput))}
                  className="flex-1 py-3 bg-[#008B81] hover:bg-[#00766e] disabled:opacity-50 text-white font-black text-xs rounded-xl cursor-pointer transition active:scale-97 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {isRecommending ? (
                    <>
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                      <span>Evaluando Datos...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Calcular con estos Datos 🪄</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setAiRecommendationMsg(null)}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer transition"
                >
                  Omitir
                </button>
              </div>
            </div>
          ) : (
            /* Sufficient Info Pathway (Camino 1) */
            <>
              <div className="text-[11px] leading-relaxed text-slate-700 bg-white border border-teal-50 rounded-xl p-3 shadow-xs">
                💡 <strong className="text-slate-800">Propuesta IA:</strong> Meta de <strong className="text-slate-950">${formatMoney(aiRecommendationMsg.recommendedMeta)}</strong> con ahorro mensual de <strong className="text-indigo-900">${formatMoney(aiRecommendationMsg.recommendedMonthlyAhorro)}</strong>.
                {getMonthsOfHistory() >= 3 ? (
                  <div className="mt-1.5 pl-2 border-l-2 border-teal-500 text-[10px] text-[#00796B] font-bold bg-teal-50/50 py-1 px-1.5 rounded-r">
                    ℹ️ Recomendación calculada con base en los últimos {getMonthsOfHistory()} meses de tu historial financiero.
                  </div>
                ) : (
                  <div className="mt-1.5 pl-2 border-l-2 border-indigo-500 text-[10px] text-indigo-800 font-bold bg-indigo-50/50 py-1 px-1.5 rounded-r">
                    ℹ️ Recomendación calculada con base en los promedios mensuales estimaciones ingresadas.
                  </div>
                )}
                <div className="text-[10.5px] text-slate-605 mt-1.5 font-semibold leading-normal font-sans">
                  {aiRecommendationMsg.explanation}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Plan de Acción Recomendado:</span>
                <ul className="space-y-1.5 font-sans">
                  {aiRecommendationMsg.bullets && aiRecommendationMsg.bullets.length > 0 ? (
                    aiRecommendationMsg.bullets.map((bullet, idx) => (
                      <li key={idx} className="text-[11px] text-slate-600 flex items-start gap-2 leading-relaxed font-semibold">
                        <span className="text-[#008B81] text-xs font-black mt-0.5">✔</span>
                        <span>{bullet}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-[11px] text-slate-600 flex items-start gap-2 leading-relaxed font-semibold">
                      <span className="text-[#008B81] text-xs font-black mt-0.5">✔</span>
                      <span>Optimiza tu presupuesto reduciendo el gasto discrecional no esencial en un 15%.</span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={applyRecommendation}
                  className="flex-1 py-2.5 bg-[#008B81] hover:bg-[#00766e] text-white font-black text-xs rounded-xl cursor-pointer transition active:scale-97 flex items-center justify-center gap-1.5 shadow-xs animate-pulse hover:animate-none"
                >
                  <Check className="w-4 h-4 stroke-[3px]" />
                  <span>Aplicar recomendación ✅</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiRecommendationMsg(null)}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer transition"
                >
                  Omitir
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
};
