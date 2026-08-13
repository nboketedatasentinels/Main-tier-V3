import { useEffect, useState } from 'react'
import type { PillarKey } from '@/config/liftAssessment'
import { getSessionPrepLift } from '@/services/liftAssessmentService'

export const useSessionPrepLift = (learnerId?: string | null) => {
  const [pillars, setPillars] = useState<Record<PillarKey, number> | null>(null)
  const [developmentEdge, setDevelopmentEdge] = useState<PillarKey | null>(null)
  const [loading, setLoading] = useState(Boolean(learnerId))

  useEffect(() => {
    if (!learnerId) {
      setPillars(null)
      setDevelopmentEdge(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void getSessionPrepLift(learnerId)
      .then((row) => {
        if (cancelled) return
        setPillars(row?.pillars ?? null)
        setDevelopmentEdge(row?.developmentEdge ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setPillars(null)
          setDevelopmentEdge(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [learnerId])

  return { pillars, developmentEdge, loading }
}
