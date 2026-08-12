import { useCallback, useEffect, useState } from 'react'
import { getSelfAssessmentStatusByCourse } from '@/services/courseAssessmentService'
import { findNativeCourseAssessment } from '@/config/nativeCourseAssessments'

/**
 * Per-course learner self Pre/Post completion for rail / CTAs.
 * Keys include both courseKey and normalized title matchers when resolvable.
 */
export function useLearnerCourseAssessmentStatus(userId?: string | null) {
  const [byCourseKey, setByCourseKey] = useState<Record<string, { pre: boolean; post: boolean }>>(
    {},
  )
  const [loading, setLoading] = useState(Boolean(userId))
  const [version, setVersion] = useState(0)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!userId) {
      setByCourseKey({})
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void getSelfAssessmentStatusByCourse(userId)
      .then((map) => {
        if (!cancelled) setByCourseKey(map)
      })
      .catch((err) => {
        console.error('[useLearnerCourseAssessmentStatus]', err)
        if (!cancelled) setByCourseKey({})
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, version])

  const statusForTitle = useCallback(
    (courseTitle?: string | null): { pre: boolean; post: boolean } => {
      if (!courseTitle) return { pre: false, post: false }
      const preDef = findNativeCourseAssessment(courseTitle, 'pre', 'self')
      const postDef = findNativeCourseAssessment(courseTitle, 'post', 'self')
      const key = preDef?.courseKey || postDef?.courseKey
      if (key && byCourseKey[key]) return byCourseKey[key]
      return { pre: false, post: false }
    },
    [byCourseKey],
  )

  return { byCourseKey, statusForTitle, loading, refresh }
}
