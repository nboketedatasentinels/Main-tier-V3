import { ESGCategory } from '@/types'

export const ACTIVITY_TYPES = [
  'Workshop Delivered',
  'Process Change',
  'Coaching/Mentoring',
  'Automation',
  'Policy/Standard',
  'Training Session',
  'Community Outreach',
  'Kaizen/CI',
  'Pilot/MVP',
  'Other',
] as const

export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const BUSINESS_PRIMARY_CATEGORIES = ['Cost Savings', 'Efficiency Gains', 'Revenue Growth'] as const
export type BusinessPrimaryCategory = (typeof BUSINESS_PRIMARY_CATEGORIES)[number]

export const BUSINESS_SECONDARY_WASTES = [
  'Defects',
  'Overproduction',
  'Waiting',
  'Non-Utilized Talent',
  'Transportation',
  'Inventory',
  'Motion',
  'Extra Processing',
] as const

export type BusinessSecondaryWaste = (typeof BUSINESS_SECONDARY_WASTES)[number]

export const ESG_CATEGORY_ACTIVITY_TYPES: Record<ESGCategory, ActivityType[]> = {
  [ESGCategory.ENVIRONMENTAL]: [
    'Process Change',
    'Automation',
    'Policy/Standard',
    'Kaizen/CI',
    'Pilot/MVP',
    'Workshop Delivered',
    'Training Session',
    'Community Outreach',
    'Other',
  ],
  [ESGCategory.SOCIAL]: [
    'Coaching/Mentoring',
    'Training Session',
    'Workshop Delivered',
    'Community Outreach',
    'Process Change',
    'Other',
  ],
  [ESGCategory.GOVERNANCE]: [
    'Policy/Standard',
    'Process Change',
    'Automation',
    'Training Session',
    'Workshop Delivered',
    'Kaizen/CI',
    'Other',
  ],
}

export const BUSINESS_CATEGORY_ACTIVITY_TYPES: Record<BusinessPrimaryCategory, ActivityType[]> = {
  'Cost Savings': ['Process Change', 'Kaizen/CI', 'Automation', 'Training Session', 'Workshop Delivered', 'Other'],
  'Efficiency Gains': ['Process Change', 'Kaizen/CI', 'Automation', 'Training Session', 'Workshop Delivered', 'Other'],
  'Revenue Growth': ['Pilot/MVP', 'Automation', 'Workshop Delivered', 'Training Session', 'Other'],
}

export const ESG_CATEGORY_HELPER_TEXT: Record<ESGCategory, string> = {
  [ESGCategory.ENVIRONMENTAL]: 'Focus on sustainability, energy, waste reduction, and climate outcomes. Common activities include process change and automation.',
  [ESGCategory.SOCIAL]: 'Highlight people-centric impact such as coaching, training, and community outreach efforts.',
  [ESGCategory.GOVERNANCE]: 'Emphasize policy, standards, and oversight improvements that strengthen accountability.',
}

export const BUSINESS_CATEGORY_HELPER_TEXT: Record<BusinessPrimaryCategory, string> = {
  'Cost Savings': 'Reduce waste and operating costs through process changes, automation, or Kaizen efforts.',
  'Efficiency Gains': 'Increase throughput or productivity with continuous improvement and operational upgrades.',
  'Revenue Growth': 'Drive new revenue with pilots, innovation, and growth-focused initiatives.',
}

export const BUSINESS_CATEGORY_REQUIRES_WASTE: Record<BusinessPrimaryCategory, boolean> = {
  'Cost Savings': true,
  'Efficiency Gains': true,
  'Revenue Growth': false,
}

export const DEFAULT_ACTIVITY_BY_ESG_CATEGORY: Record<ESGCategory, ActivityType> = {
  [ESGCategory.ENVIRONMENTAL]: 'Process Change',
  [ESGCategory.SOCIAL]: 'Coaching/Mentoring',
  [ESGCategory.GOVERNANCE]: 'Policy/Standard',
}

export const DEFAULT_ACTIVITY_BY_BUSINESS_CATEGORY: Record<BusinessPrimaryCategory, ActivityType> = {
  'Cost Savings': 'Process Change',
  'Efficiency Gains': 'Kaizen/CI',
  'Revenue Growth': 'Pilot/MVP',
}

export const DEFAULT_BUSINESS_WASTE: BusinessSecondaryWaste = BUSINESS_SECONDARY_WASTES[0]

