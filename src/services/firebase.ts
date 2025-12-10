import { FirebaseError, initializeApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage'

// Firebase configuration
const trimEnvValue = (value: string | undefined) => (value ? value.trim() : '')

const firebaseConfig = {
  apiKey: trimEnvValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: trimEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: trimEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: trimEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: trimEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: trimEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
}

const requiredFirebaseKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

type FirebaseEnvKey = (typeof requiredFirebaseKeys)[number]

const createFirebaseEnvReport = () => {
  const missingKeys: FirebaseEnvKey[] = requiredFirebaseKeys.filter((key) => {
    const value = import.meta.env[key]
    return !value || value.toString().trim().length === 0
  })

  const configSnapshot = {
    apiKeyPresent: Boolean(firebaseConfig.apiKey),
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderIdPresent: Boolean(firebaseConfig.messagingSenderId),
    appIdPresent: Boolean(firebaseConfig.appId),
  }

  return { missingKeys, configSnapshot }
}

const getAuthDiagnostics = (authInstance: Auth) => {
  const authWithConfig = authInstance as unknown as {
    config?: { authDomain?: string }
    persistenceManager?: { constructor?: { name?: string } }
    _getSdkClientVersion?: () => string
  }

  return {
    authDomain: authWithConfig.config?.authDomain,
    persistence: authWithConfig.persistenceManager?.constructor?.name,
    sdkVersion: authWithConfig._getSdkClientVersion?.(),
  }
}

const logFirebaseInitialization = () => {
  const { missingKeys, configSnapshot } = createFirebaseEnvReport()

  if (missingKeys.length > 0) {
    console.warn('[Firebase] Missing environment variables detected', {
      missingKeys,
      configSnapshot,
    })
  } else {
    console.info('[Firebase] Environment variables loaded successfully', configSnapshot)
  }
}

// Initialize Firebase
export const app: FirebaseApp = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth: Auth = getAuth(app)
export const db: Firestore = getFirestore(app)
export const storage: FirebaseStorage = getStorage(app)

logFirebaseInitialization()

export const logFirebaseAuthHealth = () => {
  try {
    const { missingKeys } = createFirebaseEnvReport()
    const { authDomain, persistence, sdkVersion } = getAuthDiagnostics(auth)

    console.info('[Firebase] Initialization status', {
      appName: app.name,
      authDomain,
      persistence,
      missingEnvKeys: missingKeys,
      sdkVersion,
    })
  } catch (error) {
    const firebaseError = error as FirebaseError
    console.error('[Firebase] Failed to read auth configuration', {
      code: firebaseError.code,
      message: firebaseError.message,
      name: firebaseError.name,
      stack: firebaseError.stack,
    })
  }
}

export const getFirebaseConfigSnapshot = () => createFirebaseEnvReport()
