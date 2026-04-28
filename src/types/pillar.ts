/**
 * 6-Week Power Journey pillars.
 *
 * Each pillar splits the 6 weeks into two courses with a different cadence:
 *   - leading_self          → 3 + 3 weeks
 *   - innovation_technology → 1 + 5 weeks
 *   - transforming_business → 2 + 4 weeks
 *   - fostering             → 2 + 4 weeks
 *
 * Stored on `organizations.pillar` and (optionally) mirrored to
 * `profiles.pillar` for per-user notification targeting.
 */

export const PILLAR_OPTIONS = [
  'leading_self',
  'innovation_technology',
  'transforming_business',
  'fostering',
] as const

export type Pillar = (typeof PILLAR_OPTIONS)[number]

export interface PillarMeta {
  value: Pillar
  label: string
  shortName: string
  weekSplit: [number, number]
  exampleCourses: string
}

export const PILLAR_METADATA: Record<Pillar, PillarMeta> = {
  leading_self: {
    value: 'leading_self',
    label: 'Leading Self (3 + 3 weeks)',
    shortName: 'Leading Self',
    weekSplit: [3, 3],
    exampleCourses: 'Leading Under Pressure, then Authority and Presence',
  },
  innovation_technology: {
    value: 'innovation_technology',
    label: 'Innovation & Technology (1 + 5 weeks)',
    shortName: 'Innovation & Technology',
    weekSplit: [1, 5],
    exampleCourses: 'Think Like an Owner, then Delivering Transformation',
  },
  transforming_business: {
    value: 'transforming_business',
    label: 'Transforming Business (2 + 4 weeks)',
    shortName: 'Transforming Business',
    weekSplit: [2, 4],
    exampleCourses: 'Stakeholder Influence for Transformation Leaders, then Leading Through Change and Continuous Improvement',
  },
  fostering: {
    value: 'fostering',
    label: 'Fostering Collaboration (2 + 4 weeks)',
    shortName: 'Fostering',
    weekSplit: [2, 4],
    exampleCourses: 'Foundations of Collaboration, then Building High-Trust Teams',
  },
}

export const isPillar = (value: unknown): value is Pillar =>
  typeof value === 'string' && (PILLAR_OPTIONS as readonly string[]).includes(value)
