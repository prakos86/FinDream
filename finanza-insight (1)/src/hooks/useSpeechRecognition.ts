import { useState, useRef, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  selectedLanguage: string;
  onTranscriptChange?: (text: string) => void;
  triggerDynamicIsland?: (text: string, subtext: string, isPositive: boolean) => void;
  playTone?: (soundType: any, muted: boolean) => void;
  isMuted?: boolean;
}

export function useSpeechRecognition({
  selectedLanguage,
  onTranscriptChange,
  triggerDynamicIsland,
  playTone,
  isMuted = false,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = selectedLanguage === 'ES' ? 'es-ES' : 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setIsListening(true);
      setRecognitionError(null);
    };

    rec.onerror = (e: any) => {
      console.error(e);
      setIsListening(false);
      setRecognitionError(selectedLanguage === 'ES' ? "No se pudo detectar entrada de audio." : "Could not capture voice audio.");
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      if (onTranscriptChange) {
        onTranscriptChange(text);
      }
      if (triggerDynamicIsland) {
        triggerDynamicIsland(
          selectedLanguage === 'ES' ? "Texto Dictado" : "Voice Typed",
          text.length > 25 ? text.substring(0, 25) + '...' : text,
          true
        );
      }
    };

    recognitionRef.current = rec;
  }, [selectedLanguage]);

  const startListening = () => {
    if (playTone) {
      playTone('voice', isMuted);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Speech recognition already started or error starting:', e);
      }
    } else {
      setRecognitionError(selectedLanguage === 'ES' ? "Tu navegador no soporta reconocimiento de voz en tiempo real." : "Speech recognition not supported in this browser.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Error stopping speech recognition:', e);
      }
    }
  };

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    recognitionError,
  };
}
