import type { CourseAssessmentKind } from '@/config/nativeCourseAssessments'

export const COURSE_ASSESSMENT_PAGE_PATH = '/app/assessments/course'

export const buildCourseAssessmentPath = (params: {
  kind?: CourseAssessmentKind
  course?: string | null
  unlockUrl?: string | null
  returnTo?: string | null
}): string => {
  const qs = new URLSearchParams()
  qs.set('kind', params.kind === 'post' ? 'post' : 'pre')
  if (params.course?.trim()) qs.set('course', params.course.trim())
  if (params.unlockUrl?.trim()) qs.set('unlockUrl', params.unlockUrl.trim())
  if (params.returnTo?.trim()) qs.set('returnTo', params.returnTo.trim())
  return `${COURSE_ASSESSMENT_PAGE_PATH}?${qs.toString()}`
}
