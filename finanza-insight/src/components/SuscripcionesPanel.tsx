import React, { useState, useMemo } from 'react';
import { Suscripcion } from '../types';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { 
  MoreHorizontal, 
  Trash2, 
  Plus, 
  Repeat, 
  X, 
  AlertCircle, 
  Edit2, 
  Tag, 
  Calendar,
  Globe,
  PlusCircle,
  HelpCircle
} from 'lucide-react';

interface SuscripcionesPanelProps {
  suscripciones: Suscripcion[];
  saveSuscripcionesList: (updated: Suscripcion[]) => void;
  selectedCountry: 'CO' | 'CL';
  selectedLanguage: string;
}

export const SuscripcionesPanel: React.FC<SuscripcionesPanelProps> = ({
  suscripciones = [],
  saveSuscripcionesList,
  selectedCountry,
  selectedLanguage
}) => {
  const isEn = selectedLanguage !== 'ES';
  const { rates, loading: exchangeLoading, convertir } = useExchangeRate();
  const monedaPais = selectedCountry === 'CL' ? 'CLP' : 'COP';
  const currencySymbol = '$';

  // Modal actions and state
  const [showModal, setShowModal] = useState(false);
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'USD' | 'CLP' | 'COP'>('USD');
  const [frecuencia, setFrecuencia] = useState<'Mensual' | 'Anual'>('Mensual');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Translations
  const t = {
    totalEst: isEn ? "Estimated monthly total" : "Total mensual estimado",
    activeSubs: isEn ? "active subscriptions" : "suscripciones activas",
    noSubs: isEn ? "No subscriptions yet. Click the + button to add one!" : "Aún no tienes suscripciones. ¡Haz clic en el botón + para agregar una!",
    addTitle: isEn ? "New Subscription" : "Nueva Suscripción",
    editTitle: isEn ? "Edit Subscription" : "Editar Suscripción",
    name: isEn ? "Name (e.g., Netflix)" : "Nombre (ej. Netflix, Spotify)",
    amount: isEn ? "Amount" : "Monto",
    currency: isEn ? "Currency" : "Moneda",
    freq: isEn ? "Frequency" : "Frecuencia",
    monthly: isEn ? "Monthly" : "Mensual",
    yearly: isEn ? "Yearly" : "Anual",
    category: isEn ? "Category (optional)" : "Categoría (opcional)",
    startDate: isEn ? "Start Date (optional)" : "Fecha de Inicio (opcional)",
    save: isEn ? "Save" : "Guardar",
    cancel: isEn ? "Cancel" : "Cancelar",
    errorRequired: isEn ? "Name and valid amount are required." : "El nombre y un monto válido son requeridos.",
    usdWarn: isEn ? "Real-time rates will convert to local currency" : "Conversión a moneda local según tipo de cambio actual",
    edit: isEn ? "Edit" : "Editar",
    delete: isEn ? "Delete" : "Eliminar",
    confirmDelete: isEn ? "Are you sure you want to delete this subscription?" : "¿Estás seguro de que deseas eliminar esta suscripción?",
  };

  // Calculate total monthly
  const totalMensual = useMemo(() => {
    return suscripciones.reduce((sum, s) => {
      const convertedMonto = convertir(s.monto, s.moneda, monedaPais);
      return sum + (s.frecuencia === "Anual" ? convertedMonto / 12 : convertedMonto);
    }, 0);
  }, [suscripciones, rates, monedaPais, convertir]);

  // Handle open modal for new subscription
  const handleOpenAdd = () => {
    setNombre('');
    setMonto('');
    setMoneda('USD');
    setFrecuencia('Mensual');
    setEditingId(null);
    setFormError('');
    setShowModal(true);
  };

  // Handle open modal for editing
  const startEditingSuscripcion = (s: Suscripcion) => {
    setNombre(s.nombre);
    setMonto(s.monto.toString());
    setMoneda(s.moneda);
    setFrecuencia(s.frecuencia);
    setEditingId(s.id);
    setFormError('');
    setShowModal(true);
  };

  // Handle delete
  const handleDeleteSuscripcion = (id: string) => {
    if (window.confirm(t.confirmDelete)) {
      const updated = suscripciones.filter(s => s.id !== id);
      saveSuscripcionesList(updated);
    }
  };

  // Handle save
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !monto || isNaN(Number(monto)) || Number(monto) <= 0) {
      setFormError(t.errorRequired);
      return;
    }

    const payload: Suscripcion = {
      id: editingId || `sub_${Math.random().toString(36).substr(2, 9)}`,
      nombre: nombre.trim(),
      monto: Number(monto),
      moneda,
      frecuencia,
    };

    let updatedList: Suscripcion[];
    if (editingId) {
      updatedList = suscripciones.map(s => s.id === editingId ? payload : s);
    } else {
      updatedList = [...suscripciones, payload];
    }

    saveSuscripcionesList(updatedList);
    setShowModal(false);
  };

  // Auto-assign nice color accent per major subscription or category
  const getSubBadgeColor = (name: string, cat?: string) => {
    const text = (name + (cat || '')).toLowerCase();
    if (text.includes('netflix') || text.includes('video') || text.includes('hbo') || text.includes('prime')) return 'border-red-200 bg-red-50 text-red-700';
    if (text.includes('spotify') || text.includes('music') || text.includes('apple') || text.includes('youtube')) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (text.includes('office') || text.includes('microsoft') || text.includes('work') || text.includes('notion')) return 'border-blue-200 bg-blue-50 text-blue-700';
    if (text.includes('cloud') || text.includes('icloud') || text.includes('drive') || text.includes('dropbox') || text.includes('storage')) return 'border-sky-200 bg-sky-50 text-sky-700';
    if (text.includes('gym') || text.includes('health') || text.includes('fit')) return 'border-rose-200 bg-rose-50 text-rose-700';
    return 'border-gray-200 bg-gray-50 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header con total mensual */}
      <div className="bg-gradient-to-r from-indigo-600 to-teal-600 p-6 text-white shadow-md relative overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12"></div>
        <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-teal-300/10 rounded-full blur-xl"></div>
        
        <p className="text-xs uppercase tracking-wider opacity-85 font-medium">
          {t.totalEst}
        </p>
        <p className="text-3xl font-black mt-2 tracking-tight">
          {currencySymbol} {Math.round(totalMensual).toLocaleString()} <span className="text-base font-normal opacity-80">{monedaPais}</span>
        </p>
        <p className="text-xs opacity-75 mt-2 flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
          {suscripciones.length} {t.activeSubs}
        </p>
      </div>

      {exchangeLoading && (
        <div className="px-4 py-2 text-xs text-indigo-600 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 animate-spin" />
            {isEn ? "Updating foreign exchange rates..." : "Actualizando tipos de cambio..."}
          </span>
        </div>
      )}

      {/* Lista de suscripciones con menu "..." para editar/eliminar */}
      <div className="p-4 space-y-3">
        {suscripciones.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100 flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-3">
              <Repeat className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-500 max-w-xs">{t.noSubs}</p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white font-medium text-xs rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow"
            >
              <PlusCircle className="w-4 h-4" />
              {isEn ? "Add Subscription" : "Agregar Suscripción"}
            </button>
          </div>
        ) : (
          suscripciones.map(s => {
            const hasConversion = s.moneda !== monedaPais;
            const badgeStyle = getSubBadgeColor(s.nombre, s.categoria);
            return (
              <div 
                key={s.id} 
                className="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-800 truncate">{s.nombre}</p>
                    {s.categoria && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badgeStyle}`}>
                        {s.categoria}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1 flex-wrap">
                    <span className="text-slate-800 font-bold">{s.moneda} {s.monto.toLocaleString()}</span>
                    <span className="text-slate-400">/</span>
                    <span className="capitalize">{s.frecuencia === "Anual" ? t.yearly : t.monthly}</span>
                    {s.fechaInicio && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="flex items-center gap-0.5 text-slate-400 text-[10px]">
                          <Calendar className="w-3 h-3" />
                          {s.fechaInicio}
                        </span>
                      </>
                    )}
                  </p>
                  
                  {hasConversion && (
                    <p className="text-[11px] text-teal-600 font-semibold mt-1 bg-teal-50/50 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                      ≈ {currencySymbol} {Math.round(convertir(s.monto, s.moneda, monedaPais)).toLocaleString()} {monedaPais}
                      {s.frecuencia === 'Anual' && (
                        <span className="text-slate-400 font-normal">({currencySymbol} {Math.round(convertir(s.monto, s.moneda, monedaPais) / 12).toLocaleString()} / {isEn ? "mo" : "mes"})</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 ml-4">
                  <button 
                    onClick={() => startEditingSuscripcion(s)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title={t.edit}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteSuscripcion(s.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title={t.delete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Boton + flotante para agregar */}
      <button 
        onClick={handleOpenAdd}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-teal-600 text-white shadow-xl flex items-center justify-center hover:bg-teal-700 active:scale-95 transition-transform duration-100 z-40 cursor-pointer border border-teal-500"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Modal Overlay / Drawer styled standard form */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] sm:max-h-[90vh] flex flex-col animate-slide-up">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                <Repeat className="w-5 h-5 text-indigo-600" />
                {editingId ? t.editTitle : t.addTitle}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 flex-1 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Nombre */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {t.name}
                </label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="ej. Netflix, Spotify, iCloud"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-colors"
                  maxLength={50}
                  required
                />
              </div>

              {/* Monto & Moneda Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {t.amount}
                  </label>
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-colors"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {t.currency}
                  </label>
                  <select 
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-colors cursor-pointer"
                  >
                    <option value="USD">💵 USD</option>
                    <option value="CLP">🇨🇱 CLP</option>
                    <option value="COP">🇨🇴 COP</option>
                  </select>
                </div>
              </div>

              {moneda === 'USD' && (
                <p className="text-[10px] text-slate-400 italic bg-blue-50/50 p-2 rounded-lg flex items-center gap-1">
                  <Globe className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                  {t.usdWarn}
                </p>
              )}

              {/* Frecuencia */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {t.freq}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFrecuencia('Mensual')}
                    className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-colors ${
                      frecuencia === 'Mensual' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t.monthly}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrecuencia('Anual')}
                    className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-colors ${
                      frecuencia === 'Anual' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t.yearly}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 pb-safe-bottom">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-600/10 active:scale-[0.98] transition-all"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
