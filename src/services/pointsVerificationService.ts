import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { getActivitiesForJourney, type ActivityDef, type JourneyType } from '@/config/pointsConfig'
import { awardChecklistPoints } from '@/services/pointsService'

export type PointsVerificationRequestStatus = 'pending' | 'approved' | 'rejected'

export interface PointsVerificationRequest {
  id: string
  user_id: string
  week: number
  activity_id: string
  activity_title?: string
  points?: number
  proof_url?: string
  notes?: string
  status?: PointsVerificationRequestStatus
  created_at?: Timestamp | string | Date
  approved_at?: Timestamp | string | Date
  approved_by?: string | null
  approved_by_name?: string | null
  rejected_at?: Timestamp | string | Date
  rejected_by?: string | null
  rejected_by_name?: string | null
  rejection_reason?: string | null
}

interface ApproverInfo {
  id?: string | null
  name?: string | null
}

const getJourneyTypeForUser = async (userId: string): Promise<JourneyType> => {
  const userSnap = await getDoc(doc(db, 'users', userId))
  if (userSnap.exists()) {
    const journeyType = userSnap.data()?.journeyType as JourneyType | undefined
    if (journeyType) return journeyType
  }
  return '6W'
}

const updateChecklistActivityStatus = async (
  userId: string,
  week: number,
  activityId: string,
  status: 'completed' | 'pending' | 'not_started',
) => {
  const checklistRef = doc(db, 'checklists', `${userId}_${week}`)
  const checklistSnap = await getDoc(checklistRef)
  if (!checklistSnap.exists()) return

  const data = checklistSnap.data() as { activities?: { id: string; status?: string }[] }
  const activities = data.activities ?? []
  const nextActivities = activities.map((activity) =>
    activity.id === activityId ? { ...activity, status } : activity,
  )
  await updateDoc(checklistRef, {
    activities: nextActivities,
    updatedAt: serverTimestamp(),
  })
}

const getActivityForJourney = (journeyType: JourneyType, activityId: string): ActivityDef => {
  const activities = getActivitiesForJourney(journeyType)
  const activity = activities.find((item) => item.id === activityId)
  if (!activity) {
    throw new Error('Activity not found for journey type')
  }
  return activity
}

export const listenToPointsVerificationRequests = (
  onChange: (requests: PointsVerificationRequest[]) => void,
) => {
  const verificationQuery = query(
    collection(db, 'points_verification_requests'),
    where('status', '==', 'pending'),
    orderBy('created_at', 'desc'),
  )

  return onSnapshot(verificationQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as PointsVerificationRequest
        return { ...data, id: docSnap.id }
      }),
    )
  })
}

export const listenToAllPointsVerificationRequests = (
  onChange: (requests: PointsVerificationRequest[]) => void,
  options?: { status?: PointsVerificationRequestStatus | 'all'; limit?: number },
  onError?: (error: unknown) => void,
) => {
  const constraints = [orderBy('created_at', 'desc')]
  if (options?.status && options.status !== 'all') {
    constraints.push(where('status', '==', options.status))
  }
  if (options?.limit) {
    constraints.push(limit(options.limit))
  }

  const verificationQuery = query(collection(db, 'points_verification_requests'), ...constraints)

  return onSnapshot(
    verificationQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as PointsVerificationRequest
          return { ...data, id: docSnap.id }
        }),
      )
    },
    (error) => {
      onError?.(error)
    },
  )
}

export const approvePointsVerificationRequest = async (params: {
  request: PointsVerificationRequest
  approver?: ApproverInfo
}) => {
  const { request, approver } = params
  const journeyType = await getJourneyTypeForUser(request.user_id)
  const activity = getActivityForJourney(journeyType, request.activity_id)

  await awardChecklistPoints({
    uid: request.user_id,
    journeyType,
    weekNumber: request.week,
    activity,
    source: 'partner_approval',
  })

  await updateChecklistActivityStatus(request.user_id, request.week, request.activity_id, 'completed')

  await updateDoc(doc(db, 'points_verification_requests', request.id), {
    status: 'approved',
    approved_at: serverTimestamp(),
    approved_by: approver?.id ?? null,
    approved_by_name: approver?.name ?? null,
  })
}

export const rejectPointsVerificationRequest = async (params: {
  request: PointsVerificationRequest
  approver?: ApproverInfo
  reason?: string
}) => {
  const { request, approver, reason } = params
  await updateChecklistActivityStatus(request.user_id, request.week, request.activity_id, 'not_started')
  await updateDoc(doc(db, 'points_verification_requests', request.id), {
    status: 'rejected',
    rejected_at: serverTimestamp(),
    rejected_by: approver?.id ?? null,
    rejected_by_name: approver?.name ?? null,
    rejection_reason: reason ?? null,
  })
}
