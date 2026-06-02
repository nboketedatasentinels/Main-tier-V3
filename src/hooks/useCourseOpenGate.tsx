import React, { useCallback, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePreCourseSurvey } from '@/hooks/usePreCourseSurvey'
import {
  completePreCourseSurvey,
  type PreCourseSurveyAnswers,
} from '@/services/preCourseSurveyService'
import { PreCourseSurveyScreen } from '@/components/survey/PreCourseSurveyScreen'

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

  const initialValues = useMemo<Partial<PreCourseSurveyAnswers>>(
    () => ({
      email: profile?.email ?? '',
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      organization: profile?.companyName ?? '',
    }),
    [profile?.email, profile?.firstName, profile?.lastName, profile?.companyName],
  )

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

  const handleSubmit = useCallback(
    async (answers: PreCourseSurveyAnswers) => {
      if (!uid) return
      setSubmitting(true)
      try {
        await completePreCourseSurvey(uid, answers, {
          // Mirror the capstone runtime's org precedence so the submission
          // lands under the same id the learner's partner already queries.
          organizationId: profile?.organizationId ?? profile?.companyId ?? null,
          companyId: profile?.companyId ?? null,
          displayName: profile?.fullName ?? null,
        })
        const target = pendingUrl
        setPendingUrl(null)
        if (target) openInNewTab(target)
      } finally {
        setSubmitting(false)
      }
    },
    [uid, pendingUrl, profile?.organizationId, profile?.companyId, profile?.fullName],
  )

  const surveyModal = (
    <PreCourseSurveyScreen
      isOpen={pendingUrl !== null}
      isSubmitting={submitting}
      initialValues={initialValues}
      onClose={() => setPendingUrl(null)}
      onSubmit={handleSubmit}
    />
  )

  return { requestOpenCourse, surveyModal, surveyCompleted: state.completed }
}
