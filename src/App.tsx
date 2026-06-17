/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'; 
import { auth, setCachedAccessToken } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  X, 
  Mic, 
  MicOff,
  AudioLines, 
  Home, 
  Utensils, 
  Car, 
  ShoppingBag, 
  Plane, 
  MoreHorizontal, 
  Trash2, 
  Smartphone, 
  Maximize2, 
  Minimize2, 
  Sparkles,
  Volume2,
  VolumeX,
  PlusCircle,
  Clock,
  Trash,
  Check,
  ChevronRight,
  Info,
  Cloud,
  Server,
  Database,
  User,
  CreditCard,
  Send,
  MessageSquare,
  Loader2,
  Globe,
  PieChart,
  Eye,
  EyeOff,
  Zap,
  Search,
  LogOut,
  Fingerprint,
  Shield,
  ShieldCheck,
  ScanFace,
  Heart,
  Scissors,
  Briefcase,
  Upload,
  Repeat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const extractPdfText = async (file: File, password?: string): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    password: password,
  });
  const pdf = await loadingTask.promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
};

export const normalizarMonto = (valor: any): number => {
  if (valor === null || valor === undefined) return NaN;
  if (typeof valor === "number") {
    if (!isFinite(valor)) return NaN;
    return Math.round(valor);
  }
  if (typeof valor !== "string") {
    valor = String(valor);
  }
  let raw = valor.trim();
  if (!raw) return NaN;
  const esNegativo = /^\(.*\)$/.test(raw) || /^-/.test(raw);
  // quita TODO menos digitos, punto y coma
  let s = raw.replace(/[^0-9.,]/g, "");
  if (!s) return NaN;
  if (s.includes(".") && s.includes(",")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(".")) {
    const parts = s.split(".");
    // Si hay mas de un punto -> todos son miles
    if (parts.length > 2) s = s.replace(/\./g, "");
    // Si el ultimo grupo tiene 3 digitos exactos -> separador de miles
    else if (parts[parts.length - 1].length === 3) s = s.replace(/\./g, "");
  } else if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length > 2) s = s.replace(/,/g, "");
    else if (parts[parts.length - 1].length === 3) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  }
  let n = parseFloat(s);
  if (isNaN(n)) {
    // ultimo recurso: extraer solo digitos
    const soloDigitos = raw.replace(/\D/g, "");
    if (soloDigitos) n = parseInt(soloDigitos, 10);
  }
  if (isNaN(n)) return NaN;
  n = Math.round(n);
  if (esNegativo) n = -Math.abs(n);
  return n;
};
import { Categoria, TipoMovimiento, Transaccion, FiltroTiempo, Sueno, UserProfile, ProductoFinanciero, ChatMessage, Suscripcion, GastoRecurrente, FrecuenciaRecurrente } from './types';
import { useFirestore } from './hooks/useFirestore';
import { useGoogleSheets } from './hooks/useGoogleSheets';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useExchangeRate } from './hooks/useExchangeRate';
import { DreamComplianceChart } from './components/DreamComplianceChart';
import { ChatPanel } from './components/ChatPanel';
import { TransactionForm } from './components/TransactionForm';
import { SuscripcionesPanel } from './components/SuscripcionesPanel';
import { GastosRecurrentes } from './components/GastosRecurrentes';
import { SplashIntro } from './components/SplashIntro';
import { FinDreamLogo } from './components/FinDreamLogo';
import { ProfileModal } from './components/ProfileModal';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const TRANSLATIONS = {
  ES: {
    tab_resumen: "Balance",
    tab_sueno: "Sueño",
    tab_insights: "Asesor IA",
    ingresar_movimiento: "Ingresar a Finanzas",
    mi_cuenta: "Mi Cuenta",
    ingresos: "Activos / Ingresos",
    egresos: "Pasivos / Egresos",
    saldo_neto: "Saldo Neto",
    deuda: "Pasivos / Deudas",
    sincronizado: "Sincronizado",
    tipo_filtro: "Filtro",
    no_movimientos: "No hay movimientos registrados",
    presione_mas: "Presiona el botón '+' o 'Demo' para registrar.",
    optimizar_sueno: "Prako de FinDream AI",
    consejo_gasto: "Tu mayor gasto registrado es en",
    consejo_ahorro: "Consejo de Ahorro",
    consejo_ahorro_desc: "Al optimizar un 15% en {cat}, sumarás {amount} adicionales al mes directamente a tu meta del sueño, ¡adelantando tu fecha de cumplimiento!",
    nuevo_movimiento: "Nuevo Movimiento",
    dictar_por_voz: "Dictar por Voz (IA)",
    registro_manual: "Registro Manual",
    tipo_flujo: "Tipo de Flujo",
    gasto: "Gasto",
    ingreso: "Ingreso",
    monto_valor: "Monto",
    categoria_gasto: "Categoría de Gasto",
    forma_pago: "Forma de Pago",
    descripcion_opc: "Descripción (Opcional)",
    guardar_movimiento: "Guardar Movimiento",
    datos_basicos: "Datos Básicos",
    nombre_completo: "Nombre Completo",
    correo_electronico: "Correo Electrónico",
    celular_telefono: "Celular / Teléfono",
    bancos_colombianos: "Mis Bancos y Portafolios",
    vincular_pagos: "Vincúlalos para que aparezcan en tu selector de pagos",
    registrar_producto: "Registrar Nuevo Producto",
    banco_co: "Entidad Financiera",
    tipo_producto: "Tipo de Producto",
    alias_opcional: "Alias (Opcional)",
    guardar_producto: "Guardar Producto",
    productos_vigentes: "Productos Actuales",
    finalizar: "Listo, Finalizar",
    habla_libremente: "Habla libremente diciendo 'Registrar gasto de 20 mil en comida'",
    consejo_rapido: "Consejo rápido: di de forma clara el tipo, valor y categoría",
    comenzar_hablar: "Comenzar a hablar",
    detener: "Detener",
    procesando_voz: "Procesando voz con Gemini API...",
    entrar: "Entrar",
    volver: "Volver",
    suscribirse: "Suscribirse",
    iniciar_sesion: "Iniciar Sesión",
    ya_eres_usuario: "¿Ya eres usuario?",
    iniciar_sesion_google: "Iniciar sesión con Google",
    iniciar_sesion_apple: "Iniciar sesión con Apple",
    iniciar_sesion_correo: "Iniciar sesión con Correo",
    demostracion_datos: "Demo (Datos de prueba)",
    // Chatbot Translations:
    ai_insights_title: "Prako de FinDream AI",
    ai_insights_subtitle: "Asesor financiero inteligente potenciado por Gemini",
    chat_placeholder: "Pregúntame sobre tus metas, gastos o consejos...",
    chat_send: "Enviar",
    chat_suggested: "Preguntas Sugeridas:",
    chat_suggest_1: "Analiza mi situación financiera actual",
    chat_suggest_2: "¿Cómo puedo lograr mi sueño más rápido?",
    chat_suggest_3: "Consejos para ahorrar o reducir deudas",
    chat_suggest_4: "Reconocer bancos de mi país para ahorrar",
    chat_initial_greeting: "¡Hola! Soy **Prako**, tu asesor financiero personal de FinDream. Puedo analizar tus deudas, ingresos y tu meta de ahorro. ¿En qué puedo ayudarte hoy?",
    tab_productos: "Producto",
    tab_portafolio: "Portafolio",
    tab_suscripciones: "Suscripciones",
    tab_recurrentes: "Recurrentes",
    productos_actuales: "Mis Productos",
    recomendaciones_ai: "Recomendaciones AI",
    sincronizado_ai: "Sincronizado automáticamente con tus gastos",
    sin_productos: "Aún no tienes elementos de portafolio registrados en esta pestaña.",
    costo_mensual: "Costo Mensual",
    beneficios: "Beneficios",
  },
  EN: {
    tab_resumen: "Balance",
    tab_sueno: "Dream",
    tab_insights: "AI Advisor",
    ingresar_movimiento: "Enter Finances",
    mi_cuenta: "My Account",
    ingresos: "Assets / Income",
    egresos: "Liabilities / Expenses",
    saldo_neto: "Net Balance",
    deuda: "Liabilities / Debts",
    sincronizado: "Synced",
    tipo_filtro: "Filter",
    no_movimientos: "No recorded transactions",
    presione_mas: "Press the '+' or 'Demo' button to start.",
    optimizar_sueno: "Prako from FinDream AI",
    consejo_gasto: "Your largest recorded expense is in",
    consejo_ahorro: "Save Advice",
    consejo_ahorro_desc: "By optimizing 15% in {cat}, you will add an additional {amount} per month directly to your dream goal, advancing your target date!",
    nuevo_movimiento: "New Transaction",
    dictar_por_voz: "Voice Dictation (AI)",
    registro_manual: "Manual Entry",
    tipo_flujo: "Flow Type",
    gasto: "Expense",
    ingreso: "Income",
    monto_valor: "Amount",
    categoria_gasto: "Expense Category",
    forma_pago: "Payment Method",
    descripcion_opc: "Description (Optional)",
    guardar_movimiento: "Save Transaction",
    datos_basicos: "Basic Info",
    nombre_completo: "Full Name",
    correo_electronico: "Email Address",
    celular_telefono: "Cell / Phone",
    bancos_colombianos: "My Banks & Portfolios",
    vincular_pagos: "Link them to display in your payment selectors",
    registrar_producto: "Register New Product",
    banco_co: "Financial Institution",
    tipo_producto: "Product Type",
    alias_opcional: "Alias (Optional)",
    guardar_producto: "Save Product",
    productos_vigentes: "Active Products",
    finalizar: "Done, Finish",
    habla_libremente: "Speak freely saying 'Record an expense of 20 thousand on food'",
    consejo_rapido: "Quick tip: state clearly the type, value and category",
    comenzar_hablar: "Start Speaking",
    detener: "Stop",
    procesando_voz: "Processing voice with Gemini API...",
    entrar: "Enter",
    volver: "Back",
    suscribirse: "Subscribe",
    iniciar_sesion: "Log In",
    ya_eres_usuario: "Already a user?",
    iniciar_sesion_google: "Log in with Google",
    iniciar_sesion_apple: "Log in with Apple",
    iniciar_sesion_correo: "Log in with Email",
    demostracion_datos: "Demo (Sample Data)",
    // Chatbot Translations:
    ai_insights_title: "Prako from FinDream AI",
    ai_insights_subtitle: "Intelligent financial assistant powered by Gemini",
    chat_placeholder: "Ask me about your goals, expenses or tips...",
    chat_send: "Send",
    chat_suggested: "Suggested Questions:",
    chat_suggest_1: "Analyze my current financial situation",
    chat_suggest_2: "How can I achieve my dream faster?",
    chat_suggest_3: "Tips to save or reduce debts",
    chat_suggest_4: "Recommend savings products for my country",
    chat_initial_greeting: "Hello! I am **Prako**, your personal financial assistant from FinDream. I can analyze your debts, income, and your savings goal. How can I assist you today?",
    tab_productos: "Product",
    tab_portafolio: "Portfolio",
    tab_suscripciones: "Subscriptions",
    tab_recurrentes: "Recurring",
    productos_actuales: "My Products",
    recomendaciones_ai: "AI Recommendations",
    sincronizado_ai: "Automatically synced with your expenses",
    sin_productos: "No registered portfolio items yet in this tab.",
    costo_mensual: "Monthly Cost",
    beneficios: "Benefits",
  }
};


// Helper to synthesise iOS haptic/audio feedback using Web Audio API
const playTone = (type: 'tap' | 'success' | 'delete' | 'voice', isMuted: boolean) => {
  if (isMuted) return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'tap') {
      // Short click sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'success') {
      // High-pitched double ding (success theme)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
      osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.08); // C6
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.25);
      osc2.stop(ctx.currentTime + 0.25);
    } else if (type === 'delete') {
      // Swish / Low drop sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'voice') {
      // Soft ambient alert
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch (error) {
    console.error("Audio synthesiser error", error);
  }
};

const CATEGORIAS_PREDEFINIDAS: Omit<Categoria, 'monto'>[] = [
  { nombre: 'Vivienda', icon: 'Home', color: '#8B5A2B' }, // Brown
  { nombre: 'Alimentación', icon: 'Utensils', color: '#F97316' }, // Orange
  { nombre: 'Transporte', icon: 'Car', color: '#EF4444' }, // Red
  { nombre: 'Compras', icon: 'ShoppingBag', color: '#EC4899' }, // Pink
  { nombre: 'Viajes', icon: 'Plane', color: '#3B82F6' }, // Blue
  { nombre: 'Cuidado Personal y Entretenimiento', icon: 'Sparkles', color: '#10B981' }, // Emerald Theme
  { nombre: 'Otros', icon: 'MoreHorizontal', color: '#6B7280' }, // Grey
];

// Colombia Specific Financial Lists
const COLOMBIAN_BANKS = [
  'Bancolombia',
  'Banco de Bogotá',
  'Davivienda',
  'BBVA Colombia',
  'Banco Falabella',
  'Banco Éxito / Tuya',
  'Nequi',
  'Daviplata',
  'Scotiabank Colpatria',
  'Banco de Occidente',
  'Banco Popular',
  'Banco AV Villas',
  'Nu Colombia (Nubank)',
  'Lulo Bank',
  'RappiPay'
];

const COLOMBIAN_PRODUCTS = [
  'Tarjeta de Crédito',
  'Tarjeta de Débito',
  'Cuenta de Ahorros',
  'Cuenta Corriente',
  'Bolsillo / Cajita de Ahorro',
  'Fondo de Inversión Colectiva (FIC)',
  'Fondo de Pensiones Voluntarias (FPV)',
  'CDT',
  'Crédito de Consumo',
  'Crédito de Libranza',
  'Crédito de Vehículo',
  'Crédito Hipotecario',
  'Leasing Habitacional',
  'Cupo Rotativo / Crediágil'
];

const PRODUCT_TAB_DEBTS_ONLY_CO = [
  'Tarjeta de Crédito',
  'Crédito de Consumo',
  'Crédito de Libranza',
  'Crédito de Vehículo',
  'Crédito Hipotecario',
  'Leasing Habitacional',
  'Cupo Rotativo / Crediágil'
];

const PRODUCT_TAB_DEBTS_ONLY_CL = [
  'Tarjeta de Crédito', 'Crédito de Consumo', 'Crédito Automotriz',
  'Crédito Hipotecario', 'Línea de Crédito', 'Avance en Efectivo'
];

const CHILEAN_BANKS = [
  'BancoEstado',
  'Banco de Chile',
  'Santander Chile',
  'BCI',
  'Scotiabank Chile',
  'Banco Itau Chile',
  'Banco Falabella',
  'Banco Security',
  'Banco BICE',
  'Banco Internacional',
  'Banco Consorcio',
  'Banco Ripley',
  'HSBC Bank Chile',
  'BTG Pactual Chile',
  'Tanner Banco Digital',
  'Scotiabank Azul',
  // No bancarios / digitales
  'Tenpo',
  'Mach',
  'Caja Los Andes'
];

const CHILEAN_PRODUCTS = [
  'Cuenta RUT',
  'Tarjeta CMR Falabella',
  'CAE',
  'Cuenta Corriente BCI',
  'Tenpo',
  'Tarjeta de Crédito',
  'Tarjeta de Débito',
  'Cuenta de Ahorros',
  'Depósito a Plazo',
  'Crédito de Consumo',
  'Crédito Automotriz',
  'Crédito Hipotecario',
  'Fondo Mutuo',
  'APV'
];

const COLOMBIAN_FRANCHISES = [
  'Ninguna / No Aplica',
  'Visa',
  'Mastercard',
  'American Express',
  'Diners Club'
];

const CHILEAN_FRANCHISES = [
  'Ninguna / No Aplica',
  'Visa',
  'Mastercard',
  'American Express',
  'Magna'
];

const translateProduct = (p: string, lang: 'ES' | 'EN'): string => {
  if (lang === 'ES') return p;
  const mapping: Record<string, string> = {
    'Tarjeta de Crédito': 'Credit Card',
    'Tarjeta de Débito': 'Debit Card',
    'Cuenta de Ahorros': 'Savings Account',
    'Cuenta Corriente': 'Checking Account',
    'Bolsillo / Cajita de Ahorro': 'Savings Pocket / Box',
    'Fondo de Inversión Colectiva (FIC)': 'Collective Investment Fund (FIC)',
    'Fondo de Pensiones Voluntarias (FPV)': 'Voluntary Pension Fund (FPV)',
    'CDT': 'Certificate of Deposit (CDT)',
    'Crédito de Consumo': 'Consumer Loan',
    'Crédito de Libranza': 'Payroll Loan',
    'Crédito de Vehículo': 'Car Loan',
    'Crédito Hipotecario': 'Mortgage Loan',
    'Leasing Habitacional': 'Housing Leasing',
    'Cupo Rotativo / Crediágil': 'Revolving Credit / Credit Line'
  };
  return mapping[p] || p;
};

const translateFranchise = (f: string, lang: 'ES' | 'EN'): string => {
  if (f === 'Ninguna / No Aplica') {
    return lang === 'ES' ? 'Ninguna / No Aplica' : 'None / Not Applicable';
  }
  return f;
};

const translateCategory = (cat: string, lang: 'ES' | 'EN'): string => {
  if (lang === 'ES') return cat;
  const mapping: Record<string, string> = {
    'Vivienda': 'Housing',
    'Alimentación': 'Food / Groceries',
    'Transporte': 'Transportation',
    'Compras': 'Shopping',
    'Viajes': 'Travel',
    'Cuidado Personal y Entretenimiento': 'Personal Care & Entertainment',
    'Mascotas': 'Pets',
    'Moda y Estilo': 'Fashion & Style',
    'Otros': 'Others'
  };
  return mapping[cat] || cat;
};

interface RecommendedProduct {
  id: string;
  banco: string;
  producto: string;
  costoMensual: string;
  beneficios: string[];
  razon: string;
}

const matchesFilter = (prod: ProductoFinanciero, filter: 'all' | 'debit' | 'credit' | 'credits'): boolean => {
  if (filter === 'all') return true;
  const lowerTipo = (prod.tipo || '').toLowerCase();
  
  if (filter === 'debit') {
    return lowerTipo.includes('débito') || lowerTipo.includes('debito') || lowerTipo.includes('cuenta') || lowerTipo.includes('ahorro') || lowerTipo.includes('corriente') || lowerTipo.includes('fondo') || lowerTipo.includes('bolsillo') || lowerTipo.includes('cajita') || lowerTipo.includes('fic') || lowerTipo.includes('fpv');
  }
  if (filter === 'credit') {
    return lowerTipo.includes('tarjeta de crédito') || lowerTipo.includes('tarjeta de credito') || (lowerTipo.includes('tarjeta') && lowerTipo.includes('crédito')) || (lowerTipo.includes('tarjeta') && lowerTipo.includes('credito'));
  }
  if (filter === 'credits') {
    return (lowerTipo.includes('crédito') || lowerTipo.includes('credito') || lowerTipo.includes('cdt') || lowerTipo.includes('préstamo') || lowerTipo.includes('prestamo') || lowerTipo.includes('hipotecario') || lowerTipo.includes('consumo') || lowerTipo.includes('libranza') || lowerTipo.includes('vehículo') || lowerTipo.includes('vehiculo') || lowerTipo.includes('leasing')) && !lowerTipo.includes('tarjeta');
  }
  return false;
};

const getRecommendedProducts = (
  transacciones: Transaccion[],
  currentProducts: ProductoFinanciero[],
  country: string,
  lang: string
): RecommendedProduct[] => {
  const isEn = lang === 'EN';
  const recs: RecommendedProduct[] = [];
  const currencySuffix = country === 'CL' ? 'CLP' : 'COP';

  if (country === 'CL') {
    // Basic Chilean recommendations
    const hasTenpo = currentProducts.some(p => p.banco.toLowerCase().includes('tenpo'));
    const hasCMR = currentProducts.some(p => p.banco.toLowerCase().includes('falabella'));

    recs.push({
      id: 'rec-1',
      banco: 'Banco Falabella',
      producto: isEn ? 'CMR Credit Card' : 'Tarjeta de Crédito CMR',
      costoMensual: '$0 CLP',
      beneficios: isEn 
        ? ['High CMR points accumulation', 'Exclusive discounts at Falabella & Tottus', '$0 administration fee depending on usage']
        : ['Alta acumulación de CMR Puntos', 'Descuentos exclusivos en Falabella, Tottus, Sodimac', '$0 costo de administración cumpliendo metas de uso'],
      razon: isEn 
        ? 'Great option for everyday shopping and groceries.'
        : 'Excelente para tus compras del día a día y supermercado.'
    });

    if (!hasTenpo) {
      recs.push({
        id: 'rec-2',
        banco: 'Tenpo',
        producto: isEn ? 'Tenpo Prepaid Mastercard' : 'Cuenta y Tarjeta Tenpo Prepago',
        costoMensual: '$0 CLP',
        beneficios: isEn
          ? ['No monthly fees', 'Automatic savings feature', 'Great exchange rate for international purchases']
          : ['Sin costos de mantención', 'Funcionalidad de ahorro automático (Bolsillos)', 'Excelente tipo de cambio para compras internacionales'],
        razon: isEn
          ? 'Perfect for managing digital subscriptions and international purchases.'
          : 'Ideal para gestionar suscripciones digitales y comprar seguro por internet.'
      });
    } else {
      recs.push({
        id: 'rec-2',
        banco: 'Banco de Chile',
        producto: isEn ? 'Digital FAN Account' : 'Cuenta FAN',
        costoMensual: '$0 CLP',
        beneficios: isEn
          ? ['No maintenance costs', 'Access to Banco de Chile benefits', '100% digital onboarding']
          : ['Costo mensual $0', 'Acceso a red de beneficios del Banco de Chile', 'Apertura 100% online en minutos'],
        razon: isEn
          ? 'A great secondary digital account.'
          : 'Una excelente cuenta digital secundaria con buenos descuentos.'
      });
    }
    return recs;
  }

  // Colombian logic
  const hasNequi = currentProducts.some(p => p.banco.toLowerCase().includes('nequi'));
  const hasBancolombia = currentProducts.some(p => p.banco.toLowerCase().includes('bancolombia'));
  const hasDavivienda = currentProducts.some(p => p.banco.toLowerCase().includes('davivienda'));

  // Calculate expenses by category
  const categoryExpenses: Record<string, number> = {};
  transacciones
    .filter(t => t.tipo === 'Gasto')
    .forEach(t => {
      const cat = t.categoria || 'Otros';
      categoryExpenses[cat] = (categoryExpenses[cat] || 0) + t.monto;
    });

  // Find highest category
  let topCategory = '';
  let maxExpense = 0;
  Object.entries(categoryExpenses).forEach(([cat, val]) => {
    if (val > maxExpense) {
      maxExpense = val;
      topCategory = cat;
    }
  });

  // Recommendation 1 based on spending behavior or default
  if (topCategory === 'Alimentación' || topCategory === 'Food') {
    recs.push({
      id: 'rec-1',
      banco: 'Bancolombia',
      producto: isEn ? 'MasterCard Black Dining Credit Card' : 'Tarjeta de Crédito MasterCard Black Gastronómica',
      costoMensual: '$26.000 COP',
      beneficios: isEn 
        ? ['10% cashback on restaurants and delivery', 'No interest for first 3 months', 'Exclusive VIP passes to dining events']
        : ['15% de Cashback en restaurantes y domicilios todos los viernes', 'Acumula doble puntaje para viajes', 'Membresía gratis en apps de envíos favoritos'],
      razon: isEn 
        ? 'Since your top expense is Food, this card maximizes dining cashback.'
        : 'Como tu mayor gasto registrado es Alimentación, esta tarjeta te devolverá más dinero en tus restaurantes.'
    });
  } else if (topCategory === 'Transporte' || topCategory === 'Transport') {
    recs.push({
      id: 'rec-1',
      banco: 'Davivienda',
      producto: isEn ? 'Visa Transmi/Didi Transit Card' : 'Tarjeta Débito Davivienda Transmi-Glow',
      costoMensual: '$0 COP',
      beneficios: isEn
        ? ['Free monthly transit credits', '3% discount on fuel or taxi apps', 'No monthly fee with 2 dynamic payments']
        : ['Pasajes gratis mensuales con TransMilenio', 'Descuento de 4% en gasolineras seleccionadas', 'Sin cuota de manejo si es tu cuenta principal'],
      razon: isEn
        ? 'Based on your Transport expenses, this card offers free transit credits.'
        : 'Dado tu frecuente uso en Transporte, esta alianza optimiza tu movilidad diaria.'
    });
  } else if (topCategory === 'Compras' || topCategory === 'Shopping') {
    recs.push({
      id: 'rec-1',
      banco: 'Scotiabank Colpatria',
      producto: isEn ? 'Visa ShopPro Credit Premium' : 'Tarjeta Scotiabank One Light Shopping',
      costoMensual: '$15.500 COP',
      beneficios: isEn
        ? ['5% off in top department stores', '0% interest installment plans', 'Purchase protection insurance']
        : ['5% de descuento en almacenes de cadena y retail', 'Financiamiento a 0% de interés a 3 cuotas', 'Protección contra robo o daño de compras'],
      razon: isEn
        ? 'Recommended for your high shopping activity, helping you defer costs at 0%.'
        : 'Recomendado por tu alta actividad de Compras, ayudando a diferir sin pagar intereses.'
    });
  } else if (topCategory === 'Viajes' || topCategory === 'Trips') {
    recs.push({
      id: 'rec-1',
      banco: 'BBVA Colombia',
      producto: isEn ? 'Visa Infinite Latam Pass' : 'Tarjeta BBVA Latam Pass Premium',
      costoMensual: '$29.000 COP',
      beneficios: isEn
        ? ['Uncapped miles per USD spent', 'Free access to El Dorado VIP lounge', 'Premium travel cancellation backup']
        : ['Millas ilimitadas por cada dólar en compras', 'Acceso preferencial gratis a salas VIP El Dorado', 'Seguro de viaje con cobertura médica mundial'],
      razon: isEn
        ? 'Recommended for your Travel records, giving you faster access to flights.'
        : 'Recomendada por tus registros de Viajes, permitiendo redimir vuelos gratis rápido.'
    });
  } else if (topCategory === 'Cuidado Personal y Entretenimiento') {
    recs.push({
      id: 'rec-1',
      banco: 'Banco de Bogotá',
      producto: isEn ? 'Visa Play and Wellness Card' : 'Tarjeta Joven Visa Play & Bienestar',
      costoMensual: '$9.900 COP',
      beneficios: isEn
        ? ['2x1 cinema tickets always', '15% discount on spas and wellness centers', 'No handling fee if you are under 28']
        : ['2x1 en salas de cine e invitaciones a conciertos', '15% descuento en gimnasios y spas seleccionados', 'Cero cuota de manejo para menores de 28 años'],
      razon: isEn
        ? 'Since you enjoy personal care & entertainment, this card saves on fun & health.'
        : 'Por tus hábitos de autocuidado y entretenimiento, esta tarjeta reduce tus costos de recreación.'
    });
  } else {
    // Default fallback based on highest expense or general recommendation
    recs.push({
      id: 'rec-1',
      banco: 'Bancolombia',
      producto: isEn ? 'Visa Free Handling Fee Card' : 'Tarjeta de Crédito Libre Bancolombia',
      costoMensual: '$0 COP',
      beneficios: isEn
        ? ['Forever $0 monthly handling fee', 'Ideal for first-time credit building', '1.5% cashback on subscription services']
        : ['Cuota de manejo de por vida de $0 COP', 'Ideal para construir historial crediticio sin deudas', 'Descuento exclusivo en suscripciones de música/streaming'],
      razon: isEn
        ? 'A general-purpose card with zero maintenance cost to build healthy savings.'
        : 'Una tarjeta básica con costo cero de mantenimiento ideal para tu presupuesto actual.'
    });
  }

  // Recommendation 2: Fintech / Digital wallets if not added yet
  if (!hasNequi) {
    recs.push({
      id: 'rec-2',
      banco: 'Nu Colombia (Nubank)',
      producto: isEn ? 'Nu Credit Card' : 'Tarjeta de Crédito Nu',
      costoMensual: '$0 COP',
      beneficios: isEn
        ? ['Zero handling fees for life', 'No international transaction fees', 'Virtual card for safe online shopping']
        : ['Sin cuota de manejo de por vida', 'Sin cobros adicionales por compras internacionales', 'Tarjeta virtual para compras online seguras'],
      razon: isEn
        ? 'Perfect for standardising your credit safely without any hidden costs.'
        : 'Ideal para consolidar compras sin pagar costos fijos mensuales ni cuotas escondidas.'
    });
  } else if (!hasDavivienda && !currentProducts.some(p => p.banco === 'Daviplata')) {
    recs.push({
      id: 'rec-2',
      banco: 'RappiPay',
      producto: isEn ? 'RappiCard Visa' : 'RappiCard Visa',
      costoMensual: '$0 COP',
      beneficios: isEn
        ? ['1% Cashback on all purchases', 'No handling fees', 'Exclusive discounts in Rappi app']
        : ['1% de Cashback real en todas tus compras', 'Cero cuotas de manejo de por vida', 'Descuentos exclusivos y beneficios en Rappi'],
      razon: isEn
        ? 'Great option for earning money back on your daily expenses.'
        : 'Excelente opción si usas delivery y quieres recibir dinero real por cada compra.'
    });
  } else {
    recs.push({
      id: 'rec-2',
      banco: 'Lulo Bank',
      producto: isEn ? 'Lulo Credit' : 'Crédito de Libre Inversión Lulo',
      costoMensual: '$0 COP',
      beneficios: isEn
        ? ['Fixed personalized rate', 'Approval in minutes directly in the app', 'No physical branch visits required']
        : ['Tasa fija personalizada según tu perfil', 'Aprobación en minutos 100% desde la app', 'Sin papeleos ni visitas a sucursales'],
      razon: isEn
        ? 'Highly recommended for consolidating other debts quickly and securely.'
        : 'Recomendada para unificar deudas o capitalizar un consumo rápido a tasas claras.'
    });
  }

  return recs;
};

