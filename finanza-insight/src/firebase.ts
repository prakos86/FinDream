import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, inMemoryPersistence, browserLocalPersistence, indexedDBLocalPersistence, GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

// Prevent third-party cookie/IndexedDB blocks in Sandbox Iframes (e.g. Chrome)
setPersistence(auth, indexedDBLocalPersistence).catch(() => {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    setPersistence(auth, inMemoryPersistence).catch(() => {});
  });
});

let cachedAccessToken: string | null = null;
let cachedScopes: string[] = [];

export const getGoogleAccessToken = async (scopes: string[] = []): Promise<string> => {
  if (cachedAccessToken && scopes.every(s => cachedScopes.includes(s))) {
    return cachedAccessToken;
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  scopes.forEach(scope => {
    provider.addScope(scope);
    if (!cachedScopes.includes(scope)) cachedScopes.push(scope);
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  
  if (credential?.accessToken) {
    cachedAccessToken = credential.accessToken;
    return credential.accessToken;
  }
  throw new Error('Failed to get Google Access Token');
};


// Strict Firestore Error Hardening according to SKILL.md
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
