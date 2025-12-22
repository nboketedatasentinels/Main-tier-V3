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

// Initialize Firebase services
export const auth: Auth = getAuth(app)
const enableLongPolling = import.meta.env.VITE_FIRESTORE_FORCE_LONG_POLLING === 'true'

export const db: Firestore = enableLongPolling
  ? initializeFirestore(app, {
      // Some privacy / ad-blocking extensions can block the default streaming
      // transport. Enabling long polling keeps Firestore realtime listeners
      // functional in those environments.
      experimentalAutoDetectLongPolling: true,
    })
  : getFirestore(app)
export const storage: FirebaseStorage = getStorage(app)
