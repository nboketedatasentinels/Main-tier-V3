import { TransformationTier, UserProfile } from '@/types'

export type SegmentType = 'free_village' | 'paid_individual' | 'corporate_org'

export interface SegmentContext {
  type: SegmentType
  label: string
  memberLabel: string
  scopeText: string
  filterField: 'villageId' | 'companyId' | 'transformationTier'
  filterValue?: string
}

const normalizeTier = (tier?: TransformationTier | string | null) => {
  if (!tier) return undefined
  return typeof tier === 'string' ? tier.toLowerCase().trim() : tier
}

export const getSegmentType = (profile?: UserProfile | null): SegmentType | null => {
  if (!profile) return null
  const tier = normalizeTier(profile.transformationTier)

  if (tier === TransformationTier.CORPORATE_MEMBER || tier === TransformationTier.CORPORATE_LEADER) {
    return 'corporate_org'
  }

  if (tier === TransformationTier.INDIVIDUAL_PAID || profile.membershipStatus === 'paid') {
    return 'paid_individual'
  }

  return 'free_village'
}

export const getSegmentContext = (profile?: UserProfile | null): SegmentContext | null => {
  const type = getSegmentType(profile)
  if (!type) return null

  switch (type) {
    case 'corporate_org':
      return {
        type,
        label: 'Organization',
        memberLabel: 'Organization Members',
        scopeText: 'Across your organization',
        filterField: 'companyId',
        filterValue: profile?.companyId ?? undefined,
      }
    case 'paid_individual':
      return {
        type,
        label: 'Ecosystem',
        memberLabel: 'Ecosystem Members',
        scopeText: 'Across your ecosystem',
        filterField: 'transformationTier',
        filterValue: TransformationTier.INDIVIDUAL_PAID,
      }
    case 'free_village':
    default:
      return {
        type: 'free_village',
        label: 'Village',
        memberLabel: 'Village Members',
        scopeText: 'Across your village',
        filterField: 'villageId',
        filterValue: profile?.villageId ?? undefined,
      }
  }
}

export const isProfileInSegment = (candidate: UserProfile, context: SegmentContext): boolean => {
  if (context.type === 'corporate_org') {
    return Boolean(context.filterValue && candidate.companyId === context.filterValue)
  }
  if (context.type === 'paid_individual') {
    return normalizeTier(candidate.transformationTier) === TransformationTier.INDIVIDUAL_PAID
  }
  return Boolean(context.filterValue && candidate.villageId === context.filterValue)
}

export const filterProfilesBySegment = (profiles: UserProfile[], viewer?: UserProfile | null): UserProfile[] => {
  const context = getSegmentContext(viewer)
  if (!context || !context.filterValue) return []
  return profiles.filter((candidate) => isProfileInSegment(candidate, context))
}
