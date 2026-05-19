import React, { useCallback, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePreCourseSurvey } from '@/hooks/usePreCourseSurvey'
import { markPreCourseSurveyCompleted } from '@/services/preCourseSurveyService'
import { PreCourseSurveyModal } from '@/components/modals/PreCourseSurveyModal'

interface UseCourseOpenGateResult {
  /** Call this from an onClick handler with the destination URL. */
  requestOpenCourse: (url: string) => void
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
  const [submitting, setSubmitting] = useState(false)

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const requestOpenCourse = useCallback(
    (url: string) => {
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
      if (target) openInNewTab(target)
    } finally {
      setSubmitting(false)
    }
  }, [uid, pendingUrl])

  const surveyModal = (
    <PreCourseSurveyModal
      isOpen={pendingUrl !== null}
      isSubmitting={submitting}
      onClose={() => setPendingUrl(null)}
      onCompleted={handleCompleted}
    />
  )

  return { requestOpenCourse, surveyModal, surveyCompleted: state.completed }
}
