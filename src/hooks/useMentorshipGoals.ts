import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'

const MAX_GOALS_LENGTH = 2000

export interface MentorshipGoalsDoc {
  goals: string
  mentorId: string | null
  updatedAt: Date | null
  updatedBy: string | null
}

export interface UseMentorshipGoalsResult {
  goals: string
  mentorId: string | null
  updatedAt: Date | null
  updatedBy: string | null
  loading: boolean
  saving: boolean
  error: string | null
  save: (nextGoals: string) => Promise<void>
}

const emptyGoals: MentorshipGoalsDoc = {
  goals: '',
  mentorId: null,
  updatedAt: null,
  updatedBy: null,
}

const parseTs = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * Mentorship / coaching goals for Session Prep — Supabase-backed.
 * (Firestore mentorship_goals returned empty under Supabase-only auth.)
 */
export const useMentorshipGoals = (
  learnerId?: string | null,
  assignedMentorId?: string | null,
): UseMentorshipGoalsResult => {
  const [state, setState] = useState<MentorshipGoalsDoc>(emptyGoals)
  const [loading, setLoading] = useState<boolean>(Boolean(learnerId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!learnerId) {
      setState(emptyGoals)
      setLoading(false)
      setError(null)
      return () => undefined
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const load = async () => {
      const { data, error: readError } = await supabase
        .from('mentorship_goals')
        .select('goals, mentor_id, updated_at, updated_by')
        .eq('learner_id', learnerId)
        .maybeSingle()

      if (cancelled) return
      if (readError) {
        console.error('[useMentorshipGoals] load failed', readError)
        setError(readError.message)
        setState(emptyGoals)
        setLoading(false)
        return
      }
      if (!data) {
        setState(emptyGoals)
        setLoading(false)
        return
      }
      setState({
        goals: typeof data.goals === 'string' ? data.goals : '',
        mentorId: typeof data.mentor_id === 'string' ? data.mentor_id : null,
        updatedAt: parseTs(data.updated_at),
        updatedBy: typeof data.updated_by === 'string' ? data.updated_by : null,
      })
      setLoading(false)
    }

    void load()

    const channel = supabase
      .channel(`mentorship_goals_${learnerId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mentorship_goals',
          filter: `learner_id=eq.${learnerId}`,
        },
        () => {
          void load()
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [learnerId])

  const save = useCallback(
    async (nextGoals: string) => {
      if (!learnerId) {
        throw new Error('A learner id is required before saving goals.')
      }
      const trimmed = nextGoals.trim()
      if (trimmed.length > MAX_GOALS_LENGTH) {
        throw new Error(`Goals must be ${MAX_GOALS_LENGTH} characters or fewer.`)
      }

      setSaving(true)
      setError(null)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const actorId = user?.id ?? learnerId
        const { error: writeError } = await supabase.from('mentorship_goals').upsert(
          {
            learner_id: learnerId,
            mentor_id: assignedMentorId ?? null,
            goals: trimmed,
            updated_by: actorId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'learner_id' },
        )
        if (writeError) throw new Error(writeError.message)
        setState({
          goals: trimmed,
          mentorId: assignedMentorId ?? null,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save goals.'
        setError(message)
        throw err instanceof Error ? err : new Error(message)
      } finally {
        setSaving(false)
      }
    },
    [learnerId, assignedMentorId],
  )

  return {
    goals: state.goals,
    mentorId: state.mentorId,
    updatedAt: state.updatedAt,
    updatedBy: state.updatedBy,
    loading,
    saving,
    error,
    save,
  }
}

export const MENTORSHIP_GOALS_MAX_LENGTH = MAX_GOALS_LENGTH
