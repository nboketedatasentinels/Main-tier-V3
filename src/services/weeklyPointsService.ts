import {
  collection,
  addDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  Timestamp,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { getCurrentWeekNumber, getWeekDateRange } from '@/utils/weekCalculations'

export interface WeeklyPointsData {
  user_id: string
  week_number: number
  week_year: number
  points_earned: number
  target_points: number
  engagement_count: number
  status: 'on_track' | 'warning' | 'at_risk'
  week_start: Timestamp
  week_end: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
}

const MINIMUM_WEEKLY_TARGET_POINTS = 4000
const LOW_WEEKLY_POINTS_ALERT_THRESHOLD = MINIMUM_WEEKLY_TARGET_POINTS

export const calculateWeeklyStatus = (
  earned: number,
  target: number,
): 'on_track' | 'warning' | 'at_risk' => {
  if (target === 0) return 'on_track'
  const percentage = (earned / target) * 100

  if (percentage >= 70) return 'on_track'
  if (percentage >= 40) return 'warning'
  return 'at_risk'
}

export const getOrCreateWeeklyPoints = async (userId: string): Promise<void> => {
  const weekNumber = getCurrentWeekNumber()
  const weekYear = new Date().getFullYear()
  const { start, end } = getWeekDateRange()

  // Check if record exists
  const q = query(
    collection(db, 'weekly_points'),
    where('user_id', '==', userId),
    where('week_number', '==', weekNumber),
    where('week_year', '==', weekYear),
  )

  const existingDocs = await getDocs(q)

  if (existingDocs.empty) {
    // Get user's target from their journey or profile
    const profileDoc = await getDoc(doc(db, 'profiles', userId))
    let targetPoints = MINIMUM_WEEKLY_TARGET_POINTS

    if (profileDoc.exists()) {
      const profileData = profileDoc.data()
      // If user has a current journey, get its minimum weekly points requirement
      if (profileData.currentJourneyId) {
        const journeyDoc = await getDoc(doc(db, 'journeys', profileData.currentJourneyId))
        if (journeyDoc.exists()) {
          const journeyData = journeyDoc.data()
          targetPoints = journeyData.weeklyPointsTarget || MINIMUM_WEEKLY_TARGET_POINTS
        }
      }
    }

    // Create new weekly points record
    const docRef = doc(collection(db, 'weekly_points'))
    const newData: WeeklyPointsData = {
      user_id: userId,
      week_number: weekNumber,
      week_year: weekYear,
      points_earned: 0,
      target_points: targetPoints,
      engagement_count: 0,
      status: 'at_risk',
      week_start: Timestamp.fromDate(start),
      week_end: Timestamp.fromDate(end),
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    }

    await setDoc(docRef, newData)
  }
}

const formatParticipantName = (profileData: Record<string, unknown>) => {
  if (typeof profileData.fullName === 'string' && profileData.fullName.trim().length) {
    return profileData.fullName
  }

  const firstName = typeof profileData.firstName === 'string' ? profileData.firstName : ''
  const lastName = typeof profileData.lastName === 'string' ? profileData.lastName : ''
  const combined = `${firstName} ${lastName}`.trim()

  return combined.length ? combined : 'This participant'
}

const createEngagementAlertIfNeeded = async (params: {
  userId: string
  weekNumber: number
  weekYear: number
  pointsEarned: number
  targetPoints: number
}) => {
  const { userId, weekNumber, weekYear, pointsEarned, targetPoints } = params

  if (pointsEarned >= LOW_WEEKLY_POINTS_ALERT_THRESHOLD) {
    return
  }

  const existingAlertsQuery = query(
    collection(db, 'weekly_target_alerts'),
    where('user_id', '==', userId),
    where('week_number', '==', weekNumber),
    where('week_year', '==', weekYear),
    where('resolved_at', '==', null),
  )

  const existingAlerts = await getDocs(existingAlertsQuery)
  if (!existingAlerts.empty) {
    return
  }

  const profileDoc = await getDoc(doc(db, 'profiles', userId))
  const profileData = profileDoc.exists() ? profileDoc.data() : {}
  const participantName = formatParticipantName(profileData)

  const message = `${participantName} is below ${LOW_WEEKLY_POINTS_ALERT_THRESHOLD.toLocaleString()} weekly points (${pointsEarned.toLocaleString()} pts). Start outreach with support resources to keep them engaged.`

  await addDoc(collection(db, 'weekly_target_alerts'), {
    user_id: userId,
    week_number: weekNumber,
    week_year: weekYear,
    type: 'alert',
    message,
    status: 'open',
    points_earned: pointsEarned,
    target_points: targetPoints,
    threshold: LOW_WEEKLY_POINTS_ALERT_THRESHOLD,
    created_at: serverTimestamp(),
    notified_at: null,
    acknowledged_at: null,
    resolved_at: null,
  })

  await addDoc(collection(db, 'admin_notifications'), {
    type: 'engagement_alert',
    title: 'Participant engagement alert',
    message,
    severity: 'warning',
    target_roles: ['partner', 'super_admin'],
    related_id: userId,
    metadata: {
      week_number: weekNumber,
      week_year: weekYear,
      points_earned: pointsEarned,
      target_points: targetPoints,
      threshold: LOW_WEEKLY_POINTS_ALERT_THRESHOLD,
    },
    created_at: serverTimestamp(),
  })
}

export const updateWeeklyPoints = async (userId: string): Promise<void> => {
  const weekNumber = getCurrentWeekNumber()
  const weekYear = new Date().getFullYear()
  const { start, end } = getWeekDateRange()

  // Ensure record exists
  await getOrCreateWeeklyPoints(userId)

  // Calculate points earned this week from user_points
  const pointsQuery = query(
    collection(db, 'user_points'),
    where('userId', '==', userId),
    where('recordedAt', '>=', Timestamp.fromDate(start)),
    where('recordedAt', '<=', Timestamp.fromDate(end)),
  )

  const pointsDocs = await getDocs(pointsQuery)
  const pointsEarned = pointsDocs.docs.reduce((sum, docItem) => {
    return sum + (docItem.data().points || 0)
  }, 0)

  // Calculate engagement count from weeklyActivities
  const activitiesQuery = query(
    collection(db, `profiles/${userId}/weeklyActivities`),
    where('weekNumber', '==', weekNumber),
    where('status', '==', 'completed'),
  )

  const activitiesDocs = await getDocs(activitiesQuery)
  const engagementCount = activitiesDocs.size

  // Get existing record to get target
  const weeklyPointsQuery = query(
    collection(db, 'weekly_points'),
    where('user_id', '==', userId),
    where('week_number', '==', weekNumber),
    where('week_year', '==', weekYear),
  )

  const weeklyPointsDocs = await getDocs(weeklyPointsQuery)
  if (!weeklyPointsDocs.empty) {
    const docRef = weeklyPointsDocs.docs[0].ref
    const existingData = weeklyPointsDocs.docs[0].data()
    const targetPoints = existingData.target_points || MINIMUM_WEEKLY_TARGET_POINTS

    const status = calculateWeeklyStatus(pointsEarned, targetPoints)

    await setDoc(
      docRef,
      {
        points_earned: pointsEarned,
        engagement_count: engagementCount,
        status,
        updated_at: Timestamp.now(),
      },
      { merge: true },
    )

    await createEngagementAlertIfNeeded({
      userId,
      weekNumber,
      weekYear,
      pointsEarned,
      targetPoints,
    })
  }
}
