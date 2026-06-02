import { useEffect, useState } from 'react'
import {
  subscribeToPreCourseSurvey,
  type PreCourseSurveyState,
} from '@/services/preCourseSurveyService'

interface Result {
  state: PreCourseSurveyState
  loading: boolean
  error: Error | null
}

export function usePreCourseSurvey(uid: string | null | undefined): Result {
  const [state, setState] = useState<PreCourseSurveyState>({
    completed: false,
    completedAt: null,
    answers: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!uid) {
      setState({ completed: false, completedAt: null, answers: null })
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = subscribeToPreCourseSurvey(
      uid,
      (next) => {
        setState(next)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [uid])

  return { state, loading, error }
}
