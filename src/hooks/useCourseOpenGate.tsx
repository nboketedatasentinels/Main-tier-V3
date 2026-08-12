import React, { useCallback, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { NativeCourseAssessmentModal } from '@/components/modals/NativeCourseAssessmentModal'
import { findNativeCourseAssessment } from '@/config/nativeCourseAssessments'
import { hasCompletedSelfCourseAssessment } from '@/services/courseAssessmentService'
import { resolvePreCourseSurveyUrl } from '@/config/courseSurveys'
import { PreCourseSurveyModal } from '@/components/modals/PreCourseSurveyModal'
import { markPreCourseSurveyCompleted } from '@/services/preCourseSurveyService'

interface UseCourseOpenGateResult {
  /**
   * Call from an onClick handler with the destination URL.
   * Pass courseTitle when available so the correct Pre survey opens.
   * Learner Pre must be submitted before the course URL opens (unlock).
   */
  requestOpenCourse: (url: string, courseTitle?: string) => void
  /**
   * Open learner Post assessment after course complete.
   * No URL required — modal only.
   */
  requestPostAssessment: (courseTitle: string) => void
  /** Render this once at the top of your page. */
  surveyModal: React.ReactNode
  /** Reserved for callers that still read this flag. */
  surveyCompleted: boolean
}

type PendingMode = 'pre' | 'post' | null

export function useCourseOpenGate(): UseCourseOpenGateResult {
  const { profile } = useAuth()
  const uid = profile?.id ?? null
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [pendingCourseTitle, setPendingCourseTitle] = useState<string | null>(null)
  const [pendingMode, setPendingMode] = useState<PendingMode>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [legacyOpen, setLegacyOpen] = useState(false)

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const clearPending = () => {
    setPendingUrl(null)
    setPendingCourseTitle(null)
    setPendingMode(null)
    setLegacyOpen(false)
  }

  const nativeDefinition =
    pendingMode && pendingCourseTitle
      ? findNativeCourseAssessment(pendingCourseTitle, pendingMode, 'self')
      : null

  const requestOpenCourse = useCallback(
    async (url: string, courseTitle?: string) => {
      if (!url) return
      const title = courseTitle?.trim() || null
      const definition = findNativeCourseAssessment(title, 'pre', 'self')

      if (!uid) {
        openInNewTab(url)
        return
      }

      if (definition) {
        setChecking(true)
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
          setPendingCourseTitle(title)
          setPendingUrl(url)
          setPendingMode('pre')
          setLegacyOpen(false)
        } catch (err) {
          console.error('[useCourseOpenGate] native pre check failed', err)
          setPendingCourseTitle(title)
          setPendingUrl(url)
          setPendingMode('pre')
          setLegacyOpen(false)
        } finally {
          setChecking(false)
        }
        return
      }

      setPendingCourseTitle(title)
      setPendingUrl(url)
      setPendingMode('pre')
      setLegacyOpen(true)
    },
    [uid],
  )

  const requestPostAssessment = useCallback(
    async (courseTitle: string) => {
      if (!uid || !courseTitle.trim()) return
      const definition = findNativeCourseAssessment(courseTitle, 'post', 'self')
      if (!definition) return

      setChecking(true)
      try {
        const done = await hasCompletedSelfCourseAssessment({
          userId: uid,
          courseKey: definition.courseKey,
          kind: 'post',
        })
        if (done) return
        setPendingCourseTitle(courseTitle.trim())
        setPendingUrl(null)
        setPendingMode('post')
        setLegacyOpen(false)
      } catch (err) {
        console.error('[useCourseOpenGate] native post check failed', err)
        setPendingCourseTitle(courseTitle.trim())
        setPendingUrl(null)
        setPendingMode('post')
        setLegacyOpen(false)
      } finally {
        setChecking(false)
      }
    },
    [uid],
  )

  const handleNativeCompleted = useCallback(async () => {
    const target = pendingUrl
    clearPending()
    if (target) openInNewTab(target)
  }, [pendingUrl])

  const handleLegacyCompleted = useCallback(async () => {
    if (!uid) return
    setSubmitting(true)
    try {
      await markPreCourseSurveyCompleted(uid)
      const target = pendingUrl
      clearPending()
      if (target) openInNewTab(target)
    } finally {
      setSubmitting(false)
    }
  }, [uid, pendingUrl])

  const surveyModal =
    pendingMode && nativeDefinition && !legacyOpen && uid ? (
      <NativeCourseAssessmentModal
        isOpen
        definition={nativeDefinition}
        courseTitle={pendingCourseTitle}
        respondentId={uid}
        subjectUserId={uid}
        raterRole="learner"
        isSubmitting={submitting || checking}
        onClose={clearPending}
        onCompleted={handleNativeCompleted}
      />
    ) : (
      <PreCourseSurveyModal
        isOpen={pendingMode === 'pre' && pendingUrl !== null && legacyOpen}
        isSubmitting={submitting}
        surveyUrl={resolvePreCourseSurveyUrl(pendingCourseTitle)}
        onClose={clearPending}
        onCompleted={handleLegacyCompleted}
      />
    )

  return {
    requestOpenCourse: (url, courseTitle) => {
      void requestOpenCourse(url, courseTitle)
    },
    requestPostAssessment: (courseTitle) => {
      void requestPostAssessment(courseTitle)
    },
    surveyModal,
    surveyCompleted: false,
  }
}
