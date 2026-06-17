import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Edit2, Trash2, Calendar, Bell, Clock, Check, Pause, Play, X, Info, Tag, CreditCard, ChevronRight, AlertCircle
} from 'lucide-react';
import { GastoRecurrente, Transaccion, FrecuenciaRecurrente } from '../types';

interface GastosRecurrentesProps {
  gastosRecurrentes: GastoRecurrente[]; // ya filtrados por pais
  onSave: (updated: GastoRecurrente[]) => void;
  todosLosGastos: GastoRecurrente[]; // array global sin filtrar
  transacciones: Transaccion[];
  selectedLanguage: 'ES' | 'EN';
  effectiveCountry: 'CO' | 'CL';
}

const CATEGORIES_PRESETS = [
  { value: 'Vivienda', labelES: '🏡 Vivienda', labelEN: '🏡 Housing' },
  { value: 'Alimentación', labelES: '🍎 Alimentación', labelEN: '🍎 Food' },
  { value: 'Transporte', labelES: '🚗 Transporte', labelEN: '🚗 Transport' },
  { value: 'Servicios', labelES: '⚡ Servicios', labelEN: '⚡ Utilities' },
  { value: 'Salud', labelES: '❤️ Salud', labelEN: '❤️ Health' },
  { value: 'Educación', labelES: '📚 Educación', labelEN: '📚 Education' },
  { value: 'Entretenimiento', labelES: '🎬 Entretenimiento', labelEN: '🎬 Entertainment' },
  { value: 'Suscripciones', labelES: '🔄 Suscripciones', labelEN: '🔄 Subscriptions' },
];

const PAYMENT_METHODS_PRESETS = [
  'Efectivo', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'Transferencia Bancaria', 'PSE', 'Nequi', 'Daviplata', 'Sencillito', 'Webpay'
];

export const proximoPago = (g: GastoRecurrente): Date => {
  const hoy = new Date();
  const diaHoy = hoy.getDate();
  const diasPagoSorted = [...g.diasPago].sort((a, b) => a - b);
  const diasFuturos = diasPagoSorted.filter(d => d > diaHoy);
  if (diasFuturos.length > 0) {
    return new Date(hoy.getFullYear(), hoy.getMonth(), diasFuturos[0]);
  }
  // proximo mes, primer dia de pago
  const targetDay = diasPagoSorted[0] || 1;
  return new Date(hoy.getFullYear(), hoy.getMonth() + 1, targetDay);
};

