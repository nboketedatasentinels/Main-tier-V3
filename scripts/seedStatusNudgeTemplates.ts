import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import * as dotenv from 'dotenv'

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

const DEFAULT_TEMPLATES = [
  {
    name: 'Warning Status Nudge',
    subject: '⚠️ Stay on track with your weekly goals',
    message_body: 'Hi {{userName}}, you are just {{pointsGap}} points away from hitting your weekly target of {{weeklyTarget}}. Log an activity today to stay on track!',
    template_type: 'Status Warning',
    is_active: true
  },
  {
    name: 'Alert Status Nudge',
    subject: '🔴 Important: Your weekly progress needs attention',
    message_body: 'Hi {{userName}}, we noticed you have fallen behind on your weekly goals. You still need {{pointsGap}} points to reach your target. Your mentor {{mentorName}} is available if you need support.',
    template_type: 'Status Alert',
    is_active: true
  },
  {
    name: 'Recovery Status Nudge',
    subject: '🎉 Great job getting back on track!',
    message_body: 'Hi {{userName}}, fantastic work! You have successfully recovered your status and are back on track. Keep up the great momentum!',
    template_type: 'Status Recovery',
    is_active: true
  },
  {
    name: 'On Track Status Nudge',
    subject: '🌟 You are crushing your goals!',
    message_body: 'Hi {{userName}}, you are currently on track and meeting all your targets. Great consistency! Keep leading the way.',
    template_type: 'Status On Track',
    is_active: true
  }
]

async function seedTemplates() {
  console.log('🌱 Seeding Status Nudge Templates...')
  const templatesRef = collection(db, 'nudge_templates')

  for (const template of DEFAULT_TEMPLATES) {
    const q = query(templatesRef, where('template_type', '==', template.template_type))
    const existing = await getDocs(q)

    if (existing.empty) {
      await addDoc(templatesRef, {
        ...template,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      })
      console.log(`✅ Created template: ${template.name}`)
    } else {
      console.log(`ℹ️ Template already exists for category: ${template.template_type}`)
    }
  }
  console.log('🏁 Seeding complete.')
}

seedTemplates().catch(console.error)
