import { useCallback, useEffect, useState } from 'react'
import { notifyAsLeadership } from '@/services/notificationService'
import { supabase } from '@/services/supabase'

const MAX_GOALS_LENGTH = 2000

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const asUuid = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return UUID_RE.test(trimmed) ? trimmed : null
}

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

    // No realtime subscription here. Mentor dashboard + Session Prep often mount
    // this hook together; supabase.channel reuse then throws
    // "cannot add postgres_changes callbacks after subscribe()" and crashes the page.
    // Load-on-mount + local state after save is enough for this surface.
    return () => {
      cancelled = true
    }
  }, [learnerId])

  const save = useCallback(
    async (nextGoals: string) => {
      const learnerUuid = asUuid(learnerId)
      if (!learnerUuid) {
        throw new Error('A valid learner id is required before saving goals.')
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
        const actorId = asUuid(user?.id) ?? learnerUuid
        // Prefer a valid assigned id; otherwise the signed-in mentor/coach so
        // the FK always resolves (legacy non-uuid ids caused save failures).
        const mentorUuid = asUuid(assignedMentorId) ?? actorId

        const { error: writeError } = await supabase.from('mentorship_goals').upsert(
          {
            learner_id: learnerUuid,
            mentor_id: mentorUuid,
            goals: trimmed,
            updated_by: actorId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'learner_id' },
        )
        if (writeError) throw new Error(writeError.message)
        setState({
          goals: trimmed,
          mentorId: mentorUuid,
          updatedAt: new Date(),
          updatedBy: actorId,
        })

        // Mentor/coach "sent" a goal → learner bell notification (not when
        // the learner edits their own goal on Leadership Council).
        if (actorId !== learnerUuid) {
          const preview =
            trimmed.length > 160 ? `${trimmed.slice(0, 157).trimEnd()}…` : trimmed
          const { data: actorProfile } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', actorId)
            .maybeSingle()
          const actorRole = String(actorProfile?.role ?? '').toLowerCase()
          const isCoach =
            actorRole === 'ambassador' || actorRole === 'coach'
          const actorLabel = isCoach ? 'coach' : 'mentor'
          const actorName =
            (typeof actorProfile?.full_name === 'string' &&
              actorProfile.full_name.trim()) ||
            (isCoach ? 'Your coach' : 'Your mentor')

          await notifyAsLeadership({
            userId: learnerUuid,
            type: 'important_update',
            title: `${actorName} updated your ${actorLabel} goal`,
            message: preview
              ? `"${preview}" — open Leadership Council to review.`
              : `Your ${actorLabel} cleared your goal. Open Leadership Council to review.`,
            relatedId: learnerUuid,
            category: 'important_updates',
            data: {
              priority: 'push',
              kind: 'mentorship_goal_updated',
              actorId,
              actorRole: actorLabel,
              actionUrl: '/app/leadership-council',
            },
          }).catch((notifyErr) => {
            console.warn('[useMentorshipGoals] learner notify failed', notifyErr)
          })
        }
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
