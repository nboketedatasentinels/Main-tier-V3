import { initializeApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import {
  Firestore,
  FirestoreSettings,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage'
import { getFunctions, Functions } from 'firebase/functions'

const requiredFirebaseEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

type FirebaseEnvKey = (typeof requiredFirebaseEnvVars)[number]

const placeholderValues = new Set([
  'your_firebase_api_key_here',
  'your_firebase_auth_domain_here',
  'your_firebase_project_id_here',
  'your_firebase_storage_bucket_here',
  'your_firebase_messaging_sender_id_here',
  'your_firebase_app_id_here',
])

const firebaseEnv = requiredFirebaseEnvVars.reduce(
  (acc, key) => ({
    ...acc,
    [key]: (import.meta.env[key] ?? '').toString(),
  }),
  {} as Record<FirebaseEnvKey, string>
)

const missingKeys = requiredFirebaseEnvVars.filter((key) => !firebaseEnv[key])
const placeholderKeys = requiredFirebaseEnvVars.filter((key) =>
  placeholderValues.has(firebaseEnv[key].toLowerCase()) || firebaseEnv[key].toLowerCase().startsWith('your_')
)

export const firebaseConfigStatus = {
  isValid: missingKeys.length === 0 && placeholderKeys.length === 0,
  missingKeys,
  placeholderKeys,
}

if (!firebaseConfigStatus.isValid) {
  const messageParts = [
    missingKeys.length > 0
      ? `missing required environment variables: ${missingKeys.join(', ')}`
      : null,
    placeholderKeys.length > 0
      ? `using placeholder values for: ${placeholderKeys.join(', ')}`
      : null,
  ].filter(Boolean)

  const guidance =
    'Please copy .env.example to .env and provide real Firebase credentials before running the app.'

  throw new Error(`Firebase configuration is invalid (${messageParts.join('; ')}). ${guidance}`)
}

// Firebase configuration
const firebaseConfig = {
  apiKey: firebaseEnv.VITE_FIREBASE_API_KEY,
  authDomain: firebaseEnv.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseEnv.VITE_FIREBASE_PROJECT_ID,
  storageBucket: firebaseEnv.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseEnv.VITE_FIREBASE_APP_ID,
}

// Initialize Firebase
export const app: FirebaseApp = initializeApp(firebaseConfig)

// Bridge the (public) Firebase config to same-origin static HTML pages
// like /capstones/*.html, so they can re-use the learner's auth session
// without each page hard-coding the keys.
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('t4l_fb_config', JSON.stringify(firebaseConfig))
  }
} catch {
  // localStorage may be unavailable (private browsing); non-fatal.
}

// Initialize Firebase services
//
// Auth now runs on Supabase (see src/services/supabase.ts). The app no longer
// calls Firebase Auth, but several legacy/dead services still import `auth`
// (mostly `auth.currentUser`). We keep the export but initialize it LAZILY:
// getAuth() - and the `getProjectConfig` network call it fires against the
// decommissioned Firebase project (the noisy `iframe.js ... 400`) - only runs
// if something actually touches `auth`, never on a normal page load.
let _auth: Auth | null = null
const resolveAuth = (): Auth => {
  if (!_auth) _auth = getAuth(app)
  return _auth
}
export const auth: Auth = new Proxy({} as Auth, {
  get: (_target, prop) => {
    const instance = resolveAuth() as unknown as Record<string | symbol, unknown>
    const value = instance[prop]
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value
  },
  set: (_target, prop, value) => {
    const instance = resolveAuth() as unknown as Record<string | symbol, unknown>
    instance[prop] = value
    return true
  },
}) as Auth
const enableLongPolling = import.meta.env.VITE_FIRESTORE_FORCE_LONG_POLLING === 'true'
const firestoreSettings: FirestoreSettings = {
  // Some privacy / ad-blocking extensions can block the default streaming
  // transport. Enabling long polling keeps Firestore realtime listeners
  // functional in those environments.
  experimentalAutoDetectLongPolling: true,
}

export const db: Firestore = enableLongPolling
  ? initializeFirestore(app, firestoreSettings)
  : getFirestore(app)
export const storage: FirebaseStorage = getStorage(app)
export const functions: Functions = getFunctions(app)
