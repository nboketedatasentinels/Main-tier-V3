import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { getActivityDefinitionById, type JourneyType } from '@/config/pointsConfig'
import { awardChecklistPoints } from './pointsService'
import { createInAppNotification } from './notificationService'

export type ProgrammeComponentType = 'capstone' | 'case_study' | 'practical'

// Pillar components are one-off, journey-long deliverables (not week-bound), so
// we attribute the award to a fixed week. This keeps the ledger doc id stable
// across re-approvals - combined with claimRef below it makes awarding fully
// idempotent. See docs/points-system.md.
const PILLAR_AWARD_WEEK = 1

export type ProgrammeSubmissionStatus =
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'needs_revision'

export interface ProgrammeComponentSubmission {
  /** Firestore doc id - format: `{uid}__{componentId}`. */
  id: string
  uid: string
  email: string | null
  displayName: string | null
  organizationId: string | null
  componentId: string
  componentType: ProgrammeComponentType | null
  componentTitle: string | null
  pillar: string | null
  partId: string | null
  partTitle: string | null
  answers: Record<string, string>
  answerCount: number
  status: ProgrammeSubmissionStatus
  submittedAt: Date | null
  lastUpdatedAt: Date | null
  resubmittedAt: Date | null
  sourcePage: string | null
  // Partner review fields
  reviewedAt: Date | null
  reviewedBy: string | null
  reviewerName: string | null
  partnerNotes: string | null
  score: number | null
}

/**
 * Subscribe to all submissions for a set of organization ids.
 *
 * TEMPORARILY DISABLED - returns an empty result without subscribing.
 *
 * Programme submissions are still a Firestore-only feature: learners write them
 * from the static capstone runtime (public/capstones/_capstone-runtime.js) using
 * a Firebase auth session. After the app's auth cutover (Firebase -> Supabase)
 * the React dashboard has no Firebase session, so the old
 * `onSnapshot(programmeComponentSubmissions)` listener failed with "Missing or
 * insufficient permissions" on every (re)subscribe and flooded the console.
 *
 * Rather than churn a dead Firestore listener, we no-op here and let the page
 * render its empty state. The follow-up is to move this collection to Supabase
 * (new table + RLS via `is_partner_or_admin()`, and migrate the capstone writer)
 * - mirror partnerSupabaseReads / the interventions migration (0024). The write
 * helpers below are left intact for that migration.
 */
export function subscribeToSubmissionsByOrgIds(
  _organizationIds: string[],
  onUpdate: (rows: ProgrammeComponentSubmission[]) => void,
  _onError?: (err: Error) => void,
): () => void {
  onUpdate([])
  return () => undefined
}

export interface ReviewUpdate {
  status: ProgrammeSubmissionStatus
  partnerNotes: string | null
  score: number | null
  reviewerId: string
  reviewerName: string
}

export async function updateSubmissionReview(
  submissionId: string,
  update: ReviewUpdate,
): Promise<void> {
  const ref = doc(db, 'programmeComponentSubmissions', submissionId)
  await updateDoc(ref, {
    status: update.status,
    partnerNotes: update.partnerNotes,
    score: update.score,
    reviewedBy: update.reviewerId,
    reviewerName: update.reviewerName,
    reviewedAt: serverTimestamp(),
    lastUpdatedAt: serverTimestamp(),
  })
}

/**
 * Points a pillar component is worth, for display before approving. Pillar
 * points live on the 6W journey config (capstone/case_study/practical).
 */
export function getComponentPoints(componentType: ProgrammeComponentType | null): number {
  if (!componentType) return 0
  return getActivityDefinitionById({ activityId: componentType, journeyType: '6W' })?.points ?? 0
}

export interface ApproveAndAwardResult {
  awarded: boolean
  /** Points the component is worth. */
  points: number
  /** True when an award already existed (idempotent re-approval, no new points). */
  alreadyAwarded: boolean
  /** False for components that are reviewed but don't award points (e.g. practical). */
  pointsEligible: boolean
}

/**
 * Mark a submission approved AND award the learner the component's points.
 *
 * Reuses the canonical partner-issued points path (awardChecklistPoints) so the
 * ledger stays the single source of truth. `claimRef` is the componentId, which:
 *  - keeps awarding idempotent per submission (re-approving never double-awards), and
 *  - lets the two case studies (which share activityId "case_study") each award.
 */
export async function approveSubmissionAndAward(params: {
  submission: ProgrammeComponentSubmission
  reviewerId: string
  reviewerName: string
  partnerNotes: string | null
  score: number | null
}): Promise<ApproveAndAwardResult> {
  const { submission, reviewerId, reviewerName, partnerNotes, score } = params

  if (!submission.uid) throw new Error('Submission is missing the learner id.')
  if (!submission.componentType) throw new Error('Submission is missing its component type.')

  // Resolve the learner's journey so progress is attributed correctly; pillar
  // components only exist on 6W, so fall back to 6W to resolve the points.
  const profileSnap = await getDoc(doc(db, 'profiles', submission.uid))
  const journeyType = ((profileSnap.exists()
    ? (profileSnap.data() as { journeyType?: string }).journeyType
    : null) || '6W') as JourneyType

  const activity =
    getActivityDefinitionById({ activityId: submission.componentType, journeyType }) ??
    getActivityDefinitionById({ activityId: submission.componentType, journeyType: '6W' })

  // Some pillar components are reviewed but don't award checklist points
  // (e.g. practical). Record the partner's decision without awarding.
  if (!activity) {
    await updateSubmissionReview(submission.id, {
      status: 'approved',
      partnerNotes,
      score,
      reviewerId,
      reviewerName,
    })
    return { awarded: false, points: 0, alreadyAwarded: false, pointsEligible: false }
  }

  const awardResult = await awardChecklistPoints({
    uid: submission.uid,
    journeyType,
    weekNumber: PILLAR_AWARD_WEEK,
    activity,
    source: 'partner_issued',
    claimRef: submission.componentId,
  })

  // Record the partner's decision either way (status/notes/score/reviewer).
  await updateSubmissionReview(submission.id, {
    status: 'approved',
    partnerNotes,
    score,
    reviewerId,
    reviewerName,
  })

  // Only notify the learner when points were actually new.
  if (awardResult.awarded) {
    try {
      await createInAppNotification({
        userId: submission.uid,
        type: 'approval',
        title: `🎉 +${activity.points.toLocaleString()} points awarded`,
        message: `Your partner approved "${submission.componentTitle || activity.title}" and awarded you ${activity.points.toLocaleString()} points.`,
        metadata: {
          priority: 'push',
          activityId: activity.id,
          componentId: submission.componentId,
          points: activity.points,
          source: 'partner_issued',
        },
        relatedId: activity.id,
      })
    } catch (notifyErr) {
      // Non-fatal: points + review already wrote successfully.
      console.warn('[programmeComponentSubmissionService] learner notify failed', notifyErr)
    }
  }

  return {
    awarded: awardResult.awarded,
    points: activity.points,
    alreadyAwarded: !awardResult.awarded,
    pointsEligible: true,
  }
}
