import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { findNativeCourseAssessment } from '@/config/nativeCourseAssessments'
import { hasCompletedSelfCourseAssessment } from '@/services/courseAssessmentService'
import { buildCourseAssessmentPath } from '@/utils/courseAssessmentPaths'

interface UseCourseOpenGateResult {
  /**
   * Call from an onClick handler with the destination URL.
   * Pass courseTitle when available so the correct Pre survey opens.
   * Learner Pre must be submitted before the course URL opens (unlock).
   */
  requestOpenCourse: (url: string, courseTitle?: string) => void
  /**
   * Open learner Post assessment after course complete.
   */
  requestPostAssessment: (courseTitle: string) => void
  /** Legacy SurveyMonkey modal removed - always null. */
  surveyModal: React.ReactNode
  /** Reserved for callers that still read this flag. */
  surveyCompleted: boolean
}

export function useCourseOpenGate(): UseCourseOpenGateResult {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const uid = profile?.id ?? null

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const requestOpenCourse = useCallback(
    async (url: string, courseTitle?: string) => {
      if (!url) return
      const title = courseTitle?.trim() || null
      const definition = findNativeCourseAssessment(title, 'pre', 'self')

      if (!uid) {
        openInNewTab(url)
        return
      }

      if (!definition) {
        // No native Pre instrument for this title - do not fall back to SurveyMonkey.
        console.warn('[useCourseOpenGate] no native Pre assessment; opening course', title)
        openInNewTab(url)
        return
      }

      try {
        const done = await hasCompletedSelfCourseAssessment({
          userId: uid,
          courseKey: definition.courseKey,
          kind: 'pre',
        })
        if (done) {
          openInNewTab(url)
          return
        }
        navigate(
          buildCourseAssessmentPath({
            kind: 'pre',
            course: title || definition.title || definition.courseKey,
            unlockUrl: url,
            returnTo: `${window.location.pathname}${window.location.search}`,
          }),
        )
      } catch (err) {
        console.error('[useCourseOpenGate] native pre check failed', err)
        navigate(
          buildCourseAssessmentPath({
            kind: 'pre',
            course: title || definition.title || definition.courseKey,
            unlockUrl: url,
            returnTo: `${window.location.pathname}${window.location.search}`,
          }),
        )
      }
    },
    [uid, navigate],
  )

  const requestPostAssessment = useCallback(
    async (courseTitle: string) => {
      if (!uid || !courseTitle.trim()) return
      const definition = findNativeCourseAssessment(courseTitle, 'post', 'self')
      if (!definition) return

      try {
        const done = await hasCompletedSelfCourseAssessment({
          userId: uid,
          courseKey: definition.courseKey,
          kind: 'post',
        })
        if (done) return
        navigate(
          buildCourseAssessmentPath({
            kind: 'post',
            course: courseTitle.trim(),
            returnTo: `${window.location.pathname}${window.location.search}`,
          }),
        )
      } catch (err) {
        console.error('[useCourseOpenGate] native post check failed', err)
        navigate(
          buildCourseAssessmentPath({
            kind: 'post',
            course: courseTitle.trim(),
            returnTo: `${window.location.pathname}${window.location.search}`,
          }),
        )
      }
    },
    [uid, navigate],
  )

  return {
    requestOpenCourse: (url, courseTitle) => {
      void requestOpenCourse(url, courseTitle)
    },
    requestPostAssessment: (courseTitle) => {
      void requestPostAssessment(courseTitle)
    },
    surveyModal: null,
    surveyCompleted: false,
  }
}
