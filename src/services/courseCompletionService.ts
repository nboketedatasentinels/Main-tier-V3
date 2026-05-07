import {
  Timestamp,
  Unsubscribe,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { getActivityDefinitionById, type ActivityDef, type JourneyType } from '@/config/pointsConfig'
import { awardChecklistPoints } from '@/services/pointsService'
import { createInAppNotification } from '@/services/notificationService'
import { logAdminAction } from '@/services/superAdminService'
import { removeUndefinedFields } from '@/utils/firestore'

/**
 * Partner-verified course completions are stored as documents in the existing
 * `approvals` collection (which already has rules permitting partner writes).
 * We discriminate them with `approvalType === 'course_completion'`.
 *
 * Doc id: `${learnerId}__course__${courseId}` — deterministic for idempotency.
 */

export const APPROVALS_COLLECTION = 'approvals'
export const COURSE_COMPLETION_APPROVAL_TYPE = 'course_completion'
export const COURSE_LIFT_ACTIVITY_ID = 'lift_module'

export type CourseCompletionStatus = 'approved' | 'revoked'

export interface CourseCompletionRecord {
  id: string
  userId: string
  courseId: string
  courseTitle: string
  courseSlug?: string | null
  organizationId?: string | null
  status: CourseCompletionStatus
  points: number
  weekNumber: number
  approvedBy: string
  approvedByName?: string | null
  approvedAt?: Date | null
  revokedAt?: Date | null
  revokedBy?: string | null
}

const buildCompletionDocId = (userId: string, courseId: string) =>
  `${userId}__course__${sanitizeIdSegment(courseId)}`

const sanitizeIdSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 200)

const sanitizeClaimRefSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 200)

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return null
}

/**
 * Maps an approvals doc to a CourseCompletionRecord. Returns null if the doc
 * is not a course completion (i.e., its approvalType is something else).
 */
const mapApprovalToCompletion = (
  id: string,
  data: Record<string, unknown>,
): CourseCompletionRecord | null => {
  if (data.approvalType !== COURSE_COMPLETION_APPROVAL_TYPE) return null
  const source = (data.source as Record<string, unknown> | undefined) ?? {}
  return {
    id,
    userId: String(data.userId ?? ''),
    courseId: String(source.courseId ?? ''),
    courseTitle: String(source.courseTitle ?? data.title ?? ''),
    courseSlug: (source.courseSlug as string | null | undefined) ?? null,
    organizationId: (data.organizationId as string | null | undefined) ?? null,
    status: ((data.status as string) === 'approved' ? 'approved' : 'revoked') as CourseCompletionStatus,
    points: typeof data.points === 'number' ? data.points : 0,
    weekNumber: typeof source.weekNumber === 'number' ? (source.weekNumber as number) : 1,
    approvedBy: String(source.partnerId ?? data.reviewedBy ?? ''),
    approvedByName: (source.partnerName as string | null | undefined) ?? null,
    approvedAt: toDate(data.reviewedAt) ?? toDate(data.createdAt),
    revokedAt: null,
    revokedBy: null,
  }
}

export interface MarkCourseCompletedParams {
  partnerId: string
  partnerName?: string | null
  learnerId: string
  learnerJourneyType?: JourneyType | null
  weekNumber?: number
  course: {
    id: string
    title: string
    slug?: string | null
  }
  organizationId?: string | null
}

export interface MarkCourseCompletedResult {
  alreadyCompleted: boolean
  pointsAwarded: number
  completion: CourseCompletionRecord
}

