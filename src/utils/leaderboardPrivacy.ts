import { UserProfile } from '@/types'
import { LeaderboardContext } from '@/hooks/leaderboard/useLeaderboardContext'

type LeaderboardVisibility = 'public' | 'company' | 'private'

const normalizeLeaderboardVisibility = (
  profile: UserProfile,
): LeaderboardVisibility => {
  if (profile.leaderboardVisibility === 'public' || profile.leaderboardVisibility === 'company' || profile.leaderboardVisibility === 'private') {
    return profile.leaderboardVisibility
  }
  if (profile.privacySettings?.showOnLeaderboard === false) {
    return 'private'
  }
  return 'public'
}

const getOrganizationId = (profile: UserProfile | null | undefined) =>
  profile?.companyId || profile?.organizationId || null

const isSameOrganization = (left: UserProfile | null | undefined, right: UserProfile | null | undefined) => {
  const leftOrgId = getOrganizationId(left)
  const rightOrgId = getOrganizationId(right)
  if (leftOrgId && rightOrgId) {
    return leftOrgId === rightOrgId
  }
  return Boolean(left?.companyCode && right?.companyCode && left.companyCode === right.companyCode)
}

export const canViewerSeeCandidateOnLeaderboard = (params: {
  viewer: UserProfile | null
  candidate: UserProfile
  context: LeaderboardContext | null
}): boolean => {
  const { viewer, candidate, context } = params

  if (viewer?.id === candidate.id) return true

  if (candidate.privacySettings?.showOnLeaderboard === false) {
    return false
  }

  const visibility = normalizeLeaderboardVisibility(candidate)
  if (visibility === 'private') {
    return false
  }

  if (visibility === 'company') {
    if (!viewer) return false
    if (!isSameOrganization(viewer, candidate)) return false
    return context?.type === 'organization' || context?.type === 'village' || context?.type === 'cluster'
  }

  return true
}