// Helper to get matching Lucide icon dynamically
const renderCategoriaIcon = (iconName: string, color: string, className = "w-5 h-5") => {
  switch (iconName) {
    case 'Home': return <Home className={className} style={{ color }} />;
    case 'Utensils': return <Utensils className={className} style={{ color }} />;
    case 'Car': return <Car className={className} style={{ color }} />;
    case 'ShoppingBag': return <ShoppingBag className={className} style={{ color }} />;
    case 'Plane': return <Plane className={className} style={{ color }} />;
    case 'Sparkles': return <Sparkles className={className} style={{ color }} />;
    case 'Heart': return <Heart className={className} style={{ color }} />;
    case 'Scissors': return <Scissors className={className} style={{ color }} />;
    default: return <MoreHorizontal className={className} style={{ color }} />;
  }
};

// Definicion de todas las pestanas con su config
const ALL_TABS = [
  { id: "finance",       label: "tab_resumen",       icon: "Database",   tabKey: "finance" },
  { id: "cloud",         label: "tab_sueno",         icon: "Cloud",      tabKey: "cloud" },
  { id: "productos",     label: "tab_productos",     icon: "CreditCard", tabKey: "productos" },
  { id: "portafolios",   label: "tab_portafolio",    icon: "Briefcase",  tabKey: "portafolios" },
  { id: "suscripciones", label: "tab_suscripciones", icon: "Repeat",     tabKey: "suscripciones" },
  { id: "insights",      label: "tab_insights",      icon: "Sparkles",   tabKey: "insights" },
];

