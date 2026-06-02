import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { UserProfile, Transaccion, Sueno, Categoria, Suscripcion } from '../types';

export const useFirestore = (
  showSplash: boolean,
  userProfile: UserProfile,
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>,
  transacciones: Transaccion[],
  setTransacciones: React.Dispatch<React.SetStateAction<Transaccion[]>>,
  suenos: Sueno[],
  setSuenos: React.Dispatch<React.SetStateAction<Sueno[]>>,
  categorias: Omit<Categoria, 'monto'>[],
  setCategorias: React.Dispatch<React.SetStateAction<Omit<Categoria, 'monto'>[]>>,
  paymentMethods: string[],
  setPaymentMethods: React.Dispatch<React.SetStateAction<string[]>>,
  suscripciones: Suscripcion[],
  setSuscripciones: React.Dispatch<React.SetStateAction<Suscripcion[]>>,
  setNotchAlert: (alert: { text: string; subtext: string; isPositive: boolean } | null) => void,
  selectedLanguage: string,
  selectedCountry: 'CO' | 'CL'
) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState<boolean | null>(null);
  const syncUnsubscribeRef = useRef<(() => void) | null>(null);

  const resolveUserId = (user: any): string | null => {
    if (!user) return null;

    if (user.isAnonymous) {
      // Setup identical document identification for Sandbox anonymous custom logins
      try {
        const savedTemp = localStorage.getItem('finanza_user_profile_v6_temp');
        if (savedTemp) {
          const parsed = JSON.parse(savedTemp);
          if (parsed.correo) return parsed.correo.toLowerCase().trim();
        }
      } catch {}
      try {
        const savedReal = localStorage.getItem('finanza_user_profile_v2');
        if (savedReal) {
          const parsed = JSON.parse(savedReal);
          if (parsed.correo) return parsed.correo.toLowerCase().trim();
        }
      } catch {}
      if (userProfile && userProfile.correo) {
        return userProfile.correo.toLowerCase().trim();
      }
      return user.uid;
    }

    // Standard Google Session - resolve identically to splash redirect identifiers
    return (user.email && user.email.includes('@')) ? user.email.toLowerCase().trim() : user.uid;
  };

  const pushToFirestore = async (
    updatedProfile?: UserProfile,
    updatedTransacciones?: Transaccion[],
    updatedSuenos?: Sueno[],
    updatedCategorias?: any[],
    updatedPaymentMethods?: string[],
    updatedSuscripciones?: Suscripcion[]
  ) => {
    try {
      const { auth } = await import('../firebase');
      const user = auth.currentUser;
      
      const userRefId = resolveUserId(user);
      if (!userRefId) return;
      
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const userDocRef = doc(db, 'users', userRefId);
      const financialDocRef = doc(db, 'users', userRefId, 'paises', selectedCountry);
      const nowString = new Date().toISOString();
      const esAdmin = Boolean(userProfile?.correo?.toLowerCase().trim() === 'prakos@gmail.com' || (user?.email && user.email.toLowerCase().trim() === 'prakos@gmail.com'));
      
      if (!esAdmin) {
        const payload: any = { updatedAt: nowString };
        try { localStorage.setItem('finanza_last_local_update', nowString); } catch(e) {}

        if (updatedProfile) {
          payload.nombre = updatedProfile.nombre;
          payload.correo = updatedProfile.correo || (user?.email) || '';
          payload.celular = updatedProfile.celular;
          payload.productos = updatedProfile.productos || [];
          payload.portafolios = updatedProfile.portafolios || [];
          payload.suscripciones = updatedProfile.suscripciones || [];
        }
        
        if (updatedTransacciones) payload.transacciones = updatedTransacciones;
        if (updatedSuenos) payload.suenos = updatedSuenos;
        if (updatedCategorias) payload.categorias = updatedCategorias;
        if (updatedPaymentMethods) payload.paymentMethods = updatedPaymentMethods;
        if (updatedSuscripciones) payload.suscripciones = updatedSuscripciones;
        
        setIsSyncing(true);
        await setDoc(userDocRef, JSON.parse(JSON.stringify(payload)), { merge: true });
        setLastSyncedTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        return;
      }

      const userPayload: any = { updatedAt: nowString };
      const financialPayload: any = { updatedAt: nowString };
      
      try { localStorage.setItem(`finanza_last_local_update_${selectedCountry}`, nowString); } catch(e) {}

      if (updatedProfile) {
        userPayload.nombre = updatedProfile.nombre;
        userPayload.correo = updatedProfile.correo || (user?.email) || '';
        userPayload.celular = updatedProfile.celular;
        if (updatedProfile.productos) financialPayload.productos = updatedProfile.productos;
        if (updatedProfile.portafolios) financialPayload.portafolios = updatedProfile.portafolios;
        if (updatedProfile.suscripciones) financialPayload.suscripciones = updatedProfile.suscripciones;
      }
      
      if (updatedTransacciones) financialPayload.transacciones = updatedTransacciones;
      if (updatedSuenos) financialPayload.suenos = updatedSuenos;
      if (updatedCategorias) financialPayload.categorias = updatedCategorias;
      if (updatedPaymentMethods) financialPayload.paymentMethods = updatedPaymentMethods;
      if (updatedSuscripciones) financialPayload.suscripciones = updatedSuscripciones;
      
      setIsSyncing(true);
      await Promise.all([
        Object.keys(userPayload).length > 1 ? setDoc(userDocRef, JSON.parse(JSON.stringify(userPayload)), { merge: true }) : Promise.resolve(),
        Object.keys(financialPayload).length > 1 ? setDoc(financialDocRef, JSON.parse(JSON.stringify(financialPayload)), { merge: true }) : Promise.resolve()
      ]);
      setLastSyncedTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.error("Firestore cloud backup failed:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncWithFirestore = async (user: any) => {
    setIsSyncing(true);
    try {
      const { doc, setDoc, getDoc, onSnapshot } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const userRefId = resolveUserId(user);
      if (!userRefId) {
        setIsSyncing(false);
        setIsLocalMode(true);
        setTimeout(() => {
          setNotchAlert({
            text: selectedLanguage === 'ES' ? 'Modo Local Activo' : 'Local Mode Active',
            subtext: selectedLanguage === 'ES' ? 'Tus datos no se respaldan en la nube. Inicia sesión con Google para sincronizar.' : 'Your data is only stored locally. Sign in with Google to sync.',
            isPositive: false
          });
          setTimeout(() => setNotchAlert(null), 8000);
        }, 2000);
        return; 
      }
      
      setIsLocalMode(false);
      const userDocRef = doc(db, 'users', userRefId);
      const esAdmin = Boolean(userProfile?.correo?.toLowerCase().trim() === 'prakos@gmail.com' || (user?.email && user.email.toLowerCase().trim() === 'prakos@gmail.com'));

      if (!esAdmin) {
        if (syncUnsubscribeRef.current) syncUnsubscribeRef.current();

        syncUnsubscribeRef.current = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.nombre) {
              const loadedProfile: UserProfile = {
                nombre: data.nombre,
                correo: data.correo || (user?.email) || '',
                celular: data.celular || '',
                productos: data.productos || [],
                portafolios: data.portafolios || [],
                suscripciones: data.suscripciones || []
              };
              setUserProfile(loadedProfile);
              localStorage.setItem('finanza_user_profile_v2', JSON.stringify(loadedProfile));
            }
            if (Array.isArray(data.transacciones)) setTransacciones(data.transacciones);
            if (Array.isArray(data.suenos)) setSuenos(data.suenos);
            if (Array.isArray(data.categorias)) setCategorias(data.categorias);
            if (Array.isArray(data.paymentMethods)) setPaymentMethods(data.paymentMethods);
            if (Array.isArray(data.suscripciones)) setSuscripciones(data.suscripciones);
            
            setLastSyncedTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            setIsSyncing(false);
          } else {
            // First login initialization
            const payload = {
              nombre: userProfile.nombre || (user?.displayName) || 'Invitado',
              correo: userProfile.correo || (user?.email) || '',
              celular: userProfile.celular || '',
              productos: userProfile.productos || [],
              transacciones, suenos, categorias, paymentMethods, suscripciones,
              updatedAt: new Date().toISOString()
            };
            setDoc(userDocRef, payload).catch(e => console.error(e));
            setLastSyncedTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            setIsSyncing(false);
          }
        }, (e) => {
           console.error("Firestore onSnapshot error:", e);
           setIsSyncing(false);
        });
        return;
      }

      const countryDocRef = doc(db, 'users', userRefId, 'paises', selectedCountry);

      // MIGRATION BLOCK: Migrate legacy `users/{userId}` financial data to `users/{userId}/paises/CO` if applicable.
      try {
         const userDocSnap = await getDoc(userDocRef);
         if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            if (data.transacciones || data.productos || data.paymentMethods) {
               const coDocSnap = await getDoc(doc(db, 'users', userRefId, 'paises', 'CO'));
               if (!coDocSnap.exists()) {
                  await setDoc(doc(db, 'users', userRefId, 'paises', 'CO'), {
                     transacciones: data.transacciones || [],
                     suenos: data.suenos || [],
                     categorias: data.categorias || [],
                     productos: data.productos || [],
                     portafolios: data.portafolios || [],
                     paymentMethods: data.paymentMethods || [],
                     suscripciones: data.suscripciones || [],
                     updatedAt: new Date().toISOString()
                  }, { merge: false });
               }
            }
         }
      } catch (e) {
         console.warn("Migration check failed", e);
      }

      if (syncUnsubscribeRef.current) syncUnsubscribeRef.current();

      syncUnsubscribeRef.current = onSnapshot(countryDocRef, async (countrySnap) => {
        const userSnap = await getDoc(userDocRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        if (countrySnap.exists()) {
          const financialData = countrySnap.data();
          
          if (userData.nombre || (user?.displayName)) {
            const loadedProfile: UserProfile = {
              nombre: userData.nombre || (user?.displayName) || 'Invitado',
              correo: userData.correo || (user?.email) || '',
              celular: userData.celular || '',
              productos: financialData.productos || [],
              portafolios: financialData.portafolios || [],
              suscripciones: financialData.suscripciones || []
            };
            setUserProfile(loadedProfile);
            localStorage.setItem(`finanza_user_profile_v2_${selectedCountry}`, JSON.stringify(loadedProfile));
          }
          if (Array.isArray(financialData.transacciones)) setTransacciones(financialData.transacciones);
          if (Array.isArray(financialData.suenos)) setSuenos(financialData.suenos);
          if (Array.isArray(financialData.categorias)) setCategorias(financialData.categorias);
          if (Array.isArray(financialData.paymentMethods)) setPaymentMethods(financialData.paymentMethods);
          if (Array.isArray(financialData.suscripciones)) setSuscripciones(financialData.suscripciones);
          
          setLastSyncedTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          setIsSyncing(false);
        } else {
          // First login initialization for this ecosystem
          const payloadFinancial = {
            productos: selectedCountry === 'CO' ? (userProfile.productos || []) : [],
            portafolios: selectedCountry === 'CO' ? (userProfile.portafolios || []) : [],
            transacciones: selectedCountry === 'CO' ? transacciones : [],
            suenos: selectedCountry === 'CO' ? suenos : [],
            suscripciones: selectedCountry === 'CO' ? suscripciones : [],
            categorias: selectedCountry === 'CO' ? categorias : [
              { nombre: 'Vivienda', icon: 'Home', color: '#8B5A2B' },
              { nombre: 'Transporte', icon: 'Car', color: '#EF4444' },
              { nombre: 'Alimentación', icon: 'Utensils', color: '#F97316' },
              { nombre: 'Servicios', icon: 'Zap', color: '#FBBF24' },
              { nombre: 'Salud', icon: 'Heart', color: '#F43F5E' },
              { nombre: 'Educación', icon: 'BookOpen', color: '#3B82F6' },
              { nombre: 'Entretenimiento', icon: 'Sparkles', color: '#10B981' },
              { nombre: 'Ahorro', icon: 'PieChart', color: '#8B5CF6' }
            ],
            paymentMethods: selectedCountry === 'CO' ? paymentMethods : ['Efectivo', 'Tarjeta de Débito', 'Tarjeta de Crédito', 'Transferencia Bancaria'],
            updatedAt: new Date().toISOString()
          };
          const payloadUser = {
            nombre: userProfile.nombre || userData.nombre || (user?.displayName) || 'Invitado',
            correo: userProfile.correo || userData.correo || (user?.email) || '',
            celular: userProfile.celular || userData.celular || '',
            updatedAt: new Date().toISOString()
          };
          
          await setDoc(userDocRef, payloadUser, { merge: true }).catch(e => console.error(e));
          await setDoc(countryDocRef, payloadFinancial).catch(e => console.error(e));
          setLastSyncedTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          setIsSyncing(false);
        }
      }, (e) => {
        console.error("Firestore onSnapshot error:", e);
        setIsSyncing(false);
      });

    } catch (e) {
      console.error("Firestore setup failed:", e);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const initAuthSync = async () => {
      try {
        const { auth } = await import('../firebase');
        unsubscribe = auth.onAuthStateChanged((user) => {
          if (!showSplash) syncWithFirestore(user);
        });
        if (!showSplash) syncWithFirestore(auth.currentUser || null);
      } catch (e) {
        console.error("Auth initialization failed:", e);
      }
    };
    initAuthSync();
    return () => {
      if (unsubscribe) unsubscribe();
      if (syncUnsubscribeRef.current) syncUnsubscribeRef.current();
    };
  }, [showSplash, selectedCountry]);

  return { isSyncing, lastSyncedTime, pushToFirestore, isLocalMode };
};
