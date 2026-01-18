/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_STRIPE_PUBLIC_KEY: string
  readonly VITE_APP_BASE_URL: string
  readonly VITE_APP_URL: string
  readonly VITE_PUBLIC_APP_URL: string
  readonly VITE_EXTERNAL_EVENTS_MANAGEMENT_URL: string
  readonly VITE_FIRESTORE_FORCE_LONG_POLLING: string
  readonly VITE_BOOTSTRAP_ADMIN_EMAILS: string
  readonly VITE_ENABLE_PROFILE_REALTIME: string
  readonly VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
