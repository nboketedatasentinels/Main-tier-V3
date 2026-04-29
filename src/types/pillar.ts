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

/**
 * Per-pillar 6-week course plan: each pillar has exactly two courses with
 * pillar-specific week splits totaling 6 weeks.
 *
 * Used by CreateOrganizationModal to auto-fill course assignments when an
 * admin selects a pillar for a 6-week cohort.
 */
export interface PillarCoursePlanEntry {
  /** Course slug (matches `courseId` in `monthlyCourseAssignments`). */
  courseId: string
  /** Display title (matches the canonical title in COURSE_DETAILS_MAPPING). */
  title: string
  /** Number of weeks this course occupies in the 6-week cohort. */
  weeks: number
  /** Inclusive 1-indexed week range, e.g. [1, 2] = "Weeks 1-2". */
  weekRange: [number, number]
}

export const PILLAR_COURSE_PLAN: Record<Pillar, [PillarCoursePlanEntry, PillarCoursePlanEntry]> = {
  leading_self: [
    {
      courseId: 'mindset-reset',
      title: "Leading Under Pressure: The Transformation Leader's Operating System",
      weeks: 3,
      weekRange: [1, 3],
    },
    {
      courseId: 'confidence-code',
      title: 'Authority and Presence in High-Stakes Transformation',
      weeks: 3,
      weekRange: [4, 6],
    },
  ],
  innovation_technology: [
    {
      courseId: 'ai-stacking-101',
      title: 'AI for Transformation Leaders: Judgment Over Features',
      weeks: 1,
      weekRange: [1, 1],
    },
    {
      courseId: 'digital-transformation-data',
      title: 'Digital Transformation with Data Sentinels',
      weeks: 5,
      weekRange: [2, 6],
    },
  ],
  transforming_business: [
    {
      courseId: 'art-of-connection',
      title: 'Stakeholder Influence for Transformation Leaders',
      weeks: 2,
      weekRange: [1, 2],
    },
    {
      courseId: 'leading-through-change',
      title: 'Leading Through Change and Continuous Improvement',
      weeks: 4,
      weekRange: [3, 6],
    },
  ],
  fostering: [
    {
      courseId: 'heart-of-leadership',
      title: 'The Leader Your Transformation Team Actually Needs',
      weeks: 2,
      weekRange: [1, 2],
    },
    {
      courseId: 'foundations-of-leadership',
      title: 'Building Teams That Survive Transformation',
      weeks: 4,
      weekRange: [3, 6],
    },
  ],
}

export const formatPillarWeekRange = (range: [number, number]): string =>
  range[0] === range[1] ? `Week ${range[0]}` : `Weeks ${range[0]}-${range[1]}`
