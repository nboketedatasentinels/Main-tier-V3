import { useCallback, useEffect, useState } from 'react'
import { listOrganizationCourses, type OrganizationCourse } from '@/services/organizationCourseService'

/** The organisation's own course library (custom courses), newest first. */
export const useOrganizationCourses = (
  organizationId: string | null | undefined,
  options: { includeArchived?: boolean } = {},
) => {
  const { includeArchived = false } = options
  const [courses, setCourses] = useState<OrganizationCourse[]>([])
  const [loading, setLoading] = useState<boolean>(Boolean(organizationId))
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!organizationId) {
      setCourses([])
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    listOrganizationCourses(organizationId, { includeArchived })
      .then((rows) => {
        if (!cancelled) setCourses(rows)
      })
      .catch((err) => {
        console.error('[useOrganizationCourses] load failed', err)
        if (!cancelled) {
          setCourses([])
          setError('Unable to load this organization’s courses.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, includeArchived, version])

  return { courses, loading, error, reload }
}
