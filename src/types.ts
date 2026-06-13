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
}

export type FiltroTiempo = 'Día' | 'Semana' | 'Mes' | 'Año' | 'Histórico';

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

