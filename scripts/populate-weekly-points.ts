import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
  getDocs,
  query,
  limit,
} from 'firebase/firestore'
import { startOfISOWeek, endOfISOWeek, getISOWeek } from 'date-fns'

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

async function populateWeeklyPoints() {
  try {
    console.log('Fetching users from profiles collection...')

    const profilesQuery = query(collection(db, 'profiles'), limit(10))
    const profilesSnapshot = await getDocs(profilesQuery)

    if (profilesSnapshot.empty) {
      console.log('No users found. Please create a user account first.')
      return
    }

    console.log(`Found ${profilesSnapshot.size} users`)

    const weekNumber = getISOWeek(new Date())
    const weekYear = new Date().getFullYear()
    const weekStart = startOfISOWeek(new Date())
    const weekEnd = endOfISOWeek(new Date())

    for (const profileDoc of profilesSnapshot.docs) {
      const userId = profileDoc.id
      const userData = profileDoc.data()

      console.log(`Creating weekly points for user: ${userData.email || userId}`)

      const weeklyPointsData = {
        user_id: userId,
        week_number: weekNumber,
        week_year: weekYear,
        points_earned: Math.floor(Math.random() * 3000),
        target_points: 2500,
        engagement_count: Math.floor(Math.random() * 10),
        status: ['on_track', 'warning', 'at_risk'][Math.floor(Math.random() * 3)],
        week_start: Timestamp.fromDate(weekStart),
        week_end: Timestamp.fromDate(weekEnd),
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      }

      await addDoc(collection(db, 'weekly_points'), weeklyPointsData)
      console.log(`  ✓ Created weekly points record`)

      const userPointsData = {
        userId: userId,
        source: 'test_activity',
        points: Math.floor(Math.random() * 1000) + 500,
        recordedAt: Timestamp.now(),
      }

      await addDoc(collection(db, 'user_points'), userPointsData)
      console.log(`  ✓ Created user points record`)
    }

    console.log('\n✅ Successfully populated weekly points data!')
    console.log('You can now view the data in the Weekly Glance page.')

  } catch (error) {
    console.error('Error populating weekly points:', error)
  }
}

populateWeeklyPoints()
