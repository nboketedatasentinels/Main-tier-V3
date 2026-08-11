import React, { useCallback, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePreCourseSurvey } from '@/hooks/usePreCourseSurvey'
import { markPreCourseSurveyCompleted } from '@/services/preCourseSurveyService'
import { PreCourseSurveyModal } from '@/components/modals/PreCourseSurveyModal'
import { resolvePreCourseSurveyUrl } from '@/config/courseSurveys'

interface UseCourseOpenGateResult {
  /**
   * Call from an onClick handler with the destination URL.
   * Pass courseTitle when available so the correct Pre survey opens.
   */
  requestOpenCourse: (url: string, courseTitle?: string) => void
  /** Render this once at the top of your page. */
  surveyModal: React.ReactNode
  /** True once the user has done the pre-course survey. */
  surveyCompleted: boolean
}

export function useCourseOpenGate(): UseCourseOpenGateResult {
  const { profile } = useAuth()
  const uid = profile?.id ?? null
  const { state, loading } = usePreCourseSurvey(uid)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [pendingCourseTitle, setPendingCourseTitle] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const requestOpenCourse = useCallback(
    (url: string, courseTitle?: string) => {
      if (!url) return
      // While we don't know yet, default to opening (avoids blocking on slow networks).
      if (loading) {
        openInNewTab(url)
        return
      }
      if (state.completed) {
        openInNewTab(url)
        return
      }
      setPendingCourseTitle(courseTitle?.trim() || null)
      setPendingUrl(url)
    },
    [loading, state.completed],
  )

  const handleCompleted = useCallback(async () => {
    if (!uid) return
    setSubmitting(true)
    try {
      await markPreCourseSurveyCompleted(uid)
      const target = pendingUrl
      setPendingUrl(null)
      setPendingCourseTitle(null)
      if (target) openInNewTab(target)
    } finally {
      setSubmitting(false)
    }
  }, [uid, pendingUrl])

  const surveyModal = (
    <PreCourseSurveyModal
      isOpen={pendingUrl !== null}
      isSubmitting={submitting}
      surveyUrl={resolvePreCourseSurveyUrl(pendingCourseTitle)}
      onClose={() => {
        setPendingUrl(null)
        setPendingCourseTitle(null)
      }}
      onCompleted={handleCompleted}
    />
  )

  return { requestOpenCourse, surveyModal, surveyCompleted: state.completed }
}
