import {
  collection,
  getCountFromServer,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { updateUserProfile } from '@/services/userProfileService'
import { normalizeRole } from '@/utils/role'
import type { UserProfile } from '@/types'

const USERS = 'users'

export interface OrgMentorOption {
  id: string
  fullName: string
  email: string | null
  companyId: string | null
  companyCode: string | null
}

const extractName = (data: Record<string, unknown>): string => {
  const first = typeof data.firstName === 'string' ? data.firstName.trim() : ''
  const last = typeof data.lastName === 'string' ? data.lastName.trim() : ''
  const combined = `${first} ${last}`.trim()
  if (combined) return combined
  if (typeof data.fullName === 'string' && data.fullName.trim()) return data.fullName.trim()
  if (typeof data.name === 'string' && data.name.trim()) return data.name.trim()
  if (typeof data.email === 'string' && data.email.trim()) return data.email.trim()
  return 'Unknown mentor'
}

/**
 * Returns mentors whose profile companyId/companyCode matches the target organization.
 * Falls back to returning all mentors when no org-specific mentors exist, so partner admins
 * can still make assignments during org bootstrapping.
 */
export const fetchMentorsForOrg = async (params: {
  companyId: string
  companyCode?: string | null
}): Promise<OrgMentorOption[]> => {
  const { companyId, companyCode } = params
  if (!companyId) return []

  const mentorRoleQuery = query(collection(db, USERS), where('role', '==', 'mentor'))
  const snapshot = await getDocs(mentorRoleQuery)

  const allMentors: OrgMentorOption[] = snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>
    return {
      id: docSnap.id,
      fullName: extractName(data),
      email: typeof data.email === 'string' ? data.email : null,
      companyId: typeof data.companyId === 'string' ? data.companyId : null,
      companyCode: typeof data.companyCode === 'string' ? data.companyCode : null,
    }
  })

  // Prefer mentors whose companyId or companyCode matches the target org;
  // fall back to the full mentor list if none match (for orgs still being bootstrapped).
  const orgMatched = allMentors.filter((mentor) => {
    if (mentor.companyId && mentor.companyId === companyId) return true
    if (companyCode && mentor.companyCode && mentor.companyCode === companyCode) return true
    return false
  })
  const list = orgMatched.length > 0 ? orgMatched : allMentors
  return list.sort((a, b) => a.fullName.localeCompare(b.fullName))
}

export interface AssignMentorParams {
  learnerId: string
  mentorId: string | null
  actor: { id: string; name?: string }
}

export const assignMentorToLearner = async (params: AssignMentorParams): Promise<void> => {
  const { learnerId, mentorId, actor } = params
  if (!learnerId) throw new Error('Learner id is required.')
  await updateUserProfile(
    learnerId,
    { mentorId: mentorId ?? null },
    ['mentorId'],
    actor,
  )
}

export interface LearnerSessionStats {
  learnerId: string
  mentorSessionsCompleted: number
  mentorSessionsPending: number
  ambassadorSessionsAttended: number
  ambassadorSessionsBooked: number
}

/**
 * Batched per-learner session count. Uses getCountFromServer for efficiency.
 * Runs queries in parallel. Handles Firestore's 10-item limit on 'in' queries by chunking.
 */
export const fetchLearnerSessionStats = async (
  learnerIds: string[],
): Promise<Record<string, LearnerSessionStats>> => {
  if (!learnerIds.length) return {}

  const results: Record<string, LearnerSessionStats> = {}
  for (const learnerId of learnerIds) {
    results[learnerId] = {
      learnerId,
      mentorSessionsCompleted: 0,
      mentorSessionsPending: 0,
      ambassadorSessionsAttended: 0,
      ambassadorSessionsBooked: 0,
    }
  }

  // Run per-learner queries in parallel — each learner gets 4 counts (pending/completed mentor, attended/booked ambassador)
  await Promise.all(
    learnerIds.map(async (learnerId) => {
      try {
        const mentorCompletedQ = query(
          collection(db, 'mentorship_sessions'),
          where('learner_id', '==', learnerId),
          where('status', '==', 'completed'),
        )
        const mentorPendingQ = query(
          collection(db, 'mentorship_sessions'),
          where('learner_id', '==', learnerId),
          where('status', 'in', ['requested', 'scheduled']),
        )
        const ambassadorAttendedQ = query(
          collection(db, 'ambassador_slot_bookings'),
          where('learner_id', '==', learnerId),
          where('status', '==', 'attended'),
        )
        const ambassadorBookedQ = query(
          collection(db, 'ambassador_slot_bookings'),
          where('learner_id', '==', learnerId),
          where('status', '==', 'booked'),
        )
        const [completed, pending, attended, booked] = await Promise.all([
          getCountFromServer(mentorCompletedQ),
          getCountFromServer(mentorPendingQ),
          getCountFromServer(ambassadorAttendedQ),
          getCountFromServer(ambassadorBookedQ),
        ])
        results[learnerId] = {
          learnerId,
          mentorSessionsCompleted: completed.data().count,
          mentorSessionsPending: pending.data().count,
          ambassadorSessionsAttended: attended.data().count,
          ambassadorSessionsBooked: booked.data().count,
        }
      } catch (err) {
        console.warn(`[learnerAssignmentService] count failed for ${learnerId}:`, err)
      }
    }),
  )

  return results
}

export const subscribeToLearnersInOrg = (
  companyId: string,
  onUpdate: (learners: UserProfile[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const q = query(collection(db, USERS), where('companyId', '==', companyId))
  return onSnapshot(
    q,
    (snapshot) => {
      const learners = snapshot.docs.map((d) => ({ ...(d.data() as UserProfile), id: d.id }))
      // Only include free_user / paid_member roles (learners)
      const filtered = learners.filter((learner) => {
        const role = normalizeRole(learner.role)
        return role === 'free_user' || role === 'paid_member'
      })
      onUpdate(filtered)
    },
    (err) => onError?.(err instanceof Error ? err : new Error(String(err))),
  )
}
