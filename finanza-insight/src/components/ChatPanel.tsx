import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Mic, Sparkles, Loader2, Volume2, VolumeX, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage, UserProfile, Transaccion, Sueno } from '../types';

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
  setSuenos: (s: Sueno[]) => void;
  triggerDynamicIsland: (title: string, msg: string, isPositive: boolean) => void;
  playTone: (type: 'tap' | 'success' | 'delete' | 'voice', isMuted: boolean) => void;
  isMuted: boolean;
  t: (key: any) => string;
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
  setSuenos,
  triggerDynamicIsland,
  playTone,
  isMuted,
  t
}) => {
  const [chatInput, setChatInput] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isListeningChat, setIsListeningChat] = useState(false);
  const [isImmersiveVoiceMode, setIsImmersiveVoiceMode] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);

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

  const handleSendChatMessage = async (msgText: string) => {
    if (!msgText.trim() || isAIProcessing) return;
    
    const userMsg: ChatMessage = {
      id: `chat-${Date.now()}`,
      sender: 'user',
      text: msgText,
      timestamp: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAIProcessing(true);
    playTone('tap', isMuted);

    try {
      const history = chatMessages.slice(1).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const context = {
        language: selectedLanguage,
        countryName: selectedCountry === 'CO' ? 'Colombia' : selectedCountry === 'US' ? 'United States' : selectedCountry === 'ES' ? 'Spain' : 'Mexico',
        currencySymbol: selectedCountry === 'ES' ? '€' : '$',
        profile: userProfile,
        suenos: suenos.map(s => ({
          nombre: s.nombre,
          meta: s.meta,
          esActivo: s.id === activeSuenoId
        })),
        financials: { totalActivos, totalPasivos },
        transacciones: transacciones.map(t => ({
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
        body: JSON.stringify({ message: msgText, history, context })
      });

      if (!res.ok) throw new Error("HTTP error " + res.status);

      const data = await res.json();
      let responseText = data.text;
      let actions: any[] = [];
      try {
        const parsed = JSON.parse(data.text);
        if (parsed.text) responseText = parsed.text;
        if (parsed.actions && Array.isArray(parsed.actions)) actions = parsed.actions;
      } catch (e) {}

      const modelMsg: ChatMessage = {
        id: `chat-${Date.now()}-ai`,
        sender: 'model',
        text: responseText || (selectedLanguage === 'ES' ? 'No pude entender la respuesta.' : 'Could not understand response.'),
        timestamp: new Date().toISOString()
      };

      setChatMessages(prev => [...prev, modelMsg]);
      playTone('success', isMuted);

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

      actions.forEach(action => {
        if (action.type === 'addTransaction' && action.payload) {
          const p = action.payload;
          const newT: Transaccion = {
            id: `trx-${Date.now()}-${Math.random()}`,
            tipo: p.tipo === 'Ingreso' ? 'Ingreso' : 'Gasto',
            monto: p.monto || 0,
            categoria: p.categoria || (p.tipo === 'Ingreso' ? 'Salario' : 'Otros'),
            descripcion: p.descripcion || 'Acción desde Prako AI',
            fecha: new Date().toISOString(),
            formaPago: p.formaPago || 'Efectivo'
          };
          saveTransacciones([newT, ...transacciones]);
          triggerDynamicIsland("Operación Exitosa", `Gasto/Ingreso creado: $${p.monto}`, true);
        } else if (action.type === 'addProduct' && action.payload) {
          const p = action.payload;
          const newProd: UserProfile['productos'][0] = {
            id: `prod-${Date.now()}`,
            banco: p.banco || 'Bancolombia',
            tipo: p.producto || 'Cuenta de Ahorros', 
            montoTotal: p.cupo,
            montoUtilizado: p.utilizado,
            alias: p.alias
          };
          saveUserProfileData({
            ...userProfile,
            productos: [...(userProfile.productos || []), newProd]
          });
          triggerDynamicIsland("Producto Agregado", `${p.banco} - ${p.producto}`, true);
        } else if (action.type === 'addSueno' && action.payload) {
          const p = action.payload;
          const newSueno: Sueno = {
            id: `sueno-${Date.now()}`,
            nombre: p.nombre,
            meta: p.meta,
            ahorroManual: 0,
            usarReal: false
          };
          setSuenos([...suenos, newSueno]);
          triggerDynamicIsland("Sueño Creado", `${p.nombre}`, true);
        }
      });
      
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
              <ShieldCheck className="w-3 h-3 text-slate-500" /> GPT-4o
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
                  <div className="whitespace-pre-wrap">
                    {isUser ? msg.text : renderMarkdownMsg(msg.text)}
                  </div>
                </div>
                <span className="text-[8px] text-slate-400 font-bold mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendChatMessage(chatInput);
          }}
          className="mt-1 bg-white p-1.5 rounded-full border border-slate-200/80 flex items-center gap-1 shadow-md shrink-0 relative pr-1.5 pl-3"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={isListeningChat ? "Escuchando voz..." : t('chat_placeholder')}
            className="flex-1 bg-transparent border-none py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
            disabled={isAIProcessing}
          />

          {chatInput.trim() && !isAIProcessing ? (
            <button
              type="submit"
              disabled={!chatInput.trim() || isAIProcessing}
              className="w-10 h-10 rounded-full flex items-center justify-center transition bg-[#00897B] text-white hover:bg-[#00796B] cursor-pointer shadow-sm ml-1"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleChatSpeechRecognition}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer shadow-md transform ${
                isListeningChat
                  ? 'bg-gradient-to-tr from-rose-400 to-rose-600 text-white shadow-rose-200 ring-[3px] ring-rose-200 scale-105'
                  : 'bg-[#1a237e] text-white hover:opacity-95 hover:scale-105 hover:shadow-indigo-200'
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
        </form>
      </div>
    </>
  );
};
