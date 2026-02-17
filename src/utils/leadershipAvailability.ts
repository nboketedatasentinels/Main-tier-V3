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
  const explicitAmbassador =
    normalizeBoolean(leadership?.hasAmbassador) ?? normalizeBoolean(organizationData?.hasAmbassador)

  const mentorAssignmentKeys = ['assignedMentorId', 'mentorId', 'mentor_id', 'assigned_mentor_id']
  const ambassadorAssignmentKeys = ['assignedAmbassadorId', 'ambassadorId', 'ambassador_id', 'assigned_ambassador_id']

  const organizationMentorAssigned =
    hasAnyAssignmentId(organizationData, mentorAssignmentKeys) || hasAnyAssignmentId(leadership, mentorAssignmentKeys)
  const organizationAmbassadorAssigned =
    hasAnyAssignmentId(organizationData, ambassadorAssignmentKeys) || hasAnyAssignmentId(leadership, ambassadorAssignmentKeys)

  const profileMentorAssigned = Boolean(
    normalizeNonEmptyString(params.profile?.mentorOverrideId) || normalizeNonEmptyString(params.profile?.mentorId),
  )
  const profileAmbassadorAssigned = Boolean(
    normalizeNonEmptyString(params.profile?.ambassadorOverrideId) || normalizeNonEmptyString(params.profile?.ambassadorId),
  )

  const hasMentor = Boolean(explicitMentor || organizationMentorAssigned || profileMentorAssigned)
  const hasAmbassador = Boolean(explicitAmbassador || organizationAmbassadorAssigned || profileAmbassadorAssigned)

  return {
    hasMentor,
    hasAmbassador,
  }
}
