import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { CourseTestsRequiredModal } from '@/components/modals/CourseTestsRequiredModal'
import { findNativeCourseAssessment } from '@/config/nativeCourseAssessments'
import { hasCompletedSelfCourseAssessment } from '@/services/courseAssessmentService'
import { buildCourseAssessmentPath } from '@/utils/courseAssessmentPaths'

const PERSONALITY_TEST_URL = 'https://www.16personalities.com/free-personality-test'
const VALUES_TEST_URL = 'https://personalvalu.es/'

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
  const { profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const uid = profile?.id ?? null
  const [blockedCourse, setBlockedCourse] = useState<{ title: string; url: string } | null>(null)
  const testsDone = Boolean(
    profile?.hasCompletedPersonalityTest && profile?.hasCompletedValuesTest,
  )

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const startRequiredTest = useCallback(
    async (kind: 'personality' | 'values') => {
      openInNewTab(kind === 'personality' ? PERSONALITY_TEST_URL : VALUES_TEST_URL)
      if (!profile?.id) return
      const field = kind === 'personality' ? 'personalityTestStartedAt' : 'valuesTestStartedAt'
      if (profile[field]) return
      await updateProfile({ [field]: new Date().toISOString() })
    },
    [profile, updateProfile],
  )

  const goPickResults = useCallback(() => {
    setBlockedCourse(null)
    navigate('/app/weekly-glance#personality-profile-card')
  }, [navigate])

  const requestOpenCourse = useCallback(
    async (url: string, courseTitle?: string) => {
      if (!url) return
      if (!testsDone) {
        setBlockedCourse({ title: courseTitle?.trim() || 'This course', url })
        return
      }
      setBlockedCourse(null)
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
    [uid, navigate, testsDone],
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
    surveyModal: (
      <CourseTestsRequiredModal
        isOpen={blockedCourse !== null}
        onClose={() => setBlockedCourse(null)}
        courseTitle={blockedCourse?.title}
        personalityStatus={profile?.hasCompletedPersonalityTest ? 'done' : 'not_started'}
        valuesStatus={profile?.hasCompletedValuesTest ? 'done' : 'not_started'}
        onStartPersonality={() => void startRequiredTest('personality')}
        onStartValues={() => void startRequiredTest('values')}
        onPickPersonality={goPickResults}
        onPickValues={goPickResults}
        onProceed={() => {
          const course = blockedCourse
          if (!course) return
          setBlockedCourse(null)
          void requestOpenCourse(course.url, course.title)
        }}
      />
    ),
    surveyCompleted: false,
  }
}
