import { supabase } from '@/services/supabase'
import { getActivityDefinitionById, type ActivityDef, type JourneyType } from '@/config/pointsConfig'
import { awardChecklistPoints } from '@/services/pointsService'
import { upsertChecklistActivity } from '@/services/checklistService'
import { notifySupabaseUser } from '@/services/notificationService'
import { logAdminAction } from '@/services/superAdminService'
import { isJourneyType } from '@/utils/journeyType'

/**
 * Partner-verified course completions live in Supabase `course_completions`
 * (migrated off Firestore `approvals` so Supabase-only auth can approve).
 *
 * Doc id: `${learnerId}__course__${courseId}` - deterministic for idempotency.
 */

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

type Raw = Record<string, unknown>

const buildCompletionDocId = (userId: string, courseId: string) =>
  `${userId}__course__${sanitizeIdSegment(courseId)}`

const sanitizeIdSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 200)

const sanitizeClaimRefSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 200)

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

const mapRow = (row: Raw): CourseCompletionRecord => ({
  id: String(row.id ?? ''),
  userId: String(row.user_id ?? ''),
  courseId: String(row.course_id ?? ''),
  courseTitle: String(row.course_title ?? ''),
  courseSlug: (row.course_slug as string | null | undefined) ?? null,
  organizationId: row.organization_id != null ? String(row.organization_id) : null,
  status: row.status === 'revoked' ? 'revoked' : 'approved',
  points: typeof row.points === 'number' ? row.points : 0,
  weekNumber: typeof row.week_number === 'number' ? row.week_number : 1,
  approvedBy: row.approved_by != null ? String(row.approved_by) : '',
  approvedByName: (row.approved_by_name as string | null | undefined) ?? null,
  approvedAt: toDate(row.approved_at),
  revokedAt: toDate(row.revoked_at),
  revokedBy: row.revoked_by != null ? String(row.revoked_by) : null,
})

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

  const { data: existingRow, error: existingError } = await supabase
    .from('course_completions')
    .select('*')
    .eq('id', completionDocId)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)

  if (existingRow && (existingRow as Raw).status === 'approved') {
    return {
      alreadyCompleted: true,
      pointsAwarded: 0,
      completion: mapRow(existingRow as Raw),
    }
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, journey_type, current_week, organization_id, company_id, data')
    .eq('id', learnerId)
    .maybeSingle()
  if (profileError) throw new Error(profileError.message)
  if (!profileRow) throw new Error('Learner profile not found')

  const nested = (profileRow.data as Record<string, unknown> | null) ?? {}
  const rawJourney =
    (profileRow.journey_type as string | null) ||
    (nested.journeyType as string | null) ||
    learnerJourneyType ||
    null
  const journeyType = (isJourneyType(rawJourney) ? rawJourney : '6W') as JourneyType
  const resolvedWeek =
    params.weekNumber && params.weekNumber > 0
      ? params.weekNumber
      : typeof profileRow.current_week === 'number' && profileRow.current_week > 0
        ? profileRow.current_week
        : typeof nested.currentWeek === 'number' && (nested.currentWeek as number) > 0
          ? (nested.currentWeek as number)
          : 1
  const resolvedOrganizationId =
    organizationId ||
    (profileRow.organization_id as string | null) ||
    (profileRow.company_id as string | null) ||
    (nested.organizationId as string | null) ||
    (nested.companyId as string | null) ||
    null

  const activity = getActivityDefinitionById({
    journeyType,
    activityId: COURSE_LIFT_ACTIVITY_ID,
  })
  if (!activity) {
    throw new Error('LIFT module activity definition not found')
  }

  // Partners control timing of course approvals (they wait until certificates
  // arrive, sometimes batched). Widen per-window cap to journey total so a
  // batch in one window is not blocked; maxTotal still enforces the real limit.
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

  let pointsAwarded = activity.points
  try {
    const award = await awardChecklistPoints({
      uid: learnerId,
      journeyType,
      weekNumber: resolvedWeek,
      activity: partnerApprovalActivity,
      source: 'partner_issued',
      claimRef,
    })
    if (!award.awarded) {
      if (award.reason === 'already_awarded') {
        pointsAwarded = 0
      } else {
        throw new Error(
          award.message ||
            `Could not award points for this course (${award.reason || 'rejected'}).`,
        )
      }
    }
    await upsertChecklistActivity({
      userId: learnerId,
      weekNumber: resolvedWeek,
      activityId: 'lift_module',
      patch: {
        status: 'completed',
        hasInteracted: true,
        issuedByPartner: true,
        issuedBy: partnerId,
        issuedAt: new Date().toISOString(),
      },
    }).catch((err) =>
      console.warn('[CourseCompletion] checklist upsert after points failed:', err),
    )
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

  const nowIso = new Date().toISOString()
  const payload = {
    id: completionDocId,
    user_id: learnerId,
    organization_id: resolvedOrganizationId,
    course_id: course.id,
    course_title: course.title,
    course_slug: course.slug ?? null,
    status: 'approved',
    points: activity.points,
    week_number: resolvedWeek,
    claim_ref: claimRef,
    approved_by: partnerId,
    approved_by_name: partnerName ?? null,
    approved_at: nowIso,
    revoked_at: null,
    revoked_by: null,
    updated_at: nowIso,
  }

  const { data: saved, error: saveError } = await supabase
    .from('course_completions')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .maybeSingle()
  if (saveError) throw new Error(saveError.message)

  void notifySupabaseUser({
    userId: learnerId,
    type: 'achievement',
    title: 'Course completion approved',
    message: `Your partner approved "${course.title}" and ${activity.points.toLocaleString()} points were added.`,
    relatedId: course.id,
    category: 'important_updates',
    data: {
      courseId: course.id,
      courseTitle: course.title,
      points: activity.points,
      actionUrl: '/app/weekly-glance',
    },
  }).catch((error) => {
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
  }).catch((error) => {
    console.error('[CourseCompletion] Failed to log admin action', error)
  })

  const completion = saved
    ? mapRow(saved as Raw)
    : {
        id: completionDocId,
        userId: learnerId,
        courseId: course.id,
        courseTitle: course.title,
        courseSlug: course.slug ?? null,
        organizationId: resolvedOrganizationId,
        status: 'approved' as const,
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
    pointsAwarded,
    completion,
  }
}

/**
 * Subscribes to course completion records for a single learner.
 */
export const listenToUserCourseCompletions = (
  userId: string,
  onData: (records: CourseCompletionRecord[]) => void,
  onError?: (error: Error) => void,
): (() => void) => {
  if (!userId) {
    onData([])
    return () => {}
  }

  let active = true
  const load = async () => {
    const { data, error } = await supabase
      .from('course_completions')
      .select('*')
      .eq('user_id', userId)
      .order('approved_at', { ascending: false })
    if (!active) return
    if (error) {
      onError?.(new Error(error.message))
      return
    }
    onData(((data ?? []) as Raw[]).map(mapRow))
  }

  void load()
  const channel = supabase
    .channel(`course_completions_user_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'course_completions',
        filter: `user_id=eq.${userId}`,
      },
      () => void load(),
    )
    .subscribe()

  return () => {
    active = false
    void supabase.removeChannel(channel)
  }
}

/**
 * Subscribes to course completion records for a list of learners (partner UI).
 */
export const listenToCourseCompletionsForLearners = (
  learnerIds: string[],
  onData: (records: CourseCompletionRecord[]) => void,
  onError?: (error: Error) => void,
): (() => void) => {
  const ids = (learnerIds ?? []).filter(Boolean)
  if (ids.length === 0) {
    onData([])
    return () => {}
  }

  let active = true
  const load = async () => {
    const { data, error } = await supabase
      .from('course_completions')
      .select('*')
      .in('user_id', ids)
      .order('approved_at', { ascending: false })
    if (!active) return
    if (error) {
      onError?.(new Error(error.message))
      return
    }
    onData(((data ?? []) as Raw[]).map(mapRow))
  }

  void load()
  const channel = supabase
    .channel(`course_completions_learners_${ids.slice(0, 3).join('_')}_${ids.length}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'course_completions' },
      () => void load(),
    )
    .subscribe()

  return () => {
    active = false
    void supabase.removeChannel(channel)
  }
}
