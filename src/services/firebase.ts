import { initializeApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import {
  Firestore,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage'

const requiredFirebaseEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

export const firebaseConfigStatus = {
  isValid: requiredFirebaseEnvVars.every((key) => !!import.meta.env[key]),
  missingKeys: requiredFirebaseEnvVars.filter((key) => !import.meta.env[key]),
}

if (!firebaseConfigStatus.isValid) {
  console.warn('⚠️ Firebase configuration is missing required environment variables', {
    missingKeys: firebaseConfigStatus.missingKeys,
  })
}

// Initialize Firebase
export const app: FirebaseApp = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth: Auth = getAuth(app)
const enableLongPolling = import.meta.env.VITE_FIRESTORE_FORCE_LONG_POLLING === 'true'

export const db: Firestore = enableLongPolling
  ? initializeFirestore(app, {
      // Some privacy / ad-blocking extensions can block the default streaming
      // transport. Enabling long polling keeps Firestore realtime listeners
      // functional in those environments.
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
    })
  : getFirestore(app)
export const storage: FirebaseStorage = getStorage(app)