const normalizeValue = (value?: string) => value?.trim().toLowerCase() || ''

const ACTIVITY_TYPE_ALIASES: Record<string, ActivityType> = {
  'kaizen/continuous improvement': 'Kaizen/CI',
}

export const toCanonicalActivityType = (value?: string): ActivityType | undefined => {
  if (!value) return undefined
  const normalized = normalizeValue(value)
  if (ACTIVITY_TYPE_ALIASES[normalized]) return ACTIVITY_TYPE_ALIASES[normalized]
  return ACTIVITY_TYPES.find((activity) => normalizeValue(activity) === normalized)
}

const mapActivityTypesToCategories = <T extends string>(
  categoryMap: Record<T, ActivityType[]>,
): Record<ActivityType, T[]> => {
  const mapping = ACTIVITY_TYPES.reduce((acc, activity) => {
    acc[activity] = [] as T[]
    return acc
  }, {} as Record<ActivityType, T[]>)

  ;(Object.entries(categoryMap) as Array<[T, ActivityType[]]>).forEach(([category, activities]) => {
    activities.forEach((activity) => {
      mapping[activity].push(category)
    })
  })

  return mapping
}

export const ACTIVITY_TYPE_TO_ESG_CATEGORIES = mapActivityTypesToCategories(ESG_CATEGORY_ACTIVITY_TYPES)
export const ACTIVITY_TYPE_TO_BUSINESS_CATEGORIES = mapActivityTypesToCategories(BUSINESS_CATEGORY_ACTIVITY_TYPES)

export const getActivityTypesForEsgCategory = (category?: ESGCategory) =>
  category ? ESG_CATEGORY_ACTIVITY_TYPES[category] : []

export const getActivityTypesForBusinessCategory = (category?: BusinessPrimaryCategory) =>
  category ? BUSINESS_CATEGORY_ACTIVITY_TYPES[category] : []

export const getDefaultActivityTypeForCategory = (
  categoryGroup: 'esg' | 'business',
  category?: ESGCategory | BusinessPrimaryCategory,
  currentActivity?: string,
): ActivityType | undefined => {
  const currentCanonical = toCanonicalActivityType(currentActivity)
  if (categoryGroup === 'esg' && category && typeof category === 'string') {
    const options = getActivityTypesForEsgCategory(category as ESGCategory)
    if (currentCanonical && options.includes(currentCanonical)) {
      return currentCanonical
    }
    return DEFAULT_ACTIVITY_BY_ESG_CATEGORY[category as ESGCategory] || options[0]
  }

  if (categoryGroup === 'business' && category && typeof category === 'string') {
    const options = getActivityTypesForBusinessCategory(category as BusinessPrimaryCategory)
    if (currentCanonical && options.includes(currentCanonical)) {
      return currentCanonical
    }
    return DEFAULT_ACTIVITY_BY_BUSINESS_CATEGORY[category as BusinessPrimaryCategory] || options[0]
  }

  return currentCanonical
}

export const businessCategoryRequiresWaste = (category?: BusinessPrimaryCategory) =>
  category ? BUSINESS_CATEGORY_REQUIRES_WASTE[category] : false

export const isValidBusinessWaste = (value?: string): value is BusinessSecondaryWaste =>
  !!value && BUSINESS_SECONDARY_WASTES.includes(value as BusinessSecondaryWaste)

export const isActivityTypeAllowedForCategory = (
  categoryGroup: 'esg' | 'business',
  category?: ESGCategory | BusinessPrimaryCategory,
  activityType?: string,
) => {
  const canonical = toCanonicalActivityType(activityType)
  if (!canonical) return false

  if (categoryGroup === 'esg') {
    if (!category) return false
    return getActivityTypesForEsgCategory(category as ESGCategory).includes(canonical)
  }

  if (!category) return false
  return getActivityTypesForBusinessCategory(category as BusinessPrimaryCategory).includes(canonical)
}

const TECH_ENABLED_ACTIVITIES = new Set<ActivityType>(['Automation', 'Pilot/MVP'])
const PROCESS_ACTIVITIES = new Set<ActivityType>(['Process Change', 'Kaizen/CI'])
const COACHING_TRAINING_ACTIVITIES = new Set<ActivityType>(['Coaching/Mentoring', 'Training Session', 'Workshop Delivered'])
const POLICY_ACTIVITIES = new Set<ActivityType>(['Policy/Standard'])

