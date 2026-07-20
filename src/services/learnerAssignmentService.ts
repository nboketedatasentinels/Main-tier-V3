import { supabase } from '@/services/supabase'
import { updateUserProfile } from '@/services/userProfileService'
import { normalizeRole } from '@/utils/role'
import type { UserProfile } from '@/types'

// Monotonic suffix so each learner subscription gets a distinct channel topic.
let learnersChannelSeq = 0

// Columns read when listing org mentors/ambassadors from `profiles`; the `data`
// jsonb carries long-tail identity fields not promoted to columns.
const MEMBER_OPTION_COLUMNS =
  'id, email, first_name, last_name, full_name, company_id, company_code, data'

const mapProfileToMemberOption = (
  row: Record<string, unknown>,
  fallbackName: string,
): OrgMentorOption => {
  const data = (row.data as Record<string, unknown>) || {}
  const fullName =
    (row.full_name as string) ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    extractName(data, '') ||
    (row.email as string) ||
    fallbackName
  return {
    id: row.id as string,
    fullName,
    email: (row.email as string) ?? (data.email as string) ?? null,
    companyId: (row.company_id as string) ?? (data.companyId as string) ?? null,
    companyCode: (row.company_code as string) ?? (data.companyCode as string) ?? null,
  }
}

/**
 * Maps a Supabase `profiles` row to the loosely-typed UserProfile the partner
 * learner views read (mirrors the canonical mapper in AuthContext). The `data`
 * jsonb is spread first so long-tail keys flow through; typed columns win.
 */
const mapProfileRowToLearner = (row: Record<string, unknown>): UserProfile => {
  const data = (row.data as Record<string, unknown>) || {}
  return {
    ...data,
    id: row.id,
    email: (row.email as string) ?? data.email ?? '',
    firstName: row.first_name ?? data.firstName,
    lastName: row.last_name ?? data.lastName,
    fullName: row.full_name ?? data.fullName,
    role: normalizeRole((row.role as string) ?? data.role),
    membershipStatus: row.membership_status ?? data.membershipStatus,
    organizationId: row.organization_id ?? data.organizationId ?? null,
    companyId: row.company_id ?? data.companyId ?? null,
    companyCode: row.company_code ?? data.companyCode ?? null,
    journeyType: row.journey_type ?? data.journeyType,
    mentorId: row.mentor_id ?? data.mentorId ?? null,
    ambassadorId: row.ambassador_id ?? data.ambassadorId ?? null,
    totalPoints: (row.total_points as number) ?? data.totalPoints ?? 0,
    createdAt: row.created_at ?? data.createdAt,
    updatedAt: row.updated_at ?? data.updatedAt,
  } as unknown as UserProfile
}

export interface OrgMentorOption {
  id: string
  fullName: string
  email: string | null
  companyId: string | null
  companyCode: string | null
}

const extractName = (data: Record<string, unknown>, fallback = 'Unknown member'): string => {
  const first = typeof data.firstName === 'string' ? data.firstName.trim() : ''
  const last = typeof data.lastName === 'string' ? data.lastName.trim() : ''
  const combined = `${first} ${last}`.trim()
  if (combined) return combined
  if (typeof data.fullName === 'string' && data.fullName.trim()) return data.fullName.trim()
  if (typeof data.name === 'string' && data.name.trim()) return data.name.trim()
  if (typeof data.email === 'string' && data.email.trim()) return data.email.trim()
  return fallback
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

  const { data, error } = await supabase
    .from('profiles')
    .select(MEMBER_OPTION_COLUMNS)
    .eq('role', 'mentor')
  if (error) throw new Error(error.message)

  const allMentors: OrgMentorOption[] = (data ?? []).map((row) =>
    mapProfileToMemberOption(row as Record<string, unknown>, 'Unknown mentor'),
  )

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

export interface OrgAmbassadorOption {
  id: string
  fullName: string
  email: string | null
  companyId: string | null
  companyCode: string | null
}

/**
 * Returns ambassadors whose profile companyId/companyCode matches the target organization.
 * Falls back to returning all ambassadors when no org-specific ambassadors exist, mirroring
 * the mentor lookup behaviour so partner admins can still see the global roster during
 * org bootstrapping.
 */
export const fetchAmbassadorsForOrg = async (params: {
  companyId: string
  companyCode?: string | null
}): Promise<OrgAmbassadorOption[]> => {
  const { companyId, companyCode } = params
  if (!companyId) return []

  const { data, error } = await supabase
    .from('profiles')
    .select(MEMBER_OPTION_COLUMNS)
    .eq('role', 'ambassador')
  if (error) throw new Error(error.message)

  const allAmbassadors: OrgAmbassadorOption[] = (data ?? []).map((row) =>
    mapProfileToMemberOption(row as Record<string, unknown>, 'Unknown ambassador'),
  )

  const orgMatched = allAmbassadors.filter((ambassador) => {
    if (ambassador.companyId && ambassador.companyId === companyId) return true
    if (companyCode && ambassador.companyCode && ambassador.companyCode === companyCode) return true
    return false
  })
  const list = orgMatched.length > 0 ? orgMatched : allAmbassadors
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
 * Per-learner session counts. The source tables (`mentorship_sessions`,
 * `ambassador_slot_bookings`) are Firestore-only and denied under Supabase-only
 * auth - they have no Supabase home yet - so the counts can never resolve. Return
 * zeros without a dead round-trip (previously this warned per learner). Migrate
 * to Supabase tables if these session counts are needed on the partner views.
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
  return results
}

/**
 * Learners in an organization, from Supabase `profiles` (replaces the dead
 * Firestore `onSnapshot(users)` that failed post auth-cutover with "Missing or
 * insufficient permissions"). `companyId` is the org id (UUID); match it against
 * either organization_id or company_id, then keep only learner roles.
 */
export const subscribeToLearnersInOrg = (
  companyId: string,
  onUpdate: (learners: UserProfile[]) => void,
  onError?: (error: Error) => void,
): (() => void) => {
  if (!companyId) {
    onUpdate([])
    return () => {}
  }

  let cancelled = false

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`organization_id.eq.${companyId},company_id.eq.${companyId}`)

      if (cancelled) return
      if (error) throw new Error(error.message)

      const learners = (data ?? [])
        .map((row) => mapProfileRowToLearner(row as Record<string, unknown>))
        .filter((learner) => {
          const role = normalizeRole(learner.role)
          return role === 'free_user' || role === 'paid_member'
        })
      onUpdate(learners)
    } catch (err) {
      if (cancelled) return
      onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  void load()

  const channel = supabase
    .channel(`learners_in_org_${++learnersChannelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      void load()
    })
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}
