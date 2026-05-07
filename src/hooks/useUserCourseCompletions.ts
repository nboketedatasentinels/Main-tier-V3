import { useEffect, useMemo, useState } from 'react'
import {
  CourseCompletionRecord,
  listenToUserCourseCompletions,
} from '@/services/courseCompletionService'

const normalizeKey = (value: string) => value.trim().toLowerCase()

interface UserCourseCompletionsState {
  completions: CourseCompletionRecord[]
  /** Lookup keyed by courseId (raw + lowercased) and lowercased course title. */
  completionsByKey: Map<string, CourseCompletionRecord>
  loading: boolean
}

export const useUserCourseCompletions = (userId?: string | null): UserCourseCompletionsState => {
  const [completions, setCompletions] = useState<CourseCompletionRecord[]>([])
  const [loading, setLoading] = useState<boolean>(Boolean(userId))

  useEffect(() => {
    if (!userId) {
      setCompletions([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = listenToUserCourseCompletions(
      userId,
      records => {
        setCompletions(records)
        setLoading(false)
      },
      () => {
        setCompletions([])
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [userId])

  const completionsByKey = useMemo(() => {
    const map = new Map<string, CourseCompletionRecord>()
    completions.forEach(record => {
      if (record.status !== 'approved') return
      if (record.courseId) {
        map.set(record.courseId, record)
        map.set(normalizeKey(record.courseId), record)
      }
      if (record.courseSlug) {
        map.set(record.courseSlug, record)
        map.set(normalizeKey(record.courseSlug), record)
      }
      if (record.courseTitle) {
        map.set(normalizeKey(record.courseTitle), record)
      }
    })
    return map
  }, [completions])

  return { completions, completionsByKey, loading }
}
