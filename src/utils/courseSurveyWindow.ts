import { getJourneyTiming } from '@/utils/weekCalculations'
import type { CourseAssessmentKind } from '@/config/nativeCourseAssessments'

/** Final stretch where the shared CTA switches from Pre → Post. */
export const POST_COURSE_SURVEY_WINDOW_WEEKS = 3

/**
 * Pre for most of the journey; Post when ≤ 3 weeks remain (including journey end).
 */
export const resolveCourseSurveyKind = (params: {
 journeyStartDate?: string | Date | null
 programDurationWeeks?: number | null
 currentWeek?: number | null
 now?: Date
}): CourseAssessmentKind => {
 const totalWeeks = params.programDurationWeeks
 if (typeof totalWeeks !== 'number' || !Number.isFinite(totalWeeks) || totalWeeks <= 0) {
 return 'pre'
 }

 const timing = getJourneyTiming(params.journeyStartDate, totalWeeks, params.now)
 if (timing) {
 if (timing.journeyDaysRemaining <= POST_COURSE_SURVEY_WINDOW_WEEKS * 7) return 'post'
 return 'pre'
 }

 const currentWeek = params.currentWeek
 if (typeof currentWeek === 'number' && Number.isFinite(currentWeek) && currentWeek > 0) {
 // Last 3 journey weeks inclusive (e.g. weeks 10-12 on a 12-week programme).
 if (currentWeek > totalWeeks - POST_COURSE_SURVEY_WINDOW_WEEKS) return 'post'
 }

 return 'pre'
}

export const courseSurveyButtonLabel = (kind: CourseAssessmentKind): string =>
 kind === 'post' ? 'Post-course survey' : 'Pre-course survey'

export const courseSurveySectionTitle = (kind: CourseAssessmentKind): string =>
 kind === 'post' ? 'Post-course survey' : 'Pre-course survey'