export const GastosRecurrentes: React.FC<GastosRecurrentesProps> = ({
  gastosRecurrentes,
  onSave,
  todosLosGastos,
  transacciones,
  selectedLanguage,
  effectiveCountry
}) => {
  const isES = selectedLanguage === 'ES';
  const currencySymbol = '$';
  
  // Estado para modal de creación/edición
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<GastoRecurrente | null>(null);
  
  // Valores por defecto del formulario
  const [form, setForm] = useState<Partial<GastoRecurrente>>({
    nombre: '',
    monto: 0,
    categoria: 'Servicios',
    metodoPago: 'Tarjeta de Crédito',
    frecuencia: 'Mensual',
    diasPago: [1],
    activo: true,
    autoRegistrar: true,
    notificacionActiva: false,
    avisoPrevio: false
  });

  const [formMontoText, setFormMontoText] = useState('');

  // Formateador de moneda
  const formatValue = (num: number) => {
    return num.toLocaleString(effectiveCountry === 'CL' ? 'es-CL' : 'es-CO', {
      style: 'currency',
      currency: effectiveCountry === 'CL' ? 'CLP' : 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // Cálculos estadísticos
  const totalComprometidoMensual = registradosEnPais().reduce((sum, g) => {
    if (!g.activo) return sum;
    let factor = 1;
    switch (g.frecuencia) {
      case 'Semanal': factor = 4.33; break;
      case 'Quincenal': factor = 2; break;
      case 'Mensual': factor = 1; break;
      case 'Bimestral': factor = 0.5; break;
    }
    return sum + (g.monto * factor);
  }, 0);

  function registradosEnPais() {
    return todosLosGastos.filter(g => g.paisMoneda === (effectiveCountry === 'CL' ? 'CLP' : 'COP'));
  }

  // Lista de recordatorios ordenados cronológicamente
  const recordatorios = registradosEnPais()
    .filter(g => g.activo)
    .map(g => {
      const nextDate = proximoPago(g);
      const diffTime = nextDate.getTime() - new Date().setHours(0,0,0,0);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { g, nextDate, diffDays };
    })
    .sort((a, b) => a.diffDays - b.diffDays)
    .slice(0, 3);

  // Manejadores de CRUD
  const handleOpenCreate = () => {
    setEditando(null);
    setForm({
      nombre: '',
      monto: 0,
      categoria: 'Servicios',
      metodoPago: 'Tarjeta de Crédito',
      frecuencia: 'Mensual',
      diasPago: [5],
      activo: true,
      autoRegistrar: true,
      notificacionActiva: false,
      avisoPrevio: false
    });
    setFormMontoText('');
    setShowForm(true);
  };

  const handleOpenEdit = (g: GastoRecurrente) => {
    setEditando(g);
    setForm({ ...g });
    setFormMontoText(g.monto.toString());
    setShowForm(true);
  };

  const handleToggleActivo = (g: GastoRecurrente) => {
    const updated = todosLosGastos.map(item => 
      item.id === g.id ? { ...item, activo: !item.activo } : item
    );
    onSave(updated);
  };

  const handleDelete = (g: GastoRecurrente) => {
    if (confirm(isES ? `¿Estás seguro de eliminar el gasto recurrentes: ${g.nombre}?` : `Are you sure you want to delete recurring expense: ${g.nombre}?`)) {
      const updated = todosLosGastos.filter(item => item.id !== g.id);
      onSave(updated);
    }
  };

  const handleToggleDay = (dayNum: number) => {
    const currentDays = form.diasPago || [];
    if (currentDays.includes(dayNum)) {
      if (currentDays.length > 1) {
        setForm({ ...form, diasPago: currentDays.filter(d => d !== dayNum) });
      }
    } else {
      setForm({ ...form, diasPago: [...currentDays, dayNum].sort((a,b)=>a-b) });
    }
  };

  const handleToggleNotification = (enabled: boolean) => {
    if (enabled && typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            setForm({ ...form, notificacionActiva: true });
          } else {
            setForm({ ...form, notificacionActiva: false });
          }
        });
        return;
      }
    }
    setForm({ ...form, notificacionActiva: enabled });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMonto = parseFloat(formMontoText.replace(/[^0-9.]/g, '')) || 0;
    if (!form.nombre?.trim()) {
      alert(isES ? 'Por favor ingresa un nombre' : 'Please provide a name');
      return;
    }
    if (parsedMonto <= 0) {
      alert(isES ? 'El monto debe ser mayor a 0' : 'Amount must be greater than 0');
      return;
    }
    if (!form.diasPago || form.diasPago.length === 0) {
      alert(isES ? 'Selecciona al menos un día de pago' : 'Select at least one payment day');
      return;
    }

    const payload: GastoRecurrente = {
      id: editando ? editando.id : `recurrente-${Date.now()}`,
      nombre: form.nombre.trim(),
      monto: parsedMonto,
      categoria: form.categoria || 'Servicios',
      metodoPago: form.metodoPago || 'Efectivo',
      frecuencia: form.frecuencia as FrecuenciaRecurrente,
      diasPago: form.diasPago,
      paisMoneda: effectiveCountry === 'CL' ? 'CLP' : 'COP',
      activo: form.activo !== undefined ? form.activo : true,
      autoRegistrar: form.autoRegistrar !== undefined ? form.autoRegistrar : true,
      notificacionActiva: form.notificacionActiva || false,
      avisoPrevio: form.avisoPrevio || false,
      ultimoRegistro: editando ? editando.ultimoRegistro : undefined,
      fechaCreacion: editando ? editando.fechaCreacion : new Date().toISOString().split('T')[0]
    };

    let updatedList: GastoRecurrente[];
    if (editando) {
      updatedList = todosLosGastos.map(item => item.id === editando.id ? payload : item);
    } else {
      updatedList = [...todosLosGastos, payload];
    }

    onSave(updatedList);
    setShowForm(false);
    setEditando(null);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-190px)] mb-6 overflow-y-auto bg-slate-50 p-4 space-y-6">
      
      {/* Resumen de comprometido */}
      <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-5 rounded-3xl shadow-lg border border-slate-800 text-white relative overflow-visible shrink-0">
        <div className="absolute -top-4 -right-4 p-4 opacity-5 pointer-events-none">
          <Calendar className="w-32 h-32" />
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              {isES ? 'COMPROMISO MENSUAL ESTIMADO' : 'ESTIMATED MONTHLY COMMITMENT'}
            </h3>
            <p className="text-3xl font-black tracking-tight">
              {formatValue(totalComprometidoMensual)}
            </p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">
              {isES 
                ? `Normalizado en base a frecuencias fijas (${registradosEnPais().filter(g=>g.activo).length} activos)` 
                : `Normalized from fixed schedules (${registradosEnPais().filter(g=>g.activo).length} active)`}
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="p-3 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl flex items-center gap-1.5 transition active:scale-95 text-xs font-black uppercase cursor-pointer tracking-wider relative z-10"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            {isES ? 'Crear Gasto' : 'Create Gasto'}
          </button>
        </div>
      </div>

      {/* Panel de Próximos Recordatorios */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-600 anim-pulse" />
            {isES ? 'Próximos Pagos Agendados' : 'Upcoming Scheduled Payments'}
          </h3>
          <span className="text-[9px] bg-slate-100 font-extrabold text-slate-500 px-2 py-0.5 rounded-full uppercase">
            {isES ? 'Control Diario' : 'Daily Tracker'}
          </span>
        </div>

        {recordatorios.length === 0 ? (
          <div className="text-center py-6 text-slate-400 space-y-1">
            <p className="text-xs font-bold">{isES ? 'No hay pagos recurrentes activos.' : 'No active recurring payments.'}</p>
            <p className="text-[10px]">{isES ? 'Crea un gasto recurrente para seguirlo diariamente.' : 'Create a recurring expense to track it daily.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recordatorios.map(({ g, nextDate, diffDays }) => (
              <div key={`rem-${g.id}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/50 hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 leading-tight">{g.nombre}</h4>
                    <p className="text-[9.5px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" />
                      {g.categoria} • {g.frecuencia}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-900 block">{formatValue(g.monto)}</span>
                  <span className={`text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md mt-1 inline-block uppercase leading-none ${
                    diffDays === 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : diffDays === 1
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-50 text-indigo-700'
                  }`}>
                    {diffDays === 0 
                      ? (isES ? 'HOY ⚡' : 'TODAY ⚡') 
                      : diffDays === 1 
                        ? (isES ? 'MAÑANA 🔔' : 'TOMORROW 🔔') 
                        : (isES ? `En ${diffDays} días` : `In ${diffDays} days`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lista de Tarjetas de Gastos Recurrentes */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#00897B] pl-1">
          {isES ? `Gestor de Gastos Recurrentes (${gastosRecurrentes.length})` : `Recurring Expenses Manager (${gastosRecurrentes.length})`}
        </h3>

        {gastosRecurrentes.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-300 text-center space-y-3">
            <span className="text-3xl block">📋</span>
            <p className="text-xs font-bold text-slate-500">
              {isES ? 'Aún no registras gastos recurrentes.' : 'No recurring expenses registered yet.'}
            </p>
            <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
              {isES 
                ? 'Agrega gastos fijos (arriendo, gimnasio, empleada doméstica) para que se registren automáticamente.' 
                : 'Add fixed bills (rent, gym, housekeepers) to keep them recorded automatically.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {gastosRecurrentes.map((g) => {
              const nextPayment = proximoPago(g);
              const isToday = nextPayment.getDate() === new Date().getDate() && nextPayment.getMonth() === new Date().getMonth();
              
              return (
                <div 
                  key={g.id} 
                  className={`bg-white rounded-3xl border transition-all p-5 flex flex-col justify-between ${
                    g.activo 
                      ? 'border-slate-200 hover:border-slate-300 shadow-sm' 
                      : 'border-slate-200 bg-slate-50/70 opacity-70'
                  }`}
                >
                  {/* Fila Principal */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl ${g.activo ? 'bg-teal-50 text-teal-600' : 'bg-slate-200 text-slate-500'}`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900">{g.nombre}</h4>
                          <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-full uppercase ${
                            g.activo 
                              ? 'bg-teal-100 text-teal-800' 
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {g.activo ? (isES ? 'Activo' : 'Active') : (isES ? 'Pausado' : 'Paused')}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 flex items-center gap-1.5">
                          <span>{g.frecuencia}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span>Días: {g.diasPago.join(', ')}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-slate-900 block">{formatValue(g.monto)}</span>
                      <span className={`text-[9px] font-bold mt-1 inline-block uppercase p-1 rounded ${
                        isToday && g.activo ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400'
                      }`}>
                        {isES ? 'Próximo:' : 'Next:'} {nextPayment.toLocaleDateString(isES ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>

                  {/* Fila de Toggles de Control */}
                  <div className="mt-4 pt-3 border-t border-slate-100/80 flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Auto-registro */}
                      <span className={`text-[9.5px] font-bold flex items-center gap-1 ${g.autoRegistrar ? 'text-teal-700' : 'text-slate-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${g.autoRegistrar ? 'bg-teal-500' : 'bg-slate-300'}`} />
                        {isES ? 'Auto-registro' : 'Auto-register'}
                      </span>
                      {/* Notificar */}
                      <span className={`text-[9.2px] font-bold flex items-center gap-1 ${g.notificacionActiva ? 'text-indigo-700' : 'text-slate-400'}`}>
                        <Bell className={`w-3.5 h-3.5 ${g.notificacionActiva ? 'text-indigo-500' : 'text-slate-300'}`} />
                        {isES ? 'Recordatorio' : 'Reminder'}
                      </span>
                    </div>

                    {/* Acciones de Edición/Pausa/Eliminar */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleActivo(g)}
                        title={g.activo ? (isES ? 'Pausar' : 'Pause') : (isES ? 'Reactivar' : 'Reactivate')}
                        className={`p-2 rounded-xl transition ${
                          g.activo 
                            ? 'hover:bg-amber-50 text-amber-600 bg-amber-50/30' 
                            : 'hover:bg-teal-50 text-teal-600 bg-teal-50/30'
                        } cursor-pointer`}
                      >
                        {g.activo ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(g)}
                        className="p-2 hover:bg-slate-100 text-slate-600 rounded-xl transition bg-slate-50 cursor-pointer"
                        title={isES ? 'Editar' : 'Edit'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(g)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition bg-red-50/30 cursor-pointer"
                        title={isES ? 'Eliminar' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-Up modal form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center z-50">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white rounded-t-[36px] w-full max-w-lg p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto no-scrollbar"
            >
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                  {editando 
                    ? (isES ? 'Editar Gasto Recurrente' : 'Edit Recurring Bill') 
                    : (isES ? 'Nuevo Gasto Recurrente' : 'New Recurring Bill')}
                </h3>
                <button 
                  onClick={() => setShowForm(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full transition cursor-pointer text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Nombre de Gasto */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">
                    {isES ? 'Nombre del Gasto' : 'Bill Name'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isES ? 'Ej: Arriendo, Plan Móvil, Netflix' : 'e.g. Rent, Mobile Plan, Netflix'}
                    value={form.nombre || ''}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-250 focus:border-indigo-500 rounded-xl outline-none font-bold text-slate-800 text-sm"
                  />
                </div>

                {/* Monto y Moneda País */}
                <div id="form-pricing" className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">
                      {isES ? 'Monto' : 'Amount'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                        {currencySymbol}
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="0"
                        value={formMontoText}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setFormMontoText(val);
                        }}
                        className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-250 focus:border-indigo-500 rounded-xl outline-none font-extrabold text-slate-800 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">
                      {isES ? 'País de Registro' : 'Country Context'}
                    </label>
                    <div className="px-4 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-black text-slate-750 flex items-center justify-between cursor-not-allowed">
                      <span>{effectiveCountry === 'CL' ? '🇨🇱 Chile (CLP)' : '🇨🇴 Colombia (COP)'}</span>
                      <Info className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Categoría y Método de Pago */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">
                      {isES ? 'Categoría' : 'Category'}
                    </label>
                    <select
                      value={form.categoria || 'Servicios'}
                      onChange={e => setForm({ ...form, categoria: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-250 rounded-xl font-bold text-slate-800 text-xs outline-none cursor-pointer"
                    >
                      {CATEGORIES_PRESETS.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {isES ? cat.labelES : cat.labelEN}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">
                      {isES ? 'Método de Pago' : 'Payment Method'}
                    </label>
                    <select
                      value={form.metodoPago || 'Efectivo'}
                      onChange={e => setForm({ ...form, metodoPago: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-250 rounded-xl font-bold text-slate-800 text-xs outline-none cursor-pointer"
                    >
                      {PAYMENT_METHODS_PRESETS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Chips de Frecuencia */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">
                    {isES ? 'Frecuencia de Pago' : 'Billing Frequency'}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['Semanal', 'Quincenal', 'Mensual', 'Bimestral'] as FrecuenciaRecurrente[]).map(freq => {
                      const isSelected = form.frecuencia === freq;
                      return (
                        <button
                          type="button"
                          key={`freq-${freq}`}
                          onClick={() => setForm({ ...form, frecuencia: freq })}
                          className={`py-2 px-1 text-[10.5px] font-black uppercase tracking-tight rounded-xl border transition cursor-pointer ${
                            isSelected 
                              ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350'
                          }`}
                        >
                          {isES ? freq : (
                            freq === 'Semanal' ? 'Weekly' :
                            freq === 'Quincenal' ? 'Biweekly' :
                            freq === 'Mensual' ? 'Monthly' : 'Bimonthly'
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid de días de pago */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">
                    {isES ? 'Días del Mes para Cobro / Pago' : 'Days of Month for Billing'}
                  </label>
                  <p className="text-[9px] text-indigo-700 font-extrabold mb-2 uppercase leading-snug">
                    📌 {isES 
                      ? 'Puedes elegir múltiples días (ej. 14 y 28 para pago quincenal)' 
                      : 'You can select multiple days (e.g. 14 & 28 for biweekly payments)'}
                  </p>
                  <div className="grid grid-cols-7 gap-1.5 p-2 bg-slate-100 rounded-2xl">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                      const isSelected = (form.diasPago || []).includes(day);
                      return (
                        <button
                          type="button"
                          key={`day-${day}`}
                          onClick={() => handleToggleDay(day)}
                          className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer select-none ${
                            isSelected 
                              ? 'bg-teal-600 text-white shadow-xs scale-102 font-black' 
                              : 'bg-white hover:bg-slate-50 text-slate-700 font-semibold'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Toggles */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-4">
                  {/* Auto-registrar */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-800 block">
                        ⚡ {isES ? 'Habilitar Auto-Registro' : 'Enable Auto-Registration'}
                      </span>
                      <span className="text-[9px] text-slate-500 leading-tight block mt-0.5">
                        {isES 
                          ? 'El gasto se registra automáticamente en Balance el día indicado sin abrir la app.' 
                          : 'Adds transaction to your Balance sheet automatically on specified days.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, autoRegistrar: !form.autoRegistrar })}
                      className="cursor-pointer"
                    >
                      <div className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ${form.autoRegistrar ? 'bg-teal-600' : 'bg-slate-350'}`}>
                        <div className={`bg-white w-5 h-5 rounded-full shadow-md transform duration-200 ${form.autoRegistrar ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>

                  {/* Notificacion */}
                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-800 block">
                        🔔 {isES ? 'Recibir Recordatorio' : 'Get Reminders'}
                      </span>
                      <span className="text-[9px] text-slate-500 leading-tight block mt-0.5">
                        {isES 
                          ? 'Muestra una notificación en tu navegador el día de cobro.' 
                          : 'Pushes a custom push reminder on your web browser the billing day.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleNotification(!form.notificacionActiva)}
                      className="cursor-pointer"
                    >
                      <div className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ${form.notificacionActiva ? 'bg-teal-600' : 'bg-slate-350'}`}>
                        <div className={`bg-white w-5 h-5 rounded-full shadow-md transform duration-200 ${form.notificacionActiva ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>

                  {/* Aviso previo */}
                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-800 block">
                        ⏳ {isES ? 'Aviso previo (1 día antes)' : 'Pre-alert (1 day before)'}
                      </span>
                      <span className="text-[9px] text-slate-500 leading-tight block mt-0.5">
                        {isES 
                          ? 'Activa para anticipar el registro 1 día antes del vencimiento fijado.' 
                          : 'Activate to warn you 1 day in advance of billing date.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, avisoPrevio: !form.avisoPrevio })}
                      className="cursor-pointer"
                    >
                      <div className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ${form.avisoPrevio ? 'bg-teal-600' : 'bg-slate-350'}`}>
                        <div className={`bg-white w-5 h-5 rounded-full shadow-md transform duration-200 ${form.avisoPrevio ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>
                </div>

                {/* Botón Guardar */}
                <button
                  type="button"
                  onClick={handleSave}
                  className="w-full py-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white font-black text-xs uppercase tracking-widest rounded-xl transition cursor-pointer active:scale-98 shadow-sm"
                >
                  {isES ? 'Guardar Gasto Recurrente' : 'Save Gasto Recurrente'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
