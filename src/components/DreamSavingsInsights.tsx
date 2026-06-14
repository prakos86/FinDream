import React from 'react';
import { Sueno, Transaccion } from '../types';

interface DreamSavingsInsightsProps {
  dream: Sueno;
  transacciones: Transaccion[];
  selectedLanguage: 'ES' | 'EN';
}

export const DreamSavingsInsights: React.FC<DreamSavingsInsightsProps> = ({
  dream,
  transacciones,
  selectedLanguage,
}) => {
  // 1. Calcular superavit mensual (ingresos - gastos promedio)
  const now = new Date();
  const hace30dias = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const txUltimos30 = transacciones.filter((tx) => {
    if (!tx.fecha) return false;
    try {
      return new Date(tx.fecha) >= hace30dias;
    } catch {
      return false;
    }
  });

  const ingresos = txUltimos30
    .filter((tx) => tx.tipo === 'Ingreso')
    .reduce((sum, tx) => sum + tx.monto, 0);

  const gastos = txUltimos30
    .filter((tx) => tx.tipo === 'Gasto')
    .reduce((sum, tx) => sum + Math.abs(tx.monto), 0);

  const superavitMensual = ingresos - gastos;

  // 2. Proyectar fecha para alcanzar objetivo
  const objetivo = dream.meta;
  const ahorrado = dream.ahorroAcumulado || 0;
  const faltaAhorrar = Math.max(0, objetivo - ahorrado);

  const mesesFaltantes = superavitMensual > 0 
    ? Math.ceil(faltaAhorrar / superavitMensual) 
    : 999;

  const fechaProyectada = new Date();
  if (mesesFaltantes !== 999) {
    fechaProyectada.setMonth(fechaProyectada.getMonth() + mesesFaltantes);
  }

  // 3. Evaluar si esta en buen camino
  const estaEnBuenCamino = superavitMensual > 0 && mesesFaltantes <= 12;

  const getFormattedMonth = (d: Date) => {
    return d.toLocaleDateString(selectedLanguage === 'ES' ? 'es-CO' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div id={`dream-insights-${dream.id}`} className="bg-gradient-to-br from-teal-50 to-indigo-50 rounded-2xl p-4 border border-teal-100 text-left mt-2">
      <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-wider mb-3">
        {selectedLanguage === 'ES' ? `Análisis de: ${dream.nombre}` : `Analysis of: ${dream.nombre}`}
      </h4>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
        {/* Tarjeta de Superavit */}
        <div className="bg-white rounded-xl p-3 border-l-4 border-teal-500 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 mb-0.5">
            {selectedLanguage === 'ES' ? 'Superávit mensual' : 'Monthly surplus'}
          </p>
          <p className="text-lg font-black text-teal-600">
            ${superavitMensual.toLocaleString(selectedLanguage === 'ES' ? 'es-CO' : 'en-US')}
          </p>
        </div>

        {/* Proyeccion */}
        <div className="bg-white rounded-xl p-3 border-l-4 border-indigo-500 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 mb-0.5">
            {selectedLanguage === 'ES' ? 'Fecha proyectada' : 'Projected date'}
          </p>
          <p className="text-sm font-black text-indigo-600">
            {mesesFaltantes === 999 
              ? (selectedLanguage === 'ES' ? 'Indefinida' : 'Undefined')
              : getFormattedMonth(fechaProyectada)}
          </p>
          <p className="text-[9px] font-semibold text-slate-400 mt-0.5">
            {mesesFaltantes === 999
              ? (selectedLanguage === 'ES' ? 'Superávit requerido' : 'Surplus required')
              : (selectedLanguage === 'ES'
                  ? `En aprox. ${mesesFaltantes} ${mesesFaltantes === 1 ? 'mes' : 'meses'}`
                  : `In approx. ${mesesFaltantes} ${mesesFaltantes === 1 ? 'month' : 'months'}`)}
          </p>
        </div>
      </div>

      {/* Tarjeta de Estado IA */}
      <div className={`rounded-xl p-3 text-white ${
        estaEnBuenCamino
          ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
          : 'bg-gradient-to-r from-orange-400 to-rose-500'
      }`}>
        <p className="text-xs font-black mb-1 flex items-center gap-1.5">
          {estaEnBuenCamino
            ? (selectedLanguage === 'ES' ? '✅ útil' : '✅ On track')
            : (selectedLanguage === 'ES' ? '⚠️ No útil' : '⚠️ Needs adjustment')}
        </p>
        <p className="text-[10px] font-bold leading-relaxed opacity-95">
          {estaEnBuenCamino
            ? (selectedLanguage === 'ES'
                ? 'Vas en buen camino para alcanzar tu meta'
                : 'You are on track to reach your goal')
            : (selectedLanguage === 'ES'
                ? 'Necesitas aumentar ahorros para alcanzar meta'
                : 'You need to increase savings to reach your goal')}
        </p>
      </div>
    </div>
  );
};