export default function App() {
  // Customizable categories state loaded from localStorage with premium defaults
  const [categorias, setCategorias] = useState<Omit<Categoria, 'monto'>[]>([
    { nombre: 'Vivienda', icon: 'Home', color: '#8B5A2B' },
    { nombre: 'Alimentación', icon: 'Utensils', color: '#F97316' },
    { nombre: 'Transporte', icon: 'Car', color: '#EF4444' },
    { nombre: 'Compras', icon: 'ShoppingBag', color: '#EC4899' },
    { nombre: 'Viajes', icon: 'Plane', color: '#3B82F6' },
    { nombre: 'Cuidado Personal y Entretenimiento', icon: 'Sparkles', color: '#10B981' },
    { nombre: 'Mascotas', icon: 'Heart', color: '#F43F5E' },
    { nombre: 'Moda y Estilo', icon: 'Scissors', color: '#9333EA' },
    { nombre: 'Otros', icon: 'MoreHorizontal', color: '#6B7280' },
  ]);

  // Explicitly save any changes to categories state
  const saveCategorias = (novas: Omit<Categoria, 'monto'>[]) => {
    setCategorias(novas);
    try {
      pushToFirestore(undefined, undefined, undefined, novas, undefined);
    } catch (e) {}
  };

  // Manage categories panel helper state
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#008B81');
  const [newCatIcon, setNewCatIcon] = useState('Home');
  const [iconManuallySet, setIconManuallySet] = useState(false);

  // Suggest sensible icon and color automatically based on typed category name
  useEffect(() => {
    const term = newCatName.toLowerCase().trim();
    if (!term) {
      setIconManuallySet(false); // campo vacio: reactivar auto-deteccion
      return;
    }
    if (iconManuallySet) return; // icono elegido a mano: no sobrescribir

    const petKeywords = ['mascota', 'mascotas', 'perro', 'gato', 'animal', 'pet', 'pets', 'dog', 'cat', 'veterinari', 'veterinario', 'veterinaria', 'peludo', 'fiel'];
    const foodKeywords = ['comida', 'restaurante', 'alimento', 'cena', 'almuerzo', 'desayuno', 'bocadillo', 'cafe', 'comidas', 'food', 'market', 'supermercado', 'fruta', 'verdura', 'domicilio', 'domicilios'];
    const travelKeywords = ['viaje', 'vuelo', 'avion', 'hotel', 'aeropuerto', 'pasaje', 'viajes', 'turismo', 'travel', 'trip', 'escapada'];
    const carKeywords = ['carro', 'transporte', 'auto', 'moto', 'gasolina', 'uber', 'taxi', 'peaje', 'vehiculo', 'gas', 'car', 'mantenimiento', 'taller', 'repuestos', 'coche', 'combustible', 'bencinera', 'nafta', 'estacionamiento', 'parking', 'lyft', 'cabify', 'beat', 'didi', 'bencina'];
    const shopKeywords = ['compras', 'compra', 'mercado', 'mall', 'shopp', 'shopping', 'regalo', 'regalos', 'tienda', 'retail', 'regalar'];
    const homeKeywords = ['casa', 'arriendo', 'hogar', 'vivienda', 'muebles', 'alquiler', 'luz', 'agua', 'gas', 'servicio', 'servicios', 'home', 'reparaciones'];
    const fashionKeywords = ['moda', 'ropa', 'fashion', 'peluqueria', 'tijeras', 'estilo', 'cortar', 'barbero', 'estilista', 'scissors', 'vestido', 'zapatos', 'corte', 'barba'];
    const sparklesKeywords = ['belleza', 'magia', 'limpieza', 'tecnologia', 'gadget', 'computador', 'diversion', 'ocio', 'entretenimiento', 'suscripcion', 'netflix', 'spotify', 'cine', 'luxury', 'brillo'];

    if (petKeywords.some(kw => term.includes(kw))) {
      setNewCatIcon('Heart');
      setNewCatColor('#F43F5E'); // Vibrant Rose-Pink
    } else if (foodKeywords.some(kw => term.includes(kw))) {
      setNewCatIcon('Utensils');
      setNewCatColor('#F97316'); // Orange
    } else if (travelKeywords.some(kw => term.includes(kw))) {
      setNewCatIcon('Plane');
      setNewCatColor('#3B82F6'); // Blue
    } else if (carKeywords.some(kw => term.includes(kw))) {
      setNewCatIcon('Car');
      setNewCatColor('#EF4444'); // Red
    } else if (shopKeywords.some(kw => term.includes(kw))) {
      setNewCatIcon('ShoppingBag');
      setNewCatColor('#EC4899'); // Pink
    } else if (homeKeywords.some(kw => term.includes(kw))) {
      setNewCatIcon('Home');
      setNewCatColor('#8B5A2B'); // Brown
    } else if (fashionKeywords.some(kw => term.includes(kw))) {
      setNewCatIcon('Scissors');
      setNewCatColor('#9333EA'); // Purple
    } else if (sparklesKeywords.some(kw => term.includes(kw))) {
      setNewCatIcon('Sparkles');
      setNewCatColor('#10B981'); // Emerald
    } else {
      setNewCatIcon('MoreHorizontal');
      setNewCatColor('#6B7280'); // sin coincidencia: icono neutro
    }
  }, [newCatName, iconManuallySet]);

  // Simulator state VS Full Screen State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [simulatedTime, setSimulatedTime] = useState('09:41');
  const [simulatedBattery] = useState(88);
  const [isMuted, setIsMuted] = useState(false);
  const [showSplash, setShowSplash] = useState(() => {
    try {
      const stored = localStorage.getItem('finanza_user_profile_v2');
      return !stored;
    } catch (e) {
      return true;
    }
  });
  
  // Country & Language config state
  const [selectedCountry, setSelectedCountry] = useState<'CO' | 'CL'>('CO');
  const [selectedLanguage, setSelectedLanguage] = useState<'ES' | 'EN'>('ES');
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [hasShownCountrySelector, setHasShownCountrySelector] = useState(false);

  // AI Chat Messages state (preserved across tabs)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // PDF password states
  const [pdfPasswordModalOpen, setPdfPasswordModalOpen] = useState(false);
  const [pdfPasswordInput, setPdfPasswordInput] = useState('');
  const [pdfPasswordResolve, setPdfPasswordResolve] = useState<((val: string) => void) | null>(null);
  const [pdfPasswordReject, setPdfPasswordReject] = useState<((err: any) => void) | null>(null);

  const askPdfPassword = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      setPdfPasswordInput('');
      setPdfPasswordResolve(() => resolve);
      setPdfPasswordReject(() => reject);
      setPdfPasswordModalOpen(true);
    });
  };

  // User profile and Colombia Financial products registry
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const savedTemp = localStorage.getItem('finanza_user_profile_v6_temp');
      if (savedTemp) return JSON.parse(savedTemp);
      
      const savedReal = localStorage.getItem('finanza_user_profile_v2');
      if (savedReal) return JSON.parse(savedReal);
    } catch {}

    return {
      nombre: 'Invitado',
      correo: '',
      celular: '',
      productos: [],
      portafolios: []
    };
  });

  // Enforce country configuration only for admin
  const MULTIPAIS_HABILITADO = true;
  const effectiveCountry = selectedCountry;
  const currencySymbol = '$';
  const monedaPais = effectiveCountry === 'CL' ? 'CLP' : 'COP';
  
  const activeBanks = effectiveCountry === 'CL' ? CHILEAN_BANKS : COLOMBIAN_BANKS;
  const activeProducts = effectiveCountry === 'CL' ? PRODUCT_TAB_DEBTS_ONLY_CL : PRODUCT_TAB_DEBTS_ONLY_CO;
  const activeFranchises = effectiveCountry === 'CL' ? CHILEAN_FRANCHISES : COLOMBIAN_FRANCHISES;

  // Translation Function (Dynamic Key Mapping)
  const t = (key: keyof typeof TRANSLATIONS.ES, replaces?: Record<string, string>): string => {
    const lang = selectedLanguage === 'EN' ? 'EN' : 'ES';
    let text = TRANSLATIONS[lang][key] || TRANSLATIONS.ES[key] || '';
    if (replaces) {
      Object.entries(replaces).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  // Currency specific calculations
  const formatCurrency = (val: number): string => {
    const currencySettings: Record<string, { symbol: string; locale: string }> = {
      CO: { symbol: '$', locale: 'es-CO' },
      CL: { symbol: '$', locale: 'es-CL' },
    };
    const { symbol, locale } = currencySettings[effectiveCountry] || { symbol: '$', locale: 'es-CO' };
    const formatted = val.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return `${symbol}${formatted}`;
  };

  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<'finance' | 'cloud' | 'productos' | 'portafolios' | 'insights' | 'suscripciones' | 'recurrentes'>('finance');
  
  // Estado del orden, persistido en localStorage
  const [tabOrder, setTabOrder] = useState<string[]>(() => {
    const defaultIds = ALL_TABS.map(t => t.id);
    try {
      const saved = localStorage.getItem("findream_tab_order_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const existing = parsed.filter(id => defaultIds.includes(id));
          const missing = defaultIds.filter(id => !existing.includes(id));
          const combined = [...existing, ...missing];
          const unique = Array.from(new Set(combined));
          if (unique.length === defaultIds.length) {
            return unique;
          }
        }
      }
    } catch (e) {}
    return defaultIds;
  });

  const [draggingTab, setDraggingTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTabLongPress = (tabId: string) => {
    longPressTimer.current = setTimeout(() => {
      setIsReorderMode(true);
      setDraggingTab(tabId);
      // Vibrar si el dispositivo lo soporta
      if (navigator.vibrate) navigator.vibrate(40);
    }, 500); // 500ms = tap largo
  };

  const handleTabPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDragOver = (tabId: string) => {
    if (!draggingTab || draggingTab === tabId) return;
    setDragOverTab(tabId);
    // Reordenar en tiempo real
    setTabOrder(prev => {
      const newOrder = [...prev];
      const fromIdx = newOrder.indexOf(draggingTab);
      const toIdx = newOrder.indexOf(tabId);
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggingTab);
      return newOrder;
    });
  };

  const handleDragEnd = () => {
    setDraggingTab(null);
    setDragOverTab(null);
    setIsReorderMode(false);
    // Guardar en localStorage
    localStorage.setItem("findream_tab_order_v1", JSON.stringify(tabOrder));
  };
  
  useEffect(() => {
    const activeBtn = document.getElementById(`tab-btn-${
      activeTab === "finance" ? "finance" :
      activeTab === "cloud" ? "cloud" :
      activeTab === "productos" ? "productos" :
      activeTab === "portafolios" ? "portafolios" :
      activeTab === "suscripciones" ? "suscripciones" :
      "insights"
    }`);
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
      });
    }
  }, [activeTab]);

  // Portafolio state
  const [nuevoPortafolio, setNuevoPortafolio] = useState({ nombre: '', valor: '', plataforma: '' });
  const [activeProductSubTab, setActiveProductSubTab] = useState<'actuales' | 'recomendaciones'>('actuales');
  const [activeInsightSubTab, setActiveInsightSubTab] = useState<'asesor' | 'insights'>('asesor');
  const [activeBalanceSubTab, setActiveBalanceSubTab] = useState<'movimientos' | 'recurrentes'>('movimientos');
  const [portfolioFilter, setPortfolioFilter] = useState<'all' | 'debit' | 'credit' | 'credits'>('all');
  
  // States for Hidden Product Forms (Toggle with + button)
  const [showAddProductTab, setShowAddProductTab] = useState(false);
  const [showAddProductSettings, setShowAddProductSettings] = useState(false);

  // States for Editing Transaction
  const [editingTransaction, setEditingTransaction] = useState<Transaccion | null>(null);
  const [editingPortafolio, setEditingPortafolio] = useState<any | null>(null);
  const [isSearchingCustomProducts, setIsSearchingCustomProducts] = useState(false);
  const [customProductError, setCustomProductError] = useState<string | null>(null);
  const [customProductRecommendations, setCustomProductRecommendations] = useState<any[]>([]);
  const [customProductQuery, setCustomProductQuery] = useState('');
  const [recommendationMode, setRecommendationMode] = useState<'ai' | 'explore' | 'manual'>('ai');

  const [editPortafolioNombre, setEditPortafolioNombre] = useState('');
  const [editPortafolioValor, setEditPortafolioValor] = useState('');
  const [editPortafolioPlataforma, setEditPortafolioPlataforma] = useState('');

  const [editingProducto, setEditingProducto] = useState<any | null>(null);

  const startEditingProducto = (p: any) => {
    setEditingProducto(p);
    setShowAddProductTab(true);
  };

  const handleSaveEditedProducto = () => {
    if (!editingProducto) return;
    const updated = (userProfile.productos || []).map(p =>
      p.id === editingProducto.id ? { ...editingProducto } : p
    );
    saveUserProfileData({ ...userProfile, productos: updated });
    setEditingProducto(null);
    setShowAddProductTab(false);
    triggerDynamicIsland(
      selectedLanguage === "ES" ? "Producto Actualizado" : "Product Updated",
      `${editingProducto.banco}`,
      true
    );
  };

  // Security Locking / Confirm Identity on start
  const [isAppLocked, setIsAppLocked] = useState(() => {
    try {
      const hasProfile = localStorage.getItem('finanza_user_profile_v2');
      if (hasProfile) {
        const parsed = JSON.parse(hasProfile);
        return !!parsed.contraseña;
      }
      return false;
    } catch (e) {
      return false;
    }
  });
  const [lockPasswordInput, setLockPasswordInput] = useState('');
  const [lockIsScanning, setLockIsScanning] = useState(false);
  const [lockStatus, setLockStatus] = useState({ type: '', text: '' });

  // Biometrics enrollment & activation states
  const [isBiometricRegistered, setIsBiometricRegistered] = useState(() => {
    try {
      return localStorage.getItem('findream_biometric_registered') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isEnrollingBiometrics, setIsEnrollingBiometrics] = useState(false);
  const [biometricEnrollMsg, setBiometricEnrollMsg] = useState({ type: '', text: '' });

  // User profile and Colombia Financial products registry
  const [isCuentaOpen, setIsCuentaOpen] = useState(false);

  // Multiple Dreams (Sueño) persistent configuration
  const [suenos, setSuenos] = useState<Sueno[]>([]);
  const [activeSuenoId, setActiveSuenoId] = useState<string>('');

  // Load States on mount or when splash completes
  useEffect(() => {
    const savedTemp = localStorage.getItem('finanza_user_profile_v6_temp');
    if (savedTemp) {
      try {
        const parsed = JSON.parse(savedTemp);
        setUserProfile(parsed);
        localStorage.setItem('finanza_user_profile_v2', savedTemp);
        localStorage.removeItem('finanza_user_profile_v6_temp');
      } catch (e) {
        console.error(e);
      }
    } else {
      const savedReal = localStorage.getItem('finanza_user_profile_v2');
      if (savedReal) {
        try {
          setUserProfile(JSON.parse(savedReal));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [showSplash]);

  // Payment Methods persistent configuration
  const [paymentMethods, setPaymentMethods] = useState<string[]>([
    'Efectivo',
    'Tarjeta de Débito',
    'Tarjeta de Crédito',
    'Transferencia Bancaria'
  ]);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log('Login redirect exitoso:', result.user.email);
          setIsAppLocked(false);
          setShowSplash(false);

          const pendingScopes = sessionStorage.getItem('pending_sheets_scopes');
          if (pendingScopes) {
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
              const scopes = JSON.parse(pendingScopes);
              setCachedAccessToken(credential.accessToken, scopes);
              sessionStorage.removeItem('pending_sheets_scopes');
              
              // Trigger sheets import
              setTimeout(() => {
                if (importFromSheetsRef.current) {
                  importFromSheetsRef.current();
                }
              }, 300);
            }
          }
        }
      })
      .catch((error) => {
        console.error('Error de redirect:', error);
        alert('Error al completar el inicio de sesión: ' + error.message);
      });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        console.log('Auth state changed - usuario autenticado:', user.email);
        setIsAppLocked(false);
      }
    });
    return () => unsub();
  }, []);

  const saveUserProfileData = (updated: UserProfile) => {
    setUserProfile(updated);
    localStorage.setItem('finanza_user_profile_v2', JSON.stringify(updated));
    pushToFirestore(updated, undefined, undefined, undefined, undefined);
  };

  // Migration: Limpiar datos obsoletos de localStorage (Solo una vez por sesión - Point 2)
  useEffect(() => {
    try {
      const isMigrated = sessionStorage.getItem('finanza_v2_migrated');
      if (!isMigrated) {
        localStorage.removeItem('finanza_user_profile_v6_temp');
        localStorage.removeItem('finanza_user_profile_v1');
        localStorage.removeItem('finanza_last_local_update_old');
        sessionStorage.setItem('finanza_v2_migrated', 'true');
      }
    } catch (e) {}
  }, []);

  // Foolproof stable date parser to prevent any UTC/timezone shifting across all regions.
  // We extract YYYY-MM-DD directly and construct a strictly local Date object at 12:00 PM noon.
  const formatSafeDateString = (isoString: string) => {
    if (!isoString) return new Date();
    const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
    }
    // Fallback if string is completely bizarre
    let dateObj = new Date(isoString);
    if (!isoString.includes('T')) {
      dateObj = new Date(isoString + "T12:00:00");
    }
    return dateObj;
  };

  // Create local YYYY-MM-DD string to feed into <input type="date">
  const formatLocalYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const normalizarFecha = (fechaStr: string): string => {
    if (!fechaStr || fechaStr.trim() === '') {
      return formatLocalYYYYMMDD(new Date());
    }
    
    // Intentar parsear fecha ISO YYYY-MM-DD
    const isoMatch = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1]);
      const month = isoMatch[2];
      const day = isoMatch[3];
      const today = new Date();
      
      // Si el año es menor al actual, asumir año actual
      if (year < today.getFullYear()) {
        return `${today.getFullYear()}-${month}-${day}`;
      }
      return `${year}-${month}-${day}`;
    }
    
    // Si no es ISO, intentar parsear con parsedate o devolver hoy
    // (Gemini a veces extrae "5 jun" sin año, en ese caso usar hoy)
    return formatLocalYYYYMMDD(new Date());
  };

  const startEditingPortafolio = (p: any) => {
    setEditingPortafolio(p);
    setEditPortafolioNombre(p.nombre);
    setEditPortafolioValor(String(p.valor));
    setEditPortafolioPlataforma(p.plataforma);
  };

  const handleCustomProductSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsSearchingCustomProducts(true);
    setCustomProductError(null);
    try {
      const response = await fetch("/api/gemini/recommend-custom-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          country: effectiveCountry === 'CO' ? 'Colombia' : 'Chile',
          language: selectedLanguage,
        })
      });

      if (!response.ok) {
        throw new Error(selectedLanguage === 'ES' ? "No se pudo obtener las recomendaciones de la IA." : "Failed to obtain AI recommendations.");
      }

      const data = await response.json();
      if (data && data.products) {
        setCustomProductRecommendations(data.products);
      } else {
        throw new Error(selectedLanguage === 'ES' ? "Respuesta inválida de la IA." : "Invalid response from AI.");
      }
    } catch (err: any) {
      console.error(err);
      setCustomProductError(err.message || "Ocurrió un error.");
    } finally {
      setIsSearchingCustomProducts(false);
    }
  };



  const handleLinkRecommendedProduct = (rec: RecommendedProduct) => {
    let tipo: any = 'Tarjeta de Crédito';
    const lowerProd = rec.producto.toLowerCase();
    if (lowerProd.includes('cuenta') || lowerProd.includes('ahorro') || lowerProd.includes('débito') || lowerProd.includes('debito')) {
      tipo = 'Cuenta de Ahorros';
    } else if (lowerProd.includes('cdt')) {
      tipo = 'CDT';
    } else if (lowerProd.includes('inversión') || lowerProd.includes('inversion')) {
      tipo = 'Inversión Digital';
    } else if (lowerProd.includes('crédito') || lowerProd.includes('credito') || lowerProd.includes('prestamo') || lowerProd.includes('préstamo')) {
      tipo = 'Crédito de Consumo';
    }

    const newProd: ProductoFinanciero = {
      id: `prod-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      banco: rec.banco,
      tipo: tipo,
      alias: rec.producto,
      montoTotal: undefined,
      montoUtilizado: undefined
    };

    const updatedProds = [...(userProfile.productos || []), newProd];
    saveUserProfileData({ ...userProfile, productos: updatedProds });
    playTone('success', isMuted);
    triggerDynamicIsland(
      selectedLanguage === 'ES' ? "Portafolio Agregado" : "Portfolio Added",
      `${rec.banco} • ${rec.producto}`,
      true
    );
  };

  const getMergedPaymentMethods = (): string[] => {
    const defaults = ['Efectivo', 'Tarjeta de Débito', 'Tarjeta de Crédito', 'PSE / Débito', 'Transferencia Bancaria'];
    if (userProfile.productos && userProfile.productos.length > 0) {
      const bankProducts = userProfile.productos.map(p => {
        const aliasStr = p.alias ? ` (${p.alias})` : '';
        return `${p.banco} - ${p.tipo}${aliasStr}`;
      });
      return Array.from(new Set([...defaults, ...bankProducts]));
    }
    return defaults;
  };

  const getProductUtilizado = (prod: ProductoFinanciero): number => {
    const matchingOptionName = `${prod.banco} - ${prod.tipo}${prod.alias ? ` (${prod.alias})` : ''}`;
    const extraUsed = transacciones.reduce((total, t) => {
      if (t.formaPago === matchingOptionName) {
        if (t.tipo === 'Gasto') {
          return total + t.monto;
        } else if (t.tipo === 'Ingreso') {
          return total - t.monto;
        }
      }
      return total;
    }, 0);
    return Math.max(0, (prod.montoUtilizado || 0) + extraUsed);
  };



  // Initialize chat messages reactively on Language, Dream, or Country changes
  useEffect(() => {
    const actDream = suenos.find(s => s.id === activeSuenoId);
    const dreamName = actDream ? actDream.nombre : (selectedLanguage === 'ES' ? 'tu sueño' : 'your dream');
    const dreamMeta = actDream ? formatCurrency(actDream.meta) : (selectedLanguage === 'ES' ? 'tu meta' : 'your goal');
    
    const rawGreeting = t('chat_initial_greeting');
    const greeting = rawGreeting
      .replace('{dream}', dreamName)
      .replace('{meta}', dreamMeta);

    
  }, [selectedLanguage, activeSuenoId, suenos, effectiveCountry]);

  // Translate Category name dynamically for display
  const translateCategory = (catName: string): string => {
    if (selectedLanguage === 'EN') {
      switch (catName) {
        case 'Vivienda': return 'Housing';
        case 'Alimentación': return 'Food';
        case 'Transporte': return 'Transport';
        case 'Compras': return 'Shopping';
        case 'Viajes': return 'Trips';
        case 'Cuidado Personal y Entretenimiento': return 'Personal Care & Entertainment';
        case 'Mascotas': return 'Pets';
        case 'Moda y Estilo': return 'Fashion & Style';
        case 'Otros': return 'Others';
        default: return catName;
      }
    }
    return catName;
  };

  // Securely translate bold markings & bullet lists from raw Markdown output
  const renderMarkdownMsg = (rawText: string) => {
    const parts = rawText.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-extrabold text-[#006050] bg-teal-50 px-1 py-0.5 rounded-sm border border-teal-100/30">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i} className="font-medium">{part}</span>;
    });
  };

  const saveSuenosList = (updated: Sueno[]) => {
    setSuenos(updated);
    pushToFirestore(undefined, undefined, updated, undefined, undefined);
  };

  const handleSelectSueno = (id: string) => {
    setActiveSuenoId(id);
    localStorage.setItem('finanza_suenos_active_id_v2', id);
    playTone('tap', isMuted);
  };

  const handleAddSueno = (nombre: string, meta: number, manualRate: number, usarReal: boolean) => {
    const paisMoneda = effectiveCountry === 'CL' ? 'CLP' : 'COP';
    const newSueno: Sueno = {
      id: `sueno-${Date.now()}`,
      nombre,
      meta,
      ahorroManual: manualRate,
      usarReal,
      paisMoneda, // <-- NUEVO
    };
    const updated = [...suenos, newSueno];
    saveSuenosList(updated);
    setActiveSuenoId(newSueno.id);
    localStorage.setItem('finanza_suenos_active_id_v2', newSueno.id);
    playTone('success', isMuted);
    triggerDynamicIsland("Nuevo Sueño", `"${nombre}" Añadido`, true);
  };

  const handleUpdateSueno = (updatedSueno: Sueno) => {
    const updated = suenos.map(s => s.id === updatedSueno.id ? updatedSueno : s);
    saveSuenosList(updated);
  };

  const handleDeleteSueno = (id: string) => {
    requestConfirmation(
      "Eliminar Sueño",
      "¿Estás seguro de que deseas eliminar este sueño? La planificación asociada se perderá.",
      () => {
        const filtered = suenos.filter(s => s.id !== id);
        saveSuenosList(filtered);
        if (filtered.length > 0) {
          setActiveSuenoId(filtered[0].id);
          localStorage.setItem('finanza_suenos_active_id_v2', filtered[0].id);
        } else {
          setActiveSuenoId('');
          localStorage.setItem('finanza_suenos_active_id_v2', '');
        }
        playTone('delete', isMuted);
        triggerDynamicIsland("Sueño Eliminado", "Se removió de tu lista.", false);
      }
    );
  };

  const savePaymentMethods = (updated: string[]) => {
    setPaymentMethods(updated);
    pushToFirestore(undefined, undefined, undefined, undefined, updated);
  };

  // Core Financial State
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [filtroSeleccionado, setFiltroSeleccionado] = useState<FiltroTiempo>("Mes");
  const [busquedaGasto, setBusquedaGasto] = useState<string>('');
  const [rangoInicio, setRangoInicio] = useState<string>(''); // 'YYYY-MM-DD'
  const [rangoFin, setRangoFin] = useState<string>(''); // 'YYYY-MM-DD'
  const [ordenSeleccionado, setOrdenSeleccionado] = useState<'MasReciente' | 'MayorGasto'>('MasReciente');

  // Duplicate detection state
  const [duplicatesPending, setDuplicatesPending] = useState<Transaccion[]>([]);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [isReviewingDetail, setIsReviewingDetail] = useState(false);
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<string[]>([]);
  const [showMixedImportModal, setShowMixedImportModal] = useState(false);
  const [mixedImportState, setMixedImportState] = useState<{
    nuevos: Transaccion[];
    duplicados: Transaccion[];
    totalNuevos: number;
    totalDuplicados: number;
  } | null>(null);
  // Bottom Sheet State
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [autoOpenSubModal, setAutoOpenSubModal] = useState(false);
  const [startVoiceOnAdd, setStartVoiceOnAdd] = useState(false);
  const [popupInitialChoice, setPopupInitialChoice] = useState<'choice' | 'form' | null>('choice');
  const [prefilledCategory, setPrefilledCategory] = useState<string | null>(null);
  const [initialTransactionForModal, setInitialTransactionForModal] = useState<any | null>(null);

  // Quick Category Add States
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddCategory, setQuickAddCategory] = useState('');
  const [quickAddMonto, setQuickAddMonto] = useState('');
  const [quickAddDescripcion, setQuickAddDescripcion] = useState('');
  const [quickAddFormaPago, setQuickAddFormaPago] = useState('Efectivo');
  const [quickAddFecha, setQuickAddFecha] = useState(() => new Date().toISOString().substring(0, 10));

  // Custom iOS Confirm Dialog State (completely bypassing blocked iframe popups)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const requestConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Auth Guide helper states
  const [showAuthGuide, setShowAuthGuide] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);


  // Dynamic Notch Alert / Dynamic Island Active Notification
  const [notchAlert, setNotchAlert] = useState<{ text: string; subtext: string; isPositive: boolean } | null>(null);

  // Speech Recognition hook states
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  // Suscripciones state and persistence handler
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const saveSuscripcionesList = (updated: Suscripcion[]) => {
    setSuscripciones(updated);
    pushToFirestore(undefined, undefined, undefined, undefined, undefined, updated);
  };

  // Gastos Recurrentes state and persistence handler
  const [gastosRecurrentes, setGastosRecurrentes] = useState<GastoRecurrente[]>([]);
  const saveGastosRecurrentes = (updated: GastoRecurrente[]) => {
    setGastosRecurrentes(updated);
    pushToFirestore(
      undefined, undefined, undefined, undefined,
      undefined, undefined, updated
    );
  };

  const { rates, loading: exchangeLoading, convertir } = useExchangeRate();
  const totalSuscripcionesMes = useMemo(() => {
    return (suscripciones || []).reduce((sum, s) => {
      const convertedMonto = convertir(s.monto, s.moneda, effectiveCountry === 'CL' ? 'CLP' : 'COP');
      return sum + (s.frecuencia === "Anual" ? convertedMonto / 12 : convertedMonto);
    }, 0);
  }, [suscripciones, convertir, effectiveCountry]);

  const { isSyncing, lastSyncedTime, pushToFirestore, isLocalMode, availableCountries } = useFirestore(
    showSplash,
    userProfile, setUserProfile,
    transacciones, setTransacciones,
    suenos, setSuenos,
    categorias, setCategorias,
    paymentMethods, setPaymentMethods,
    suscripciones, setSuscripciones,
    gastosRecurrentes, setGastosRecurrentes,
    setNotchAlert,
    selectedLanguage,
    effectiveCountry
  );

  useEffect(() => {
    if (!showSplash && availableCountries && availableCountries.length > 1 && !hasShownCountrySelector) {
      setShowCountrySelector(true);
      setHasShownCountrySelector(true);
    }
  }, [availableCountries, showSplash, hasShownCountrySelector]);

  // C2 — Auto-registro diario
  useEffect(() => {
    const user = auth.currentUser;
    if (showSplash || !user) return;
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const fechaHoyISO = hoy.toISOString().split('T')[0];
    const monedaActiva = effectiveCountry === 'CL' ? 'CLP' : 'COP';
    const nuevasTx: Transaccion[] = [];
    const gastosActualizados = gastosRecurrentes.map(g => {
      // Solo procesar si: activo + autoRegistrar + mismo pais
      // + dia de pago coincide + no registrado hoy ya
      if (
        !g.activo ||
        !g.autoRegistrar ||
        g.paisMoneda !== monedaActiva ||
        !g.diasPago.includes(diaHoy) ||
        g.ultimoRegistro === fechaHoyISO
      ) return g;
      // Crear la transaccion automaticamente
      const nuevaTx: Transaccion = {
        id: `rec-${g.id}-${fechaHoyISO}`,
        descripcion: g.nombre,
        monto: -Math.abs(g.monto),
        fecha: fechaHoyISO,
        categoria: g.categoria,
        formaPago: g.metodoPago,
        tipo: 'Gasto',
        esRecurrente: true, // marcar origen
        idRecurrente: g.id,
        paisMoneda: g.paisMoneda,
      };
      nuevasTx.push(nuevaTx);

      // Trigger user push/PWA notification if enabled
      if (g.notificacionActiva && typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          try {
            new Notification(selectedLanguage === 'ES' ? 'Gasto Recurrente Registrado' : 'Recurring Expense Registered', {
              body: selectedLanguage === 'ES'
                ? `Se registró automáticamente: ${g.nombre} por $${g.monto.toLocaleString()}`
                : `Automatically registered: ${g.nombre} for $${g.monto.toLocaleString()}`,
            });
          } catch (e) {
            console.warn("Browser notification blocked:", e);
          }
        }
      }

      return { ...g, ultimoRegistro: fechaHoyISO };
    });
    if (nuevasTx.length > 0) {
      const txActualizadas = [...transacciones, ...nuevasTx];
      setTransacciones(txActualizadas);
      pushToFirestore(undefined, txActualizadas);
      saveGastosRecurrentes(gastosActualizados);
      setNotchAlert({
        text: selectedLanguage === 'ES'
          ? `Se registraron ${nuevasTx.length} gasto(s) recurrente(s) automáticamente`
          : `Automatically registered ${nuevasTx.length} recurring expense(s)`,
        subtext: selectedLanguage === 'ES'
          ? `Se han creado los registros en tu balance`
          : `They have been registered in your balance`,
        isPositive: true
      });
    }
  }, [showSplash, effectiveCountry, gastosRecurrentes, transacciones, selectedLanguage]);

  // Handlers



  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [hideBalances, setHideBalances] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('finanza_hide_balances_v2');
      return stored !== null ? stored === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('finanza_hide_balances_v2', String(hideBalances));
    } catch (e) {}
  }, [hideBalances]);

  const triggerDuplicatesModal = (dups: Transaccion[]) => {
    setDuplicatesPending(dups);
    setSelectedDuplicateIds([]);
    setIsReviewingDetail(false);
    setShowDuplicatesModal(true);
  };

  const handleMixedImportAddAll = () => {
    if (!mixedImportState) return;
    const allToAdd = [...mixedImportState.nuevos, ...mixedImportState.duplicados];
    saveTransacciones([...allToAdd, ...transacciones]);
    triggerDynamicIsland(
      selectedLanguage === 'ES' ? 'Completado' : 'Done',
      selectedLanguage === 'ES'
        ? `Se agregaron ${allToAdd.length} movimientos (${mixedImportState.totalNuevos} nuevos + ${mixedImportState.totalDuplicados} duplicados).`
        : `${allToAdd.length} transactions added (${mixedImportState.totalNuevos} new + ${mixedImportState.totalDuplicados} duplicates).`,
      true
    );
    playTone('success', isMuted);
    setShowMixedImportModal(false);
    setMixedImportState(null);
  };

  const handleMixedImportOnlyNew = () => {
    if (!mixedImportState) return;
    saveTransacciones([...mixedImportState.nuevos, ...transacciones]);
    triggerDynamicIsland(
      selectedLanguage === 'ES' ? 'Completado' : 'Done',
      selectedLanguage === 'ES'
        ? `Se agregaron ${mixedImportState.totalNuevos} movimientos (${mixedImportState.totalDuplicados} omitidos por estar duplicados).`
        : `${mixedImportState.totalNuevos} new transactions added (${mixedImportState.totalDuplicados} duplicates skipped).`,
      true
    );
    playTone('success', isMuted);
    setShowMixedImportModal(false);
    setMixedImportState(null);
  };

  const handleMixedImportReviewDuplicates = () => {
    if (!mixedImportState) return;
    // Primero agregar los nuevos
    saveTransacciones([...mixedImportState.nuevos, ...transacciones]);
    triggerDynamicIsland(
      selectedLanguage === 'ES' ? 'Completado' : 'Done',
      selectedLanguage === 'ES'
        ? `Se agregaron ${mixedImportState.totalNuevos} movimientos nuevos.`
        : `${mixedImportState.totalNuevos} new transactions added.`,
      true
    );
    playTone('success', isMuted);
    // Luego mostrar el modal de duplicados para que el usuario decida
    const originalDups = mixedImportState.duplicados;
    setShowMixedImportModal(false);
    setMixedImportState(null);
    triggerDuplicatesModal(originalDups);
  };

  const extractTransactionsFromFile = async (file: File): Promise<Transaccion[]> => {
    const isVideo = (file.type && file.type.startsWith('video/')) || 
                    file.name.toLowerCase().endsWith('.mp4') || 
                    file.name.toLowerCase().endsWith('.mov') || 
                    file.name.toLowerCase().endsWith('.avi') || 
                    file.name.toLowerCase().endsWith('.mkv') ||
                    file.name.toLowerCase().endsWith('.3gp');
    if (isVideo) {
      triggerDynamicIsland("Procesando", selectedLanguage === 'ES' ? `Analizando video con IA: ${file.name}...` : `Analyzing video with AI: ${file.name}...`, true);
      
      let wakeLock: any = null;
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (e) {
        console.warn('Wake Lock no disponible:', e);
      }

      try {
        const videoUrl = URL.createObjectURL(file);
        const videoEl = document.createElement('video');
        videoEl.src = videoUrl;
        videoEl.muted = true;
        videoEl.playsInline = true;
        // Esperar canplay garantiza que el primer frame esta decodificado
        // y listo para ser capturado con drawImage
        await new Promise<void>((resolve, reject) => {
          videoEl.oncanplay = () => resolve();
          videoEl.onerror = () => reject(new Error('No se pudo cargar el video'));
          setTimeout(() => reject(new Error('Timeout')), 15000); // +5s por seguridad
          videoEl.load(); // forzar carga del primer frame
        });
        const duration = videoEl.duration || 10;
        const canvas = document.createElement('canvas');
        canvas.width = 720;
        canvas.height = Math.round(
          720 * (videoEl.videoHeight / (videoEl.videoWidth || 720)));
        const ctx = canvas.getContext('2d')!;
        
        // 1 frame por segundo, maximo 60 frames
        // Gemini 2.5 Flash soporta hasta 100 imagenes por llamada
        const MAX_FRAMES = 60;
        const NUM_FRAMES = Math.min(
          Math.ceil(duration) + 1, // 1 frame x segundo + frame inicial
          MAX_FRAMES
        );
        const frames: string[] = [];
        for (let i = 0; i < NUM_FRAMES; i++) {
          // Distribuir de 0 a duration inclusive
          // i=0 -> segundo 0 (inicio exacto)
          // i=NUM_FRAMES-1 -> segundo final
          const seekTime = NUM_FRAMES === 1
            ? 0
            : (duration / (NUM_FRAMES - 1)) * i;
          // Proteger contra valores que excedan la duracion
          const seekTimeSafe = Math.min(seekTime, duration - 0.05);
          await new Promise<void>((resolve) => {
            videoEl.currentTime = seekTimeSafe;
            videoEl.onseeked = () => {
              ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
              const frameBase64 = canvas.toDataURL('image/jpeg', 0.85) // mejor calidad
                .split(',')[1];
              frames.push(frameBase64);
              resolve();
            };
          });
        }
        URL.revokeObjectURL(videoUrl);

        const resp = await fetch('/api/gemini/extract-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frames, country: selectedCountry })
        });
        if (!resp.ok) throw new Error('Error en el servidor');
        const data = await resp.json();
        const txs = data.transacciones || [];
        
        if (txs.length === 0) {
          triggerDynamicIsland("Error", selectedLanguage === 'ES' ? `No se encontraron transacciones en el video: ${file.name}.` : `No transactions found in video: ${file.name}.`, false);
          return [];
        }

        let currentCatsVideo = [...categorias];
        const newTxList = txs.map((data: any) => {
          let cat = 'Otros';
          if (data.categoria) {
            let matchedCat = currentCatsVideo.find(c => c.nombre.toLowerCase() === data.categoria.toLowerCase());
            if (!matchedCat) {
              matchedCat = currentCatsVideo.find(c => data.categoria.toLowerCase().includes(c.nombre.toLowerCase()) || 
                                               c.nombre.toLowerCase().includes(data.categoria.toLowerCase()));
            }
            if (matchedCat) {
              cat = matchedCat.nombre;
            } else {
              const nombreNuevo = data.categoria.charAt(0).toUpperCase() + data.categoria.slice(1).toLowerCase();
              const yaExiste = currentCatsVideo.some(c => c.nombre.toLowerCase() === nombreNuevo.toLowerCase());
              if (!yaExiste) {
                const nuevaCat = {
                  nombre: nombreNuevo,
                  icon: 'MoreHorizontal',
                  color: '#64748B',
                };
                currentCatsVideo.push(nuevaCat);
                saveCategorias(currentCatsVideo);
              }
              cat = nombreNuevo;
            }
          }
          
          let forma = getMergedPaymentMethods()[0];
          if (data.banco) {
            const pms = getMergedPaymentMethods();
            let matchedPm = pms.find(pm => pm.toLowerCase().includes(data.banco.toLowerCase()) || data.banco.toLowerCase().includes(pm.toLowerCase()));
            if (matchedPm) forma = matchedPm;
          }
          
          const tx: Transaccion = {
            id: Math.random().toString(36).substring(2, 9),
            tipo: data.tipo === 'Ingreso' ? 'Ingreso' : 'Gasto',
            monto: Math.abs(normalizarMonto(data.monto)) || 0,
            categoria: cat,
            fecha: normalizarFecha(data.fecha || ''),
            descripcion: data.descripcion || `Transacción en ${cat}`,
            formaPago: forma,
            paisMoneda: effectiveCountry === 'CL' ? 'CLP' : 'COP',
          };
          return tx;
        });

        return newTxList;
      } catch (error) {
        console.error(error);
        triggerDynamicIsland("Error", selectedLanguage === 'ES' ? `No se pudo extraer información del video: ${file.name}` : `Could not extract info from video: ${file.name}`, false);
        return [];
      } finally {
        if (wakeLock) {
          try {
            await wakeLock.release();
          } catch (err) {
            console.error('Error releasing wake lock:', err);
          }
          wakeLock = null;
        }
      }
    } else {
      triggerDynamicIsland("Procesando", selectedLanguage === 'ES' ? `Analizando documento con IA: ${file.name}...` : `Analyzing document with AI: ${file.name}...`, true);
      try {
        let fileBase64 = '';
        let mimeType = file.type;
        let textContent = '';

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          textContent = XLSX.utils.sheet_to_csv(worksheet);
          mimeType = 'text/csv';
        } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
          textContent = await file.text();
          mimeType = 'text/csv';
        } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          try {
            textContent = await extractPdfText(file);
            mimeType = 'text/plain';
          } catch (err: any) {
            if (err?.name === 'PasswordException') {
              try {
                const password = await askPdfPassword(file);
                textContent = await extractPdfText(file, password);
                mimeType = 'text/plain';
              } catch (wrongPassErr: any) {
                if (wrongPassErr?.name === 'PasswordException') {
                  triggerDynamicIsland('Error',
                    selectedLanguage === 'ES'
                      ? 'Contraseña incorrecta. El PDF no pudo abrirse.'
                      : 'Wrong password. Could not open the PDF.',
                    false);
                  return [];
                }
                throw wrongPassErr;
              }
            } else {
              throw err;
            }
          }
        } else {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
          }
          fileBase64 = window.btoa(binary);
        }

        const response = await fetch('/api/gemini/extract-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64, mimeType, textContent })
        });

        if (!response.ok) throw new Error('Error en el servidor');
        const dataArray = await response.json();
        
        const parsedArray = Array.isArray(dataArray) ? dataArray : [dataArray];
        
        let currentCatsPhoto = [...categorias];
        const newTxList = parsedArray.map(data => {
          let cat = 'Otros';
          if (data.categoria) {
            let matchedCat = currentCatsPhoto.find(c => c.nombre.toLowerCase() === data.categoria.toLowerCase());
            if (!matchedCat) {
              matchedCat = currentCatsPhoto.find(c => data.categoria.toLowerCase().includes(c.nombre.toLowerCase()) || 
                                               c.nombre.toLowerCase().includes(data.categoria.toLowerCase()));
            }
            if (matchedCat) {
              cat = matchedCat.nombre;
            } else {
              const nombreNuevo = data.categoria.charAt(0).toUpperCase() + data.categoria.slice(1).toLowerCase();
              const yaExiste = currentCatsPhoto.some(c => c.nombre.toLowerCase() === nombreNuevo.toLowerCase());
              if (!yaExiste) {
                const nuevaCat = {
                  nombre: nombreNuevo,
                  icon: 'MoreHorizontal',
                  color: '#64748B',
                };
                currentCatsPhoto.push(nuevaCat);
                saveCategorias(currentCatsPhoto);
              }
              cat = nombreNuevo;
            }
          }
          
          let forma = getMergedPaymentMethods()[0];
          if (data.banco) {
            const pms = getMergedPaymentMethods();
            let matchedPm = pms.find(pm => pm.toLowerCase().includes(data.banco.toLowerCase()) || data.banco.toLowerCase().includes(pm.toLowerCase()));
            if (matchedPm) forma = matchedPm;
          }
          
          const tx: Transaccion = {
            id: Math.random().toString(36).substring(2, 9),
            tipo: 'Gasto', // Safest logic for uploaded receipts
            monto: normalizarMonto(data.monto) || 0,
            categoria: cat,
            fecha: normalizarFecha(data.fecha || ''),
            descripcion: data.nombre || `Gasto en ${cat}`,
            formaPago: forma,
            paisMoneda: effectiveCountry === 'CL' ? 'CLP' : 'COP',
          };
          return tx;
        });
        
        return newTxList;
      } catch (error) {
        console.error(error);
        triggerDynamicIsland("Error", selectedLanguage === 'ES' ? `No se pudo extraer información del documento: ${file.name}` : `Could not extract info from document: ${file.name}`, false);
        return [];
      }
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    setIsUploadingDocument(true);
    let allNewTxList: Transaccion[] = [];
    try {
      for (const file of files) {
        const txList = await extractTransactionsFromFile(file);
        allNewTxList = [...allNewTxList, ...txList];
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploadingDocument(false);
    }

    if (allNewTxList.length === 0) return;

    setIsAddingOpen(false);

    requestConfirmation(
      selectedLanguage === 'ES' ? 'Confirmar importación' : 'Confirm Import',
      selectedLanguage === 'ES'
        ? `Se encontraron ${allNewTxList.length} movimientos por un total de $${allNewTxList.reduce((sum, t) => sum + t.monto, 0).toLocaleString()}. ¿Deseas agregarlos?`
        : `Found ${allNewTxList.length} transactions totaling $${allNewTxList.reduce((sum, t) => sum + t.monto, 0).toLocaleString()}. Do you want to add them?`,
      () => {
        // Normaliza texto: minusculas, sin tildes, sin espacios extra
        const normalizar = (s: string) =>
          (s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Diferencia en dias entre dos fechas
        // (acepta Date, timestamp o string ISO)
        const difDias = (a: any, b: any) => {
          const fa = new Date(a).getTime();
          const fb = new Date(b).getTime();
          if (isNaN(fa) || isNaN(fb)) return Infinity;
          return Math.abs(fa - fb) / 86400000; // ms por dia
        };

        // --- NUEVO: deduplicar DENTRO de la tanda entrante ---
        // Evita que el mismo gasto repetido en varias fotos/videos
        // se guarde dos veces (esDup solo mira contra lo ya guardado).
        const dedupInterno = (lista: Transaccion[]): Transaccion[] => {
          const unicos: Transaccion[] = [];
          for (const nt of lista) {
            const yaEsta = unicos.some(u =>
              u.monto === nt.monto &&
              normalizar(u.descripcion) === normalizar(nt.descripcion) &&
              difDias(u.fecha, nt.fecha) === 0
            );
            if (!yaEsta) unicos.push(nt);
          }
          return unicos;
        };
        allNewTxList = dedupInterno(allNewTxList);
        // --- FIN NUEVO ---

        const esDup = (nt: Transaccion) =>
          transacciones.some(tx =>
            tx.monto === nt.monto &&
            normalizar(tx.descripcion) === normalizar(nt.descripcion) &&
            difDias(tx.fecha, nt.fecha) <= 2
          );
        const dups = allNewTxList.filter(esDup);
        const nuevos = allNewTxList.filter(nt => !esDup(nt));

        // OPCION C - Logica condicional
        if (nuevos.length === 0 && dups.length > 0) {
          // CASO 1: SOLO DUPLICADOS -> directo al modal de duplicados
          triggerDuplicatesModal(dups);
        } else if (nuevos.length > 0 && dups.length === 0) {
          // CASO 2: SOLO NUEVOS -> agregar y confirmar (flujo normal)
          saveTransacciones([...nuevos, ...transacciones]);
          triggerDynamicIsland(
            selectedLanguage === 'ES' ? 'Completado' : 'Done',
            selectedLanguage === 'ES'
              ? `Se agregaron ${nuevos.length} movimientos.`
              : `${nuevos.length} transactions added.`,
            true
          );
          playTone('success', isMuted);
        } else if (nuevos.length > 0 && dups.length > 0) {
          // CASO 3: NUEVOS + DUPLICADOS -> mostrar pestaña intermedia
          setMixedImportState({
            nuevos: nuevos,
            duplicados: dups,
            totalNuevos: nuevos.length,
            totalDuplicados: dups.length
          });
          setShowMixedImportModal(true);
        }
      }
    );
    e.target.value = '';
  };

  const importFromSheetsRef = useRef<(() => Promise<void>) | null>(null);

  // --- CONTROLES DE MANTENER PRESIONADO (LONG PRESS) PARA EL BOTÓN + ---
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef<boolean>(false);

  const startPressLong = (e: React.MouseEvent | React.TouchEvent) => {
    isHoldingRef.current = false;
    
    longPressTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      handleTap(); // Sonido háptico/clic
      
      // Activa dictado por voz directamente, saltando la pantalla de selección
      setPopupInitialChoice('form');
      setIsAddingOpen(true);
      
      // Esperar brevemente que abra la hoja deslizable e iniciar dictado
      setTimeout(() => {
        setStartVoiceOnAdd(true);
      }, 350);
    }, 600); // Tiempo límite para mantener apretado (600ms)
  };

  const endPressLong = (e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // Si NO llegó a considerarse mantener presionado (fue un clic corto)
    if (!isHoldingRef.current) {
      handleTap();
      setPopupInitialChoice('choice');
      setIsAddingOpen(true);
    }
    
    isHoldingRef.current = false;
  };

  const cancelPressLong = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isHoldingRef.current = false;
  };



  const saveTransacciones = (novas: Transaccion[]) => {
    setTransacciones(novas);
    pushToFirestore(undefined, novas, undefined, undefined, undefined);
  };

  useEffect(() => {
    if (showDuplicatesModal && duplicatesPending.length > 0) {
      setSelectedDuplicateIds(duplicatesPending.map(d => d.id));
      setIsReviewingDetail(false);
    }
  }, [showDuplicatesModal, duplicatesPending]);

  const handleAddAllDuplicates = () => {
    saveTransacciones([...duplicatesPending, ...transacciones]);
    triggerDynamicIsland(
      selectedLanguage === "ES" ? "Gastos agregados" : "Expenses added",
      selectedLanguage === "ES" ? `Agregaste ${duplicatesPending.length} gastos` : `Added ${duplicatesPending.length} expenses`,
      true
    );
    setDuplicatesPending([]);
    setShowDuplicatesModal(false);
  };

  const handleDiscardDuplicates = () => {
    setDuplicatesPending([]);
    setShowDuplicatesModal(false);
  };

  const handleAddSelectedDuplicates = () => {
    const chosen = duplicatesPending.filter(d => selectedDuplicateIds.includes(d.id));
    if (chosen.length > 0) {
      saveTransacciones([...chosen, ...transacciones]);
      triggerDynamicIsland(
        selectedLanguage === "ES" ? "Gastos agregados" : "Expenses added",
        selectedLanguage === "ES" ? `Agregaste ${chosen.length} gastos` : `Added ${chosen.length} expenses`,
        true
      );
    }
    setDuplicatesPending([]);
    setShowDuplicatesModal(false);
  };

  const handleToggleSelectDuplicate = (id: string) => {
    setSelectedDuplicateIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllDuplicates = () => {
    if (selectedDuplicateIds.length === duplicatesPending.length) {
      setSelectedDuplicateIds([]);
    } else {
      setSelectedDuplicateIds(duplicatesPending.map(d => d.id));
    }
  };

  // Clock Update for iOS top tier
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      setSimulatedTime(`${hh}:${mm}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  // Self-healing effect to correct any old Concon or Administradora installment transaction that was parsed at total purchase value ($762.392) instead of the actual monthly installment ($63.532).
  useEffect(() => {
    if (transacciones.length > 0) {
      let needsHealing = false;
      const healed = transacciones.map(t => {
        const descLower = (t.descripcion || '').toLowerCase();
        const isConcon = descLower.includes('concon') || descLower.includes('administradora');
        // Check for exact monto of 762392
        if (isConcon && t.monto === 762392) {
          needsHealing = true;
          return {
            ...t,
            monto: 63532,
            descripcion: t.descripcion ? t.descripcion.replace('762.392', '63.532') : 'Concon - Cuota 06/12'
          };
        }
        return t;
      });

      if (needsHealing) {
        console.log("Self-healing: corrected installment transaction total to monthly cuota of 63,532.");
        // We delay slightly to avoid React state update overlaps during mount/syncing
        const timeout = setTimeout(() => {
          saveTransacciones(healed);
          triggerDynamicIsland(
            selectedLanguage === 'ES' ? 'Cuota Corregida' : 'Installment Corrected',
            selectedLanguage === 'ES' ? 'Se ajustó cuota Concon de 762K a 63K' : 'Adjusted Concon installment from 762K to 63K',
            true
          );
        }, 1000);
        return () => clearTimeout(timeout);
      }
    }
  }, [transacciones.length]);

  // Dynamic Island Alert timeout
  const triggerDynamicIsland = (text: string, subtext: string, isPositive: boolean) => {
    setNotchAlert({ text, subtext, isPositive });
    let notchTimeout: any; if (notchTimeout) clearTimeout(notchTimeout); notchTimeout = setTimeout(() => {
      setNotchAlert(null);
    }, 4500);
  };

  const {
    isListening: isListeningCustomProduct,
    startListening: startCustomProductSpeechRecognition,
    recognitionError: speechError,
  } = useSpeechRecognition({
    selectedLanguage,
    onTranscriptChange: (text) => setCustomProductQuery(text),
    triggerDynamicIsland,
    playTone,
    isMuted,
  });

  useEffect(() => {
    if (speechError) {
      setCustomProductError(speechError);
    }
  }, [speechError]);

  const { importFromSheets, isImportingSheets } = useGoogleSheets({
    categorias,
    getMergedPaymentMethods,
    selectedLanguage,
    triggerDynamicIsland,
    requestConfirmation,
    setIsAddingOpen,
    isMuted,
    playTone,
    onImportSuccess: (newTxList) => {
      saveTransacciones([...newTxList, ...transacciones]);
    }
  });

  useEffect(() => {
    importFromSheetsRef.current = importFromSheets;
  }, [importFromSheets]);

  // Filter algorithms for current period
  const filterTransactions = (items: Transaccion[]): Transaccion[] => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfDay - (now.getDay() || 7 - 1) * 24 * 3600 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    const monedaActiva = effectiveCountry === 'CL' ? 'CLP' : 'COP';

    return items.filter(item => {
      // Filtrar por pais: incluir si coincide o si no tiene paisMoneda (legado)
      const matchPais = !item.paisMoneda || item.paisMoneda === monedaActiva;
      if (!matchPais) return false;

      const itemTime = formatSafeDateString(item.fecha).getTime();
      switch (filtroSeleccionado) {
        case 'Día':
          return itemTime >= startOfDay;
        case 'Semana':
          return itemTime >= startOfWeek;
        case 'Mes':
          return itemTime >= startOfMonth;
        case 'Año':
          return itemTime >= startOfYear;
        case 'Personalizado': {
          if (!rangoInicio || !rangoFin) return true; // sin rango aun: mostrar todo
          const ini = formatSafeDateString(rangoInicio).getTime();
          const fin = formatSafeDateString(rangoFin).getTime() + (24*3600*1000 - 1); // incluye el dia final completo
          return itemTime >= ini && itemTime <= fin;
        }
        case 'Histórico':
        default:
          return true;
      }
    });
  };

  const q = busquedaGasto.trim().toLowerCase();
  const qNum = q.replace(/[^0-9]/g, ''); // solo digitos, para buscar por monto
  const baseLista = q ? transacciones : filterTransactions(transacciones);
  const transaccionesFiltradasLista = [...baseLista]
    .filter((t) => {
      if (!q) return true;
      const enTexto =
        (t.descripcion || '').toLowerCase().includes(q) ||
        (t.categoria || '').toLowerCase().includes(q) ||
        (t.formaPago || '').toLowerCase().includes(q);
      const enMonto = qNum !== '' && String(t.monto).includes(qNum);
      return enTexto || enMonto;
    })
    .sort((a, b) => {
      if (ordenSeleccionado === 'MayorGasto') {
        return b.monto - a.monto;
      } else {
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      }
    });

  const transaccionesFiltradas = filterTransactions(transacciones);

  // Recalculates dynamically
  const totalActivos = transaccionesFiltradas
    .filter(t => t.tipo === 'Ingreso')
    .reduce((sum, t) => sum + t.monto, 0);

  const totalPasivos = transaccionesFiltradas
    .filter(t => t.tipo === 'Gasto')
    .reduce((sum, t) => sum + t.monto, 0);

  const realAhorroNeto = totalActivos - totalPasivos;

  const getCategoriaMonto = (catNombre: string) => {
    const catNombreLow = catNombre.toLowerCase();
    const nombresCatLow = categorias.map(c => c.nombre.toLowerCase());

    if (catNombreLow === 'otros') {
      return transaccionesFiltradas
        .filter(t => {
          if (t.tipo !== 'Gasto') return false;
          const catLow = (t.categoria || '').toLowerCase();
          return (
            catLow === 'otros' ||
            !t.categoria ||
            !nombresCatLow.includes(catLow)
          );
        })
        .reduce((sum, t) => sum + t.monto, 0);
    }

    return transaccionesFiltradas
      .filter(t =>
        t.tipo === 'Gasto' &&
        (t.categoria || '').toLowerCase() === catNombreLow
      )
      .reduce((sum, t) => sum + t.monto, 0);
  };

  const handleSaveEditedPortafolio = (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPortafolio) return;
    
    if (!editPortafolioNombre || !editPortafolioValor || !editPortafolioPlataforma) {
      triggerDynamicIsland("Error", selectedLanguage === 'ES' ? "Todos los campos son obligatorios" : "All fields are required", false);
      return;
    }
    const val = parseFloat(editPortafolioValor.replace(/,/g, ''));
    if (isNaN(val) || val <= 0) {
      triggerDynamicIsland("Error", selectedLanguage === 'ES' ? "Valor inválido" : "Invalid value", false);
      return;
    }
    
    const updatedProfile = {
      ...userProfile,
      portafolios: (userProfile.portafolios || []).map(p => p.id === editingPortafolio.id ? {
        ...p,
        nombre: editPortafolioNombre,
        valor: val,
        plataforma: editPortafolioPlataforma
      } : p)
    };
    
    saveUserProfileData(updatedProfile);
    setEditingPortafolio(null);
    triggerDynamicIsland("Portafolio", selectedLanguage === 'ES' ? "Activo actualizado" : "Asset updated", true);
    playTone('success', isMuted);
  };

  const handleBorrarTransaccion = (id: string, monto: number, tipo: string) => {
    requestConfirmation(
      "Eliminar movimiento",
      "¿Estás seguro de que quieres eliminar este movimiento?",
      () => {
        const filtered = transacciones.filter(t => t.id !== id);
        saveTransacciones(filtered);
        playTone('delete', isMuted);
        triggerDynamicIsland(
          "Movimiento Borrado", 
          `${tipo === 'Ingreso' ? '-' : '+'}$${monto.toLocaleString('es-ES')}`, 
          false
        );
      }
    );
  };

  const handleClearAll = () => {
    requestConfirmation(
      "Limpiar todo",
      "⚠️ ¿Estás seguro de que deseas eliminar TODOS los movimientos registrados?",
      () => {
        saveTransacciones([]);
        playTone('delete', isMuted);
        triggerDynamicIsland("Borrando todo", "La base de datos fue limpiada.", false);
      }
    );
  };

  const handleCargarEjemplo = () => {
    const demo: Transaccion[] = [
      {
        id: 'ex-1',
        tipo: 'Ingreso',
        monto: 4200,
        descripcion: 'Salario Recibido',
        fecha: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'ex-2',
        tipo: 'Gasto',
        monto: 950,
        categoria: categorias.length > 0 ? categorias[0].nombre : 'Otros',
        descripcion: 'Abono Hipotecario',
        fecha: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'ex-3',
        tipo: 'Gasto',
        monto: 124,
        categoria: 'Alimentación',
        descripcion: 'Compra quincenal Alsuper',
        fecha: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'ex-4',
        tipo: 'Gasto',
        monto: 85,
        categoria: 'Transporte',
        descripcion: 'Tarjeta recarga Metro',
        fecha: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'ex-5',
        tipo: 'Gasto',
        monto: 340,
        categoria: 'Viajes',
        descripcion: 'Reserva Hotel Fin de Semana',
        fecha: new Date().toISOString()
      },
      {
        id: 'ex-6',
        tipo: 'Gasto',
        monto: 55,
        categoria: 'Compras',
        descripcion: 'Auriculares deportivos',
        fecha: new Date().toISOString()
      },
    ];
    saveTransacciones(demo);
    playTone('success', isMuted);
    triggerDynamicIsland("Datos de ejemplo", "Se cargaron 6 movimientos.", true);
  };

  const handleTap = () => {
    playTone('tap', isMuted);
  };

  const handleAddPortafolio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoPortafolio.nombre || !nuevoPortafolio.valor || !nuevoPortafolio.plataforma) {
      triggerDynamicIsland("Error", selectedLanguage === 'ES' ? "Todos los campos son obligatorios" : "All fields are required", false);
      return;
    }
    const val = parseFloat(nuevoPortafolio.valor.replace(/,/g, ''));
    if (isNaN(val) || val <= 0) {
      triggerDynamicIsland("Error", selectedLanguage === 'ES' ? "Valor inválido" : "Invalid value", false);
      return;
    }
    
    const newActivo = {
      id: `portafolio-${Date.now()}`,
      nombre: nuevoPortafolio.nombre,
      valor: val,
      plataforma: nuevoPortafolio.plataforma
    };
    
    const updatedProfile = {
      ...userProfile,
      portafolios: [...(userProfile.portafolios || []), newActivo]
    };
    saveUserProfileData(updatedProfile);
    setNuevoPortafolio({ nombre: '', valor: '', plataforma: '' });
    triggerDynamicIsland("Portafolio", selectedLanguage === 'ES' ? "Activo agregado" : "Asset added", true);
    playTone('success', isMuted);
  };

  const handleDeletePortafolio = (id: string) => {
    const updatedProfile = {
      ...userProfile,
      portafolios: (userProfile.portafolios || []).filter(p => p.id !== id)
    };
    saveUserProfileData(updatedProfile);
    triggerDynamicIsland("Portafolio", selectedLanguage === 'ES' ? "Activo eliminado" : "Asset removed", false);
    playTone('delete', isMuted);
  };

  const handleAddCategory = () => {
    console.log('[Cat] newCatName al confirmar:', newCatName);
    if (!newCatName.trim()) {
      triggerDynamicIsland("Escribe nombre", "Ingresa un nombre para la categoría", false);
      return;
    }
    const nameExists = categorias.some(c => c.nombre.toLowerCase() === newCatName.trim().toLowerCase());
    if (nameExists) {
      triggerDynamicIsland("Ya existe", "Esta categoría ya se encuentra registrada", false);
      return;
    }
    const newCat = {
      nombre: newCatName.trim(),
      icon: newCatIcon,
      color: newCatColor
    };
    saveCategorias([...categorias, newCat]);
    setNewCatName('');
    setIconManuallySet(false);
    triggerDynamicIsland("Añadida", `Categoría "${newCat.nombre}" agregada con éxito`, true);
    playTone('success', isMuted);
    // NO cerrar el modal ni redirigir: el usuario puede seguir agregando
  };

  // Agregado rapido desde el grid de categorias sugeridas (un solo toque)
  const handleQuickAddCategory = (nombre: string, icon: string) => {
    handleTap();
    const yaExiste = categorias.some(
      c => c.nombre.toLowerCase() === nombre.toLowerCase()
    );
    if (yaExiste) {
      triggerDynamicIsland("Ya existe", `"${nombre}" ya está en tus categorías`, false);
      return;
    }
    const colorByIcon: Record<string, string> = {
      Home: '#8B5A2B', Utensils: '#F97316', Car: '#EF4444', ShoppingBag: '#EC4899',
      Plane: '#3B82F6', Sparkles: '#10B981', Heart: '#F43F5E', Scissors: '#9333EA',
    };
    const newCat = { nombre, icon, color: colorByIcon[icon] || '#008B81' };
    saveCategorias([...categorias, newCat]);
    triggerDynamicIsland("Añadida", `Categoría "${nombre}" agregada con éxito`, true);
    playTone('success', isMuted);
  };

  const handleDeleteCategory = (nombre: string) => {
    if (nombre === 'Otros') {
      triggerDynamicIsland("No permitido", "La categoría de respaldo no se puede borrar", false);
      return;
    }
    // --- NUEVO: bloquear si tiene gastos asociados ---
    const gastosAsociados = transacciones.filter(
      t => t.tipo === 'Gasto' &&
      (t.categoria || '').toLowerCase() === nombre.toLowerCase()
    ).length;
    if (gastosAsociados > 0) {
      // Cerrar modal primero para que la notificacion sea visible
      setShowManageCategories(false);
      setTimeout(() => {
        triggerDynamicIsland(
          selectedLanguage === 'ES' ? 'No permitido' : 'Not allowed',
          selectedLanguage === 'ES'
            ? `No puedes eliminar "${nombre}" porque tiene ${gastosAsociados} gasto(s) asociado(s). Reasigna los gastos primero.`
            : `Cannot delete "${nombre}" — it has ${gastosAsociados} associated expense(s). Reassign them first.`,
          false
        );
      }, 300); // esperar a que cierre el modal
      return;
    }
    // --- FIN NUEVO ---
    requestConfirmation(
      "Eliminar Categoría",
      `¿Estás seguro de que quieres eliminar la categoría "${nombre}"?`,
      () => {
        const filtered = categorias.filter(c => c.nombre !== nombre);
        saveCategorias(filtered);
        triggerDynamicIsland("Eliminada", `Categoría "${nombre}" borrada`, false);
        playTone('delete', isMuted);
        
        // Smoothly close categories modal and navigate home
        setShowManageCategories(false);
        setActiveTab('finance');
      }
    );
  };

  const simulateCloudSync = () => {    playTone('voice', isMuted);
    triggerDynamicIsland("Finanzas Cloud", "Comenzando respaldo...", true);
    
    setTimeout(() => {      const now = new Date();
      
      playTone('success', isMuted);
      triggerDynamicIsland("Nube Actualizada", "Sincronización completa", true);
    }, 2000);
  };

  // Find max category value to scale progress indicators proportionally
  const montosDeCategorias = categorias.map(c => getCategoriaMonto(c.nombre));
  const maxCategoriaMonto = Math.max(...montosDeCategorias, 1);

  // Dynamic calculation of highest spending category for the Cloud AI predictions tab
  const getMajorGastoCat = (): { nombre: string; total: number; color: string; percentage: number } => {
    let maxVal = -1;
    let maxCat = 'Ninguno';
    let color = '#6B7280';
    
    categorias.forEach(c => {
      const v = getCategoriaMonto(c.nombre);
      if (v > maxVal) {
        maxVal = v;
        maxCat = c.nombre;
        color = c.color;
      }
    });

    const totalEgresos = totalPasivos;
    const pct = totalEgresos > 0 ? Math.round((maxVal / totalEgresos) * 100) : 0;
    
    return {
      nombre: maxCat,
      total: maxVal,
      color,
      percentage: pct
    };
  };

  const majorGasto = getMajorGastoCat();

  // App Main Render within optional Simulator Screen
  const renderAppContent = () => {
    if (isAppLocked) {
      return (
        <div id="ios-lock-screen" className="flex flex-col h-full bg-[#0d0e14] text-white p-6 justify-between relative overflow-y-auto">
          {lockIsScanning && (
            <div className="absolute inset-0 bg-[#0d0e14]/98 z-50 flex flex-col items-center justify-center p-6 space-y-4 animate-fade-in text-center">
              <div className="relative flex items-center justify-center w-28 h-28">
                {/* Scanning radar circles */}
                <div className="absolute inset-0 bg-teal-500 rounded-full animate-ping opacity-25" />
                <div className="absolute -inset-4 bg-teal-500/10 rounded-full animate-pulse opacity-20" />
                <div className="w-20 h-20 rounded-full border-4 border-dashed border-teal-500 animate-spin flex items-center justify-center bg-slate-900 shadow-xl relative animate-pulse">
                  <Fingerprint className="w-10 h-10 text-teal-400" />
                </div>
                <div className="absolute h-0.5 w-16 bg-teal-400 rounded-full top-[42%] left-[21%] animate-bounce shadow-[0_0_12px_rgba(45,212,191,0.8)]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-white uppercase tracking-widest">
                  {selectedLanguage === 'ES' ? 'Verificando Identidad...' : 'Confirming Identity...'}
                </p>
                <p className="text-xs text-slate-400 font-bold">
                  {selectedLanguage === 'ES' 
                    ? 'Iniciando módulo seguro FaceID / Biometría' 
                    : 'Initializing hardware enclave biometric scanner'}
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="text-center pt-8 space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-teal-500 to-[#312E81] rounded-2xl flex items-center justify-center shadow-lg border border-teal-400/30">
              <Shield className="w-8 h-8 text-teal-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">
                {selectedLanguage === 'ES' ? 'Acceso Seguro FinDream' : 'Secure Access FinDream'}
              </h2>
              <p className="text-xs font-bold text-teal-400 mt-1 uppercase tracking-widest">
                {userProfile.nombre ? `Hola, ${userProfile.nombre}` : (selectedLanguage === 'ES' ? 'Hola de nuevo' : 'Hello again')}
              </p>
            </div>
          </div>

          {/* Body Passcode / Password Form */}
          <div className="space-y-6 my-auto pt-6">
            <p className="text-[11px] text-center font-bold text-slate-400 leading-tight">
              {selectedLanguage === 'ES' 
                ? 'Ingresa tu contraseña de usuario o utiliza FaceID para ingresar' 
                : 'Enter your profile password or bypass with rapid biometrics scan'}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                playTone('tap', isMuted);
                
                if (userProfile.contraseña && lockPasswordInput === userProfile.contraseña) {
                  setLockStatus({ type: 'success', text: selectedLanguage === 'ES' ? '¡Identidad Confirmada!' : 'Identity Confirmed!' });
                  playTone('success', isMuted);
                  setTimeout(() => {
                    setIsAppLocked(false);
                    setLockPasswordInput('');
                    setLockStatus({ type: '', text: '' });
                  }, 600);
                } else {
                  setLockStatus({ 
                    type: 'error', 
                    text: selectedLanguage === 'ES' 
                      ? 'Contraseña o PIN incorrecto. Inténtalo de nuevo.' 
                      : 'Incorrect passcode/password. Try again.' 
                  });
                  playTone('delete', isMuted);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1">
                  {selectedLanguage === 'ES' ? 'Contraseña o PIN de Seguridad' : 'Security Passcode / Password'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔑</span>
                  <input
                    type="password"
                    required
                    placeholder={selectedLanguage === 'ES' ? 'Ingresa tu PIN / Clave' : 'Enter your key'}
                    value={lockPasswordInput}
                    onChange={(e) => setLockPasswordInput(e.target.value)}
                    className="w-full bg-slate-900/90 border border-slate-750 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-teal-550 focus:border-transparent text-center"
                  />
                </div>
              </div>

              {lockStatus.text && (
                <div className={`p-2.5 rounded-lg border text-center text-[10.5px] font-bold ${
                  lockStatus.type === 'success' 
                    ? 'bg-teal-950/40 border-teal-850 text-teal-400' 
                    : 'bg-rose-950/40 border-rose-950 text-rose-400'
                }`}>
                  {lockStatus.text}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-teal-600 to-[#312E81] text-white font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-95 shadow-lg active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Check className="w-4 h-4" />
                <span>{selectedLanguage === 'ES' ? 'Confirmar Identidad' : 'Confirm Identity'}</span>
              </button>
            </form>

            <div className="flex items-center gap-3 py-1">
              <hr className="flex-1 border-slate-800" />
              <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest">
                {selectedLanguage === 'ES' ? 'Acceso rápido' : 'Fast Access'}
              </span>
              <hr className="flex-1 border-slate-800" />
            </div>

            {/* Quick biometric trigger */}
            <button
              type="button"
              onClick={() => {
                playTone('tap', isMuted);
                setLockIsScanning(true);
                setTimeout(() => {
                  setLockIsScanning(false);
                  playTone('success', isMuted);
                  setIsAppLocked(false);
                  triggerDynamicIsland(
                    selectedLanguage === 'ES' ? "FaceID Verificado" : "FaceID Verified",
                    selectedLanguage === 'ES' ? "Acceso concedido con éxito." : "Authorized successfully.",
                    true
                  );
                }, 1400);
              }}
              className="w-full py-3 bg-slate-905 hover:bg-slate-850 border border-slate-800 hover:border-teal-500/50 rounded-xl text-xs font-black text-teal-400 flex items-center justify-center gap-2.5 transition active:scale-97 cursor-pointer group"
            >
              <div className="relative">
                <Fingerprint className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-all animate-pulse" />
                <ScanFace className="w-3.5 h-3.5 text-teal-300 absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.2" />
              </div>
              <span>{selectedLanguage === 'ES' ? 'Ingresar con FaceID' : 'Log In with FaceID'}</span>
            </button>
          </div>

          {/* Footer brand info */}
          <div className="text-center pt-2 text-[10px] text-gray-400 space-y-1">
            <p>© Finanza FaceID Enclave Security.</p>
          </div>
        </div>
      );
    }

    return (
      <div id="ios-app-container" className="flex flex-col h-full bg-[#f4f5f9] text-gray-905 overflow-hidden relative">
      {/* iOS App Top Bar Style */}
      <div className="flex justify-between items-center px-5 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-3 bg-white border-b border-gray-100 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2.5">
          {/* Detailed beautiful turquoise vector logo of FinDream attached reference */}
          <div className="relative w-11 h-11 flex items-center justify-center bg-white rounded-xl border border-teal-100 p-0.5 flex-shrink-0 shadow-xs">
            <FinDreamLogo size="sm" variant="icon-only" animated={false} />
          </div>
          <div>
            <h1 className="text-[17px] font-black tracking-tight text-slate-900 leading-tight flex items-center gap-1.5">
              {activeTab === 'finance' 
                ? t('tab_resumen') 
                : activeTab === 'cloud' 
                  ? t('tab_sueno') 
                  : activeTab === 'productos' 
                    ? t('tab_productos') 
                    : activeTab === 'portafolios'
                      ? t('tab_portafolio')
                      : activeTab === 'suscripciones'
                        ? t('tab_suscripciones')
                        : activeTab === 'recurrentes'
                          ? (selectedLanguage === 'ES' ? 'Recurrentes' : 'Recurring')
                          : t('tab_insights')}
              <span>{effectiveCountry === 'CO' ? '🇨🇴' : '🇨🇱'}</span>
            </h1>
          </div>
        </div>

        {/* --- COUNTRY, LANGUAGE AND USER PROFILE SECTION --- */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {MULTIPAIS_HABILITADO && (
            <div className="relative flex items-center bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl px-1.5 py-1 gap-1 shadow-2xs transition-colors">
              <span className="text-[10px] font-black text-slate-700 flex items-center gap-0.5">
                {selectedCountry === 'CO' ? '🇨🇴  COP' : '🇨🇱  CLP'}
              </span>
              <select
                value={selectedCountry}
                onChange={(e) => { handleTap(); setSelectedCountry(e.target.value as any); }}
                className="absolute inset-0 opacity-0 cursor-pointer text-[10px]"
              >
                <option value="CO">🇨🇴 CO (COP)</option>
                <option value="CL">🇨🇱 CL (CLP)</option>
              </select>
            </div>
          )}

          {/* Language Selection Dropdown */}
          <div className="relative flex items-center bg-slate-50 hover:bg-slate-150 border border-slate-200/60 rounded-xl px-2 py-1 gap-1 shadow-2xs transition-colors">
            <span className="text-[10px] font-black text-slate-700">
              {selectedLanguage === 'ES' ? '🌐 ES' : '🌐 EN'}
            </span>
            <select
              value={selectedLanguage}
              onChange={(e) => { handleTap(); setSelectedLanguage(e.target.value as any); }}
              className="absolute inset-0 opacity-0 cursor-pointer text-[10px]"
            >
              <option value="ES">ES</option>
              <option value="EN">EN</option>
            </select>
          </div>

          {/* --- MI CUENTA BUTTON --- */}
          <button
            id="btn-mi-cuenta"
            onClick={() => { handleTap(); setIsCuentaOpen(true); }}
            className="flex items-center gap-1 px-2 py-1 bg-gradient-to-tr from-[#00897B]/5 to-[#00897B]/15 hover:from-[#00897B]/15 hover:to-[#00897B]/25 text-[#00796B] rounded-xl text-[10.5px] font-black tracking-tight transition-all cursor-pointer border border-[#00897B]/20 active:scale-95 shadow-sm"
          >
            <div className="w-4.5 h-4.5 rounded-full bg-[#00897B] text-white flex items-center justify-center font-bold text-[9px]">
              {userProfile.nombre ? userProfile.nombre.charAt(0).toUpperCase() : 'P'}
            </div>
            <span className="font-extrabold whitespace-nowrap">{t('mi_cuenta')}</span>
          </button>
        </div>
      </div>

      {/* Main Screen Scroll Viewport */}
      <div id="main-scroll-container" className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-32 relative">
        {activeTab === 'finance' ? (
          <div className="p-5 space-y-5">
            {/* --- FILTRO DE TIEMPO (Pill Slide iOS - NOW AT THE TOP CONSTRAINING EVERYTHING BELOW) --- */}
            <div id="filtro-tiempo" className="overflow-x-auto no-scrollbar pt-1">
              <div className="flex bg-gray-100 p-1 rounded-xl relative">
                {(['Día', 'Semana', 'Mes', 'Año', 'Personalizado'] as FiltroTiempo[]).map((f) => {
                  const sel = filtroSeleccionado === f;
                  return (
                    <button
                      id={`btn-filtro-${f}`}
                      key={f}
                      onClick={() => { handleTap(); setFiltroSeleccionado(f); }}
                      className="relative flex-1 text-center py-2 text-xs font-semibold rounded-lg focus:outline-none transition-colors z-10 whitespace-nowrap px-3 cursor-pointer"
                      style={{ color: sel ? '#ffffff' : '#4B5563' }}
                    >
                      {sel && (
                        <motion.div
                          layoutId="activeFilterBg"
                          className="absolute inset-0 bg-[#312E81] rounded-lg -z-10 shadow-sm"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                      {f === 'Personalizado' ? (selectedLanguage === 'ES' ? 'Rango' : 'Range') : f}
                    </button>
                  );
                })}
              </div>
            </div>

            {filtroSeleccionado === 'Personalizado' && (
              <div className="flex items-end gap-2 mt-2 px-1">
                <div className="flex-1 text-left">
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
                    {selectedLanguage === 'ES' ? 'Desde' : 'From'}
                  </label>
                  <input
                    type="date"
                    value={rangoInicio}
                    max={rangoFin || undefined}
                    onChange={(e) => setRangoInicio(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
                  />
                </div>
                <div className="flex-1 text-left">
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
                    {selectedLanguage === 'ES' ? 'Hasta' : 'To'}
                  </label>
                  <input
                    type="date"
                    value={rangoFin}
                    min={rangoInicio || undefined}
                    onChange={(e) => setRangoFin(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
                  />
                </div>
              </div>
            )}

            {/* --- HEADER DE TOTALES (Solo una fila / iOS layout premium) --- */}
        <div id="totales-container" className="grid grid-cols-2 gap-3.5">
          {/* Activos */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-550 glass-card p-4 rounded-2xl shadow-sm text-white flex flex-col justify-between"
            style={{ backgroundImage: 'linear-gradient(135deg, #10B981, #059669)' }}
          >
            <div className="flex justify-between items-center w-full">
              <span className="text-[10px] font-black tracking-widest text-[#D1FAE5] uppercase">ACTIVOS TOTALES</span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleTap(); setHideBalances(!hideBalances); }}
                className="p-1 -mr-1 text-emerald-100 hover:text-white hover:bg-white/15 rounded-lg transition cursor-pointer"
                title={hideBalances ? "Mostrar balance" : "Ocultar balance"}
              >
                {hideBalances ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-extrabold block">
                {hideBalances ? "******" : `$${totalActivos.toLocaleString('es-ES', { minimumFractionDigits: 0 })}`}
              </span>
              <span className="text-[10px] text-emerald-100 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" /> ingresos vigentes
              </span>
            </div>
          </motion.div>
 
          {/* Pasivos */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-red-550 glass-card p-4 rounded-2xl shadow-sm text-white flex flex-col justify-between"
            style={{ backgroundImage: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
          >
            <div className="flex justify-between items-center w-full">
              <span className="text-[10px] font-black tracking-widest text-[#FEE2E2] uppercase">PASIVOS TOTALES</span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleTap(); setHideBalances(!hideBalances); }}
                className="p-1 -mr-1 text-red-100 hover:text-white hover:bg-white/15 rounded-lg transition cursor-pointer"
                title={hideBalances ? "Mostrar balance" : "Ocultar balance"}
              >
                {hideBalances ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-extrabold block">
                {hideBalances ? "******" : `$${totalPasivos.toLocaleString('es-ES', { minimumFractionDigits: 0 })}`}
              </span>
              <span className="text-[10px] text-red-100 flex items-center gap-1 mt-1">
                <TrendingDown className="w-3 h-3" /> egresos calculados
              </span>
            </div>
          </motion.div>
        </div>

        {/* --- BALANCE GENERAL RESUMEN --- */}
        <div id="balance-resumen" className="bg-white p-4 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-gray-100">
          <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
            <div className="flex items-center gap-1.5">
              <span>Balance de Operaciones ({filtroSeleccionado})</span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleTap(); setHideBalances(!hideBalances); }}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
                title={hideBalances ? "Mostrar balance" : "Ocultar balance"}
              >
                {hideBalances ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className="font-semibold text-gray-700">Progreso Gasto</span>
          </div>
          <div className="flex justify-between items-baseline mb-2">
            <span className={`text-2xl font-black ${totalActivos - totalPasivos >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {hideBalances ? "******" : `$${(totalActivos - totalPasivos).toLocaleString('es-ES', { minimumFractionDigits: 0 })}`}
            </span>
            <span className="text-xs font-semibold text-rose-600">
              {totalActivos > 0 ? `${Math.min(Math.round((totalPasivos / totalActivos) * 100), 100)}%` : '0%'}
            </span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${totalActivos - totalPasivos >= 0 ? 'bg-indigo-600' : 'bg-rose-500'}`}
              style={{ width: `${totalActivos > 0 ? Math.min((totalPasivos / totalActivos) * 100, 100) : 0}%` }}
            />
          </div>
        </div>

        {/* --- DYNAMIC PIE/DONUT CHART CARD --- */}
        {(() => {
          const totalGastosFiltrados = categorias.reduce((sum, c) => sum + getCategoriaMonto(c.nombre), 0);
          
          let cumulativePercentage = 0;
          const slicesData = categorias.map((c) => {
            const val = getCategoriaMonto(c.nombre);
            const percentage = totalGastosFiltrados > 0 ? (val / totalGastosFiltrados) * 100 : 0;
            const currentOffset = -cumulativePercentage;
            cumulativePercentage += percentage;
            return {
              ...c,
              monto: val,
              percentage,
              offset: currentOffset,
            };
          }).filter(s => s.monto > 0);

          return (
            <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-105 space-y-4 text-left">
              <div className="flex flex-col text-left">
                <h3 className="text-xs font-black text-slate-800 tracking-wider block uppercase">Análisis de Gastos</h3>
                <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Distribución porcentual por categoría ({filtroSeleccionado})</span>
              </div>

              {totalGastosFiltrados === 0 ? (
                <div className="py-8 px-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <PieChart className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-500">No hay gastos en {filtroSeleccionado} para graficar</p>
                  <p className="text-[9.5px] text-slate-400 font-semibold leading-tight">Registra egresos para ver la gráfica interactiva</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* Interactive Recharts Donut */}
                  <div className="md:col-span-12 lg:col-span-5 flex justify-center relative h-[220px]">
                    <div className="w-full h-full absolute inset-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={slicesData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="monto"
                            nameKey="nombre"
                            onMouseEnter={(_, index) => setHoveredSlice(slicesData[index].nombre)}
                            onMouseLeave={() => setHoveredSlice(null)}
                            labelLine={true}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, value, name, percent, payload }) => {
                              const RADIAN = Math.PI / 180;
                              // Place label outside the pie chart
                              const radius = outerRadius + 22; 
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              if (percent < 0.03) return null; // Don't show labels for tiny slices
                              return (
                                <text 
                                  x={x} 
                                  y={y} 
                                  fill="#475569" 
                                  textAnchor={x > cx ? 'start' : 'end'} 
                                  dominantBaseline="central" 
                                  className="text-[9.5px] md:text-[10px] font-extrabold" 
                                  style={{ pointerEvents: 'none' }}
                                >
                                  {`${payload.nombre} ${(percent * 100).toFixed(0)}%`}
                                </text>
                              );
                            }}
                          >
                            {slicesData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.color} 
                                stroke={hoveredSlice === entry.nombre ? '#fff' : 'transparent'}
                                strokeWidth={hoveredSlice === entry.nombre ? 2 : 0}
                                style={{
                                  outline: 'none',
                                  transition: 'all 300ms ease',
                                  transformOrigin: 'center',
                                  transform: hoveredSlice === entry.nombre ? 'scale(1.05)' : 'scale(1)',
                                }}
                              />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Hole text in the middle */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block truncate max-w-[80px]">
                        {hoveredSlice ? hoveredSlice : (selectedLanguage === 'ES' ? 'Total Gasto' : 'Total Expense')}
                      </span>
                      <span className="text-xs font-black text-slate-800 mt-0.5 block truncate max-w-full">
                        ${(hoveredSlice 
                          ? getCategoriaMonto(hoveredSlice) 
                          : totalGastosFiltrados
                        ).toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  {/* Legend on the Right */}
                  <div className="md:col-span-12 lg:col-span-7 space-y-1.5 w-full">
                    {slicesData.map((slice) => {
                      const isHovered = hoveredSlice === slice.nombre;
                      return (
                        <div 
                          key={slice.nombre}
                          onMouseEnter={() => setHoveredSlice(slice.nombre)}
                          onMouseLeave={() => setHoveredSlice(null)}
                          className={`flex items-center justify-between p-1.5 px-2 rounded-xl transition-all border duration-200 cursor-pointer ${
                            isHovered ? 'bg-slate-50 border-slate-200/60 shadow-3xs scale-[1.01]' : 'border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {/* Custom Dot indicating category color */}
                            <div 
                              className="w-2 rounded-full flex-shrink-0 aspect-square" 
                              style={{ backgroundColor: slice.color }}
                            />
                            <span className="text-[10.5px] font-bold text-slate-700">
                              {slice.nombre}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-right flex-shrink-0">
                            <span className="text-[10.5px] font-black text-slate-800">
                              ${slice.monto.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                            </span>
                            <span className="text-[9px] font-black text-slate-450 bg-slate-100 px-1.5 py-0.2 rounded-full min-w-8 text-center block">
                              {Math.round(slice.percentage)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* --- GRID DE CATEGORÍAS (Visual Metrics) --- */}
        <div className="space-y-3.5">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-extrabold text-black tracking-wider block uppercase">
              {selectedLanguage === 'ES' ? 'Categorías de Gasto' : 'Expense Categories'}
            </h3>
            <button
              onClick={() => { handleTap(); setShowManageCategories(true); }}
              className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 rounded-lg py-1.5 transition-all shadow-sm cursor-pointer border border-indigo-700"
            >
              {selectedLanguage === 'ES' ? '⚙️ Personalizar' : '⚙️ Customise'}
            </button>
          </div>

          <div id="grid-categorias" className="grid grid-cols-2 gap-3.5">
            {categorias.map((c) => {
              const val = getCategoriaMonto(c.nombre);
              const progressPercentage = Math.min((val / maxCategoriaMonto) * 100, 100);

              return (
                <motion.div
                  key={c.nombre}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    handleTap();
                    setQuickAddCategory(c.nombre);
                    setQuickAddMonto('');
                    setQuickAddDescripcion('');
                    setQuickAddFormaPago('Efectivo');
                    setQuickAddFecha(new Date().toISOString().substring(0, 10));
                    setQuickAddOpen(true);
                  }}
                  className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-gray-100 hover:border-[#00897B]/30 hover:shadow-xs flex flex-col justify-between min-h-[110px] cursor-pointer transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-2 rounded-xl bg-gray-50">
                      {renderCategoriaIcon(c.icon, c.color, "w-5.5 h-5.5")}
                    </div>
                    <div className="flex items-center gap-1 shrink-1 justify-end">
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight text-right">
                        {translateCategory(c.nombre)}
                      </span>
                      <div className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-teal-50 text-teal-600 border border-teal-100/30 shadow-3xs">
                        <Plus className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-left">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs text-slate-700 font-bold">
                        {selectedLanguage === 'ES' ? 'Monto' : 'Amount'}
                      </span>
                      <span className="text-[15px] font-black text-slate-800">
                        ${val.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                      </span>
                    </div>

                    {/* Proportional custom bar indicator from Flutter */}
                    <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${val > 0 ? progressPercentage : 0}%` }}
                        transition={{ duration: 0.6 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Subtabs Balance: Movimientos / Recurrentes */}
        <div className="bg-slate-100 p-1 rounded-2xl flex items-center justify-between border border-slate-200 shrink-0 mx-4 mb-3">
          <button
            onClick={() => {
              handleTap();
              setActiveBalanceSubTab('movimientos');
            }}
            className={`flex-1 text-center py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              activeBalanceSubTab === 'movimientos'
                ? 'bg-white text-[#00897B] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ■ {selectedLanguage === 'ES' ? 'Movimientos' : 'Transactions'}
          </button>
          <button
            onClick={() => {
              handleTap();
              setActiveBalanceSubTab('recurrentes');
            }}
            className={`flex-1 text-center py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              activeBalanceSubTab === 'recurrentes'
                ? 'bg-white text-[#00897B] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ■ {selectedLanguage === 'ES' ? 'Recurrentes' : 'Recurring'}
          </button>
        </div>

        {/* Contenido segun subtab activo */}
        {activeBalanceSubTab === 'recurrentes' ? (
          <GastosRecurrentes
            gastosRecurrentes={gastosRecurrentes.filter(
              g => g.paisMoneda === (effectiveCountry === 'CL' ? 'CLP' : 'COP')
            )}
            onSave={saveGastosRecurrentes}
            todosLosGastos={gastosRecurrentes}
            transacciones={transacciones}
            selectedLanguage={selectedLanguage}
            effectiveCountry={effectiveCountry}
          />
        ) : (
          <>
            {/* --- RECENT TRANSACTIONS LOG (Highly polished list, swipeable deletion) --- */}
            <div className="space-y-3 pt-2">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 tracking-wider block uppercase">Historial de Movimientos</h3>
              {transacciones.length > 0 && (
                <button 
                  id="btn-clear-all"
                  onClick={handleClearAll}
                  className="text-[10px] font-extrabold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-rose-100"
                >
                  {selectedLanguage === 'ES' ? 'Limpiar datos' : 'Clear data'}
                </button>
              )}
            </div>

            {/* --- ORDENAR POR (Sorting iOS Control) --- */}
            <div className="flex bg-gray-100 p-1 rounded-xl relative w-full mb-2">
              <button
                type="button"
                onClick={() => { handleTap(); setOrdenSeleccionado('MasReciente'); }}
                className="relative flex-1 text-center py-1.5 text-[10px] font-bold rounded-lg focus:outline-none transition-colors z-10 px-2 cursor-pointer"
                style={{ color: ordenSeleccionado === 'MasReciente' ? '#ffffff' : '#4B5563' }}
              >
                {ordenSeleccionado === 'MasReciente' && (
                  <motion.div
                    layoutId="activeSortBg"
                    className="absolute inset-0 bg-[#312E81] rounded-lg -z-10 shadow-sm"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                {selectedLanguage === 'ES' ? 'Más recientes' : 'Newest First'}
              </button>
              <button
                type="button"
                onClick={() => { handleTap(); setOrdenSeleccionado('MayorGasto'); }}
                className="relative flex-1 text-center py-1.5 text-[10px] font-bold rounded-lg focus:outline-none transition-colors z-10 px-2 cursor-pointer"
                style={{ color: ordenSeleccionado === 'MayorGasto' ? '#ffffff' : '#4B5563' }}
              >
                {ordenSeleccionado === 'MayorGasto' && (
                  <motion.div
                    layoutId="activeSortBg"
                    className="absolute inset-0 bg-[#312E81] rounded-lg -z-10 shadow-sm"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                {selectedLanguage === 'ES' ? 'Mayor a menor' : 'Highest Amount'}
              </button>
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={busquedaGasto}
              onChange={(e) => setBusquedaGasto(e.target.value)}
              placeholder={selectedLanguage === 'ES' ? 'Buscar por nombre o monto...' : 'Search by name or amount...'}
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {busquedaGasto && (
              <button
                onClick={() => setBusquedaGasto('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div id="lista-transacciones" className="space-y-2.5">
            {transaccionesFiltradasLista.length === 0 ? (
              <div className="bg-white border rounded-2xl p-6 text-center text-slate-700 border-dashed border-slate-300">
                <Clock className="w-8 h-8 text-indigo-400 mx-auto mb-2 animate-bounce" />
                <p className="text-sm font-black text-slate-800">
                  {selectedLanguage === 'ES' 
                    ? `No hay movimientos registrados en ${filtroSeleccionado}` 
                    : `No movements registered in ${filtroSeleccionado}`}
                </p>
                <p className="text-[10.5px] text-slate-700 font-bold mt-1">
                  {selectedLanguage === 'ES' 
                    ? 'Presiona el botón "+" o "Demo" para comenzar.' 
                    : 'Press the "+" or "Demo" button to start.'}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {transaccionesFiltradasLista.map((t) => {
                  const isExpense = t.tipo === 'Gasto';
                  const cat = isExpense ? (categorias.find(c => c.nombre === t.categoria) || CATEGORIAS_PREDEFINIDAS.find(c => c.nombre === t.categoria)) : null;
                  const itemColor = isExpense ? (cat?.color || '#312E81') : '#10B981';

                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-50 flex justify-between items-center group hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {/* Transaction Icon Indicator */}
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse"
                          style={{ backgroundColor: `${itemColor}12` }}
                        >
                          {isExpense ? (
                            renderCategoriaIcon(cat?.icon || 'MoreHorizontal', itemColor, "w-5.5 h-5.5")
                          ) : (
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>

                        {/* Title & category / date */}
                        <div>
                          <div className="text-xs font-black text-slate-800 flex items-center flex-wrap gap-1">
                            <span>{t.descripcion}</span>
                            {t.esRecurrente && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-600 border border-teal-200 ml-1">
                                🔄 Recurrente
                              </span>
                            )}
                          </div>
                          <span className="text-[9.5px] text-slate-800 flex flex-wrap items-center gap-1.5 mt-1 font-extrabold">
                            {isExpense ? (
                              <>
                                <span 
                                  className="px-1.5 py-0.5 rounded-md text-[8px] font-black text-white uppercase tracking-wider" 
                                  style={{ backgroundColor: itemColor }}
                                >
                                  {translateCategory(t.categoria || 'Otros')}
                                </span>
                                {t.formaPago && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-black bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-tight">
                                    💳 {t.formaPago}
                                  </span>
                                )}
                                {t.cuotasTotal && t.cuotaActual && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-tight">
                                    🔁 {selectedLanguage === 'ES' 
                                      ? `Cuota ${t.cuotaActual}/${t.cuotasTotal} ${t.esAutomatica ? '(Auto)' : ''}`
                                      : `Installment ${t.cuotaActual}/${t.cuotasTotal} ${t.esAutomatica ? '(Auto)' : ''}`}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black text-white uppercase tracking-wider bg-emerald-600">
                                  {selectedLanguage === 'ES' ? 'INGRESO' : 'INCOME'}
                                </span>
                                {t.formaPago && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-black bg-emerald-50 text-emerald-900 border border-emerald-150 uppercase tracking-tight">
                                    💰 {t.formaPago}
                                  </span>
                                )}
                              </>
                            )}
                            <span className="text-slate-600 font-bold">
                              • {formatSafeDateString(t.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Right amount and delete operations */}
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-black whitespace-nowrap ${isExpense ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {isExpense ? '-' : '+'}${t.monto.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                        </span>

                        {/* Edit Transaction Trigger */}
                        <button
                          id={`btn-editar-${t.id}`}
                          onClick={() => { handleTap(); setEditingTransaction(t); }}
                          className="p-1 px-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-indigo-100"
                          title="Editar movimiento"
                        >
                          <MoreHorizontal className="w-4 h-4 text-slate-700 font-extrabold" />
                        </button>

                        {/* Delete Trigger */}
                        <button
                          id={`btn-borrar-${t.id}`}
                          onClick={() => handleBorrarTransaccion(t.id, t.monto, t.tipo)}
                          className="p-1 px-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="Eliminar movimiento"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

            {/* Minimal info brand footer */}
            <div className="text-center pt-2 text-[10px] text-gray-400 space-y-1">
              <p>© Finanza Insight iOS 17 Simulator Engine.</p>
              <p className="flex items-center justify-center gap-1">
                Reconocimiento de Inteligencia por <span className="font-semibold text-[#00897B]">Google Gemini API Workspace</span>
              </p>
            </div>
          </>
        )}
      </div>
    ) : activeTab === 'cloud' ? (
          <div id="dream-tab-content" className="p-5 space-y-5 text-left flex-1 flex flex-col justify-between">
            <div className="space-y-5">
              <DreamComplianceChart
                suenos={suenos}
                activeSuenoId={activeSuenoId}
                realAhorroNeto={realAhorroNeto}
                totalActivos={totalActivos}
                totalPasivos={totalPasivos}
                selectedCountry={effectiveCountry}
                selectedLanguage={selectedLanguage}
                onSelectSueno={handleSelectSueno}
                onAddSueno={handleAddSueno}
                onUpdateSueno={handleUpdateSueno}
                onDeleteSueno={handleDeleteSueno}
                transacciones={transacciones}
                userProfile={userProfile}
                saveUserProfileData={saveUserProfileData}
              />
            </div>

            {/* Minimal info brand footer */}
            <div className="text-center pt-2 text-[10px] text-gray-400 space-y-0.5 pb-10 mt-4">
              <p>© Finanza Insight Sueño 17 Live View.</p>
              <p className="flex items-center justify-center gap-1">
                Visualización de proyección de metas y curva de cumplimiento
              </p>
            </div>
          </div>
        ) : activeTab === 'productos' ? (
          /* --- PRODUCTOS INTEGRATION TAB VIEW --- */
          <div id="productos-tab-content" className="p-5 space-y-5 text-left flex-1 flex flex-col justify-between">
            <div className="space-y-5">
              {/* iOS Segmented Control */}
              <div className="bg-slate-100 p-1 rounded-2xl flex items-center justify-between border border-slate-200">
                <button
                  onClick={() => { handleTap(); setActiveProductSubTab('actuales'); }}
                  className={`flex-1 text-center py-2 text-xs font-black rounded-xl transition cursor-pointer ${
                    activeProductSubTab === 'actuales'
                      ? 'bg-white text-[#00897B] shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  💳 {t('productos_actuales')}
                </button>
                <button
                  onClick={() => { handleTap(); setActiveProductSubTab('recomendaciones'); }}
                  className={`flex-1 text-center py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                    activeProductSubTab === 'recomendaciones'
                      ? 'bg-white text-[#00897B] shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> {t('recomendaciones_ai')}
                </button>
              </div>

              {activeProductSubTab === 'actuales' ? (
                /* --- A) PRODUCTOS ACTUALES --- */
                (() => {
                  const filteredList = (userProfile.productos || []).filter(p => matchesFilter(p, portfolioFilter));
                  const totalCupo = filteredList.reduce((sum, p) => sum + (p.montoTotal || 0), 0);
                  const totalConsumido = filteredList.reduce((sum, p) => sum + getProductUtilizado(p), 0);
                  const consumidoPct = totalCupo > 0 ? Math.min(100, Math.round((totalConsumido / totalCupo) * 105), 100) : 0; // Wait, let's use standard 100 limit:
                  const pctSafe = totalCupo > 0 ? Math.min(100, Math.round((totalConsumido / totalCupo) * 100)) : 0;
                  return (
                    <div className="space-y-4">
                      {/* --- PROGRESS BAR GAUGE: TOTAL VS CONSUMIDO WITH FILTER SELECTOR --- */}
                      <div className="bg-gradient-to-tr from-[#0F172A] to-[#1E293B] text-white rounded-3xl p-5 shadow-lg space-y-4 border border-slate-800">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                          <div className="space-y-0.5 text-left">
                            <span className="text-[9px] font-black uppercase text-teal-400 tracking-widest block">Resumen de Cupos</span>
                            <h4 className="text-xs font-black text-slate-100">Consumo General de Portafolio</h4>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black text-teal-400 bg-teal-950/55 border border-teal-800/40 px-2.5 py-0.5 rounded-full select-none">
                              {pctSafe}% Usado
                            </span>
                          </div>
                        </div>

                        {/* Progress Gauge */}
                        <div className="space-y-2">
                          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-[2px] border border-slate-800 shadow-inner">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pctSafe}%` }}
                              className="h-full bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-500 rounded-full"
                              transition={{ duration: 0.8 }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex flex-col text-left">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Consumido / Deuda</span>
                              <span className="font-extrabold text-[#F1F5F9]">${totalConsumido.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Cupo / Límite Total</span>
                              <span className="font-extrabold text-[#F1F5F9]">${totalCupo.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Explanatory introduction card */}
                      <div className="bg-white rounded-3xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.01)] border border-slate-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-teal-50 text-[#00897B] rounded-xl flex-shrink-0 animate-pulse">
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t('productos_vigentes')}</h4>
                            <p className="text-[10px] text-slate-400 font-semibold leading-tight">{t('vincular_pagos')}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { handleTap(); setShowAddProductTab(!showAddProductTab); }}
                          className={`p-2 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-center ${
                            showAddProductTab
                              ? 'bg-rose-50 border-rose-200 text-rose-600'
                              : 'bg-teal-50 border-teal-200 text-teal-700'
                          }`}
                        >
                          {showAddProductTab ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Add Product Form - Darkened colors and high contrast to avoid pale styling */}
                      {showAddProductTab && (
                        <form
                          key={editingProducto ? `edit-${editingProducto.id}` : 'new-prod'}
                          className="bg-white rounded-2xl border border-slate-350 p-4 space-y-4 shadow-sm"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const bankSel = (document.getElementById('prod-tab-bank-select') as HTMLSelectElement)?.value || activeBanks[0];
                            const typeSel = (document.getElementById('prod-tab-type-select') as HTMLSelectElement)?.value || activeProducts[0];
                            const franchiseSel = (document.getElementById('prod-tab-franchise-select') as HTMLSelectElement)?.value || activeFranchises[0];
                            const aliasVal = (document.getElementById('prod-tab-alias-input') as HTMLInputElement)?.value?.trim();
                            const totalVal = parseFloat((document.getElementById('prod-tab-total-input') as HTMLInputElement)?.value) || 0;
                            const usedVal = parseFloat((document.getElementById('prod-tab-used-input') as HTMLInputElement)?.value) || 0;

                            if (editingProducto) {
                              const updatedProd = {
                                ...editingProducto,
                                banco: bankSel,
                                tipo: typeSel,
                                alias: aliasVal || undefined,
                                montoTotal: totalVal > 0 ? totalVal : undefined,
                                montoUtilizado: totalVal > 0 && usedVal >= 0 ? usedVal : undefined,
                                franquicia: (franchiseSel && franchiseSel !== 'Ninguna / No Aplica' && franchiseSel !== 'None / Not Applicable') ? franchiseSel : undefined
                              };
                              const updatedProds = (userProfile.productos || []).map(p => p.id === editingProducto.id ? updatedProd : p);
                              saveUserProfileData({ ...userProfile, productos: updatedProds });
                              setEditingProducto(null);
                              setShowAddProductTab(false);
                              playTone('success', isMuted);
                              triggerDynamicIsland(
                                selectedLanguage === 'ES' ? "Producto Actualizado" : "Product Updated", 
                                `${bankSel}`, 
                                true
                              );
                            } else {
                              const newProd: ProductoFinanciero = {
                                id: `prod-tab-${Date.now()}`,
                                banco: bankSel,
                                tipo: typeSel,
                                alias: aliasVal || undefined,
                                montoTotal: totalVal > 0 ? totalVal : undefined,
                                montoUtilizado: totalVal > 0 && usedVal >= 0 ? usedVal : undefined,
                                franquicia: (franchiseSel && franchiseSel !== 'Ninguna / No Aplica' && franchiseSel !== 'None / Not Applicable') ? franchiseSel : undefined
                              };

                              const updatedProds = [...(userProfile.productos || []), newProd];
                              saveUserProfileData({ ...userProfile, productos: updatedProds });
                              playTone('success', isMuted);
                              triggerDynamicIsland(
                                selectedLanguage === 'ES' ? "Portafolio Agregado" : "Portfolio Added", 
                                `${bankSel} • ${typeSel}`, 
                                true
                              );
                            }

                            // Reset controls
                            const aliasEl = document.getElementById('prod-tab-alias-input') as HTMLInputElement;
                            if (aliasEl) aliasEl.value = '';
                            const totalEl = document.getElementById('prod-tab-total-input') as HTMLInputElement;
                            if (totalEl) totalEl.value = '';
                            const usedEl = document.getElementById('prod-tab-used-input') as HTMLInputElement;
                            if (usedEl) usedEl.value = '';
                            const franchiseEl = document.getElementById('prod-tab-franchise-select') as HTMLSelectElement;
                            if (franchiseEl) franchiseEl.value = activeFranchises[0];
                          }}>
                        <div className="bg-slate-100/90 p-4 rounded-xl border border-slate-350 space-y-3 text-left">
                          <span className="text-[10px] font-black uppercase text-[#004D40] tracking-wider block">
                            {editingProducto 
                              ? (selectedLanguage === 'ES' ? 'Editar Producto' : 'Edit Product')
                              : t('registrar_producto')
                            }
                          </span>
                          
                          <div className="grid grid-cols-2 gap-2">
                            {/* Selector de Bancos */}
                            <div className="col-span-2 sm:col-span-1">
                              <label className="text-[9.5px] font-black text-slate-800 uppercase block mb-0.5">{t('banco_co')}</label>
                              <select
                                id="prod-tab-bank-select"
                                defaultValue={editingProducto?.banco || activeBanks[0]}
                                className="w-full bg-white border border-slate-400 rounded-lg py-1.5 px-2 text-[11px] font-black text-slate-950 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                              >
                                {activeBanks.map((b) => (
                                  <option key={b} value={b} className="text-slate-950 font-bold">{b}</option>
                                ))}
                              </select>
                            </div>

                            {/* Selector de Tipo de Producto */}
                            <div className="col-span-2 sm:col-span-1">
                              <label className="text-[9.5px] font-black text-slate-800 uppercase block mb-0.5">{t('tipo_producto')}</label>
                              <select
                                id="prod-tab-type-select"
                                defaultValue={editingProducto?.tipo || activeProducts[0]}
                                className="w-full bg-white border border-slate-400 rounded-lg py-1.5 px-2 text-[11px] font-black text-slate-950 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                              >
                                {activeProducts.map((p) => (
                                  <option key={p} value={p} className="text-slate-950 font-bold">
                                    {translateProduct(p, selectedLanguage)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Selector de Franquicia (Opcional) */}
                            <div className="col-span-2">
                              <label className="text-[9.5px] font-black text-slate-800 uppercase block mb-0.5">
                                {selectedLanguage === 'ES' ? 'Franquicia (Tarjeta) - Opcional' : 'Franchise (Card) - Optional'}
                              </label>
                              <select
                                id="prod-tab-franchise-select"
                                defaultValue={editingProducto?.franquicia || activeFranchises[0]}
                                className="w-full bg-white border border-slate-400 rounded-lg py-1.5 px-2 text-[11px] font-black text-slate-950 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                              >
                                {activeFranchises.map((f) => (
                                  <option key={f} value={f} className="text-slate-950 font-bold">
                                    {translateFranchise(f, selectedLanguage)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Cupo / Monto Total & Consumido input grid */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9.5px] font-black text-slate-800 uppercase block mb-0.5">
                                {selectedLanguage === 'ES' ? `Cupo / Monto Total (${effectiveCountry === 'CL' ? 'CLP' : 'COP'})` : `Total Limit / Amount (${effectiveCountry === 'CL' ? 'CLP' : 'COP'})`}
                              </label>
                              <input
                                type="number"
                                id="prod-tab-total-input"
                                defaultValue={editingProducto?.montoTotal || ''}
                                placeholder="Ej: 10000000"
                                className="w-full bg-white border border-slate-400 rounded-lg py-1.5 px-2 text-[11px] font-black text-slate-950 placeholder:text-slate-500 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                              />
                            </div>
                            <div>
                              <label className="text-[9.5px] font-black text-slate-800 uppercase block mb-0.5">
                                {selectedLanguage === 'ES' ? `Utilizado / Pagado (${effectiveCountry === 'CL' ? 'CLP' : 'COP'})` : `Used / Paid (${effectiveCountry === 'CL' ? 'CLP' : 'COP'})`}
                              </label>
                              <input
                                type="number"
                                id="prod-tab-used-input"
                                defaultValue={editingProducto?.montoUtilizado !== undefined ? editingProducto.montoUtilizado : ''}
                                placeholder="Ej: 1000000"
                                className="w-full bg-white border border-slate-400 rounded-lg py-1.5 px-2 text-[11px] font-black text-slate-950 placeholder:text-slate-500 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                              />
                            </div>
                          </div>

                          {/* Alias input */}
                          <div>
                            <label className="text-[9.5px] font-black text-slate-800 uppercase block mb-0.5">{t('alias_opcional')}</label>
                            <input
                              type="text"
                              id="prod-tab-alias-input"
                              defaultValue={editingProducto?.alias || ''}
                              placeholder={selectedLanguage === 'ES' ? 'Ej: Cuenta de Nómina, Tarjeta Principal' : 'i.e. Salary Account, Main Card'}
                              className="w-full bg-white border border-slate-400 rounded-lg py-1.5 px-2 text-[11px] font-black text-slate-950 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2 bg-[#00897B] hover:bg-[#00796B] text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-md transition active:scale-98 cursor-pointer text-center mt-1"
                          >
                            {editingProducto 
                              ? (selectedLanguage === 'ES' ? 'Guardar Cambios' : 'Save Changes')
                              : `+ ${t('guardar_producto')}`
                            }
                          </button>
                        </div>
                        </form>
                      )}

                        {/* List of active products - with high contrast darken styles */}
                        <div className="space-y-3 text-left">
                          <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider block">
                            {t('productos_vigentes')} ({filteredList.length})
                          </span>
                          
                          {(!userProfile.productos || userProfile.productos.length === 0) ? (
                            <div className="p-4 text-center bg-slate-50 rounded-2xl text-[11px] text-slate-400 font-medium border border-slate-200">
                              {t('sin_productos')}
                            </div>
                          ) : filteredList.length === 0 ? (
                            <div className="p-4 text-center bg-slate-50 rounded-2xl text-[11.5px] text-slate-600 font-black border border-dashed border-slate-300">
                              {selectedLanguage === 'ES' ? 'No hay productos que coincidan con esta categoría.' : 'No products match this category.'}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {filteredList.map((prod) => (
                                <div key={prod.id} className="p-4 bg-white hover:bg-slate-50 rounded-2xl border border-slate-350 shadow-xs transition-all flex flex-col space-y-3">
                                  <div className="flex justify-between items-center w-full">
                                    <div className="flex items-center gap-2.5">
                                      <div className="p-1.5 bg-teal-50 rounded-lg text-[#00897B] flex-shrink-0 border border-teal-100/50">
                                        <CreditCard className="w-4 h-4" />
                                      </div>
                                      <div className="text-left">
                                        <span className="text-xs font-black text-slate-900 block leading-tight text-left">
                                          {prod.banco}{" "}
                                          <span className="font-extrabold text-[#00796B] text-[10px] bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/50">
                                            {translateProduct(prod.tipo, selectedLanguage)}
                                          </span>
                                          {prod.franquicia && (
                                            <span className="font-extrabold text-blue-800 text-[10px] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/50 ml-1">
                                              {translateFranchise(prod.franquicia, selectedLanguage)}
                                            </span>
                                          )}
                                        </span>
                                        {prod.alias && (
                                          <span className="text-[9.5px] text-[#005B4F] font-black mt-0.5 block italic text-left">
                                            "{prod.alias}"
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                                      <button
                                        type="button"
                                        onClick={() => { handleTap(); startEditingProducto(prod); }}
                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer border-r border-slate-200"
                                        title={selectedLanguage === "ES" ? "Editar Producto" : "Edit Product"}
                                      >
                                        <MoreHorizontal className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const filtered = (userProfile.productos || []).filter(p => p.id !== prod.id);
                                          saveUserProfileData({ ...userProfile, productos: filtered });
                                          playTone("delete", isMuted);
                                          triggerDynamicIsland(
                                            selectedLanguage === "ES" ? "Producto Eliminado" : "Product Removed",
                                            `${prod.banco} Eliminado`,
                                            false
                                          );
                                        }}
                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                        title={selectedLanguage === "ES" ? "Eliminar Producto" : "Delete Product"}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Progress bar visual for Total vs Used */}
                                  {prod.montoTotal && prod.montoTotal > 0 ? (
                                    <div className="pt-2 border-t border-slate-300 w-full space-y-1.5">
                                      <div className="flex justify-between items-baseline text-[10.5px]">
                                        <span className="font-bold text-slate-700">
                                          {selectedLanguage === 'ES' ? 'Utilizado/Pagado: ' : 'Used/Paid: '}
                                          <strong className="text-slate-900 font-extrabold">
                                            ${getProductUtilizado(prod).toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                                          </strong>
                                          <span className="mx-1 text-slate-400">/</span>
                                          <strong className="text-[#00897B] font-extrabold">
                                            ${prod.montoTotal.toLocaleString('es-ES', { minimumFractionDigits: 0 })}
                                          </strong>
                                        </span>
                                        <span className="font-black text-[#00897B] bg-teal-50 px-1.5 py-0.2 rounded-md border border-teal-100/65">
                                          {Math.min(Math.round((getProductUtilizado(prod) / prod.montoTotal) * 100), 100)}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden relative border border-slate-300">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${Math.min((getProductUtilizado(prod) / prod.montoTotal) * 100, 100)}%` }}
                                          className="h-full bg-gradient-to-r from-[#00897B] via-teal-500 to-emerald-500 rounded-full"
                                          transition={{ duration: 0.6 }}
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
              ) : (
                /* --- B) RECOMENDACIONES AI --- */
                <div className="space-y-4">
                  {/* Sub-tab selection inside Recommendations section */}
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-300">
                    <button
                      type="button"
                      onClick={() => { handleTap(); setRecommendationMode('consulting'); }}
                      className={`flex-1 text-center py-2 text-[11px] font-black rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        recommendationMode === 'consulting'
                          ? 'bg-white text-[#00897B] shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {selectedLanguage === 'ES' ? 'Preguntar a IA ✨' : 'Ask AI ✨'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleTap(); setRecommendationMode('automatic'); }}
                      className={`flex-1 text-center py-2 text-[11px] font-black rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        recommendationMode === 'automatic'
                          ? 'bg-white text-[#00897B] shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 animate-pulse" />
                      {selectedLanguage === 'ES' ? 'Auto Recomendaciones 🤖' : 'Auto Suggestions 🤖'}
                    </button>
                  </div>

                  {recommendationMode === 'consulting' ? (
                    /* =======================================================
                       PART 1: INTERACTIVE CUSTOM PRODUCT SEARCH WITH GEMINI
                       ======================================================= */
                    <div className="space-y-4">
                      {/* Interactive prompt block */}
                      <div className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#00897B]/10 text-left space-y-4">
                        <div className="border-b border-slate-100 pb-2.5">
                          <span className="text-[9.5px] font-black uppercase tracking-widest text-[#008B81] flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 animate-pulse" /> {selectedLanguage === 'ES' ? 'CONSULTORÍA INTERACTIVA' : 'INTERACTIVE CONSULTATION'}
                          </span>
                          <h3 className="text-sm font-black text-slate-900 mt-1">
                            {selectedLanguage === 'ES' ? '¿Qué producto financiero buscas?' : 'What financial product are you seeking?'}
                          </h3>
                          <p className="text-[10px] text-slate-450 font-medium leading-relaxed">
                            {selectedLanguage === 'ES' 
                              ? 'Dile a la IA tus necesidades específicas (bajas tasas, sin costo, cashback) en tu país y te sugerirá las mejores opciones.' 
                              : 'Specify your needs (low rates, no fees, cashback) in your country and the AI will recommend prime choices.'}
                          </p>
                        </div>

                        {/* Search tags for 1-click execution */}
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                            {selectedLanguage === 'ES' ? 'Sugerencias de búsqueda rápidas:' : 'Quick search ideas:'}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: selectedLanguage === 'ES' ? 'Sin Cuota de Manejo 💳' : 'No Annual Fee Card 💳', query: selectedLanguage === 'ES' ? 'Busco una tarjeta de crédito sin cuota de manejo' : 'Looking for a credit card with absolutely no annual handling fees' },
                              { label: selectedLanguage === 'ES' ? 'CDT Alta Rentabilidad 📈' : 'High Yield CDT 📈', query: selectedLanguage === 'ES' ? 'Quiero ver opciones de CDT a 90 o 180 días con las mejores tasas de interés' : 'What are the best high yield CDTs or savings certificates around 90-180 days?' },
                              { label: selectedLanguage === 'ES' ? 'Cuenta con Cashback 💰' : 'Cashback Checking Account 💰', query: selectedLanguage === 'ES' ? 'Busco una cuenta de ahorros que devuelva dinero por comprar' : 'Seeking a digital savings account that offers cashback on daily purchases' },
                              { label: selectedLanguage === 'ES' ? 'Fintech de Bajo Interés 📱' : 'Low Interest Fintech 📱', query: selectedLanguage === 'ES' ? 'Busco un crédito rápido de bajo costo o cooperativa transparente' : 'Recommend digital loans or fintech services with transparent fast approval' }
                            ].map((tag, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  handleTap();
                                  setCustomProductQuery(tag.query);
                                  handleCustomProductSearch(tag.query);
                                }}
                                className="px-2.5 py-1 text-[10px] font-extrabold text-slate-900 bg-slate-200 hover:bg-slate-300 hover:text-teal-950 rounded-lg transition-all cursor-pointer border border-slate-450 hover:border-teal-400 shadow-xs"
                              >
                                {tag.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Textarea lookup field with Speech-To-Text / Voice input support */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!customProductQuery.trim()) return;
                            handleCustomProductSearch(customProductQuery);
                          }}
                          className="space-y-3"
                        >
                          <div className="relative">
                            <textarea
                              rows={3}
                              value={customProductQuery}
                              onChange={(e) => setCustomProductQuery(e.target.value)}
                              placeholder={selectedLanguage === 'ES' ? "Ej. Busco una tarjeta de crédito sin cuota de manejo que acumule puntos para viajes ..." : "e.g. Looking for a credit card with zero monthly handling fees that accumulates travel miles..."}
                              className="w-full bg-slate-50 border border-slate-400 rounded-xl p-3 pr-10 text-xs font-bold text-slate-950 focus:outline-[#008B81] focus:ring-1 focus:ring-[#008B81] placeholder:text-slate-500 transition-all leading-normal"
                            />
                            <button
                              type="button"
                              onClick={startCustomProductSpeechRecognition}
                              className={`absolute right-2.5 bottom-2.5 p-2 rounded-xl transition-all cursor-pointer ${
                                isListeningCustomProduct
                                  ? 'bg-rose-500 text-white animate-pulse shadow-md ring-2 ring-rose-300'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-950 hover:scale-105 border border-slate-300'
                              }`}
                              title={selectedLanguage === 'ES' ? "Activar dictado por voz 🎙️" : "Toggle voice dictation 🎙️"}
                            >
                              <Mic className={`w-4 h-4 ${isListeningCustomProduct ? 'animate-bounce' : ''}`} />
                            </button>
                          </div>

                          {customProductError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[10.5px] font-bold">
                              ⚠️ {customProductError}
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isSearchingCustomProducts || !customProductQuery.trim()}
                            className="w-full py-3 bg-[#00897B] hover:bg-[#00796B] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                          >
                            {isSearchingCustomProducts ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>{selectedLanguage === 'ES' ? 'Preguntando a la IA...' : 'Analyse Options with AI...'}</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 text-white animate-pulse" />
                                <span>{selectedLanguage === 'ES' ? 'Sugerir con Inteligencia Artificial ✨' : 'Generate suggestions with AI ✨'}</span>
                              </>
                            )}
                          </button>
                        </form>
                      </div>

                      {/* Search Results loop */}
                      {isSearchingCustomProducts && (
                        <div className="p-10 text-center space-y-3 bg-white/75 rounded-3xl border border-slate-200">
                          <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#00897B]" />
                          <p className="text-xs font-black text-slate-800 uppercase tracking-widest">{selectedLanguage === 'ES' ? 'Analizando mercado local' : 'Scanning local financial market'}</p>
                          <p className="text-[10px] text-slate-500 font-semibold">{selectedLanguage === 'ES' ? 'Buscando las mejores ofertas bancarias en internet...' : 'Mapping bank policies, interest rates, and fee waivers...'}</p>
                        </div>
                      )}

                      {!isSearchingCustomProducts && customProductRecommendations && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                              {selectedLanguage === 'ES' ? 'Opciones sugeridas por la IA' : 'AI generated matches'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCustomProductRecommendations(null)}
                              className="text-[10px] text-slate-500 hover:text-rose-600 font-bold transition"
                            >
                              {selectedLanguage === 'ES' ? 'Limpiar resultados ✕' : 'Clear matches ✕'}
                            </button>
                          </div>

                          <div className="space-y-3.5">
                            {customProductRecommendations.length === 0 ? (
                              <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-350 text-xs font-semibold text-slate-500">
                                {selectedLanguage === 'ES' ? 'No se encontraron ofertas viables para esta consulta. Intenta cambiar de palabras clave.' : 'No matches found. Try broadening your criteria.'}
                              </div>
                            ) : (
                              customProductRecommendations.map((rec) => {
                                const alreadyLinked = userProfile.productos?.some(p => p.alias === rec.producto && p.banco === rec.banco);
                                return (
                                  <motion.div
                                    key={rec.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#00897B]/10 hover:border-[#00897B]/25 transition relative overflow-hidden text-left"
                                  >
                                    <span className="absolute top-0 right-0 bg-gradient-to-l from-indigo-600 to-[#00897B] text-white font-black text-[7.5px] uppercase tracking-widest px-2.5 py-1 rounded-bl-xl shadow-xs">
                                      AI MATCHED ⭐
                                    </span>

                                    <div className="space-y-3">
                                      {/* Bank and Product */}
                                      <div>
                                        <span className="text-[9px] font-extrabold uppercase text-[#00796B] tracking-wider block bg-[#E0F2F1]/40 px-2 py-0.5 rounded-md inline-block">
                                          🏛️ {rec.banco}
                                        </span>
                                        <h2 className="text-sm font-black text-slate-900 mt-1.5 leading-snug">
                                          {rec.producto}
                                        </h2>
                                      </div>

                                      {/* Cost card */}
                                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 flex justify-between items-center text-xs">
                                        <span className="text-slate-500 font-bold">{selectedLanguage === 'ES' ? 'Costo de Manejo:' : 'Handling Fee:'}</span>
                                        <strong className="text-indigo-900 font-black">{rec.costoMensual}</strong>
                                      </div>

                                      {/* AI explanation */}
                                      <p className="text-[10.5px] text-slate-600 bg-indigo-50/25 p-3 rounded-xl border border-indigo-150/10 italic leading-normal">
                                        💡 <strong>AI Reason:</strong> {rec.razon}
                                      </p>

                                      {/* Benefits list */}
                                      <div className="space-y-1.5">
                                        <span className="text-[9.5px] font-black uppercase text-slate-400 tracking-widest block">{t('beneficios')}</span>
                                        <ul className="space-y-1 text-[11px] text-slate-705">
                                          {rec.beneficios.map((ben, bIdx) => (
                                            <li key={bIdx} className="flex items-start gap-1.5">
                                              <span className="text-[#00897B] mt-0.5 flex-shrink-0">✓</span>
                                              <span className="leading-tight font-medium text-slate-700">{ben}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>

                                      {/* Portfolio quick link action button */}
                                      <div className="pt-2 border-t border-slate-100">
                                        {alreadyLinked ? (
                                          <button
                                            type="button"
                                            disabled
                                            className="w-full py-2 bg-emerald-50 text-emerald-700 border border-emerald-250 font-black text-[10.5px] uppercase tracking-wider rounded-xl cursor-not-allowed flex items-center justify-center gap-1"
                                          >
                                            <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                            <span>{selectedLanguage === 'ES' ? 'Vinculado al Portafolio ✅' : 'Linked to active portfolio ✅'}</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleLinkRecommendedProduct(rec)}
                                            className="w-full py-2 bg-[#00897B] hover:bg-[#00796B] text-white font-black text-[10.5px] uppercase tracking-wider rounded-xl cursor-pointer transition active:scale-97 flex items-center justify-center gap-1 shadow-xs"
                                          >
                                            + {selectedLanguage === 'ES' ? 'Vincular a mis Productos' : 'Link to active portfolio'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* =======================================================
                       PART 2: AUTOMATIC PRODUCTS SUGGESTED BY TRANSACTION RULES
                       ======================================================= */
                    <div className="space-y-4">
                      {/* Explanatory introduction card */}
                      <div className="bg-white rounded-3xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.01)] border border-slate-100 flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl flex-shrink-0">
                          <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest text-left">{t('recomendaciones_ai')}</h4>
                          <p className="text-[10px] text-slate-400 font-semibold leading-tight text-left">{t('sincronizado_ai')}</p>
                        </div>
                      </div>

                      {/* Recommendations Generator call & loop */}
                      <div className="space-y-3.5">
                        {getRecommendedProducts(transacciones, userProfile.productos || [], effectiveCountry, selectedLanguage).map((rec, index) => {
                          const alreadyLinked = userProfile.productos?.some(p => p.alias === rec.producto && p.banco === rec.banco);
                          return (
                            <motion.div
                              key={rec.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#00897B]/10 hover:border-[#00897B]/25 transition relative overflow-hidden text-left"
                            >
                              {/* Dynamic Top Badge for VIP sense */}
                              <span className="absolute top-0 right-0 bg-gradient-to-l from-[#00897B] to-[#00BFA5] text-white font-black text-[7.5px] uppercase tracking-widest px-2.5 py-1 rounded-bl-xl shadow-xs">
                                {selectedLanguage === 'ES' ? 'AUTOMÁTICO' : 'AUTO MATCH'}
                              </span>

                              <div className="space-y-3">
                                {/* Header section with Bank and Product */}
                                <div>
                                  <span className="text-[9px] font-extrabold uppercase text-[#00796B] tracking-wider block bg-[#E0F2F1]/40 px-2 py-0.5 rounded-md inline-block">
                                    🏛️ {rec.banco}
                                  </span>
                                  <h2 className="text-sm font-black text-slate-900 mt-1.5 leading-snug">
                                    {rec.producto}
                                  </h2>
                                </div>

                                {/* Dynamic Cost info */}
                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 flex justify-between items-center text-xs">
                                  <span className="text-slate-500 font-bold">{t('costo_mensual')}:</span>
                                  <strong className="text-indigo-900 font-black">{rec.costoMensual}</strong>
                                </div>

                                {/* Reason based on expenses */}
                                <p className="text-[10.5px] text-slate-600 bg-teal-50/20 p-3 rounded-xl border border-teal-150/10 italic leading-normal">
                                  💡 <strong>AI Insights:</strong> {rec.razon}
                                </p>

                                {/* Bullet Benefits list */}
                                <div className="space-y-1.5">
                                  <span className="text-[9.5px] font-black uppercase text-slate-400 tracking-widest block">{t('beneficios')}</span>
                                  <ul className="space-y-1 text-[11px] text-slate-705">
                                    {rec.beneficios.map((ben, bIdx) => (
                                      <li key={bIdx} className="flex items-start gap-1.5">
                                        <span className="text-[#00897B] mt-0.5 flex-shrink-0">✓</span>
                                        <span className="leading-tight font-medium text-slate-700">{ben}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Portfolio quick link action button */}
                                <div className="pt-2 border-t border-slate-100">
                                  {alreadyLinked ? (
                                    <button
                                      type="button"
                                      disabled
                                      className="w-full py-2 bg-emerald-50 text-emerald-700 border border-emerald-250 font-black text-[10.5px] uppercase tracking-wider rounded-xl cursor-not-allowed flex items-center justify-center gap-1"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                      <span>{selectedLanguage === 'ES' ? 'Vinculado al Portafolio ✅' : 'Linked to active portfolio ✅'}</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleLinkRecommendedProduct(rec)}
                                      className="w-full py-2 bg-[#00897B] hover:bg-[#00796B] text-white font-black text-[10.5px] uppercase tracking-wider rounded-xl cursor-pointer transition active:scale-97 flex items-center justify-center gap-1 shadow-xs"
                                    >
                                      + {selectedLanguage === 'ES' ? 'Vincular a mis Productos' : 'Link to active portfolio'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Minimal info brand footer */}
            <div className="text-center pt-2 text-[10px] text-gray-400 space-y-0.5 pb-10 mt-4">
              <p>© Finanza Insight Products Hub.</p>
              <p className="flex items-center justify-center gap-1">
                Sincronización automatizada optimizada por <span className="font-semibold text-[#00897B]">Gemini Smart AI Engine</span>
              </p>
            </div>
          </div>
        ) : activeTab === 'portafolios' ? (
          /* --- PORTAFOLIO TAB VIEW --- */
          <div id="portafolios-tab-content" className="flex-1 flex flex-col h-[calc(100vh-190px)] mb-6 overflow-y-auto bg-slate-50 p-4 space-y-6">
            {/* Header Totals */}
            <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] p-5 rounded-3xl shadow-lg border border-slate-800 text-white relative overflow-hidden shrink-0">
              <div className="absolute -top-4 -right-4 p-4 opacity-10">
                <Briefcase className="w-32 h-32" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mb-1 relative z-10">{selectedLanguage === 'ES' ? 'Total Activos' : 'Total Assets'}</h3>
              <p className="text-3xl font-black tracking-tight relative z-10">
                {formatCurrency((userProfile.portafolios || []).reduce((acc, p) => acc + p.valor, 0))}
              </p>
            </div>

            {/* Added Assets List */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#00897B]">{selectedLanguage === 'ES' ? 'Mis Activos' : 'My Assets'}</h3>
              {(userProfile.portafolios || []).length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 border-dashed text-center">
                  <p className="text-xs font-semibold text-slate-500">{selectedLanguage === 'ES' ? 'Aún no tienes activos en tu portafolio.' : 'You have no assets in your portfolio yet.'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {(userProfile.portafolios || []).map(p => (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{p.nombre}</h4>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mt-0.5"><Database className="w-3 h-3" /> {p.plataforma}</p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <span className="text-sm font-black text-indigo-700">{formatCurrency(p.valor)}</span>
                        <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden relative z-20">
                          <button onClick={() => { handleTap(); startEditingPortafolio(p); }} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer border-r border-slate-200"><MoreHorizontal className="w-4 h-4" /></button>
                          <button onClick={() => { handleTap(); handleDeletePortafolio(p.id); }} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-slate-100 transition cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Form */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 mb-4 shrink-0">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-2"><Plus className="w-4 h-4 text-[#00897B]" /> {selectedLanguage === 'ES' ? 'Agregar Activo' : 'Add Asset'}</h3>
              <form onSubmit={handleAddPortafolio} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{selectedLanguage === 'ES' ? 'Nombre del activo' : 'Asset Name'}</label>
                  <input type="text" value={nuevoPortafolio.nombre} onChange={e => setNuevoPortafolio({...nuevoPortafolio, nombre: e.target.value})} placeholder={selectedLanguage === 'ES' ? "Ej. Bitcoin, Acciones..." : "e.g. Bitcoin, Stocks..."} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 transition" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{selectedLanguage === 'ES' ? 'Valor' : 'Value'}</label>
                  <input type="text" inputMode="numeric" value={nuevoPortafolio.valor} onChange={e => setNuevoPortafolio({...nuevoPortafolio, valor: e.target.value.replace(/[^0-9.]/g, '')})} placeholder="$ 0" className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 transition" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{selectedLanguage === 'ES' ? 'Plataforma' : 'Platform'}</label>
                  <input type="text" value={nuevoPortafolio.plataforma} onChange={e => setNuevoPortafolio({...nuevoPortafolio, plataforma: e.target.value})} placeholder={selectedLanguage === 'ES' ? "Ej. Binance, Trii..." : "e.g. Binance, Trii..."} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 transition" required />
                </div>
                <button type="submit" className="w-full py-3 bg-[#00897B] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#00796B] transition cursor-pointer active:scale-97 shadow-sm mt-2">
                  {selectedLanguage === 'ES' ? 'Guardar Activo' : 'Save Asset'}
                </button>
              </form>
            </div>
          </div>
        ) : activeTab === 'insights' ? (
          /* --- INSIGHTS AI CHATBOT TAB VIEW --- */
          <div id="insights-tab-content" className="flex-1 flex flex-col h-[calc(100vh-190px)] mb-6 overflow-hidden bg-slate-50/50 p-4 space-y-4">
            
            {/* iOS Segmented Control for Insights Subtabs */}
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center justify-between border border-slate-200 shrink-0">
              <button
                onClick={() => { handleTap(); setActiveInsightSubTab('asesor'); }}
                className={`flex-1 text-center py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeInsightSubTab === 'asesor'
                    ? 'bg-white text-[#00897B] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Prako IA
              </button>
              <button
                onClick={() => { handleTap(); setActiveInsightSubTab('insights'); }}
                className={`flex-1 text-center py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeInsightSubTab === 'insights'
                    ? 'bg-white text-[#00897B] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                💡 Consejos IA
              </button>
            </div>

            {activeInsightSubTab === 'asesor' ? (
                            <ChatPanel
                selectedLanguage={selectedLanguage}
                selectedCountry={effectiveCountry}
                userProfile={userProfile}
                suenos={suenos}
                activeSuenoId={activeSuenoId}
                totalActivos={totalActivos}
                totalPasivos={totalPasivos}
                transacciones={transacciones}
                saveTransacciones={saveTransacciones}
                saveUserProfileData={saveUserProfileData}
                saveSuenosList={saveSuenosList}
                triggerDynamicIsland={triggerDynamicIsland}
                playTone={playTone}
                isMuted={isMuted}
                t={t}
                extractPdfText={extractPdfText}
                askPdfPassword={askPdfPassword}
                chatMessages={chatMessages}
                setChatMessages={setChatMessages}
                categorias={categorias}
                getMergedPaymentMethods={getMergedPaymentMethods}
                onDuplicatesFound={triggerDuplicatesModal}
              />
            ) : (
              /* --- B) INSIGHTS VIEW (Moved from Sueño tab) --- */
              <div className="flex-1 overflow-y-auto pr-1 py-1 text-left space-y-4">
                {majorGasto.total > 0 ? (
                  <div className="bg-white rounded-3xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.02)] border border-gray-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t('optimizar_sueno')}</h4>
                        <p className="text-[9px] text-slate-400">Recomendaciones personalizadas</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {t('consejo_gasto')} <strong className="text-slate-800">{translateCategory(majorGasto.nombre)}</strong> con <strong className="text-slate-800">{formatCurrency(majorGasto.total)}</strong> ({majorGasto.percentage}% del total).
                      </p>
                      <p className="text-[11.5px] text-[#00897B] font-semibold bg-[#E0F2F1]/30 p-3 rounded-xl border border-[#00897B]/10 leading-relaxed">
                        💡 <strong>{t('consejo_ahorro')}:</strong> {t('consejo_ahorro_desc', { cat: translateCategory(majorGasto.nombre), amount: formatCurrency(Math.round(majorGasto.total * 0.15)) })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 bg-slate-100 rounded-2xl flex flex-col items-center">
                    <span className="text-3xl mb-3">🤓</span>
                    <h3 className="text-sm font-bold text-slate-700">Sin datos para analizar</h3>
                    <p className="text-xs text-slate-500 mt-2">Registra gastos para comenzar a recibir insights personalizados de la IA.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'suscripciones' ? (
          <SuscripcionesPanel
            suscripciones={suscripciones}
            saveSuscripcionesList={saveSuscripcionesList}
            selectedCountry={effectiveCountry}
            selectedLanguage={selectedLanguage}
            autoOpenAdd={autoOpenSubModal}
            onAddOpened={() => setAutoOpenSubModal(false)}
          />
        ) : null}
      </div>

      {/* Floating Action Button (Moved to bottom right to avoid overlap with 5 tabs) */}
      {activeTab !== 'insights' && (activeTab !== 'finance' || activeBalanceSubTab !== 'recurrentes') && (
        <div className="absolute left-1/2 -translate-x-1/2 z-50"
          style={{
            bottom: 'calc(4rem - 11px + env(safe-area-inset-bottom, 0px))'
          }}>
          <button
            id="btn-center-plus"
            onMouseDown={startPressLong}
            onMouseUp={endPressLong}
            onMouseLeave={cancelPressLong}
            onTouchStart={startPressLong}
            onTouchEnd={(e) => { e.preventDefault(); endPressLong(e); }}
            onClick={() => {
              if (!isAddingOpen) {
                handleTap();
                setInitialTransactionForModal(null);
                setPopupInitialChoice('choice');
                setIsAddingOpen(true);
              }
            }}
            className="w-14 h-14 bg-[#0d9488] rounded-full flex items-center justify-center text-white border-[3px] border-white shadow-lg active:scale-95 duration-200 cursor-pointer select-none"
            title="Presiona para elegir; mantén presionado para dictar con voz"
          >
            <Plus className="w-7 h-7 stroke-[3px]" />
          </button>
        </div>
      )}

      {isReorderMode && (
        <div className="absolute bottom-[4rem] inset-x-0 flex justify-center z-50 pb-1 pointer-events-none">
          <span className="bg-slate-800/90 text-white text-xs px-3 py-1 rounded-full shadow-md animate-bounce">
            {selectedLanguage === "ES"
              ? "Arrastra para reordenar"
              : "Drag to reorder"}
          </span>
        </div>
      )}

      <div id="bottom-nav-scroll" className="absolute bottom-0 inset-x-0 h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-white/95 backdrop-blur-md border-t border-gray-150 grid grid-cols-7 items-center justify-items-center z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] px-1 overflow-hidden">
        {tabOrder.slice(0, 3).map((tabId) => {
          const tab = ALL_TABS.find(t => t.id === tabId);
          if (!tab) return null;
          const isActive = activeTab === tab.tabKey;
          const isDragging = draggingTab === tabId;
          const isDragOver = dragOverTab === tabId;
          return (
            <button
              key={`btn-${tabId}`}
              id={`tab-btn-${tabId}`}
              onMouseDown={() => handleTabLongPress(tabId)}
              onTouchStart={() => handleTabLongPress(tabId)}
              onMouseUp={handleTabPressEnd}
              onTouchEnd={() => {
                handleTabPressEnd();
                if (!isReorderMode) {
                  handleTap();
                  setActiveTab(tab.tabKey as any);
                  document.getElementById("main-scroll-container")?.scrollTo({ top: 0, behavior: "smooth" });
                }
                handleDragEnd();
              }}
              onMouseEnter={() => isReorderMode && handleDragOver(tabId)}
              onClick={() => {
                if (!isReorderMode) {
                  handleTap();
                  setActiveTab(tab.tabKey as any);
                  document.getElementById("main-scroll-container")?.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`flex flex-col items-center justify-center w-full py-1 transition-all cursor-pointer relative select-none ${isActive ? "text-[#00897B]" : "text-slate-400"} ${isDragging ? "opacity-50 scale-95" : ""} ${isDragOver ? "scale-105" : ""} ${isReorderMode ? "cursor-grab" : ""}`}
            >
              {tab.icon === "Database" && <Database className="w-5.5 h-5.5 stroke-[2.5px]" />}
              {tab.icon === "Cloud" && <Cloud className="w-5.5 h-5.5 stroke-[2.5px]" />}
              {tab.icon === "CreditCard" && <CreditCard className="w-5.5 h-5.5 stroke-[2.5px]" />}
              {tab.icon === "Briefcase" && <Briefcase className="w-5.5 h-5.5 stroke-[2.5px]" />}
              {tab.icon === "Repeat" && <Repeat className="w-5.5 h-5.5 stroke-[2.5px]" />}
              {tab.icon === "Sparkles" && <Sparkles className="w-5.5 h-5.5 stroke-[2.5px] animate-pulse" />}
              <span className="text-[8px] sm:text-[9.5px] font-black mt-1 uppercase tracking-tighter truncate max-w-full px-0.5 text-center w-full">
                {t(tab.label as any)}
              </span>
              {isReorderMode && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-teal-500 animate-ping" />
              )}
            </button>
          );
        })}

        {/* Central Spacer Column (4th grid-column out of 7) */}
        <div className="w-full h-8 flex items-center justify-center pointer-events-none" />

        {tabOrder.slice(3).map((tabId) => {
          const tab = ALL_TABS.find(t => t.id === tabId);
          if (!tab) return null;
          const isActive = activeTab === tab.tabKey;
          const isDragging = draggingTab === tabId;
          const isDragOver = dragOverTab === tabId;
          return (
            <button
              key={`btn-${tabId}`}
              id={`tab-btn-${tabId}`}
              onMouseDown={() => handleTabLongPress(tabId)}
              onTouchStart={() => handleTabLongPress(tabId)}
              onMouseUp={handleTabPressEnd}
              onTouchEnd={() => {
                handleTabPressEnd();
                if (!isReorderMode) {
                  handleTap();
                  setActiveTab(tab.tabKey as any);
                  document.getElementById("main-scroll-container")?.scrollTo({ top: 0, behavior: "smooth" });
                }
                handleDragEnd();
              }}
              onMouseEnter={() => isReorderMode && handleDragOver(tabId)}
              onClick={() => {
                if (!isReorderMode) {
                  handleTap();
                  setActiveTab(tab.tabKey as any);
                  document.getElementById("main-scroll-container")?.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`flex flex-col items-center justify-center w-full py-1 transition-all cursor-pointer relative select-none ${isActive ? "text-[#00897B]" : "text-slate-400"} ${isDragging ? "opacity-50 scale-95" : ""} ${isDragOver ? "scale-105" : ""} ${isReorderMode ? "cursor-grab" : ""}`}
            >
              {tab.icon === "Database" && <Database className="w-5.5 h-5.5 stroke-[2.5px]" />}
              {tab.icon === "Cloud" && <Cloud className="w-5.5 h-5.5 stroke-[2.5px]" />}
              {tab.icon === "CreditCard" && <CreditCard className="w-5.5 h-5.5 stroke-[2.5px]" />}
              {tab.icon === "Briefcase" && <Briefcase className="w-5.5 h-5.5 stroke-[2.5px]" />}
              {tab.icon === "Repeat" && <Repeat className="w-5.5 h-5.5 stroke-[2.5px]" />}
              {tab.icon === "Sparkles" && <Sparkles className="w-5.5 h-5.5 stroke-[2.5px] animate-pulse" />}
              <span className="text-[8px] sm:text-[9.5px] font-black mt-1 uppercase tracking-tighter truncate max-w-full px-0.5 text-center w-full">
                {t(tab.label as any)}
              </span>
              {isReorderMode && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-teal-500 animate-ping" />
              )}
            </button>
          );
        })}
      </div>

      {/* --- ADDING DIALOG/BOTTOM SHEET (Aesthetic Apple iOS-style drawer modal bottom sheet) --- */}
      <AnimatePresence>
        {showManageCategories && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManageCategories(false)}
              className="absolute inset-0 bg-black/60 z-40 backdrop-blur-[2px]"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="absolute bottom-0 inset-x-0 bg-white rounded-t-[30px] z-50 p-6 shadow-2xl flex flex-col border-t border-slate-100 max-h-[92%] overflow-y-auto text-left"
            >
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">⚙️</span>
                  <h3 className="text-sm font-extrabold text-black uppercase tracking-wider">
                    {selectedLanguage === 'ES' ? 'Modificar Categoría' : 'Modify Category'}
                  </h3>
                </div>
                <button
                  onClick={() => { handleTap(); setShowManageCategories(false); }}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* LIST OF CURRENT CATEGORIES */}
              <div className="space-y-2 mb-6">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left">
                  {selectedLanguage === 'ES' ? 'Categorías Activas' : 'Active Categories'}
                </h4>
                <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {categorias.map((c) => (
                    <div key={c.nombre} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-xl">
                      <div 
                        className="flex items-center gap-2.5 cursor-pointer flex-1"
                        onClick={() => {
                          handleTap();
                          setPrefilledCategory(c.nombre);
                          setPopupInitialChoice('form');
                          setShowManageCategories(false);
                          setIsAddingOpen(true);
                        }}
                      >
                        <div className="p-1.5 rounded-lg bg-white shadow-3xs">
                          {renderCategoriaIcon(c.icon, c.color, "w-4.5 h-4.5")}
                        </div>
                        <span className="text-xs font-extrabold text-slate-950">
                          {translateCategory(c.nombre)}
                        </span>
                      </div>

                      {c.nombre !== 'Otros' && (
                        <button
                          onClick={() => { handleTap(); handleDeleteCategory(c.nombre); }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ADD NEW CATEGORY PANEL */}
              <div className="border-t border-slate-100 pt-5 space-y-5">
                {/* 1. SECCIÓN DE AGREGADO RÁPIDO */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                    {selectedLanguage === 'ES' ? '1. Recomendadas (Un toque para Agregar)' : '1. Suggested (One tap to Add)'}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    {selectedLanguage === 'ES' ? 'Toca cualquier categoría para agregarla instantáneamente:' : 'Tap any category to instantly add it to your list:'}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'Home', label: '\u{1F3E0} Vivienda', name: 'Vivienda' },
                      { key: 'Utensils', label: '\u{1F374} Comida', name: 'Alimentación' },
                      { key: 'Car', label: '\u{1F697} Auto', name: 'Transporte' },
                      { key: 'ShoppingBag', label: '\u{1F6CD}\u{FE0F} Compras', name: 'Compras' },
                      { key: 'Plane', label: '\u{2708}\u{FE0F} Viajes', name: 'Viajes' },
                      { key: 'Sparkles', label: '\u{2728} Especial', name: 'Cuidado Personal y Entretenimiento' },
                      { key: 'Heart', label: '\u{2764}\u{FE0F} Mascota', name: 'Mascotas' },
                      { key: 'Scissors', label: '\u{2702}\u{FE0F} Moda', name: 'Moda y Estilo' }
                    ].map((iconData) => {
                      const yaExiste = categorias.some(
                        c => c.nombre.toLowerCase() === iconData.name.toLowerCase()
                      );
                      return (
                        <button
                          key={iconData.key}
                          type="button"
                          onClick={() => {
                            if (!yaExiste) {
                              handleQuickAddCategory(iconData.name, iconData.key);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                            yaExiste
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-700 font-extrabold cursor-default opacity-85'
                              : 'border-slate-150 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 active:scale-95 shadow-3xs'
                          }`}
                        >
                          <span className="text-base shrink-0 mb-1">
                            {iconData.label.split(' ')[0]}
                          </span>
                          <span className="text-[9px] leading-tight font-extrabold tracking-tight block text-center truncate w-full">
                            {iconData.name}
                          </span>
                          {yaExiste && (
                            <span className="text-[8px] bg-emerald-500 text-white rounded-full px-1.5 py-0.2 mt-1 scale-90">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. SECCIÓN DE CREACIÓN PERSONALIZADA */}
                <div className="border-t border-dashed border-slate-150 pt-4 space-y-3.5">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {selectedLanguage === 'ES' ? '2. O crea una Personalizada' : '2. Or Create Custom Category'}
                  </h4>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                      {selectedLanguage === 'ES' ? 'Nombre de Categoría' : 'Category Name'}
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      maxLength={20}
                      placeholder={selectedLanguage === 'ES' ? 'Ej: Cumpleaños, Suscripciones...' : 'Ej: Birthday, Subscriptions...'}
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* SELECT ICON FOR CUSTOM CATEGORY */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                      {selectedLanguage === 'ES' ? 'Icono de Categoría' : 'Category Icon'}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { key: 'Sparkles', label: '✨' },
                        { key: 'Heart', label: '❤️' },
                        { key: 'ShoppingBag', label: '🛍️' },
                        { key: 'Utensils', label: '🍴' },
                        { key: 'Car', label: '🚗' },
                        { key: 'Home', label: '🏠' },
                        { key: 'Plane', label: '✈️' },
                        { key: 'Scissors', label: '✂️' }
                      ].map((iconData) => {
                        const isSelected = newCatIcon === iconData.key;
                        return (
                          <button
                            key={iconData.key}
                            type="button"
                            onClick={() => {
                              handleTap();
                              setNewCatIcon(iconData.key);
                              setIconManuallySet(true);
                            }}
                            className={`p-2 rounded-xl border text-base font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                              isSelected
                                ? 'border-[#312E81] bg-indigo-50 leading-none shadow-3xs ring-2 ring-[#312E81]/30 scale-102'
                                : 'border-slate-150 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <span>{iconData.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* COLOR CHOOSER */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                      {selectedLanguage === 'ES' ? 'Color de Categoría' : 'Category Color'}
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {[
                        '#8B5A2B', // Brown
                        '#F97316', // Orange
                        '#EF4444', // Red
                        '#EC4899', // Pink
                        '#3B82F6', // Blue
                        '#10B981', // Emerald
                        '#F43F5E', // Rose
                        '#9333EA', // Purple
                        '#14B8A6', // Teal
                        '#EAB308', // Yellow
                        '#6366F1'  // Indigo
                      ].map((col) => {
                        const isSel = newCatColor === col;
                        return (
                          <button
                            key={col}
                            type="button"
                            onClick={() => { handleTap(); setNewCatColor(col); }}
                            className={`w-6 h-6 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                              isSel ? 'ring-2 ring-indigo-650 scale-110 shadow-3xs border-white' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: col }}
                          >
                            {isSel && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CONFIRM ADD BUTTON */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddCategory();
                    }}
                    className="w-full py-3 bg-gradient-to-r from-teal-600 to-[#312E81] text-white font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-95 shadow-lg active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{selectedLanguage === 'ES' ? 'Confirmar Nueva Categoría' : 'Confirm New Category'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {isAddingOpen && (
          <>
            {/* Backdrop Overlay slider block */}
            <motion.div
              id="sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingOpen(false)}
              className="absolute inset-0 bg-black/60 z-40 backdrop-blur-[2px]"
            />

            {/* iOS Bottom Sheet Sheet core */}
            <motion.div
              id="movement-popup-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="absolute bottom-0 inset-x-0 bg-white rounded-t-[30px] z-50 p-6 shadow-2xl flex flex-col border-t border-slate-100 max-h-[92%] overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[17px] font-black text-slate-900 tracking-tight">Nuevo Movimiento</h3>
                <button
                  id="btn-sheet-close"
                  onClick={() => setIsAddingOpen(false)}
                  className="p-1.5 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {popupInitialChoice === 'choice' ? (
                <div className="space-y-6 pt-2 pb-4 text-center">
                  <p className="text-xs font-semibold text-gray-500">¿Cómo deseas registrar tu nuevo movimiento?</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Manual Form Choice */}
                    <button
                      id="btn-choice-write"
                      type="button"
                      onClick={() => {
                        handleTap();
                        setPopupInitialChoice('form');
                      }}
                      className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100 flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 duration-200"
                    >
                      <div className="p-3 bg-slate-900 text-white rounded-full mb-3 shadow-md">
                        <Sparkles className="w-6 h-6 text-indigo-400" />
                      </div>
                      <span className="text-xs font-extrabold text-slate-800">Escribir Manual</span>
                      <span className="text-[9px] text-gray-400 mt-1 block h-8 leading-relaxed">
                        Ingresa montos y detalles con el teclado
                      </span>
                    </button>

                    {/* Dictation Choice */}
                    <button
                      id="btn-choice-voice"
                      type="button"
                      onClick={() => {
                        handleTap();
                        setPopupInitialChoice('form');
                        setTimeout(() => {
                          setStartVoiceOnAdd(true);
                        }, 250);
                      }}
                      className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50 flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 duration-200"
                    >
                      <div className="p-3 bg-indigo-600 text-white rounded-full mb-3 shadow-[0_4px_10px_rgba(79,70,229,0.25)]">
                        <Mic className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-extrabold text-slate-800">Dictar por Voz</span>
                      <span className="text-[9px] text-gray-400 mt-1 block h-8 leading-relaxed">
                        Habla y captura automáticamente el monto y categoría
                      </span>
                    </button>

                    {/* Subscription Quick Option */}
                    <button
                      id="btn-choice-subscription"
                      type="button"
                      onClick={() => {
                        handleTap();
                        setIsAddingOpen(false);
                        setActiveTab('suscripciones');
                        setAutoOpenSubModal(true);
                      }}
                      className="col-span-2 p-4 rounded-2xl border border-indigo-100 bg-indigo-50/10 hover:bg-indigo-50/30 flex flex-row items-center justify-center gap-3.5 text-center cursor-pointer transition-all active:scale-[0.99] duration-200"
                    >
                      <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shrink-0">
                        <Repeat className="w-5 h-5 text-teal-300" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-black text-indigo-900">
                          {selectedLanguage === 'ES' ? 'Agregar Nueva Suscripción' : 'Add New Subscription'}
                        </span>
                        <span className="text-[10px] text-gray-500 mt-0.5 leading-relaxed font-semibold">
                          {selectedLanguage === 'ES' 
                            ? 'Controla plataformas (Netflix, Claude, iCloud) con conversión instantánea de monedas.' 
                            : 'Manage subscriptions with dynamic currency and exchange rates.'}
                        </span>
                      </div>
                    </button>
                    
                    {/* Document Upload Choice */}
                    <input 
                      type="file" 
                      multiple
                      accept="video/*,image/*,application/pdf,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.mp4,.mov"
                      style={{ display: 'none' }}
                      id="file-upload-input"
                      onChange={handleDocumentUpload}
                    />
                    <button
                      id="btn-choice-document"
                      type="button"
                      disabled={isUploadingDocument}
                      onClick={() => {
                        handleTap();
                        document.getElementById('file-upload-input')?.click();
                      }}
                      className="col-span-2 p-5 rounded-2xl border border-emerald-100 bg-emerald-50/20 hover:bg-emerald-50 flex flex-row items-center justify-center gap-4 text-center cursor-pointer transition-all active:scale-95 duration-200"
                    >
                      <div className="p-3 bg-emerald-600 text-white rounded-full shadow-[0_4px_10px_rgba(16,185,129,0.25)] shrink-0">
                        {isUploadingDocument ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-extrabold text-slate-800">
                          {selectedLanguage === 'ES' ? 'Cargar Documento o Video (PDF, Excel, Foto, Video)' : 'Upload Document or Video (PDF, Excel, Photo, Video)'}
                        </span>
                        <span className="text-[9px] text-gray-400 mt-1 leading-relaxed">
                          {selectedLanguage === 'ES' 
                            ? 'La IA extraerá transacciones y detalles de cualquier archivo o video automáticamente.' 
                            : 'The AI will extract transactions and details from any document or video automatically.'}
                        </span>
                      </div>
                    </button>
                    
                    {/* Sheets Upload Choice */}
                    <button
                      id="btn-choice-sheets"
                      type="button"
                      disabled={isImportingSheets}
                      onClick={() => {
                        handleTap();
                        importFromSheets();
                      }}
                      className="col-span-2 p-5 rounded-2xl border border-blue-100 bg-blue-50/20 hover:bg-blue-50 flex flex-row items-center justify-center gap-4 text-center cursor-pointer transition-all active:scale-95 duration-200 mt-[-10px]"
                    >
                      <div className="p-3 bg-blue-600 text-white rounded-full shadow-[0_4px_10px_rgba(37,99,235,0.25)] shrink-0">
                        {isImportingSheets ? <Loader2 className="w-6 h-6 animate-spin" /> : <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>}
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-extrabold text-slate-800">Conectar Google Sheets</span>
                        <span className="text-[9px] text-gray-400 mt-1 leading-relaxed">
                          La IA extraerá y analizará el movimiento desde tu hoja de cálculo.
                        </span>
                      </div>
                    </button>
                  </div>

                  <button
                    id="btn-choice-cancel"
                    type="button"
                    onClick={() => setIsAddingOpen(false)}
                    className="w-full py-2.5 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-150 rounded-xl cursor-pointer mt-2"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                              <TransactionForm
                startWithVoice={startVoiceOnAdd}
                initialTransaction={initialTransactionForModal || (prefilledCategory ? { id: '', tipo: 'Gasto', monto: 0, categoria: prefilledCategory, descripcion: '', formaPago: '', fecha: formatLocalYYYYMMDD(new Date()) } : undefined)}
                onSave={(tx) => {
                  const paisMoneda = effectiveCountry === 'CL' ? 'CLP' : 'COP';
                  const txConPais = { ...tx, paisMoneda };
                  const txToSave: Transaccion[] = [];
                  if (txConPais.cuotasTotal && txConPais.cuotasTotal > 1 && txConPais.esAutomatica) {
                    const montoParaCuota = txConPais.monto / txConPais.cuotasTotal;
                    const dateParts = txConPais.fecha.split('-');
                    const year = dateParts[0];
                    const month = dateParts[1];
                    const day = dateParts[2];
                    
                    const timestampId = Date.now();
                    for (let i = 1; i <= txConPais.cuotasTotal; i++) {
                      const futureDate = new Date(
                        parseInt(year),
                        parseInt(month) - 1 + i - 1,
                        parseInt(day)
                      );
                      txToSave.push({
                        ...txConPais,
                        id: `cuota-${timestampId}-${i}`,
                        fecha: futureDate.toISOString().substring(0, 10),
                        cuotaActual: i,
                        monto: montoParaCuota,
                        montoOriginal: montoParaCuota,
                        idCuotaPrincipal: `cuota-${timestampId}`
                      });
                    }
                  } else {
                    txToSave.push({
                      ...txConPais,
                      id: `trx-${Date.now()}`
                    });
                  }

                  saveTransacciones([
                    ...txToSave,
                    ...transacciones
                  ]);
                  setIsAddingOpen(false);
                  setPrefilledCategory(null);
                  setInitialTransactionForModal(null);
                }}
                onCancel={() => { setIsAddingOpen(false); setStartVoiceOnAdd(false); setPrefilledCategory(null); setInitialTransactionForModal(null); }}
                getMergedPaymentMethods={getMergedPaymentMethods}
                CATEGORIAS_PREDEFINIDAS={CATEGORIAS_PREDEFINIDAS}
                categorias={categorias}
                COLOMBIAN_PRODUCTS={COLOMBIAN_PRODUCTS}
                translateProduct={translateProduct}
                selectedLanguage={selectedLanguage}
                renderCategoriaIcon={renderCategoriaIcon}
                triggerDynamicIsland={triggerDynamicIsland}
                playTone={playTone}
                isMuted={isMuted}
                formatLocalYYYYMMDD={formatLocalYYYYMMDD}
              />
            )}
          </motion.div>
          </>
        )}

        {editingTransaction && (
          <>
            {/* Backdrop Overlay slider block */}
            <motion.div
              id="edit-sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTransaction(null)}
              className="absolute inset-0 bg-black/60 z-45 backdrop-blur-[2px]"
            />

            {/* iOS Bottom Sheet Sheet core */}
            <motion.div
              id="edit-movement-popup-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="absolute bottom-0 inset-x-0 bg-white rounded-t-[30px] z-50 p-6 shadow-2xl flex flex-col border-t border-slate-100 max-h-[92%] overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 animate-pulse" />

              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-[17px] font-black text-slate-900 tracking-tight">
                  {selectedLanguage === 'ES' ? 'Modificar Movimiento' : 'Modify Transaction'}
                </h3>
                <button
                  id="btn-edit-sheet-close"
                  onClick={() => setEditingTransaction(null)}
                  className="p-1.5 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <TransactionForm
                key={editingTransaction.id}
                initialTransaction={editingTransaction}
                onSave={(updatedTx) => {
                  const updated: Transaccion = {
                    ...editingTransaction,
                    ...updatedTx,
                    paisMoneda: editingTransaction.paisMoneda || (effectiveCountry === 'CL' ? 'CLP' : 'COP')
                  };
                  const updatedList = transacciones.map(t => t.id === editingTransaction.id ? updated : t);
                  saveTransacciones(updatedList);
                  setEditingTransaction(null);
                  playTone('success', isMuted);
                  triggerDynamicIsland(
                    selectedLanguage === 'ES' ? "Modificado con éxito" : "Modified successfully",
                    selectedLanguage === 'ES' ? "Movimiento de caja actualizado." : "Cashflow registry updated.",
                    true
                  );
                }}
                onCancel={() => setEditingTransaction(null)}
                getMergedPaymentMethods={getMergedPaymentMethods}
                CATEGORIAS_PREDEFINIDAS={CATEGORIAS_PREDEFINIDAS}
                categorias={categorias}
                COLOMBIAN_PRODUCTS={COLOMBIAN_PRODUCTS}
                translateProduct={translateProduct}
                selectedLanguage={selectedLanguage}
                renderCategoriaIcon={renderCategoriaIcon}
                triggerDynamicIsland={triggerDynamicIsland}
                playTone={playTone}
                isMuted={isMuted}
                formatLocalYYYYMMDD={formatLocalYYYYMMDD}
              />
            </motion.div>
          </>
        )}

        {quickAddOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ bgOpacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                handleTap();
                setQuickAddOpen(false);
              }}
              className="absolute inset-0 bg-slate-950 backdrop-blur-xs z-45"
            />

            {/* iOS Bottom Sheet core for Quick Category Expense */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="absolute bottom-0 inset-x-0 bg-white rounded-t-[30px] z-50 p-6 shadow-2xl flex flex-col border-t border-slate-100 max-h-[92%] overflow-hidden text-left"
            >
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 animate-pulse" />

              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#00897B] block">Gasto Rápido</span>
                  <h3 className="text-[16px] font-black text-slate-900 tracking-tight">
                    Registrar en {translateCategory(quickAddCategory)}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    handleTap();
                    setQuickAddOpen(false);
                  }}
                  className="p-1.5 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const valueFloat = parseFloat(quickAddMonto);
                  if (isNaN(valueFloat) || valueFloat <= 0) {
                    triggerDynamicIsland("Error", "Monto inválido", false);
                    return;
                  }

                  const newTx = {
                    tipo: 'Gasto' as const,
                    monto: valueFloat,
                    categoria: quickAddCategory,
                    descripcion: quickAddDescripcion.trim() || `Gasto en ${quickAddCategory}`,
                    formaPago: quickAddFormaPago,
                    fecha: quickAddFecha || new Date().toISOString().substring(0, 10)
                  };

                  saveTransacciones([
                    { ...newTx, id: `trx-${Date.now()}` },
                    ...transacciones
                  ]);

                  setQuickAddOpen(false);
                  playTone('success', isMuted);
                  triggerDynamicIsland("Gasto Registrado", `Monto: $${valueFloat.toLocaleString()}`, true);
                }}
                className="space-y-4 pt-1 pb-4"
              >
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1 block">Monto total ($)</label>
                  <div className="relative flex items-center col">
                    <div className="absolute left-4 top-0 bottom-0 flex items-center justify-center pointer-events-none">
                      <span className="font-black text-lg text-slate-400">$</span>
                    </div>
                    <input
                      type="number"
                      required
                      placeholder="0"
                      value={quickAddMonto}
                      onChange={(e) => setQuickAddMonto(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-9 pr-4 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00897B]/30 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1 block">Descripción (Opcional)</label>
                  <input
                    type="text"
                    maxLength={40}
                    placeholder={`Ej: Compra rápida en ${quickAddCategory}`}
                    value={quickAddDescripcion}
                    onChange={(e) => setQuickAddDescripcion(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/30 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1 block">Forma de pago</label>
                  <select
                    value={quickAddFormaPago}
                    onChange={(e) => { handleTap(); setQuickAddFormaPago(e.target.value); }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00897B]/30 focus:bg-white cursor-pointer"
                  >
                    {getMergedPaymentMethods().map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1 block">Fecha del Movimiento</label>
                  <input
                    type="date"
                    value={quickAddFecha}
                    onChange={(e) => { handleTap(); setQuickAddFecha(e.target.value); }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00897B]/30 focus:bg-white"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      handleTap();
                      setQuickAddOpen(false);
                    }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs transition duration-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#00897B] hover:bg-[#00796B] text-white font-extrabold rounded-xl text-xs shadow-md transition duration-200 cursor-pointer text-center"
                  >
                    Registrar Gasto
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}

        {editingPortafolio && (
          <>
            <motion.div
              id="edit-portafolio-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPortafolio(null)}
              className="absolute inset-0 bg-black/60 z-45 backdrop-blur-[2px]"
            />
            <motion.div
              id="edit-portafolio-popup-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="absolute bottom-0 inset-x-0 bg-white rounded-t-[30px] z-50 p-6 shadow-2xl flex flex-col border-t border-slate-100 max-h-[92%] overflow-hidden"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  {selectedLanguage === 'ES' ? 'Editar Activo' : 'Edit Asset'}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingPortafolio(null)}
                  className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditedPortafolio} className="flex-1 flex flex-col overflow-hidden min-h-0 text-left space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{selectedLanguage === 'ES' ? 'Nombre del activo' : 'Asset Name'}</label>
                  <input type="text" value={editPortafolioNombre} onChange={e => setEditPortafolioNombre(e.target.value)} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 transition" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{selectedLanguage === 'ES' ? 'Valor' : 'Value'}</label>
                  <input type="text" inputMode="numeric" value={editPortafolioValor} onChange={e => setEditPortafolioValor(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 transition" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{selectedLanguage === 'ES' ? 'Plataforma / Banco' : 'Platform / Bank'}</label>
                  <input type="text" value={editPortafolioPlataforma} onChange={e => setEditPortafolioPlataforma(e.target.value)} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]/20 transition" required />
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-slate-100 bg-white mt-auto">
                  <button
                    type="button"
                    onClick={() => setEditingPortafolio(null)}
                    className="flex-1 py-3 text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-250 rounded-xl cursor-pointer text-center border border-slate-200"
                  >
                    {selectedLanguage === 'ES' ? 'Cancelar' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 text-xs font-black text-white bg-[#00897B] hover:bg-[#00796B] shadow-md shadow-teal-150 rounded-xl cursor-pointer text-center"
                  >
                    {selectedLanguage === 'ES' ? 'Guardar' : 'Save'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

  
  const handleBannerSignIn = async () => {
    const isIframe = window.self !== window.top;
    const isSandboxEnv = window.location.hostname.includes('run.app') || 
                         window.location.hostname.includes('localhost') || 
                         window.location.hostname.includes('webcontainer') ||
                         window.location.hostname.includes('aistudio') ||
                         isIframe;

    // In preview sandbox/iframes or run.app where Safari private mode blocks popups entirely,
    // intercept the click directly and show our beautiful guide or fake Google account chooser.
    if (isSandboxEnv) {
      setShowAuthGuide(true);
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (popupError: any) {
      console.warn('Popup blocked, opening guide helper:', popupError);
      setShowAuthGuide(true);
    }
  };

  return (
    <div className="h-[100dvh] bg-[#0d0e14] flex flex-col justify-center items-center font-sans antialiased overflow-hidden">
      
      {/* Main Core Viewport Wrapper - Native feeling on mobile, clean preview on desktop screens */}
      <div className="w-full max-w-md h-[100dvh] md:min-h-0 md:h-[840px] md:max-h-[92vh] bg-[#f4f5f9] md:rounded-[40px] overflow-hidden shadow-2xl relative md:border md:border-slate-800/60 flex flex-col">
        
        {isLocalMode === true && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 relative z-50 shadow-sm">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 mt-0.5">⚠️</span>
              <p className="text-[11px] text-yellow-800 font-medium leading-snug">
                FinDream está guardando datos localmente en tu dispositivo. <strong className="font-bold font-sans">Inicia sesión</strong> para habilitar el guardado automático de la nube.
                <button
                  type="button"
                  onClick={() => setShowAuthGuide(true)}
                  className="block text-[10px] text-yellow-700 underline mt-1 font-bold hover:text-yellow-900 cursor-pointer text-left"
                >
                  ¿No puedes iniciar sesión? Ver guía de ayuda
                </button>
              </p>
            </div>
            <button
              onClick={handleBannerSignIn}
              className="w-full sm:w-auto px-4 py-1.5 bg-yellow-600 hover:bg-yellow-700 active:scale-95 transition-all rounded-lg text-[11px] font-black tracking-wide text-white shadow-sm whitespace-nowrap uppercase cursor-pointer"
            >
              Iniciar sesión Google
            </button>
          </div>
        )}
        {renderAppContent()}
      </div>

      {/* --- PREMIUM CUSTOM iOS CONFIRMATION DIALOG (Guarantees iframe safety!) --- */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              className="fixed inset-0 bg-black/60 z-[999] backdrop-blur-[2px] flex items-center justify-center p-4"
            >
              {/* Alert Card */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white/95 backdrop-blur-md rounded-2xl max-w-[270px] w-full text-center shadow-2xl border border-gray-150 overflow-hidden"
              >
                <div className="p-5">
                  <h4 className="text-[16px] font-extrabold text-slate-900 leading-tight">
                    {confirmDialog.title}
                  </h4>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    {confirmDialog.message}
                  </p>
                </div>

                {/* Segmented iOS actions */}
                <div className="border-t border-gray-100 grid grid-cols-2">
                  <button
                    type="button"
                    onClick={() => { handleTap(); setConfirmDialog(prev => ({ ...prev, isOpen: false })); }}
                    className="py-3 px-4 text-sm font-semibold text-indigo-600 hover:bg-gray-50 active:bg-gray-100 border-r border-gray-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleTap(); confirmDialog.onConfirm(); }}
                    className="py-3 px-4 text-sm font-bold text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors cursor-pointer"
                  >
                    Confirmar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- GUIDE MODAL FOR AUTH ISSUES (Bypasses Safari/iframe blocks) --- */}
      <AnimatePresence>
        {showAuthGuide && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthGuide(false)}
              className="fixed inset-0 bg-black/75 z-[9999] backdrop-blur-[4px] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#12131a] border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-slate-200 relative shadow-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🔑</span>
                    <h3 className="text-[15px] font-bold text-white tracking-wide">
                      Guía del Inicio de Sesión
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAuthGuide(false)}
                    className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Body Content */}
                <div className="space-y-4 text-xs leading-relaxed text-slate-300">
                  <p>
                    Para activar el almacenamiento en la nube, Google requiere validar tu cuenta. Por restricciones de seguridad del navegador, el login de Firebase se bloquea en marcos externos y navegación privada, mostrando una <strong>pantalla en blanco</strong>.
                  </p>

                  {/* Step 1 */}
                  <div className="flex gap-2.5 items-start bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/65">
                    <span className="text-base mt-0.5">↗️</span>
                    <div>
                      <strong className="text-white block text-[11px] mb-0.5">1. Abre la App en Pestaña Nueva</strong>
                      <p className="text-[10px] text-slate-400">
                        Los iframes de AI Studio bloquean pantallas de login. Utiliza el botón de <strong>"Abrir en pestaña nueva ↗️"</strong> del panel superior derecho en AI Studio.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-2.5 items-start bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/65">
                    <span className="text-base mt-0.5">🕵️</span>
                    <div>
                      <strong className="text-white block text-[11px] mb-0.5">2. Desactiva Navegación Privada</strong>
                      <p className="text-[10px] text-slate-400">
                        El modo privado de Safari/Chrome bloquea las cookies de sesión temporal de Google. Usa una pestaña normal.
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Public Link */}
                  <div className="bg-gradient-to-br from-indigo-950/30 to-indigo-900/10 p-3 rounded-xl border border-indigo-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase">Link Público Oficial</span>
                      <span className="text-[9px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded-full font-semibold">Listo</span>
                    </div>
                    <div className="bg-black/30 p-2 rounded-lg border border-slate-800/60 text-[10px] font-mono select-all overflow-hidden break-all text-slate-300">
                      https://ais-pre-c7jzxend6cu3dx4cxlrbta-285412608330.us-east1.run.app
                    </div>

                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText("https://ais-pre-c7jzxend6cu3dx4cxlrbta-285412608330.us-east1.run.app");
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        } catch (e) {
                          alert("Copia el link de arriba de manera manual de la casilla.");
                        }
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all text-white font-bold rounded-lg text-[11px] tracking-wide shadow-sm cursor-pointer"
                    >
                      {copiedLink ? '¡Enlace Copiado! ✓' : 'Copiar Enlace'}
                    </button>
                  </div>
                </div>

                {/* Try redirect fallback */}
                <div className="mt-4 pt-3 border-t border-slate-850 flex flex-col gap-2">
                  <p className="text-[10px] text-slate-400 text-center leading-normal">
                    ¿Problemas con el modo privado y la pantalla de carga?
                  </p>

                  <button
                    onClick={async () => {
                      const provider = new GoogleAuthProvider();
                      try {
                        await signInWithRedirect(auth, provider);
                      } catch (e) {
                        alert("Error al intentar redirección: " + String(e));
                      }
                    }}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-755 text-slate-400 hover:text-white rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    Intentar redirección de Google
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- MI CUENTA MODAL & COLOMBIAN BANK PRODUCTS --- */}
      <ProfileModal
        isCuentaOpen={isCuentaOpen}
        setIsCuentaOpen={setIsCuentaOpen}
        userProfile={userProfile}
        saveUserProfileData={saveUserProfileData}
        isBiometricRegistered={isBiometricRegistered}
        setIsBiometricRegistered={setIsBiometricRegistered}
        isEnrollingBiometrics={isEnrollingBiometrics}
        setIsEnrollingBiometrics={setIsEnrollingBiometrics}
        biometricEnrollMsg={biometricEnrollMsg}
        setBiometricEnrollMsg={setBiometricEnrollMsg}
        selectedLanguage={selectedLanguage}
        handleTap={handleTap}
        showAddProductSettings={showAddProductSettings}
        setShowAddProductSettings={setShowAddProductSettings}
        isMuted={isMuted}
        playTone={playTone}
        triggerDynamicIsland={triggerDynamicIsland}
        getProductUtilizado={getProductUtilizado}
        setActiveTab={setActiveTab}
        setShowSplash={setShowSplash}
        selectedCountry={effectiveCountry}
      />

      <AnimatePresence>
        {showSplash && (
          <SplashIntro
            onComplete={() => setShowSplash(false)}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            selectedLanguage={selectedLanguage}
          />
        )}
      </AnimatePresence>

      {pdfPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-xl flex flex-col gap-4 text-center">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              🔒 PDF Protegido
            </h3>
            <p className="text-xs font-semibold text-slate-400">
              Escribe la contraseña para desbloquear el archivo y poder leerlo.
            </p>
            <input
              type="password"
              value={pdfPasswordInput}
              onChange={(e) => setPdfPasswordInput(e.target.value)}
              placeholder="Contraseña del PDF"
              className="w-full text-center py-2.5 px-3 border border-slate-200 rounded-2xl bg-slate-50 text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00897B]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPdfPasswordModalOpen(false);
                  if (pdfPasswordReject) pdfPasswordReject(new Error('User cancelled password prompt'));
                }}
                className="flex-1 py-3 bg-slate-100 text-slate-600 text-xs font-black rounded-2xl hover:bg-slate-150 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setPdfPasswordModalOpen(false);
                  if (pdfPasswordResolve) pdfPasswordResolve(pdfPasswordInput);
                }}
                className="flex-1 py-3 bg-[#00897B] text-white text-xs font-black rounded-2xl hover:bg-[#00796B] transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCountrySelector && (
        <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6'>
          <div className='bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center'>
            <p className='text-3xl mb-2'>🗺️</p>
            <h2 className='text-lg font-black text-slate-900 mb-1'>
              {selectedLanguage === 'ES' ? '¿A qué país quieres ir?' : 'Which country?'}
            </h2>
            <p className='text-xs text-slate-500 mb-5'>
              {selectedLanguage === 'ES'
                ? 'Tienes datos en más de un país'
                : 'You have data in more than one country'}
            </p>
            <div className='flex flex-col gap-3'>
              {(availableCountries || []).map(country => (
                <button key={country}
                  onClick={() => {
                    setSelectedCountry(country);
                    setShowCountrySelector(false);
                  }}
                  className='w-full py-4 rounded-2xl font-bold text-sm flex items-center gap-4 px-5 bg-slate-50 hover:bg-teal-50 border-2 border-slate-200 hover:border-teal-400 transition-all active:scale-95 text-left'
                >
                  <span className='text-3xl leading-none'>
                    {country === 'CO' ? '🇨🇴' : '🇨🇱'}
                  </span>
                  <span className='text-slate-900 text-base font-black'>
                    {country === 'CO' ? 'Colombia (COP)' : 'Chile (CLP)'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showMixedImportModal && mixedImportState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-base font-black text-slate-800 tracking-tight leading-snug">
                {selectedLanguage === 'ES' ? 'Importación mixta detectada' : 'Mixed import detected'}
              </h3>
              <button 
                onClick={() => { setShowMixedImportModal(false); setMixedImportState(null); }} 
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-50"
              >
                <span className="text-lg font-bold">✕</span>
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {selectedLanguage === 'ES'
                ? `Detectamos ${mixedImportState.totalNuevos} movimientos nuevos y ${mixedImportState.totalDuplicados} repetidos en tu historial.`
                : `We found ${mixedImportState.totalNuevos} new transactions and ${mixedImportState.totalDuplicados} duplicate transactions.`}
            </p>
            
            <div className="bg-blue-50/50 border border-blue-100/30 rounded-2xl p-3 mb-4 text-left">
              <p className="text-xs text-blue-700 font-semibold leading-relaxed">
                {selectedLanguage === 'ES'
                  ? `✓ Los ${mixedImportState.totalNuevos} nuevos se agregarán automáticamente.`
                  : `✓ The ${mixedImportState.totalNuevos} new ones will be added automatically.`}
              </p>
            </div>
            
            <div className="flex flex-col gap-2 font-sans">
              <button
                onClick={handleMixedImportAddAll}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs shadow-md shadow-teal-100 transition active:scale-98 hover:shadow-lg cursor-pointer text-center"
              >
                {selectedLanguage === 'ES' ? 'Agregar todos' : 'Add all'}
              </button>
              
              <button
                onClick={handleMixedImportReviewDuplicates}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-md shadow-indigo-100 transition active:scale-98 hover:shadow-lg cursor-pointer text-center"
              >
                {selectedLanguage === 'ES' ? 'Revisar duplicados' : 'Review duplicates'}
              </button>

              <button
                onClick={handleMixedImportOnlyNew}
                className="w-full py-3 px-4 bg-white border border-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-2xl font-bold text-xs transition active:scale-98 cursor-pointer text-center"
              >
                {selectedLanguage === 'ES' ? 'Solo nuevos' : 'Only new'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicatesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-base font-black text-slate-800 tracking-tight leading-snug">
                {selectedLanguage === 'ES' 
                  ? `Tienes ${duplicatesPending.length} ${duplicatesPending.length === 1 ? 'gasto duplicado' : 'gastos duplicados'}`
                  : `You have ${duplicatesPending.length} duplicate ${duplicatesPending.length === 1 ? 'expense' : 'expenses'}`}
              </h3>
              <button 
                onClick={handleDiscardDuplicates}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-50"
              >
                <span className="text-lg font-bold">✕</span>
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {selectedLanguage === 'ES'
                ? "Detectamos gastos que parecen ya registrados en tu historial. Elige qué acción tomar."
                : "We detected transactions that seem to already exist in your history. Choose an action."}
            </p>

            {isReviewingDetail ? (
              <div className="flex-1 flex flex-col min-h-0 space-y-3 font-sans">
                <div className="flex items-center justify-between py-1 px-1 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={handleToggleSelectAllDuplicates}
                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <span>
                      {selectedDuplicateIds.length === duplicatesPending.length
                        ? (selectedLanguage === 'ES' ? 'Desmarcar todos' : 'Unselect all')
                        : (selectedLanguage === 'ES' ? 'Seleccionar todos' : 'Select all')}
                    </span>
                  </button>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {selectedLanguage === 'ES' 
                      ? `${selectedDuplicateIds.length} seleccionados`
                      : `${selectedDuplicateIds.length} selected`}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 max-h-[40vh] pr-1 scrollbar-thin">
                  {duplicatesPending.map((dup) => {
                    const isChecked = selectedDuplicateIds.includes(dup.id);
                    return (
                      <div 
                        key={dup.id} 
                        onClick={() => handleToggleSelectDuplicate(dup.id)}
                        className={`flex items-start gap-3 p-3 rounded-2xl border transition duration-150 cursor-pointer ${
                          isChecked 
                            ? 'border-indigo-200 bg-indigo-50/20 shadow-xs' 
                            : 'border-slate-100 hover:border-slate-200 bg-slate-50/40'
                        }`}
                      >
                        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectDuplicate(dup.id)}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded-sm focus:ring-indigo-500 cursor-pointer"
                          />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[11.5px] font-bold text-slate-800 truncate">
                            {dup.descripcion}
                          </p>
                          <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-semibold uppercase mt-0.5">
                            <span>{dup.categoria}</span>
                            <span>•</span>
                            <span>{dup.fecha}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-black ${
                            dup.tipo === 'Ingreso' ? 'text-teal-600' : 'text-slate-800'
                          }`}>
                            {dup.tipo === 'Ingreso' ? '+' : '-'}${dup.monto.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setIsReviewingDetail(false)}
                    className="flex-1 py-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition active:scale-98 cursor-pointer animate-none"
                  >
                    {selectedLanguage === 'ES' ? 'Regresar' : 'Go Back'}
                  </button>
                  <button
                    onClick={handleAddSelectedDuplicates}
                    disabled={selectedDuplicateIds.length === 0}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-indigo-100 transition active:scale-98 cursor-pointer"
                  >
                    {selectedLanguage === 'ES' ? 'Agregar seleccionados' : 'Add Selected'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 font-sans">
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleAddAllDuplicates}
                    className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs shadow-md shadow-teal-100 transition active:scale-98 hover:shadow-lg cursor-pointer"
                  >
                    {selectedLanguage === 'ES' ? 'Agregar todos' : 'Add All'}
                  </button>
                  <button
                    onClick={() => setIsReviewingDetail(true)}
                    className="w-full py-3 px-4 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 rounded-2xl font-black text-xs border border-indigo-100/30 transition active:scale-98 cursor-pointer"
                  >
                    {selectedLanguage === 'ES' ? 'Revisar' : 'Review One by One'}
                  </button>
                  <button
                    onClick={handleDiscardDuplicates}
                    className="w-full py-3 px-4 bg-white border border-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-2xl font-bold text-xs transition active:scale-98 cursor-pointer"
                  >
                    {selectedLanguage === 'ES' ? 'No agregar' : 'Do Not Add Any'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