export const markCourseCompleted = async (
  params: MarkCourseCompletedParams,
): Promise<MarkCourseCompletedResult> => {
  const {
    partnerId,
    partnerName,
    learnerId,
    learnerJourneyType,
    course,
    organizationId,
  } = params

  if (!partnerId) throw new Error('Partner identity is required')
  if (!learnerId) throw new Error('Learner identity is required')
  if (!course?.id) throw new Error('Course id is required')
  if (!course?.title) throw new Error('Course title is required')

  const completionDocId = buildCompletionDocId(learnerId, course.id)
  const completionRef = doc(db, APPROVALS_COLLECTION, completionDocId)
  const existing = await getDoc(completionRef)
  if (existing.exists()) {
    const existingData = existing.data()
    if (
      existingData.approvalType === COURSE_COMPLETION_APPROVAL_TYPE &&
      existingData.status === 'approved'
    ) {
      const mapped = mapApprovalToCompletion(existing.id, existingData)
      if (mapped) {
        return {
          alreadyCompleted: true,
          pointsAwarded: 0,
          completion: mapped,
        }
      }
    }
  }

  const learnerProfileSnap = await getDoc(doc(db, 'profiles', learnerId))
  if (!learnerProfileSnap.exists()) {
    throw new Error('Learner profile not found')
  }
  const profile = learnerProfileSnap.data() as Record<string, unknown>
  const journeyType = (learnerJourneyType ||
    (profile.journeyType as JourneyType | undefined) ||
    '6W') as JourneyType
  const resolvedWeek =
    params.weekNumber && params.weekNumber > 0
      ? params.weekNumber
      : typeof profile.currentWeek === 'number' && profile.currentWeek > 0
        ? (profile.currentWeek as number)
        : 1
  const resolvedOrganizationId =
    organizationId ||
    (profile.organizationId as string | null | undefined) ||
    (profile.companyId as string | null | undefined) ||
    null

  const activity = getActivityDefinitionById({
    journeyType,
    activityId: COURSE_LIFT_ACTIVITY_ID,
  })
  if (!activity) {
    throw new Error('LIFT module activity definition not found')
  }

  // Partners control timing of course approvals (they wait until certificates
  // arrive, sometimes batched). The auto-derived per-window cap on lift_module
  // would block batch approvals in a single window, so we widen it to the
  // journey-level total cap. maxTotal still enforces the real journey limit.
  const journeyCap = activity.activityPolicy?.maxTotal ?? activity.maxPerMonth ?? 1
  const partnerApprovalActivity: ActivityDef = {
    ...activity,
    maxPerMonth: journeyCap,
    activityPolicy: activity.activityPolicy
      ? {
          ...activity.activityPolicy,
          maxPerWindow: journeyCap,
          maxPerWeek: undefined,
        }
      : undefined,
  }

  const claimRef = `course_${sanitizeClaimRefSegment(course.id)}`

  try {
    await awardChecklistPoints({
      uid: learnerId,
      journeyType,
      weekNumber: resolvedWeek,
      activity: partnerApprovalActivity,
      source: 'partner_course_completion',
      claimRef,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.toLowerCase().includes('total activity limit reached')) {
      const cap = activity.activityPolicy?.maxTotal ?? 0
      throw new Error(
        `Journey cap reached: this learner's ${journeyType} journey allows only ${cap} LIFT course module approval${cap === 1 ? '' : 's'}.`,
      )
    }
    throw error
  }

  // Schema chosen to satisfy the existing /approvals create rule:
  //   isPartnerOrAdmin() &&
  //   type == 'partner_issued' && status == 'approved' &&
  //   source is map && source.partnerId == request.auth.uid
  const approvalPayload = removeUndefinedFields({
    userId: learnerId,
    organizationId: resolvedOrganizationId,
    type: 'partner_issued' as const,
    approvalType: COURSE_COMPLETION_APPROVAL_TYPE,
    title: course.title,
    summary: `Course completion: ${course.title}`,
    points: activity.points,
    status: 'approved' as const,
    source: {
      partnerId,
      partnerName: partnerName ?? null,
      courseId: course.id,
      courseSlug: course.slug ?? null,
      courseTitle: course.title,
      weekNumber: resolvedWeek,
      claimRef,
      completedAt: new Date().toISOString(),
    },
    createdAt: serverTimestamp(),
    reviewedAt: serverTimestamp(),
    reviewedBy: partnerId,
    rejectionReason: null,
    searchText: `${course.title.toLowerCase()} ${learnerId.toLowerCase()} course_completion`,
  })

  await setDoc(completionRef, approvalPayload, { merge: true })

  // Fire-and-forget side effects so the partner's UI returns immediately.
  // The listener picks up the approval doc; these write to other collections.
  void createInAppNotification({
    userId: learnerId,
    type: 'achievement',
    title: 'Course completion approved',
    message: `Your partner approved "${course.title}" and ${activity.points.toLocaleString()} points were added.`,
    relatedId: course.id,
    metadata: {
      courseId: course.id,
      courseTitle: course.title,
      points: activity.points,
      actionUrl: '/app/courses',
    },
  }).catch(error => {
    console.error('[CourseCompletion] Failed to send learner notification', error)
  })

  void logAdminAction({
    action: 'course_completion_approved',
    adminId: partnerId,
    userId: learnerId,
    metadata: {
      courseId: course.id,
      courseTitle: course.title,
      points: activity.points,
      organizationId: resolvedOrganizationId,
    },
  }).catch(error => {
    console.error('[CourseCompletion] Failed to log admin action', error)
  })

  const completion: CourseCompletionRecord = {
    id: completionDocId,
    userId: learnerId,
    courseId: course.id,
    courseTitle: course.title,
    courseSlug: course.slug ?? null,
    organizationId: resolvedOrganizationId,
    status: 'approved',
    points: activity.points,
    weekNumber: resolvedWeek,
    approvedBy: partnerId,
    approvedByName: partnerName ?? null,
    approvedAt: new Date(),
    revokedAt: null,
    revokedBy: null,
  }
  return {
    alreadyCompleted: false,
    pointsAwarded: activity.points,
    completion,
  }
}

/**
 * Subscribes to course completion records (filtered approvals docs) for a
 * single learner. Listeners pull all approvals for that user and filter
 * client-side for course completions — avoids needing a composite index.
 */
export const listenToUserCourseCompletions = (
  userId: string,
  onData: (records: CourseCompletionRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const q = query(collection(db, APPROVALS_COLLECTION), where('userId', '==', userId))
  return onSnapshot(
    q,
    snapshot => {
      const records = snapshot.docs
        .map(snap => mapApprovalToCompletion(snap.id, snap.data()))
        .filter((r): r is CourseCompletionRecord => r !== null)
      onData(records)
    },
    error => {
      console.error('[CourseCompletion] Listener error', error)
      onError?.(error as Error)
    },
  )
}

/**
 * Subscribes to course completion records for a list of learners.
 * Used by the partner UI.
 */
export const listenToCourseCompletionsForLearners = (
  learnerIds: string[],
  onData: (records: CourseCompletionRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  if (!learnerIds.length) {
    onData([])
    return () => {}
  }

  const chunks: string[][] = []
  for (let i = 0; i < learnerIds.length; i += 30) {
    chunks.push(learnerIds.slice(i, i + 30))
  }

  const recordsByChunk = new Map<number, CourseCompletionRecord[]>()
  const emit = () => {
    const flat: CourseCompletionRecord[] = []
    recordsByChunk.forEach(records => {
      flat.push(...records)
    })
    onData(flat)
  }

  const unsubscribers = chunks.map((chunk, chunkIndex) => {
    const q = query(collection(db, APPROVALS_COLLECTION), where('userId', 'in', chunk))
    return onSnapshot(
      q,
      snapshot => {
        recordsByChunk.set(
          chunkIndex,
          snapshot.docs
            .map(snap => mapApprovalToCompletion(snap.id, snap.data()))
            .filter((r): r is CourseCompletionRecord => r !== null),
        )
        emit()
      },
      error => {
        console.error('[CourseCompletion] Listener error (chunk)', error)
        onError?.(error as Error)
      },
    )
  })

  return () => {
    unsubscribers.forEach(unsub => unsub())
  }
}
