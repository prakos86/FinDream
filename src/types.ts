export interface Categoria {
  nombre: string;
  monto: number;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class or hex
}

export type TipoMovimiento = 'Gasto' | 'Ingreso';

export interface Transaccion {
  id: string;
  tipo: TipoMovimiento;
  monto: number;
  categoria?: string; // Solo para Gastos
  fecha: string; // ISO String
  descripcion: string;
  formaPago?: string; // Forma de pago vinculada

  // NUEVOS CAMPOS PARA CUOTAS
  cuotasTotal?: number;
  cuotaActual?: number;
  montoOriginal?: number;
  montoTotalCompra?: number;
  esAutomatica?: boolean;
  idCuotaPrincipal?: string;

  // NUEVOS CAMPOS PARA GASTOS RECURRENTES
  esRecurrente?: boolean;
  idRecurrente?: string;
  paisMoneda?: 'CLP' | 'COP'; // pais donde se registro la transaccion
}

export type FiltroTiempo = 'Día' | 'Semana' | 'Mes' | 'Año' | 'Histórico' | 'Personalizado';

export interface HistoricoAvance {
  id: string;
  fecha: string;
  monto: number;
}

export interface Sueno {
  id: string;
  nombre: string;
  meta: number;
  ahorroManual: number;
  ahorroAcumulado?: number;
  historialAvances?: HistoricoAvance[];
  usarReal: boolean;
  paisMoneda?: 'CLP' | 'COP'; // <-- NUEVO: pais del sueno

  // NUEVOS CAMPOS PARA IA
  fechaObjetivoProyectada?: string; // Fecha estimada para alcanzar meta
  superavitMensual?: number; // Promedio ahorro mensual
  estaEnBuenCamino?: boolean; // true si va al ritmo esperado
}

export interface ProductoFinanciero {
  id: string;
  banco: string;
  tipo: string;
  alias?: string;
  montoTotal?: number;      // Cupo total o monto total del producto/crédito
  montoUtilizado?: number;  // Monto consumido o pagado hasta la fecha
  franquicia?: string;     // Franquicia (Visa, Mastercard, etc.) - opcional
}

export interface ActivoPortafolio {
  id: string;
  nombre: string;
  valor: number;
  plataforma: string;
}

export interface Suscripcion {
  id: string;
  nombre: string; // ej. "Netflix", "Spotify"
  monto: number; // monto en la moneda original
  moneda: "USD" | "CLP" | "COP"; // moneda original
  frecuencia: "Mensual" | "Anual";
  fechaInicio?: string; // ISO YYYY-MM-DD opcional
  categoria?: string; // ej. "Streaming", "Software"
  icono?: string; // opcional, nombre de Lucide icon
}

export interface UserProfile {
  nombre: string;
  correo: string;
  celular: string;
  productos: ProductoFinanciero[];
  portafolios?: ActivoPortafolio[];
  suscripciones?: Suscripcion[];
  ia_feedback?: { [recommendationId: string]: 'util' | 'noutil' };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'model';
  text: string;
  timestamp: string; // ISO string
  attachedFileName?: string;
  videoPendingTransacciones?: Array<{
    fecha: string;
    monto: string;
    descripcion: string;
    tipo: 'Gasto' | 'Ingreso';
  }>;
}

export type FrecuenciaRecurrente = 'Semanal' | 'Quincenal' | 'Mensual' | 'Bimestral';

export interface GastoRecurrente {
  id: string;
  nombre: string; // 'Empleada del hogar'
  monto: number; // 600000
  categoria: string; // 'Hogar'
  metodoPago: string; // 'Efectivo'
  frecuencia: FrecuenciaRecurrente;
  diasPago: number[]; // [14, 28] para quincenal
  paisMoneda: 'CLP' | 'COP'; // pais del gasto
  activo: boolean; // se puede pausar
  autoRegistrar: boolean; // crea tx automaticamente
  notificacionActiva: boolean; // notificacion push/badge
  avisoPrevio: boolean; // notificar 1 dia antes
  ultimoRegistro?: string; // ISO YYYY-MM-DD ultimo auto-registro
  fechaCreacion: string; // ISO YYYY-MM-DD
}

