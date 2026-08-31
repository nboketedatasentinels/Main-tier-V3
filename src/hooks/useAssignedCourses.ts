import { useMemo } from 'react'
import { addDays } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationProgramCourses } from '@/hooks/useOrganizationProgramCourses'
import {
  getCourseDetailsFromMapping,
  getCourseMetadataFromMapping,
  resolveCourseTitleFromMapping,
  type CourseDifficulty,
} from '@/utils/courseMappings'
import {
  getMonthlyAssignmentsArray,
  getMonthAvailabilityStatus,
  getMonthDateRange,
} from '@/utils/monthlyCourseAssignments'
import { getJourneyTimelineDisplayMode, getJourneyWeeks, isMonthBasedJourney } from '@/utils/journeyType'
import { getPointsPerCourse } from '@/config/pointsConfig'
import type { CourseAvailability } from '@/components/courses/AssignedCourseCard'
import type { UserProfile } from '@/types'
import { isFreeUser } from '@/utils/membership'

/** Complementary course shown beside Rules of Engagement for free (non-org) learners. */
const FREE_USER_COMPLEMENTARY_COURSE_ID = 'transformational-leadership'

export interface AssignedCourse {
  id: string
  title: string
  description: string
  link?: string
  estimatedMinutes?: number
  difficulty?: CourseDifficulty
  points: number | null
  /** e.g. "Weeks 1-2" or "Month 2" - the block this course belongs to. */
  periodLabel: string
  /** Drives the copy used for empty/unassigned blocks. */
  periodNoun: 'week' | 'month'
  dateRange?: string
  unlockDate: Date | null
  availability: CourseAvailability
}

const resolveOrganizationId = (profile: UserProfile | null): string | null => {
  if (!profile) return null
  if (profile.organizationId) return profile.organizationId
  if (profile.companyId) return profile.companyId
  if (profile.assignedOrganizations?.length === 1) return profile.assignedOrganizations[0]
  return null
}

const formatRange = (startDate: Date, endDate: Date) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const endDisplay = new Date(endDate)
  endDisplay.setDate(endDisplay.getDate() - 1)
  return `${formatter.format(startDate)} - ${formatter.format(endDisplay)}`
}

const getWeekAvailability = (
  cohortStartDate: Date | null,
  now: Date,
  weekIndex: number,
  weeksPerBlock: number
): CourseAvailability => {
  if (!cohortStartDate) return weekIndex === 0 ? 'current' : 'locked'
  const startDate = addDays(cohortStartDate, weekIndex * 7)
  const endDate = addDays(startDate, weeksPerBlock * 7)
  if (now < startDate) return 'locked'
  if (now >= endDate) return 'past'
  return 'current'
}

/** Course details from the in-repo catalog (courseMappings.ts). */
const buildCourse = (courseId: string) => {
  const title = resolveCourseTitleFromMapping(courseId)
  const details = getCourseDetailsFromMapping(title)
  if (!details) return null
  const metadata = getCourseMetadataFromMapping(title)
  return {
    id: details.slug,
    title,
    description: details.description,
    link: details.link,
    estimatedMinutes: metadata?.estimatedMinutes,
    difficulty: metadata?.difficulty,
  }
}

const buildFreeUserCourse = (): AssignedCourse | null => {
  const course = buildCourse(FREE_USER_COMPLEMENTARY_COURSE_ID)
  if (!course) return null
  const details = getCourseDetailsFromMapping(course.title)
  return {
    ...course,
    points: details?.points ?? null,
    periodLabel: 'Complementary',
    periodNoun: 'week',
    dateRange: undefined,
    unlockDate: null,
    availability: 'current',
  }
}

/**
 * The learner's assigned programme courses, resolved with the same block /
 * availability rules the full My Courses timeline uses. Blocks with no course
 * assigned are dropped, so this is "the courses I was given", in order.
 *
 * Free non-org learners get Transformational Leadership (complementary) so
 * weekly glance can keep the video + course flex row populated.
 *
 * Used by the weekly glance dashboard; My Courses keeps its own timeline
 * because it also renders empty blocks and Firestore-sourced course docs.
 */
