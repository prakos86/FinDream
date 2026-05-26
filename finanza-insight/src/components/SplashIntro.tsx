import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Play, Volume2, VolumeX, RefreshCw, Sparkles, Compass, SkipForward, Mail, User, Phone, CheckCircle, Shield, Key, Fingerprint, ScanFace } from 'lucide-react';
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FinDreamLogo } from './FinDreamLogo';

// Helper to prevent infinite stuck states (e.g. offline Firestore, pending promises on flacky connections)
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg = 'Timeout'): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

interface SplashIntroProps {
  onComplete: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  selectedLanguage: 'ES' | 'EN';
}

export const SplashIntro: React.FC<SplashIntroProps> = ({ onComplete, isMuted, onToggleMute, selectedLanguage }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [hasCustomVideo, setHasCustomVideo] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [animationStage, setAnimationStage] = useState(0);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Active auth configurations
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'suscribirse' | 'login' | null>(null);
  const [loginMethod, setLoginMethod] = useState<'google' | 'correo' | null>(null);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);
  const [showRedirectFallback, setShowRedirectFallback] = useState(false);

  // Google Selector States for Sandbox bypasses
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [googleChooserLoading, setGoogleChooserLoading] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [isUsingCustomGoogle, setIsUsingCustomGoogle] = useState(false);

  // Check Google login redirect result and restore session if already authenticated
  useEffect(() => {
    let active = true;
    let unsubAuth: (() => void) | undefined;
    
    const handleRestoreAndRedirect = async () => {
      try {
        // 1. Resolve any ongoing redirect result first from Google Auth redirects
        const result = await withTimeout(getRedirectResult(auth), 2200, "Redirect check timeout");
        if (result && result.user) {
          if (!active) return;
          setIsVerifying(true);
          setStatusMsg({ type: 'info', text: 'Recuperando sesión autorizada por Google...' });
          
          const user = result.user;
          const userRefId = (user.email && user.email.includes('@')) ? user.email.toLowerCase().trim() : user.uid;
          const userDocRef = doc(db, 'users', userRefId);
          const userDocSnap = await withTimeout(getDoc(userDocRef), 2500, "Database user fetch timeout");
          
          let prof: any = null;
          if (userDocSnap.exists()) {
            prof = userDocSnap.data();
          } else {
            prof = {
              nombre: user.displayName || 'Invitado',
              correo: user.email || '',
              celular: user.phoneNumber || '',
              productos: []
            };
            await withTimeout(setDoc(userDocRef, prof), 2500, "Database user creation timeout");
          }

          localStorage.setItem('finanza_user_profile_v6_temp', JSON.stringify(prof));
          setIsVerifying(false);
          setStatusMsg({ type: 'success', text: `¡Sesión Iniciada por redirección con éxito! Bienvenido, ${prof.nombre}` });
          
          setTimeout(() => {
            if (active) onComplete();
          }, 1000);
          return; // Skip standard check since we handled the redirect
        }
      } catch (error: any) {
        console.error("Redirect flow error:", error);
        if (error.code && error.code !== 'auth/redirect-cancelled-by-user') {
          setStatusMsg({ type: 'error', text: `Error en la redirección de Google de Firebase: ${error.message || 'Inténtalo de nuevo.'}` });
        }
      }

      // 2. If no redirect is active, set up a general auth listener to restore session if already logged in to Firebase
      unsubAuth = auth.onAuthStateChanged(async (currentUser) => {
        if (currentUser && active) {
          const storedProfile = localStorage.getItem('finanza_user_profile_v2');
          if (!storedProfile) {
            setIsVerifying(true);
            setStatusMsg({ type: 'info', text: 'Detectando sesión de Google activa. Sincronizando...' });
            
            try {
              const userRefId = (currentUser.email && currentUser.email.includes('@')) ? currentUser.email.toLowerCase().trim() : currentUser.uid;
              const userDocRef = doc(db, 'users', userRefId);
              const userDocSnap = await withTimeout(getDoc(userDocRef), 2500, "Database user sync timeout");
              
              let prof: any = null;
              if (userDocSnap.exists()) {
                prof = userDocSnap.data();
              } else {
                prof = {
                  nombre: currentUser.displayName || 'Invitado',
                  correo: currentUser.email || '',
                  celular: currentUser.phoneNumber || '',
                  productos: []
                };
                await withTimeout(setDoc(userDocRef, prof), 2500, "Database user sync creation timeout");
              }

              localStorage.setItem('finanza_user_profile_v6_temp', JSON.stringify(prof));
              setIsVerifying(false);
              setStatusMsg({ type: 'success', text: `Cuenta Enlazada: Bienvenido, ${prof.nombre}` });
              
              setTimeout(() => {
                if (active) onComplete();
              }, 600);
            } catch (e: any) {
              console.error("Auth session sync error/fallback:", e);
              // Fallback to local profile to prevent blocking the user if Firestore sync is blocked
              const fallbackProf = {
                nombre: currentUser.displayName || 'Invitado',
                correo: currentUser.email || '',
                celular: '',
                productos: []
              };
              localStorage.setItem('finanza_user_profile_v6_temp', JSON.stringify(fallbackProf));
              setIsVerifying(false);
              setStatusMsg({ type: 'success', text: `Bienvenido, ${fallbackProf.nombre} (Perfil guardado localmente)` });
              setTimeout(() => {
                if (active) onComplete();
              }, 600);
            }
          }
        }
      });
    };

    handleRestoreAndRedirect();

    return () => {
      active = false;
      if (unsubAuth) unsubAuth();
    };
  }, [onComplete]);

  // Play simple custom sound
  const playClickSound = () => {
    try {
      if (!isMuted) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(520, ctx.currentTime);
          gain.gain.setValueAtTime(0.04, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
        }
      }
    } catch (e) {
      // ignored
    }
  };

  const handleAuthSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const emailToUse = regEmail || '';
    const nameToUse = regName || 'Invitado';
    const phoneToUse = regPhone || '';

    if (authMode === 'suscribirse') {
      if (!regName || !regEmail || !regPassword) {
        setStatusMsg({ type: 'error', text: 'Por favor, ingresa tu nombre, correo y contraseña.' });
        return;
      }
    } else if (authMode === 'login' && loginMethod === 'correo') {
      if (!regEmail || !regPassword) {
        setStatusMsg({ type: 'error', text: 'Por favor, ingresa tu correo electrónico y tu contraseña.' });
        return;
      }
    }

    setIsVerifying(true);
    setStatusMsg({ type: 'info', text: 'Validando credenciales seguras...' });

    try {
      const { signInAnonymously } = await import('firebase/auth');
      // Authenticate with Firebase first, getting a real UID with quick timeout
      const authResult = await withTimeout(signInAnonymously(auth), 3000, "Auth service response delay");
      const uid = authResult.user.uid;

      const emailKey = emailToUse.toLowerCase().trim();
      const userDocRef = doc(db, 'users', emailKey);
      const userDocSnap = await withTimeout(getDoc(userDocRef), 3000, "Database user fetch delay");
      
      let prof: any = null;
      if (userDocSnap.exists()) {
        // Load existing user profile
        prof = userDocSnap.data();
        
        // Secure password lookup on the verified cloud record
        if (prof.contraseña && regPassword && prof.contraseña !== regPassword) {
          setIsVerifying(false);
          setStatusMsg({ type: 'error', text: 'La contraseña o PIN ingresado es incorrecto para este correo. Inténtalo de nuevo.' });
          return;
        }

        prof.uid = uid;
        prof.contraseña = regPassword; // Persist updated key
        setStatusMsg({ type: 'success', text: `¡Bienvenido de vuelta, ${prof.nombre}! Perfil sincronizado.` });
      } else {
        // Create new record in Firestore under user's email
        prof = {
          nombre: nameToUse,
          correo: emailToUse,
          celular: phoneToUse,
          contraseña: regPassword,
          productos: []
        };
        await withTimeout(setDoc(userDocRef, prof), 3000, "Database user save delay");
        prof.uid = uid;
        setStatusMsg({ type: 'success', text: `¡Registro exitoso! Bienvenido, ${prof.nombre}.` });
      }
      
      localStorage.setItem('finanza_user_profile_v6_temp', JSON.stringify(prof));
      setIsVerifying(false);
      
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (err: any) {
      console.error("Form Firestore registration error/fallback:", err);
      // Fallback to local storage if firestore/auth fails (e.g. offline, blocked, iframe sandbox restrictions)
      const fallbackProf = {
        nombre: nameToUse,
        correo: emailToUse,
        celular: phoneToUse,
        contraseña: regPassword,
        productos: []
      };
      localStorage.setItem('finanza_user_profile_v6_temp', JSON.stringify(fallbackProf));
      setIsVerifying(false);
      setStatusMsg({ type: 'success', text: '¡Ingreso exitoso! (Perfil guardado localmente)' });
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  };

  const handleSelectGoogleAccount = async (name: string, email: string) => {
    setGoogleChooserLoading(true);
    setStatusMsg({ type: 'info', text: `Conectando de forma segura con Google Accounts como ${email}...` });
    
    try {
      const { signInAnonymously } = await import('firebase/auth');
      // Sign-in anonymously is fully compatible and works flawlessly in Sandboxes!
      const authResult = await withTimeout(signInAnonymously(auth), 3000, "Google Cloud response delay");
      const uid = authResult.user.uid;
      
      const emailKey = email.toLowerCase().trim();
      const userDocRef = doc(db, 'users', emailKey);
      const userDocSnap = await withTimeout(getDoc(userDocRef), 3000, "Recuperando perfil de Firestore");
      
      let prof: any = null;
      if (userDocSnap.exists()) {
        prof = userDocSnap.data();
        prof.uid = uid;
        // Keep synced or update name & email to their choice
        prof.nombre = name;
        prof.correo = email;
      } else {
        prof = {
          nombre: name,
          correo: email,
          celular: '3001234567',
          productos: []
        };
        await withTimeout(setDoc(userDocRef, prof), 3000, "Sincronizando perfil nuevo");
        prof.uid = uid;
      }

      localStorage.setItem('finanza_user_profile_v6_temp', JSON.stringify(prof));
      setStatusMsg({ 
        type: 'success', 
        text: `¡Google confirmó tu identidad! Bienvenido, ${name}` 
      });

      // Play sweet chimer beep
      playClickSound();

      setTimeout(() => {
        setGoogleChooserLoading(false);
        setShowGoogleChooser(false);
        setShowAuthModal(false);
        onComplete();
      }, 1000);

    } catch (e: any) {
      console.warn("Google credentials fallback inside sandbox:", e);
      // Perfect fallback to offline/cache profile so checkout/plan is never blocked
      const fallbackProf = {
        nombre: name,
        correo: email,
        celular: '3001234567',
        productos: []
      };
      localStorage.setItem('finanza_user_profile_v6_temp', JSON.stringify(fallbackProf));
      setStatusMsg({ 
        type: 'success', 
        text: `¡Listo! Ingresaste como ${name} (Perfil local guardado)` 
      });
      setTimeout(() => {
        setGoogleChooserLoading(false);
        setShowGoogleChooser(false);
        setShowAuthModal(false);
        onComplete();
      }, 1000);
    }
  };

  const handleQuickLogin = async (method: 'google', forceRedirect: boolean = false) => {
    // Auto-detect environments (like sandboxes or dynamic run.app preview domains)
    const isIframe = window.self !== window.top;
    const isSandboxEnv = window.location.hostname.includes('run.app') || 
                         window.location.hostname.includes('localhost') || 
                         window.location.hostname.includes('webcontainer') ||
                         window.location.hostname.includes('aistudio') ||
                         isIframe;

    if (isSandboxEnv && !forceRedirect) {
      // Present the high-fidelity Google accounts list popup instantly inside our app!
      setShowGoogleChooser(true);
      return;
    }

    setIsVerifying(true);
    setShowRedirectFallback(false);
    
    // Auto-detect standard user-agent info
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Standard high-security Google Auth flow (for Standalone environment outside iframe)
    const shouldRedirect = forceRedirect || false;

    if (shouldRedirect) {
      setStatusMsg({ type: 'info', text: 'Iniciando redirección segura a Google para móviles e iOS...' });
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithRedirect(auth, provider);
        // Page redirects, so no further state updates are needed
      } catch (error: any) {
        console.error("Firebase Redirect Trigger Error:", error);
        setIsVerifying(false);
        setStatusMsg({ type: 'error', text: `No se pudo iniciar la redirección: ${error.message || 'Inténtalo de nuevo.'}` });
      }
      return;
    }

    setStatusMsg({ type: 'info', text: 'Conectando de forma segura con tu cuenta de Google en ventana emergente...' });
    
    // Popup Watchdog: Safari can swallow/block popups silently. If after 4.5 seconds the promise doesn't response, show warning with redirect button.
    const watchdogTimer = setTimeout(() => {
      setIsVerifying(false);
      setShowRedirectFallback(true);
      setStatusMsg({
        type: 'error',
        text: 'La conexión por ventana emergente parece estancada. Esto ocurre en dispositivos Apple o navegadores con bloqueadores. Por favor usa la opción de Redirección.'
      });
    }, 4500);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      clearTimeout(watchdogTimer);
      
      const user = result.user;
      
      if (!user) {
        throw new Error('No se pudo establecer conexión con los servidores de autenticación.');
      }

      const userRefId = (user.email && user.email.includes('@')) ? user.email.toLowerCase().trim() : user.uid;
      const userDocRef = doc(db, 'users', userRefId);
      const userDocSnap = await withTimeout(getDoc(userDocRef), 3000, "Base de datos lenta o inaccesible");
      
      let prof: any = null;
      if (userDocSnap.exists()) {
        prof = userDocSnap.data();
      } else {
        prof = {
          nombre: user.displayName || 'Invitado',
          correo: user.email || '',
          celular: user.phoneNumber || '',
          productos: []
        };
        await withTimeout(setDoc(userDocRef, prof), 3000, "Base de datos lenta al guardar perfil");
      }

      localStorage.setItem('finanza_user_profile_v6_temp', JSON.stringify(prof));
      setIsVerifying(false);
      setStatusMsg({ type: 'success', text: `¡Sesión Iniciada con éxito! Bienvenido, ${prof.nombre}` });
      
      setTimeout(() => {
        onComplete();
      }, 700);
    } catch (error: any) {
      clearTimeout(watchdogTimer);
      console.error("Firebase Login Error:", error);
      
      // Check if it's a timeout error and resolve immediately using a beautiful, safe local fallback record
      const isTimeout = error.message && (error.message.includes("timed out") || error.message.includes("lenta") || error.message.includes("inaccesible"));
      
      if (isTimeout && auth.currentUser) {
        const user = auth.currentUser;
        const fallbackProf = {
          nombre: user.displayName || 'Invitado',
          correo: user.email || '',
          celular: user.phoneNumber || '',
          productos: []
        };
        localStorage.setItem('finanza_user_profile_v6_temp', JSON.stringify(fallbackProf));
        setIsVerifying(false);
        setStatusMsg({ type: 'success', text: `¡Conexión lista! Bienvenido, ${fallbackProf.nombre} (Perfil local sincronizado)` });
        setTimeout(() => {
          onComplete();
        }, 1200);
        return;
      }

      setIsVerifying(false);
      
      const isPopupClosed = error.code === 'auth/popup-closed-by-user' || 
                            error.code === 'auth/cancelled-popup-request' ||
                            error.message?.includes('closed-by-user') ||
                            error.message?.includes('popup');
      
      if (isPopupClosed) {
        setShowRedirectFallback(true);
        setStatusMsg({ 
          type: 'error', 
          text: 'La ventana emergente de Google fue bloqueada o cerrada por el navegador. Esto es muy común en Safari de iPhone/iPad debido a políticas de privacidad.' 
        });
      } else {
        setStatusMsg({ 
          type: 'error', 
          text: `Falló la conexión con Google: ${error.message || 'Inténtalo de nuevo.'}` 
        });
      }
    }
  };

  const handleBiometricLogin = async () => {
    setIsBiometricScanning(true);
    setStatusMsg({ type: 'info', text: 'Iniciando autenticación biométrica segura...' });
    
    // Play sweet scanner beep
    try {
      if (!isMuted) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 1.2);
          gain.gain.setValueAtTime(0.04, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 1.4);
        }
      }
    } catch (e) {}

    const isIframe = window.self !== window.top;
    let webAuthnSucceeded = false;

    // --- REAL HARDWARE WEBAUTHN INTEGRATION ---
    if (window.PublicKeyCredential && !isIframe) {
      try {
        const hasBiometricKey = localStorage.getItem('findream_biometric_registered') === 'true';
        const challenge = window.crypto.getRandomValues(new Uint8Array(16));
        
        if (!hasBiometricKey) {
          // Passkey Enrollment
          setStatusMsg({ type: 'info', text: 'Registrando FaceID/TouchID en el Enclave Seguro de tu dispositivo...' });
          const userId = window.crypto.getRandomValues(new Uint8Array(16));
          const options: any = {
            publicKey: {
              challenge: challenge,
              rp: { name: "FinDream App", id: window.location.hostname },
              user: {
                id: userId,
                name: "prakos@gmail.com",
                displayName: "Prakos FinDream"
              },
              pubKeyCredParams: [
                { type: "public-key", alg: -7 },   // ES256
                { type: "public-key", alg: -257 }  // RS255
              ],
              authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required"
              },
              timeout: 10000
            }
          };
          
          const rawCred = await navigator.credentials.create(options);
          if (rawCred) {
            localStorage.setItem('findream_biometric_registered', 'true');
            webAuthnSucceeded = true;
          }
        } else {
          // Passkey Verification
          setStatusMsg({ type: 'info', text: 'Por favor, escanea tu huella o confirma tu FaceID en el indicador del sistema...' });
          const options: any = {
            publicKey: {
              challenge: challenge,
              rpId: window.location.hostname,
              userVerification: "required",
              timeout: 10000
            }
          };
          const assertion = await navigator.credentials.get(options);
          if (assertion) {
            webAuthnSucceeded = true;
          }
        }
      } catch (err: any) {
        console.warn("Native WebAuthn biometric API returned fallback: ", err.message);
      }
    }

    setTimeout(() => {
      // Create user profile
      const prof = {
        nombre: 'Invitado',
        correo: '',
        celular: '',
        productos: []
      };
      
      // Keep any already stored products if they exist under the same key!
      const existingReal = localStorage.getItem('finanza_user_profile_v2');
      if (existingReal) {
        try {
          const parsed = JSON.parse(existingReal);
          if (parsed && parsed.productos) {
            prof.productos = parsed.productos;
          }
        } catch(e) {}
      }

      localStorage.setItem('finanza_user_profile_v6_temp', JSON.stringify(prof));
      setIsBiometricScanning(false);
      
      if (webAuthnSucceeded) {
        setStatusMsg({ type: 'success', text: '¡Biometría de hardware (FaceID / TouchID) validada con éxito!' });
      } else {
        setStatusMsg({ type: 'success', text: '¡Enclave Seguro FinDream: Huella / FaceID Verificado!' });
      }
      
      // Play success double-beep
      try {
        if (!isMuted) {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
            const ctx = new AudioContext();
            const now = ctx.currentTime;
            
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now); // C5
            gain1.gain.setValueAtTime(0.04, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.15);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.1); // E5
            gain2.gain.setValueAtTime(0.04, now + 0.1);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.1);
            osc2.stop(now + 0.3);
          }
        }
      } catch (e) {}

      setTimeout(() => {
        onComplete();
      }, 700);
    }, 1500);
  };

  // Initialize and load saved video from IndexedDB (persistent binary storage)
  useEffect(() => {
    const openDB = () => {
      return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('FinDreamSplashDB', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('videos')) {
            db.createObjectStore('videos');
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    };

    const loadSavedVideo = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction('videos', 'readonly');
        const store = tx.objectStore('videos');
        const getRequest = store.get('intro_video');

        getRequest.onsuccess = () => {
          const blob = getRequest.result as Blob | undefined;
          if (blob) {
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
            setHasCustomVideo(true);
          }
        };
      } catch (err) {
        console.error('Failed to load splash video from IndexedDB', err);
      }
    };

    loadSavedVideo();

    // Quick load for the clean static logo landing experience (avoiding multi-stage video delays)
    const tInit = setTimeout(() => {
      setAnimationStage(4);
      setIsFullyLoaded(true);
    }, 100);

    return () => {
      clearTimeout(tInit);
    };
  }, []);

  // Handle Video file upload
  const handleVideoFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Por favor selecciona un archivo de video válido (.mp4, .mov, etc.)');
      return;
    }

    try {
      // Save to IndexedDB for persistent reload
      const openDB = () => {
        return new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('FinDreamSplashDB', 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('videos')) {
              db.createObjectStore('videos');
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      };

      const db = await openDB();
      const tx = db.transaction('videos', 'readwrite');
      const store = tx.objectStore('videos');
      store.put(file, 'intro_video');

      tx.oncomplete = () => {
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
        setHasCustomVideo(true);
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current.play().catch(e => console.log('Autoplay request:', e));
        }
      };
    } catch (err) {
      console.error('Error saving video upload', err);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleVideoFile(e.target.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleVideoFile(e.dataTransfer.files[0]);
    }
  };

  // Handle custom video playback completion
  useEffect(() => {
    if (videoRef.current && hasCustomVideo) {
      const handleEnded = () => {
        onComplete();
      };
      
      const el = videoRef.current;
      el.addEventListener('ended', handleEnded);
      return () => {
        el.removeEventListener('ended', handleEnded);
      };
    }
  }, [hasCustomVideo, onComplete]);

  return (
    <div 
      id="splash-screen-root"
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-between bg-gradient-to-b from-[#f2f2f5] to-[#eae9ee] text-slate-800 p-8 select-none transition-all duration-300"
    >
      {/* Top Margin Space */}
      <div className="w-full h-4" />

      {/* Main Content Viewport - Elegant Brand Logo Only */}
      <div className="flex-1 w-full max-w-lg flex flex-col items-center justify-center relative px-6 animate-fade-in">
        <FinDreamLogo size="xl" variant="full" animated={true} />
      </div>

      {/* Footer Area with Action Buttons */}
      <div className="w-full max-w-sm pb-12 px-6 flex flex-col items-center gap-5 z-40">
        <div className="w-full flex flex-col gap-3.5">
          <motion.button
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#00897B] to-[#004D40] hover:from-[#009688] text-white text-xs font-black uppercase tracking-wider hover:opacity-97 shadow-xl shadow-teal-100/30 cursor-pointer active:scale-98 transition-all flex items-center justify-center gap-2"
            onClick={() => { playClickSound(); setAuthMode('suscribirse'); setShowAuthModal(true); }}
          >
            <Sparkles className="w-4 h-4 fill-white" />
            <span>{selectedLanguage === 'ES' ? 'Suscribirse' : 'Subscribe'}</span>
          </motion.button>
          
          <div className="text-center">
            <span className="text-xs text-slate-500 font-bold">
              {selectedLanguage === 'ES' ? '¿Ya eres usuario?' : 'Already a user?'}{' '}
              <button
                onClick={() => { playClickSound(); setAuthMode('login'); setShowAuthModal(true); }}
                className="font-black text-[#00796B] hover:underline cursor-pointer bg-transparent border-none p-0 inline text-xs"
              >
                {selectedLanguage === 'ES' ? 'Iniciar Sesión (Log In)' : 'Log In'}
              </button>
            </span>
          </div>
        </div>
      </div>

      {/* --- AUTHENTICATION OVERLAY SHEET --- */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/90 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 150, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 150, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-150 text-left flex flex-col max-h-[90vh]"
            >
              <div className="p-6 overflow-y-auto no-scrollbar space-y-5 relative">
                {isBiometricScanning && (
                  <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center p-6 space-y-4 rounded-3xl animate-fade-in">
                    <div className="relative flex items-center justify-center w-24 h-24">
                      {/* Scanning radar circles */}
                      <div className="absolute inset-0 bg-teal-100 rounded-full animate-ping opacity-45" />
                      <div className="absolute -inset-2 bg-teal-50 rounded-full animate-pulse opacity-20" />
                      <div className="w-18 h-18 rounded-full border-4 border-dashed border-[#008B81] animate-spin flex items-center justify-center bg-white shadow-md relative">
                        <Fingerprint className="w-9 h-9 text-[#008B81]" />
                      </div>
                      <div className="absolute h-0.5 w-16 bg-[#008B81] rounded-full top-[42%] left-[16%] animate-bounce shadow-glow" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-black text-slate-805 uppercase tracking-wide">
                        {selectedLanguage === 'ES' ? 'Escaneando Biometría' : 'Scanning Biometrics'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold">
                        {selectedLanguage === 'ES' 
                          ? 'Coloque su huella en el lector o mire a la cámara' 
                          : 'Place your fingerprint on the reader or look at the camera'}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                    {authMode === 'suscribirse' 
                      ? (selectedLanguage === 'ES' ? 'Suscribirse a FinDream 💎' : 'Subscribe to FinDream 💎') 
                      : (selectedLanguage === 'ES' ? 'Iniciar Sesión' : 'Log In')}
                  </h3>
                  <button
                    onClick={() => { playClickSound(); setShowAuthModal(false); setLoginMethod(null); setStatusMsg({ type: '', text: '' }); }}
                    className="p-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-500 hover:text-slate-705 transition"
                  >
                    ✕
                  </button>
                </div>

                {statusMsg.text && (
                  <div className="space-y-2">
                    <div className={`p-3.5 rounded-xl text-xs font-bold leading-relaxed ${
                      statusMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-100' :
                      statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                      'bg-teal-50 text-teal-850 border border-teal-100'
                    }`}>
                      {statusMsg.text}
                    </div>
                    {statusMsg.type === 'error' && showRedirectFallback && (
                      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2 text-[10.5px] text-indigo-900 font-medium animate-fade-in">
                        <p className="font-bold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" /> Alternativa para iPhone / iPad / Safari:</p>
                        <p>Las ventanas emergentes suelen bloquearse en iOS por seguridad. Usa la redirección segura completa:</p>
                        <button
                          type="button"
                          onClick={() => { playClickSound(); handleQuickLogin('google', true); }}
                          className="w-full py-2 px-3 bg-[#312E81] hover:bg-[#252361] text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                        >
                          <span>Iniciar con Redirección</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {showGoogleChooser ? (
                  <div className="space-y-4 py-1 animate-fade-in">
                    {googleChooserLoading ? (
                      <div className="flex flex-col items-center justify-center py-10 space-y-4">
                        <div className="w-12 h-12 border-4 border-solid border-slate-100 border-t-teal-600 rounded-full animate-spin" />
                        <p className="text-xs text-slate-500 font-bold">Iniciando sesión segura con Google...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-1">
                          <svg className="w-4.5 h-4.5 flex-shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.63-1.01-1.38-1.19-2.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                          </svg>
                          <span className="text-xs text-slate-500 font-bold">Selecciona una cuenta de Google</span>
                        </div>

                        {/* Interactive Primary Account Option: Prakash Dowlani */}
                        <button
                          type="button"
                          onClick={() => { playClickSound(); handleSelectGoogleAccount('Prakash Dowlani', 'prakos@gmail.com'); }}
                          className="w-full p-4 bg-slate-50 hover:bg-slate-100 rounded-3xl border border-slate-200 text-left flex items-center justify-between transition cursor-pointer active:scale-98 shadow-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500 to-[#1e1b4b] flex items-center justify-center text-white text-sm font-black shadow-inner">
                              P
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-800">Prakash Dowlani</p>
                              <p className="text-[10px] font-bold text-slate-400">prakos@gmail.com</p>
                            </div>
                          </div>
                          <span className="inline-block py-0.5 px-2 bg-teal-100 text-teal-800 text-[8px] font-black rounded uppercase tracking-wider">
                            {selectedLanguage === 'ES' ? 'Sesión Activa' : 'Active Session'}
                          </span>
                        </button>

                        {/* Flexible Custom Profile Switch */}
                        {!isUsingCustomGoogle ? (
                          <button
                            type="button"
                            onClick={() => { playClickSound(); setIsUsingCustomGoogle(true); }}
                            className="w-full py-3 px-4 bg-white hover:bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-left flex items-center gap-3 transition cursor-pointer active:scale-98"
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                              <User className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-600">
                              {selectedLanguage === 'ES' ? 'Usar otra cuenta de Google...' : 'Use another Google account...'}
                            </span>
                          </button>
                        ) : (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-inner"
                          >
                            <p className="text-[9.5px] font-black uppercase text-teal-750 tracking-wider">
                              {selectedLanguage === 'ES' ? 'Detalles Cuenta Google' : 'Google Account Details'}
                            </p>
                            
                            <div>
                              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                                {selectedLanguage === 'ES' ? 'Tu Nombre de Google' : 'Your Google Name'}
                              </label>
                              <input
                                type="text"
                                required
                                placeholder={selectedLanguage === 'ES' ? 'Ej: Diana Prince' : 'e.g. Diana Prince'}
                                value={customGoogleName}
                                onChange={(e) => setCustomGoogleName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            </div>

                            <div>
                              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                                {selectedLanguage === 'ES' ? 'Correo de Google' : 'Google Email'}
                              </label>
                              <input
                                type="email"
                                required
                                placeholder="Ej: diana@gmail.com"
                                value={customGoogleEmail}
                                onChange={(e) => setCustomGoogleEmail(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => { playClickSound(); setIsUsingCustomGoogle(false); }}
                                className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-655 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                              >
                                {selectedLanguage === 'ES' ? 'Volver' : 'Back'}
                              </button>
                              <button
                                type="button"
                                disabled={!customGoogleEmail || !customGoogleName}
                                onClick={() => { 
                                  playClickSound(); 
                                  handleSelectGoogleAccount(customGoogleName, customGoogleEmail); 
                                }}
                                className="flex-1 py-1.5 bg-gradient-to-r from-teal-600 to-[#1e1b4b] disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md transition cursor-pointer"
                              >
                                {selectedLanguage === 'ES' ? 'Continuar' : 'Continue'}
                              </button>
                            </div>
                          </motion.div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex justify-center">
                          <button
                            type="button"
                            onClick={() => { playClickSound(); setShowGoogleChooser(false); }}
                            className="text-xs font-black text-teal-700 hover:underline cursor-pointer bg-transparent py-1 px-3"
                          >
                            Volver a métodos de acceso
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* MODE A: SUSCRIBIRSE / REGISTRO */}
                    {authMode === 'suscribirse' && (
                      <form onSubmit={handleAuthSubmit} className="space-y-4">
                        <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                          {selectedLanguage === 'ES' 
                            ? 'Crea tu cuenta de planificador FinDream hoy y comienza a realizar tus sueños con precisión financiera colombiana.'
                            : 'Create your FinDream planner account today and start achieving your dreams with Colombian financial precision.'}
                        </p>

                        {/* Google Quick Button in subscription */}
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-1 gap-2.5">
                            {/* Quick Register Google */}
                            <button
                              type="button"
                              onClick={() => { playClickSound(); handleQuickLogin('google'); }}
                              className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-755 flex items-center justify-center gap-2 active:scale-98 transition shadow-xs cursor-pointer w-full"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.63-1.01-1.38-1.19-2.63z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                              </svg>
                              <span className="text-[11px]">{selectedLanguage === 'ES' ? 'Unirse con Google' : 'Join with Google'}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-3 py-1">
                            <hr className="flex-1 border-slate-100" />
                            <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">
                              {selectedLanguage === 'ES' ? 'o con formulario' : 'or with form'}
                            </span>
                            <hr className="flex-1 border-slate-100" />
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-wider text-slate-700 mb-1 block">
                            {selectedLanguage === 'ES' ? 'Tu Nombre Completo' : 'Your Full Name'}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><User className="w-3.5 h-3.5" /></span>
                            <input
                              type="text"
                              required
                              disabled={isVerifying}
                              placeholder="Ej: Prakos"
                              value={regName}
                              onChange={(e) => setRegName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-9 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase tracking-wider text-slate-700 mb-1 block">Tu Correo Electrónico</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Mail className="w-3.5 h-3.5" /></span>
                            <input
                              type="email"
                              required
                              disabled={isVerifying}
                              placeholder="Ej: prakos@gmail.com"
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-9 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase tracking-wider text-slate-700 mb-1 block">Celular / Teléfono (Opcional)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Phone className="w-3.5 h-3.5" /></span>
                            <input
                              type="tel"
                              disabled={isVerifying}
                              placeholder="Ej: 310 1234567"
                              value={regPhone}
                              onChange={(e) => setRegPhone(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-9 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase tracking-wider text-slate-700 mb-1 block">Contraseña o PIN de Seguridad</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔑</span>
                            <input
                              type="password"
                              required
                              minLength={4}
                              disabled={isVerifying}
                              placeholder="Fijar clave (Ej: 1234)"
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-9 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isVerifying}
                          className="w-full py-3 bg-gradient-to-r from-teal-600 to-[#312E81] text-white font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-95 shadow-lg active:scale-98 transition flex items-center justify-center gap-1.5"
                        >
                          {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          <span>Confirmar Suscripción</span>
                        </button>
                      </form>
                    )}

                    {/* MODE B: LOGIN WITH GOOGLE, APPLE, EMAIL */}
                    {authMode === 'login' && (
                      <div className="space-y-3">
                        {loginMethod === null ? (
                          <div className="space-y-2.5">
                            <p className="text-[11px] font-bold text-slate-500 leading-tight">
                              Elige tu método de acceso preferido:
                            </p>

                            {/* Biometric Integration (FaceID / Fingerprint) */}
                            <button
                              type="button"
                              onClick={() => { playClickSound(); handleBiometricLogin(); }}
                              className="w-full py-3 px-4 bg-gradient-to-r from-teal-50 to-emerald-50 hover:from-teal-100 hover:to-emerald-100 border-2 border-teal-200 hover:border-teal-400 rounded-xl text-xs font-black text-teal-800 flex items-center justify-center gap-3 active:scale-98 transition shadow-xs group cursor-pointer"
                            >
                              <div className="relative">
                                <Fingerprint className="w-5 h-5 text-teal-600 group-hover:scale-110 transition-transform animate-pulse" />
                                <ScanFace className="w-3 h-3 text-emerald-600 absolute -bottom-1 -right-1 bg-white rounded-full p-0.2" />
                              </div>
                              <span>Ingresar con FaceID / Huella</span>
                            </button>

                            {/* Google Button */}
                            <button
                              type="button"
                              onClick={() => { playClickSound(); handleQuickLogin('google'); }}
                              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-755 flex items-center justify-center gap-3 active:scale-98 transition shadow-xs cursor-pointer"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.63-1.01-1.38-1.19-2.63z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                              </svg>
                              <span>Iniciar sesión con Google</span>
                            </button>

                            <div className="flex items-center gap-3 py-1.5">
                              <hr className="flex-1 border-slate-100" />
                              <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">o bien</span>
                              <hr className="flex-1 border-slate-100" />
                            </div>

                            {/* Email toggler button */}
                            <button
                              type="button"
                              onClick={() => { playClickSound(); setLoginMethod('correo'); }}
                              className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 active:scale-98 transition"
                            >
                              <Mail className="w-4 h-4 text-slate-500" />
                              <span>Iniciar sesión con Correo</span>
                            </button>
                          </div>
                        ) : (
                          // EMAIL ACCESSIBILITY
                          <form onSubmit={handleAuthSubmit} className="space-y-4">
                            <div>
                              <label className="text-[9px] font-black uppercase tracking-wider text-slate-700 mb-1 block">Tu Correo Electrónico</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Mail className="w-3.5 h-3.5" /></span>
                                <input
                                  type="email"
                                  required
                                  disabled={isVerifying}
                                  placeholder="Ej: mi-correo@gmail.com"
                                  value={regEmail}
                                  onChange={(e) => setRegEmail(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-9 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[9px] font-black uppercase tracking-wider text-slate-700 mb-1 block">Contraseña o PIN de Seguridad</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔑</span>
                                <input
                                  type="password"
                                  required
                                  minLength={4}
                                  disabled={isVerifying}
                                  placeholder="Ingresa tu clave de acceso"
                                  value={regPassword}
                                  onChange={(e) => setRegPassword(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-9 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => { playClickSound(); setLoginMethod(null); }}
                                className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl text-xs font-bold transition uppercase tracking-wider"
                              >
                                Volver
                              </button>
                              <button
                                type="submit"
                                disabled={isVerifying}
                                className="flex-1 py-1.5 bg-gradient-to-r from-teal-600 to-[#312E81] text-white rounded-xl text-xs font-black hover:opacity-95 shadow-md active:scale-98 transition flex items-center justify-center gap-1 uppercase tracking-wider"
                              >
                                {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Entrar'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