const TEAM_FOCUSED_WASTES = new Set<BusinessSecondaryWaste>(['Non-Utilized Talent', 'Motion'])

const buildLiftKey = (categoryGroup: string, category: string, activity: string) =>
  `${categoryGroup}:${normalizeValue(category)}:${normalizeValue(activity)}`

const LIFT_PILLAR_LOOKUP: Record<string, string[]> = {
  [buildLiftKey('esg', ESGCategory.ENVIRONMENTAL, 'Automation')]: ['Innovating with Tech'],
  [buildLiftKey('esg', ESGCategory.ENVIRONMENTAL, 'Pilot/MVP')]: ['Innovating with Tech'],
  [buildLiftKey('esg', ESGCategory.ENVIRONMENTAL, 'Process Change')]: ['Transforming Business'],
  [buildLiftKey('esg', ESGCategory.ENVIRONMENTAL, 'Kaizen/CI')]: ['Transforming Business'],
  [buildLiftKey('esg', ESGCategory.SOCIAL, 'Coaching/Mentoring')]: ['Fostering Teams'],
  [buildLiftKey('esg', ESGCategory.SOCIAL, 'Training Session')]: ['Fostering Teams'],
  [buildLiftKey('esg', ESGCategory.SOCIAL, 'Workshop Delivered')]: ['Fostering Teams'],
  [buildLiftKey('esg', ESGCategory.GOVERNANCE, 'Policy/Standard')]: ['Transforming Business'],
  [buildLiftKey('business', 'any', 'Coaching/Mentoring')]: ['Fostering Teams'],
  [buildLiftKey('business', 'any', 'Training Session')]: ['Fostering Teams'],
  [buildLiftKey('business', 'any', 'Workshop Delivered')]: ['Fostering Teams'],
}

export type LiftSelection = {
  categoryGroup?: 'esg' | 'business'
  esgCategory?: ESGCategory
  businessCategory?: BusinessPrimaryCategory
  activityType?: string
  businessActivity?: string
}

export const getLiftPillarsForSelection = ({
  categoryGroup,
  esgCategory,
  businessCategory,
  activityType,
  businessActivity,
}: LiftSelection): string[] => {
  if (!categoryGroup) return []
  const canonicalActivity = toCanonicalActivityType(activityType) || activityType
  if (!canonicalActivity) return []

  if (categoryGroup === 'business') {
    const activityKey = buildLiftKey('business', businessCategory || 'any', canonicalActivity)
    if (LIFT_PILLAR_LOOKUP[activityKey]) return LIFT_PILLAR_LOOKUP[activityKey]

    const anyKey = buildLiftKey('business', 'any', canonicalActivity)
    if (LIFT_PILLAR_LOOKUP[anyKey]) return LIFT_PILLAR_LOOKUP[anyKey]

    if (businessActivity && isValidBusinessWaste(businessActivity) && TEAM_FOCUSED_WASTES.has(businessActivity)) {
      return ['Fostering Teams']
    }

    return ['Transforming Business']
  }

  if (!esgCategory) return []

  const esgKey = buildLiftKey('esg', esgCategory, canonicalActivity)
  if (LIFT_PILLAR_LOOKUP[esgKey]) return LIFT_PILLAR_LOOKUP[esgKey]

  if (esgCategory === ESGCategory.ENVIRONMENTAL) {
    const canonical = toCanonicalActivityType(canonicalActivity)
    if (canonical && TECH_ENABLED_ACTIVITIES.has(canonical)) {
      return ['Innovating with Tech']
    }
    if (canonical && PROCESS_ACTIVITIES.has(canonical)) {
      return ['Transforming Business']
    }
  }

  if (esgCategory === ESGCategory.SOCIAL) {
    const canonical = toCanonicalActivityType(canonicalActivity)
    if (canonical && COACHING_TRAINING_ACTIVITIES.has(canonical)) {
      return ['Fostering Teams']
    }
    return ['Fostering Teams']
  }

  if (esgCategory === ESGCategory.GOVERNANCE) {
    const canonical = toCanonicalActivityType(canonicalActivity)
    if (canonical && POLICY_ACTIVITIES.has(canonical)) {
      return ['Transforming Business']
    }
  }

  return ['Transforming Business']
}
