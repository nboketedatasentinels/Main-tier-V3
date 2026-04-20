import { useCallback, useEffect, useState } from 'react'
import { Timestamp, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'

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

    setLoading(true)
    setError(null)

    const ref = doc(db, 'mentorship_goals', learnerId)
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) {
          setState(emptyGoals)
          setLoading(false)
          return
        }
        const data = snapshot.data() as {
          goals?: string
          mentor_id?: string | null
          updated_at?: Timestamp | null
          updated_by?: string | null
        }
        setState({
          goals: typeof data.goals === 'string' ? data.goals : '',
          mentorId: typeof data.mentor_id === 'string' ? data.mentor_id : null,
          updatedAt: data.updated_at instanceof Timestamp ? data.updated_at.toDate() : null,
          updatedBy: typeof data.updated_by === 'string' ? data.updated_by : null,
        })
        setLoading(false)
      },
      (err) => {
        console.error('[useMentorshipGoals] load failed', err)
        setError(err.message)
        setLoading(false)
      },
    )

    return () => unsubscribe()
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
        await setDoc(
          doc(db, 'mentorship_goals', learnerId),
          {
            user_id: learnerId,
            learner_id: learnerId,
            mentor_id: assignedMentorId ?? null,
            goals: trimmed,
            updated_at: serverTimestamp(),
            updated_by: learnerId,
          },
          { merge: true },
        )
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
