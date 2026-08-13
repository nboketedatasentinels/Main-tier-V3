type LeadershipProfileLike = {
  mentorId?: unknown
  mentorOverrideId?: unknown
  ambassadorId?: unknown
  ambassadorOverrideId?: unknown
}

export type LeadershipAvailability = {
  hasMentor: boolean
  hasAmbassador: boolean
}

const normalizeBoolean = (value: unknown): boolean | null => {
  return typeof value === 'boolean' ? value : null
}

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const hasAnyAssignmentId = (data: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!data) return false
  return keys.some((key) => Boolean(normalizeNonEmptyString(data[key])))
}

const getLeadershipObject = (
  organizationData: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null => {
  if (!organizationData) return null
  const leadership = organizationData.leadership
  if (!leadership || typeof leadership !== 'object') return null
  return leadership as Record<string, unknown>
}

export const resolveLeadershipAvailability = (params: {
  organizationData?: Record<string, unknown> | null
  profile?: LeadershipProfileLike | null
}): LeadershipAvailability => {
  const organizationData = params.organizationData ?? null
  const leadership = getLeadershipObject(organizationData)

  const explicitMentor =
    normalizeBoolean(leadership?.hasMentor) ?? normalizeBoolean(organizationData?.hasMentor)
  const explicitCoach =
    normalizeBoolean(leadership?.hasAmbassador) ?? normalizeBoolean(organizationData?.hasAmbassador)

  const mentorAssignmentKeys = ['assignedMentorId', 'mentorId', 'mentor_id', 'assigned_mentor_id']
  const ambassadorAssignmentKeys = [
    'assignedAmbassadorId',
    'ambassadorId',
    'ambassador_id',
    'assigned_ambassador_id',
  ]

  const organizationMentorAssigned =
    hasAnyAssignmentId(organizationData, mentorAssignmentKeys) ||
    hasAnyAssignmentId(leadership, mentorAssignmentKeys)
  const organizationCoachAssigned =
    hasAnyAssignmentId(organizationData, ambassadorAssignmentKeys) ||
    hasAnyAssignmentId(leadership, ambassadorAssignmentKeys)

  // Pending org leadership emails still mean the org has the role filled for
  // grade/pass-mark purposes (points issue once the account is linked).
  const organizationMentorPending = Boolean(
    normalizeNonEmptyString(organizationData?.pendingMentorEmail) ||
      normalizeNonEmptyString(leadership?.pendingMentorEmail) ||
      normalizeNonEmptyString(organizationData?.mentorEmail) ||
      normalizeNonEmptyString(leadership?.mentorEmail),
  )
  const organizationCoachPending = Boolean(
    normalizeNonEmptyString(organizationData?.pendingAmbassadorEmail) ||
      normalizeNonEmptyString(leadership?.pendingAmbassadorEmail) ||
      normalizeNonEmptyString(organizationData?.ambassadorEmail) ||
      normalizeNonEmptyString(leadership?.ambassadorEmail),
  )

  const profileMentorAssigned = Boolean(
    normalizeNonEmptyString(params.profile?.mentorOverrideId) ||
      normalizeNonEmptyString(params.profile?.mentorId),
  )
  const profileCoachAssigned = Boolean(
    normalizeNonEmptyString(params.profile?.ambassadorOverrideId) ||
      normalizeNonEmptyString(params.profile?.ambassadorId),
  )

  const hasMentor = Boolean(
    explicitMentor || organizationMentorAssigned || organizationMentorPending || profileMentorAssigned,
  )
  const hasAmbassador = Boolean(
    explicitCoach || organizationCoachAssigned || organizationCoachPending || profileCoachAssigned,
  )

  return {
    hasMentor,
    hasAmbassador,
  }
}

type OrgLeadershipRpcPayload = {
  assignments?: {
    mentorId?: string | null
    ambassadorId?: string | null
  } | null
  pending?: {
    mentorEmail?: string | null
    ambassadorEmail?: string | null
  } | null
}

/**
 * Resolve mentor/coach availability for the signed-in learner from Supabase
 * (org leadership + profile assignments). Replaces Firestore org snapshots.
 */
export const fetchLeadershipAvailability = async (params: {
  profile?: LeadershipProfileLike | null
}): Promise<LeadershipAvailability> => {
  const { supabase } = await import('@/services/supabase')

  try {
    const { data, error } = await supabase.rpc('get_my_organization_leadership')
    if (error) {
      console.error('[fetchLeadershipAvailability]', error.message)
      return resolveLeadershipAvailability({ profile: params.profile })
    }

    const payload = (data ?? {}) as OrgLeadershipRpcPayload
    return resolveLeadershipAvailability({
      organizationData: {
        assignedMentorId: payload.assignments?.mentorId ?? null,
        assignedAmbassadorId: payload.assignments?.ambassadorId ?? null,
        pendingMentorEmail: payload.pending?.mentorEmail ?? null,
        pendingAmbassadorEmail: payload.pending?.ambassadorEmail ?? null,
        hasMentor: Boolean(payload.assignments?.mentorId || payload.pending?.mentorEmail),
        hasAmbassador: Boolean(
          payload.assignments?.ambassadorId || payload.pending?.ambassadorEmail,
        ),
      },
      profile: params.profile,
    })
  } catch (err) {
    console.error('[fetchLeadershipAvailability]', err)
    return resolveLeadershipAvailability({ profile: params.profile })
  }
}
