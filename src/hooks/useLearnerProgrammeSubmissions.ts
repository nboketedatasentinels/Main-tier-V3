import { useEffect, useState } from 'react'
import {
  listSubmissionsForLearner,
  type ProgrammeComponentSubmission,
} from '@/services/programmeComponentSubmissionService'

export type SessionPrepSubmissionSignal = {
  title: string
  componentType: string | null
  status: string | null
  excerpt: string | null
}

const firstAnswerExcerpt = (answers: Record<string, string>): string | null => {
  for (const value of Object.values(answers || {})) {
    const trimmed = (value || '').trim().replace(/\s+/g, ' ')
    if (trimmed) return trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed
  }
  return null
}

export const toSessionPrepSubmissionSignals = (
  rows: ProgrammeComponentSubmission[],
): SessionPrepSubmissionSignal[] => {
  const out: SessionPrepSubmissionSignal[] = []
  for (const row of rows) {
    const title =
      (row.partTitle || '').trim() ||
      (row.componentTitle || '').trim() ||
      (row.componentType || '').replace(/_/g, ' ').trim()
    if (!title) continue
    out.push({
      title,
      componentType: row.componentType,
      status: row.status,
      excerpt: firstAnswerExcerpt(row.answers),
    })
  }
  return out
}
/** Loads recent programme submissions for Session Prep. */
export const useLearnerProgrammeSubmissions = (learnerId?: string | null) => {
  const [submissions, setSubmissions] = useState<SessionPrepSubmissionSignal[]>([])
  const [loading, setLoading] = useState(Boolean(learnerId))

  useEffect(() => {
    if (!learnerId) {
      setSubmissions([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void listSubmissionsForLearner(learnerId)
      .then((rows) => {
        if (cancelled) return
        setSubmissions(toSessionPrepSubmissionSignals(rows))
      })
      .catch(() => {
        if (!cancelled) setSubmissions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [learnerId])

  return { submissions, loading }
}
