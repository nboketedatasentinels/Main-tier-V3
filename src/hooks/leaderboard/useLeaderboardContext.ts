import { useMemo } from 'react'
import { TransformationTier, UserProfile } from '@/types'
import { isAdminRole } from '@/utils/role'

export type LeaderboardContext =
  | { type: 'free' }
  | { type: 'community' }
  | { type: 'organization'; organizationId?: string | null; organizationCode?: string | null }
  | { type: 'village'; villageId?: string | null }
  | { type: 'cluster'; clusterId?: string | null }
  | { type: 'admin_all' }

export interface LeaderboardContextLabels {
  label: string
  memberLabel: string
  scopeText: string
  badgeLabel: string
}

const normalizeTier = (tier?: TransformationTier | string | null) => {
  if (!tier) return undefined
  return typeof tier === 'string' ? tier.toLowerCase().trim() : tier
}

const isPaidProfile = (profile: UserProfile) => {
  const tier = normalizeTier(profile.transformationTier)
  return tier === TransformationTier.INDIVIDUAL_PAID || profile.membershipStatus === 'paid'
}

const isFreeProfile = (profile: UserProfile) => {
  const tier = normalizeTier(profile.transformationTier)
  return tier === TransformationTier.INDIVIDUAL_FREE || profile.membershipStatus === 'free'
}

const isCorporateProfile = (profile: UserProfile) => {
  const tier = normalizeTier(profile.transformationTier)
  return tier === TransformationTier.CORPORATE_MEMBER || tier === TransformationTier.CORPORATE_LEADER
}

export const useLeaderboardContext = (profile: UserProfile | null): LeaderboardContext | null =>
  useMemo(() => {
    if (!profile) return null

    if (isAdminRole(profile.role)) {
      console.log('[Leaderboard] Context selected', { type: 'admin_all', reason: 'admin role detected' })
      return { type: 'admin_all' }
    }

    if (profile.companyId) {
      console.log('[Leaderboard] Context selected', {
        type: 'organization',
        reason: 'companyId present',
        companyId: profile.companyId,
      })
      return { type: 'organization', organizationId: profile.companyId, organizationCode: profile.companyCode }
    }

    if (profile.companyCode) {
      console.log('[Leaderboard] Context selected', {
        type: 'organization',
        reason: 'companyCode present',
        companyCode: profile.companyCode,
      })
      return { type: 'organization', organizationCode: profile.companyCode }
    }

    if (profile.villageId) {
      console.log('[Leaderboard] Context selected', {
        type: 'village',
        reason: 'villageId present',
        villageId: profile.villageId,
      })
      return { type: 'village', villageId: profile.villageId }
    }

    if (profile.clusterId) {
      console.log('[Leaderboard] Context selected', {
        type: 'cluster',
        reason: 'clusterId present',
        clusterId: profile.clusterId,
      })
      return { type: 'cluster', clusterId: profile.clusterId }
    }

    if (isCorporateProfile(profile)) {
      console.log('[Leaderboard] Context selected', {
        type: 'organization',
        reason: 'corporate tier without org identifiers',
      })
      return { type: 'organization', organizationId: profile.companyId, organizationCode: profile.companyCode }
    }

    if (isPaidProfile(profile)) {
      console.log('[Leaderboard] Context selected', { type: 'community', reason: 'paid individual tier' })
      return { type: 'community' }
    }

    if (isFreeProfile(profile)) {
      console.log('[Leaderboard] Context selected', { type: 'free', reason: 'free individual tier' })
      return { type: 'free' }
    }

    console.log('[Leaderboard] Context selected', { type: 'free', reason: 'default fallback' })
    return { type: 'free' }
  }, [profile])

export const getLeaderboardContextLabels = (context: LeaderboardContext | null): LeaderboardContextLabels => {
  if (!context) {
    return {
      label: 'Leaderboard',
      memberLabel: 'Members',
      scopeText: 'Across your community',
      badgeLabel: 'Segment View',
    }
  }

  switch (context.type) {
    case 'organization':
      return {
        label: 'Organization',
        memberLabel: 'Organization Members',
        scopeText: 'Across your organization',
        badgeLabel: 'Organization View',
      }
    case 'village':
      return {
        label: 'Village',
        memberLabel: 'Village Members',
        scopeText: 'Across your village',
        badgeLabel: 'Village View',
      }
    case 'cluster':
      return {
        label: 'Cluster',
        memberLabel: 'Cluster Members',
        scopeText: 'Across your cluster',
        badgeLabel: 'Cluster View',
      }
    case 'community':
      return {
        label: 'Community',
        memberLabel: 'Community Members',
        scopeText: 'Across your community',
        badgeLabel: 'Community View',
      }
    case 'admin_all':
      return {
        label: 'All Segments',
        memberLabel: 'Members',
        scopeText: 'Across all segments',
        badgeLabel: 'Admin View',
      }
    case 'free':
    default:
      return {
        label: 'Leaderboard',
        memberLabel: 'Members',
        scopeText: 'Across your community',
        badgeLabel: 'Segment View',
      }
  }
}

export const isPaidCommunityProfile = isPaidProfile

export const normalizeLeaderboardTier = normalizeTier
