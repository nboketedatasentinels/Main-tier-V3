import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import pointsConfig from '@/config/pointsConfig'
import type { JourneyType } from '@/config/pointsConfig'

const { JOURNEY_META } = pointsConfig

export type JourneyStatus = 'ON_TRACK' | 'WARNING' | 'ALERT' | 'RECOVERY'

export type UserJourneyTypeLabel = '4-week' | '6-week' | '3-month' | '6-month' | '9-month'

export interface UserJourney {
  userId: string
  journeyType: UserJourneyTypeLabel
  journeyStartDate: string
  currentWindow: number
  windowTarget: number
  totalPoints: number
  status: JourneyStatus
  badges: string[]
}

const mapJourneyTypeToLabel = (journeyType: JourneyType | undefined): UserJourneyTypeLabel => {
  switch (journeyType) {
    case '6W':
      return '6-week'
    case '3M':
      return '3-month'
    case '6M':
      return '6-month'
    case '9M':
      return '9-month'
    case '4W':
    default:
      return '4-week'
  }
}

const mapLabelToJourneyType = (label: UserJourneyTypeLabel): JourneyType => {
  switch (label) {
    case '6-week':
      return '6W'
    case '3-month':
      return '3M'
    case '6-month':
      return '6M'
    case '9-month':
      return '9M'
    case '4-week':
    default:
      return '4W'
  }
}

export const getUserJourney = async (userId: string): Promise<UserJourney> => {
  const ref = doc(db, 'user_journeys', userId)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    const data = snap.data() as Omit<UserJourney, 'userId'>
    return { userId, ...data }
  }

  // Fallback: derive from user profile (try 'users' first, then 'profiles')
  const usersSnap = await getDoc(doc(db, 'users', userId))
  const profilesSnap = await getDoc(doc(db, 'profiles', userId))
  const profileData = (usersSnap.exists() ? usersSnap.data() : profilesSnap.exists() ? profilesSnap.data() : null) as
    | { journeyType?: JourneyType; journeyStartDate?: string; totalPoints?: number }
    | null

  let journeyType: JourneyType = '4W'
  let startDate = new Date()
  let totalPoints = 0

  if (profileData) {
    if (profileData.journeyType) {
      journeyType = profileData.journeyType
    }
    if (profileData.journeyStartDate) {
      const parsed = new Date(profileData.journeyStartDate)
      if (!Number.isNaN(parsed.getTime())) {
        startDate = parsed
      }
    }
    if (typeof profileData.totalPoints === 'number' && Number.isFinite(profileData.totalPoints)) {
      totalPoints = profileData.totalPoints
    }
  }

  const label = mapJourneyTypeToLabel(journeyType)
  const meta = JOURNEY_META[journeyType]
  const windowTarget = meta?.windowTarget ?? 12500

  const journey: UserJourney = {
    userId,
    journeyType: label,
    journeyStartDate: startDate.toISOString(),
    currentWindow: 1,
    windowTarget,
    totalPoints,
    status: 'ON_TRACK',
    badges: [],
  }

  await setDoc(ref, { ...journey })
  return journey
}

export const updateUserJourneyPoints = async (userId: string, deltaPoints: number): Promise<void> => {
  if (!deltaPoints) return
  const ref = doc(db, 'user_journeys', userId)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    const journey = await getUserJourney(userId)
    const nextTotal = Math.max(0, journey.totalPoints + deltaPoints)
    await setDoc(ref, { ...journey, totalPoints: nextTotal })
    return
  }

  const data = snap.data() as Omit<UserJourney, 'userId'>
  const nextTotal = Math.max(0, (data.totalPoints || 0) + deltaPoints)
  await setDoc(ref, { ...data, totalPoints: nextTotal }, { merge: true })
}

export const getCurrentWindowId = (journey: UserJourney): string => {
  const baseType = mapLabelToJourneyType(journey.journeyType)
  const windowNumber = journey.currentWindow || 1
  // Simple identifier such as "4W-window-1"
  return `${baseType}-window-${windowNumber}`
}

