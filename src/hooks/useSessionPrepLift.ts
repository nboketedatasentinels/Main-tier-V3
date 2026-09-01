import { useEffect, useState } from 'react'
import type { PillarKey } from '@/config/liftAssessment'
import { getSessionPrepLift } from '@/services/liftAssessmentService'

export const useSessionPrepLift = (learnerId?: string | null) => {
  const [pillars, setPillars] = useState<Record<PillarKey, number> | null>(null)
  const [developmentEdge, setDevelopmentEdge] = useState<PillarKey | null>(null)
  const [liftIndex, setLiftIndex] = useState<number | null>(null)
  const [archetype, setArchetype] = useState<import('@/config/liftAssessment').Archetype | null>(null)
  const [loading, setLoading] = useState(Boolean(learnerId))

  useEffect(() => {
    if (!learnerId) {
      setPillars(null)
      setDevelopmentEdge(null)
      setLiftIndex(null)
      setArchetype(null)
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
        setLiftIndex(row?.liftIndex ?? null)
        setArchetype(row?.archetype ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setPillars(null)
          setDevelopmentEdge(null)
          setLiftIndex(null)
          setArchetype(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [learnerId])

  return { pillars, developmentEdge, liftIndex, archetype, loading }
}