export const useAssignedCourses = () => {
  const { profile } = useAuth()
  const organizationId = useMemo(() => resolveOrganizationId(profile ?? null), [profile])
  const { program, loading } = useOrganizationProgramCourses(organizationId)
  const freeTier = useMemo(() => isFreeUser(profile ?? null), [profile])

  const courses = useMemo<AssignedCourse[]>(() => {
    // Free learners without an organisation still need a course card beside
    // the Rules of Engagement video on weekly glance.
    if (!organizationId && freeTier) {
      const freeCourse = buildFreeUserCourse()
      return freeCourse ? [freeCourse] : []
    }

    if (!program) return []
    const now = new Date()
    const { journeyType, cohortStartDate } = program
    const pointsPerCourse = getPointsPerCourse(journeyType)

    // ── Month-based journeys (3M and longer) ────────────────────────────────
    if (journeyType && isMonthBasedJourney(journeyType) && program.totalMonths) {
      const monthly = getMonthlyAssignmentsArray(program.monthlyAssignments, program.totalMonths)
      return monthly
        .map((courseId, index) => {
          if (!courseId) return null
          const course = buildCourse(courseId)
          if (!course) return null
          const range = cohortStartDate ? getMonthDateRange(cohortStartDate, index) : null
          return {
            ...course,
            points: pointsPerCourse,
            periodLabel: `Month ${index + 1}`,
            periodNoun: 'month' as const,
            dateRange: range ? formatRange(range.startDate, range.endDate) : undefined,
            unlockDate: range ? range.startDate : null,
            availability: getMonthAvailabilityStatus({
              cohortStartDate,
              currentDate: now,
              monthIndex: index,
            }),
          }
        })
        .filter(Boolean) as AssignedCourse[]
    }

    // ── Week-based journeys (4W / 6W) ───────────────────────────────────────
    // Prefer monthly/window map order (admin slot 1 → learner course 1).
    const fallback = getMonthlyAssignmentsArray(program.monthlyAssignments, program.totalMonths)
    const assignments = fallback.some(Boolean) ? fallback : program.courseAssignments
    const assignedIds = assignments.filter(Boolean)
    if (!assignedIds.length) return []

    const totalWeeks = program.programDurationWeeks ?? (journeyType ? getJourneyWeeks(journeyType) : null)
    const display =
      journeyType && getJourneyTimelineDisplayMode(journeyType) === 'course-count'
        ? assignedIds
        : Array.from({ length: totalWeeks ?? assignedIds.length }, (_, i) => assignments[i] || '')

    const is6W = journeyType === '6W'
    const weeksPerBlock = is6W ? 2 : 1
    const journeyWeeks = totalWeeks ?? display.length * weeksPerBlock

    return display
      .map((courseId, index) => {
        if (!courseId) return null
        const course = buildCourse(courseId)
        if (!course) return null

        const startWeekIndex = index * weeksPerBlock
        const isLastBlock = index === display.length - 1
        // Stretch the final block over any remaining weeks so nothing is
        // unassigned - mirrors the courses page.
        const blockWeeks = isLastBlock
          ? Math.max(weeksPerBlock, journeyWeeks - startWeekIndex)
          : weeksPerBlock
        const lastWeek = startWeekIndex + blockWeeks
        const startDate = cohortStartDate ? addDays(cohortStartDate, startWeekIndex * 7) : null
        const endDate = startDate ? addDays(startDate, blockWeeks * 7) : null

        return {
          ...course,
          points: pointsPerCourse,
          periodLabel:
            blockWeeks === 1 ? `Week ${startWeekIndex + 1}` : `Weeks ${startWeekIndex + 1} - ${lastWeek}`,
          periodNoun: 'week' as const,
          dateRange: startDate && endDate ? formatRange(startDate, endDate) : undefined,
          unlockDate: startDate,
          availability: getWeekAvailability(cohortStartDate, now, startWeekIndex, blockWeeks),
        }
      })
      .filter(Boolean) as AssignedCourse[]
  }, [program, organizationId, freeTier])

  return {
    courses,
    loading: freeTier && !organizationId ? false : loading,
    hasProgram: Boolean(program) || (freeTier && !organizationId && courses.length > 0),
    hasOrganization: Boolean(organizationId),
  }
}
