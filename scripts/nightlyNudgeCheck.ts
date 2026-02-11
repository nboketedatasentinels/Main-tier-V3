import { collection, query, where, getDocs } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import * as dotenv from 'dotenv'
import { triggerNudgeByStatus } from '../src/services/nudgeTriggerService'

dotenv.config()

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function nightlyNudgeCheck() {
  console.log('🌙 Starting Nightly Nudge Check...')

  // 1. Get all active window progress docs with warning or alert status
  const progressRef = collection(db, 'windowProgress')
  const q = query(progressRef, where('status', 'in', ['warning', 'alert']))

  const snapshot = await getDocs(q)
  console.log(`Found ${snapshot.size} users in warning/alert status.`)

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data()
    const { uid, journeyType, status, pointsEarned, windowTarget } = data

    try {
      console.log(`Processing nudge for user ${uid} (Status: ${status})...`)
      await triggerNudgeByStatus({
        uid,
        journeyType,
        status,
        pointsEarned,
        windowTarget
      })
    } catch (error) {
      console.error(`Error nudging user ${uid}:`, error)
    }
  }

  console.log('🏁 Nightly Nudge Check complete.')
}

nightlyNudgeCheck().catch(console.error)
