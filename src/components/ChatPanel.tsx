import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Mic, Sparkles, Loader2, Volume2, VolumeX, ShieldCheck, Paperclip, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage, UserProfile, Transaccion, Sueno } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface ChatPanelProps {
  selectedLanguage: string;
  selectedCountry: string;
  userProfile: UserProfile;
  suenos: Sueno[];
  activeSuenoId: string;
  totalActivos: number;
  totalPasivos: number;
  transacciones: Transaccion[];
  saveTransacciones: (t: Transaccion[]) => void;
  saveUserProfileData: (p: UserProfile) => void;
  saveSuenosList: (s: Sueno[]) => void;
  triggerDynamicIsland: (title: string, msg: string, isPositive: boolean) => void;
  playTone: (type: 'tap' | 'success' | 'delete' | 'voice', isMuted: boolean) => void;
  isMuted: boolean;
  t: (key: any) => string;
  extractPdfText: (file: File, password?: string) => Promise<string>;
  askPdfPassword: (file: File) => Promise<string>;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  categorias: any[];
  getMergedPaymentMethods: () => string[];
  onDuplicatesFound: (dups: Transaccion[]) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  selectedLanguage,
  selectedCountry,
  userProfile,
  suenos,
  activeSuenoId,
  totalActivos,
  totalPasivos,
  transacciones,
  saveTransacciones,
  saveUserProfileData,
  saveSuenosList,
  triggerDynamicIsland,
  playTone,
  isMuted,
  t,
  extractPdfText,
  askPdfPassword,
  chatMessages,
  setChatMessages,
  categorias,
  getMergedPaymentMethods,
  onDuplicatesFound
}) => {
  const [chatInput, setChatInput] = useState('');
  const [pendingActions, setPendingActions] = useState<any[] | null>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isListeningChat, setIsListeningChat] = useState(false);
  const [isImmersiveVoiceMode, setIsImmersiveVoiceMode] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [attachedFileText, setAttachedFileText] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll al ultimo mensaje cuando llega uno nuevo
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end"
      });
    }
  }, [chatMessages, isAIProcessing]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiarMensaje = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  useEffect(() => {
    if (chatMessages.length === 0) {
      const rawGreeting = t('chat_initial_greeting');
      const initialGreeting: ChatMessage = {
        id: 'chat-init-0',
        sender: 'model',
        text: rawGreeting.replace('{userName}', userProfile.nombre?.split(' ')[0] || (selectedLanguage === 'ES' ? 'amigo' : 'friend')),
        timestamp: new Date().toISOString()
      };
      setChatMessages([initialGreeting]);
    }
  }, [selectedLanguage, userProfile.nombre, t]);

  const renderMarkdownMsg = (rawText: string) => {
    const parts = rawText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-black text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const processChatFile = async (file: File) => {
    const isVideo = (file.type && file.type.startsWith('video/')) || 
                    file.name.toLowerCase().endsWith('.mp4') || 
                    file.name.toLowerCase().endsWith('.mov') || 
                    file.name.toLowerCase().endsWith('.avi') || 
                    file.name.toLowerCase().endsWith('.mkv') ||
                    file.name.toLowerCase().endsWith('.3gp');
    if (isVideo) {
      const processingMsg: ChatMessage = {
        id: Date.now().toString(), sender: 'model',
        text: 'Leyendo video... extrayendo fotogramas para analizar.',
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, processingMsg]);
      try {
        const videoUrl = URL.createObjectURL(file);
        const videoEl = document.createElement('video');
        videoEl.src = videoUrl;
        videoEl.muted = true;
        videoEl.playsInline = true;
        await new Promise<void>((resolve, reject) => {
          videoEl.onloadedmetadata = () => resolve();
          videoEl.onerror = () => reject(new Error('No se pudo cargar el video'));
          setTimeout(() => reject(new Error('Timeout')), 10000);
        });
        const duration = videoEl.duration || 10;
        const canvas = document.createElement('canvas');
        canvas.width = 720;
        canvas.height = Math.round(
          720 * (videoEl.videoHeight / (videoEl.videoWidth || 720)));
        const ctx = canvas.getContext('2d')!;
        
        // Capturar 6 frames distribuidos en el video
        const NUM_FRAMES = 6;
        const frames: string[] = [];
        for (let i = 0; i < NUM_FRAMES; i++) {
          const seekTime = (duration / (NUM_FRAMES + 1)) * (i + 1);
          await new Promise<void>((resolve) => {
            videoEl.currentTime = seekTime;
            videoEl.onseeked = () => {
              ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
              const frameBase64 = canvas.toDataURL('image/jpeg', 0.7)
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
        const data = await resp.json();
        const txs = data.transacciones || [];
        if (txs.length > 0) {
          const preview = txs.slice(0, 5)
            .map((t: any) => `- ${t.descripcion}: ${t.monto}`).join('\n');
          const confirmMsg: ChatMessage = {
            id: (Date.now()+1).toString(), sender: 'model',
            text: `Encontre ${txs.length} transacciones en el video:\n`
              + preview + '\n\n\u00bfLas agrego todas?',
            timestamp: new Date().toISOString(),
            videoPendingTransacciones: txs
          };
          setChatMessages(prev =>
            [...prev.filter(m => m.id !== processingMsg.id), confirmMsg]);
        } else {
          setChatMessages(prev => prev.map(m =>
            m.id === processingMsg.id ? { ...m,
              text: 'No encontre transacciones. Intenta grabar mas cerca con buena iluminacion.' } : m));
        }
      } catch (err: any) {
        setChatMessages(prev => prev.map(m =>
          m.id === processingMsg.id ? { ...m,
            text: 'Error procesando el video: ' + (err.message || 'intenta de nuevo.') } : m));
      }
      return;
    }

    setIsProcessingFile(true);
    try {
      let text = '';
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
      } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        text = await file.text();
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        try {
          text = await extractPdfText(file);
        } catch (err: any) {
          if (err?.name === 'PasswordException') {
            const password = await askPdfPassword(file);
            text = await extractPdfText(file, password);
          } else throw err;
        }
      } else if (file.type.startsWith('image/')) {
        text = `[Imagen adjunta: ${file.name}]`;
      }
      setAttachedFileText(text);
      setAttachedFileName(file.name);
    } catch (err) {
      console.error(err);
      triggerDynamicIsland('Error',
        selectedLanguage === 'ES' ? 'No se pudo leer el archivo' : 'Could not read file',
        false);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleChatFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    for (const file of files) {
      await processChatFile(file);
    }
    e.target.value = '';
  };

  const executeDangerousActions = (actionsList: any[]) => {
    if (!actionsList || actionsList.length === 0) return;

    console.log("[ChatPanel] executeDangerousActions iniciada con",
      actionsList.length, "acciones:", JSON.stringify(actionsList));
    console.log("[ChatPanel] Estado actual: transacciones=",
      transacciones.length, "productos=",
      (userProfile.productos || []).length, "suenos=", suenos.length);

    const normalizarMontoLocal = (valor: any): number => {
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
      const lowercase = raw.toLowerCase();

      let multiplier = 1;
      if (lowercase.includes('mill') || lowercase.includes('mm') || (lowercase.includes('m') && !lowercase.includes('mil'))) {
        multiplier = 1000000;
      } else if (lowercase.includes('k') || lowercase.includes('mil')) {
        multiplier = 1000;
      }

      const esNegativo = /^\(.*\)$/.test(raw) || /^-/.test(raw);
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
        if (multiplier > 1) {
          // keep dot as decimal separator
        } else if (parts.length > 2) {
          s = s.replace(/\./g, "");
        } else if (parts[parts.length - 1].length === 3) {
          s = s.replace(/\./g, "");
        }
      } else if (s.includes(",")) {
        const parts = s.split(",");
        if (multiplier > 1) {
          s = s.replace(",", ".");
        } else if (parts.length > 2) {
          s = s.replace(/,/g, "");
        } else if (parts[parts.length - 1].length === 3) {
          s = s.replace(/,/g, "");
        } else {
          s = s.replace(",", ".");
        }
      }
      let n = parseFloat(s);
      if (isNaN(n)) {
        const soloDigitos = raw.replace(/\D/g, "");
        if (soloDigitos) n = parseInt(soloDigitos, 10);
      }
      if (isNaN(n)) return NaN;
      return esNegativo ? -Math.round(n * multiplier) : Math.round(n * multiplier);
    };

    let currentTxList = [...transacciones];
    let currentProfile = { ...userProfile };
    let currentSuenos = [...suenos];
    let txChanged = false;
    let profileChanged = false;
    let suenosChanged = false;

    actionsList.forEach(action => {
      if (action.type === 'deleteTransaction' && action.payload?.id) {
        const idToDelete = String(action.payload.id).trim();
        const found = currentTxList.find(t => String(t.id).trim() === idToDelete);
        console.log("[ChatPanel] deleteTransaction id=", idToDelete, "encontrada=", !!found);
        if (found) {
          currentTxList = currentTxList.filter(t => String(t.id).trim() !== idToDelete);
          txChanged = true;
          triggerDynamicIsland(
            selectedLanguage === 'ES' ? 'Transaccion eliminada' : 'Transaction deleted',
            `${found.descripcion || found.categoria} - $${found.monto.toLocaleString()}`,
            true
          );
        } else {
          console.warn("[ChatPanel] No se encontro transaccion con id=", idToDelete);
        }
      } else if (action.type === 'addTransaction') {
        const p = action.payload;
        let cat = 'Otros';
        if (p.categoria) {
          let matchedCat = categorias.find(c => c.nombre.toLowerCase() === p.categoria.toLowerCase());
          if (!matchedCat) {
            matchedCat = categorias.find(c => p.categoria.toLowerCase().includes(c.nombre.toLowerCase()) || 
                                             c.nombre.toLowerCase().includes(p.categoria.toLowerCase()));
          }
          if (matchedCat) cat = matchedCat.nombre;
        }

        let forma = getMergedPaymentMethods()[0];
        if (p.banco) {
          const pms = getMergedPaymentMethods();
          let matchedPm = pms.find((pm: string) => pm.toLowerCase().includes(p.banco.toLowerCase()) || p.banco.toLowerCase().includes(pm.toLowerCase()));
          if (matchedPm) forma = matchedPm;
        } else if (p.formaPago) {
          const pms = getMergedPaymentMethods();
          let matchedPm = pms.find((pm: string) => pm.toLowerCase().includes(p.formaPago.toLowerCase()) || p.formaPago.toLowerCase().includes(pm.toLowerCase()));
          if (matchedPm) forma = matchedPm;
        }

        // Siempre guardar montos positivos absolutos en transacciones directas
        const finalMonto = Math.abs(normalizarMontoLocal(p.monto)) || 0;

        const tx: Transaccion = {
          id: Math.random().toString(36).substring(2, 9),
          tipo: p.tipo === 'Ingreso' ? 'Ingreso' : 'Gasto',
          monto: finalMonto,
          categoria: cat,
          fecha: p.fecha || new Date().toISOString().split('T')[0],
          descripcion: p.descripcion || (p.tipo === 'Ingreso' ? `Ingreso de ${cat}` : `Gasto en ${cat}`),
          formaPago: forma
        };
        
        currentTxList = [tx, ...currentTxList];
        txChanged = true;
        
        triggerDynamicIsland(
          selectedLanguage === 'ES' ? 'Transaccion agregada' : 'Transaction added',
          `${tx.descripcion} - $${tx.monto.toLocaleString()}`,
          tx.tipo === 'Ingreso'
        );
      } else if (action.type === 'editTransaction' && action.payload?.id) {
        const p = action.payload;
        const idToEdit = String(p.id).trim();
        const found = currentTxList.find(t => String(t.id).trim() === idToEdit);
        console.log("[ChatPanel] editTransaction id=", idToEdit, "encontrada=", !!found);
        if (found) {
          currentTxList = currentTxList.map(t =>
            String(t.id).trim() === idToEdit ? {
              ...t,
              ...(p.tipo && { tipo: p.tipo }),
              ...(p.monto !== undefined && { monto: normalizarMontoLocal(p.monto) || t.monto }),
              ...(p.categoria && { categoria: p.categoria }),
              ...(p.descripcion && { descripcion: p.descripcion }),
            } : t
          );
          txChanged = true;
          triggerDynamicIsland(
            selectedLanguage === 'ES' ? 'Transaccion actualizada' : 'Transaction updated',
            `${p.descripcion || p.categoria || ''}`, true
          );
        } else {
          console.warn("[ChatPanel] No se encontro transaccion para editar con id=", idToEdit);
        }
      } else if (action.type === 'deleteProduct' && action.payload?.id) {
        const idToDelete = String(action.payload.id).trim();
        const found = (currentProfile.productos || []).find(prod => String(prod.id).trim() === idToDelete);
        console.log("[ChatPanel] deleteProduct id=", idToDelete, "encontrada=", !!found);
        if (found) {
          currentProfile.productos = (currentProfile.productos || []).filter(p => String(p.id).trim() !== idToDelete);
          profileChanged = true;
          triggerDynamicIsland(
            selectedLanguage === 'ES' ? 'Producto eliminado' : 'Product deleted',
            `${found.banco} - ${found.tipo}`, true
          );
        } else {
          console.warn("[ChatPanel] No se encontro producto con id=", idToDelete);
        }
      } else if (action.type === 'editProduct' && action.payload?.id) {
        const p = action.payload;
        const idToEdit = String(p.id).trim();
        const found = (currentProfile.productos || []).find(prod => String(prod.id).trim() === idToEdit);
        console.log("[ChatPanel] editProduct id=", idToEdit, "encontrada=", !!found);
        if (found) {
          currentProfile.productos = (currentProfile.productos || []).map(prod =>
            String(prod.id).trim() === idToEdit ? {
              ...prod,
              ...(p.banco !== undefined && { banco: p.banco }),
              ...(p.producto !== undefined && { tipo: p.producto }),
              ...(p.alias !== undefined && { alias: p.alias }),
              ...(p.cupo !== undefined && { montoTotal: p.cupo }),
              ...(p.utilizado !== undefined && { montoUtilizado: p.utilizado })
            } : prod
          );
          profileChanged = true;
          triggerDynamicIsland(
            selectedLanguage === 'ES' ? 'Producto actualizado' : 'Product updated',
            p.banco || p.alias || '', true
          );
        } else {
          console.warn("[ChatPanel] No se encontro producto para editar con id=", idToEdit);
        }
      } else if (action.type === 'deleteSueno' && action.payload?.id) {
        const idToDelete = String(action.payload.id).trim();
        const found = currentSuenos.find(s => String(s.id).trim() === idToDelete);
        console.log("[ChatPanel] deleteSueno id=", idToDelete, "encontrada=", !!found);
        if (found) {
          currentSuenos = currentSuenos.filter(s => String(s.id).trim() !== idToDelete);
          suenosChanged = true;
          triggerDynamicIsland(
            selectedLanguage === 'ES' ? 'Sueño eliminado' : 'Dream deleted',
            found.nombre, true
          );
        } else {
          console.warn("[ChatPanel] No se encontro sueño con id=", idToDelete);
        }
      } else if (action.type === 'editSueno' && action.payload?.id) {
        const p = action.payload;
        const idToEdit = String(p.id).trim();
        const found = currentSuenos.find(s => String(s.id).trim() === idToEdit);
        console.log("[ChatPanel] editSueno id=", idToEdit, "encontrada=", !!found);
        if (found) {
          currentSuenos = currentSuenos.map(s =>
            String(s.id).trim() === idToEdit ? {
              ...s,
              ...(p.nombre !== undefined && { nombre: p.nombre }),
              ...(p.meta !== undefined && { meta: p.meta })
            } : s
          );
          suenosChanged = true;
          triggerDynamicIsland(
            selectedLanguage === 'ES' ? 'Sueño actualizado' : 'Dream updated',
            p.nombre || found.nombre, true
          );
        } else {
          console.warn("[ChatPanel] No se encontro sueño para editar con id=", idToEdit);
        }
      }
    });

    if (txChanged) {
      saveTransacciones(currentTxList);
    }
    if (profileChanged) {
      saveUserProfileData(currentProfile);
    }
    if (suenosChanged) {
      saveSuenosList(currentSuenos);
    }

    console.log("[ChatPanel] Persistencia: txChanged=", txChanged,
      "profileChanged=", profileChanged, "suenosChanged=", suenosChanged);
    console.log("[ChatPanel] Nuevos totales: tx=", currentTxList.length,
      "productos=", (currentProfile.productos || []).length,
      "suenos=", currentSuenos.length);
  };

  const handleSendChatMessage = async (msgText: string) => {
    if (!msgText.trim() || isAIProcessing) return;

    const lowercaseMsg = msgText.toLowerCase().trim();
    const normalizedMsg = lowercaseMsg.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const lastMsgWithVideo = chatMessages.slice().reverse().find(m => m.videoPendingTransacciones && m.videoPendingTransacciones.length > 0);
    
    const isAnswerConfirming = () => {
      const positiveWords = ['si', 'yes', 'claro', 'por supuesto', 'agrega', 'dale', 'ok', 'sii', 'siii', 'sip', 'sipi', 'bueno', 'confirm', 'vale', 'perfecto', 'agregalas', 'agregalos'];
      return positiveWords.some(word => normalizedMsg.includes(word));
    };

    const isAnswerRefusing = () => {
      const negativeWords = ['no', 'cancela', 'nono', 'nop', 'nopi', 'no agregues', 'borra', 'rechaza'];
      return negativeWords.some(word => normalizedMsg.includes(word));
    };

    if (lastMsgWithVideo && lastMsgWithVideo.videoPendingTransacciones) {
      if (isAnswerConfirming()) {
        const corregirFecha = (fechaVal: string): string => {
          if (!fechaVal) return new Date().toISOString().split('T')[0];
          const match = fechaVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            const year = parseInt(match[1]);
            const today = new Date();
            if (year < today.getFullYear()) {
              return `${today.getFullYear()}-${match[2]}-${match[3]}`;
            }
            return fechaVal;
          }
          return new Date().toISOString().split('T')[0];
        };

        const actions = lastMsgWithVideo.videoPendingTransacciones.map(t => ({
          type: 'addTransaction',
          payload: {
            tipo: t.tipo,
            monto: t.monto,
            descripcion: t.descripcion,
            categoria: t.categoria || 'Otros',
            fecha: corregirFecha(t.fecha || ''),
            banco: t.banco
          }
        }));
        
        const userMsg: ChatMessage = {
          id: `chat-${Date.now()}`,
          sender: 'user',
          text: msgText,
          timestamp: new Date().toISOString()
        };
        
        setChatMessages(prev => {
          const newMsgs = prev.map(m => m.id === lastMsgWithVideo.id ? { ...m, videoPendingTransacciones: undefined } : m);
          return [...newMsgs, userMsg, {
            id: `chat-${Date.now()+1}`,
            sender: 'model',
            text: selectedLanguage === 'ES' 
              ? `Agregué ${actions.length} transacciones extraídas del video.`
              : `Added ${actions.length} transactions extracted from the video.`,
            timestamp: new Date().toISOString()
          }];
        });
        
        executeDangerousActions(actions);
        setChatInput('');
        return;
      } else if (isAnswerRefusing()) {
        const userMsg: ChatMessage = {
          id: `chat-${Date.now()}`,
          sender: 'user',
          text: msgText,
          timestamp: new Date().toISOString()
        };
        
        setChatMessages(prev => {
          const newMsgs = prev.map(m => m.id === lastMsgWithVideo.id ? { ...m, videoPendingTransacciones: undefined } : m);
          return [...newMsgs, userMsg, {
            id: `chat-${Date.now()+1}`,
            sender: 'model',
            text: selectedLanguage === 'ES' 
              ? `De acuerdo, no se agregaron los movimientos.`
              : `Understood, transactions were not added.`,
            timestamp: new Date().toISOString()
          }];
        });
        setChatInput('');
        return;
      }
    }
    
    const tempAttachedFileText = attachedFileText;
    const tempAttachedFileName = attachedFileName;

    const fullMessage = tempAttachedFileText
      ? `${msgText}\n\n[Documento adjunto: "${tempAttachedFileName}"]\n${tempAttachedFileText.substring(0, 40000)}`
      : msgText;

    const userMsg: ChatMessage = {
      id: `chat-${Date.now()}`,
      sender: 'user',
      text: msgText,
      timestamp: new Date().toISOString(),
      ...(tempAttachedFileName && { attachedFileName: tempAttachedFileName })
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setAttachedFileText(null);
    setAttachedFileName(null);
    setIsAIProcessing(true);
    playTone('tap', isMuted);

    try {
      const history = chatMessages.slice(1).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const context = {
        language: selectedLanguage,
        countryName: selectedCountry === 'CO' ? 'Colombia' : 'Chile',
        currencySymbol: selectedCountry === 'ES' ? '€' : '$',
        profile: userProfile,
        suenos: suenos.map(s => ({
          id: s.id,
          nombre: s.nombre,
          meta: s.meta,
          esActivo: s.id === activeSuenoId
        })),
        productos: (userProfile.productos || []).map(p => ({
          id: p.id,
          banco: p.banco,
          producto: p.tipo,
          alias: p.alias,
          cupo: p.montoTotal,
          utilizado: p.montoUtilizado
        })),
        financials: { totalActivos, totalPasivos },
        transacciones: [...transacciones]
          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
          .slice(0, 60)
          .map(t => ({
            id: t.id,
            tipo: t.tipo,
            monto: t.monto,
            categoria: t.categoria,
            descripcion: t.descripcion,
            fecha: t.fecha
          }))
      };

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: fullMessage, history, context })
      });

      if (!res.ok) throw new Error("HTTP error " + res.status);

      const data = await res.json();
      let responseText = data.text;
      let actions: any[] = [];
      try {
        let cleaned = data.text.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(json)?\s*/i, "");
        }
        if (cleaned.endsWith("```")) {
          cleaned = cleaned.replace(/\s*```$/, "");
        }
        cleaned = cleaned.trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.text) responseText = parsed.text;
        if (parsed.actions && Array.isArray(parsed.actions)) actions = parsed.actions;
      } catch (e) {
        console.warn("[ChatPanel] Parse error:", e);
      }

      const modelMsg: ChatMessage = {
        id: `chat-${Date.now()}-ai`,
        sender: 'model',
        text: responseText || (selectedLanguage === 'ES' ? 'No pude entender la respuesta.' : 'Could not understand response.'),
        timestamp: new Date().toISOString()
      };

      setChatMessages(prev => [...prev, modelMsg]);
      playTone('success', isMuted);
      setAttachedFileText(null);
      setAttachedFileName(null);

      if (ttsEnabled && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(modelMsg.text);
        utterance.lang = selectedLanguage === 'ES' ? 'es-ES' : 'en-US';
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes(selectedLanguage === 'ES' ? 'es' : 'en') && (v.name.includes('Google') || v.name.includes('Neural') || v.name.toLowerCase().includes('female')));
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }

      const normalizarMontoLocal = (valor: any): number => {
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
        const lowercase = raw.toLowerCase();

        // Detect multipliers: MM (millones), M (millon/millones/million/millions), K/mil (thousands)
        let multiplier = 1;
        if (lowercase.includes('mill') || lowercase.includes('mm') || (lowercase.includes('m') && !lowercase.includes('mil'))) {
          multiplier = 1000000;
        } else if (lowercase.includes('k') || lowercase.includes('mil')) {
          multiplier = 1000;
        }

        const esNegativo = /^\(.*\)$/.test(raw) || /^-/.test(raw);
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
          if (multiplier > 1) {
            // keep dot as decimal separator
          } else if (parts.length > 2) {
            s = s.replace(/\./g, "");
          } else if (parts[parts.length - 1].length === 3) {
            s = s.replace(/\./g, "");
          }
        } else if (s.includes(",")) {
          const parts = s.split(",");
          if (multiplier > 1) {
            s = s.replace(",", ".");
          } else if (parts.length > 2) {
            s = s.replace(/,/g, "");
          } else if (parts[parts.length - 1].length === 3) {
            s = s.replace(/,/g, "");
          } else {
            s = s.replace(",", ".");
          }
        }
        let n = parseFloat(s);
        if (isNaN(n)) {
          const soloDigitos = raw.replace(/\D/g, "");
          if (soloDigitos) n = parseInt(soloDigitos, 10);
        }
        if (isNaN(n)) return NaN;
        return esNegativo ? -Math.round(n * multiplier) : Math.round(n * multiplier);
      };

      const destructiveTypes = [
        "deleteTransaction", "editTransaction",
        "deleteProduct", "editProduct",
        "deleteSueno", "editSueno"
      ];

      const allActions = (actions || []);

      const safeActions = allActions.filter(
        (a: any) => !destructiveTypes.includes(a.type)
      );

      const validDangerous = allActions.filter(
        (a: any) =>
          destructiveTypes.includes(a.type) &&
          a.payload &&
          typeof a.payload.id === "string" &&
          a.payload.id.trim().length > 0
      );

      const invalidDangerous = allActions.filter(
        (a: any) =>
          destructiveTypes.includes(a.type) &&
          (!a.payload ||
            typeof a.payload.id !== "string" ||
            a.payload.id.trim().length === 0)
      );

      if (invalidDangerous.length > 0) {
        console.warn("[ChatPanel] Acciones destructivas con payload invalido ignoradas:", invalidDangerous);
        triggerDynamicIsland(
          selectedLanguage === "ES"
            ? "Prako no identificó el elemento"
            : "Prako could not identify the item",
          selectedLanguage === "ES"
            ? "Intenta pedirlo de forma más específica"
            : "Try a more specific request",
          false
        );
      }

      let currentTxList = [...transacciones];
      let currentProfile = { ...userProfile };
      let currentSuenos = [...suenos];
      let txChanged = false;
      let profileChanged = false;
      let suenosChanged = false;
      let duplicatesFound: Transaccion[] = [];

      safeActions.forEach(action => {
        if (action.type === 'addTransaction' && action.payload) {
          const p = action.payload;
          const numericMonto = normalizarMontoLocal(p.monto) || 0;
          const targetFecha = p.fecha || new Date().toISOString().split('T')[0];
          const targetDesc = p.descripcion || 'Acción desde Prako AI';
          const targetCat = p.categoria || (p.tipo === 'Ingreso' ? 'Salario' : 'Otros');

          const isDuplicate = currentTxList.some((tx) => {
            return tx.monto === numericMonto && tx.fecha === targetFecha;
          });

          if (isDuplicate) {
            const dupT: Transaccion = {
              id: `trx-${Date.now()}-${Math.random()}`,
              tipo: p.tipo === 'Ingreso' ? 'Ingreso' : 'Gasto',
              monto: numericMonto,
              categoria: targetCat,
              descripcion: targetDesc,
              fecha: targetFecha,
              formaPago: p.formaPago || 'Efectivo'
            };
            duplicatesFound.push(dupT);
            return; // no se agrega aun; el usuario decide luego
          }

          const newT: Transaccion = {
            id: `trx-${Date.now()}-${Math.random()}`,
            tipo: p.tipo === 'Ingreso' ? 'Ingreso' : 'Gasto',
            monto: numericMonto,
            categoria: targetCat,
            descripcion: targetDesc,
            fecha: targetFecha,
            formaPago: p.formaPago || 'Efectivo'
          };
          currentTxList = [newT, ...currentTxList];
          txChanged = true;
          triggerDynamicIsland("Operación Exitosa", `Gasto/Ingreso creado: $${numericMonto.toLocaleString()}`, true);
        } else if (action.type === 'addProduct' && action.payload) {
          const p = action.payload;
          const newProd: UserProfile['productos'][0] = {
            id: `prod-${Date.now()}-${Math.random()}`,
            banco: p.banco || 'Bancolombia',
            tipo: p.producto || 'Cuenta de Ahorros', 
            montoTotal: p.cupo,
            montoUtilizado: p.utilizado,
            alias: p.alias
          };
          currentProfile.productos = [...(currentProfile.productos || []), newProd];
          profileChanged = true;
          triggerDynamicIsland("Producto Agregado", `${p.banco} - ${p.producto}`, true);
        } else if (action.type === 'addSueno' && action.payload) {
          const p = action.payload;
          const newSueno: Sueno = {
            id: `sueno-${Date.now()}-${Math.random()}`,
            nombre: p.nombre,
            meta: p.meta,
            ahorroManual: 0,
            usarReal: false
          };
          currentSuenos = [...currentSuenos, newSueno];
          suenosChanged = true;
          triggerDynamicIsland("Sueño Creado", `${p.nombre}`, true);
        }
      });

      if (duplicatesFound.length > 0) {
        onDuplicatesFound(duplicatesFound);
      }

      if (txChanged) {
        saveTransacciones(currentTxList);
      }
      if (profileChanged) {
        saveUserProfileData(currentProfile);
      }
      if (suenosChanged) {
        saveSuenosList(currentSuenos);
      }

      if (validDangerous.length > 0) {
        setPendingActions(validDangerous);
      }
      
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: ChatMessage = {
        id: `chat-${Date.now()}-error`,
        sender: 'model',
        text: selectedLanguage === 'ES' ? 'Lo siento, ocurrió un error al conectarse con el servidor de Gemini.' : 'Sorry, an error occurred while connecting to the Gemini server.',
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const toggleChatSpeechRecognition = () => {
    if (isListeningChat) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        playTone('success', isMuted);
      }
      return;
    }

    playTone('voice', isMuted);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      triggerDynamicIsland("Error Micrófono", "Navegador incompatible", false);
      return;
    }

    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    rec.lang = selectedLanguage === 'ES' ? 'es-ES' : 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    setChatInput(''); 

    rec.onstart = () => {
      setIsListeningChat(true);
      setIsImmersiveVoiceMode(true);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };

    rec.onerror = (e: any) => {
      console.error(e);
      setIsListeningChat(false);
      setIsImmersiveVoiceMode(false);
    };

    rec.onend = () => {
      setIsListeningChat(false);
      recognitionRef.current = null;
    };

    rec.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      const currentText = finalTranscript + interimTranscript;
      setChatInput(currentText);
    };

    rec.start();
  };

  const handleStopVoiceChat = () => {
    setIsImmersiveVoiceMode(false);
    if (recognitionRef.current) recognitionRef.current.stop();
    if (chatInput.trim()) handleSendChatMessage(chatInput);
  };

  return (
    <>
      {isImmersiveVoiceMode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="absolute inset-0 z-[100] bg-gradient-to-b from-[#1a237e] via-[#311b92] to-[#004d40] overflow-hidden flex flex-col items-center justify-between p-8 text-white backdrop-blur-2xl"
        >
          {/* Ambient Background Effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} 
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/4 -left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px]" 
            />
            <motion.div 
              animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.4, 0.1] }} 
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-[100px]" 
            />
          </div>

          <div className="w-full relative z-10 flex flex-col items-center pt-10 mt-safe">
            <div className="bg-white/10 p-3 rounded-2xl flex items-center gap-3 backdrop-blur-md border border-white/20 shadow-xl mb-4">
              <Sparkles className="w-5 h-5 text-teal-300" />
              <span className="text-xs font-black tracking-widest text-teal-100 uppercase uppercase">FinDream / Gemini AI</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center w-full relative z-10 space-y-10">
            <div className="relative">
              <motion.div 
                className="absolute inset-0 bg-white/20 rounded-full"
                animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
              />
              <motion.div 
                className="absolute inset-0 bg-white/20 rounded-full"
                animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut", delay: 0.5 }}
              />
              <div className="w-24 h-24 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.2)] relative z-10">
                <div className="flex gap-1.5 items-center justify-center">
                  <motion.div animate={{ height: [12, 32, 12] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-1.5 bg-teal-300 rounded-full" />
                  <motion.div animate={{ height: [16, 48, 16] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1.5 bg-indigo-300 rounded-full" />
                  <motion.div animate={{ height: [24, 56, 24] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1.5 bg-fuchsia-300 rounded-full" />
                  <motion.div animate={{ height: [16, 40, 16] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1.5 bg-indigo-300 rounded-full" />
                  <motion.div animate={{ height: [12, 24, 12] }} transition={{ repeat: Infinity, duration: 0.9 }} className="w-1.5 bg-teal-300 rounded-full" />
                </div>
              </div>
            </div>

            <div className="w-full text-center px-4 max-h-48 overflow-y-auto no-scrollbar">
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-white/90 leading-tight"
              >
                {chatInput || (selectedLanguage === 'ES' ? 'Te escucho...' : 'Listening...')}
              </motion.p>
            </div>
          </div>

          <div className="w-full relative z-10 pb-6 mb-safe">
            <button
              onClick={() => { playTone('tap', isMuted); handleStopVoiceChat(); }}
              className="w-full py-4 bg-white text-indigo-900 text-sm font-black rounded-3xl active:scale-95 transition-all shadow-[0_8px_32px_rgba(255,255,255,0.2)] hover:bg-slate-50 uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <div className="w-2.5 h-2.5 bg-rose-500 rounded-sm animate-pulse" />
              {selectedLanguage === 'ES' ? 'Finalizar y Enviar' : 'End & Send'}
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 rounded-2xl p-2 relative overflow-hidden border border-slate-100 shadow-inner">
        <div className="bg-white px-3 py-2 rounded-xl flex items-center justify-between border border-slate-150 shadow-xs z-10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-teal-100 p-1.5 rounded-xl border border-teal-200">
              <Bot className="w-4 h-4 text-teal-800" />
            </div>
            <div className="flex flex-col">
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none">Prako IA</h4>
              <span className="text-[9px] text-teal-600 font-bold">FinDream Expert</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-slate-500" /> Gemini 2.5
            </span>
            <button 
              type="button"
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className="p-1 rounded-full hover:bg-slate-100 transition-colors"
              title={ttsEnabled ? "Silenciar Respuestas" : "Habilitar Voz (TTS)"}
            >
              {ttsEnabled ? <Volume2 className="w-3.5 h-3.5 text-teal-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>
        </div>

        <div id="chat-messages-container" className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1 no-scrollbar flex flex-col text-left">
          {chatMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} className={`flex flex-col max-w-[85%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}>
                <div className={`rounded-2xl p-3 text-xs leading-relaxed ${isUser ? 'bg-[#00897B] text-white shadow-xs rounded-tr-none font-medium' : 'bg-white text-slate-800 shadow-3xs border border-slate-100/50 rounded-tl-none font-medium'}`}>
                  {isUser && msg.attachedFileName && (
                    <div className="flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-xl px-2.5 py-1.5 mb-1.5 text-[11px] font-bold text-white max-w-full">
                      <Paperclip className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate flex-1 font-semibold">{msg.attachedFileName}</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap select-text">
                    {isUser ? msg.text : renderMarkdownMsg(msg.text)}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-[8px] text-slate-400 font-bold">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {!isUser && (
                    <button
                      onClick={() => copiarMensaje(msg.id, msg.text)}
                      className="text-slate-400 hover:text-teal-600 transition-colors cursor-pointer flex items-center justify-center p-0.5"
                      title="Copiar mensaje"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-teal-600 animate-bounce" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400 hover:text-teal-600" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isAIProcessing && (
            <div className="self-start flex items-center gap-2 bg-white/70 backdrop-blur-xs rounded-2xl p-3 border border-slate-155 max-w-[70%]">
              <Loader2 className="w-4 h-4 animate-spin text-[#00897B]" />
              <span className="text-[11px] font-black tracking-wide text-[#00897B] animate-pulse">
                Prako {selectedLanguage === 'ES' ? 'está pensando...' : 'is typing...'}
              </span>
            </div>
          )}

          {/* Ancla invisible para auto-scroll al ultimo mensaje */}
          <div ref={chatEndRef} />
        </div>

        <div className="my-2 overflow-x-auto no-scrollbar pt-1 flex gap-2 shrink-0">
          {[
            { label: t('chat_suggest_1'), query: selectedLanguage === 'ES' ? 'Analiza mi situación financiera actual' : 'Analyze my current financial situation' },
            { label: t('chat_suggest_2'), query: selectedLanguage === 'ES' ? '¿Cómo puedo lograr mi sueño más rápido?' : 'How can I achieve my dream faster?' },
            { label: t('chat_suggest_3'), query: selectedLanguage === 'ES' ? 'Consejos útiles de ahorro para mi presupuesto' : 'Useful tips to save and budget money' },
            { label: t('chat_suggest_4'), query: selectedLanguage === 'ES' ? '¿Qué entidades financieras y productos recomiendas para mi país?' : 'What financial entities and products do you recommend for my country?' }
          ].map((sugg, idx) => (
            <button
              key={idx}
              onClick={() => handleSendChatMessage(sugg.query)}
              className="flex-shrink-0 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black tracking-tight shadow-3xs cursor-pointer transition active:scale-98"
            >
              💡 {sugg.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-[20px] p-3 mx-2 mb-2 shadow-md border border-slate-100 flex flex-col shrink-0">
          {/* Prako info row above input */}
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#00897B] to-[#312E81] flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[9px] font-black text-[#00897B] uppercase tracking-wider leading-none">
              PRAKO IA
            </span>
            <span className="ml-auto text-[8px] font-black text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 whitespace-nowrap">
              ✦ Gemini 2.5
            </span>
          </div>

          {/* Input oculto para archivos */}
          <input
            ref={attachInputRef}
            type="file"
            multiple
            accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,video/*"
            onChange={handleChatFileAttach}
            className="hidden"
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChatMessage(chatInput);
            }}
            className={`bg-slate-50 border border-slate-150 p-1.5 rounded-[22px] flex flex-col gap-1 relative ${attachedFileName ? 'pr-3 pl-3' : 'pr-1.5 pl-3'}`}
          >
            {attachedFileName && (
              <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-1.5 mb-1 text-xs">
                <span className="text-teal-700 font-bold truncate flex-1">■ {attachedFileName}</span>
                <button
                  type="button"
                  onClick={() => { setAttachedFileText(null); setAttachedFileName(null); }}
                  className="text-teal-500 hover:text-red-500 transition-colors font-bold"
                >✕</button>
              </div>
            )}

            <div className="flex items-center gap-1 w-full">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={isListeningChat ? "Escuchando voz..." : t('chat_placeholder')}
                className="flex-1 bg-transparent border-none py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
                disabled={isAIProcessing}
              />

              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                disabled={isProcessingFile}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors flex-shrink-0"
                title={selectedLanguage === 'ES' ? 'Adjuntar documento' : 'Attach document'}
              >
                {isProcessingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                ) : (
                  <Paperclip className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {chatInput.trim() && !isAIProcessing ? (
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isAIProcessing}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition bg-[#00897B] text-white hover:bg-[#00796B] cursor-pointer shadow-sm ml-1 flex-shrink-0"
                >
                  <Send className="w-5 h-5 ml-0.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={toggleChatSpeechRecognition}
                  className={`flex items-center justify-center rounded-full transition-all cursor-pointer transform flex-shrink-0 ${
                    isListeningChat
                      ? 'w-10 h-10 bg-gradient-to-tr from-rose-400 to-rose-600 text-white shadow-rose-200 ring-[3px] ring-rose-200 scale-105'
                      : 'w-[52px] h-[52px] md:w-13 md:h-13 bg-gradient-to-br from-[#1a237e] to-[#00897B] shadow-[0_6px_18px_rgba(0,137,123,0.4)] ring-2 ring-[#00897B]/20'
                  }`}
                  title={selectedLanguage === 'ES' ? "Comando por voz de IA" : "AI Voice command"}
                >
                  {isListeningChat ? (
                    <div className="flex gap-0.5 items-center justify-center relative">
                      <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-0.5 bg-white rounded-full" />
                      <motion.div animate={{ height: [12, 24, 12] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.1 }} className="w-0.5 bg-white rounded-full mx-0.5" />
                      <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-0.5 bg-white rounded-full" />
                    </div>
                  ) : (
                    <Mic className="w-5 h-5 text-white" />
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Under-input info text */}
          <div className="flex items-center gap-2 mt-2 px-1">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[9px] text-slate-300 font-semibold uppercase tracking-wider select-none shrink-0">
              Toca el micrófono o escribe
            </span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
        </div>
      </div>

      {pendingActions && pendingActions.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2.5 text-rose-600 mb-3">
              <ShieldCheck className="w-5 h-5 shrink-0 animate-bounce" />
              <h3 className="text-sm font-bold text-slate-950 uppercase tracking-tight">
                {selectedLanguage === 'ES' ? 'Confirmar Operación' : 'Confirm Operation'}
              </h3>
            </div>
            <p className="text-xs font-semibold text-slate-500 mb-4 leading-relaxed">
              {selectedLanguage === 'ES' 
                ? 'Prako va a realizar cambios en tu portafolio financiero. ¿Confirmas esta operación?'
                : 'Prako is going to make changes to your financial portfolio. Do you confirm this operation?'}
            </p>
            <ul className="text-xs text-slate-500 mb-5 max-h-32 overflow-y-auto space-y-2 border-y border-slate-100 py-3 bg-slate-50/50 px-2 rounded-lg no-scrollbar">
              {pendingActions.map((a, i) => {
                let name = "";
                if (a.type?.includes("Transaction")) {
                  const found = transacciones.find(t => t.id === a.payload?.id);
                  if (found) name = `${found.descripcion || found.categoria} ($${found.monto.toLocaleString()})`;
                } else if (a.type?.includes("Product")) {
                  const found = (userProfile.productos || []).find(p => p.id === a.payload?.id);
                  if (found) name = `${found.banco} - ${found.tipo} ${found.alias ? `(${found.alias})` : ''}`;
                } else if (a.type?.includes("Sueno")) {
                  const found = suenos.find(s => s.id === a.payload?.id);
                  if (found) name = found.nombre;
                }
                if (!name) name = a.payload?.id?.substring(0, 8) + "...";

                return (
                  <li key={i} className="flex flex-col gap-0.5 border-l-2 border-rose-500 pl-2">
                    <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wider">
                      {a.type === "deleteTransaction" && (selectedLanguage === 'ES' ? 'Eliminar Gasto' : 'Delete Expense')}
                      {a.type === "editTransaction" && (selectedLanguage === 'ES' ? 'Editar Gasto' : 'Edit Expense')}
                      {a.type === "deleteProduct" && (selectedLanguage === 'ES' ? 'Eliminar Tarjeta/Cuenta' : 'Delete Card/Account')}
                      {a.type === "editProduct" && (selectedLanguage === 'ES' ? 'Editar Tarjeta/Cuenta' : 'Edit Card/Account')}
                      {a.type === "deleteSueno" && (selectedLanguage === 'ES' ? 'Eliminar Sueño' : 'Delete Dream')}
                      {a.type === "editSueno" && (selectedLanguage === 'ES' ? 'Editar Sueño' : 'Edit Dream')}
                    </span>
                    <span className="text-[11px] font-bold text-slate-800">{name}</span>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingActions(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition active:scale-98 cursor-pointer"
              >
                {selectedLanguage === 'ES' ? 'Descartar' : 'Discard'}
              </button>
              <button
                onClick={() => {
                  executeDangerousActions(pendingActions);
                  setPendingActions(null);
                }}
                className="flex-1 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-200 transition active:scale-98 cursor-pointer"
              >
                {selectedLanguage === 'ES' ? 'Confirmar' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
