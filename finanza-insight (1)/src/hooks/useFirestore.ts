import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { UserProfile, Transaccion, Sueno, Categoria } from '../types';

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
  setNotchAlert: (alert: { text: string; subtext: string; isPositive: boolean } | null) => void,
  selectedLanguage: string
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
    updatedPaymentMethods?: string[]
  ) => {
    try {
      const { auth } = await import('../firebase');
      const user = auth.currentUser;
      
      const userRefId = resolveUserId(user);
      if (!userRefId) return; // Strict local mode
      
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const userDocRef = doc(db, 'users', userRefId);
      const nowString = new Date().toISOString();
      const payload: any = { updatedAt: nowString };
      
      try { localStorage.setItem('finanza_last_local_update', nowString); } catch(e) {}

      if (updatedProfile) {
        payload.nombre = updatedProfile.nombre;
        payload.correo = updatedProfile.correo || (user?.email) || '';
        payload.celular = updatedProfile.celular;
        payload.productos = updatedProfile.productos || [];
        payload.portafolios = updatedProfile.portafolios || [];
      }
      
      if (updatedTransacciones) payload.transacciones = updatedTransacciones;
      if (updatedSuenos) payload.suenos = updatedSuenos;
      if (updatedCategorias) payload.categorias = updatedCategorias;
      if (updatedPaymentMethods) payload.paymentMethods = updatedPaymentMethods;
      
      setIsSyncing(true);
      await setDoc(userDocRef, JSON.parse(JSON.stringify(payload)), { merge: true });
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
      const { doc, setDoc, onSnapshot } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const userRefId = resolveUserId(user);
      if (!userRefId) {
        setIsSyncing(false);
        setIsLocalMode(true);
        // Problem A resolved: show alert if they are unauthenticated
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
              portafolios: data.portafolios || []
            };
            setUserProfile(loadedProfile);
            localStorage.setItem('finanza_user_profile_v2', JSON.stringify(loadedProfile));
          }
          if (Array.isArray(data.transacciones)) setTransacciones(data.transacciones);
          if (Array.isArray(data.suenos)) setSuenos(data.suenos);
          if (Array.isArray(data.categorias)) setCategorias(data.categorias);
          if (Array.isArray(data.paymentMethods)) setPaymentMethods(data.paymentMethods);
          
          setLastSyncedTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          setIsSyncing(false);
        } else {
          // First login initialization
          const payload = {
            nombre: userProfile.nombre || (user?.displayName) || 'Invitado',
            correo: userProfile.correo || (user?.email) || '',
            celular: userProfile.celular || '',
            productos: userProfile.productos || [],
            transacciones, suenos, categorias, paymentMethods,
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
        console.warn("Auth block detected, running unauthenticated bypass", e);
        if (!showSplash) syncWithFirestore(null);
      }
    };
    initAuthSync();
    return () => {
      if (unsubscribe) unsubscribe();
      if (syncUnsubscribeRef.current) syncUnsubscribeRef.current();
    };
  }, [showSplash]);

  return { isSyncing, lastSyncedTime, pushToFirestore, isLocalMode };
};
